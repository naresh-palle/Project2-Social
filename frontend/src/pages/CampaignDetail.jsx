import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Send, Check, RotateCw, Star, IndianRupee, MessageSquare, Upload, Sparkles, Loader2, FileText, ChevronLeft } from "lucide-react";

import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { uploadDocument } from "@/lib/upload";

export default function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user, refresh } = useAuth();
  const [c, setC] = useState(null);
  const [pitch, setPitch] = useState("");
  const [rate, setRate] = useState("");
  const [applied, setApplied] = useState(false);
  const [apps, setApps] = useState([]);
  const [delivs, setDelivs] = useState([]);
  const [delivForm, setDelivForm] = useState({ url: "", caption: "", kind: "post" });
  const [delivUploading, setDelivUploading] = useState(false);
  const delivFileRef = useRef(null);
  const [topMatches, setTopMatches] = useState(null);
  const [matchesBusy, setMatchesBusy] = useState(false);
  const [inviteForCreator, setInviteForCreator] = useState(null);
  const [inviteOffer, setInviteOffer] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [showRehire, setShowRehire] = useState(false);
  const [rehireBusy, setRehireBusy] = useState(false);

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
    try { await api.post(`/applications/${aid}/accept`, {}); toast.success("Influencer accepted."); load(); }
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
    if (!delivForm.url?.trim()) {
      toast.error("Add a link or upload a PDF / Word / Excel file");
      return;
    }
    try {
      await api.post("/deliverables", { ...delivForm, campaign_id: id });
      setDelivForm({ url: "", caption: "", kind: "post" });
      toast.success("Deliverable submitted.");
      load();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };
  const onDelivFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDelivUploading(true);
    try {
      const result = await uploadDocument(file);
      if (result?.url) {
        setDelivForm((prev) => ({
          ...prev,
          url: result.url,
          kind: prev.kind === "post" ? "document" : prev.kind,
          caption: prev.caption || result.filename || file.name,
        }));
        toast.success("Document uploaded");
      }
    } finally {
      setDelivUploading(false);
    }
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
  const confirmRehire = async () => {
    setRehireBusy(true);
    try {
      const { data } = await api.post(`/campaigns/${id}/rehire`);
      toast.success("Campaign created.");
      setShowRehire(false);
      nav(`/campaigns/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to rehire");
    } finally {
      setRehireBusy(false);
    }
  };

  if (c === false) return <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] pt-40 px-10"><h1 className="font-sans text-4xl font-bold tracking-tight">Brief not on file.</h1></div>;
  if (!c) return <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex items-center justify-center"><span className="font-mono text-xs tracking-widest opacity-60">Loading…</span></div>;

  const isOwner = user?.role === "owner" && c.owner_id === user?.id;
  const isAcceptedInfluencer = user?.role === "influencer" && c.accepted_creator_id === user?.id;
  const canReview = c.status === "completed";
  const acceptedApp = apps.find(a => a.status === "accepted");
  const creatorName = acceptedApp ? acceptedApp.influencer_name : "Creator";

  // Display fallbacks for older briefs missing the new requirement fields
  const brief = {
    ...c,
    location: c.location || "Major metros · India",
    influencer_type: c.influencer_type || "Micro",
    min_reach: c.min_reach || "50K+",
    min_followers: c.min_followers || 10000,
    min_engagement: c.min_engagement || "3%+",
    influencer_experience: c.influencer_experience || "1+ years",
    timeline: c.timeline || c.deadline || "2–3 weeks",
    influencer_location: c.influencer_location || c.location || "Mumbai · Delhi NCR",
  };

  const searchParams = new URLSearchParams(location.search);
  const fromMessages = searchParams.get("from") === "messages" || location.state?.from === "/messages";
  const convoId = searchParams.get("convoId") || location.state?.convoId;
  const backTarget = fromMessages ? (convoId ? `/messages?id=${convoId}` : "/messages") : "/marketplace";
  const backLabel = fromMessages ? "Back to Messages" : "Back";

  return (
    <div className="flex flex-col h-full overflow-hidden w-full max-w-[1600px] mx-auto pb-4 pt-6">
      {/* Top Static Header */}
      <div className="shrink-0 mb-4 px-4 md:px-8">
        <div className="hairline-b pb-4 flex flex-wrap items-baseline justify-between">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Brief · {brief.id.slice(0, 6)} · {brief.status}</span>
            {isOwner && (
              <Link to={`/campaigns/${brief.id}/edit`} className="font-sans text-[10px] uppercase text-[#FF3B30] hover:underline">
                Edit Brief
              </Link>
            )}
          </div>
        </div>
      </div> {/* End Static Header */}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pr-2 pb-10">
        <div className="grid grid-cols-12 gap-8 mt-2">
          <div className="col-span-12 md:col-span-7">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ {brief.brand}</motion.p>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight leading-snug mt-2">{brief.title}</h1>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
              <Meta label="Budget" value={`₹${brief.budget}`} accent />
              <Meta label="Niches" value={(brief.niches || []).join(" · ") || "—"} />
              <Meta label="Platforms" value={(brief.platforms || []).join(" · ") || "—"} />
              <Meta label="Escrow" value={brief.escrow_funded ? `₹${brief.escrow_funded} held` : "not funded"} />
            </div>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
              <Meta label="Location" value={brief.location} />
              <Meta label="Type of influencers" value={brief.influencer_type} />
              <Meta label="Influencer reach" value={brief.min_reach} />
              <Meta label="Min followers" value={Number(brief.min_followers).toLocaleString()} />
              <Meta label="Engagement" value={brief.min_engagement} />
              <Meta label="Experience" value={brief.influencer_experience} />
              <Meta label="Timeline" value={brief.timeline} />
              <Meta label="Influencers from" value={brief.influencer_location} />
            </div>
            <div className="mt-8 hairline-t pt-6">
              <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Brief</h3>
              <p className="font-sans text-base md:text-lg leading-relaxed mt-2 opacity-90">{brief.description}</p>
              <div className="mt-5">
                <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Deliverables</h3>
                <p className="mt-2 text-sm opacity-80">{brief.deliverables}</p>
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
                      <div className="col-span-2 font-sans text-xl font-medium tracking-tight">₹{a.rate}</div>
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
                  <div className="mt-8 flex flex-wrap gap-3 items-center">
                    {!c.escrow_funded ? (
                      <button onClick={fund} data-testid="fund-btn" className="btn-solid">
                        <IndianRupee className="w-4 h-4" /> Fund escrow · ₹{c.budget}
                      </button>
                    ) : c.escrow_released ? (
                      <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-[#FF3B30]">✓ Payment released</span>
                    ) : (
                      <button onClick={release} disabled={c.status !== "completed"} data-testid="release-btn" className="btn-solid">
                        <Check className="w-4 h-4" /> Release ₹{c.escrow_funded}
                      </button>
                    )}
                    {c.status === "completed" && (
                      <button onClick={() => setShowRehire(true)} className="btn-solid bg-transparent border border-white/20 hover:border-white/50 text-white">
                        <RotateCw className="w-4 h-4" /> Rehire {creatorName}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Owner: AI-ranked top 5 influencers */}
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
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Offer (INR ₹)</label>
                      <input type="number" data-testid="quick-invite-offer" value={inviteOffer} onChange={e=>setInviteOffer(e.target.value)}
                        placeholder={`${c.budget}`}
                        className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30]" />
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-4 block">Note</label>
                      <textarea rows={3} data-testid="quick-invite-msg" value={inviteMsg} onChange={e=>setInviteMsg(e.target.value)}
                        className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
                      <button onClick={sendInviteQuick} data-testid="quick-invite-send" className="btn-solid mt-6 w-full justify-center">
                        <Send className="w-4 h-4" /> Send invitation
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}


            {/* Accepted creator: submit deliverable */}
            {isAcceptedInfluencer && (
              <div className="mt-14">
                <h3 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 hairline-b pb-3">§ Submit deliverable</h3>
                <form onSubmit={submitDeliv} className="mt-4 space-y-4" data-testid="deliv-form">
                  <select data-testid="deliv-kind" value={delivForm.kind} onChange={e=>setDelivForm({...delivForm,kind:e.target.value})}
                    className="w-full bg-[#0B0B0E] hairline-b py-3 focus:outline-none">
                    {["reel","story","post","video","document","other"].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input data-testid="deliv-url" value={delivForm.url} onChange={e=>setDelivForm({...delivForm,url:e.target.value})}
                    placeholder="https://… or upload a file below"
                    className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30]" />
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={delivFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      hidden
                      onChange={onDelivFile}
                    />
                    <button
                      type="button"
                      data-testid="deliv-upload-doc"
                      disabled={delivUploading}
                      onClick={() => delivFileRef.current?.click()}
                      className="btn-solid bg-white/5 border border-white/20 text-white hover:bg-white/10 !px-4 !py-2"
                    >
                      {delivUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      {delivUploading ? "Uploading…" : "Upload PDF / Word / Excel"}
                    </button>
                    <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Max 50MB</span>
                  </div>
                  <textarea data-testid="deliv-caption" value={delivForm.caption} onChange={e=>setDelivForm({...delivForm,caption:e.target.value})}
                    rows={2}
                    placeholder="Caption / notes"
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
            {canReview && user && (isOwner || isAcceptedInfluencer) && (
              <ReviewBlock campaignId={id} targetId={isOwner ? c.accepted_creator_id : c.owner_id} />
            )}
          </div>

          <div className="col-span-12 md:col-span-5">
            {/* Application (creator) */}
            {!isOwner && (
              <div className="mb-8 hairline-t hairline-b hairline-l hairline-r p-6 bg-white/[0.02]">
                <h3 className="font-editorial text-3xl italic">Pitch this brief.</h3>
                {!user ? (
                  <p className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">
                    <Link to="/login" className="text-[#FF3B30] kinetic-underline">Sign in</Link> as an influencer to apply.
                  </p>
                ) : user.role !== "influencer" ? (
                  <p className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">Only influencers can pitch.</p>
                ) : applied ? (
                  <p className="mt-4 font-mono text-[11px] tracking-[0.22em] uppercase text-[#FF3B30]">✓ Pitch delivered.</p>
                ) : (
                  <form onSubmit={apply} className="mt-4 space-y-4" data-testid="apply-form">
                    <div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Your pitch</label>
                      <textarea required data-testid="apply-pitch" value={pitch} onChange={(e) => setPitch(e.target.value)}
                        rows={5}
                        className="mt-2 w-full bg-[#0B0B0E] border border-white/10 p-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Your rate (INR ₹)</label>
                      <input required data-testid="apply-rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)}
                        className="mt-2 w-full bg-[#0B0B0E] border border-white/10 p-3 focus:outline-none focus:border-[#FF3B30] text-lg" />
                    </div>
                    <button data-testid="apply-submit" className="btn-solid w-full justify-center">
                      Deliver pitch <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {c.cover && (
              <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] p-2 mt-8">
                <div className="aspect-square overflow-hidden rounded-xl bg-[#0B0B0E]">
                  <img src={c.cover} alt={c.title} className="h-full w-full object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              </div>
            )}
            </div>
          </div>
        </div> {/* End Scrollable Area */}

      <AnimatePresence>
        {showRehire && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B0B0E] border border-white/10 p-6 max-w-md w-full relative"
            >
              <h3 className="font-editorial text-2xl italic">Rehire {creatorName}</h3>
              <p className="mt-4 font-sans text-sm opacity-80">
                Create a new campaign with {creatorName} based on this completed campaign. A loyalty discount will be applied automatically.
              </p>
              <div className="mt-8 flex gap-3 justify-end">
                <button onClick={() => setShowRehire(false)} className="px-4 py-2 text-sm opacity-60 hover:opacity-100">Cancel</button>
                <button onClick={confirmRehire} disabled={rehireBusy} className="btn-solid text-sm">
                  {rehireBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />} Confirm Rehire
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Meta({ label, value, accent }) {
  return (
    <div className="flex flex-col">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2">{label}</div>
      <div className={`font-sans uppercase tracking-[0.05em] leading-snug ${accent ? "text-xl font-bold text-[#FF3B30]" : "text-sm font-semibold text-white/90"}`}>
        {value}
      </div>
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
      {done ? <p className="mt-4 font-sans text-xl font-medium tracking-tight">Thank you.</p> : (
        <div className="mt-4">
          <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <button key={i} onClick={() => setRating(i)} data-testid={`star-${i}`}>
                <Star className={`w-8 h-8 ${i <= rating ? "fill-[#FF3B30] text-[#FF3B30]" : "text-white/30"}`} />
              </button>
            ))}
          </div>
          <textarea data-testid="review-text" value={text} onChange={e=>setText(e.target.value)} rows={3} className="mt-4 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] resize-none" />
          <button onClick={submit} data-testid="review-submit" className="btn-solid mt-4">
            <Send className="w-4 h-4" /> Submit review
          </button>
        </div>
      )}
    </div>
  );
}
