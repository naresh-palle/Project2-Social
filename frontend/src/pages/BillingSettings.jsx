import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AiIcon } from "@/components/AiIcon";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { useAuth } from "@/lib/auth";

export default function BillingSettings() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [bankReveal, setBankReveal] = useState(false);
  const [codes, setCodes] = useState([]);
  const [newCode, setNewCode] = useState({ code: "", kind: "SAC", description: "" });

  const load = async (reveal = false) => {
    const { data } = await api.get("/billing/settings", { params: { reveal_bank: reveal } });
    setS(data);
    setBankReveal(reveal);
  };

  useEffect(() => {
    load(false).catch((e) => toast.error(formatApiError(e?.response?.data?.detail) || "Settings failed"));
    api.get("/invoices/tax-codes").then(({ data }) => setCodes(data.items || [])).catch(() => {});
  }, []);

  const save = async (e) => {
    e?.preventDefault();
    try {
      const { data } = await api.put("/billing/settings", s);
      setS(data);
      toast.success("Billing settings saved");
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "Save failed");
    }
  };

  const uploadAsset = async (field, file) => {
    const url = await uploadImage(file);
    if (!url) return;
    const id = String(url).split("/").pop();
    setS((prev) => ({ ...prev, [field]: id }));
    toast.success("Uploaded — save settings to keep it");
  };

  if (!s) return <div className="py-16 text-center font-mono text-xs uppercase tracking-widest opacity-50">Loading billing settings…</div>;

  return (
    <form onSubmit={save} className="w-full pb-24 max-w-3xl">
      <Link to="/billing" className="font-mono text-[10px] uppercase tracking-widest text-white/40">← Billing</Link>
      <h1 className="font-sans text-2xl font-bold mt-1 flex items-center gap-2">
        <AiIcon name="settings" className="w-6 h-6" /> Billing Settings
      </h1>
      <p className="text-xs text-white/45 mt-1">{s.disclaimer}</p>
      <p className="text-xs text-white/50 mt-1">Next number: <span className="font-mono">{s.next_invoice_number}</span></p>

      <section className="mt-6 rounded-2xl border border-white/10 p-4 space-y-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40">Business details</h2>
        {[["legal_name", "Legal name"], ["trade_name", "Trade name"], ["address", "Address"], ["city", "City"], ["state", "State"], ["state_code", "State code"], ["pincode", "PIN"], ["gstin", "GSTIN"], ["pan", "PAN"], ["email", "Email"], ["phone", "Phone"]].map(([k, lab]) => (
          <label key={k} className="block font-mono text-[9px] uppercase tracking-widest text-white/40">
            {lab}
            <input value={s[k] || ""} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm outline-none" />
          </label>
        ))}
        {s.gstin ? <p className="text-[10px] text-white/40">GSTIN format: {s.gstin_format_ok ? "looks valid" : "appears invalid — verify before issuing"}</p> : null}
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 p-4 space-y-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40">Invoice numbering</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Prefix
            <input value={s.prefix || ""} onChange={(e) => setS({ ...s, prefix: e.target.value })} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm" />
          </label>
          <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Financial year
            <input value={s.financial_year || ""} onChange={(e) => setS({ ...s, financial_year: e.target.value })} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm" />
          </label>
          <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Starting number
            <input value={s.starting_number || 1} onChange={(e) => setS({ ...s, starting_number: Number(e.target.value) })} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm" />
          </label>
          <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Default terms
            <input value={s.default_payment_terms || ""} onChange={(e) => setS({ ...s, default_payment_terms: e.target.value })} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm" />
          </label>
        </div>
        <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Default template
          <select value={s.default_template || "professional"} onChange={(e) => setS({ ...s, default_template: e.target.value })} className="mt-1 w-full bg-[#121212] border-b border-white/15 py-1 font-sans text-sm">
            <option value="professional">Professional</option>
            <option value="modern">Modern</option>
            <option value="minimal">Minimal</option>
          </select>
        </label>
        <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Rounding
          <select value={s.rounding || "nearest_rupee"} onChange={(e) => setS({ ...s, rounding: e.target.value })} className="mt-1 w-full bg-[#121212] border-b border-white/15 py-1 font-sans text-sm">
            <option value="nearest_rupee">Nearest rupee</option>
            <option value="none">None (paise)</option>
          </select>
        </label>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 p-4 space-y-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40">Tax & TDS (configurable — not advice)</h2>
        <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">Default GST %
          <input value={s.default_gst_rate ?? ""} onChange={(e) => setS({ ...s, default_gst_rate: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Leave blank — do not guess" className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm" />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={!!s.default_tds_applicable} onChange={(e) => setS({ ...s, default_tds_applicable: e.target.checked })} />
          TDS applicable by default
        </label>
        <input value={s.default_tds_section || ""} onChange={(e) => setS({ ...s, default_tds_section: e.target.value })} placeholder="TDS section" className="w-full bg-transparent border-b border-white/15 py-1 text-sm" />
        <input value={s.default_tds_rate ?? ""} onChange={(e) => setS({ ...s, default_tds_rate: e.target.value === "" ? null : Number(e.target.value) })} placeholder="TDS %" className="w-full bg-transparent border-b border-white/15 py-1 text-sm" />
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 p-4 space-y-2">
        <div className="flex justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40">Payment</h2>
          <button type="button" className="text-[10px] font-mono uppercase tracking-widest text-white/40" onClick={() => load(!bankReveal)}>{bankReveal ? "Mask" : "Reveal"} account</button>
        </div>
        {["bank_name", "account_holder", "account_number", "ifsc", "branch", "upi_id", "payment_instructions"].map((k) => (
          <input key={k} value={s.bank?.[k] || ""} onChange={(e) => setS({ ...s, bank: { ...(s.bank || {}), [k]: e.target.value } })} placeholder={k.replaceAll("_", " ")} className="w-full bg-transparent border-b border-white/15 py-1 font-sans text-sm" />
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 p-4 space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40">Branding</h2>
        <label className="text-xs block">Logo (PNG/JPG)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadAsset("logo_file_id", e.target.files?.[0])} className="mt-1 text-xs" />
        </label>
        <label className="text-xs block">Signature image
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadAsset("signature_file_id", e.target.files?.[0])} className="mt-1 text-xs" />
        </label>
        <input value={s.signatory_name || ""} onChange={(e) => setS({ ...s, signatory_name: e.target.value })} placeholder="Signatory name" className="w-full bg-transparent border-b border-white/15 py-1 text-sm" />
        <input value={s.signatory_designation || ""} onChange={(e) => setS({ ...s, signatory_designation: e.target.value })} placeholder="Designation" className="w-full bg-transparent border-b border-white/15 py-1 text-sm" />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={s.stamp_enabled !== false} onChange={(e) => setS({ ...s, stamp_enabled: e.target.checked })} />
          Enable stamp
        </label>
        <label className="text-xs block">Stamp image (your own — not a government seal)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadAsset("stamp_file_id", e.target.files?.[0])} className="mt-1 text-xs" />
        </label>
        <textarea value={s.terms || ""} onChange={(e) => setS({ ...s, terms: e.target.value })} placeholder="Terms" className="w-full bg-transparent border border-white/15 rounded-xl p-2 text-sm min-h-[80px]" />
      </section>

      {user?.role === "admin" ? (
        <section className="mt-4 rounded-2xl border border-white/10 p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40">Tax classifications (admin)</h2>
          <p className="text-[10px] text-white/40 mb-2">Update SAC/HSN without changing application code. These are suggestions, not legal classifications.</p>
          <div className="flex gap-2 mb-2">
            <input value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} placeholder="Code" className="flex-1 bg-transparent border-b border-white/15 py-1 text-xs" />
            <input value={newCode.description} onChange={(e) => setNewCode({ ...newCode, description: e.target.value })} placeholder="Description" className="flex-[2] bg-transparent border-b border-white/15 py-1 text-xs" />
            <button type="button" className="btn-pill text-[10px] !py-2 !px-3" onClick={async () => {
              try {
                await api.post("/invoices/tax-codes", newCode);
                const { data } = await api.get("/invoices/tax-codes");
                setCodes(data.items || []);
                setNewCode({ code: "", kind: "SAC", description: "" });
              } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
            }}>Add</button>
          </div>
          <ul className="text-xs space-y-1 max-h-40 overflow-auto">
            {codes.map((c) => <li key={c.id || c.code} className="font-mono text-[10px]">{c.code} · {c.description}</li>)}
          </ul>
        </section>
      ) : null}

      <button type="submit" className="btn-solid mt-6 text-[11px] px-5 inline-flex items-center gap-2">
        <AiIcon name="save" className="w-3.5 h-3.5" /> Save settings
      </button>
    </form>
  );
}
