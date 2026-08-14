import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LifeBuoy, Loader2, MessageSquare, Send, X, Filter, UserPlus, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const USER_TYPES = [
  { id: "", label: "All" },
  { id: "influencer", label: "Influencer" },
  { id: "company", label: "Company" },
  { id: "agent", label: "Agent" },
];

const STATUS_OPTS = [
  { id: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling", label: "Active" },
  { id: "new", label: "New" },
  { id: "unassigned_flag", label: "Unassigned" },
  { id: "mine_flag", label: "My Tickets" },
  { id: "ai_handling", label: "AI Handling" },
  { id: "in_progress,assigned", label: "In Progress" },
  { id: "pending_user", label: "Pending User" },
  { id: "pending_support", label: "Pending Support" },
  { id: "escalated_flag", label: "Escalated" },
  { id: "resolved,closed", label: "Resolved" },
  { id: "", label: "All statuses" },
];

function statusClass(status) {
  if (status === "new" || status === "open") return "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/30";
  if (["in_progress", "assigned", "pending_user", "pending_support", "ai_handling", "reopened"].includes(status)) {
    return "bg-[#FF9500]/15 text-[#FF9500] border-[#FF9500]/30";
  }
  return "bg-white/10 text-white/40 border-white/10";
}

function typeLabel(t) {
  if (t === "company" || t === "owner") return "Company";
  if (t === "influencer") return "Influencer";
  if (t === "agent") return "Agent";
  return t || "User";
}

const KPI_KEYS = [
  ["total", "Total"],
  ["new", "New"],
  ["unassigned", "Unassigned"],
  ["my_open", "My Open"],
  ["influencer", "Influencer"],
  ["company", "Company"],
  ["agent", "Agent"],
  ["critical", "Critical"],
  ["ai_resolved", "AI Resolved"],
  ["ai_escalated", "AI Escalated"],
  ["pending_user", "Pending User"],
  ["pending_support", "Pending Support"],
  ["sla_breached", "SLA Breached"],
  ["finished_today_by_me", "Resolved Today (me)"],
];

export default function SupportDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("tickets"); // overview | tickets | staff
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTS[0].id);
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", name: "", username: "", password: "demo1234", support_role: "support_agent" });

  const canAssign = perms.includes("support.tickets.assign");
  const canManageUsers = perms.includes("support.users.manage");
  const canViewStaff = perms.includes("support.users.view");

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get("/support/me");
      setPerms(data.permissions || []);
    } catch { /* ignore */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/support/stats");
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userType) params.set("user_type", userType);
      if (priority) params.set("priority", priority);
      if (q.trim()) params.set("q", q.trim());

      let assignment = "";
      let status = statusFilter;
      let escalated;
      if (statusFilter === "unassigned_flag") {
        assignment = "unassigned";
        status = "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling";
      } else if (statusFilter === "mine_flag") {
        assignment = "mine";
        status = "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling";
      } else if (statusFilter === "escalated_flag") {
        escalated = true;
        status = "";
      }
      if (status) params.set("status", status);
      if (assignment) params.set("assignment", assignment);
      if (escalated) params.set("escalated", "true");

      const { data } = await api.get(`/support/tickets?${params}`);
      setTickets(data.tickets || []);
    } catch {
      toast.error("Failed to load tickets");
    }
  }, [userType, priority, q, statusFilter]);

  const loadAgents = useCallback(async () => {
    if (!canAssign) return;
    try {
      const { data } = await api.get("/support/agents");
      setAgents(data.agents || []);
    } catch { /* ignore */ }
  }, [canAssign]);

  const loadStaff = useCallback(async () => {
    if (!canViewStaff) return;
    try {
      const { data } = await api.get("/support/staff");
      setStaff(data.users || []);
    } catch { /* ignore */ }
  }, [canViewStaff]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMe();
      await Promise.all([loadStats(), loadTickets()]);
      setLoading(false);
    })();
  }, [loadMe, loadStats, loadTickets]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (tab === "staff") loadStaff();
  }, [tab, loadStaff]);

  const openTicket = async (id) => {
    setSelectedId(id);
    setBusy(true);
    try {
      const { data } = await api.get(`/support/tickets/${id}`);
      setDetail(data);
      setReply("");
      if (data.permissions) setPerms(data.permissions);
    } catch {
      toast.error("Failed to open ticket");
      setSelectedId(null);
    } finally {
      setBusy(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedId) return;
    const { data } = await api.get(`/support/tickets/${selectedId}`);
    setDetail(data);
    await loadTickets();
    await loadStats();
  };

  const claim = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.post(`/support/tickets/${selectedId}/claim`);
      toast.success("Ticket claimed");
      await refreshDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (body) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api.patch(`/support/tickets/${selectedId}`, body);
      toast.success("Updated");
      await refreshDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async ({ internal = false } = {}) => {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    try {
      await api.post(`/support/tickets/${selectedId}/messages`, { body: reply.trim(), internal });
      setReply("");
      toast.success(internal ? "Internal note added" : "Reply sent");
      await refreshDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const draftAi = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/support/tickets/${selectedId}/ai-draft`, {});
      setReply(data.draft || "");
      toast.success("AI draft ready");
    } catch {
      toast.error("AI draft unavailable");
    } finally {
      setBusy(false);
    }
  };

  const createStaff = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/support/staff", newStaff);
      toast.success("Support user created");
      setNewStaff({ email: "", name: "", username: "", password: "demo1234", support_role: "support_agent" });
      await loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const ticket = detail?.ticket;
  const roleLabel = useMemo(() => {
    const r = user?.role;
    if (r === "support_admin") return "Support Admin";
    if (r === "support_lead") return "Support Lead";
    return "Support Agent";
  }, [user?.role]);

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full flex-1 pb-8">
      <div className="shrink-0 border-b border-white/10 pb-5 mb-5">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
          <LifeBuoy className="w-3.5 h-3.5" /> Support Operations
        </p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mt-2">
          <div>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Support Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">{roleLabel} · Independent ops category (not Influencer / Company / Agent)</p>
          </div>
          <div className="flex gap-2 font-mono text-[10px] uppercase tracking-widest">
            {[
              ["overview", "Overview"],
              ["tickets", "Tickets"],
              ...(canViewStaff ? [["staff", "Users"]] : []),
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-full border ${tab === id ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15 text-white/50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(tab === "overview" || tab === "tickets") && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {KPI_KEYS.map(([key, label]) => (
            <div key={key} className="border border-white/10 bg-white/[0.02] rounded-xl px-3 py-2">
              <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">{label}</div>
              <div className="font-sans text-xl font-bold mt-0.5 tabular-nums">{stats[key] ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "overview" && (
        <div className="text-white/50 text-sm">
          Use the <button type="button" className="text-[#FF3B30] underline" onClick={() => setTab("tickets")}>Tickets</button> tab to claim, filter by user type, and resolve Influencer / Company / Agent issues.
        </div>
      )}

      {tab === "tickets" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-3.5 h-3.5 text-[#FF3B30]" />
              <select value={userType} onChange={(e) => setUserType(e.target.value)} className="bg-white/5 border border-white/10 px-2 py-1 text-xs rounded-lg">
                {USER_TYPES.map((u) => <option key={u.id || "all"} value={u.id}>{u.label}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 px-2 py-1 text-xs rounded-lg">
                {STATUS_OPTS.map((s) => <option key={s.id || "allst"} value={s.id}>{s.label}</option>)}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="bg-white/5 border border-white/10 px-2 py-1 text-xs rounded-lg">
                <option value="">Priority</option>
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="bg-white/5 border border-white/10 px-2 py-1 text-xs rounded-lg flex-1 min-w-[8rem]"
              />
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : tickets.length === 0 ? (
              <p className="text-white/40 text-sm">No tickets match filters.</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left p-3 border rounded-2xl transition-colors ${
                    selectedId === t.id ? "border-[#FF3B30]/50 bg-[#FF3B30]/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="font-mono text-[9px] tracking-widest text-white/40 mb-1 flex flex-wrap gap-x-2">
                    <span>{t.number}</span>
                    <span>{typeLabel(t.user_type || t.user_role)}</span>
                    <span>{t.priority}</span>
                    {t.ai_status && t.ai_status !== "none" && <span className="text-[#FF3B30]">{t.ai_status}</span>}
                  </div>
                  <div className="font-sans font-medium text-sm truncate">{t.subject}</div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[10px] text-white/40 truncate">{t.user_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase border ${statusClass(t.status)}`}>
                      {(t.status || "").replace(/_/g, " ")}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-3">
            {selectedId && ticket ? (
              <div className="border border-white/10 bg-[#121212] rounded-3xl p-5 sticky top-4 max-h-[82vh] flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-mono text-[10px] text-white/40 tracking-widest">
                      {ticket.number} · {typeLabel(ticket.user_type)} · {ticket.category} · {ticket.priority}
                    </div>
                    <h2 className="font-sans text-xl font-bold mt-1">{ticket.subject}</h2>
                    <p className="text-xs text-white/50 mt-1">
                      {ticket.user_name} · {ticket.user_email} · ID {ticket.user_id?.slice(0, 8)}…
                    </p>
                    {ticket.sla_due_at && (
                      <p className={`text-[10px] mt-1 font-mono ${ticket.sla_breached ? "text-[#FF3B30]" : "text-white/40"}`}>
                        SLA due {ticket.sla_due_at.slice(0, 16).replace("T", " ")}
                        {ticket.sla_breached ? " · BREACHED" : ""}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {detail.user_context && (
                  <div className="mb-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] text-xs text-white/70 space-y-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">User context</div>
                    <div>{detail.user_context.name} · {typeLabel(detail.user_context.user_type)}</div>
                    {detail.user_context.company && <div>Company: {detail.user_context.company}</div>}
                    {detail.user_context.handle && <div>Handle: {detail.user_context.handle}</div>}
                    {detail.user_context.city && <div>City: {detail.user_context.city}</div>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {!ticket.assignee_id && (
                    <button type="button" disabled={busy} onClick={claim} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border border-[#FF3B30]/40 text-[#FF3B30]">
                      <UserPlus className="w-3 h-3 inline mr-1" /> Claim
                    </button>
                  )}
                  {["open", "assigned", "in_progress", "pending_user", "pending_support", "resolved", "closed", "reopened"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => patch({ status: s })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border ${
                        ticket.status === s ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15 text-white/50"
                      }`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                  <button type="button" disabled={busy} onClick={() => patch({ escalate: true })} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border border-white/15 text-[#FF9500]">
                    Escalate
                  </button>
                  <button type="button" disabled={busy} onClick={draftAi} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border border-white/15 text-[#FF3B30]">
                    AI draft
                  </button>
                  {canAssign && agents.length > 0 && (
                    <select
                      className="bg-white/5 border border-white/15 px-2 py-1 text-[10px] rounded-full"
                      value={ticket.assignee_id || ""}
                      onChange={(e) => patch({ assignee_id: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                      ))}
                    </select>
                  )}
                </div>

                {(ticket.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {ticket.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono border border-white/15 text-white/50">
                        <Tag className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 custom-scrollbar min-h-[180px]">
                  {(detail.messages || []).map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-2xl text-sm ${
                        m.internal
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : m.source === "ai" || m.author_role === "ai"
                            ? "bg-white/[0.03] border border-white/10 border-dashed"
                            : m.author_id === user?.id
                              ? "bg-[#FF3B30]/15 border border-[#FF3B30]/25 ml-4"
                              : "bg-white/[0.04] border border-white/10 mr-4"
                      }`}
                    >
                      <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        {m.author_name} · {m.author_role}
                        {m.internal ? " · internal" : ""}
                        {m.source === "ai" ? " · AI" : ""}
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
                    placeholder="Reply to user or add internal note…"
                    className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] resize-none rounded-xl"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !reply.trim()}
                      onClick={() => sendReply({ internal: false })}
                      className="flex-1 bg-[#FF3B30] text-white font-mono text-[10px] tracking-widest uppercase py-2.5 font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" /> Reply
                    </button>
                    <button
                      type="button"
                      disabled={busy || !reply.trim()}
                      onClick={() => sendReply({ internal: true })}
                      className="px-3 border border-white/20 font-mono text-[10px] tracking-widest uppercase disabled:opacity-50"
                    >
                      Internal
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-white/15 rounded-3xl p-10 text-center text-white/40 text-sm">
                Select a ticket to view details, AI history, and reply.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "staff" && canViewStaff && (
        <div className="space-y-6">
          <div className="overflow-x-auto border border-white/10 rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[9px] uppercase tracking-widest text-white/40 border-b border-white/10">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Open</th>
                  <th className="p-3">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3 text-white/60">{u.email}</td>
                    <td className="p-3 font-mono text-xs">{u.support_role || u.role}</td>
                    <td className="p-3">{u.status}</td>
                    <td className="p-3">{u.open_tickets}</td>
                    <td className="p-3">{u.resolved_tickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManageUsers && (
            <form onSubmit={createStaff} className="border border-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
              <h3 className="md:col-span-2 font-sans font-bold">Create Support User</h3>
              <input required placeholder="Name" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} className="bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <input required type="email" placeholder="Email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} className="bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <input required placeholder="Username" value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })} className="bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <select value={newStaff.support_role} onChange={(e) => setNewStaff({ ...newStaff, support_role: e.target.value })} className="bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl">
                <option value="support_agent">Support Agent</option>
                <option value="support_lead">Support Lead</option>
                <option value="support_admin">Support Admin</option>
              </select>
              <input required type="password" placeholder="Password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <button type="submit" disabled={busy} className="bg-[#FF3B30] text-white font-mono text-xs uppercase tracking-widest py-2 rounded-xl disabled:opacity-50">
                Create
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
