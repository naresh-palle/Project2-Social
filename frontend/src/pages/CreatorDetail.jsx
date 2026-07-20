import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Sparkles, Star, MessageSquare, Loader2, Play } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast, Toaster } from "sonner";

export default function CreatorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [myCamps, setMyCamps] = useState([]);
  const [inv, setInv] = useState({ campaign_id: "", offer: 0, message: "" });
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    api.get(`/creators/${id}`).then((r) => setC(r.data)).catch(() => setC(false));
    api.get(`/reviews?target_id=${id}`).then((r) => setReviews(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (user?.role === "owner") api.get("/campaigns?mine=true").then(r => setMyCamps(r.data));
  }, [user]);

  const sendInvite = async () => {
    try {
      await api.post("/invitations", {
        creator_id: id, campaign_id: inv.campaign_id,
        offer: Number(inv.offer), message: inv.message,
      });
      toast.success("Invitation sent.");
      setInviteOpen(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  const openChat = async () => {
    try {
      const camp = myCamps[0];
      if (!camp) { toast.error("Create a campaign first"); return; }
      const { data } = await api.post("/conversations/open", null, { params: { campaign_id: camp.id, creator_id: id } });
      nav(`/messages?id=${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  const runMatch = async (campaign_id) => {
    setAiBusy(true); setAi(null);
    try {
      const { data } = await api.post("/ai/match-score", { creator_id: id, campaign_id });
      setAi(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "AI failed");
    } finally { setAiBusy(false); }
  };

  if (c === false) return <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] pt-40 px-10"><Nav /><h1 className="font-editorial italic text-5xl">Creator not on file.</h1></div>;
  if (!c) return <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex items-center justify-center"><span className="font-mono text-xs tracking-widest uppercase opacity-60">Curating…</span></div>;

  const isOwner = user?.role === "owner";
  
  // Create a stunning first name / last name split for the typographic hero
  const nameParts = c.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] selection:bg-[#FF3B30] selection:text-white pb-24">
      <Nav />
      <Toaster theme="dark" position="top-center" />

      {/* Hero Cinematic Section */}
      <div className="relative w-full h-[80vh] min-h-[600px] flex items-end justify-center overflow-hidden">
        {/* Full-bleed background image from portfolio or avatar */}
        <div className="absolute inset-0 z-0">
           <img 
             src={(c.portfolio && c.portfolio[0]) || c.avatar || "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd"} 
             alt="Hero" 
             className="w-full h-full object-cover opacity-60 scale-105"
           />
           {/* Heavy bottom gradient so text is readable */}
           <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
           <div className="grain" />
        </div>

        <div className="relative z-10 w-full max-w-[1600px] px-6 md:px-10 pb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}>
                <p className="font-mono text-[10px] tracking-[0.4em] uppercase opacity-70 mb-4 ml-1">PORTFOLIO.01</p>
                <h1 className="font-editorial text-7xl md:text-[9rem] leading-[0.9] tracking-tight">
                   {firstName} <span className="italic text-[#FF3B30]">{lastName}</span>
                </h1>
                <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-80 mt-6 ml-1 flex items-center gap-4">
                   <span>{c.handle}</span>
                   <span className="w-1 h-1 rounded-full bg-[#FF3B30]" />
                   <span>{c.location || "Global"}</span>
                </p>
            </motion.div>

            {isOwner && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }} className="flex flex-col gap-3 min-w-[200px]">
                    <button onClick={() => setInviteOpen(v => !v)} data-testid="invite-btn" className="btn-solid bg-[#F4F4F0] text-[#0A0A0A] hover:bg-[#FF3B30] hover:text-white justify-center">
                    <Send className="w-4 h-4" /> Send Brief
                    </button>
                    <button onClick={openChat} data-testid="chat-btn" className="btn-pill justify-center border-white/20 hover:border-white">
                    <MessageSquare className="w-4 h-4" /> Direct Message
                    </button>
                </motion.div>
            )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-20">
        
        {/* Invite Panel Dropdown */}
        {inviteOpen && isOwner && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-20 overflow-hidden">
                <div className="hairline-t hairline-b hairline-l hairline-r p-8 md:p-12 bg-white/[0.02]" data-testid="invite-form">
                    <h3 className="font-editorial text-4xl italic text-[#FF3B30]">Extend an invitation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
                        <div>
                            <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 block">Campaign</label>
                            <select data-testid="invite-campaign" value={inv.campaign_id} onChange={e => setInv({...inv, campaign_id: e.target.value})}
                            className="w-full bg-transparent hairline-b py-4 font-editorial text-2xl focus:outline-none focus:border-[#FF3B30]">
                            <option value="" className="bg-[#0A0A0A]">Select a campaign…</option>
                            {myCamps.map(mc => <option key={mc.id} value={mc.id} className="bg-[#0A0A0A]">{mc.title}</option>)}
                            </select>

                            <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-8 block">Offer (USD)</label>
                            <input type="number" data-testid="invite-offer" value={inv.offer} onChange={e => setInv({...inv, offer: e.target.value})}
                            className="w-full bg-transparent hairline-b py-4 font-editorial text-2xl focus:outline-none focus:border-[#FF3B30]" />

                            <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-8 block">Note</label>
                            <textarea rows={2} data-testid="invite-msg" value={inv.message} onChange={e => setInv({...inv, message: e.target.value})}
                            className="w-full bg-transparent hairline-b py-4 font-editorial text-xl focus:outline-none focus:border-[#FF3B30] resize-none"
                            placeholder="Why this creator, why this brief." />
                            
                            <button onClick={sendInvite} data-testid="invite-send" className="btn-solid mt-8 w-full justify-center py-4 bg-[#FF3B30] text-white">
                                <Send className="w-4 h-4" /> Dispatch
                            </button>
                        </div>
                        <div className="bg-[#0A0A0A] border border-white/10 p-8 flex flex-col justify-center items-center text-center">
                            {inv.campaign_id ? (
                                <>
                                    {ai ? (
                                        <div className="w-full text-left animate-in fade-in" data-testid="ai-match-result">
                                            <div className="flex items-baseline justify-between hairline-b pb-4">
                                                <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">AI Match</span>
                                                <span className="font-editorial italic text-7xl text-[#FF3B30]">{ai.score}%</span>
                                            </div>
                                            <p className="font-editorial italic text-xl mt-6">{ai.verdict}</p>
                                            <div className="grid grid-cols-2 gap-4 mt-6">
                                                <div>
                                                    <span className="font-mono text-[9px] tracking-[0.3em] uppercase opacity-50 block mb-2">Strengths</span>
                                                    {ai.strengths && <ul className="text-xs space-y-2 opacity-80">{ai.strengths.map((s,i)=><li key={i}>+ {s}</li>)}</ul>}
                                                </div>
                                                <div>
                                                    <span className="font-mono text-[9px] tracking-[0.3em] uppercase opacity-50 block mb-2">Risks</span>
                                                    {ai.risks && <ul className="text-xs space-y-2 opacity-60">{ai.risks.map((s,i)=><li key={i}>- {s}</li>)}</ul>}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => runMatch(inv.campaign_id)} disabled={aiBusy} className="btn-pill w-full justify-center py-4 text-lg border-white/20 hover:border-[#FF3B30]" data-testid="ai-match-btn">
                                            {aiBusy ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Synergy…</> : <><Sparkles className="w-5 h-5" /> Generate Synergy Score</>}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-40">Select a campaign to run AI analysis</p>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        )}

        {/* Bio & Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-24 mb-24">
            <div className="md:col-span-7">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-6">§ The Vision</p>
                <p className="font-editorial italic text-3xl md:text-5xl leading-[1.3] text-white/90">
                    "{c.bio}"
                </p>
                <div className="mt-12 flex flex-wrap gap-4">
                    {(c.niches || []).map(n => (
                        <span key={n} className="px-4 py-2 border border-white/10 rounded-full font-mono text-[9px] tracking-[0.2em] uppercase opacity-70">
                            {n}
                        </span>
                    ))}
                </div>
            </div>
            
            <div className="md:col-span-5 grid grid-cols-2 gap-x-8 gap-y-12">
                <Stat label="Reach" value={c.followers ? `${(c.followers / 1000).toFixed(1)}K` : "—"} />
                <Stat label="Platforms" value={(c.platforms || []).join(", ") || "—"} />
                {c.rating && <Stat label="Rating" value={`${c.rating.toFixed(1)} / 5.0`} />}
                {c.reviews_count > 0 && <Stat label="Reviews" value={c.reviews_count} />}
            </div>
        </div>

        {/* Dynamic Portfolio Grid */}
        {c.portfolio && c.portfolio.length > 0 && (
          <div className="mb-24">
            <div className="flex items-center justify-between hairline-b pb-6 mb-12">
                <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Selected Works</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {c.portfolio.map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className={`relative group overflow-hidden ${i % 4 === 0 || i % 4 === 3 ? "md:col-span-2 lg:col-span-2 aspect-[16/9]" : "aspect-[4/5]"}`}>
                  
                  <img src={p} alt="" className="h-full w-full object-cover filter grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" />
                  
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                     <button className="w-16 h-16 rounded-full border border-white/30 backdrop-blur-md flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-transform duration-500">
                         <Play className="w-5 h-5 ml-1" />
                     </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Rate Card (Minimal) */}
        {c.rate_card && Object.keys(c.rate_card).length > 0 && (
            <div className="mb-24">
                <div className="flex items-center justify-between hairline-b pb-6 mb-12">
                    <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Investment (USD)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {Object.entries(c.rate_card).map(([k, v], i) => (
                    <motion.div key={k} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i*0.1 }}
                        className="flex items-end justify-between border-b border-white/10 pb-4">
                        <div className="font-editorial text-3xl capitalize">{k}</div>
                        <div className="font-mono text-sm tracking-widest text-[#FF3B30]">${v.toLocaleString()}</div>
                    </motion.div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="hairline-t pt-4">
      <div className="font-mono text-[9px] tracking-[0.3em] uppercase opacity-50 mb-2">{label}</div>
      <div className="font-editorial text-4xl capitalize">{value}</div>
    </div>
  );
}
