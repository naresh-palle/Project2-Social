import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { RefreshCw, AlertTriangle, CheckCircle2, LifeBuoy, Clock, FileDown } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole } from "@/lib/supportOps";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ICONS,
} from "@/lib/platforms";
import {
  displayMetric,
  formatCompactNumber,
  formatEngagementRate,
  engagementRateHint,
} from "@/lib/socialAnalytics";
import { exportSocialAuditPdf } from "@/lib/exportFormats";

const STATUS_COLOR = {
  Healthy: "text-[#34C759] border-[#34C759]/30 bg-[#34C759]/10",
  "Needs Attention": "text-[#FF9500] border-[#FF9500]/30 bg-[#FF9500]/10",
  "Action Required": "text-[#FF3B30] border-[#FF3B30]/30 bg-[#FF3B30]/10",
  "Audit In Progress": "text-[#0A84FF] border-[#0A84FF]/30 bg-[#0A84FF]/10",
  "Audit Failed": "text-[#FF3B30] border-[#FF3B30]/30 bg-[#FF3B30]/10",
};

const SEV_COLOR = {
  Low: "text-white/60",
  Medium: "text-[#FF9500]",
  High: "text-[#FF3B30]",
  Critical: "text-[#FF3B30] font-bold",
};

export default function SocialMediaAudit() {
  const { user } = useAuth();
  const [audit, setAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [raising, setRaising] = useState(null);

  const blocked = !user || isSupportOpsRole(user.role);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (blocked) return;
    if (!quiet) setLoading(true);
    try {
      const [a, h, t] = await Promise.all([
        api.get("/social-audit/me"),
        api.get("/social-audit/history?limit=12"),
        api.get("/support/tickets?limit=30").catch(() => ({ data: { tickets: [] } })),
      ]);
      setAudit(a.data);
      setHistory(Array.isArray(h.data) ? h.data : []);
      const list = Array.isArray(t.data) ? t.data : (t.data?.tickets || []);
      setTickets(list.filter((x) => x.category === "Social Media Audit" || x.tags?.includes("social-audit")));
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d) => d.msg || d).join("; ") : "Failed to load social audit";
      toast.error(msg);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [blocked]);

  useEffect(() => { load(); }, [load]);

  const runAudit = async () => {
    setRunning(true);
    try {
      const { data } = await api.post("/social-audit/run");
      setAudit(data);
      toast.success(`Audit complete — ${data.status}`);
      await load({ quiet: true });
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Audit failed");
    } finally {
      setRunning(false);
    }
  };

  const raiseTicket = async (issueId) => {
    if (!audit?.id) return;
    setRaising(issueId);
    try {
      const { data } = await api.post(`/social-audit/${audit.id}/raise-ticket`, { issue_id: issueId });
      const number = data?.number || data?.ticket?.number || "created";
      toast.success(`Ticket ${number} created`);
      // Optimistic UI — mark issue as raised so the page never blanks
      setAudit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          issues: (prev.issues || []).map((iss) =>
            iss.id === issueId
              ? { ...iss, status: "Ticket Raised", ticket_id: data?.id || data?.ticket?.id }
              : iss
          ),
        };
      });
      await load({ quiet: true });
    } catch (e) {
      const detail = e.response?.data?.detail;
      let msg = "Could not raise ticket";
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail)) msg = detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
      toast.error(msg);
    } finally {
      setRaising(null);
    }
  };

  const exportPdf = () => {
    if (!audit) return;
    try {
      exportSocialAuditPdf({ audit });
      toast.success("Audit PDF downloaded");
    } catch (e) {
      toast.error(e?.message || "PDF export failed");
    }
  };

  if (blocked) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading && !audit) {
    return <div className="p-6 font-mono text-xs uppercase tracking-widest text-[#FF3B30]">Loading audit…</div>;
  }

  const ov = audit?.overview || {};
  const statusClass = STATUS_COLOR[audit?.status] || STATUS_COLOR["Needs Attention"];

  return (
    <div className="w-full min-w-0 pb-8 space-y-4" data-testid="social-media-audit">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">Audit Report</p>
          <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1">Social Media Audit</h1>
          <p className="text-[12px] text-white/45 mt-1">
            Available for all accounts — uses your connected platforms and Apify sync data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!audit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/15 hover:border-[#FF3B30]/50 text-xs uppercase tracking-wider disabled:opacity-50"
            data-testid="social-audit-export-pdf"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={runAudit}
            disabled={running}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/15 hover:border-[#FF3B30]/50 text-xs uppercase tracking-wider disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Running…" : "Run audit"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <SummaryCard label="Status" value={audit?.status || "—"} className={statusClass} />
        <SummaryCard label="Audit score" value={audit?.score != null ? `${audit.score}` : "N/A"} hint="/ 100" />
        <SummaryCard label="Followers" value={displayMetric(ov.followers, { format: formatCompactNumber })} />
        <SummaryCard
          label="Engagement rate"
          value={formatEngagementRate(ov.engagementRate)}
          hint={engagementRateHint(ov.engagementRateBasis) || undefined}
        />
        <SummaryCard label="Total views" value={displayMetric(ov.views, { format: formatCompactNumber, allowZero: false })} />
        <SummaryCard label="Total reach" value={displayMetric(ov.reach, { format: formatCompactNumber, allowZero: false })} hint="Actual reach only" />
        <SummaryCard label="Profile complete" value={`${audit?.profile_completeness?.score ?? "—"}%`} />
        <SummaryCard
          label="Data freshness"
          value={
            audit?.data_freshness?.hours_since_sync != null
              ? `${audit.data_freshness.hours_since_sync}h`
              : "N/A"
          }
          hint={audit?.scraper_status === "failed" ? "Scraper issues" : "Since last sync"}
        />
      </div>

      {/* Platforms */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-sans text-sm font-semibold mb-3">Connected platforms</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(audit?.platforms || []).map((p) => {
            const Icon = SOCIAL_PLATFORM_ICONS[p.platform];
            return (
              <div key={p.platform} className={`rounded-xl border px-3 py-2.5 ${p.connected ? "border-white/10 bg-black/20" : "border-white/5 opacity-55"}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                    <span className="font-sans text-xs font-semibold">{SOCIAL_PLATFORM_LABELS[p.platform] || p.platform}</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase text-white/40">{p.api_status}</span>
                </div>
                <p className="font-sans text-[11px] text-white/50 truncate mb-2">{p.handle || "Not connected"}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center">
                  <MiniStat label="Followers" value={displayMetric(p.followers, { format: formatCompactNumber })} />
                  <MiniStat label="ER" value={formatEngagementRate(p.engagementRate)} />
                  <MiniStat label="Views" value={displayMetric(p.views, { format: formatCompactNumber, allowZero: false })} />
                  <MiniStat label="Reach" value={displayMetric(p.reach, { format: formatCompactNumber, allowZero: false })} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Issues */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
          <h2 className="font-sans text-sm font-semibold">Detected issues</h2>
          <span className="text-[11px] text-white/40">{(audit?.issues || []).length}</span>
        </div>
        {(audit?.issues || []).length === 0 ? (
          <p className="text-sm text-white/50 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#34C759]" /> No issues detected on the last audit.</p>
        ) : (
          <div className="space-y-2">
            {audit.issues.map((iss) => (
              <div key={iss.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold">{iss.title}</p>
                    <p className={`font-mono text-[10px] uppercase tracking-wider mt-0.5 ${SEV_COLOR[iss.severity] || ""}`}>
                      {iss.severity} · {iss.platform} · {iss.status}
                    </p>
                  </div>
                  {iss.status !== "Ticket Raised" ? (
                    <button
                      type="button"
                      disabled={raising === iss.id}
                      onClick={() => raiseTicket(iss.id)}
                      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-[#FF3B30]/40 text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-50"
                      data-testid={`raise-ticket-${iss.id}`}
                    >
                      <LifeBuoy className="w-3 h-3" />
                      {raising === iss.id ? "Raising…" : "Raise support ticket"}
                    </button>
                  ) : (
                    <Link to="/support" className="text-[10px] uppercase tracking-wider text-[#34C759]" data-testid={`ticket-opened-${iss.id}`}>
                      Ticket opened →
                    </Link>
                  )}
                </div>
                <p className="text-[12px] text-white/65 mt-2">{iss.description}</p>
                <p className="text-[11px] text-white/40 mt-1">Recommended: {iss.recommended_action}</p>
                <p className="font-mono text-[9px] text-white/30 mt-1">{iss.detected_at}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recommendations / warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-sans text-sm font-semibold mb-2">Recommendations</h2>
          <ul className="space-y-1.5 text-[12px] text-white/65 list-disc pl-4">
            {(audit?.recommendations || []).length
              ? audit.recommendations.map((r, i) => <li key={i}>{r}</li>)
              : <li>Keep syncing socials weekly for fresher audits.</li>}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-sans text-sm font-semibold mb-2">Warnings</h2>
          <ul className="space-y-1.5 text-[12px] text-white/65 list-disc pl-4">
            {(audit?.warnings || []).length
              ? audit.warnings.map((r, i) => <li key={i}>{r}</li>)
              : <li>No warnings.</li>}
          </ul>
        </section>
      </div>

      {/* History + tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="font-sans text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Audit history</h2>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setAudit(h)}
                className="w-full text-left rounded-lg border border-white/10 px-3 py-2 hover:border-white/25"
              >
                <div className="flex justify-between gap-2 text-xs">
                  <span className={STATUS_COLOR[h.status]?.split(" ")[0] || ""}>{h.status}</span>
                  <span className="tabular-nums text-white/45">Score {h.score}</span>
                </div>
                <p className="font-mono text-[9px] text-white/35 mt-0.5">{h.created_at}</p>
              </button>
            ))}
            {!history.length && <p className="text-sm text-white/40">No previous audits yet.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-sans text-sm font-semibold">My support tickets</h2>
            <Link to="/support" className="text-[11px] text-[#FF3B30]">All tickets →</Link>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {tickets.map((t) => (
              <Link key={t.id} to="/support" className="block rounded-lg border border-white/10 px-3 py-2 hover:border-white/25">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="font-mono text-white/50">{t.number}</span>
                  <span className="uppercase tracking-wider text-white/45">{t.status}</span>
                </div>
                <p className="text-[12px] mt-0.5 truncate">{t.subject}</p>
                <p className="font-mono text-[9px] text-white/35">{t.priority} · {t.updated_at || t.created_at}</p>
              </Link>
            ))}
            {!tickets.length && <p className="text-sm text-white/40">No social-audit tickets yet. Raise one from an issue above.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 min-w-0 ${className}`}>
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="font-sans text-lg font-bold tabular-nums mt-1 truncate">{value}</p>
      {hint ? <p className="text-[10px] text-white/40 mt-0.5">{hint}</p> : null}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="font-sans text-[11px] font-semibold tabular-nums truncate">{value}</p>
      <p className="font-mono text-[8px] uppercase text-white/35">{label}</p>
    </div>
  );
}
