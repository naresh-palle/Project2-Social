import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2, MessageSquare, Send, X, UserPlus, Tag, Plus,
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

const AI_STATUS_OPTS = [
  { id: "", label: "AI Status" },
  { id: "ai_handling", label: "AI Handling" },
  { id: "ai_resolved", label: "AI Resolved" },
  { id: "ai_escalated", label: "AI Escalated" },
  { id: "human_handling", label: "Human Handling" },
];

const QUEUE_FILTERS = [
  { id: "all", label: "All Tickets" },
  { id: "unassigned", label: "Unassigned" },
  { id: "mine", label: "My Tickets" },
  { id: "influencer", label: "Influencer" },
  { id: "company", label: "Company" },
  { id: "agent", label: "Agent" },
  { id: "escalated", label: "Escalated" },
  { id: "resolved", label: "Resolved" },
];

const QUEUE_PRESETS = {
  all: { status: "", assignment: "", userType: "", escalated: false },
  unassigned: {
    status: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling",
    assignment: "unassigned",
    userType: "",
    escalated: false,
  },
  mine: {
    status: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling",
    assignment: "mine",
    userType: "",
    escalated: false,
  },
  influencer: {
    status: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling",
    assignment: "",
    userType: "influencer",
    escalated: false,
  },
  company: {
    status: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling",
    assignment: "",
    userType: "company",
    escalated: false,
  },
  agent: {
    status: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling",
    assignment: "",
    userType: "agent",
    escalated: false,
  },
  escalated: { status: "", assignment: "", userType: "", escalated: true },
  resolved: { status: "resolved,closed", assignment: "", userType: "", escalated: false },
};

