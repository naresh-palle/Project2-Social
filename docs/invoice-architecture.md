# CR8 GST Invoice & Billing — Architecture

Integrated into the existing CR8 FastAPI + Mongo + CRA app. **No database reset, no duplicate user/campaign tables.**

## 1. Existing architecture (reused)

| Piece | Location |
| --- | --- |
| Frontend | CRA/CRACO, HashRouter, Manrope, vermilion `#FF3B30` |
| Backend | FastAPI `backend/server.py`, Motor Mongo `cr8_social` |
| Auth | JWT `get_current_user` / `require_role` |
| Roles | `influencer`, `owner`, `agent`, `admin` |
| Campaigns | `campaigns`, `deliverables`, `applications` |
| Wallet/escrow | `users.wallet`, `wallet_tx` (not duplicated) |
| Files | GridFS `file_uploads` + `/api/uploads` |
| Audit | `write_audit_log` → `audit_logs` |
| Email | `send_email` / Brevo |
| LLM | `call_llm()` Anthropic then Gemini |

## 2. Files modified / added

**New:** `backend/invoice_engine.py`, `backend/invoice_pdf.py`, `backend/invoice_features.py`, `backend/tests/test_invoice_engine.py`, `frontend/src/pages/Billing.jsx`, `InvoiceEditor.jsx`, `BillingSettings.jsx`, `frontend/src/components/InvoicePreview.jsx`, `docs/invoice-architecture.md`

**Modified:** `backend/server.py` (register `setup_invoices`), `backend/requirements.txt` (`reportlab`), `frontend/src/App.js`, `frontend/src/lib/navConfig.js`, `frontend/src/pages/CampaignDetail.jsx`

## 3. Database (additive only)

| Collection | Purpose |
| --- | --- |
| `invoices` | Drafts and issued invoices |
| `invoice_settings` | Per-user numbering, template, TDS defaults, bank |
| `invoice_sequences` | `{issuer_id, fy, last_seq}` — finalized numbers only |
| `invoice_tax_codes` | Admin-maintained SAC/HSN suggestions |

`users.billing` nested object stores legal name, GSTIN, PAN, address, logo/signature/stamp file ids. Existing user documents are never dropped.

Demo pack is served from `GET /api/invoices/demo` **in memory** — not inserted into `invoices`.

## 4. APIs

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/invoices` `/summary` | issuer / recipient / admin |
| POST | `/api/invoices` | influencer, owner, agent, admin |
| PATCH | `/api/invoices/{id}` | issuer, draft only |
| POST | `/api/invoices/{id}/finalize` | issuer, draft → sequential number |
| POST | `/api/invoices/{id}/send` | email + PDF |
| GET | `/api/invoices/{id}/pdf` | authorized download |
| POST | `/api/invoices/from-campaign/{id}` | accepted creator |
| POST | `/api/invoices/ai-draft` `{id}/ai-review` `{id}/ai-assist` | issuer |
| GET/PUT | `/api/billing/settings` | self (bank masked unless reveal) |
| GET/POST | `/api/invoices/tax-codes` | GET all; POST admin |
| GET | `/api/invoices/demo` | labeled DEMO DATA |

## 5–7. Calculation / GST / TDS

`compute_invoice()` is the only source of totals (Decimal, ROUND_HALF_UP, 2 dp).

- Place of supply: explicit state code, else **recipient GSTIN prefix**, else recipient `state_code`. **Not** inferred from city/campaign location.
- Same state code → CGST + SGST (or UTGST). Different → IGST.
- Discounts reduce taxable value before GST.
- TDS is **opt-in and configurable** (section + rate). Never assumed.
- Invoice serial: max 16 chars, unique per issuer + FY (CGST Rule 46(b)). Drafts use `DRAFT-…`. Cancelled numbers are not reused for a new live invoice (sequence only increments on finalize).

Official reference: [CGST Rules Rule 46](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html).

## 8–11. PDF, templates, AI, branding

Three original templates (`professional`, `modern`, `minimal`) via reportlab A4 selectable text (not a screenshot). Logo / signature / stamp from authenticated uploads. Signature is labeled **not a legally verified digital signature**. Stamp is user-uploaded, never a fabricated government seal.

AI extracts line items and notes only (`sanitize_ai_extraction` drops GSTIN, PAN, rates, SAC/HSN, bank). Engine recalculates tax. AI review reports health/errors/warnings and **cannot override totals**.

## 12. Environment

Existing: `MONGO_URL`, `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`, `BREVO_API_KEY` (PDF email attachment). New: **none required**. `reportlab` is the only new Python dependency.

## 13. Known limitations (not tax advice)

- No NIC/IRP **e-invoice IRN/QR** generation (fields exist for later IRN paste).
- No GSTN return filing (GSTR-1).
- SAC codes are **suggestions**; none is hard-coded as “the” influencer SAC.
- GST rates are user/admin configured, not scraped from GSTN.
- Email “delivered/viewed” beyond CR8 `sent`/`viewed` depends on provider support.
- Demo GSTINs `29ABCDE1234F1Z5` / `29AAACA1234A1Z5` are **example identifiers** and typically fail checksum — labeled DEMO DATA.

## 14. Security

RBAC: issuer edits drafts; recipient views received; admin all. Bank account masked in APIs unless `reveal_bank=true` for the owner. Uploads reuse existing type/size checks. Cross-company access denied via `can_access_invoice`.
