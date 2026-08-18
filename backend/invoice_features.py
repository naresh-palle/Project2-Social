"""flugr Billing & Invoices APIs — additive Mongo collections only."""
from __future__ import annotations

import base64
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from invoice_engine import (
    DEFAULT_TAX_CODES,
    TAX_DISCLAIMER,
    TEMPLATES,
    apply_overdue,
    can_access_invoice,
    can_edit_invoice,
    can_issue_invoice,
    compute_invoice,
    default_settings,
    demo_pack,
    financial_year,
    format_invoice_number,
    gstin_format_ok,
    next_sequence_preview,
    party_from_user,
    public_bank,
    sanitize_ai_extraction,
    validate_invoice,
)
from invoice_pdf import build_invoice_pdf

logger = logging.getLogger("invoices")

FINALIZED = {"sent", "viewed", "partially_paid", "paid", "overdue"}


class LineItemIn(BaseModel):
    description: str = ""
    sac_hsn: str = ""
    qty: float = 1
    unit: str = "Nos"
    rate: float = 0
    discount_kind: Optional[str] = None
    discount_value: Optional[float] = None


class PartyIn(BaseModel):
    user_id: Optional[str] = None
    legal_name: str = ""
    trade_name: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    state_code: Optional[str] = None
    pincode: str = ""
    gstin: str = ""
    pan: str = ""
    email: str = ""
    phone: str = ""


class InvoiceWrite(BaseModel):
    campaign_id: Optional[str] = None
    recipient_user_id: Optional[str] = None
    supplier: Optional[Dict[str, Any]] = None
    recipient: Optional[Dict[str, Any]] = None
    line_items: List[Dict[str, Any]] = Field(default_factory=list)
    gst_treatment: str = "taxable"
    gst_rate: Optional[float] = None
    place_of_supply_state_code: Optional[str] = None
    discount_kind: str = "amount"
    discount_value: float = 0
    rounding: str = "nearest_rupee"
    tds_applicable: bool = False
    tds_section: str = ""
    tds_rate: Optional[float] = None
    tds_amount: Optional[float] = None
    reverse_charge: bool = False
    export_type: Optional[str] = None
    exemption_reason: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    template: str = "professional"
    irn: Optional[str] = None
    ack_no: Optional[str] = None
    ack_date: Optional[str] = None


class MarkPaidIn(BaseModel):
    amount: Optional[float] = None
    note: str = ""


class SendIn(BaseModel):
    to: Optional[str] = None
    message: Optional[str] = None


class AssistIn(BaseModel):
    message: str = Field(min_length=1, max_length=800)


class TaxCodeIn(BaseModel):
    code: str = Field(min_length=2, max_length=12)
    kind: str = "SAC"
    description: str = ""
    suggested_rate: Optional[float] = None
    active: bool = True


