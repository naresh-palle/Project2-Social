import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Sparkles, Star, MessageSquare, Loader2 } from "lucide-react";
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
      // Owner needs a campaign context; use first owned campaign as default
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
  if (!c) return <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex items-center justify-center"><span className="font-mono text-xs tracking-widest opacity-60">Loading…</span></div>;

  const isOwner = user?.role === "owner";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-16">
        <div className="hairline-b pb-6 flex flex-wrap items-baseline justify-between">
          <Link to="/marketplace" className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60 kinetic-underline">← Back to file</Link>
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Creator · {c.id?.slice(0, 6)}</span>
        </div>

        <div className="grid grid-cols-12 gap-10 mt-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="col-span-12 md:col-span-6">
            <div className="aspect-[4/5] overflow-hidden">
              {c.avatar ? <img src={c.avatar} alt={c.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/5" />}
            </div>
          </motion.div>
          <div className="col-span-12 md:col-span-6">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Creator on file</p>
            <h1 className="font-editorial text-6xl md:text-8xl leading-[0.9] mt-2">{c.name}</h1>
            <p className="font-mono text-[11px] tracking-[0.24em] uppercase opacity-70 mt-3">{c.handle} · {c.location}</p>
            {c.rating && (
              <div className="mt-3 flex items-center gap-2">
                {[1,2,3,4,5].map(i => (<Star key={i} className={`w-4 h-4 ${i <= Math.round(c.rating) ? "fill-[#FF3B30] text-[#FF3B30]" : "text-white/30"}`} />))}
                <span className="font-mono text-[11px] opacity-70">{c.rating} · {c.reviews_count} reviews</span>
              </div>
            )}
            <p className="mt-6 font-editorial italic text-2xl leading-relaxed">{c.bio}</p>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-6">
              <Stat label="Followers" value={c.followers ? `${Math.round(c.followers / 1000)}K` : "—"} />
              <Stat label="Platforms" value={(c.platforms || []).join(" · ") || "—"} />
              <Stat label="Niches" value={(c.niches || []).join(" · ") || "—"} />
            </div>

            {c.rate_card && Object.keys(c.rate_card).length > 0 && (
              <div className="mt-10 hairline-t pt-6">
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Rate card (USD)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  {Object.entries(c.rate_card).map(([k, v]) => (
                    <div key={k}>
                      <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{k}</div>
                      <div className="font-editorial italic text-2xl">${v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isOwner && (
              <div className="mt-10 flex flex-wrap gap-3">
                <button onClick={() => setInviteOpen(v => !v)} data-testid="invite-btn" className="btn-solid">
                  <Send className="w-4 h-4" /> Invite to brief
                </button>
                <button onClick={openChat} data-testid="chat-btn" className="btn-pill">
                  <MessageSquare className="w-4 h-4" /> Message
                </button>
              </div>
            )}

            {inviteOpen && isOwner && (
              <div className="mt-8 hairline-t hairline-b hairline-l hairline-r p-6" data-testid="invite-form">
                <h3 className="font-editorial text-2xl italic">Extend an invitation</h3>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Campaign</label>
                <select data-testid="invite-campaign" value={inv.campaign_id} onChange={e => setInv({...inv, campaign_id: e.target.value})}
                  className="w-full bg-[#0A0A0A] hairline-b py-3 focus:outline-none focus:border-[#FF3B30]">
                  <option value="">Select a campaign…</option>
                  {myCamps.map(mc => <option key={mc.id} value={mc.id}>{mc.title}</option>)}
                </select>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Offer (USD)</label>
                <input type="number" data-testid="invite-offer" value={inv.offer} onChange={e => setInv({...inv, offer: e.target.value})}
                  className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30]" />
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Note</label>
                <textarea rows={3} data-testid="invite-msg" value={inv.message} onChange={e => setInv({...inv, message: e.target.value})}
                  className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none"
                  placeholder="Why this creator, why this brief." />
                {inv.campaign_id && (
                  <button onClick={() => runMatch(inv.campaign_id)} disabled={aiBusy} className="btn-pill mt-4" data-testid="ai-match-btn">
                    {aiBusy ? <><Loader2 className="w-3 h-3 animate-spin" /> Scoring…</> : <><Sparkles className="w-3 h-3" /> AI match score</>}
                  </button>
                )}
                {ai && (
                  <div className="mt-4 p-4 hairline-t hairline-b hairline-l hairline-r bg-white/[0.02]" data-testid="ai-match-result">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Match score</span>
                      <span className="font-editorial italic text-6xl text-[#FF3B30]">{ai.score}%</span>
                    </div>
                    <p className="font-editorial italic mt-2">{ai.verdict}</p>
                    {ai.strengths && <ul className="mt-3 text-sm space-y-1">{ai.strengths.map((s,i)=><li key={i}>✔ {s}</li>)}</ul>}
                    {ai.risks && <ul className="mt-2 text-sm space-y-1 opacity-70">{ai.risks.map((s,i)=><li key={i}>• {s}</li>)}</ul>}
                    {ai.estimated_reach && <div className="mt-3 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">Est. reach · {ai.estimated_reach}</div>}
                  </div>
                )}
                <button onClick={sendInvite} data-testid="invite-send" className="btn-solid mt-6 w-full justify-center">
                  <Send className="w-4 h-4" /> Send invitation
                </button>
              </div>
            )}
          </div>
        </div>

        {c.portfolio && c.portfolio.length > 0 && (
          <div className="mt-24">
            <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">§ Portfolio</h2>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {c.portfolio.map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.06 }}
                  className="aspect-[4/5] overflow-hidden">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-20">
            <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">§ Reviews</h2>
            <div className="mt-6 space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="hairline-b py-4">
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? "fill-[#FF3B30] text-[#FF3B30]" : "text-white/30"}`} />)}
                    <span className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">{r.author_name}</span>
                  </div>
                  {r.text && <p className="mt-2 font-editorial italic text-lg">"{r.text}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="hairline-t pt-4">
      <div className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">{label}</div>
      <div className="font-editorial text-2xl mt-1">{value}</div>
    </div>
  );
}
