import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { InvoicePreview } from "@/components/InvoicePreview";
import { AiIcon } from "@/components/AiIcon";

const emptyItem = () => ({ description: "", sac_hsn: "", qty: 1, rate: 0, discount_kind: "", discount_value: 0 });

export default function InvoiceEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const campaignId = params.get("campaign");
  const nav = useNavigate();
    const isNew = !id;
  const [inv, setInv] = useState(null);
  const [codes, setCodes] = useState([]);
  const [codeQ, setCodeQ] = useState("");
  const [aiText, setAiText] = useState("");
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState("");

  const load = async (invoiceId) => {
    const { data } = await api.get(`/invoices/${invoiceId}`);
    setInv(data);
  };

  useEffect(() => {
    api.get("/invoices/tax-codes").then(({ data }) => setCodes(data.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (campaignId && isNew) {
          const { data } = await api.post(`/invoices/from-campaign/${campaignId}`);
          nav(`/billing/${data.id}/edit`, { replace: true });
          return;
        }
        if (!isNew) await load(id);
        else {
          const { data } = await api.post("/invoices", { line_items: [emptyItem()], gst_treatment: "taxable" });
          nav(`/billing/${data.id}/edit`, { replace: true });
        }
      } catch (e) {
        toast.error(formatApiError(e?.response?.data?.detail) || "Could not open invoice");
      }
    })();
  }, [id, campaignId]);

  const save = async (patch) => {
    if (!inv?.id || inv.status !== "draft") return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/invoices/${inv.id}`, patch);
      setInv(data);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Save failed");
    } finally { setBusy(false); }
  };

  const setField = (path, value) => {
    setInv((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const bits = path.split(".");
      let cur = next;
      for (let i = 0; i < bits.length - 1; i++) {
        cur[bits[i]] = { ...(cur[bits[i]] || {}) };
        cur = cur[bits[i]];
      }
      cur[bits[bits.length - 1]] = value;
      return next;
    });
  };

  const persistCore = () => save({
    supplier: inv.supplier,
    recipient: inv.recipient,
    line_items: inv.line_items,
    gst_treatment: inv.gst_treatment,
    gst_rate: inv.gst_rate,
    place_of_supply_state_code: inv.place_of_supply?.state_code || inv.place_of_supply_state_code,
    discount_kind: inv.discount_kind || "amount",
    discount_value: inv.discount_value || inv.invoice_discount || 0,
    tds_applicable: inv.tds_applicable,
    tds_section: inv.tds_section,
    tds_rate: inv.tds_rate,
    reverse_charge: inv.reverse_charge,
    payment_terms: inv.payment_terms,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    template: inv.template,
    notes: inv.notes,
  });

  const filteredCodes = useMemo(() => {
    const q = codeQ.toLowerCase();
    return (codes || []).filter((c) => !q || c.code.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q)).slice(0, 8);
  }, [codes, codeQ]);

  if (!inv) {
    return <div className="py-20 text-center font-mono text-xs tracking-widest uppercase opacity-50">Loading invoice…</div>;
  }

  const locked = inv.status !== "draft";

  const runAiDraft = async (e) => {
    e?.preventDefault();
    if (!aiText.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/invoices/ai-draft", { message: aiText }, { params: inv.campaign_id ? { campaign_id: inv.campaign_id } : {} });
      if (data.invoice?.id && data.invoice.id !== inv.id) {
        nav(`/billing/${data.invoice.id}/edit`);
      } else if (data.invoice) setInv(data.invoice);
      toast.success(data.ai_note || "Draft updated");
      if (data.missing?.length) toast.message(`Required information missing: ${data.missing.join(", ")}`);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "AI draft failed");
    } finally { setBusy(false); }
  };

  const runReview = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/invoices/${inv.id}/ai-review`);
      setReview(data);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Review failed");
    } finally { setBusy(false); }
  };

  const finalize = async () => {
    await persistCore();
    setBusy(true);
    try {
      const { data } = await api.post(`/invoices/${inv.id}/finalize`);
      setInv(data);
      toast.success(`Finalized ${data.invoice_number}`);
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (d?.errors) {
        setReview({ ...d, health: 0, warnings: d.warnings || [] });
        toast.error(d.message || "Validation failed");
      } else toast.error(formatApiError(d) || "Finalize failed");
    } finally { setBusy(false); }
  };

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/invoices/${inv.id}/send`, {});
      toast.success("Invoice emailed");
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Send failed");
    } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number || inv.draft_number || "invoice"}.pdf`;
      a.click();
    } catch {
      toast.error("PDF failed");
    }
  };

  const assist = async (e) => {
    e?.preventDefault();
    if (!chat.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/invoices/${inv.id}/ai-assist`, { message: chat });
      setInv(data.invoice);
      setChat("");
      toast.success(data.reply);
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "Assistant failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full pb-24" data-testid="invoice-editor">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-3 mb-4">
        <div>
          <Link to="/billing" className="font-mono text-[10px] uppercase tracking-widest text-white/40">← Billing</Link>
          <h1 className="font-sans text-2xl font-bold">{locked ? "Invoice" : "Edit draft"} {inv.invoice_number || inv.draft_number}</h1>
          <p className="text-xs text-white/45 capitalize">{inv.status?.replace("_", " ")} · {inv.invoice_kind === "non_gst" ? "Non-GST" : "GST tax invoice"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked ? (
            <button type="button" onClick={persistCore} className="btn-pill text-[10px] !py-2 !px-3" disabled={busy}>
              <AiIcon name="save" className="w-3.5 h-3.5" /> Save draft
            </button>
          ) : null}
          <button type="button" onClick={runReview} className="btn-pill text-[10px] !py-2 !px-3" disabled={busy}>
            <AiIcon name="review" className="w-3.5 h-3.5" /> AI review
          </button>
          <button type="button" onClick={downloadPdf} className="btn-pill text-[10px] !py-2 !px-3">
            <AiIcon name="download" className="w-3.5 h-3.5" /> Download PDF
          </button>
          {!locked ? (
            <button type="button" onClick={finalize} className="btn-solid text-[10px] !py-2 !px-3" disabled={busy}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <AiIcon name="generate" className="w-3.5 h-3.5" />}
              Generate / Finalize
            </button>
          ) : (
            <button type="button" onClick={send} className="btn-solid text-[10px] !py-2 !px-3" disabled={busy}>
              <AiIcon name="send" className="w-3.5 h-3.5" /> Send
            </button>
          )}
        </div>
      </div>

      <p className="font-sans text-[11px] text-white/45 mb-3">
        GST, TDS, SAC/HSN, place-of-supply and other tax treatments depend on the specific transaction and applicable Indian law. Verify the applicable treatment with your tax professional before issuing a final tax invoice.
      </p>

      {!locked ? (
        <form onSubmit={runAiDraft} className="rounded-2xl border border-white/10 bg-[#121212] p-3 mb-3">
          <label className="font-mono text-[9px] uppercase tracking-widest text-white/40 flex items-center gap-1"><AiIcon name="sparkles" className="w-3 h-3" /> Generate with AI</label>
          <div className="flex gap-2 mt-1">
            <input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder='Create an invoice for the smartphone campaign. Two reels and three stories. Total agreed fee ₹1 lakh.' className="flex-1 bg-transparent border-b border-white/15 py-1 font-sans text-sm outline-none" />
            <button type="submit" className="btn-solid text-[10px] px-3" disabled={busy}>Draft</button>
          </div>
          <p className="text-[10px] text-white/35 mt-1">AI will not invent GSTIN, PAN, tax rate, SAC/HSN, or bank details.</p>
        </form>
      ) : null}

      {review ? (
        <div className="rounded-2xl border border-white/10 p-3 mb-3">
          <p className="font-sans text-sm font-semibold">Invoice health {review.health}/100</p>
          <p className="text-xs text-white/60">{review.summary}</p>
          {(review.errors || []).map((e) => <p key={e} className="text-xs text-[#FF3B30] mt-1">{e}</p>)}
          {(review.warnings || []).map((e) => <p key={e} className="text-xs text-[#FF9500] mt-1">{e}</p>)}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3 min-w-0">
          <section className="rounded-2xl border border-white/10 p-3 grid sm:grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">Supplier</p>
              {["legal_name", "address", "state", "state_code", "gstin", "pan"].map((k) => (
                <input key={k} disabled={locked} value={inv.supplier?.[k] || ""} onChange={(e) => setField(`supplier.${k}`, e.target.value)} placeholder={k.replace("_", " ")} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs outline-none" />
              ))}
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">Recipient / Bill to</p>
              {["legal_name", "address", "state", "state_code", "gstin", "pan", "email"].map((k) => (
                <input key={k} disabled={locked} value={inv.recipient?.[k] || ""} onChange={(e) => setField(`recipient.${k}`, e.target.value)} placeholder={k.replace("_", " ")} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs outline-none" />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 p-3 grid sm:grid-cols-3 gap-2">
            <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              Treatment
              <select disabled={locked} value={inv.gst_treatment || "taxable"} onChange={(e) => setField("gst_treatment", e.target.value)} className="mt-1 w-full bg-[#121212] border-b border-white/15 py-1 font-sans text-xs">
                <option value="taxable">GST invoice — taxable</option>
                <option value="zero_rated">GST — zero-rated</option>
                <option value="exempt">GST — exempt</option>
                <option value="nil">GST — nil-rated</option>
                <option value="non_gst">Non-GST invoice</option>
              </select>
            </label>
            <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              GST %
              <input disabled={locked} value={inv.gst_rate ?? ""} onChange={(e) => setField("gst_rate", e.target.value === "" ? null : Number(e.target.value))} placeholder="Do not guess" className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
            </label>
            <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              Place of supply code
              <input disabled={locked} value={inv.place_of_supply?.state_code || inv.place_of_supply_state_code || ""} onChange={(e) => setField("place_of_supply_state_code", e.target.value)} placeholder="e.g. 29" className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
            </label>
            <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              Invoice date
              <input disabled={locked} type="date" value={String(inv.invoice_date || "").slice(0, 10)} onChange={(e) => setField("invoice_date", e.target.value)} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
            </label>
            <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              Due date
              <input disabled={locked} type="date" value={String(inv.due_date || "").slice(0, 10)} onChange={(e) => setField("due_date", e.target.value)} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
            </label>
            <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              Template
              <select disabled={locked} value={inv.template || "professional"} onChange={(e) => setField("template", e.target.value)} className="mt-1 w-full bg-[#121212] border-b border-white/15 py-1 font-sans text-xs">
                <option value="professional">Professional</option>
                <option value="modern">Modern</option>
                <option value="minimal">Minimal</option>
              </select>
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">Line items</p>
              {!locked ? (
                <button type="button" onClick={() => setField("line_items", [...(inv.line_items || []), emptyItem()])} className="text-[10px] inline-flex items-center gap-1"><AiIcon name="create" className="w-3 h-3" /> Add</button>
              ) : null}
            </div>
            <input value={codeQ} onChange={(e) => setCodeQ(e.target.value)} placeholder="Search SAC/HSN (admin-maintained suggestions)" className="w-full bg-transparent border-b border-white/15 py-1 mb-2 font-sans text-xs" />
            {codeQ && filteredCodes.map((c) => (
              <button key={c.id || c.code} type="button" className="block text-left text-[10px] text-white/60 hover:text-white" onClick={() => {
                const items = [...(inv.line_items || [])];
                if (items[0]) items[0] = { ...items[0], sac_hsn: c.code };
                setInv({ ...inv, line_items: items });
                setCodeQ("");
              }}>{c.code} — {c.description}</button>
            ))}
            {(inv.line_items || []).map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 lg:grid-cols-12 gap-2 sm:gap-1 mb-3 sm:mb-2">
                <input disabled={locked} className="col-span-1 sm:col-span-6 lg:col-span-4 bg-transparent border-b border-white/15 py-1 text-xs min-w-0" placeholder="Description" value={it.description || ""} onChange={(e) => {
                  const items = [...inv.line_items]; items[idx] = { ...it, description: e.target.value }; setInv({ ...inv, line_items: items });
                }} />
                <input disabled={locked} className="col-span-1 sm:col-span-2 lg:col-span-2 bg-transparent border-b border-white/15 py-1 text-xs min-w-0" placeholder="SAC/HSN" value={it.sac_hsn || ""} onChange={(e) => {
                  const items = [...inv.line_items]; items[idx] = { ...it, sac_hsn: e.target.value }; setInv({ ...inv, line_items: items });
                }} />
                <input disabled={locked} className="col-span-1 sm:col-span-1 lg:col-span-1 bg-transparent border-b border-white/15 py-1 text-xs min-w-0" placeholder="Qty" value={it.qty} onChange={(e) => {
                  const items = [...inv.line_items]; items[idx] = { ...it, qty: Number(e.target.value) }; setInv({ ...inv, line_items: items });
                }} />
                <input disabled={locked} className="col-span-1 sm:col-span-2 lg:col-span-2 bg-transparent border-b border-white/15 py-1 text-xs min-w-0" placeholder="Rate" value={it.rate} onChange={(e) => {
                  const items = [...inv.line_items]; items[idx] = { ...it, rate: Number(e.target.value) }; setInv({ ...inv, line_items: items });
                }} />
                <select disabled={locked} className="col-span-1 sm:col-span-2 lg:col-span-2 bg-[#121212] border-b border-white/15 py-1 text-xs min-w-0" value={it.discount_kind || ""} onChange={(e) => {
                  const items = [...inv.line_items]; items[idx] = { ...it, discount_kind: e.target.value }; setInv({ ...inv, line_items: items });
                }}>
                  <option value="">No disc.</option>
                  <option value="percent">% disc.</option>
                  <option value="amount">₹ disc.</option>
                </select>
                {!locked ? (
                  <button type="button" className="icon-action col-span-1 sm:col-span-1 lg:col-span-1 justify-self-start" aria-label="Remove line" onClick={() => setInv({ ...inv, line_items: inv.line_items.filter((_, i) => i !== idx) })}>
                    <AiIcon name="trash" className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Invoice discount ₹
                <input disabled={locked} value={inv.discount_value ?? inv.invoice_discount ?? 0} onChange={(e) => setField("discount_value", Number(e.target.value))} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 text-xs" />
              </label>
              <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Payment terms
                <input disabled={locked} value={inv.payment_terms || ""} onChange={(e) => setField("payment_terms", e.target.value)} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 text-xs" />
              </label>
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs">
              <input type="checkbox" disabled={locked} checked={!!inv.tds_applicable} onChange={(e) => setField("tds_applicable", e.target.checked)} />
              TDS applicable
            </label>
            {inv.tds_applicable ? (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input disabled={locked} placeholder="Section e.g. 194J" value={inv.tds_section || ""} onChange={(e) => setField("tds_section", e.target.value)} className="bg-transparent border-b border-white/15 py-1 text-xs" />
                <input disabled={locked} placeholder="TDS %" value={inv.tds_rate ?? ""} onChange={(e) => setField("tds_rate", Number(e.target.value))} className="bg-transparent border-b border-white/15 py-1 text-xs" />
              </div>
            ) : null}
            <p className="text-[10px] text-[#FF9500] mt-2">Verify applicable TDS section/rate before finalizing.</p>
            <button type="button" onClick={persistCore} className="btn-pill text-[10px] !py-2 !px-3 mt-2" disabled={locked || busy}>
              <AiIcon name="refresh" className="w-3.5 h-3.5" /> Recalculate
            </button>
          </section>

          {!locked ? (
            <form onSubmit={assist} className="rounded-2xl border border-white/10 p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 flex items-center gap-1"><AiIcon name="sparkles" className="w-3 h-3" /> Invoice assistant</p>
              <input value={chat} onChange={(e) => setChat(e.target.value)} placeholder='Change the amount to 1.25 lakh' className="mt-1 w-full bg-transparent border-b border-white/15 py-1 text-sm outline-none" />
            </form>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-2 rounded-2xl overflow-auto max-h-[80vh] border border-white/10">
          <InvoicePreview invoice={inv} />
        </div>
      </div>
    </div>
  );
}
