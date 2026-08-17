import { Link } from "react-router-dom";
import {
  ArrowUpRight, Briefcase, Eye, FileText, Heart, Users, Wallet,
} from "lucide-react";
import { displayAccountName, formatUsername } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";
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

/**
 * Creator home — layout matches annotated feedback:
 * Brand offers first · earnings + pitches/campaigns · overall social KPIs
 * (no Recent activity, no Performance chart, no Feed/Wallet quick-action dupes).
 */
export function CreatorDashboard({
  user,
  stats,
  wallet,
  campaigns = [],
  pitchCount = 0,
}) {
  const name = displayAccountName(user, "Creator");
  const handle = formatUsername(user?.handle, user?.username) || "creator";
  const locationLabel = formatUserLocation(user);

  const platforms = user?.platform_metrics && typeof user.platform_metrics === "object"
    ? user.platform_metrics
    : {};
  const connected = SOCIAL_PLATFORMS.filter((k) => hasPlatformHandle(platforms[k] || {}));
  const followers = connected.reduce((acc, k) => {
    const p = platforms[k] || {};
    return acc + (Number(p.followers || p.subscribers) || 0);
  }, 0) || Number(stats?.followers) || Number(user?.followers) || 0;
  const erVals = connected
    .map((k) => Number(platforms[k]?.engagement ?? platforms[k]?.er))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgEr = erVals.length
    ? erVals.reduce((a, b) => a + b, 0) / erVals.length
    : (Number(stats?.avg_engagement) > 0 ? Number(stats.avg_engagement) : 0);
  const views = connected.reduce((acc, k) => acc + (Number(platforms[k]?.views) || 0), 0)
    || Number(stats?.views)
    || 0;

  const earned = Number(wallet?.balance ?? stats?.earned ?? user?.wallet) || 0;
  const activeCampaigns = Number(stats?.acceptances) || 0;
  const pendingCollabs = Number(stats?.invitations) || 0;
  const pitches = Number(stats?.applications) || Number(pitchCount) || 0;
  const openBriefs = (Array.isArray(campaigns) ? campaigns : []).length;
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
          <p className="font-sans text-[11px] text-white/45 truncate">
            @{handle} · Creator studio
            {locationLabel ? ` · ${locationLabel}` : ""}
          </p>
        </div>
        <Link
          to="/profile"
          className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-white/60 hover:text-white border border-white/15 rounded-full px-3 py-1.5"
        >
          Profile <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* 1) Brand offers — top of main content */}
      <section className="min-w-0" data-testid="brand-offers-top">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-sans text-sm font-semibold">Brand offers</h2>
          <Link to="/marketplace?tab=campaigns" className="text-[11px] text-[#FF3B30] hover:underline">
            {offers.length ? `${offers.length} live` : "Browse all"}
          </Link>
        </div>
        {offers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {offers.map((c) => (
              <Link
                key={c.id}
                to={`/campaigns/${c.id}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 hover:border-[#FF3B30]/40 transition-colors min-w-0"
              >
                <p className="text-[10px] uppercase tracking-wider text-[#FF3B30] truncate">{c.brand}</p>
                <p className="font-sans text-sm font-semibold mt-0.5 line-clamp-2 break-words">{c.title}</p>
                <p className="font-sans text-xs text-white/50 mt-2 tabular-nums">
                  ₹{typeof c.budget === "number" ? c.budget.toLocaleString() : (c.budget ?? "—")}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
            <p className="font-sans text-sm text-white/55">No live brand offers right now.</p>
            <Link to="/marketplace?tab=campaigns" className="inline-block mt-2 text-[11px] text-[#FF3B30] hover:underline">
              Open campaigns
            </Link>
          </div>
        )}
      </section>

      {/* 2) Earnings + Pitches / Campaigns in the banner */}
      <section className="theme-keep-dark relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white bg-gradient-to-br from-[#FF3B30] via-[#E6352B] to-[#1A0A0A] shadow-[0_18px_40px_-18px_rgba(255,59,48,0.55)]">
        <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-white/70">This month’s earnings</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-sans text-3xl sm:text-4xl font-bold tabular-nums tracking-tight">{formatMoney(earned)}</p>
            <p className="mt-1 text-[12px] text-white/70">
              {pendingCollabs} collab{pendingCollabs === 1 ? "" : "s"} pending · {activeCampaigns} active
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 ml-auto">
            <div className="rounded-2xl bg-black/25 border border-white/15 px-3.5 py-2.5 min-w-[7.5rem]" data-testid="earnings-pitches">
              <p className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/65">Pitches</p>
              <p className="font-sans text-xl font-bold tabular-nums leading-tight mt-0.5">{pitches}</p>
              <p className="text-[10px] text-white/55 mt-0.5">applications</p>
            </div>
            <div className="rounded-2xl bg-black/25 border border-white/15 px-3.5 py-2.5 min-w-[7.5rem]" data-testid="earnings-campaigns">
              <p className="font-sans text-[9px] uppercase tracking-[0.16em] text-white/65">Campaigns</p>
              <p className="font-sans text-xl font-bold tabular-nums leading-tight mt-0.5">{openBriefs || activeCampaigns}</p>
              <p className="text-[10px] text-white/55 mt-0.5">{openBriefs ? "open briefs" : "accepted"}</p>
            </div>
            <Link
              to="/wallet"
              className="inline-flex items-center gap-1.5 self-center bg-white text-[#0A0A0A] font-sans text-[12px] font-semibold px-4 py-2.5 rounded-full shrink-0"
            >
              <Wallet className="w-4 h-4" /> Withdraw
            </Link>
          </div>
        </div>
      </section>

      {/* 3) Overall analytics — total social presence (no performance chart) */}
      <section className="min-w-0" data-testid="overall-analytics">
        <div className="mb-2">
          <h2 className="font-sans text-sm font-semibold">Overall analytics</h2>
          <p className="text-[11px] text-white/45">
            Total social media presence / strength · followers, engagement &amp; views
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
          <Kpi
            icon={Users}
            label="Total followers"
            value={followers ? formatCompact(followers) : "—"}
            hint={connected.length ? `${connected.length} connected` : "Connect socials"}
            good={followers > 0}
          />
          <Kpi
            icon={Heart}
            label="Engagement"
            value={erVals.length || avgEr ? `${avgEr.toFixed(1)}%` : "—"}
            hint={erVals.length || avgEr ? "avg. rate" : "Sync to refresh"}
            good={erVals.length > 0 || avgEr > 0}
          />
          <Kpi
            icon={Eye}
            label="Total views"
            value={views ? formatCompact(views) : "—"}
            hint={views ? "platform total" : "No views yet"}
            good={views > 0}
          />
        </div>
      </section>

      {/* Shortcuts that are NOT already sidebar destinations (Feed / Wallet) */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 min-w-0">
        <h2 className="font-sans text-sm font-semibold mb-3">Shortcuts</h2>
        <div className="grid grid-cols-2 gap-2">
          <Action to="/marketplace?tab=campaigns" icon={Briefcase} label="View campaigns" hint="Marketplace" />
          <Action to="/invitations" icon={FileText} label="Invitations" hint="Brand invites" />
        </div>
      </section>
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

function Action({ to, icon: Icon, label, hint }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1.5 min-h-[5.5rem] rounded-2xl border border-white/10 bg-white/[0.04] hover:border-[#FF3B30]/50 hover:bg-[#FF3B30]/10 transition-colors px-2 text-center"
    >
      <Icon className="w-5 h-5 text-[#FF3B30]" />
      <span className="font-sans text-[11px] font-medium leading-tight">{label}</span>
      {hint ? <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">{hint}</span> : null}
    </Link>
  );
}

export default CreatorDashboard;
