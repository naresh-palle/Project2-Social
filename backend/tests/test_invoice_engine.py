"""Unit tests for CR8 GST invoice engine — no Mongo."""
from decimal import Decimal

from invoice_engine import (
    TAX_DISCLAIMER,
    amount_in_words,
    apply_overdue,
    can_access_invoice,
    can_edit_invoice,
    compute_invoice,
    format_invoice_number,
    gstin_checksum_char,
    gstin_format_ok,
    mask_account,
    money,
    pan_format_ok,
    party_state_code,
    resolve_place_of_supply,
    sanitize_ai_extraction,
    validate_invoice,
)


def _base(**kwargs):
    payload = {
        "supplier": {
            "legal_name": "Rahul Media Works",
            "address": "1 Demo Road",
            "state": "Karnataka",
            "state_code": "29",
            "gstin": "29AAACR1234A1Z5",  # may fail checksum; tests that need valid GSTIN construct one
            "pan": "AAACR1234A",
        },
        "recipient": {
            "legal_name": "ABC Consumer Technologies Pvt Ltd",
            "address": "2 Demo Park",
            "state": "Karnataka",
            "state_code": "29",
            "gstin": "29AAACA1234A1Z5",
        },
        "place_of_supply_state_code": "29",
        "gst_treatment": "taxable",
        "gst_rate": 18,
        "invoice_date": "2026-08-15",
        "line_items": [
            {"description": "Instagram Reel", "sac_hsn": "998361", "qty": 2, "rate": 25000},
            {"description": "Instagram Story", "sac_hsn": "998361", "qty": 3, "rate": 5000},
            {"description": "YouTube Integration", "sac_hsn": "998361", "qty": 1, "rate": 35000},
        ],
    }
    payload.update(kwargs)
    return payload


def _valid_gstin(state="29", pan="AAACR1234A", entity="1"):
    body = f"{state}{pan}{entity}Z"
    return body + gstin_checksum_char(body)


def test_intra_state_cgst_sgst_example():
    c = compute_invoice(_base(
        line_items=[{"description": "Campaign fee", "sac_hsn": "998361", "qty": 1, "rate": 100000}],
    ))
    assert c["tax_split"] == "cgst_sgst"
    assert c["taxable_value"] == 100000.0
    assert c["cgst"] == 9000.0
    assert c["sgst"] == 9000.0
    assert c["igst"] == 0.0
    assert c["grand_total"] == 118000.0
    assert "One Lakh Eighteen Thousand" in c["amount_in_words"]


def test_inter_state_igst_example():
    payload = _base(
        recipient={
            "legal_name": "North Brand Pvt Ltd",
            "address": "Delhi",
            "state": "Delhi",
            "state_code": "07",
            "gstin": _valid_gstin("07", "AAACN1234B"),
        },
        place_of_supply_state_code="07",
        line_items=[{"description": "Campaign fee", "sac_hsn": "998361", "qty": 1, "rate": 100000}],
    )
    payload["supplier"]["gstin"] = _valid_gstin("29", "AAACR1234A")
    c = compute_invoice(payload)
    assert c["tax_split"] == "igst"
    assert c["igst"] == 18000.0
    assert c["cgst"] == 0.0
    assert c["sgst"] == 0.0
    assert c["grand_total"] == 118000.0


def test_place_of_supply_uses_recipient_gstin_not_city():
    pos = resolve_place_of_supply(
        {"gstin": _valid_gstin("29"), "state": "Karnataka", "city": "Hyderabad"},
        {"gstin": _valid_gstin("07", "AAAAA1234A"), "state": "Delhi", "city": "Gurugram"},
        None,
    )
    assert pos["state_code"] == "07"
    assert pos["source"] == "recipient_gstin_or_state"


def test_zero_tax_exempt():
    c = compute_invoice(_base(gst_treatment="exempt", gst_rate=18))
    assert c["total_gst"] == 0.0
    assert c["gst_rate"] == 0.0
    assert c["invoice_kind"] == "gst"


