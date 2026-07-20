import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Trash2, Send, Sparkles, Loader2, X } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [camps, setCamps] = useState([]);

  // Pitch Modal State
  const [pitchUser, setPitchUser] = useState(null);
  const [pitchForm, setPitchForm] = useState({ target_email: "", target_role: "owner", subject: "", body: "" });
  const [pitchGenerating, setPitchGenerating] = useState(false);
  const [pitchSending, setPitchSending] = useState(false);

  const load = async () => {
    if (user?.role !== "admin") return;
    const [u, c] = await Promise.all([api.get("/admin/users"), api.get("/admin/campaigns")]);
    setUsers(u.data);
    setCamps(c.data);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] pt-40 px-10">
        <Nav />
        <h1 className="font-editorial italic text-5xl">Admins only.</h1>
      </div>
    );
  }

  const verify = async (id) => {
    try { await api.post(`/admin/users/${id}/verify`); toast.success("Verified"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const approveAgent = async (id) => {
    try { await api.post(`/admin/approve-agent/${id}`); toast.success("Agent Approved"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => {
    try { await api.delete(`/admin/campaigns/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const generatePitch = async () => {
    setPitchGenerating(true);
    try {
      const { data } = await api.post("/admin/ai-pitch", { influencer_id: pitchUser.id, target_role: pitchForm.target_role });
      setPitchForm(f => ({ ...f, subject: data.subject, body: data.body }));
      toast.success("AI Draft generated.");
    } catch (e) {
      toast.error("Failed to generate AI pitch.");
    } finally {
      setPitchGenerating(false);
    }
  };

  const sendPitch = async () => {
    if (!pitchForm.target_email || !pitchForm.subject || !pitchForm.body) {
      toast.error("Complete all fields."); return;
    }
    setPitchSending(true);
    try {
      await api.post("/admin/send-pitch", { 
        influencer_id: pitchUser.id, 
        target_email: pitchForm.target_email,
        subject: pitchForm.subject,
        body: pitchForm.body
      });
      toast.success("Pitch sent successfully.");
      setPitchUser(null);
    } catch (e) {
      toast.error("Failed to send pitch.");
    } finally {
      setPitchSending(false);
    }
  };

  const targetOptions = users.filter(u => u.role === "owner" || u.role === "agent");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-24">
        <div className="hairline-b pb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Admin console</p>
          <h1 className="font-editorial text-6xl md:text-7xl leading-[1.15] mt-2">
            The <span className="italic">register</span><span className="tick">.</span>
          </h1>
        </div>

        <div className="flex gap-8 mt-6 font-mono text-[11px] tracking-[0.28em] uppercase">
          {["users", "campaigns"].map(t => (
            <button key={t} onClick={() => setTab(t)} data-testid={`admin-tab-${t}`}
              className={`kinetic-underline ${tab === t ? "text-[#FF3B30]" : "opacity-60"}`}>
              {t === "users" ? `Users · ${users.length}` : `Campaigns · ${camps.length}`}
            </button>
          ))}
        </div>

        {tab === "users" ? (
          <div className="mt-8 space-y-2">
            {users.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                data-testid={`admin-user-${u.id}`}
                className="hairline-b py-4 grid grid-cols-12 gap-4 items-baseline">
                <div className="col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="col-span-3 flex items-center gap-3">
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover filter grayscale" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] opacity-70">{u.name.charAt(0)}</div>
                  )}
                  <div>
                    <div className="font-editorial text-2xl leading-[1.15]">{u.name}</div>
                    <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60 mt-1">
                      {u.handle || u.company}
                    </div>
                  </div>
                </div>
                <div className="col-span-3 font-mono text-[11px] opacity-70">{u.email}</div>
                <div className="col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase">
                  <span className={u.role === "admin" ? "text-[#FF3B30]" : "opacity-80"}>{u.role}</span>
                </div>
                <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase">
                  {u.verified ? <span className="text-[#FF3B30]">✓ verified</span> : <span className="opacity-60">unverified</span>}
                </div>
                <div className="col-span-2 text-right flex gap-2 justify-end">
                  {u.role === "influencer" && (
                     <button onClick={() => {
                        setPitchUser(u);
                        setPitchForm({ target_email: "", target_role: "owner", subject: "", body: "" });
                     }} data-testid={`admin-pitch-${u.id}`}
                      className="btn-pill text-[10px]"><Send className="w-3 h-3" /> Pitch</button>
                  )}
                  {!u.verified && (
                    <button onClick={() => verify(u.id)} data-testid={`admin-verify-${u.id}`}
                      className="btn-pill text-[10px]"><Shield className="w-3 h-3" /></button>
                  )}
                  {u.role === "agent" && !u.agent_approved && (
                    <button onClick={() => approveAgent(u.id)} data-testid={`admin-approve-agent-${u.id}`}
                      className="btn-pill text-[10px] border-[#FF3B30] text-[#FF3B30]">Approve</button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            {camps.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                data-testid={`admin-camp-${c.id}`}
                className="hairline-b py-4 grid grid-cols-12 gap-4 items-baseline">
                <div className="col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="col-span-5">
                  <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">{c.brand}</div>
                  <Link to={`/campaigns/${c.id}`} className="font-editorial text-2xl kinetic-underline">{c.title}</Link>
                </div>
                <div className="col-span-2 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">${c.budget}</div>
                <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase">
                  <span className={c.status === "completed" ? "text-[#FF3B30]" : "opacity-80"}>{c.status}</span>
                </div>
                <div className="col-span-2 text-right">
                  <button onClick={() => del(c.id)} data-testid={`admin-delete-${c.id}`} className="btn-pill text-[10px]">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {pitchUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="bg-[#0A0A0A] border border-white/10 w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-6 hairline-b">
                <div>
                  <h3 className="font-editorial text-4xl italic">AI Pitch Portfolio</h3>
                  <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 mt-2">Target: {pitchUser.name}</p>
                </div>
                <button onClick={() => setPitchUser(null)} className="text-white/50 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mt-8 space-y-6">
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-2 block">1. Select Target Brand/Agent</label>
                  <select value={pitchForm.target_email} onChange={e => {
                    const t = targetOptions.find(o => o.email === e.target.value);
                    setPitchForm({...pitchForm, target_email: e.target.value, target_role: t ? t.role : "owner"});
                  }} className="w-full bg-transparent border-b border-white/20 py-3 focus:outline-none focus:border-[#FF3B30]">
                    <option value="" className="bg-[#0A0A0A]">Select a target...</option>
                    {targetOptions.map(o => (
                      <option key={o.id} value={o.email} className="bg-[#0A0A0A]">
                        {o.name} ({o.company || o.role}) - {o.email}
                      option>
                    ))}
                  </select>
                </div>

                <div className="hairline-b pb-6">
                  <button onClick={generatePitch} disabled={pitchGenerating || !pitchForm.target_email} className="btn-solid w-full justify-center">
                    {pitchGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {pitchGenerating ? "Generating draft..." : "2. Generate AI Draft"}
                  </button>
                </div>

                {pitchForm.subject && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-2 block">Subject</label>
                      <input type="text" value={pitchForm.subject} onChange={e => setPitchForm({...pitchForm, subject: e.target.value})}
                        className="w-full bg-transparent border-b border-white/20 py-2 focus:outline-none focus:border-[#FF3B30] font-editorial text-2xl" />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-2 block">Pitch Body</label>
                      <textarea rows={8} value={pitchForm.body} onChange={e => setPitchForm({...pitchForm, body: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 p-4 focus:outline-none focus:border-[#FF3B30] font-editorial text-lg leading-relaxed resize-none" />
                    </div>

                    <button onClick={sendPitch} disabled={pitchSending} className="btn-solid w-full justify-center bg-[#FF3B30] text-white hover:bg-white hover:text-black mt-4">
                      {pitchSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {pitchSending ? "Sending..." : "Send Portfolio Pitch"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
