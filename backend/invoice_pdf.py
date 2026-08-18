"""A4 selectable-text GST invoice PDFs (reportlab). Three original flugr templates."""
from __future__ import annotations

import io
from typing import Any, Dict, Optional, Tuple

from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from invoice_engine import TAX_DISCLAIMER

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm

TEMPLATES = {
    "professional": {"accent": HexColor("#1F2933"), "bar": HexColor("#FF3B30"), "rule": HexColor("#D1D5DB"), "muted": HexColor("#6B7280")},
    "modern": {"accent": HexColor("#0B0B0E"), "bar": HexColor("#FF3B30"), "rule": HexColor("#E5E7EB"), "muted": HexColor("#6B7280")},
    "minimal": {"accent": HexColor("#111111"), "bar": HexColor("#111111"), "rule": HexColor("#E5E7EB"), "muted": HexColor("#9CA3AF")},
}


def _inr(n: Any) -> str:
    try:
        v = float(n or 0)
    except (TypeError, ValueError):
        return "₹0.00"
    neg = v < 0
    v = abs(v)
    s = f"{v:,.2f}"
    parts = s.split(".")
    whole = parts[0].replace(",", "")
    if len(whole) > 3:
        whole = whole[:-3][::-1]
        grouped = ",".join([whole[i:i + 2] for i in range(0, len(whole), 2)])[::-1]
        whole = grouped + "," + parts[0].replace(",", "")[-3:]
    out = f"₹{whole}.{parts[1]}"
    return f"-{out}" if neg else out


def _party_block(p: Dict[str, Any]) -> list:
    p = p or {}
    lines = [
        p.get("legal_name") or p.get("trade_name") or p.get("name") or "",
        p.get("trade_name") if p.get("trade_name") and p.get("trade_name") != p.get("legal_name") else "",
        p.get("address") or "",
        ", ".join(x for x in [p.get("city"), p.get("state"), p.get("pincode")] if x),
        f"GSTIN: {p.get('gstin')}" if p.get("gstin") else "GSTIN: —",
        f"PAN: {p.get('pan')}" if p.get("pan") else "",
        f"State: {p.get('state') or ''} ({p.get('state_code') or '—'})",
        p.get("email") or "",
        p.get("phone") or "",
    ]
    return [ln for ln in lines if ln]


def _draw_image(c: canvas.Canvas, data: Optional[bytes], x, y, max_w, max_h):
    if not data:
        return
    try:
        img = ImageReader(io.BytesIO(data))
        iw, ih = img.getSize()
        if not iw or not ih:
            return
        scale = min(max_w / iw, max_h / ih)
        w, h = iw * scale, ih * scale
        c.drawImage(img, x, y, width=w, height=h, mask="auto", preserveAspectRatio=True, anchor="c")
    except Exception:
        return