def test_non_gst_invoice_kind():
    c = compute_invoice(_base(gst_treatment="non_gst", gst_rate=18))
    assert c["invoice_kind"] == "non_gst"
    assert c["total_gst"] == 0.0
    assert c["tax_split"] == "none"


def test_line_and_invoice_discounts_before_gst():
    c = compute_invoice(_base(
        discount_kind="amount",
        discount_value=5000,
        line_items=[
            {"description": "Reel", "sac_hsn": "998361", "qty": 2, "rate": 25000},
            {"description": "Story", "sac_hsn": "998361", "qty": 3, "rate": 5000},
            {"description": "YouTube", "sac_hsn": "998361", "qty": 1, "rate": 35000},
        ],
    ))
    assert c["subtotal"] == 100000.0
    assert c["invoice_discount"] == 5000.0
    assert c["taxable_value"] == 95000.0
    assert c["total_gst"] == 17100.0
    assert c["grand_total"] == 112100.0


def test_percent_line_discount():
    c = compute_invoice(_base(line_items=[
        {"description": "Reel", "sac_hsn": "998361", "qty": 1, "rate": 10000, "discount_kind": "percent", "discount_value": 10},
    ]))
    assert c["taxable_value"] == 9000.0
    assert c["cgst"] == 810.0


def test_rounding_nearest_rupee():
    c = compute_invoice(_base(
        rounding="nearest_rupee",
        line_items=[{"description": "Fee", "sac_hsn": "998361", "qty": 1, "rate": 99999.50}],
    ))
    assert c["taxable_value"] == 99999.50
    assert c["total_gst"] == 17999.91
    # 99,999.50 + 17,999.91 = 1,17,999.41 → nearest rupee 1,17,999 (round-off −0.41)
    assert c["grand_total"] == 117999.0
    assert round(c["round_off"], 2) == -0.41
    none = compute_invoice(_base(
        rounding="none",
        line_items=[{"description": "Fee", "sac_hsn": "998361", "qty": 1, "rate": 99999.50}],
    ))
    assert none["grand_total"] == 117999.41
    assert none["round_off"] == 0.0


def test_money_avoids_binary_float():
    assert money("0.1") + money("0.2") == Decimal("0.30")


def test_invoice_number_unique_format_and_16_char_cap():
    a = format_invoice_number("CR8", "2026-27", 1)
    b = format_invoice_number("CR8", "2026-27", 2)
    assert a == "CR8/2026-27/0001"
    assert b == "CR8/2026-27/0002"
    assert a != b
    long_prefix = format_invoice_number("CR8STUDIO", "2026-27", 12)
    assert len(long_prefix) <= 16


def test_gstin_checksum_roundtrip():
    g = _valid_gstin()
    assert gstin_format_ok(g)
    assert not gstin_format_ok("29ABCDE1234F1Z5")  # example identifier, likely bad checksum
    assert pan_format_ok("ABCDE1234F")
    assert not pan_format_ok("ABCDE1234")


def test_validation_blocks_bad_recipient_gstin():
    payload = _base()
    payload["supplier"]["gstin"] = _valid_gstin("29")
    payload["recipient"]["gstin"] = "29ABCDE1234F1Z5"
    result = validate_invoice(payload)
    assert result["ok"] is False
    assert any("Recipient GSTIN" in e for e in result["errors"])
    assert TAX_DISCLAIMER in result["disclaimer"]


def test_validation_requires_sac_warning_not_hardcoded():
    payload = _base()
    payload["supplier"]["gstin"] = _valid_gstin("29")
    payload["recipient"]["gstin"] = _valid_gstin("29", "AAACA1234A")
    payload["line_items"] = [{"description": "Reel", "qty": 1, "rate": 1000}]
    result = validate_invoice(payload)
    assert any("SAC/HSN" in w for w in result["warnings"])


