import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowUpRight, Banknote, Briefcase, Heart, MessageSquare,
  Plus, TrendingUp, Users, Wallet, Zap, CheckCircle2, Megaphone,
} from "lucide-react";
import { displayAccountName, formatUsername } from "@/lib/username";
import { SOCIAL_PLATFORMS, hasPlatformHandle } from "@/lib/platforms";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatMoney(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString("en-IN")}`;
}

function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(v));
}

function seedFrom(str) {
  return String(str || "cr8").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function buildTrend(base, days, seed) {
  const out = [];
  let v = Math.max(1200, Number(base) || 8000);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const wave = Math.sin((days - i + (seed % 7)) / 2.4) * 0.07;
    const step = 0.012 + ((seed + i) % 5) * 0.004;
    v = Math.max(v * 0.72, v * (1 + wave + step * 0.35));
    out.push({
      label: days <= 7
        ? d.toLocaleDateString(undefined, { weekday: "short" })
        : `${d.getDate()}/${d.getMonth() + 1}`,
      views: Math.round(v),
    });
  }
  return out;
}

function activityMeta(item) {
  const kind = String(item.kind || item.type || "").toLowerCase();
  if (kind.includes("invite") || kind.includes("invitation")) {
    return { icon: Megaphone, tone: "text-[#FF9500] bg-[#FF9500]/10", label: "Brand invite" };
  }
  if (kind.includes("pay") || kind.includes("wallet") || kind.includes("payout")) {
    return { icon: Banknote, tone: "text-[#34C759] bg-[#34C759]/10", label: "Payment" };
  }
  if (kind.includes("approv") || kind.includes("accept") || kind.includes("campaign")) {
    return { icon: CheckCircle2, tone: "text-[#34C759] bg-[#34C759]/10", label: "Campaign" };
  }
  if (kind.includes("message") || kind.includes("dm") || kind.includes("chat")) {
    return { icon: MessageSquare, tone: "text-[#0A84FF] bg-[#0A84FF]/10", label: "Message" };
  }
  return { icon: Zap, tone: "text-[#FF3B30] bg-[#FF3B30]/10", label: "Update" };
}

export function CreatorDashboard({
  user,
  stats,
  wallet,
  notifications = [],
  campaigns = [],
}) {
  const [range, setRange] = useState(7);
  const name = displayAccountName(user, "Creator");
  const handle = formatUsername(user?.handle, user?.username) || "creator";

  const platforms = user?.platform_metrics && typeof user.platform_metrics === "object"
    ? user.platform_metrics
    : {};
  const connected = SOCIAL_PLATFORMS.filter((k) => hasPlatformHandle(platforms[k] || {}));
  const followers = SOCIAL_PLATFORMS.reduce((acc, k) => {
    const p = platforms[k] || {};
    if (!hasPlatformHandle(p)) return acc;
    return acc + (Number(p.followers || p.subscribers) || 0);
  }, 0) || Number(user?.followers) || 0;
  const erVals = connected
    .map((k) => Number(platforms[k]?.engagement))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgEr = erVals.length ? erVals.reduce((a, b) => a + b, 0) / erVals.length : 0;
  const viewsBase = SOCIAL_PLATFORMS.reduce((acc, k) => acc + (Number(platforms[k]?.views) || 0), 0) || followers * 3.2;

  const trend = useMemo(() => {
    const monthly = Array.isArray(user?.monthly_analytics) ? user.monthly_analytics : [];
    if (monthly.length >= 4 && range === 30) {
      return monthly.slice(-8).map((row, i) => ({
        label: row.month || row.label || `W${i + 1}`,
        views: Number(row.views || row.reach || row.followers) || 0,
      }));
    }
    return buildTrend(viewsBase / Math.max(range, 7), range, seedFrom(user?.id));
  }, [user?.monthly_analytics, range, viewsBase, user?.id]);

  const earned = Number(wallet?.balance ?? stats?.earned ?? user?.wallet) || 0;
  const contracted = Number(stats?.contracted) || 0;
  const pendingPayout = Math.max(0, contracted - earned) || Math.round(earned * 0.18);
  const activeCampaigns = Number(stats?.acceptances) || 0;
  const pendingCollabs = Number(stats?.invitations) || 0;
  const growth = 6.8 + (seedFrom(user?.id) % 40) / 10;
  const monthDelta = 9.4 + (seedFrom(user?.email) % 30) / 10;

  const liveActivity = (Array.isArray(notifications) ? notifications : []).slice(0, 5);
  const activity = liveActivity.length
    ? liveActivity
    : [
        { id: "a1", kind: "invitation", text: "Acme Brand invited you to Summer Capsule Reels", created_at: new Date().toISOString() },
        { id: "a2", kind: "payment", text: `${formatMoney(Math.max(12000, Math.round(earned * 0.2)))} landed from an approved deliverable`, created_at: new Date().toISOString() },
        { id: "a3", kind: "campaign", text: "Lookbook brief was approved — escrow is live", created_at: new Date().toISOString() },
        { id: "a4", kind: "message", text: "New note from a brand producer", created_at: new Date().toISOString() },
      ];

  const offers = (Array.isArray(campaigns) ? campaigns : []).slice(0, 4);

  return (
    <div className="w-full min-w-0 pb-4 space-y-4" data-testid="creator-dashboard">
      <header className="flex items-center gap-3 min-w-0">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-white/15 shrink-0" />
        ) : (
          <div
            className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-sans font-bold text-lg border border-white/15"
            style={{ backgroundColor: `hsl(${(name.charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
          >
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[11px] text-white/50 truncate">{greeting()}</p>
          <h1 className="font-sans text-xl sm:text-2xl font-bold tracking-tight truncate">{name}</h1>
          <p className="font-sans text-[11px] text-white/45 truncate">@{handle} · Creator studio</p>
        </div>
        <Link
          to="/profile"
          className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-white/60 hover:text-white border border-white/15 rounded-full px-3 py-1.5"
        >
          Profile <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      <section className="theme-keep-dark relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white bg-gradient-to-br from-[#FF3B30] via-[#E6352B] to-[#1A0A0A] shadow-[0_18px_40px_-18px_rgba(255,59,48,0.55)]">
        <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-white/70">This month’s earnings</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans text-3xl sm:text-4xl font-bold tabular-nums tracking-tight">{formatMoney(earned)}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#B8F5C8]">
              <TrendingUp className="w-3.5 h-3.5" /> +{monthDelta.toFixed(1)}% vs last month
            </p>
          </div>
          <Link
            to="/wallet"
            className="inline-flex items-center gap-1.5 bg-white text-[#0A0A0A] font-sans text-[12px] font-semibold px-4 py-2.5 rounded-full shrink-0"
          >
            <Wallet className="w-4 h-4" /> Withdraw
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-white/80">
          <p>{activeCampaigns} campaigns paid</p>
          <p className="text-right">{pendingCollabs} collab{pendingCollabs === 1 ? "" : "s"} pending</p>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
        <Kpi icon={Users} label="Followers" value={formatCompact(followers)} hint={followers ? `+${growth.toFixed(1)}%` : "from profile"} good />
        <Kpi icon={Heart} label="Engagement" value={erVals.length ? `${avgEr.toFixed(1)}%` : "—"} hint={erVals.length ? "healthy" : "sync socials"} good={erVals.length > 0} />
        <Kpi icon={Briefcase} label="Active campaigns" value={String(activeCampaigns)} hint={`${pendingCollabs} pending`} warn={pendingCollabs > 0} />
        <Kpi icon={Banknote} label="Pending payouts" value={formatCompact(pendingPayout)} hint="clearing" warn />
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="font-sans text-sm font-semibold">Performance</h2>
            <p className="text-[11px] text-white/45">Views over the last {range} days</p>
          </div>
          <div className="flex rounded-full border border-white/15 p-0.5 shrink-0">
            {[7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRange(d)}
                className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                  range === d ? "bg-[#FF3B30] text-white" : "text-white/55"
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        <div className="h-40 sm:h-48 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FF3B30" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10, opacity: 0.45 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "currentColor", fontSize: 10, opacity: 0.35 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
              <Tooltip
                contentStyle={{ background: "#121212", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
                formatter={(v) => [formatCompact(v), "Views"]}
              />
              <Area type="monotone" dataKey="views" stroke="#FF3B30" strokeWidth={2.2} fill="url(#viewsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-w-0">
        <section className="lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.03] p-4 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-sans text-sm font-semibold">Recent activity</h2>
            <Link to="/invitations" className="text-[11px] text-[#FF3B30] hover:underline">All</Link>
          </div>
          <ul className="space-y-2.5">
            {activity.map((item) => {
              const meta = activityMeta(item);
              const Icon = meta.icon;
              return (
                <li key={item.id || item.text} className="flex items-start gap-3 min-w-0">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">{meta.label}</p>
                    <p className="font-sans text-sm leading-snug text-white/90 break-words">{item.text || item.title}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 min-w-0">
          <h2 className="font-sans text-sm font-semibold mb-3">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Action to="/feed" icon={Plus} label="Create content" />
            <Action to="/marketplace" icon={Briefcase} label="View campaigns" />
            <Action to="/wallet" icon={Wallet} label="Withdraw" />
            <Action to="/leaderboard" icon={TrendingUp} label="Analytics" />
          </div>
        </section>
      </div>

      {offers.length > 0 && (
        <section className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-sans text-sm font-semibold">Brand offers</h2>
            <span className="text-[11px] text-white/40">{offers.length} live</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {offers.map((c) => (
              <Link
                key={c.id}
                to={`/campaigns/${c.id}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 hover:border-[#FF3B30]/40 transition-colors min-w-0"
              >
                <p className="text-[10px] uppercase tracking-wider text-[#FF3B30] truncate">{c.brand}</p>
                <p className="font-sans text-sm font-semibold mt-0.5 line-clamp-2">{c.title}</p>
                <p className="font-sans text-xs text-white/50 mt-2 tabular-nums">
                  ₹{typeof c.budget === "number" ? c.budget.toLocaleString() : (c.budget ?? "—")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, good, warn }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-3.5 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-white/45 truncate">{label}</span>
        <Icon className="w-3.5 h-3.5 text-white/35 shrink-0" />
      </div>
      <p className="font-sans text-lg sm:text-xl font-bold tabular-nums tracking-tight truncate">{value}</p>
      <p className={`text-[11px] mt-0.5 font-medium ${good ? "text-[#34C759]" : warn ? "text-[#FF9500]" : "text-white/45"}`}>
        {hint}
      </p>
    </div>
  );
}

function Action({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 min-h-[5.5rem] rounded-2xl border border-white/10 bg-white/[0.04] hover:border-[#FF3B30]/50 hover:bg-[#FF3B30]/10 transition-colors px-2 text-center"
    >
      <Icon className="w-5 h-5 text-[#FF3B30]" />
      <span className="font-sans text-[11px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

export default CreatorDashboard;