class SettingsIn(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    pincode: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    prefix: Optional[str] = None
    financial_year: Optional[str] = None
    starting_number: Optional[int] = None
    number_width: Optional[int] = None
    default_payment_terms: Optional[str] = None
    currency: Optional[str] = None
    default_gst_rate: Optional[float] = None
    default_gst_treatment: Optional[str] = None
    default_template: Optional[str] = None
    rounding: Optional[str] = None
    default_tds_applicable: Optional[bool] = None
    default_tds_section: Optional[str] = None
    default_tds_rate: Optional[float] = None
    stamp_enabled: Optional[bool] = None
    stamp_size: Optional[int] = None
    signatory_name: Optional[str] = None
    signatory_designation: Optional[str] = None
    terms: Optional[str] = None
    logo_file_id: Optional[str] = None
    signature_file_id: Optional[str] = None
    stamp_file_id: Optional[str] = None
    bank: Optional[Dict[str, Any]] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip(doc: Optional[dict]) -> dict:
    out = dict(doc or {})
    out.pop("_id", None)
    return out


def setup_invoices(
    api_router,
    *,
    db,
    get_current_user: Callable,
    require_role: Callable,
    call_llm: Callable,
    parse_json: Callable,
    send_email: Callable,
    email_template: Callable,
    write_audit_log: Callable,
    store_upload_bytes: Callable,
    load_upload_bytes: Callable,
    logger=logger,
):
    async def ensure_indexes():
        await db.invoices.create_index("id", unique=True)
        await db.invoices.create_index("issuer_id")
        await db.invoices.create_index("recipient_user_id")
        await db.invoices.create_index("campaign_id")
        await db.invoices.create_index("status")
        await db.invoices.create_index([("issuer_id", 1), ("invoice_number", 1)])
        await db.invoice_settings.create_index("user_id", unique=True)
        await db.invoice_sequences.create_index([("issuer_id", 1), ("fy", 1)], unique=True)
        await db.invoice_tax_codes.create_index("code", unique=True)
        existing = await db.invoice_tax_codes.count_documents({})
        if existing == 0:
            now = _now()
            await db.invoice_tax_codes.insert_many([
                {**row, "id": str(uuid.uuid4()), "active": True, "created_at": now, "seeded": True}
                for row in DEFAULT_TAX_CODES
            ])

    async def _audit(current, action, invoice_id, details, meta=None):
        await write_audit_log(
            action=action,
            user_id=current.get("id"),
            username=current.get("username") or current.get("handle"),
            user=current.get("name"),
            details=details,
            meta={"invoice_id": invoice_id, **(meta or {})},
        )

    async def _get_settings(user_id: str) -> dict:
        row = await db.invoice_settings.find_one({"user_id": user_id}, {"_id": 0})
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        base = default_settings(user)
        billing = (user or {}).get("billing") or {}
        merged = {**base, **billing, **(row or {})}
        merged["user_id"] = user_id
        return merged

    async def _seq_reserve(issuer_id: str, settings: dict) -> tuple:
        fy = settings.get("financial_year") or financial_year()
        width = int(settings.get("number_width") or 4)
        prefix = settings.get("prefix") or "flugr"
        start = int(settings.get("starting_number") or 1)
        rec = await db.invoice_sequences.find_one({"issuer_id": issuer_id, "fy": fy})
        last = int((rec or {}).get("last_seq") or (start - 1))
        nxt = last + 1
        number = format_invoice_number(prefix, fy, nxt, width)
        clash = await db.invoices.find_one({
            "issuer_id": issuer_id,
            "invoice_number": number,
            "status": {"$ne": "cancelled"},
        })
        if clash:
            raise HTTPException(status_code=409, detail="Invoice number already used. Update numbering in Billing Settings.")
        await db.invoice_sequences.update_one(
            {"issuer_id": issuer_id, "fy": fy},
            {"$set": {"last_seq": nxt, "updated_at": _now()}, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": _now()}},
            upsert=True,
        )
        return number, nxt

    def _compute_payload(body: dict, settings: dict, supplier: dict, recipient: dict) -> dict:
        rate = body.get("gst_rate")
        if rate in (None, ""):
            rate = settings.get("default_gst_rate")
        return {
            "supplier": supplier,
            "recipient": recipient,
            "line_items": body.get("line_items") or [],
            "gst_treatment": body.get("gst_treatment") or settings.get("default_gst_treatment") or "taxable",
            "gst_rate": rate,
            "place_of_supply_state_code": body.get("place_of_supply_state_code"),
            "discount_kind": body.get("discount_kind") or "amount",
            "discount_value": body.get("discount_value") or 0,
            "rounding": body.get("rounding") or settings.get("rounding") or "nearest_rupee",
            "tds_applicable": body.get("tds_applicable") if body.get("tds_applicable") is not None else settings.get("default_tds_applicable"),
            "tds_section": body.get("tds_section") or settings.get("default_tds_section") or "",
            "tds_rate": body.get("tds_rate") if body.get("tds_rate") is not None else settings.get("default_tds_rate"),
            "tds_amount": body.get("tds_amount"),
            "reverse_charge": bool(body.get("reverse_charge")),
            "export_type": body.get("export_type"),
            "invoice_date": body.get("invoice_date") or _now()[:10],
            "payment_terms": body.get("payment_terms") or settings.get("default_payment_terms"),
        }

    def _apply_computed(doc: dict, computed: dict) -> dict:
        keep = (
            "invoice_kind", "gst_treatment", "gst_rate", "tax_split", "supplier_state_code",
            "place_of_supply", "line_items", "subtotal", "line_discount_total", "invoice_discount",
            "discount_total", "taxable_value", "cgst", "sgst", "utgst", "igst", "total_gst",
            "round_off", "grand_total", "tds_applicable", "tds_section", "tds_rate", "tds_amount",
            "net_payable", "amount_in_words", "reverse_charge",
        )
        for k in keep:
            doc[k] = computed.get(k)
        return doc

    def _public(inv: dict, *, reveal_bank: bool, current: dict) -> dict:
        out = _strip(inv)
        out["status"] = apply_overdue(out.get("status") or "draft", out.get("due_date"))
        issuer = current.get("id") == out.get("issuer_id") or current.get("role") == "admin"
        out["bank"] = public_bank(out.get("bank") or {}, reveal=reveal_bank and issuer)
        out["disclaimer"] = TAX_DISCLAIMER
        out.pop("view_token", None)
        return out

    async def _load(invoice_id: str, current: dict) -> dict:
        inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if not can_access_invoice(current, inv):
            raise HTTPException(status_code=403, detail="Not authorized to view this invoice")
        return inv

    async def _asset_bytes(file_id: Optional[str]) -> Optional[bytes]:
        if not file_id:
            return None
        data, _ct = await load_upload_bytes(file_id)
        return data

    async def _pdf_bytes(inv: dict) -> bytes:
        settings = await _get_settings(inv["issuer_id"])
        logo = await _asset_bytes(settings.get("logo_file_id") or (inv.get("supplier") or {}).get("logo_file_id"))
        sig = await _asset_bytes(settings.get("signature_file_id"))
        stamp = await _asset_bytes(settings.get("stamp_file_id")) if settings.get("stamp_enabled", True) else None
        payload = {
            **inv,
            "template": inv.get("template") or settings.get("default_template") or "professional",
            "signatory_name": settings.get("signatory_name"),
            "signatory_designation": settings.get("signatory_designation"),
            "stamp_enabled": settings.get("stamp_enabled", True),
            "stamp_size": settings.get("stamp_size") or 96,
            "terms": inv.get("terms") or settings.get("terms"),
            "bank": public_bank(inv.get("bank") or settings.get("bank") or {}, reveal=True),
        }
        return build_invoice_pdf(payload, logo=logo, signature=sig, stamp=stamp)

    def _scope_query(current: dict, box: str) -> dict:
        uid = current["id"]
        if current.get("role") == "admin" and box == "all":
            return {}
        if box == "received":
            return {"recipient_user_id": uid}
        if box == "issued":
            return {"issuer_id": uid}
        return {"$or": [{"issuer_id": uid}, {"recipient_user_id": uid}]}

    @api_router.get("/invoices/demo")
    async def invoices_demo(current: dict = Depends(get_current_user)):
        pack = demo_pack()
        return pack

    @api_router.get("/invoices/tax-codes")
    async def list_tax_codes(q: str = "", current: dict = Depends(get_current_user)):
        filt: Dict[str, Any] = {"active": True}
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            filt["$or"] = [{"code": rx}, {"description": rx}]
        rows = await db.invoice_tax_codes.find(filt, {"_id": 0}).sort("code", 1).to_list(80)
        return {"items": rows, "note": "These codes are admin-maintained suggestions, not legal advice. Confirm SAC/HSN with your tax professional."}

    @api_router.post("/invoices/tax-codes")
    async def create_tax_code(body: TaxCodeIn, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        doc = {
            "id": str(uuid.uuid4()),
            "code": body.code.strip(),
            "kind": body.kind,
            "description": body.description,
            "suggested_rate": body.suggested_rate,
            "active": body.active,
            "created_at": _now(),
        }
        try:
            await db.invoice_tax_codes.insert_one(dict(doc))
        except Exception:
            raise HTTPException(status_code=409, detail="Tax code already exists")
        await _audit(current, "invoice_tax_code_created", None, f"SAC/HSN {body.code}")
        return doc

    @api_router.patch("/invoices/tax-codes/{code_id}")
    async def patch_tax_code(code_id: str, body: TaxCodeIn, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        await db.invoice_tax_codes.update_one({"id": code_id}, {"$set": body.model_dump()})
        return {"ok": True}

    @api_router.get("/billing/settings")
    async def get_billing_settings(reveal_bank: bool = False, current: dict = Depends(get_current_user)):
        settings = await _get_settings(current["id"])
        settings["bank"] = public_bank(settings.get("bank") or {}, reveal=reveal_bank)
        settings["disclaimer"] = TAX_DISCLAIMER
        settings["templates"] = list(TEMPLATES)
        fy = settings.get("financial_year") or financial_year()
        rec = await db.invoice_sequences.find_one({"issuer_id": current["id"], "fy": fy})
        last = int((rec or {}).get("last_seq") or (int(settings.get("starting_number") or 1) - 1))
        preview, _ = next_sequence_preview(settings.get("prefix") or "flugr", fy, last, int(settings.get("number_width") or 4))
        settings["next_invoice_number"] = preview
        settings["gstin_format_ok"] = gstin_format_ok(settings.get("gstin")) if settings.get("gstin") else None
        return settings

    @api_router.put("/billing/settings")
    async def put_billing_settings(body: SettingsIn, current: dict = Depends(get_current_user)):
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        bank = data.pop("bank", None)
        billing_keys = {
            "legal_name", "trade_name", "address", "city", "state", "state_code", "pincode",
            "gstin", "pan", "email", "phone", "logo_file_id", "signature_file_id", "stamp_file_id",
        }
        billing_patch = {k: data[k] for k in billing_keys if k in data}
        if bank is not None:
            clean_bank = {
                "bank_name": str(bank.get("bank_name") or "")[:80],
                "account_holder": str(bank.get("account_holder") or "")[:80],
                "account_number": re.sub(r"\s+", "", str(bank.get("account_number") or ""))[:24],
                "ifsc": str(bank.get("ifsc") or "").upper()[:11],
                "branch": str(bank.get("branch") or "")[:80],
                "upi_id": str(bank.get("upi_id") or "")[:80],
                "payment_instructions": str(bank.get("payment_instructions") or "")[:300],
            }
            data["bank"] = clean_bank
        if billing_patch:
            user = await db.users.find_one({"id": current["id"]}, {"billing": 1})
            prev = (user or {}).get("billing") or {}
            await db.users.update_one({"id": current["id"]}, {"$set": {"billing": {**prev, **billing_patch}}})
        data["updated_at"] = _now()
        await db.invoice_settings.update_one(
            {"user_id": current["id"]},
            {"$set": data, "$setOnInsert": {"id": str(uuid.uuid4()), "user_id": current["id"], "created_at": _now()}},
            upsert=True,
        )
        await _audit(current, "invoice_settings_updated", None, "Billing settings updated")
        return await get_billing_settings(reveal_bank=False, current=current)

    @api_router.get("/invoices/summary")
    async def invoice_summary(box: str = "issued", current: dict = Depends(get_current_user)):
        q = _scope_query(current, box)
        rows = await db.invoices.find(q, {"_id": 0, "status": 1, "grand_total": 1, "due_date": 1, "amount_paid": 1}).to_list(2000)
        cards = {k: {"count": 0, "amount": 0.0} for k in ("total", "paid", "pending", "overdue", "draft", "cancelled")}
        for r in rows:
            st = apply_overdue(r.get("status") or "draft", r.get("due_date"))
            amt = float(r.get("grand_total") or 0)
            cards["total"]["count"] += 1
            cards["total"]["amount"] += amt
            if st == "paid":
                cards["paid"]["count"] += 1
                cards["paid"]["amount"] += amt
            elif st == "overdue":
                cards["overdue"]["count"] += 1
                cards["overdue"]["amount"] += amt
            elif st == "draft":
                cards["draft"]["count"] += 1
                cards["draft"]["amount"] += amt
            elif st == "cancelled":
                cards["cancelled"]["count"] += 1
                cards["cancelled"]["amount"] += amt
            else:
                cards["pending"]["count"] += 1
                cards["pending"]["amount"] += amt
        return {"cards": cards, "disclaimer": TAX_DISCLAIMER}

    @api_router.get("/invoices")
    async def list_invoices(
        box: str = "issued",
        status: Optional[str] = None,
        q: str = "",
        page: int = 1,
        limit: int = 20,
        current: dict = Depends(get_current_user),
    ):
        filt = _scope_query(current, box)
        if status:
            filt = {"$and": [filt, {"status": status}]}
        if q:
            rx = {"$regex": re.escape(q), "$options": "i"}
            extra = {"$or": [
                {"invoice_number": rx}, {"draft_number": rx},
                {"supplier.legal_name": rx}, {"recipient.legal_name": rx},
                {"campaign.name": rx},
            ]}
            filt = {"$and": [filt, extra]}
        skip = max(0, (page - 1) * limit)
        total = await db.invoices.count_documents(filt)
        rows = await db.invoices.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        items = []
        for r in rows:
            r["status"] = apply_overdue(r.get("status") or "draft", r.get("due_date"))
            items.append({
                "id": r["id"],
                "invoice_number": r.get("invoice_number") or r.get("draft_number"),
                "client": (r.get("recipient") or {}).get("legal_name") or (r.get("recipient") or {}).get("trade_name"),
                "supplier": (r.get("supplier") or {}).get("trade_name"),
                "campaign": (r.get("campaign") or {}).get("name"),
                "invoice_date": r.get("invoice_date"),
                "due_date": r.get("due_date"),
                "amount": r.get("grand_total"),
                "gst": r.get("total_gst"),
                "status": r["status"],
                "invoice_kind": r.get("invoice_kind"),
                "demo": False,
            })
        return {"items": items, "total": total, "page": page}

    @api_router.get("/invoices/{invoice_id}")
    async def get_invoice(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if current.get("id") == inv.get("recipient_user_id") and inv.get("status") == "sent":
            await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "viewed", "viewed_at": _now()}})
            inv["status"] = "viewed"
            await _audit(current, "invoice_viewed", invoice_id, f"Invoice viewed {inv.get('invoice_number')}")
        return _public(inv, reveal_bank=current.get("id") == inv.get("issuer_id"), current=current)

    @api_router.post("/invoices")
    async def create_invoice(body: InvoiceWrite, current: dict = Depends(get_current_user)):
        if not can_issue_invoice(current):
            raise HTTPException(status_code=403, detail="Not allowed to issue invoices")
        settings = await _get_settings(current["id"])
        supplier = body.supplier or party_from_user(current)
        supplier["user_id"] = current["id"]
        recipient = body.recipient or {}
        if body.recipient_user_id:
            other = await db.users.find_one({"id": body.recipient_user_id}, {"_id": 0, "password_hash": 0})
            if other:
                recipient = {**party_from_user(other), **(body.recipient or {})}
        campaign = None
        if body.campaign_id:
            campaign = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
        payload = _compute_payload(body.model_dump(), settings, supplier, recipient)
        computed = compute_invoice(payload)
        due = body.due_date
        if not due and settings.get("default_payment_terms"):
            m = re.search(r"(\d+)", settings.get("default_payment_terms") or "")
            days = int(m.group(1)) if m else 15
            due = (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()
        doc = {
            "id": str(uuid.uuid4()),
            "draft_number": f"DRAFT-{uuid.uuid4().hex[:8].upper()}",
            "invoice_number": None,
            "status": "draft",
            "issuer_id": current["id"],
            "creator_id": current["id"] if current.get("role") == "influencer" else (campaign or {}).get("accepted_creator_id"),
            "brand_id": body.recipient_user_id or (campaign or {}).get("owner_id"),
            "recipient_user_id": body.recipient_user_id or (campaign or {}).get("owner_id"),
            "campaign_id": body.campaign_id,
            "campaign": {
                "id": (campaign or {}).get("id"),
                "name": (campaign or {}).get("title"),
                "campaign_id": (campaign or {}).get("id"),
                "deadline": (campaign or {}).get("deadline"),
                "deliverables": (campaign or {}).get("deliverables"),
            } if campaign else None,
            "supplier": supplier,
            "recipient": recipient,
            "invoice_date": body.invoice_date or _now()[:10],
            "due_date": due,
            "payment_terms": body.payment_terms or settings.get("default_payment_terms"),
            "notes": body.notes,
            "template": body.template if body.template in TEMPLATES else settings.get("default_template") or "professional",
            "terms": settings.get("terms"),
            "bank": settings.get("bank") or {},
            "amount_paid": 0,
            "irn": body.irn,
            "ack_no": body.ack_no,
            "ack_date": body.ack_date,
            "export_type": body.export_type,
            "exemption_reason": body.exemption_reason,
            "created_at": _now(),
            "updated_at": _now(),
        }
        _apply_computed(doc, computed)
        await db.invoices.insert_one(dict(doc))
        await _audit(current, "invoice_created", doc["id"], "Draft invoice created")
        return _public(doc, reveal_bank=True, current=current)

    @api_router.patch("/invoices/{invoice_id}")
    async def patch_invoice(invoice_id: str, body: InvoiceWrite, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if not can_edit_invoice(current, inv):
            raise HTTPException(status_code=409, detail="Finalized invoices cannot be edited. Cancel and issue a revised invoice.")
        settings = await _get_settings(inv["issuer_id"])
        patch = {k: v for k, v in body.model_dump().items() if v is not None}
        if body.supplier:
            inv["supplier"] = {**(inv.get("supplier") or {}), **body.supplier}
        if body.recipient:
            inv["recipient"] = {**(inv.get("recipient") or {}), **body.recipient}
        for k, v in patch.items():
            if k in {"supplier", "recipient"}:
                continue
            inv[k] = v
        payload = _compute_payload(inv, settings, inv.get("supplier") or {}, inv.get("recipient") or {})
        computed = compute_invoice(payload)
        _apply_computed(inv, computed)
        inv["updated_at"] = _now()
        await db.invoices.replace_one({"id": invoice_id}, inv)
        await _audit(current, "invoice_edited", invoice_id, "Draft invoice edited")
        return _public(inv, reveal_bank=True, current=current)

    @api_router.post("/invoices/{invoice_id}/duplicate")
    async def duplicate_invoice(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if current.get("id") != inv.get("issuer_id") and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only the issuer can duplicate this invoice")
        new = dict(inv)
        new["id"] = str(uuid.uuid4())
        new["draft_number"] = f"DRAFT-{uuid.uuid4().hex[:8].upper()}"
        new["invoice_number"] = None
        new["status"] = "draft"
        new["amount_paid"] = 0
        new["created_at"] = _now()
        new["updated_at"] = _now()
        new.pop("finalized_at", None)
        new.pop("sent_at", None)
        new.pop("pdf_file_id", None)
        await db.invoices.insert_one(dict(new))
        await _audit(current, "invoice_created", new["id"], f"Duplicated from {invoice_id}")
        return _public(new, reveal_bank=True, current=current)

    @api_router.post("/invoices/{invoice_id}/validate")
    async def validate_one(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        payload = _compute_payload(inv, await _get_settings(inv["issuer_id"]), inv.get("supplier") or {}, inv.get("recipient") or {})
        payload["invoice_number"] = inv.get("invoice_number")
        payload["invoice_date"] = inv.get("invoice_date")
        payload["payment_terms"] = inv.get("payment_terms")
        return validate_invoice(payload)

    @api_router.post("/invoices/{invoice_id}/finalize")
    async def finalize_invoice(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if not can_edit_invoice(current, inv):
            raise HTTPException(status_code=409, detail="Invoice is not a draft")
        settings = await _get_settings(inv["issuer_id"])
        payload = _compute_payload(inv, settings, inv.get("supplier") or {}, inv.get("recipient") or {})
        payload["invoice_date"] = inv.get("invoice_date")
        payload["payment_terms"] = inv.get("payment_terms")
        result = validate_invoice(payload)
        if not result["ok"]:
            raise HTTPException(status_code=422, detail={"message": "Cannot finalize until errors are resolved.", "errors": result["errors"], "warnings": result["warnings"]})
        number, seq = await _seq_reserve(inv["issuer_id"], settings)
        computed = result["computed"]
        _apply_computed(inv, computed)
        inv["invoice_number"] = number
        inv["sequence"] = seq
        inv["status"] = "sent"
        inv["finalized_at"] = _now()
        inv["updated_at"] = _now()
        await db.invoices.replace_one({"id": invoice_id}, inv)
        await _audit(current, "invoice_finalized", invoice_id, f"Finalized {number}")
        return _public(inv, reveal_bank=True, current=current)

    @api_router.post("/invoices/{invoice_id}/send")
    async def send_invoice(invoice_id: str, body: SendIn, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if current.get("id") != inv.get("issuer_id") and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only the issuer can send this invoice")
        if inv.get("status") == "draft":
            raise HTTPException(status_code=409, detail="Finalize the invoice before sending")
        to = body.to or (inv.get("recipient") or {}).get("email")
        if not to:
            raise HTTPException(status_code=400, detail="Recipient email is missing")
        pdf = await _pdf_bytes(inv)
        fid = f"inv_{invoice_id}_{uuid.uuid4().hex[:8]}.pdf"
        await store_upload_bytes(fid, pdf, "application/pdf")
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"pdf_file_id": fid, "sent_at": _now(), "status": inv.get("status") if inv.get("status") != "draft" else "sent"}})
        html = email_template(
            f"Invoice {inv.get('invoice_number')}",
            f"<p>Please find invoice <strong>{inv.get('invoice_number')}</strong> for "
            f"{(inv.get('campaign') or {}).get('name') or 'your campaign'}.</p>"
            f"<p>Amount: ₹{inv.get('grand_total')} &nbsp; Due: {str(inv.get('due_date') or '—')[:10]}</p>"
            f"<p>{body.message or ''}</p>"
            f"<p style='font-size:12px;opacity:.7'>{TAX_DISCLAIMER}</p>",
        )
        attached = False
        brevo = (os.environ.get("BREVO_API_KEY") or "").strip()
        if brevo:
            try:
                import httpx
                sender_email = os.environ.get("BREVO_SENDER_EMAIL") or os.environ.get("EMAIL_FROM", "noreply@cr8.studio")
                async with httpx.AsyncClient(timeout=20) as client:
                    res = await client.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={"api-key": brevo, "Content-Type": "application/json", "Accept": "application/json"},
                        json={
                            "sender": {"name": "flugr", "email": sender_email},
                            "to": [{"email": to}],
                            "subject": f"Invoice {inv.get('invoice_number')} — flugr",
                            "htmlContent": html,
                            "attachment": [{
                                "name": f"{inv.get('invoice_number') or 'invoice'}.pdf",
                                "content": base64.b64encode(pdf).decode("ascii"),
                            }],
                        },
                    )
                    attached = res.status_code in (200, 201)
            except Exception as e:
                logger.warning("invoice email attachment failed: %s", e)
        if not attached:
            await send_email(to, f"Invoice {inv.get('invoice_number')} — flugr", html)
        await _audit(current, "invoice_sent", invoice_id, f"Sent {inv.get('invoice_number')} to {to}")
        return {"ok": True, "to": to, "pdf_attached": attached}

    @api_router.post("/invoices/{invoice_id}/mark-paid")
    async def mark_paid(invoice_id: str, body: MarkPaidIn, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if current.get("id") not in {inv.get("issuer_id"), inv.get("recipient_user_id")} and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not allowed to update payment status")
        if inv.get("status") in {"draft", "cancelled"}:
            raise HTTPException(status_code=409, detail="Cannot mark a draft or cancelled invoice as paid")
        grand = float(inv.get("grand_total") or 0)
        paid = float(body.amount if body.amount is not None else grand)
        already = float(inv.get("amount_paid") or 0) + paid
        status = "paid" if already >= grand - 0.009 else "partially_paid"
        await db.invoices.update_one({"id": invoice_id}, {"$set": {
            "amount_paid": already, "status": status, "paid_at": _now() if status == "paid" else None, "updated_at": _now(),
        }})
        await _audit(current, "invoice_payment_marked", invoice_id, f"{status} {already}")
        inv.update({"amount_paid": already, "status": status})
        return _public(inv, reveal_bank=False, current=current)

    @api_router.post("/invoices/{invoice_id}/cancel")
    async def cancel_invoice(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if current.get("id") != inv.get("issuer_id") and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only the issuer can cancel")
        if inv.get("status") == "cancelled":
            return _public(inv, reveal_bank=False, current=current)
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "cancelled", "cancelled_at": _now(), "updated_at": _now()}})
        await _audit(current, "invoice_cancelled", invoice_id, f"Cancelled {inv.get('invoice_number') or inv.get('draft_number')}")
        inv["status"] = "cancelled"
        return _public(inv, reveal_bank=False, current=current)

    @api_router.post("/invoices/{invoice_id}/revise")
    async def revise_invoice(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if inv.get("status") == "draft":
            raise HTTPException(status_code=409, detail="Drafts can be edited directly")
        await cancel_invoice(invoice_id, current)
        return await duplicate_invoice(invoice_id, current)

    @api_router.delete("/invoices/{invoice_id}")
    async def delete_draft(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if inv.get("status") != "draft":
            raise HTTPException(status_code=409, detail="Only drafts can be deleted. Cancel a finalized invoice instead.")
        if current.get("id") != inv.get("issuer_id") and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not allowed")
        await db.invoices.delete_one({"id": invoice_id})
        await _audit(current, "invoice_deleted", invoice_id, "Draft deleted")
        return {"ok": True}

    @api_router.get("/invoices/{invoice_id}/pdf")
    async def invoice_pdf(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        pdf = await _pdf_bytes(inv)
        await _audit(current, "invoice_downloaded", invoice_id, f"PDF {inv.get('invoice_number') or inv.get('draft_number')}")
        name = f"{inv.get('invoice_number') or inv.get('draft_number') or 'invoice'}.pdf"
        return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})

    @api_router.post("/invoices/from-campaign/{campaign_id}")
    async def from_campaign(campaign_id: str, current: dict = Depends(get_current_user)):
        camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
        if not camp:
            raise HTTPException(status_code=404, detail="Campaign not found")
        creator_id = camp.get("accepted_creator_id")
        if current.get("role") != "admin" and current.get("id") != creator_id:
            raise HTTPException(status_code=403, detail="Only the accepted creator can generate a campaign invoice")
        owner = await db.users.find_one({"id": camp.get("owner_id")}, {"_id": 0, "password_hash": 0})
        creator = current if current.get("id") == creator_id else await db.users.find_one({"id": creator_id}, {"_id": 0, "password_hash": 0})
        delivs = await db.deliverables.find({"campaign_id": campaign_id}, {"_id": 0}).to_list(50)
        apps = await db.applications.find({"campaign_id": campaign_id, "influencer_id": creator_id, "status": "accepted"}, {"_id": 0}).to_list(1)
        amount = (apps[0].get("rate") if apps else None) or camp.get("budget") or 0
        items = []
        if delivs:
            each = round(float(amount) / max(len(delivs), 1), 2)
            for d in delivs:
                items.append({
                    "description": f"{(d.get('kind') or 'deliverable').title()}: {(d.get('caption') or d.get('url') or '')[:80]}",
                    "sac_hsn": "",
                    "qty": 1,
                    "rate": each,
                })
        else:
            text = camp.get("deliverables") or "Campaign services"
            items.append({"description": str(text)[:200], "sac_hsn": "", "qty": 1, "rate": float(amount)})
        body = InvoiceWrite(
            campaign_id=campaign_id,
            recipient_user_id=camp.get("owner_id"),
            supplier=party_from_user(creator),
            recipient=party_from_user(owner),
            line_items=items,
            notes=f"Generated from campaign {camp.get('title')}. Confirm GST treatment before issuing.",
        )
        return await create_invoice(body, current)

    @api_router.post("/invoices/ai-draft")
    async def ai_draft(body: AssistIn, campaign_id: Optional[str] = None, current: dict = Depends(get_current_user)):
        if not can_issue_invoice(current):
            raise HTTPException(status_code=403, detail="Not allowed")
        context = {"user_name": current.get("name"), "role": current.get("role")}
        camp = None
        if campaign_id:
            camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
            context["campaign"] = {"title": camp.get("title"), "budget": camp.get("budget"), "deliverables": camp.get("deliverables"), "status": camp.get("status")} if camp else None
        text = await call_llm(
            "You extract invoice line items from a user's request. Return JSON only with keys: "
            "line_items (array of {description, qty, rate}), payment_terms, notes. "
            "NEVER invent GSTIN, PAN, GST rate, SAC/HSN, bank details, legal names, or state codes. "
            "If a rate/qty is not in the user text or campaign budget, omit it.",
            f"User: {body.message}\nContext: {context}",
        )
        parsed = parse_json(text or "")
        cleaned = sanitize_ai_extraction(parsed if isinstance(parsed, dict) else {})
        missing = []
        if not cleaned.get("line_items"):
            missing.append("line items / amounts")
        draft_body = InvoiceWrite(
            campaign_id=campaign_id,
            recipient_user_id=(camp or {}).get("owner_id") if camp else None,
            line_items=cleaned.get("line_items") or [],
            payment_terms=cleaned.get("payment_terms"),
            notes=cleaned.get("notes") or "AI-prepared draft. Verify GSTIN, SAC/HSN and tax treatment before issuing.",
        )
        if not draft_body.line_items and camp:
            return await from_campaign(campaign_id, current)
        created = await create_invoice(draft_body, current)
        return {
            "invoice": created,
            "missing": missing,
            "ai_note": "Draft only. AI did not set GSTIN, PAN, SAC/HSN, GST rate, or bank details.",
            "disclaimer": TAX_DISCLAIMER,
        }

    @api_router.post("/invoices/{invoice_id}/ai-review")
    async def ai_review(invoice_id: str, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        settings = await _get_settings(inv["issuer_id"])
        payload = _compute_payload(inv, settings, inv.get("supplier") or {}, inv.get("recipient") or {})
        payload["invoice_number"] = inv.get("invoice_number")
        payload["invoice_date"] = inv.get("invoice_date")
        payload["payment_terms"] = inv.get("payment_terms")
        result = validate_invoice(payload)
        engine = result["computed"]
        mismatch = []
        for k in ("taxable_value", "cgst", "sgst", "igst", "grand_total"):
            stored = float(inv.get(k) or 0)
            fresh = float(engine.get(k) or 0)
            if abs(stored - fresh) > 0.02:
                mismatch.append(f"{k} stored {stored} vs engine {fresh}")
                result["errors"].append(f"Calculation mismatch on {k}. Engine is the source of truth.")
        if mismatch:
            result["ok"] = False
            result["health"] = max(0, result["health"] - 20)
        note = None
        try:
            note = await call_llm(
                "You review an invoice health report. Do not recalculate tax. Do not invent GSTIN or rates. "
                "Return a short JSON {summary, extra_warnings: string[]}.",
                f"Health {result['health']}. Errors: {result['errors']}. Warnings: {result['warnings']}.",
            )
            parsed = parse_json(note or "")
            if isinstance(parsed, dict):
                extra = parsed.get("extra_warnings") or []
                for w in extra[:5]:
                    if isinstance(w, str) and w not in result["warnings"]:
                        result["warnings"].append(w)
                result["summary"] = parsed.get("summary")
        except Exception:
            result["summary"] = None
        result["summary"] = result.get("summary") or (
            f"Invoice health {result['health']}/100. "
            + ("Ready to finalize after you confirm tax treatment." if result["ok"] else "Resolve errors before issuing.")
        )
        result["disclaimer"] = TAX_DISCLAIMER
        return result

    @api_router.post("/invoices/{invoice_id}/ai-assist")
    async def ai_assist(invoice_id: str, body: AssistIn, current: dict = Depends(get_current_user)):
        inv = await _load(invoice_id, current)
        if not can_edit_invoice(current, inv):
            raise HTTPException(status_code=409, detail="AI can only change draft invoices you own")
        cleaned = sanitize_ai_extraction(parse_json(await call_llm(
            "Return JSON of invoice field updates the user asked for. Allowed keys: line_items, payment_terms, notes, discount_value, discount_kind, template. "
            "Never output GSTIN, PAN, gst_rate, sac_hsn, bank fields, or tax amounts.",
            f"User: {body.message}\nCurrent items: {inv.get('line_items')}",
        ) or "{}"))
        if cleaned.get("line_items"):
            inv["line_items"] = cleaned["line_items"]
        for k in ("payment_terms", "notes", "discount_value", "discount_kind", "template"):
            if cleaned.get(k) is not None:
                inv[k] = cleaned[k]
        settings = await _get_settings(inv["issuer_id"])
        computed = compute_invoice(_compute_payload(inv, settings, inv.get("supplier") or {}, inv.get("recipient") or {}))
        _apply_computed(inv, computed)
        inv["updated_at"] = _now()
        await db.invoices.replace_one({"id": invoice_id}, inv)
        return {
            "invoice": _public(inv, reveal_bank=True, current=current),
            "reply": "Updated the draft from your request. Tax totals were recalculated by the invoice engine — please review GSTIN and SAC/HSN before issuing.",
            "disclaimer": TAX_DISCLAIMER,
        }

    @api_router.get("/admin/invoices")
    async def admin_invoices(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        rows = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
        return {"items": rows, "count": len(rows)}

    return ensure_indexes