def test_tds_configurable_not_assumed():
    c = compute_invoice(_base(
        tds_applicable=True,
        tds_section="194J",
        tds_rate=10,
        line_items=[{"description": "Fee", "sac_hsn": "998361", "qty": 1, "rate": 100000}],
    ))
    assert c["tds_amount"] == 10000.0
    assert c["grand_total"] == 118000.0
    assert c["net_payable"] == 108000.0
    c2 = compute_invoice(_base(line_items=[{"description": "Fee", "sac_hsn": "998361", "qty": 1, "rate": 100000}]))
    assert c2["tds_amount"] == 0.0


def test_amount_in_words():
    assert amount_in_words(118000) == "Indian Rupees One Lakh Eighteen Thousand Only"


def test_overdue_and_rbac():
    assert apply_overdue("sent", "2020-01-01") == "overdue"
    assert apply_overdue("paid", "2020-01-01") == "paid"
    issuer = {"id": "c1", "role": "influencer"}
    brand = {"id": "b1", "role": "owner"}
    other = {"id": "x", "role": "influencer"}
    inv = {"issuer_id": "c1", "recipient_user_id": "b1", "status": "draft"}
    assert can_access_invoice(issuer, inv)
    assert can_access_invoice(brand, inv)
    assert not can_access_invoice(other, inv)
    assert can_edit_invoice(issuer, inv)
    assert not can_edit_invoice(issuer, {**inv, "status": "sent"})
    assert can_access_invoice({"id": "a", "role": "admin"}, inv)


def test_mask_account():
    assert mask_account("123456789012") == "••••9012"


def test_ai_cannot_invent_gstin_or_rate():
    cleaned = sanitize_ai_extraction({
        "gstin": "29FAKEGSTIN1Z5",
        "pan": "AAAAA1234A",
        "gst_rate": 18,
        "sac_hsn": "998361",
        "account_number": "1234",
        "line_items": [{"description": "Two reels", "qty": 2, "rate": 25000, "sac_hsn": "998361"}],
        "payment_terms": "Net 7",
    })
    assert "gstin" not in cleaned
    assert "gst_rate" not in cleaned
    assert "sac_hsn" not in cleaned.get("line_items")[0]
    assert cleaned["line_items"][0]["qty"] == 2
    assert cleaned["payment_terms"] == "Net 7"


def test_party_state_prefers_gstin_prefix():
    code = party_state_code({"gstin": _valid_gstin("27", "AAAAA1111A"), "state": "Karnataka", "state_code": "29"})
    assert code == "27"


def test_pdf_is_selectable_text_not_screenshot():
    from invoice_engine import compute_invoice
    from invoice_pdf import build_invoice_pdf
    payload = _base()
    payload["supplier"]["gstin"] = _valid_gstin("29")
    c = compute_invoice(payload)
    pdf = build_invoice_pdf({
        **c,
        "invoice_number": "CR8/2026-27/0001",
        "invoice_date": "2026-08-15",
        "status": "draft",
        "supplier": payload["supplier"],
        "recipient": payload["recipient"],
        "campaign": {"name": "Smartphone Launch Campaign", "campaign_id": "CR8-CAMP-2026-0012"},
        "template": "professional",
        "payment_terms": "Net 15",
        "bank": {"bank_name": "Demo Bank", "account_number": "••••9012", "ifsc": "DEMO0001234"},
    })
    assert pdf.startswith(b"%PDF")
    assert b"/Font" in pdf  # text operators / embedded fonts, not a raster screenshot
    assert b"CR8/2026-27/0001" in pdf or b"Invoice" in pdf
    modern = build_invoice_pdf({**c, "invoice_number": "CR8/2026-27/0002", "template": "modern", "supplier": payload["supplier"], "recipient": payload["recipient"]})
    minimal = build_invoice_pdf({**c, "invoice_number": "CR8/2026-27/0003", "template": "minimal", "supplier": payload["supplier"], "recipient": payload["recipient"]})
    assert modern.startswith(b"%PDF") and minimal.startswith(b"%PDF")
