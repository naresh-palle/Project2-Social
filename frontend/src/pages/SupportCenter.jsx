import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AiIcon } from "@/components/AiIcon";

const FALLBACK_FAQ = {
  influencer: [
    { question: "How do I get paid?", answer: "Payments release after deliverable approval into your wallet." },
    { question: "Can I dispute a rejection?", answer: "Yes — open a Dispute ticket with the campaign details." },
  ],
  owner: [
    { question: "How do I fund escrow?", answer: "Add funds to your brand wallet, then lock escrow on the campaign." },
  ],
  agent: [
    { question: "How do agency approvals work?", answer: "Admins approve new agencies before full marketplace access." },
  ],
  admin: [
    { question: "How do I resolve disputes?", answer: "Use Support Operations tickets (category Dispute)." },
  ],
};

const SUPPORT_ROLES = new Set(["support", "support_agent", "support_lead", "support_admin"]);

function statusClass(status) {
  if (status === "open" || status === "new") return "bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30";
  if (["in_progress", "waiting_user", "pending_user", "pending_support", "assigned"].includes(status)) {
    return "bg-[#FF9500]/15 text-[#FF9500] border border-[#FF9500]/30";
  }
  return "bg-white/10 text-white/40 border border-white/10";
}

/** End-user Help & Support (Influencer / Company / Agent). Support staff → /support/ops. */
export default function SupportCenter() {
  const { user } = useAuth();
  const role = user?.role || "influencer";
  const isSupportOps = SUPPORT_ROLES.has(role);

  const [faqs, setFaqs] = useState(FALLBACK_FAQ[role] || FALLBACK_FAQ.influencer);
  const [activeFaq, setActiveFaq] = useState(null);
  const [form, setForm] = useState({ subject: "", category: "Payment", priority: "Medium", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [busyDetail, setBusyDetail] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const { data } = await api.get("/support/tickets");
      setTickets(data.tickets || []);
    } catch {
      toast.error("Failed to load tickets");
    }
  }, []);

  useEffect(() => {
    if (isSupportOps) return undefined;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/support/faqs");
        if (data?.faqs?.length) setFaqs(data.faqs);
      } catch { /* fallback */ }
      await loadTickets();
      setLoading(false);
    })();
  }, [loadTickets, isSupportOps]);

  if (isSupportOps) {
    return <Navigate to="/support/ops" replace />;
  }

  const openTicket = async (id) => {
    setSelectedId(id);
    setBusyDetail(true);
    try {
      const { data } = await api.get(`/support/tickets/${id}`);
      setDetail(data);
      setReply("");
    } catch {
      toast.error("Failed to open ticket");
      setSelectedId(null);
    } finally {
      setBusyDetail(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data } = await api.post("/support/tickets", form);
      toast.success(`Ticket ${data.ticket?.number || ""} created`);
      setSuccess(true);
      setForm({ subject: "", category: "Payment", priority: "Medium", description: "" });
      await loadTickets();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit ticket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setBusyDetail(true);
    try {
      await api.post(`/support/tickets/${selectedId}/messages`, { body: reply.trim() });
      setReply("");
      const { data } = await api.get(`/support/tickets/${selectedId}`);
      setDetail(data);
      await loadTickets();
      toast.success("Reply sent");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send");
    } finally {
      setBusyDetail(false);
    }
  };

  const ticket = detail?.ticket;

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="mb-6 border-b border-white/10 pb-4 pr-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <AiIcon name="support" className="w-3.5 h-3.5" /> Support Center
            </p>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1.5 mb-2">Help & Support</h1>
            <p className="font-sans text-white/60 max-w-2xl text-sm">
              Find answers or reach CR8 Support Operations. Prefer AI Help for quick questions.
            </p>
          </div>
          <Link
            to="/help"
            className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full hover:bg-white/10 font-mono text-[10px] tracking-widest uppercase"
          >
            <AiIcon name="ai" className="w-3.5 h-3.5" /> AI Help
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pb-10">
        <div className="space-y-10">
          <section>
            <h2 className="font-sans text-xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.04] gap-4"
                  >
                    <span className="font-sans text-sm font-semibold">{faq.question}</span>
                    <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${activeFaq === idx ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {activeFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 text-white/60 text-sm leading-relaxed"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-sans text-xl font-bold tracking-tight mb-4">My Tickets</h2>
            {loading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : tickets.length === 0 ? (
              <p className="text-white/40 text-sm">No tickets yet.</p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTicket(t.id)}
                    className={`w-full text-left p-4 border rounded-2xl flex items-center justify-between ${
                      selectedId === t.id ? "border-[#FF3B30]/50 bg-[#FF3B30]/10" : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div>
                      <div className="font-mono text-[10px] tracking-widest text-white/40 mb-1">
                        {t.number} · {(t.created_at || "").slice(0, 10)}
                      </div>
                      <div className="font-sans font-medium text-base">{t.subject}</div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider shrink-0 ${statusClass(t.status)}`}>
                      {(t.status || "").replace(/_/g, " ")}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div>
          {selectedId && ticket ? (
            <div className="border border-white/10 bg-[#121212] rounded-3xl p-5 sticky top-4 max-h-[80vh] flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="font-mono text-[10px] text-white/40 tracking-widest">{ticket.number} · {ticket.category}</div>
                  <h2 className="font-sans text-xl font-bold mt-1">{ticket.subject}</h2>
                </div>
                <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[160px]">
                {(detail.messages || []).map((m) => (
                  <div key={m.id} className={`p-3 rounded-2xl text-sm ${m.author_id === user?.id ? "bg-[#FF3B30]/15 ml-6" : "bg-white/[0.04] mr-6 border border-white/10"}`}>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> {m.author_name}
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Add more details…" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl mb-2" />
              <button type="button" disabled={busyDetail || !reply.trim()} onClick={sendReply} className="w-full bg-[#FF3B30] text-white font-mono text-[10px] tracking-widest uppercase py-2.5 font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          ) : (
            <div className="border border-white/10 bg-[#121212] rounded-3xl p-6 sticky top-4">
              <h2 className="font-sans text-2xl font-bold mb-6">Raise a Ticket</h2>
              {success ? (
                <div className="bg-[#34C759]/10 border border-[#34C759]/30 text-[#34C759] p-6 rounded-3xl text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 mx-auto" />
                  <p className="font-sans text-sm font-semibold tracking-wider uppercase">Ticket Submitted</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Subject</label>
                    <input type="text" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Category</label>
                      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm">
                        {["Payment", "Account", "Technical Bug", "Dispute", "Campaign", "Profile", "Other"].map((c) => (
                          <option key={c} className="bg-[#121212]" value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Priority</label>
                      <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm">
                        {["Low", "Medium", "High", "Critical"].map((p) => (
                          <option key={p} className="bg-[#121212]" value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Description</label>
                    <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-[#FF3B30] text-white font-mono text-xs tracking-widest uppercase py-3 font-bold disabled:opacity-50">
                    {isSubmitting ? "Submitting..." : "Submit Ticket"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