def build_invoice_pdf(
    invoice: Dict[str, Any],
    *,
    logo: Optional[bytes] = None,
    signature: Optional[bytes] = None,
    stamp: Optional[bytes] = None,
) -> bytes:
    template = invoice.get("template") or "professional"
    theme = TEMPLATES.get(template, TEMPLATES["professional"])
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"{invoice.get('invoice_number') or 'Draft'} — flugr Invoice")
    c.setAuthor("flugr")

    kind = (invoice.get("invoice_kind") or "gst").upper()
    title = "TAX INVOICE" if kind == "GST" else "INVOICE (NON-GST)"
    if invoice.get("demo"):
        title = "DEMO " + title

    y = PAGE_H - MARGIN
    c.setFillColor(theme["bar"])
    c.rect(0, PAGE_H - 6, PAGE_W, 6, fill=1, stroke=0)

    if logo:
        _draw_image(c, logo, MARGIN, y - 18 * mm, 32 * mm, 16 * mm)
    c.setFillColor(theme["accent"])
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(PAGE_W - MARGIN, y - 4 * mm, invoice.get("supplier", {}).get("trade_name") or "flugr")
    c.setFont("Helvetica", 8)
    c.setFillColor(theme["muted"])
    c.drawRightString(PAGE_W - MARGIN, y - 9 * mm, "flugr billing")
    y -= 22 * mm

    c.setFillColor(theme["accent"])
    c.setFont("Helvetica-Bold", 16)
    c.drawString(MARGIN, y, title)
    c.setFont("Helvetica", 8)
    c.setFillColor(theme["muted"])
    meta = [
        f"Invoice No.  {invoice.get('invoice_number') or invoice.get('draft_number') or 'DRAFT'}",
        f"Date  {str(invoice.get('invoice_date') or '')[:10]}",
        f"Due  {str(invoice.get('due_date') or '—')[:10]}",
        f"Status  {(invoice.get('status') or 'draft').replace('_', ' ').title()}",
    ]
    c.drawRightString(PAGE_W - MARGIN, y + 4, meta[0])
    c.drawRightString(PAGE_W - MARGIN, y - 6, "  ·  ".join(meta[1:]))
    y -= 12 * mm
    c.setStrokeColor(theme["rule"])
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 8 * mm

    col_w = (PAGE_W - 2 * MARGIN - 8 * mm) / 2
    c.setFillColor(theme["accent"])
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN, y, "SUPPLIER")
    c.drawString(MARGIN + col_w + 8 * mm, y, "BILL TO")
    y -= 5 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(black)
    left = _party_block(invoice.get("supplier") or {})
    right = _party_block(invoice.get("recipient") or {})
    rows = max(len(left), len(right))
    for i in range(rows):
        if i < len(left):
            c.drawString(MARGIN, y, left[i][:62])
        if i < len(right):
            c.drawString(MARGIN + col_w + 8 * mm, y, right[i][:62])
        y -= 4 * mm

    pos = invoice.get("place_of_supply") or {}
    y -= 2 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(theme["muted"])
    c.drawString(MARGIN, y, f"Place of supply: {pos.get('state_name') or '—'} ({pos.get('state_code') or '—'})")
    if invoice.get("reverse_charge"):
        c.drawRightString(PAGE_W - MARGIN, y, "Tax payable on reverse charge: Yes")
    y -= 8 * mm

    camp = invoice.get("campaign") or {}
    if camp.get("name") or camp.get("title") or camp.get("campaign_id"):
        c.setFillColor(theme["accent"])
        c.setFont("Helvetica-Bold", 8)
        c.drawString(MARGIN, y, "CAMPAIGN")
        y -= 4.5 * mm
        c.setFont("Helvetica", 8)
        c.setFillColor(black)
        c.drawString(MARGIN, y, f"{camp.get('name') or camp.get('title') or ''}   {camp.get('campaign_id') or camp.get('id') or ''}")
        y -= 4 * mm
        period = " – ".join(x for x in [str(camp.get("start") or "")[:10], str(camp.get("end") or camp.get("deadline") or "")[:10]] if x)
        if period:
            c.drawString(MARGIN, y, f"Period: {period}")
            y -= 4 * mm
        y -= 2 * mm

    # Table header
    headers = [("Description", 70 * mm), ("SAC/HSN", 22 * mm), ("Qty", 14 * mm), ("Rate", 24 * mm), ("Taxable", 28 * mm)]
    c.setFillColor(theme["accent"])
    c.rect(MARGIN, y - 5 * mm, PAGE_W - 2 * MARGIN, 7 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7)
    x = MARGIN + 2 * mm
    c.drawString(x, y - 3.2 * mm, "DESCRIPTION")
    c.drawString(MARGIN + 78 * mm, y - 3.2 * mm, "SAC/HSN")
    c.drawRightString(MARGIN + 118 * mm, y - 3.2 * mm, "QTY")
    c.drawRightString(MARGIN + 144 * mm, y - 3.2 * mm, "RATE")
    c.drawRightString(PAGE_W - MARGIN - 2 * mm, y - 3.2 * mm, "TAXABLE")
    y -= 10 * mm
    c.setFillColor(black)
    c.setFont("Helvetica", 8)
    for item in invoice.get("line_items") or []:
        if y < 55 * mm:
            c.showPage()
            y = PAGE_H - MARGIN
        c.drawString(MARGIN + 2 * mm, y, str(item.get("description") or "")[:48])
        c.drawString(MARGIN + 78 * mm, y, str(item.get("sac_hsn") or "—"))
        c.drawRightString(MARGIN + 118 * mm, y, str(item.get("qty") or ""))
        c.drawRightString(MARGIN + 144 * mm, y, _inr(item.get("rate")))
        c.drawRightString(PAGE_W - MARGIN - 2 * mm, y, _inr(item.get("taxable_amount")))
        y -= 5 * mm

    y -= 4 * mm
    c.setStrokeColor(theme["rule"])
    c.line(MARGIN + 90 * mm, y + 3 * mm, PAGE_W - MARGIN, y + 3 * mm)
    totals = [
        ("Subtotal", invoice.get("subtotal")),
        ("Discount", invoice.get("discount_total")),
        ("Taxable value", invoice.get("taxable_value")),
        ("CGST", invoice.get("cgst")),
        ("SGST", invoice.get("sgst")),
        ("UTGST", invoice.get("utgst")),
        ("IGST", invoice.get("igst")),
        ("Total GST", invoice.get("total_gst")),
        ("Round off", invoice.get("round_off")),
        ("Grand total", invoice.get("grand_total")),
    ]
    if invoice.get("tds_applicable") or invoice.get("tds_amount"):
        totals += [
            (f"TDS {invoice.get('tds_section') or ''}".strip(), invoice.get("tds_amount")),
            ("Net payable", invoice.get("net_payable")),
        ]
    c.setFont("Helvetica", 8)
    for label, val in totals:
        if label in {"CGST", "SGST", "UTGST", "IGST", "TDS"} and not float(val or 0):
            continue
        bold = label in {"Grand total", "Net payable", "Taxable value"}
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 8)
        c.drawString(MARGIN + 100 * mm, y, label)
        c.drawRightString(PAGE_W - MARGIN, y, _inr(val))
        y -= 4.2 * mm

    y -= 3 * mm
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(theme["accent"])
    words = invoice.get("amount_in_words") or ""
    c.drawString(MARGIN, y, words[:110])
    y -= 8 * mm

    bank = invoice.get("bank") or {}
    c.setFillColor(theme["accent"])
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGIN, y, "PAYMENT")
    y -= 4.5 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(black)
    pay_lines = [
        f"{bank.get('bank_name') or ''}  {bank.get('account_holder') or ''}".strip(),
        f"A/c {bank.get('account_number') or '—'}  IFSC {bank.get('ifsc') or '—'}",
        f"UPI {bank.get('upi_id')}" if bank.get("upi_id") else "",
        f"Terms: {invoice.get('payment_terms') or '—'}",
        bank.get("payment_instructions") or "",
    ]
    for ln in pay_lines:
        if ln:
            c.drawString(MARGIN, y, ln[:100])
            y -= 4 * mm

    y -= 4 * mm
    sig_x = PAGE_W - MARGIN - 50 * mm
    if stamp and invoice.get("stamp_enabled", True):
        size = float(invoice.get("stamp_size") or 96) * 0.26
        _draw_image(c, stamp, sig_x - 8 * mm, y - 18 * mm, size, size)
    c.setFont("Helvetica", 7)
    c.setFillColor(theme["muted"])
    c.drawString(sig_x, y, "Authorized Signatory")
    if signature:
        _draw_image(c, signature, sig_x, y - 16 * mm, 40 * mm, 14 * mm)
    c.setFillColor(black)
    c.setFont("Helvetica", 8)
    c.drawString(sig_x, y - 18 * mm, invoice.get("signatory_name") or "")
    c.setFont("Helvetica", 7)
    c.drawString(sig_x, y - 22 * mm, invoice.get("signatory_designation") or "")
    c.setFillColor(theme["muted"])
    c.drawString(sig_x, y - 26 * mm, "Uploaded image is not a legally verified digital signature.")

    c.setFont("Helvetica", 6)
    c.setFillColor(theme["muted"])
    terms = invoice.get("terms") or ""
    c.drawString(MARGIN, 18 * mm, (terms or "")[:120])
    # wrap disclaimer
    text = c.beginText(MARGIN, 14 * mm)
    text.setFont("Helvetica", 6)
    text.setFillColor(theme["muted"])
    for i in range(0, len(TAX_DISCLAIMER), 140):
        text.textLine(TAX_DISCLAIMER[i:i + 140])
    c.drawText(text)
    if invoice.get("demo"):
        c.setFillColor(HexColor("#FF3B30"))
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(PAGE_W / 2, 8 * mm, "DEMO DATA — example identifiers only, not a government-verified document")

    c.showPage()
    c.save()
    return buf.getvalue()
