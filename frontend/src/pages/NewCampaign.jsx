import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { ArrowRight, Sparkles, Loader2, Upload, X } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { toast } from "sonner";

const NICHES = ["fashion", "luxury", "beauty", "tech", "design", "wellness", "lifestyle"];
const PLATFORMS = ["facebook", "instagram", "twitter", "youtube"];
const INFLUENCER_TYPES = ["Nano", "Micro", "Macro", "Mega", "Celebrity"];
const EXPERIENCE_OPTS = ["Any", "1+ years", "2+ years", "3+ years", "5+ years"];

export default function NewCampaign({ isEdit }) {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const brandLocked = user?.role === "owner";
  const [f, setF] = useState({
    title: "",
    brand: user?.company || user?.name || "",
    description: "",
    budget: 15000,
    deliverables: "1x Dedicated Reel / Post + 2x Instagram Stories with Swipe-up Link",
    cover: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
    location: "",
    timeline: "",
    min_followers: 10000,
    influencer_location: "",
    influencer_experience: "Any",
    influencer_type: "Micro",
    min_reach: "",
    min_engagement: "",
  });
  const [niches, setNiches] = useState(["fashion", "lifestyle"]);
  const [platforms, setPlatforms] = useState(["instagram"]);
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const coverRef = useRef(null);
  const change = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") nav("/dashboard");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nav]);

  useEffect(() => {
    if (isEdit && id) {
      api.get(`/campaigns/${id}`)
        .then((res) => {
          const c = res.data;
          setF({
            title: c.title || "",
            brand: c.brand || "",
            description: c.description || "",
            budget: c.budget || 15000,
            deliverables: c.deliverables || "",
            cover: c.cover || "",
            location: c.location || "",
            timeline: c.timeline || "",
            min_followers: c.min_followers || 10000,
            influencer_location: c.influencer_location || "",
            influencer_experience: c.influencer_experience || "Any",
            influencer_type: c.influencer_type || "Micro",
            min_reach: c.min_reach || "",
            min_engagement: c.min_engagement || "",
          });
          if (c.niches) setNiches(c.niches);
          if (c.platforms) setPlatforms(c.platforms);
        })
        .catch(() => toast.error("Failed to load campaign"));
    }
  }, [isEdit, id]);

  const onCoverPick = async (e) => {
    const url = await uploadImage(e.target.files?.[0]);
    if (url) {
      setF({ ...f, cover: url });
      toast.success("Cover uploaded.");
    }
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
      if (Array.isArray(data.niches)) setNiches(data.niches.filter((n) => NICHES.includes(n)));
      if (Array.isArray(data.platforms)) setPlatforms(data.platforms.filter((p) => PLATFORMS.includes(p)));
      toast.success("Draft ready.");
      setAiOpen(false);
    } catch (e) {
      console.warn("AI backend failed, using fallback mock data:", e);
      // Fallback for wsarecv issues or missing API key
      const mockData = {
        title: "Brand Awareness Campaign",
        description: `Looking for creators to help promote: ${aiGoal}. This will be a high-energy campaign focused on organic engagement.`,
        deliverables: "1 Instagram Reel + 2 Story Highlights",
        budget: 50000,
        niches: ["Lifestyle", "Tech"],
        platforms: ["Instagram"]
      };
      setF({
        ...f,
        title: mockData.title,
        description: mockData.description,
        deliverables: mockData.deliverables,
        budget: mockData.budget,
      });
      setNiches(mockData.niches);
      setPlatforms(mockData.platforms);
      toast.success("Draft ready (Mock Fallback).");
      setAiOpen(false);
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...f,
        brand: brandLocked ? user?.company || f.brand : f.brand,
        budget: Number(f.budget),
        min_followers: f.min_followers ? Number(f.min_followers) : null,
        niches,
        platforms,
      };
      
      let data;
      if (isEdit && id) {
        const res = await api.put(`/campaigns/${id}`, payload);
        data = res.data;
        toast.success("Brief updated.");
      } else {
        const res = await api.post("/campaigns", payload);
        data = res.data;
        toast.success("Brief posted.");
      }
      nav(`/campaigns/${data.id}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user || !["owner", "agent", "admin"].includes(user.role)) {
    return (
      <div className="min-h-[50vh] bg-[#0B0B0E] text-[#F4F4F0] pt-6 px-4">
        
        <h1 className="font-sans text-2xl font-bold tracking-tight">Brand Owners, Agents &amp; Admins only, please</h1>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0]">
      
      
      <div className="pt-1 max-w-3xl mx-auto px-1 sm:px-4 md:px-6 pb-16 relative">
        <button
          type="button"
          onClick={() => nav("/dashboard")}
          className="absolute top-0 right-0 p-2 bg-[#1A1A1A] border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-xl transition-all duration-300 z-20"
          title="Cancel / Close (Esc)"
          data-testid="new-campaign-cancel-btn"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] tracking-[0.22em] uppercase opacity-60">§ New brief</p>
            <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight leading-tight mt-1">
              Write the <span className="italic">brief</span>
            </h1>
          </div>
          <button onClick={() => setAiOpen((v) => !v)} data-testid="ai-toggle" className="btn-pill text-xs">
            <AiIcon name="sparkles" className="w-3.5 h-3.5" /> AI Copilot
          </button>
        </div>

        {aiOpen && (
          <div className="mt-4 border border-white/10 p-4 rounded-3xl" data-testid="ai-panel">
            <div className="flex items-baseline gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FF3B30]" />
              <span className="font-sans text-[10px] tracking-[0.22em] uppercase opacity-70">AI Brand Copilot</span>
            </div>
            <p className="mt-1 text-xs opacity-70">Describe your goal in one line. We&apos;ll draft the brief.</p>
            <textarea
              rows={2}
              data-testid="ai-goal"
              value={aiGoal}
              onChange={(e) => setAiGoal(e.target.value)}
              className="mt-2 w-full bg-transparent border-b border-white/15 py-2 focus:outline-none focus:border-[#FF3B30] resize-none text-sm"
            />
            <div className="mt-3 flex justify-end">
              <button onClick={runAI} disabled={aiBusy} data-testid="ai-generate" className="btn-solid text-xs">
                {aiBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting…
                  </>
                ) : (
                  <>
                    Draft brief <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4" data-testid="new-campaign-form">
          <Row label="Title">
            <input required data-testid="cf-title" value={f.title} onChange={change("title")} className="inp" />
          </Row>
          <Row label="Brand">
            <input
              required
              data-testid="cf-brand"
              value={f.brand}
              onChange={change("brand")}
              className={`inp ${brandLocked ? "opacity-80 cursor-not-allowed" : ""}`}
              readOnly={brandLocked}
              disabled={brandLocked}
              title={brandLocked ? "Brand name is locked for company accounts" : undefined}
            />
          </Row>
          <Row label="Description">
            <textarea required data-testid="cf-desc" value={f.description} onChange={change("description")} rows={3} className="inp resize-none" />
          </Row>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Row label="Campaign location">
              <input data-testid="cf-location" value={f.location} onChange={change("location")} placeholder="e.g. Mumbai, Metro India" className="inp" />
            </Row>
            <Row label="Timeline for the campaign">
              <input data-testid="cf-timeline" value={f.timeline} onChange={change("timeline")} placeholder="e.g. 2–3 weeks / Apr 10–30" className="inp" />
            </Row>
            <Row label="Minimum followers">
              <input required type="number" min="0" data-testid="cf-min-followers" value={f.min_followers} onChange={change("min_followers")} className="inp" />
            </Row>
            <Row label="Influencers from location">
              <input data-testid="cf-inf-location" value={f.influencer_location} onChange={change("influencer_location")} placeholder="e.g. Mumbai, Delhi NCR" className="inp" />
            </Row>
            <Row label="Type of influencers">
              <select data-testid="cf-inf-type" value={f.influencer_type} onChange={change("influencer_type")} className="inp bg-[#0B0B0E]">
                {INFLUENCER_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#0B0B0E]">
                    {t}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Past experience of influencers">
              <select data-testid="cf-inf-exp" value={f.influencer_experience} onChange={change("influencer_experience")} className="inp bg-[#0B0B0E]">
                {EXPERIENCE_OPTS.map((t) => (
                  <option key={t} value={t} className="bg-[#0B0B0E]">
                    {t}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Influencer reach (min)">
              <input data-testid="cf-min-reach" value={f.min_reach} onChange={change("min_reach")} placeholder="e.g. 50K+ average reach" className="inp" />
            </Row>
            <Row label="Engagement (min)">
              <input data-testid="cf-min-engagement" value={f.min_engagement} onChange={change("min_engagement")} placeholder="e.g. 3%+ ER" className="inp" />
            </Row>
          </div>
          <Row label="Deliverables">
            <input required data-testid="cf-deliv" value={f.deliverables} onChange={change("deliverables")} className="inp" />
          </Row>
          <Row label="Budget (INR ₹)">
            <input required type="number" data-testid="cf-budget" value={f.budget} onChange={change("budget")} className="inp" />
          </Row>
          <Row label="Cover Image *">
            <div className="flex items-center gap-3 mt-2">
              {f.cover && <img src={f.cover} alt="Cover Preview" className="w-16 h-20 object-cover border border-white/20 p-0.5 rounded-3xl" />}
              <input ref={coverRef} type="file" accept="image/*" hidden onChange={onCoverPick} data-testid="cf-cover-file" />
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="btn-solid bg-white/10 hover:bg-[#FF3B30] text-white px-3 py-2 text-xs flex items-center gap-2"
                data-testid="cf-cover-upload"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Cover Image
              </button>
            </div>
          </Row>
          <Row label="Niches">
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {NICHES.map((n) => (
                <button
                  type="button"
                  key={n}
                  data-testid={`niche-toggle-${n}`}
                  onClick={() => toggle(niches, setNiches, n)}
                  className={`px-3 py-1 rounded-full font-sans text-[10px] tracking-[0.16em] uppercase ${
                    niches.includes(n) ? "bg-[#FF3B30] text-[#F4F4F0]" : "border border-white/15"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Platforms">
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PLATFORMS.map((n) => (
                <button
                  type="button"
                  key={n}
                  data-testid={`platform-toggle-${n}`}
                  onClick={() => toggle(platforms, setPlatforms, n)}
                  className={`px-3 py-1 rounded-full font-sans text-[10px] tracking-[0.16em] uppercase ${
                    platforms.includes(n) ? "bg-[#FF3B30] text-[#F4F4F0]" : "border border-white/15"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Row>
          <button disabled={busy} className="btn-solid w-full justify-center text-xs" data-testid="cf-submit">
            {busy ? (
              "Posting…"
            ) : (
              <>
                Post the brief <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
      <style>{`.inp { margin-top: 0.25rem; width: 100%; background: transparent; border-bottom: 1px solid var(--border-soft); padding: 0.45rem 0; outline: none; font-size: 0.95rem; color: var(--fg); }
      .inp:focus { border-color: #FF3B30; }
      .inp:disabled { opacity: 0.75; }`}</style>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <label className="font-sans text-[10px] tracking-[0.18em] uppercase opacity-60">{label}</label>
      {children}
    </div>
  );
}
