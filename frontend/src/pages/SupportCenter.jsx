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
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
    { question: "How do I resolve disputes?", answer: "Use the Support Desk ticket queue (category Dispute)." },
  ],
  support: [
    { question: "How do I take a ticket?", answer: "Open it and set status to In Progress — you become assignee." },
  ],
  support_admin: [
    { question: "How do I assign agents?", answer: "Use Assign on a ticket and pick a support agent." },
  ],
};

const STAFF_ROLES = new Set(["support", "support_admin", "admin"]);

function statusClass(status) {
  if (status === "open") return "bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30";
  if (status === "in_progress" || status === "waiting_user") return "bg-[#FF9500]/15 text-[#FF9500] border border-[#FF9500]/30";
  return "bg-white/10 text-white/40 border border-white/10";
}

export default function SupportCenter() {
  const { user } = useAuth();
  const role = user?.role || "influencer";
  const isStaff = STAFF_ROLES.has(role);

  const [faqs, setFaqs] = useState(FALLBACK_FAQ[role] || FALLBACK_FAQ.influencer);
  const [activeFaq, setActiveFaq] = useState(null);
  const [form, setForm] = useState({ subject: "", category: "Payment", priority: "Medium", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(isStaff ? "open,in_progress,waiting_user" : "");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [busyDetail, setBusyDetail] = useState(false);
  const [agents, setAgents] = useState([]);

  const loadTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await api.get(`/support/tickets?${params.toString()}`);
      setTickets(data.tickets || []);
    } catch (e) {
      toast.error("Failed to load tickets");
    }
  }, [statusFilter]);

  const loadFaqs = useCallback(async () => {
    try {
      const { data } = await api.get("/support/faqs");
      if (data?.faqs?.length) setFaqs(data.faqs);
    } catch {
      /* fallback FAQs already set */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadFaqs(), loadTickets()]);
      if (isStaff) {
        try {
          const { data } = await api.get("/support/stats");
          if (!cancelled) setStats(data);
        } catch { /* ignore */ }
        if (role === "support_admin" || role === "admin") {
          try {
            const { data } = await api.get("/support/agents");
            if (!cancelled) setAgents(data.agents || []);
          } catch { /* ignore */ }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadFaqs, loadTickets, isStaff, role]);

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

  const sendReply = async ({ internal = false } = {}) => {
    if (!selectedId || !reply.trim()) return;
    setBusyDetail(true);
    try {
      await api.post(`/support/tickets/${selectedId}/messages`, { body: reply.trim(), internal });
      setReply("");
      const { data } = await api.get(`/support/tickets/${selectedId}`);
      setDetail(data);
      await loadTickets();
      toast.success(internal ? "Internal note added" : "Reply sent");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send");
    } finally {
      setBusyDetail(false);
    }
  };

  const patchTicket = async (patch) => {
    if (!selectedId) return;
    setBusyDetail(true);
    try {
      await api.patch(`/support/tickets/${selectedId}`, patch);
      const { data } = await api.get(`/support/tickets/${selectedId}`);
      setDetail(data);
      await loadTickets();
      toast.success("Ticket updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setBusyDetail(false);
    }
  };

  const draftAi = async () => {
    if (!selectedId) return;
    setBusyDetail(true);
    try {
      const { data } = await api.post(`/support/tickets/${selectedId}/ai-draft`, {});
      setReply(data.draft || "");
      toast.success("AI draft ready — review before sending");
    } catch {
      toast.error("AI draft unavailable");
    } finally {
      setBusyDetail(false);
    }
  };

  const ticket = detail?.ticket;

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full flex-1">
      <div className="shrink-0 space-y-4 mb-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 w-full">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <LifeBuoy className="w-3.5 h-3.5" /> {isStaff ? "Support Desk" : "Support Center"}
              </p>
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-2 mb-2">
                {isStaff ? "Ticket Queue" : "Help & Support"}
              </h1>
              <p className="font-sans text-white/60 max-w-2xl text-sm">
                {isStaff
                  ? "Triage, reply, and resolve user tickets. Use AI draft for faster responses."
                  : "Find answers or reach the CR8 team. Prefer AI Help for quick questions."}
              </p>
            </div>
            <Link
              to="/help"
              className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full hover:bg-white/10 font-mono text-[10px] tracking-widest uppercase"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF3B30]" /> AI Help
            </Link>
          </div>
        </motion.div>
      </div>

      {isStaff && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            ["Open", stats.open],
            ["Urgent", stats.urgent],
            ["Assigned to me", stats.assigned_to_me],
            ["Resolved today", stats.resolved_today],
          ].map(([label, value]) => (
            <div key={label} className="border border-white/10 bg-white/[0.02] rounded-2xl px-4 py-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">{label}</div>
              <div className="font-sans text-2xl font-bold mt-1">{value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
        <div className={`grid grid-cols-1 ${isStaff ? "lg:grid-cols-5" : "lg:grid-cols-2"} gap-10`}>
          {/* FAQ + list */}
          <div className={`space-y-10 ${isStaff ? "lg:col-span-2" : ""}`}>
            {!isStaff && (
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
            )}

            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-sans text-xl font-bold tracking-tight">
                  {isStaff ? "All Tickets" : "My Tickets"}
                </h2>
                {isStaff && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 px-2 py-1 text-xs rounded-lg"
                  >
                    <option value="open,in_progress,waiting_user">Active</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="waiting_user">Waiting user</option>
                    <option value="resolved,closed">Resolved / closed</option>
                    <option value="">All</option>
                  </select>
                )}
              </div>
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
                      className={`w-full text-left p-4 border rounded-2xl flex items-center justify-between transition-colors ${
                        selectedId === t.id ? "border-[#FF3B30]/50 bg-[#FF3B30]/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div>
                        <div className="font-mono text-[10px] tracking-widest text-white/40 mb-1">
                          {t.number} · {(t.created_at || "").slice(0, 10)}
                          {t.user_name && isStaff ? ` · ${t.user_name}` : ""}
                          {t.priority ? ` · ${t.priority}` : ""}
                        </div>
                        <div className="font-sans font-medium text-base">{t.subject}</div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-white/35 mt-1">{t.category}</div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider shrink-0 ${statusClass(t.status)}`}>
                        {(t.status || "").replace("_", " ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Form or detail pane */}
          <div className={`${isStaff ? "lg:col-span-3" : ""}`}>
            {selectedId && ticket ? (
              <div className="border border-white/10 bg-[#121212] rounded-3xl p-5 sticky top-4 max-h-[80vh] flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="font-mono text-[10px] text-white/40 tracking-widest">{ticket.number} · {ticket.category}</div>
                    <h2 className="font-sans text-xl font-bold mt-1">{ticket.subject}</h2>
                    {isStaff && (
                      <p className="text-xs text-white/50 mt-1">
                        {ticket.user_name} · {ticket.user_email} · {ticket.user_role}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {isStaff && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyDetail}
                        onClick={() => patchTicket({ status: s, ...(s === "in_progress" && !ticket.assignee_id ? { assignee_id: user.id } : {}) })}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border ${
                          ticket.status === s ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15 text-white/50 hover:border-white/40"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                    {(role === "support_admin" || role === "admin") && agents.length > 0 && (
                      <select
                        className="bg-white/5 border border-white/15 px-2 py-1 text-[10px] rounded-full"
                        value={ticket.assignee_id || ""}
                        onChange={(e) => patchTicket({ assignee_id: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                        ))}
                      </select>
                    )}
                    <button type="button" onClick={draftAi} disabled={busyDetail} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider border border-white/15 text-[#FF3B30] hover:bg-[#FF3B30]/10">
                      AI draft
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar min-h-[200px]">
                  {(detail.messages || []).map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-2xl text-sm ${
                        m.internal
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-100/90"
                          : m.author_id === user?.id
                            ? "bg-[#FF3B30]/15 border border-[#FF3B30]/25 ml-6"
                            : "bg-white/[0.04] border border-white/10 mr-6"
                      }`}
                    >
                      <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        {m.author_name} · {m.author_role}
                        {m.internal ? " · internal" : ""}
                        · {(m.created_at || "").slice(0, 16).replace("T", " ")}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder={isStaff ? "Reply to user…" : "Add more details…"}
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] resize-none rounded-xl"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyDetail || !reply.trim()}
                      onClick={() => sendReply({ internal: false })}
                      className="flex-1 bg-[#FF3B30] text-white font-mono text-[10px] tracking-widest uppercase py-2.5 font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                    {isStaff && (
                      <button
                        type="button"
                        disabled={busyDetail || !reply.trim()}
                        onClick={() => sendReply({ internal: true })}
                        className="px-3 border border-white/20 font-mono text-[10px] tracking-widest uppercase disabled:opacity-50"
                      >
                        Internal
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              !isStaff && (
                <div className="border border-white/10 bg-[#121212] rounded-3xl p-6 sticky top-4">
                  <h2 className="font-sans text-2xl font-bold mb-6">Raise a Ticket</h2>
                  {success ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-[#34C759]/10 border border-[#34C759]/30 text-[#34C759] p-6 rounded-3xl text-center space-y-3"
                    >
                      <CheckCircle2 className="w-10 h-10 mx-auto" />
                      <p className="font-sans text-sm font-semibold tracking-wider uppercase">Ticket Submitted</p>
                      <p className="text-xs opacity-80">Our team will get back to you shortly.</p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Subject</label>
                        <input
                          type="text"
                          required
                          value={form.subject}
                          onChange={(e) => setForm({ ...form, subject: e.target.value })}
                          placeholder="Brief description of the issue"
                          className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Category</label>
                          <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] appearance-none"
                          >
                            {["Payment", "Account", "Technical Bug", "Dispute", "Other"].map((c) => (
                              <option key={c} className="bg-[#121212]" value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Priority</label>
                          <select
                            value={form.priority}
                            onChange={(e) => setForm({ ...form, priority: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] appearance-none"
                          >
                            {["Low", "Medium", "High", "Urgent"].map((p) => (
                              <option key={p} className="bg-[#121212]" value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] uppercase tracking-widest opacity-50 mb-1.5">Description</label>
                        <textarea
                          required
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={4}
                          placeholder="Please provide details about your issue..."
                          className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[#FF3B30] text-white font-mono text-xs tracking-widest uppercase py-3 font-bold hover:bg-[#FF3B30]/90 disabled:opacity-50"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Ticket"}
                      </button>
                    </form>
                  )}
                </div>
              )
            )}
            {isStaff && !selectedId && (
              <div className="border border-dashed border-white/15 rounded-3xl p-10 text-center text-white/40 text-sm">
                Select a ticket to view the thread and reply.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
