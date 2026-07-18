import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, Plus, X } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

const NICHES = ["fashion", "luxury", "beauty", "tech", "design", "wellness"];
const PLATFORMS = ["instagram", "tiktok", "youtube", "twitter"];

export default function ProfileEdit() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setF({
        name: user.name || "",
        bio: user.bio || "",
        avatar: user.avatar || "",
        handle: user.handle || "",
        company: user.company || "",
        industry: user.industry || "",
        website: user.website || "",
        niches: user.niches || [],
        platforms: user.platforms || [],
        followers: user.followers || 0,
        location: user.location || "",
        portfolio: user.portfolio || [],
        rate_card: user.rate_card || {},
      });
    }
  }, [user]);

  if (!user) return null;
  if (!f) return null;
  const isCreator = user.role === "influencer";

  const toggle = (key, val) =>
    setF({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] });

  const addPortfolio = () => setF({ ...f, portfolio: [...f.portfolio, ""] });
  const setPortfolio = (i, v) => setF({ ...f, portfolio: f.portfolio.map((p, j) => j === i ? v : p) });
  const removePortfolio = (i) => setF({ ...f, portfolio: f.portfolio.filter((_, j) => j !== i) });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/auth/me", {
        ...f,
        followers: Number(f.followers) || null,
        portfolio: f.portfolio.filter(Boolean),
      });
      await refresh();
      toast.success("Profile saved.");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-3xl mx-auto px-6 md:px-10 pb-24">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Edit profile</p>
        <h1 className="font-editorial text-6xl md:text-7xl leading-none mt-2">
          Your <span className="italic">file</span><span className="tick">.</span>
        </h1>

        <motion.form onSubmit={submit} className="mt-12 space-y-8" data-testid="profile-form"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <F label="Name"><input required data-testid="pf-name" className="inp" value={f.name} onChange={e=>setF({...f,name:e.target.value})} /></F>
          {isCreator ? (
            <F label="Handle"><input data-testid="pf-handle" className="inp" value={f.handle} onChange={e=>setF({...f,handle:e.target.value})} placeholder="@yourhandle" /></F>
          ) : (
            <>
              <F label="Company"><input data-testid="pf-company" className="inp" value={f.company} onChange={e=>setF({...f,company:e.target.value})} /></F>
              <F label="Industry"><input data-testid="pf-industry" className="inp" value={f.industry} onChange={e=>setF({...f,industry:e.target.value})} /></F>
              <F label="Website"><input data-testid="pf-website" className="inp" value={f.website} onChange={e=>setF({...f,website:e.target.value})} /></F>
            </>
          )}
          <F label="Bio"><textarea data-testid="pf-bio" rows={4} className="inp resize-none" value={f.bio} onChange={e=>setF({...f,bio:e.target.value})} placeholder="Say something worth reading." /></F>
          <F label="Avatar URL"><input data-testid="pf-avatar" className="inp" value={f.avatar} onChange={e=>setF({...f,avatar:e.target.value})} /></F>
          <F label="Location"><input data-testid="pf-location" className="inp" value={f.location} onChange={e=>setF({...f,location:e.target.value})} placeholder="City, Country" /></F>

          {isCreator && (
            <>
              <F label="Followers (total)"><input type="number" data-testid="pf-followers" className="inp" value={f.followers} onChange={e=>setF({...f,followers:e.target.value})} /></F>
              <F label="Niches">
                <div className="flex flex-wrap gap-2 mt-2">
                  {NICHES.map(n => (
                    <button type="button" key={n} data-testid={`pf-niche-${n}`} onClick={()=>toggle("niches",n)}
                      className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase ${
                        f.niches.includes(n) ? "bg-[#FF3B30] text-[#F4F4F0]" : "hairline-t hairline-b hairline-l hairline-r"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </F>
              <F label="Platforms">
                <div className="flex flex-wrap gap-2 mt-2">
                  {PLATFORMS.map(n => (
                    <button type="button" key={n} data-testid={`pf-platform-${n}`} onClick={()=>toggle("platforms",n)}
                      className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase ${
                        f.platforms.includes(n) ? "bg-[#FF3B30] text-[#F4F4F0]" : "hairline-t hairline-b hairline-l hairline-r"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </F>
              <F label="Portfolio image URLs">
                <div className="space-y-2 mt-2">
                  {f.portfolio.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input data-testid={`pf-portfolio-${i}`} className="inp flex-1" value={p} onChange={e=>setPortfolio(i,e.target.value)} placeholder="https://..." />
                      <button type="button" onClick={()=>removePortfolio(i)} className="p-2 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addPortfolio} className="btn-pill mt-2" data-testid="pf-add-portfolio">
                    <Plus className="w-4 h-4" /> Add image
                  </button>
                </div>
              </F>
              <F label="Rate card (USD)">
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {["reel", "story", "post", "video"].map(k => (
                    <div key={k}>
                      <label className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{k}</label>
                      <input type="number" data-testid={`pf-rate-${k}`} className="inp"
                        value={f.rate_card[k] || ""}
                        onChange={e=>setF({...f, rate_card: {...f.rate_card, [k]: Number(e.target.value)}})} />
                    </div>
                  ))}
                </div>
              </F>
            </>
          )}

          <button disabled={busy} className="btn-solid" data-testid="pf-submit">
            <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save profile"}
          </button>
        </motion.form>
      </div>
      <Footer />
      <style>{`.inp { margin-top: 0.5rem; width: 100%; background: transparent; border-bottom: 1px solid rgba(244,244,240,0.14); padding: 0.75rem 0; outline: none; font-size: 1.05rem; color: #F4F4F0; }
      .inp:focus { border-color: #FF3B30; }`}</style>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">{label}</label>
      {children}
    </div>
  );
}
