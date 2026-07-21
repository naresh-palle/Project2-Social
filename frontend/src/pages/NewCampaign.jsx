import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Loader2, Upload } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { toast, Toaster } from "sonner";

const NICHES = ["fashion", "luxury", "beauty", "tech", "design", "wellness"];
const PLATFORMS = ["instagram", "facebook", "youtube", "twitter"];

export default function NewCampaign() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({
    title: "", brand: user?.company || "", description: "", budget: 1000,
    deliverables: "", cover: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
  });
  const [niches, setNiches] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const coverRef = useRef(null);
  const change = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const onCoverPick = async (e) => {
    const url = await uploadImage(e.target.files?.[0]);
    if (url) { setF({ ...f, cover: url }); toast.success("Cover uploaded."); }
    e.target.value = "";
  };

  const runAI = async () => {
    if (!aiGoal.trim()) return;
    setAiBusy(true);
    try {
      const { data } = await api.post("/ai/campaign-builder", { goal: aiGoal });
      setF({
        ...f,
        title: data.title || f.title,
        description: data.description || f.description,
        deliverables: data.deliverables || f.deliverables,
        budget: data.budget || f.budget,
      });
      if (Array.isArray(data.niches)) setNiches(data.niches.filter(n => NICHES.includes(n)));
      if (Array.isArray(data.platforms)) setPlatforms(data.platforms.filter(p => PLATFORMS.includes(p)));
      toast.success("Draft ready.");
      setAiOpen(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "AI failed");
    } finally { setAiBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/campaigns", { ...f, budget: Number(f.budget), niches, platforms });
      toast.success("Brief posted.");
      nav(`/campaigns/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  if (!user || user.role !== "owner") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] pt-40 px-10">
        <Nav />
        <h1 className="font-editorial italic text-5xl">Owners only, please.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-3xl mx-auto px-6 md:px-10 pb-24">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ New brief</p>
            <h1 className="font-editorial text-6xl md:text-7xl leading-[1.15] mt-2">
              Write the <span className="italic">brief</span><span className="tick">.</span>
            </h1>
          </div>
          <button onClick={() => setAiOpen(v => !v)} data-testid="ai-toggle" className="btn-pill">
            <Sparkles className="w-4 h-4" /> AI Copilot
          </button>
        </div>

        {aiOpen && (
          <div className="mt-8 hairline-t hairline-b hairline-l hairline-r p-6" data-testid="ai-panel">
            <div className="flex items-baseline gap-3">
              <Sparkles className="w-4 h-4 text-[#FF3B30]" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">AI Brand Copilot</span>
            </div>
            <p className="mt-2 text-sm opacity-70">Describe your goal in one line. We'll draft the brief.</p>
            <textarea rows={3} data-testid="ai-goal" value={aiGoal} onChange={e => setAiGoal(e.target.value)}
              className="mt-3 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
            <div className="mt-4 flex justify-end">
              <button onClick={runAI} disabled={aiBusy} data-testid="ai-generate" className="btn-solid">
                {aiBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Drafting…</> : <>Draft brief <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-10 space-y-8" data-testid="new-campaign-form">
          <Row label="Title"><input required data-testid="cf-title" value={f.title} onChange={change("title")} className="inp" /></Row>
          <Row label="Brand"><input required data-testid="cf-brand" value={f.brand} onChange={change("brand")} className="inp" /></Row>
          <Row label="Description"><textarea required data-testid="cf-desc" value={f.description} onChange={change("description")} rows={5} className="inp resize-none" /></Row>
          <Row label="Deliverables"><input required data-testid="cf-deliv" value={f.deliverables} onChange={change("deliverables")} className="inp" /></Row>
          <Row label="Budget (INR ₹)"><input required type="number" data-testid="cf-budget" value={f.budget} onChange={change("budget")} className="inp" /></Row>
          <Row label="Cover image">
            <div className="flex items-center gap-4 mt-2">
              {f.cover && <img src={f.cover} alt="" className="w-16 h-20 object-cover" />}
              <input data-testid="cf-cover" value={f.cover} onChange={change("cover")} className="inp flex-1" />
              <input ref={coverRef} type="file" accept="image/*" hidden onChange={onCoverPick} data-testid="cf-cover-file" />
              <button type="button" onClick={() => coverRef.current?.click()} className="btn-pill text-[10px]" data-testid="cf-cover-upload">
                <Upload className="w-3 h-3" /> Upload
              </button>
            </div>
          </Row>
          <Row label="Niches">
            <div className="flex flex-wrap gap-2 mt-2">
              {NICHES.map(n => (
                <button type="button" key={n} data-testid={`niche-toggle-${n}`} onClick={() => toggle(niches, setNiches, n)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase ${
                    niches.includes(n) ? "bg-[#FF3B30] text-[#F4F4F0]" : "hairline-t hairline-b hairline-l hairline-r"}`}>{n}</button>
              ))}
            </div>
          </Row>
          <Row label="Platforms">
            <div className="flex flex-wrap gap-2 mt-2">
              {PLATFORMS.map(n => (
                <button type="button" key={n} data-testid={`platform-toggle-${n}`} onClick={() => toggle(platforms, setPlatforms, n)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase ${
                    platforms.includes(n) ? "bg-[#FF3B30] text-[#F4F4F0]" : "hairline-t hairline-b hairline-l hairline-r"}`}>{n}</button>
              ))}
            </div>
          </Row>
          <button disabled={busy} className="btn-solid w-full justify-center" data-testid="cf-submit">
            {busy ? "Posting…" : <>Post the brief <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
      <style>{`.inp { margin-top: 0.5rem; width: 100%; background: transparent; border-bottom: 1px solid rgba(244,244,240,0.14); padding: 0.75rem 0; outline: none; font-size: 1.05rem; color: #F4F4F0; }
      .inp:focus { border-color: #FF3B30; }`}</style>
    </div>
  );
}

function Row({ label, children }) {
  return <div><label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">{label}</label>{children}</div>;
}
