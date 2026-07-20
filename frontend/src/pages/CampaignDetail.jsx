import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Send, Check, RotateCw, Star, DollarSign, MessageSquare, Upload, Sparkles, Loader2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast, Toaster } from "sonner";

export default function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [c, setC] = useState(null);
  const [pitch, setPitch] = useState("");
  const [rate, setRate] = useState("");
  const [applied, setApplied] = useState(false);
  const [apps, setApps] = useState([]);
  const [delivs, setDelivs] = useState([]);
  const [delivForm, setDelivForm] = useState({ url: "", caption: "", kind: "post" });
  const [topMatches, setTopMatches] = useState(null);
  const [matchesBusy, setMatchesBusy] = useState(false);
  const [inviteForCreator, setInviteForCreator] = useState(null);
  const [inviteOffer, setInviteOffer] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get(`/campaigns/${id}`);
      setC(data);
      if (user?.role === "owner" && data.owner_id === user?.id) {
        api.get(`/campaigns/${id}/applications`).then(r => setApps(r.data));
      }
      if (user) {
        api.get(`/campaigns/${id}/deliverables`).then(r => setDelivs(r.data)).catch(() => {});
      }
    } catch { setC(false); }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const apply = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/campaigns/${id}/apply`, { pitch, rate: Number(rate) });
      setApplied(true); toast.success("Pitch delivered.");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail) || "Failed"); }
  };
  const acceptApp = async (aid) => {
    try { await api.post(`/applications/${aid}/accept`, {}); toast.success("Creator accepted."); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const fund = async () => {
    try { await api.post(`/campaigns/${id}/fund`, {}); toast.success("Escrow funded."); load(); await refresh(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const release = async () => {
    try { await api.post(`/campaigns/${id}/release`, {}); toast.success("Payment released."); load(); await refresh(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const submitDeliv = async (e) => {
    e.preventDefault();
    try {
      await api.post("/deliverables", { ...delivForm, campaign_id: id });
      setDelivForm({ url: "", caption: "", kind: "post" });
      toast.success("Deliverable submitted.");
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const reviewDeliv = async (did, status) => {
    try {
      await api.post(`/deliverables/${did}/review`, { status });
      toast.success(`Marked ${status}.`); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const openChat = async (creator_id) => {
    try {
      const { data } = await api.post("/conversations/open", null, { params: { campaign_id: id, creator_id } });
      nav(`/messages?id=${data.id}`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const loadTopMatches = async () => {
    setMatchesBusy(true);
    try {
      const { data } = await api.get(`/campaigns/${id}/top-matches?limit=5`);
      setTopMatches(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "AI ranking failed");
    } finally { setMatchesBusy(false); }
  };
  const sendInviteQuick = async () => {
    if (!inviteForCreator) return;
    try {
      await api.post("/invitations", {
        creator_id: inviteForCreator.id, campaign_id: id,
        offer: Number(inviteOffer) || c.budget, message: inviteMsg || `We'd love you on ${c.title}.`,
      });
      toast.success("Invitation sent.");
      setInviteForCreator(null); setInviteOffer(""); setInviteMsg("");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || "Failed"); }
  };

  if (c === false) return <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] pt-40 px-10"><Nav /><h1 className="font-editorial italic text-5xl">Brief not on file.</h1></div>;
  if (!c) return <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex items-center justify-center"><span className="font-mono text-xs tracking-widest opacity-60">Loading…</span></div>;

  const isOwner = user?.role === "owner" && c.owner_id === user?.id;
  const isAcceptedCreator = user?.role === "influencer" && c.accepted_creator_id === user?.id;
  const canReview = c.status === "completed";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-16">
        <div className="hairline-b pb-6 flex flex-wrap items-baseline justify-between">
          <Link to="/marketplace" className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60 kinetic-underline">← Back to file</Link>
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Brief · {c.id.slice(0, 6)} · {c.status}</span>
        </div>

        <div className="grid grid-cols-12 gap-10 mt-12">
          <div className="col-span-12 md:col-span-7">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ {c.brand}</motion.p>
            <h1 className="font-editorial text-5xl md:text-7xl leading-[0.95] mt-3">{c.title}</h1>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              <Meta label="Budget" value={`$${c.budget}`} accent />
              <Meta label="Niches" value={(c.niches || []).join(" · ") || "—"} />
              <Meta label="Platforms" value={(c.platforms || []).join(" · ") || "—"} />
              <Meta label="Escrow" value={c.escrow_funded ? `$${c.escrow_funded} held` : "not funded"} />
            </div>
            <div className="mt-10 hairline-t pt-8">
              <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Brief</h3>
              <p className="font-editorial text-2xl md:text-3xl italic leading-[1.3] mt-3">{c.description}</p>
              <div className="mt-8">
                <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Deliverables</h3>
                <p className="mt-2 text-base opacity-80">{c.deliverables}</p>
              </div>
            </div>

            {/* Owner: applications + escrow */}
            {isOwner && (
              <div className="mt-14">
                <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">
                  § Applications · {apps.length}
                </h3>
                <div className="mt-4 space-y-4">
                  {apps.length === 0 ? (
                    <div className="opacity-60 italic">No applications yet.</div>
                  ) : apps.map(a => (
                    <div key={a.id} className="hairline-b py-4 grid grid-cols-12 gap-4" data-testid={`app-row-${a.id}`}>
                      <div className="col-span-4">
                        <Link to={`/creators/${a.influencer_id}`} className="font-editorial text-2xl kinetic-underline">{a.influencer_name}</Link>
                        <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">{a.influencer_handle}</div>
                      </div>
                      <div className="col-span-4 opacity-80 text-sm italic">"{a.pitch}"</div>
                      <div className="col-span-2 font-editorial italic text-2xl">${a.rate}</div>
                      <div className="col-span-2 text-right">
                        {a.status === "pending" ? (
                          <button onClick={() => acceptApp(a.id)} data-testid={`accept-${a.id}`} className="btn-solid text-xs">
                            <Check className="w-3 h-3" /> Accept
                          </button>
                        ) : (
                          <span className={`font-mono text-[10px] tracking-[0.28em] uppercase ${a.status === "accepted" ? "text-[#FF3B30]" : "opacity-50"}`}>
                            {a.status}
                          </span>
                        )}
                        {a.status === "accepted" && (
                          <button onClick={() => openChat(a.influencer_id)} data-testid={`chat-${a.id}`} className="btn-pill text-[10px] mt-2">
                            <MessageSquare className="w-3 h-3" /> Message
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {c.accepted_creator_id && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    {!c.escrow_funded ? (
                      <button onClick={fund} data-testid="fund-btn" className="btn-solid">
                        <DollarSign className="w-4 h-4" /> Fund escrow · ${c.budget}
                      </button>
                    ) : c.escrow_released ? (
                      <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-[#FF3B30]">✓ Payment released</span>
                    ) : (
                      <button onClick={release} disabled={c.status !== "completed"} data-testid="release-btn" className="btn-solid">
                        <Check className="w-4 h-4" /> Release ${c.escrow_funded}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Owner: AI-ranked top 5 creators */}
            {isOwner && c.status === "open" && (
              <div className="mt-14" data-testid="top-matches-section">
                <div className="hairline-b pb-3 flex items-baseline justify-between">
                  <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ AI-ranked top matches</h3>
                  {!topMatches ? (
                    <button onClick={loadTopMatches} disabled={matchesBusy} data-testid="load-top-matches" className="btn-pill text-[10px]">
                      {matchesBusy ? <><Loader2 className="w-3 h-3 animate-spin" /> Scoring…</> : <><Sparkles className="w-3 h-3" /> Reveal top 5</>}
                    </button>
                  ) : (
                    <button onClick={loadTopMatches} disabled={matchesBusy} className="font-mono text-[10px] tracking-[0.28em] uppercase kinetic-underline opacity-70">
                      {matchesBusy ? "Scoring…" : "Re-score"}
                    </button>
                  )}
                </div>
                {topMatches && (
                  <div className="mt-6 space-y-3">
                    {topMatches.length === 0 && (
                      <p className="opacity-60 italic">No matches surfaced. Try broader niches.</p>
                    )}
                    {topMatches.map((m, idx) => (
                      <motion.div key={m.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: idx * 0.06 }}
                        className="hairline-t hairline-b hairline-l hairline-r p-4 grid grid-cols-12 gap-4 items-center"
                        data-testid={`match-${m.id}`}
                      >
                        <div className="col-span-1 font-editorial italic text-4xl text-[#FF3B30]">#{idx + 1}</div>
                        <div className="col-span-1">
                          {m.avatar ? (
                            <img src={m.avatar} alt="" className="w-14 h-14 object-cover" />
                          ) : (
                            <div className="w-14 h-14 bg-white/5 flex items-center justify-center font-editorial text-2xl italic">{m.name?.[0]}</div>
                          )}
                        </div>
                        <div className="col-span-4">
                          <Link to={`/creators/${m.id}`} className="font-editorial text-2xl kinetic-underline">{m.name}</Link>
                          <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">{m.handle} · {(m.niches || []).join(" · ")}</div>
                          <p className="text-xs italic opacity-80 mt-1 line-clamp-2">"{m.verdict}"</p>
                        </div>
                        <div className="col-span-2 font-editorial italic text-4xl text-[#FF3B30]">{m.score}%</div>
                        <div className="col-span-2 font-mono text-[10px] tracking-[0.22em] uppercase opacity-70">
                          {m.followers ? `${Math.round(m.followers / 1000)}K` : "—"}<br/>
                          <span className="opacity-70">{m.estimated_reach}</span>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1 items-end">
                          <button onClick={() => setInviteForCreator(m)} data-testid={`invite-match-${m.id}`} className="btn-solid text-[10px]">
                            <Send className="w-3 h-3" /> Invite
                          </button>
                          <button onClick={() => openChat(m.id)} data-testid={`chat-match-${m.id}`} className="btn-pill text-[10px]">
                            <MessageSquare className="w-3 h-3" /> Msg
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                <AnimatePresence>
                  {inviteForCreator && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-4 hairline-t hairline-b hairline-l hairline-r p-6"
                      data-testid="quick-invite-panel"
                    >
                      <div className="flex items-baseline justify-between">
                        <h4 className="font-editorial text-2xl italic">Invite {inviteForCreator.name}</h4>
                        <button onClick={() => setInviteForCreator(null)} className="opacity-60 hover:opacity-100">×</button>
                      </div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Offer (USD)</label>
                      <input type="number" data-testid="quick-invite-offer" value={inviteOffer} onChange={e=>setInviteOffer(e.target.value)}
                        placeholder={`${c.budget}`}
                        className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30]" />
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Note</label>
                      <textarea rows={3} data-testid="quick-invite-msg" value={inviteMsg} onChange={e=>setInviteMsg(e.target.value)}
                        className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none"
                        placeholder="Why this creator, why this brief." />
                      <button onClick={sendInviteQuick} data-testid="quick-invite-send" className="btn-solid mt-6 w-full justify-center">
                        <Send className="w-4 h-4" /> Send invitation
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}


            {/* Accepted creator: submit deliverable */}
            {isAcceptedCreator && (
              <div className="mt-14">
                <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">§ Submit deliverable</h3>
                <form onSubmit={submitDeliv} className="mt-4 space-y-4" data-testid="deliv-form">
                  <select data-testid="deliv-kind" value={delivForm.kind} onChange={e=>setDelivForm({...delivForm,kind:e.target.value})}
                    className="w-full bg-[#0A0A0A] hairline-b py-3 focus:outline-none">
                    {["reel","story","post","video","other"].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input required data-testid="deliv-url" value={delivForm.url} onChange={e=>setDelivForm({...delivForm,url:e.target.value})}
                    placeholder="Link to published content"
                    className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30]" />
                  <textarea data-testid="deliv-caption" value={delivForm.caption} onChange={e=>setDelivForm({...delivForm,caption:e.target.value})}
                    rows={2} placeholder="Caption / note"
                    className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
                  <button data-testid="deliv-submit" className="btn-solid"><Upload className="w-4 h-4" /> Submit</button>
                </form>
              </div>
            )}

            {/* Deliverables list */}
            {delivs.length > 0 && (
              <div className="mt-14">
                <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">§ Deliverables · {delivs.length}</h3>
                <div className="mt-4 space-y-3">
                  {delivs.map(d => (
                    <div key={d.id} className="hairline-b py-3 grid grid-cols-12 gap-3 items-baseline" data-testid={`deliv-${d.id}`}>
                      <div className="col-span-2 font-mono text-[10px] tracking-[0.22em] uppercase opacity-70">{d.kind}</div>
                      <div className="col-span-6">
                        <a href={d.url} target="_blank" rel="noreferrer" className="kinetic-underline text-[#FF3B30] break-all">{d.url}</a>
                        {d.caption && <p className="text-xs opacity-70 mt-1">{d.caption}</p>}
                      </div>
                      <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase">
                        <span className={d.status === "approved" ? "text-[#FF3B30]" : "opacity-70"}>{d.status}</span>
                      </div>
                      {isOwner && d.status === "pending" && (
                        <div className="col-span-2 flex gap-1 justify-end">
                          <button onClick={()=>reviewDeliv(d.id,"approved")} data-testid={`approve-${d.id}`} className="btn-pill text-[10px]"><Check className="w-3 h-3" /></button>
                          <button onClick={()=>reviewDeliv(d.id,"revision")} data-testid={`revise-${d.id}`} className="btn-pill text-[10px]"><RotateCw className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews (post-completion) */}
            {canReview && user && (isOwner || isAcceptedCreator) && (
              <ReviewBlock campaignId={id} targetId={isOwner ? c.accepted_creator_id : c.owner_id} />
            )}
          </div>

          <div className="col-span-12 md:col-span-5">
            {c.cover && (
              <div className="aspect-[4/5] overflow-hidden">
                <img src={c.cover} alt={c.title} className="h-full w-full object-cover" />
              </div>
            )}

            {/* Application (creator) */}
            {!isOwner && (
              <div className="mt-8 hairline-t hairline-b hairline-l hairline-r p-6">
                <h3 className="font-editorial text-3xl italic">Pitch this brief.</h3>
                {!user ? (
                  <p className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">
                    <Link to="/login" className="text-[#FF3B30] kinetic-underline">Sign in</Link> as a creator to apply.
                  </p>
                ) : user.role !== "influencer" ? (
                  <p className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">Only creators can pitch.</p>
                ) : applied ? (
                  <p className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase text-[#FF3B30]">✓ Pitch delivered.</p>
                ) : (
                  <form onSubmit={apply} className="mt-4 space-y-4" data-testid="apply-form">
                    <div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Your pitch</label>
                      <textarea required data-testid="apply-pitch" value={pitch} onChange={(e) => setPitch(e.target.value)}
                        rows={5} placeholder="What would you do with this brief?"
                        className="mt-2 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Your rate (USD)</label>
                      <input required data-testid="apply-rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)}
                        className="mt-2 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg" />
                    </div>
                    <button data-testid="apply-submit" className="btn-solid w-full justify-center">
                      Deliver pitch <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Meta({ label, value, accent }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">{label}</div>
      <div className={`font-editorial mt-1 ${accent ? "italic text-3xl text-[#FF3B30]" : "text-xl"}`}>{value}</div>
    </div>
  );
}

function ReviewBlock({ campaignId, targetId }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const submit = async () => {
    try {
      await api.post("/reviews", { campaign_id: campaignId, target_id: targetId, rating, text });
      setDone(true); toast.success("Review submitted.");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  if (!targetId) return null;
  return (
    <div className="mt-14">
      <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">§ Leave a review</h3>
      {done ? <p className="mt-4 font-editorial italic text-2xl">Thank you.</p> : (
        <div className="mt-4">
          <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => setRating(i)} data-testid={`star-${i}`}>
                <Star className={`w-8 h-8 ${i <= rating ? "fill-[#FF3B30] text-[#FF3B30]" : "text-white/30"}`} />
              </button>
            ))}
          </div>
          <textarea data-testid="review-text" value={text} onChange={e=>setText(e.target.value)} rows={3}
            placeholder="A few honest words." className="mt-4 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
          <button onClick={submit} data-testid="review-submit" className="btn-solid mt-4">
            <Send className="w-4 h-4" /> Submit review
          </button>
        </div>
      )}
    </div>
  );
}
