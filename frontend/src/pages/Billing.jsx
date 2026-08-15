import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Download, Eye, Copy, Send, Ban, Trash2 } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { InvoicePreview, inr } from "@/components/InvoicePreview";
import { useAuth } from "@/lib/auth";

const STATUS = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled"];

function statusCls(s) {
  if (s === "paid") return "text-[#34C759]";
  if (s === "overdue" || s === "cancelled") return "text-[#FF3B30]";
  if (s === "draft") return "text-white/45";
  return "text-[#FF9500]";
}

export default function Billing() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const box = params.get("box") || (user?.role === "owner" ? "received" : "issued");
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [demo, setDemo] = useState(params.get("demo") === "1");
  const [demoPack, setDemoPack] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [{ data: s }, { data: list }] = await Promise.all([
        api.get("/invoices/summary", { params: { box } }),
        api.get("/invoices", { params: { box, q, status, limit: 40 } }),
      ]);
      setSummary(s);
      setRows(list.items || []);
      setTotal(list.total || 0);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not load invoices");
    }
  };

  useEffect(() => { load(); }, [box, q, status]);

  useEffect(() => {
    if (!demo) { setDemoPack(null); return; }
    api.get("/invoices/demo").then(({ data }) => setDemoPack(data)).catch(() => {});
  }, [demo]);

  const act = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Action failed");
    } finally { setBusy(false); }
  };

  const cards = summary?.cards || {};
  const cardOrder = [
    ["Total Invoiced", cards.total],
    ["Paid", cards.paid],
    ["Pending", cards.pending],
    ["Overdue", cards.overdue],
    ["Draft", cards.draft],
    ["Cancelled", cards.cancelled],
  ];

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] pb-24" data-testid="billing-page">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3 mb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
            <AiIcon name="wallet" className="w-3.5 h-3.5" /> Billing
          </p>
          <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Billing & Invoices</h1>
          <p className="font-sans text-xs text-white/50 mt-1 max-w-xl">
            GST, TDS, SAC/HSN, place-of-supply and other tax treatments depend on the specific transaction and applicable Indian law. Verify with your tax professional before issuing a final tax invoice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/billing/settings" className="btn-pill text-[10px]">Settings</Link>
          <button
            type="button"
            onClick={() => { setDemo((v) => !v); setParams((p) => { const n = new URLSearchParams(p); if (!demo) n.set("demo", "1"); else n.delete("demo"); return n; }); }}
            className={`btn-pill text-[10px] ${demo ? "border-[#FF3B30] text-[#FF3B30]" : ""}`}
          >
            Demo data
          </button>
          <Link to="/billing/new" className="btn-solid text-[10px] inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Create invoice
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {["issued", "received"].map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set("box", b); return n; })}
            className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${box === b ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15 text-white/50"}`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        {cardOrder.map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#121212] p-3">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">{label}</div>
            <div className="font-sans text-lg font-bold tabular-nums mt-1">{inr(v?.amount)}</div>
            <div className="font-mono text-[9px] text-white/35">{v?.count || 0}</div>
          </div>
        ))}
      </div>

      {demo && demoPack ? (
        <div className="rounded-2xl border border-[#FF3B30]/40 bg-[#FF3B30]/5 p-4 mb-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30] font-bold">DEMO DATA — not saved to production</p>
          <p className="font-sans text-xs text-white/60 mt-1">{demoPack.note}</p>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div className="text-xs">
              <p><span className="text-white/40">Creator</span> {demoPack.creator?.trade_name} · {demoPack.creator?.gstin}</p>
              <p><span className="text-white/40">Company</span> {demoPack.company?.legal_name} · {demoPack.company?.gstin}</p>
              <p><span className="text-white/40">Campaign</span> {demoPack.campaign?.name} ({demoPack.campaign?.campaign_id})</p>
              <p className="mt-2">{demoPack.invoice?.invoice_number} · {inr(demoPack.invoice?.grand_total)} · GST {inr(demoPack.invoice?.total_gst)}</p>
              <p className="text-[#FF9500] mt-1">Example GSTIN checksum: supplier {demoPack.gstin_valid_supplier ? "valid format" : "invalid (intentional demo)"} / recipient {demoPack.gstin_valid_recipient ? "valid format" : "invalid (intentional demo)"}</p>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-xl">
              <InvoicePreview invoice={{ ...demoPack.invoice, supplier: demoPack.creator, recipient: demoPack.company, campaign: demoPack.campaign, template: "professional" }} demo />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, client, campaign" className="bg-transparent border border-white/15 rounded-full px-3 py-1 font-sans text-xs w-56" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-[#121212] border border-white/15 rounded-full px-3 py-1 font-sans text-xs">
          <option value="">All statuses</option>
          {STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-white/40">{total} invoices</span>
      </div>

      <div className="rounded-2xl border border-white/10 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="font-mono text-[9px] uppercase tracking-widest text-white/40">
            <tr>
              {["Invoice", "Client", "Campaign", "Date", "Due", "Amount", "GST", "Status", ""].map((h) => (
                <th key={h} className="p-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-white/45">No invoices yet. Create one or generate from a completed campaign.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="p-3 font-mono text-[11px]">{r.invoice_number}</td>
                <td className="p-3">{r.client}</td>
                <td className="p-3 text-white/60">{r.campaign || "—"}</td>
                <td className="p-3">{String(r.invoice_date || "").slice(0, 10)}</td>
                <td className="p-3">{String(r.due_date || "").slice(0, 10)}</td>
                <td className="p-3 tabular-nums">{inr(r.amount)}</td>
                <td className="p-3 tabular-nums">{inr(r.gst)}</td>
                <td className={`p-3 capitalize ${statusCls(r.status)}`}>{String(r.status || "").replace("_", " ")}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Link to={`/billing/${r.id}`} className="p-1 opacity-70 hover:opacity-100" title="View"><Eye className="w-3.5 h-3.5" /></Link>
                    {r.status === "draft" ? <Link to={`/billing/${r.id}/edit`} className="p-1 opacity-70" title="Edit">Edit</Link> : null}
                    <button type="button" disabled={busy} title="Duplicate" onClick={() => act(() => api.post(`/invoices/${r.id}/duplicate`), "Duplicated")} className="p-1 opacity-70"><Copy className="w-3.5 h-3.5" /></button>
                    <a href={`${api.defaults.baseURL}/invoices/${r.id}/pdf`} onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const res = await api.get(`/invoices/${r.id}/pdf`, { responseType: "blob" });
                        const url = URL.createObjectURL(res.data);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${r.invoice_number || "invoice"}.pdf`; a.click();
                      } catch (err) { toast.error("PDF failed"); }
                    }} className="p-1 opacity-70" title="PDF"><Download className="w-3.5 h-3.5" /></a>
                    {r.status !== "draft" && r.status !== "cancelled" && r.status !== "paid" ? (
                      <button type="button" disabled={busy} title="Mark paid" onClick={() => act(() => api.post(`/invoices/${r.id}/mark-paid`, {}), "Marked paid")} className="p-1 opacity-70"><Send className="w-3.5 h-3.5" /></button>
                    ) : null}
                    {r.status !== "cancelled" && r.status !== "draft" ? (
                      <button type="button" disabled={busy} title="Cancel" onClick={() => act(() => api.post(`/invoices/${r.id}/cancel`), "Cancelled")} className="p-1 opacity-70"><Ban className="w-3.5 h-3.5" /></button>
                    ) : null}
                    {r.status === "draft" ? (
                      <button type="button" disabled={busy} title="Delete draft" onClick={() => act(() => api.delete(`/invoices/${r.id}`), "Draft deleted")} className="p-1 opacity-70"><Trash2 className="w-3.5 h-3.5" /></button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
