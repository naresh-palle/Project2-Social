"""Deterministic Indian GST invoice engine for flugr.

Source of truth for taxable value, CGST/SGST/UTGST/IGST, TDS (configurable),
rounding, invoice numbers, GSTIN/PAN format checks, and amount-in-words.

This is not tax advice. Place of supply, SAC/HSN, GST rate, and TDS section
must be confirmed by the issuer with a tax professional. AI must never invent
GSTIN, PAN, rates, SAC/HSN, or bank details.

GST tax-invoice particulars follow CGST Rules, 2017, Rule 46 (CBIC):
https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Any, Dict, Iterable, List, Optional, Tuple

getcontext().prec = 28
TWOPLACES = Decimal("0.01")
ZERO = Decimal("0.00")

TAX_DISCLAIMER = (
    "GST, TDS, SAC/HSN, place-of-supply and other tax treatments depend on the "
    "specific transaction and applicable Indian law. Verify the applicable "
    "treatment with your tax professional before issuing a final tax invoice. "
    "flugr AI is not a substitute for a CA or tax professional."
)

# Official GST state / UT codes (GSTIN first two digits).
GST_STATES: Dict[str, Dict[str, str]] = {
    "01": {"name": "Jammu and Kashmir", "kind": "state"},
    "02": {"name": "Himachal Pradesh", "kind": "state"},
    "03": {"name": "Punjab", "kind": "state"},
    "04": {"name": "Chandigarh", "kind": "ut"},
    "05": {"name": "Uttarakhand", "kind": "state"},
    "06": {"name": "Haryana", "kind": "state"},
    "07": {"name": "Delhi", "kind": "state"},
    "08": {"name": "Rajasthan", "kind": "state"},
    "09": {"name": "Uttar Pradesh", "kind": "state"},
    "10": {"name": "Bihar", "kind": "state"},
    "11": {"name": "Sikkim", "kind": "state"},
    "12": {"name": "Arunachal Pradesh", "kind": "state"},
    "13": {"name": "Nagaland", "kind": "state"},
    "14": {"name": "Manipur", "kind": "state"},
    "15": {"name": "Mizoram", "kind": "state"},
    "16": {"name": "Tripura", "kind": "state"},
    "17": {"name": "Meghalaya", "kind": "state"},
    "18": {"name": "Assam", "kind": "state"},
    "19": {"name": "West Bengal", "kind": "state"},
    "20": {"name": "Jharkhand", "kind": "state"},
    "21": {"name": "Odisha", "kind": "state"},
    "22": {"name": "Chhattisgarh", "kind": "state"},
    "23": {"name": "Madhya Pradesh", "kind": "state"},
    "24": {"name": "Gujarat", "kind": "state"},
    "26": {"name": "Dadra and Nagar Haveli and Daman and Diu", "kind": "ut"},
    "27": {"name": "Maharashtra", "kind": "state"},
    "29": {"name": "Karnataka", "kind": "state"},
    "30": {"name": "Goa", "kind": "state"},
    "31": {"name": "Lakshadweep", "kind": "ut"},
    "32": {"name": "Kerala", "kind": "state"},
    "33": {"name": "Tamil Nadu", "kind": "state"},
    "34": {"name": "Puducherry", "kind": "state"},
    "35": {"name": "Andaman and Nicobar Islands", "kind": "ut"},
    "36": {"name": "Telangana", "kind": "state"},
    "37": {"name": "Andhra Pradesh", "kind": "state"},
    "38": {"name": "Ladakh", "kind": "ut"},
    "97": {"name": "Other Territory", "kind": "ut"},
    "99": {"name": "Centre Jurisdiction", "kind": "centre"},
}

STATE_NAME_TO_CODE = {v["name"].lower(): k for k, v in GST_STATES.items()}
STATE_NAME_TO_CODE.update({
    "karnataka": "29",
    "bengaluru": "29",
    "bangalore": "29",
    "maharashtra": "27",
    "mumbai": "27",
    "delhi": "07",
    "new delhi": "07",
    "nct of delhi": "07",
    "tamil nadu": "33",
    "telangana": "36",
    "andhra pradesh": "37",
    "uttar pradesh": "09",
    "west bengal": "19",
    "gujarat": "24",
    "rajasthan": "08",
    "kerala": "32",
    "punjab": "03",
    "haryana": "06",
    "madhya pradesh": "23",
    "bihar": "10",
    "odisha": "21",
    "orissa": "21",
    "assam": "18",
    "jharkhand": "20",
    "chhattisgarh": "22",
    "uttarakhand": "05",
    "himachal pradesh": "02",
    "goa": "30",
    "jammu and kashmir": "01",
    "jammu & kashmir": "01",
    "ladakh": "38",
    "puducherry": "34",
    "pondicherry": "34",
    "chandigarh": "04",
})

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

INVOICE_STATUSES = (
    "draft",
    "sent",
    "viewed",
    "partially_paid",
    "paid",
    "overdue",
    "cancelled",
)
FINALIZED_STATUSES = {"sent", "viewed", "partially_paid", "paid", "overdue"}
EDITABLE_STATUSES = {"draft"}

GST_TREATMENTS = ("taxable", "zero_rated", "exempt", "nil", "non_gst")
TEMPLATES = ("professional", "modern", "minimal")

# Seeded suggestions only — not a legal classification of influencer services.
DEFAULT_TAX_CODES = [
    {"code": "9983", "kind": "SAC", "description": "Other professional, technical and business services (group)", "suggested_rate": None},
    {"code": "998361", "kind": "SAC", "description": "Advertising services", "suggested_rate": None},
    {"code": "998365", "kind": "SAC", "description": "Sale of advertising space in print media", "suggested_rate": None},
    {"code": "998366", "kind": "SAC", "description": "Sale of advertising time or space on radio / television", "suggested_rate": None},
    {"code": "998399", "kind": "SAC", "description": "Other advertising services n.e.c.", "suggested_rate": None},
    {"code": "998314", "kind": "SAC", "description": "Original compilations of facts/information", "suggested_rate": None},
    {"code": "999799", "kind": "SAC", "description": "Other services n.e.c.", "suggested_rate": None},
]

DEFAULT_TAX_RATES = [Decimal("0"), Decimal("5"), Decimal("12"), Decimal("18"), Decimal("28"), Decimal("40")]

TDS_SECTIONS = ("194C", "194J", "194H", "194O", "194Q", "other")


def money(value: Any) -> Decimal:
    if value is None or value == "":
        return ZERO
    if isinstance(value, Decimal):
        return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def money_float(value: Decimal) -> float:
    return float(money(value))


def pct(value: Any) -> Decimal:
    if value is None or value == "":
        return ZERO
    return Decimal(str(value))


def financial_year(d: Optional[date] = None) -> str:
    d = d or datetime.now(timezone.utc).date()
    if d.month >= 4:
        return f"{d.year}-{str(d.year + 1)[2:]}"
    return f"{d.year - 1}-{str(d.year)[2:]}"


def gstin_checksum_char(body14: str) -> str:
    factor = 1
    total = 0
    for ch in body14.upper():
        idx = GSTIN_ALPHABET.index(ch)
        prod = idx * factor
        total += (prod // 36) + (prod % 36)
        factor = 2 if factor == 1 else 1
    return GSTIN_ALPHABET[(36 - (total % 36)) % 36]


def normalize_gstin(raw: Optional[str]) -> str:
    return re.sub(r"[\s-]", "", (raw or "")).upper()


def gstin_format_ok(raw: Optional[str]) -> bool:
    g = normalize_gstin(raw)
    if not GSTIN_RE.match(g):
        return False
    return gstin_checksum_char(g[:14]) == g[14]


def pan_format_ok(raw: Optional[str]) -> bool:
    return bool(PAN_RE.match((raw or "").strip().upper()))


def state_code_from_name(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    key = re.sub(r"\s+", " ", name.strip().lower())
    if key in STATE_NAME_TO_CODE:
        return STATE_NAME_TO_CODE[key]
    for alias, code in STATE_NAME_TO_CODE.items():
        if alias in key or key in alias:
            return code
    return None


def state_from_code(code: Optional[str]) -> Optional[Dict[str, str]]:
    if not code:
        return None
    return GST_STATES.get(str(code).zfill(2))


def party_state_code(party: Dict[str, Any]) -> Optional[str]:
    """Prefer GSTIN prefix (registered place), then explicit state_code, then state name.

    Never uses a free-form city/location as the sole GST determinant.
    """
    gstin = normalize_gstin(party.get("gstin"))
    if len(gstin) >= 2 and gstin[:2].isdigit():
        code = gstin[:2]
        if code in GST_STATES:
            return code
    code = party.get("state_code")
    if code and str(code).zfill(2) in GST_STATES:
        return str(code).zfill(2)
    return state_code_from_name(party.get("state"))


def resolve_place_of_supply(supplier: Dict[str, Any], recipient: Dict[str, Any], explicit: Optional[str] = None) -> Dict[str, Any]:
    """B2B services default: location of recipient (CGST Act s.12(2) typical case).

    Explicit place_of_supply_state_code always wins. We do not infer from campaign city.
    """
    if explicit and str(explicit).zfill(2) in GST_STATES:
        code = str(explicit).zfill(2)
        source = "explicit"
    else:
        code = party_state_code(recipient)
        source = "recipient_gstin_or_state"
        if not code:
            code = party_state_code(supplier)
            source = "supplier_fallback_incomplete"
    info = state_from_code(code) or {"name": "Unknown", "kind": "state"}
    return {
        "state_code": code,
        "state_name": info["name"],
        "source": source,
        "complete": bool(code),
    }


def tax_split(supplier_code: Optional[str], pos_code: Optional[str], treatment: str) -> str:
    if treatment in {"non_gst", "exempt", "nil", "zero_rated"}:
        return "none" if treatment != "zero_rated" else "igst_zero"
    if not supplier_code or not pos_code:
        return "unknown"
    if supplier_code == pos_code:
        kind = (state_from_code(pos_code) or {}).get("kind")
        if kind == "ut":
            return "cgst_utgst"
        return "cgst_sgst"
    return "igst"


def _line_gross(item: Dict[str, Any]) -> Decimal:
    qty = Decimal(str(item.get("qty") if item.get("qty") not in (None, "") else 1))
    rate = money(item.get("rate") or 0)
    return money(qty * rate)


def _line_discount(item: Dict[str, Any], gross: Decimal) -> Decimal:
    kind = (item.get("discount_kind") or "").lower()
    if kind == "percent":
        return money(gross * pct(item.get("discount_value") or 0) / Decimal("100"))
    if kind in {"amount", "fixed"}:
        return min(money(item.get("discount_value") or 0), gross)
    # Legacy: discount_amount / discount_percent
    if item.get("discount_percent") not in (None, ""):
        return money(gross * pct(item["discount_percent"]) / Decimal("100"))
    if item.get("discount_amount") not in (None, ""):
        return min(money(item["discount_amount"]), gross)
    return ZERO


def allocate_invoice_discount(line_taxables: List[Decimal], invoice_discount: Decimal) -> List[Decimal]:
    total = sum(line_taxables, ZERO)
    if invoice_discount <= ZERO or total <= ZERO:
        return [ZERO] * len(line_taxables)
    disc = min(invoice_discount, total)
    allocated = []
    remaining = disc
    for i, t in enumerate(line_taxables):
        if i == len(line_taxables) - 1:
            allocated.append(money(remaining))
        else:
            share = money(disc * t / total)
            allocated.append(share)
            remaining -= share
    return allocated


def compute_invoice(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic GST computation. AI must not replace this output."""
    treatment = (payload.get("gst_treatment") or "taxable").lower()
    if treatment not in GST_TREATMENTS:
        treatment = "taxable"
    invoice_kind = "non_gst" if treatment == "non_gst" else "gst"
    supplier = payload.get("supplier") or {}
    recipient = payload.get("recipient") or {}
    pos = resolve_place_of_supply(supplier, recipient, payload.get("place_of_supply_state_code"))
    supplier_code = party_state_code(supplier)
    split = tax_split(supplier_code, pos.get("state_code"), treatment)

    gst_rate = pct(payload.get("gst_rate") if payload.get("gst_rate") not in (None, "") else 0)
    if treatment in {"exempt", "nil", "non_gst", "zero_rated"}:
        gst_rate = ZERO

    items_in = list(payload.get("line_items") or [])
    if not items_in:
        items_in = [{
            "description": payload.get("description") or "Campaign services",
            "qty": 1,
            "rate": payload.get("taxable_value") or payload.get("amount") or 0,
            "sac_hsn": payload.get("sac_hsn") or "",
        }]

    lines = []
    line_taxables: List[Decimal] = []
    subtotal = ZERO
    line_discounts = ZERO
    for raw in items_in:
        gross = _line_gross(raw)
        ldisc = _line_discount(raw, gross)
        taxable = money(gross - ldisc)
        lines.append({
            "description": (raw.get("description") or "").strip() or "Service",
            "sac_hsn": (raw.get("sac_hsn") or raw.get("hsn") or raw.get("sac") or "").strip(),
            "qty": float(Decimal(str(raw.get("qty") if raw.get("qty") not in (None, "") else 1))),
            "unit": raw.get("unit") or "Nos",
            "rate": money_float(money(raw.get("rate") or 0)),
            "gross": money_float(gross),
            "discount": money_float(ldisc),
            "taxable_before_invoice_discount": money_float(taxable),
            "gst_rate": float(gst_rate),
        })
        line_taxables.append(taxable)
        subtotal += gross
        line_discounts += ldisc

    inv_disc_kind = (payload.get("discount_kind") or "amount").lower()
    if inv_disc_kind == "percent":
        base_after_line = money(subtotal - line_discounts)
        invoice_discount = money(base_after_line * pct(payload.get("discount_value") or 0) / Decimal("100"))
    else:
        invoice_discount = money(payload.get("discount_value") or payload.get("discount_amount") or 0)

    allocated = allocate_invoice_discount(line_taxables, invoice_discount)
    taxable_value = ZERO
    for i, line in enumerate(lines):
        extra = allocated[i]
        t = money(Decimal(str(line["taxable_before_invoice_discount"])) - extra)
        line["invoice_discount_share"] = money_float(extra)
        line["taxable_amount"] = money_float(t)
        taxable_value += t

    cgst = sgst = utgst = igst = ZERO
    total_gst = money(taxable_value * gst_rate / Decimal("100")) if gst_rate else ZERO
    if split == "igst":
        igst = total_gst
    elif split in {"cgst_sgst", "cgst_utgst"}:
        cgst = money(total_gst / 2)
        other = money(total_gst - cgst)
        if split == "cgst_utgst":
            utgst = other
        else:
            sgst = other
    elif split == "igst_zero":
        igst = ZERO
        total_gst = ZERO
    pre_round = money(taxable_value + total_gst)

    rounding_mode = (payload.get("rounding") or "nearest_rupee").lower()
    if rounding_mode == "none":
        grand = pre_round
        round_off = ZERO
    else:
        grand = pre_round.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        round_off = money(grand - pre_round)

    tds_applicable = bool(payload.get("tds_applicable"))
    tds_rate = pct(payload.get("tds_rate") or 0) if tds_applicable else ZERO
    tds_section = (payload.get("tds_section") or "").strip() if tds_applicable else ""
    tds_base = taxable_value  # GST typically not part of TDS base; configurable override
    if payload.get("tds_base") == "invoice_total":
        tds_base = pre_round
    tds_amount = money(tds_base * tds_rate / Decimal("100")) if tds_applicable else money(payload.get("tds_amount") or 0)
    if tds_applicable and payload.get("tds_amount") not in (None, "") and payload.get("tds_rate") in (None, "", 0, "0"):
        tds_amount = money(payload.get("tds_amount"))
    net_payable = money(grand - tds_amount)

    for line in lines:
        t = Decimal(str(line["taxable_amount"]))
        line_gst = money(t * gst_rate / Decimal("100")) if gst_rate else ZERO
        if split == "igst":
            line["cgst"] = 0.0
            line["sgst"] = 0.0
            line["utgst"] = 0.0
            line["igst"] = money_float(line_gst)
        elif split in {"cgst_sgst", "cgst_utgst"}:
            half_amt = money(line_gst / 2)
            other = money(line_gst - half_amt)
            line["cgst"] = money_float(half_amt)
            line["sgst"] = money_float(other) if split == "cgst_sgst" else 0.0
            line["utgst"] = money_float(other) if split == "cgst_utgst" else 0.0
            line["igst"] = 0.0
        else:
            line["cgst"] = line["sgst"] = line["utgst"] = line["igst"] = 0.0

    return {
        "invoice_kind": invoice_kind,
        "gst_treatment": treatment,
        "gst_rate": float(gst_rate),
        "tax_split": split,
        "supplier_state_code": supplier_code,
        "place_of_supply": pos,
        "line_items": lines,
        "subtotal": money_float(subtotal),
        "line_discount_total": money_float(line_discounts),
        "invoice_discount": money_float(invoice_discount),
        "discount_total": money_float(line_discounts + invoice_discount),
        "taxable_value": money_float(taxable_value),
        "cgst": money_float(cgst),
        "sgst": money_float(sgst),
        "utgst": money_float(utgst),
        "igst": money_float(igst),
        "total_gst": money_float(total_gst),
        "round_off": money_float(round_off),
        "grand_total": money_float(grand),
        "tds_applicable": tds_applicable,
        "tds_section": tds_section,
        "tds_rate": float(tds_rate),
        "tds_amount": money_float(tds_amount),
        "net_payable": money_float(net_payable),
        "amount_in_words": amount_in_words(grand),
        "reverse_charge": bool(payload.get("reverse_charge")),
        "disclaimer": TAX_DISCLAIMER,
    }


ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two_digits(n: int) -> str:
    if n < 20:
        return ONES[n]
    return (TENS[n // 10] + (" " + ONES[n % 10] if n % 10 else "")).strip()


def _three_digits(n: int) -> str:
    h, rest = divmod(n, 100)
    parts = []
    if h:
        parts.append(ONES[h] + " Hundred")
    if rest:
        parts.append(_two_digits(rest))
    return " ".join(parts)


def amount_in_words(value: Any) -> str:
    amt = money(value)
    if amt < ZERO:
        return "Minus " + amount_in_words(-amt)
    rupees = int(amt)
    paise = int((amt - Decimal(rupees)) * 100)
    if rupees == 0 and paise == 0:
        return "Indian Rupees Zero Only"
    crore, rem = divmod(rupees, 10_000_000)
    lakh, rem = divmod(rem, 100_000)
    thousand, rem = divmod(rem, 1000)
    hundred = rem
    parts = []
    if crore:
        parts.append(_three_digits(crore) + " Crore")
    if lakh:
        parts.append(_two_digits(lakh) + " Lakh")
    if thousand:
        parts.append(_two_digits(thousand) + " Thousand")
    if hundred:
        parts.append(_three_digits(hundred))
    words = "Indian Rupees " + " ".join(p for p in parts if p)
    if paise:
        words += " and " + _two_digits(paise) + " Paise"
    return words + " Only"


def format_invoice_number(prefix: str, fy: str, seq: int, width: int = 4) -> str:
    pref = re.sub(r"[^A-Za-z0-9]", "", prefix or "FLU")[:6] or "flugr"
    num = str(int(seq)).zfill(max(1, min(width, 8)))
    serial = f"{pref}/{fy}/{num}"
    if len(serial) <= 16:
        return serial
    # Rule 46(b): consecutive serial, max 16 characters.
    compact_fy = fy.replace("-", "")[-4:]
    serial = f"{pref}{compact_fy}{num}"
    return serial[:16]


def next_sequence_preview(prefix: str, fy: str, last_seq: int, width: int = 4) -> Tuple[str, int]:
    nxt = int(last_seq or 0) + 1
    return format_invoice_number(prefix, fy, nxt, width), nxt


def validate_invoice(payload: Dict[str, Any], computed: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Blocking errors vs warnings. Finalization requires errors == []."""
    errors: List[str] = []
    warnings: List[str] = []
    computed = computed or compute_invoice(payload)
    treatment = computed.get("gst_treatment")
    supplier = payload.get("supplier") or {}
    recipient = payload.get("recipient") or {}
    is_gst = treatment != "non_gst"

    if not (supplier.get("legal_name") or supplier.get("name")):
        errors.append("Supplier legal name is required.")
    if not (supplier.get("address") or "").strip():
        (errors if is_gst else warnings).append("Supplier address is missing.")
    if is_gst:
        gstin = supplier.get("gstin")
        if not gstin:
            errors.append("Supplier GSTIN is required for a GST tax invoice.")
        elif not gstin_format_ok(gstin):
            errors.append("Supplier GSTIN appears invalid. Please verify before issuing the invoice.")
        if supplier.get("pan") and not pan_format_ok(supplier.get("pan")):
            warnings.append("Supplier PAN format looks invalid.")
        elif not supplier.get("pan") and gstin_format_ok(gstin):
            warnings.append("Supplier PAN is recommended (GSTIN contains PAN characters 3–12).")

    if not (recipient.get("legal_name") or recipient.get("name")):
        errors.append("Recipient legal name is required.")
    rec_gstin = recipient.get("gstin")
    if rec_gstin and not gstin_format_ok(rec_gstin):
        errors.append("Recipient GSTIN appears invalid. Please verify before issuing the invoice.")
    if is_gst and computed["taxable_value"] >= 50000 and not rec_gstin:
        if not party_state_code(recipient):
            errors.append("Unregistered recipient: state name and code are required when taxable value is ₹50,000 or more (Rule 46).")
        else:
            warnings.append("Recipient is unregistered. State and delivery address must appear on the tax invoice.")

    pos = computed.get("place_of_supply") or {}
    if is_gst and not pos.get("complete"):
        errors.append("Place of supply (state code) is required. Do not infer it from a city/location field alone.")
    if computed.get("tax_split") == "unknown" and is_gst:
        errors.append("Cannot determine CGST+SGST vs IGST: supplier state and place of supply are both required.")
    if computed.get("tax_split") == "igst" and not pos.get("state_name"):
        errors.append("Place of supply with state name is required for inter-state supplies (Rule 46(n)).")

    items = computed.get("line_items") or []
    if not items:
        errors.append("At least one line item is required.")
    missing_sac = [i for i in items if is_gst and not (i.get("sac_hsn") or "").strip()]
    if missing_sac:
        warnings.append("SAC/HSN is missing on one or more lines. Classification is not auto-assigned.")
    if any(not (i.get("description") or "").strip() for i in items):
        errors.append("Each line item needs a description of the supply.")

    if payload.get("invoice_date") in (None, ""):
        errors.append("Invoice date is required.")
    if is_gst and payload.get("gst_rate") in (None, "") and treatment == "taxable":
        errors.append("GST rate is required for a taxable GST invoice. Do not guess a rate.")
    if treatment == "taxable" and float(computed.get("gst_rate") or 0) == 0:
        warnings.append("GST rate is 0% on a taxable invoice. Confirm whether the supply is nil-rated, exempt, or non-GST.")

    if payload.get("reverse_charge"):
        warnings.append("Reverse charge is marked. Confirm whether tax is payable on reverse charge before issuing.")
    if computed.get("tds_applicable"):
        warnings.append("Verify applicable TDS section/rate before finalizing.")
        if not computed.get("tds_section"):
            warnings.append("TDS is marked applicable but no section is selected.")
    if treatment == "zero_rated":
        warnings.append("Zero-rated supply: confirm export/SEZ endorsement text with your tax professional.")
        if not payload.get("export_type"):
            warnings.append("Export/SEZ type is not set (with IGST / under LUT).")

    inv_no = (payload.get("invoice_number") or "").strip()
    if inv_no and len(inv_no) > 16:
        errors.append("GST invoice serial cannot exceed 16 characters (Rule 46(b)).")
    if inv_no and not re.match(r"^[A-Za-z0-9][A-Za-z0-9/-]*$", inv_no):
        errors.append("Invoice number may only use letters, digits, hyphen, and slash.")

    if not payload.get("payment_terms"):
        warnings.append("Payment terms are missing.")

    # Health score: start 100, subtract
    score = 100
    score -= 18 * len(errors)
    score -= 6 * len(warnings)
    score = max(0, min(100, score))
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "health": score,
        "computed": computed,
        "disclaimer": TAX_DISCLAIMER,
    }


def apply_overdue(status: str, due_date: Optional[str], today: Optional[date] = None) -> str:
    if status in {"paid", "cancelled", "draft"}:
        return status
    if not due_date:
        return status
    today = today or datetime.now(timezone.utc).date()
    try:
        due = date.fromisoformat(str(due_date)[:10])
    except ValueError:
        return status
    if due < today and status in {"sent", "viewed", "partially_paid", "overdue"}:
        return "overdue"
    return status


def can_access_invoice(user: Dict[str, Any], inv: Dict[str, Any]) -> bool:
    if not user or not inv:
        return False
    if user.get("role") == "admin":
        return True
    uid = user.get("id")
    return uid in {inv.get("issuer_id"), inv.get("recipient_user_id"), inv.get("creator_id"), inv.get("brand_id")}


def can_issue_invoice(user: Dict[str, Any]) -> bool:
    return (user or {}).get("role") in {"influencer", "owner", "agent", "admin"}


def can_edit_invoice(user: Dict[str, Any], inv: Dict[str, Any]) -> bool:
    if not can_access_invoice(user, inv):
        return False
    if inv.get("status") not in EDITABLE_STATUSES:
        return False
    if user.get("role") == "admin":
        return True
    return user.get("id") == inv.get("issuer_id")


def mask_account(number: Optional[str]) -> Optional[str]:
    raw = re.sub(r"\s+", "", number or "")
    if not raw:
        return None
    if len(raw) <= 4:
        return "••••"
    return "••••" + raw[-4:]


def public_bank(bank: Optional[Dict[str, Any]], reveal: bool = False) -> Dict[str, Any]:
    bank = dict(bank or {})
    if not bank:
        return {}
    out = {
        "bank_name": bank.get("bank_name") or "",
        "account_holder": bank.get("account_holder") or "",
        "ifsc": (bank.get("ifsc") or "").upper(),
        "branch": bank.get("branch") or "",
        "upi_id": bank.get("upi_id") or "",
        "payment_instructions": bank.get("payment_instructions") or "",
    }
    acc = bank.get("account_number") or ""
    out["account_number"] = acc if reveal else (mask_account(acc) or "")
    out["account_number_masked"] = True if acc and not reveal else False
    return out


def party_from_user(user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    user = user or {}
    billing = user.get("billing") or {}
    legal = billing.get("legal_name") or user.get("name") or ""
    trade = billing.get("trade_name") or user.get("company") or legal
    state = billing.get("state") or user.get("state") or ""
    code = billing.get("state_code") or state_code_from_name(state)
    gstin = billing.get("gstin") or ""
    if gstin and len(normalize_gstin(gstin)) >= 2:
        code = code or normalize_gstin(gstin)[:2]
    address = billing.get("address") or ""
    if not address:
        bits = [user.get("city"), user.get("state"), user.get("pincode")]
        address = ", ".join(b for b in bits if b)
    return {
        "user_id": user.get("id"),
        "legal_name": legal,
        "trade_name": trade,
        "address": address,
        "city": billing.get("city") or user.get("city") or "",
        "state": state,
        "state_code": code,
        "pincode": billing.get("pincode") or user.get("pincode") or "",
        "gstin": gstin,
        "pan": billing.get("pan") or "",
        "email": billing.get("email") or user.get("email") or "",
        "phone": billing.get("phone") or user.get("mobile") or "",
        "logo_file_id": billing.get("logo_file_id"),
    }


def default_settings(user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    fy = financial_year()
    return {
        "prefix": "FLU",
        "financial_year": fy,
        "starting_number": 1,
        "number_width": 4,
        "default_payment_terms": "Net 15",
        "currency": "INR",
        "default_gst_rate": None,
        "default_gst_treatment": "taxable",
        "default_template": "professional",
        "rounding": "nearest_rupee",
        "default_tds_applicable": False,
        "default_tds_section": "",
        "default_tds_rate": None,
        "stamp_enabled": True,
        "stamp_size": 96,
        "signatory_name": (user or {}).get("name") or "",
        "signatory_designation": "",
        "terms": "Payment to be made as per the agreed campaign terms. This document is not tax advice.",
    }


def demo_pack() -> Dict[str, Any]:
    """In-memory DEMO DATA. Never written to production invoice collections."""
    supplier = {
        "legal_name": "Rahul Kumar",
        "trade_name": "Rahul Media Works",
        "address": "Demo Street, Example Layout (DEMO DATA)",
        "city": "Bengaluru",
        "state": "Karnataka",
        "state_code": "29",
        "gstin": "29ABCDE1234F1Z5",
        "pan": "ABCDE1234F",
        "email": "demo.creator@example.invalid",
        "phone": "9999999999",
    }
    recipient = {
        "legal_name": "ABC Consumer Technologies Pvt Ltd",
        "trade_name": "ABC Consumer Technologies Pvt Ltd",
        "address": "Demo Tech Park (DEMO DATA)",
        "city": "Bengaluru",
        "state": "Karnataka",
        "state_code": "29",
        "gstin": "29AAACA1234A1Z5",
        "pan": "AAACA1234A",
        "email": "demo.brand@example.invalid",
    }
    payload = {
        "supplier": supplier,
        "recipient": recipient,
        "place_of_supply_state_code": "29",
        "gst_treatment": "taxable",
        "gst_rate": 18,
        "discount_kind": "amount",
        "discount_value": 0,
        "rounding": "nearest_rupee",
        "line_items": [
            {"description": "Instagram Reel", "sac_hsn": "", "qty": 2, "rate": 25000},
            {"description": "Instagram Story", "sac_hsn": "", "qty": 3, "rate": 5000},
            {"description": "YouTube Integration", "sac_hsn": "", "qty": 1, "rate": 35000},
        ],
        "tds_applicable": False,
    }
    computed = compute_invoice(payload)
    return {
        "demo": True,
        "label": "DEMO DATA",
        "disclaimer": TAX_DISCLAIMER,
        "note": "Example identifiers only. Not a government-verified GSTIN/PAN. Not written to production invoices.",
        "creator": supplier,
        "company": recipient,
        "campaign": {
            "name": "Smartphone Launch Campaign",
            "campaign_id": "FLUGR-CAMP-2026-0012",
        },
        "invoice": {
            "invoice_number": "FLU/2026-27/0001",
            "status": "paid",
            **computed,
        },
        "gstin_valid_supplier": gstin_format_ok(supplier["gstin"]),
        "gstin_valid_recipient": gstin_format_ok(recipient["gstin"]),
    }


def sanitize_ai_extraction(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Drop fields AI is not allowed to invent."""
    forbidden = {
        "gstin", "pan", "bank_name", "account_number", "ifsc", "upi_id",
        "gst_rate", "sac_hsn", "hsn", "sac", "cgst", "sgst", "igst", "legal_name",
        "state_code", "tax_split",
    }
    out: Dict[str, Any] = {}
    if not isinstance(raw, dict):
        return out
    if isinstance(raw.get("line_items"), list):
        items = []
        for it in raw["line_items"][:20]:
            if not isinstance(it, dict):
                continue
            items.append({
                "description": str(it.get("description") or "")[:200],
                "qty": it.get("qty") or 1,
                "rate": it.get("rate"),
                "unit": str(it.get("unit") or "Nos")[:12],
            })
        out["line_items"] = items
    for key in ("payment_terms", "notes", "campaign_name", "description"):
        if raw.get(key):
            out[key] = str(raw[key])[:500]
    if raw.get("discount_value") not in (None, ""):
        try:
            out["discount_value"] = float(raw["discount_value"])
            out["discount_kind"] = "amount" if raw.get("discount_kind") != "percent" else "percent"
        except (TypeError, ValueError):
            pass
    # Explicitly discard forbidden keys if the model leaked them
    for k in list(out.keys()):
        if k in forbidden:
            out.pop(k, None)
    return out