const STATUS_OPTS = [
  { id: "new,open,assigned,in_progress,pending_user,pending_support,reopened,ai_handling", label: "Active" },
  { id: "new", label: "New" },
  { id: "ai_handling", label: "AI Handling" },
  { id: "open", label: "Open" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "pending_user", label: "Pending User" },
  { id: "pending_support", label: "Pending Support" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
  { id: "reopened", label: "Reopened" },
  { id: "", label: "All statuses" },
];

const FILTER_SELECT =
  "bg-[#1A1A1E] text-[#F4F4F0] border border-white/25 px-2.5 py-1.5 text-xs rounded-lg font-sans appearance-none cursor-pointer focus:outline-none focus:border-[#FF3B30] min-w-[7.5rem]";
const FILTER_OPTION = { backgroundColor: "#1A1A1E", color: "#F4F4F0" };
const FILTER_INPUT =
  "bg-[#1A1A1E] text-[#F4F4F0] border border-white/25 px-2.5 py-1.5 text-xs rounded-lg font-sans placeholder:text-white/40 focus:outline-none focus:border-[#FF3B30] flex-1 min-w-[8rem]";

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

function fmtTs(v) {
  if (!v) return "—";
  return String(v).slice(0, 16).replace("T", " ");
}

const KPI_KEYS = [
  ["total", "Total Tickets"],
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
  ["resolved_today", "Resolved Today"],
];

export default function SupportDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = searchParams.get("tab") || "dashboard";
  const tab = tabRaw === "overview" ? "dashboard" : tabRaw;
  const queue = searchParams.get("queue") || "all";
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [kb, setKb] = useState([]);
  const [aiConfig, setAiConfig] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [audit, setAudit] = useState([]);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTS[0].id);
  const [priority, setPriority] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [assignmentAgent, setAssignmentAgent] = useState("");
  const [q, setQ] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: "", name: "", username: "", password: "demo1234", support_role: "support_agent",
  });
  const [newKb, setNewKb] = useState({ title: "", body: "", tags: "" });

  const can = (p) => perms.includes(p);
  const canAssign = can("support.tickets.assign");
  const canEscalate = can("support.tickets.escalate");
  const canReply = can("support.tickets.reply");
  const canInternal = can("support.tickets.internal_note");
  const canResolve = can("support.tickets.resolve");
  const canReopen = can("support.tickets.reopen");
  const canManageUsers = can("support.users.manage");
  const canViewStaff = can("support.users.view");
  const canViewKb = can("support.knowledge_base.view");
  const canManageKb = can("support.knowledge_base.manage");
  const canAiConfig = can("support.ai.configure");
  const canAnalytics = can("support.analytics.view") || can("support.analytics.view_own");
  const canAudit = can("support.audit.view");

  const setTab = (nextTab, nextQueue) => {
    const sp = new URLSearchParams();
    sp.set("tab", nextTab);
    if (nextTab === "tickets" && nextQueue) sp.set("queue", nextQueue);
    setSearchParams(sp);
  };

  // Apply queue preset when queue changes (KPI / deep links)
  useEffect(() => {
    if (tab !== "tickets") return;
    if (!queue || !QUEUE_PRESETS[queue]) return;
    const preset = QUEUE_PRESETS[queue];
    setUserType(preset.userType);
    setStatusFilter(preset.status);
    setAssignmentAgent(preset.assignment === "mine" || preset.assignment === "unassigned" ? preset.assignment : "");
  }, [tab, queue]);

  const applyQueueFilter = (qid) => {
    const preset = QUEUE_PRESETS[qid] || QUEUE_PRESETS.all;
    setUserType(preset.userType);
    setStatusFilter(preset.status);
    setAssignmentAgent(preset.assignment === "mine" || preset.assignment === "unassigned" ? preset.assignment : "");
    const sp = new URLSearchParams();
    sp.set("tab", "tickets");
    if (qid && qid !== "all") sp.set("queue", qid);
    setSearchParams(sp);
  };
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
      const preset = QUEUE_PRESETS[queue] || QUEUE_PRESETS.all;
      const ut = userType || preset.userType;
      const st = statusFilter || preset.status;
      let assignment = assignmentAgent || preset.assignment || "";
      let escalated = preset.escalated ? true : undefined;

      if (ut) params.set("user_type", ut);
      if (priority) params.set("priority", priority);
      if (aiStatus) params.set("ai_status", aiStatus);
      if (q.trim()) params.set("q", q.trim());
      if (st) params.set("status", st);
      if (assignment) params.set("assignment", assignment);
      if (escalated) params.set("escalated", "true");

      const { data } = await api.get(`/support/tickets?${params}`);
      setTickets(data.tickets || []);
    } catch {
      toast.error("Failed to load tickets");
    }
  }, [userType, priority, q, statusFilter, aiStatus, assignmentAgent, queue]);

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

  const loadKb = useCallback(async () => {
    if (!canViewKb) return;
    try {
      const { data } = await api.get("/support/knowledge");
      setKb(data.articles || []);
    } catch { /* ignore */ }
  }, [canViewKb]);

  const loadAi = useCallback(async () => {
    if (!canAiConfig && !canViewKb) return;
    try {
      const { data } = await api.get("/support/ai/config");
      setAiConfig(data.config || null);
    } catch { /* ignore */ }
  }, [canAiConfig, canViewKb]);

  const loadAnalytics = useCallback(async () => {
    if (!canAnalytics) return;
    try {
      const { data } = await api.get("/support/analytics");
      setAnalytics(data);
    } catch { /* ignore */ }
  }, [canAnalytics]);

  const loadAudit = useCallback(async () => {
    if (!canAudit) return;
    try {
      const { data } = await api.get("/support/audit?limit=150");
      setAudit(data.logs || []);
    } catch { /* ignore */ }
  }, [canAudit]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMe();
      await loadStats();
      setLoading(false);
    })();
  }, [loadMe, loadStats]);

  useEffect(() => {
    if (tab === "tickets" || tab === "dashboard") loadTickets();
  }, [tab, loadTickets]);

  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { if (tab === "staff") loadStaff(); }, [tab, loadStaff]);
  useEffect(() => { if (tab === "knowledge") loadKb(); }, [tab, loadKb]);
  useEffect(() => { if (tab === "ai") loadAi(); }, [tab, loadAi]);
  useEffect(() => { if (tab === "analytics" || tab === "dashboard") loadAnalytics(); }, [tab, loadAnalytics]);
  useEffect(() => { if (tab === "audit") loadAudit(); }, [tab, loadAudit]);

  const openTicket = async (id) => {
    setSelectedId(id);
    setBusy(true);
    try {
      const { data } = await api.get(`/support/tickets/${id}`);
      setDetail(data);
      setReply("");
      setTagInput((data.ticket?.tags || []).join(", "));
      if (data.permissions) setPerms(data.permissions);
      if (tab !== "tickets") setTab("tickets", queue || "all");
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
    setTagInput((data.ticket?.tags || []).join(", "));
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
    if (!selectedId || !canReply) return;
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

  const saveTags = async () => {
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    await patch({ tags });
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

  const patchStaff = async (id, body) => {
    setBusy(true);
    try {
      await api.patch(`/support/staff/${id}`, body);
      toast.success("Updated");
      await loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const createKb = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/support/knowledge", {
        title: newKb.title,
        body: newKb.body,
        tags: newKb.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setNewKb({ title: "", body: "", tags: "" });
      toast.success("Article created");
      await loadKb();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveAiConfig = async () => {
    if (!aiConfig || !canAiConfig) return;
    setBusy(true);
    try {
      const { data } = await api.patch("/support/ai/config", {
        enabled: !!aiConfig.enabled,
        auto_escalate: !!aiConfig.auto_escalate,
        greeting: aiConfig.greeting || "",
        max_history: Number(aiConfig.max_history) || 10,
      });
      setAiConfig(data.config);
      toast.success("AI config saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const ticket = detail?.ticket;

  const statusButtons = useMemo(() => {
    const all = ["open", "assigned", "in_progress", "pending_user", "pending_support", "resolved", "closed", "reopened"];
    return all.filter((s) => {
      if (s === "resolved" || s === "closed") return canResolve;
      if (s === "reopened") return canReopen;
      return perms.includes("support.tickets.update");
    });
  }, [perms, canResolve, canReopen]);

  const pageTitle = {
    dashboard: "Dashboard",
    tickets: "Tickets",
    staff: "Users",
    knowledge: "Knowledge Base",
    ai: "AI Support",
    analytics: "Analytics",
    audit: "Audit",
  }[tab] || "Dashboard";

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full flex-1 pb-8" data-testid="support-ops-dashboard">
      <div className="shrink-0 border-b border-white/10 pb-4 mb-5">
        <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">{pageTitle}</h1>
      </div>

      {tab === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {KPI_KEYS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "unassigned") setTab("tickets", "unassigned");
                  else if (key === "my_open") setTab("tickets", "mine");
                  else if (key === "influencer") setTab("tickets", "influencer");
                  else if (key === "company") setTab("tickets", "company");
                  else if (key === "agent") setTab("tickets", "agent");
                  else setTab("tickets", "all");
                }}
                className="text-left border border-white/10 bg-white/[0.02] rounded-xl px-3 py-2 hover:border-[#FF3B30]/40 transition-colors"
              >
                <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">{label}</div>
                <div className="font-sans text-xl font-bold mt-0.5 tabular-nums">{stats[key] ?? 0}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ["Unassigned", "unassigned", stats?.unassigned],
              ["Escalated", "escalated", analytics?.escalated_open ?? 0],
              ["My open", "mine", stats?.my_open],
            ].map(([label, qid, val]) => (
              <button
                key={qid}
                type="button"
                onClick={() => setTab("tickets", qid)}
                className="border border-white/10 rounded-2xl p-4 text-left hover:border-[#FF3B30]/40"
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</div>
                <div className="text-3xl font-bold mt-2">{val ?? 0}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "tickets" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select value={queue && QUEUE_PRESETS[queue] ? queue : "all"} onChange={(e) => applyQueueFilter(e.target.value)} className={`${FILTER_SELECT} w-full min-w-0`} aria-label="Ticket queue">
                {QUEUE_FILTERS.map((u) => (<option key={u.id} value={u.id} style={FILTER_OPTION}>{u.label}</option>))}
              </select>
              <select value={userType} onChange={(e) => setUserType(e.target.value)} className={`${FILTER_SELECT} w-full min-w-0`} aria-label="User type">
                {USER_TYPES.map((u) => (<option key={u.id || "all"} value={u.id} style={FILTER_OPTION}>{u.label === "All" ? "User Type" : u.label}</option>))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${FILTER_SELECT} w-full min-w-0`} aria-label="Status">
                {STATUS_OPTS.map((s) => (<option key={s.id || "allst"} value={s.id} style={FILTER_OPTION}>{s.label}</option>))}
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={`${FILTER_SELECT} w-full min-w-0`} aria-label="Priority">
                <option value="" style={FILTER_OPTION}>Priority</option>
                {["Low", "Medium", "High", "Critical"].map((p) => (<option key={p} value={p} style={FILTER_OPTION}>{p}</option>))}
              </select>
              <select value={aiStatus} onChange={(e) => setAiStatus(e.target.value)} className={`${FILTER_SELECT} w-full min-w-0`} aria-label="AI status">
                {AI_STATUS_OPTS.map((a) => (<option key={a.id || "aiall"} value={a.id} style={FILTER_OPTION}>{a.label}</option>))}
              </select>
              {canAssign ? (
                <select value={assignmentAgent} onChange={(e) => setAssignmentAgent(e.target.value)} className={`${FILTER_SELECT} w-full min-w-0`} aria-label="Assignment">
                  <option value="" style={FILTER_OPTION}>Assignment</option>
                  <option value="unassigned" style={FILTER_OPTION}>Unassigned</option>
                  <option value="mine" style={FILTER_OPTION}>My Tickets</option>
                  {agents.map((a) => (<option key={a.id} value={a.id} style={FILTER_OPTION}>{a.name}</option>))}
                </select>
              ) : <div />}
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={`${FILTER_INPUT} col-span-2 sm:col-span-3 w-full min-w-0`} />
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : tickets.length === 0 ? (
              <p className="text-white/40 text-sm">No tickets match filters.</p>
            ) : (
              tickets.map((t) => (
                <button key={t.id} type="button" onClick={() => openTicket(t.id)} className={`w-full text-left p-3 border rounded-2xl transition-colors ${selectedId === t.id ? "border-[#FF3B30]/50 bg-[#FF3B30]/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                  <div className="font-mono text-[9px] tracking-widest text-white/40 mb-1 flex flex-wrap gap-x-2">
                    <span>{t.number}</span>
                    <span>{typeLabel(t.user_type || t.user_role)}</span>
                    <span>{t.priority}</span>
                  </div>
                  <div className="font-sans font-medium text-sm truncate">{t.subject}</div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[10px] text-white/40 truncate">{t.user_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase border ${statusClass(t.status)}`}>{(t.status || "").replace(/_/g, " ")}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-3">
            {selectedId && ticket ? (
              <div className="border border-white/10 bg-[#121212] rounded-3xl p-5 sticky top-4 max-h-[82vh] flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-white/40 tracking-widest">{ticket.number} · {typeLabel(ticket.user_type)} · {ticket.priority}</div>
                    <h2 className="font-sans text-xl font-bold mt-1">{ticket.subject}</h2>
                    <p className="text-xs text-white/50 mt-1">{ticket.user_name} · {ticket.category} · {(ticket.status || "").replace(/_/g, " ")}{ticket.assignee_name ? ` · ${ticket.assignee_name}` : " · Unassigned"}</p>
                    {ticket.sla_due_at && (
                      <p className={`text-[10px] mt-1 font-mono ${ticket.sla_breached ? "text-[#FF3B30]" : "text-white/40"}`}>SLA {fmtTs(ticket.sla_due_at)}{ticket.sla_breached ? " · BREACHED" : ""}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="p-2 hover:bg-white/10 rounded-full shrink-0"><X className="w-4 h-4" /></button>
                </div>

                {detail.user_context && (
                  <div className="mb-3 p-3 rounded-xl border border-white/10 bg-white/[0.02] text-xs text-white/70 space-y-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">User</div>
                    <div>{detail.user_context.name} · {typeLabel(detail.user_context.user_type)}</div>
                    {detail.user_context.handle && <div>@{String(detail.user_context.handle).replace(/^@/, "")}</div>}
                    {detail.user_context.company && <div>{detail.user_context.company}</div>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {!ticket.assignee_id && can("support.tickets.claim") && (
                    <button type="button" disabled={busy} onClick={claim} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border border-[#FF3B30]/40 text-[#FF3B30]"><UserPlus className="w-3 h-3 inline mr-1" /> Claim</button>
                  )}
                  {statusButtons.map((s) => (
                    <button key={s} type="button" disabled={busy} onClick={() => patch({ status: s })} className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border ${ticket.status === s ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15 text-white/50"}`}>{s.replace(/_/g, " ")}</button>
                  ))}
                  {canEscalate && (<button type="button" disabled={busy} onClick={() => patch({ escalate: true })} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border border-white/15 text-[#FF9500]">Escalate</button>)}
                  {canReply && (<button type="button" disabled={busy} onClick={draftAi} className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase border border-white/15 text-[#FF3B30]">AI draft</button>)}
                  {can("support.tickets.update") && (
                    <select className={`${FILTER_SELECT} rounded-full text-[10px]`} value={ticket.priority || "Medium"} onChange={(e) => patch({ priority: e.target.value })}>
                      {["Low", "Medium", "High", "Critical"].map((p) => <option key={p} value={p} style={FILTER_OPTION}>{p}</option>)}
                    </select>
                  )}
                  {canAssign && agents.length > 0 && (
                    <select className={`${FILTER_SELECT} rounded-full text-[10px]`} value={ticket.assignee_id || ""} onChange={(e) => patch({ assignee_id: e.target.value })}>
                      <option value="" style={FILTER_OPTION}>Unassigned</option>
                      {agents.map((a) => (<option key={a.id} value={a.id} style={FILTER_OPTION}>{a.name}</option>))}
                    </select>
                  )}
                </div>

                {can("support.tickets.update") && (
                  <div className="flex gap-2 mb-3 items-center">
                    <Tag className="w-3.5 h-3.5 text-white/40" />
                    <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Tags" className="flex-1 bg-[#1A1A1E] text-[#F4F4F0] border border-white/25 px-2 py-1 text-xs rounded-lg" />
                    <button type="button" disabled={busy} onClick={saveTags} className="px-2 py-1 text-[10px] font-mono uppercase border border-white/15 rounded-lg">Save</button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 custom-scrollbar min-h-[180px]">
                  {(detail.messages || []).map((m) => (
                    <div key={m.id} className={`p-3 rounded-2xl text-sm ${m.internal ? "bg-amber-500/10 border border-amber-500/20" : m.source === "ai" || m.author_role === "ai" ? "bg-white/[0.03] border border-white/10 border-dashed" : m.author_id === user?.id ? "bg-[#FF3B30]/15 border border-[#FF3B30]/25 ml-4" : "bg-white/[0.04] border border-white/10 mr-4"}`}>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        {m.author_name}{m.internal ? " · internal" : ""}{m.source === "ai" ? " · AI" : ""} · {fmtTs(m.created_at)}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply or internal note…" className="w-full bg-[#1A1A1E] text-[#F4F4F0] border border-white/25 px-3 py-2 text-sm outline-none focus:border-[#FF3B30] resize-none rounded-xl" />
                  <div className="flex gap-2">
                    {canReply && (
                      <button type="button" disabled={busy || !reply.trim()} onClick={() => sendReply({ internal: false })} className="flex-1 bg-[#FF3B30] text-white font-mono text-[10px] tracking-widest uppercase py-2.5 font-bold disabled:opacity-50 flex items-center justify-center gap-2"><Send className="w-3.5 h-3.5" /> Reply</button>
                    )}
                    {canInternal && (
                      <button type="button" disabled={busy || !reply.trim()} onClick={() => sendReply({ internal: true })} className="px-3 border border-white/20 font-mono text-[10px] tracking-widest uppercase disabled:opacity-50">Internal</button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
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
                  <th className="p-3">Support Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Open</th>
                  <th className="p-3">Resolved</th>
                  <th className="p-3">SLA %</th>
                  <th className="p-3">Last Active</th>
                  {canManageUsers && <th className="p-3">Actions</th>}
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
                    <td className="p-3">{u.sla_performance ?? "—"}%</td>
                    <td className="p-3 text-white/50 text-xs">{fmtTs(u.last_active)}</td>
                    {canManageUsers && (
                      <td className="p-3 space-x-2 whitespace-nowrap">
                        <select
                          className={FILTER_SELECT}
                          value={u.support_role || u.role}
                          onChange={(e) => patchStaff(u.id, { support_role: e.target.value })}
                        >
                          <option value="support_agent" style={FILTER_OPTION}>Agent</option>
                          <option value="support_lead" style={FILTER_OPTION}>Lead</option>
                          <option value="support_admin" style={FILTER_OPTION}>Admin</option>
                        </select>
                        <button
                          type="button"
                          className="text-[10px] font-mono uppercase border border-white/15 px-2 py-1 rounded-lg"
                          onClick={() => patchStaff(u.id, { active: u.status !== "active" })}
                        >
                          {u.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    )}
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
              <select value={newStaff.support_role} onChange={(e) => setNewStaff({ ...newStaff, support_role: e.target.value })} className={`${FILTER_SELECT} py-2 rounded-xl`}>
                <option value="support_agent" style={FILTER_OPTION}>Support Agent</option>
                <option value="support_lead" style={FILTER_OPTION}>Support Lead</option>
                <option value="support_admin" style={FILTER_OPTION}>Support Admin</option>
              </select>
              <input required type="password" placeholder="Password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <button type="submit" disabled={busy} className="bg-[#FF3B30] text-white font-mono text-xs uppercase tracking-widest py-2 rounded-xl disabled:opacity-50">
                Create
              </button>
            </form>
          )}
        </div>
      )}

      {tab === "knowledge" && canViewKb && (
        <div className="space-y-4 max-w-4xl">
          {kb.map((a) => (
            <div key={a.id} className="border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between gap-3">
                <h3 className="font-sans font-bold">{a.title}</h3>
                <span className="font-mono text-[9px] uppercase text-white/40">{a.active ? "Active" : "Inactive"}</span>
              </div>
              <p className="text-sm text-white/70 mt-2 whitespace-pre-wrap">{a.body}</p>
              {(a.tags || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span key={t} className="text-[9px] font-mono px-2 py-0.5 border border-white/15 rounded-full text-white/50">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {canManageKb && (
            <form onSubmit={createKb} className="border border-white/10 rounded-2xl p-4 space-y-3">
              <h3 className="font-sans font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> New article</h3>
              <input required value={newKb.title} onChange={(e) => setNewKb({ ...newKb, title: e.target.value })} placeholder="Title" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <textarea required value={newKb.body} onChange={(e) => setNewKb({ ...newKb, body: e.target.value })} rows={4} placeholder="Body" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <input value={newKb.tags} onChange={(e) => setNewKb({ ...newKb, tags: e.target.value })} placeholder="Tags (comma-separated)" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
              <button type="submit" disabled={busy} className="bg-[#FF3B30] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-xl disabled:opacity-50">Create</button>
            </form>
          )}
        </div>
      )}

      {tab === "ai" && canAiConfig && aiConfig && (
        <div className="max-w-xl border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="font-sans font-bold">AI Support configuration</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!aiConfig.enabled} onChange={(e) => setAiConfig({ ...aiConfig, enabled: e.target.checked })} />
            AI enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!aiConfig.auto_escalate} onChange={(e) => setAiConfig({ ...aiConfig, auto_escalate: e.target.checked })} />
            Auto-escalate unresolved chats to Support queue
          </label>
          <div>
            <div className="font-mono text-[9px] uppercase text-white/40 mb-1">Greeting</div>
            <input value={aiConfig.greeting || ""} onChange={(e) => setAiConfig({ ...aiConfig, greeting: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase text-white/40 mb-1">Max history turns</div>
            <input type="number" min={2} max={40} value={aiConfig.max_history || 10} onChange={(e) => setAiConfig({ ...aiConfig, max_history: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl" />
          </div>
          <button type="button" disabled={busy} onClick={saveAiConfig} className="bg-[#FF3B30] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-xl disabled:opacity-50">
            Save
          </button>
        </div>
      )}

      {tab === "analytics" && canAnalytics && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(analytics.by_user_type || {}).map(([ut, row]) => (
              <div key={ut} className="border border-white/10 rounded-2xl p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">{typeLabel(ut)}</div>
                <div className="mt-2 text-sm text-white/70 space-y-1">
                  <div>Open: {row.open}</div>
                  <div>Resolved: {row.resolved}</div>
                  <div>SLA breached: {row.sla_breached}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="border border-white/10 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="font-mono text-[9px] uppercase tracking-widest text-white/40 border-b border-white/10">
                <tr>
                  <th className="p-3">Agent</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Open</th>
                  <th className="p-3">Resolved</th>
                  <th className="p-3">SLA Breached</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.agents || []).map((a) => (
                  <tr key={a.id} className="border-b border-white/5">
                    <td className="p-3">{a.name}</td>
                    <td className="p-3 font-mono text-xs">{a.role}</td>
                    <td className="p-3">{a.open}</td>
                    <td className="p-3">{a.resolved}</td>
                    <td className="p-3">{a.sla_breached}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "audit" && canAudit && (
        <div className="border border-white/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="font-mono text-[9px] uppercase tracking-widest text-white/40 border-b border-white/10">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Actor Type</th>
                <th className="p-3">Action</th>
                <th className="p-3">Ticket</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((log, i) => (
                <tr key={log.id || i} className="border-b border-white/5 align-top">
                  <td className="p-3 text-xs text-white/50 whitespace-nowrap">{fmtTs(log.created_at || log.timestamp)}</td>
                  <td className="p-3">{log.user || log.username || log.user_id || "—"}</td>
                  <td className="p-3 font-mono text-xs">{log.meta?.actor_type || "—"}</td>
                  <td className="p-3 font-mono text-xs">{log.action}</td>
                  <td className="p-3 font-mono text-xs">{log.meta?.ticket_id || "—"}</td>
                  <td className="p-3 text-xs text-white/60 max-w-xs truncate">{log.details || JSON.stringify(log.meta || {})}</td>
                </tr>
              ))}
              {!audit.length && (
                <tr><td className="p-4 text-white/40" colSpan={6}>No support audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
