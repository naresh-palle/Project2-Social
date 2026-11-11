import { Link } from "react-router-dom";
import {
  ArrowUpRight, Briefcase, Eye, FileText, Heart, Users, Wallet, Radio,
} from "lucide-react";
import { displayAccountName, formatUsername } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";
import { SOCIAL_PLATFORMS, hasPlatformHandle } from "@/lib/platforms";
import {
  creatorOverviewFromSources,
  displayMetric,
  formatEngagementRate,
  engagementRateHint,
  formatExactNumber,
} from "@/lib/socialAnalytics";

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
  const overview = creatorOverviewFromSources({ user, stats });
  const followers = overview.followers;
  const views = overview.views;
  const reach = overview.reach;
  const avgEr = overview.engagementRate;
  const erBasis = engagementRateHint(overview.engagementRateBasis);

  const earned = Number(wallet?.balance ?? stats?.earned ?? user?.wallet) || 0;
  const activeCampaigns = Number(stats?.acceptances) || 0;
  const pendingCollabs = Number(stats?.invitations) || 0;
  const pitches = Number(stats?.applications) || Number(pitchCount) || 0;
  const openBriefs = (Array.isArray(campaigns) ? campaigns : []).length;

  return (
    <div className="w-full min-w-0 pb-4 space-y-4" data-testid="creator-dashboard">
      <header className="flex items-center gap-3 min-w-0">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-[#D9CBB3] shrink-0" />
        ) : (
          <div
            className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-sans font-bold text-lg border border-[#D9CBB3] text-[#F6F0E6] bg-[#2A201A]"
          >
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[11px] text-[#6B5D50] font-medium truncate">{greeting()}</p>
          <h1 className="font-editorial text-xl sm:text-2xl font-bold tracking-tight truncate text-[#2A201A]">{name}</h1>
          <p className="font-sans text-[11px] text-[#6B5D50] truncate">
            @{handle} · Creator studio
            {locationLabel ? ` · ${locationLabel}` : ""}
          </p>
        </div>
        <Link
          to="/profile"
          className="shrink-0 hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-[#6B5D50] hover:text-[#2A201A] border border-[#D9CBB3] rounded-full px-3 py-1.5 bg-[#FBF7F0]"
        >
          Profile <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Brand offers hidden for now — keep campaigns discoverable via Marketplace */}

      {/* 2) Earnings + Pitches / Campaigns — cream / espresso / bronze */}
      <section className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-[#2A201A] bg-[#FBF7F0] border border-[#D9CBB3] shadow-[0_18px_40px_-18px_rgba(42,32,26,0.18)]">
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-[#A9824A]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-8 w-48 h-48 rounded-full bg-[#E7DAC4]/80 blur-3xl" />
        <p className="relative font-sans text-[10px] uppercase tracking-[0.18em] text-[#A9824A] font-bold">This month’s earnings</p>
        <div className="relative mt-1 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-money text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-[#2A201A]" data-money="1">{formatMoney(earned)}</p>
            <p className="mt-1 text-[12px] text-[#6B5D50]">
              {pendingCollabs} collab{pendingCollabs === 1 ? "" : "s"} pending · {activeCampaigns} active
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 w-full sm:w-auto sm:ml-auto">
            <div className="rounded-2xl bg-[#F6F0E6] border border-[#D9CBB3] px-3.5 py-2.5 flex-1 min-w-[6.5rem] sm:min-w-[7.5rem] sm:flex-none" data-testid="earnings-pitches">
              <p className="font-sans text-[9px] uppercase tracking-[0.16em] text-[#6B5D50] font-semibold">Pitches</p>
              <p className="font-money text-xl font-bold tabular-nums leading-tight mt-0.5 text-[#2A201A]">{pitches}</p>
              <p className="text-[10px] text-[#6B5D50] mt-0.5">applications</p>
            </div>
            <div className="rounded-2xl bg-[#F6F0E6] border border-[#D9CBB3] px-3.5 py-2.5 flex-1 min-w-[6.5rem] sm:min-w-[7.5rem] sm:flex-none" data-testid="earnings-campaigns">
              <p className="font-sans text-[9px] uppercase tracking-[0.16em] text-[#6B5D50] font-semibold">Campaigns</p>
              <p className="font-money text-xl font-bold tabular-nums leading-tight mt-0.5 text-[#2A201A]">{openBriefs || activeCampaigns}</p>
              <p className="text-[10px] text-[#6B5D50] mt-0.5">{openBriefs ? "open briefs" : "accepted"}</p>
            </div>
            <Link
              to="/wallet"
              className="inline-flex items-center justify-center gap-1.5 self-stretch sm:self-center bg-[#2A201A] text-[#F6F0E6] font-sans text-[12px] font-semibold px-4 py-2.5 rounded-full shrink-0 w-full sm:w-auto hover:bg-[#3A2E26]"
            >
              <Wallet className="w-4 h-4" /> Withdraw
            </Link>
          </div>
        </div>
      </section>

      {/* 3) Overall analytics — Apify-normalized KPIs */}
      <section className="min-w-0" data-testid="overall-analytics">
        <div className="mb-2">
          <h2 className="font-editorial text-sm font-semibold text-[#2A201A]">Overall analytics</h2>
          <p className="text-[11px] text-[#6B5D50]">
            Followers, engagement, views &amp; reach from connected socials
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
          <Kpi
            icon={Users}
            label="Total followers"
            value={displayMetric(followers)}
            title={formatExactNumber(followers) || undefined}
            hint={connected.length ? `${connected.length} connected` : "Connect socials"}
            good={Boolean(followers)}
          />
          <Kpi
            icon={Heart}
            label="Engagement rate"
            value={formatEngagementRate(avgEr)}
            hint={erBasis || (avgEr != null ? "avg. rate" : "Sync to refresh")}
            good={avgEr != null && avgEr > 0}
          />
          <Kpi
            icon={Eye}
            label="Total views"
            value={displayMetric(views, { allowZero: false })}
            title={formatExactNumber(views) || undefined}
            hint={views != null ? "platform totals" : "N/A when platform omits views"}
            good={views != null && views > 0}
          />
          <Kpi
            icon={Radio}
            label="Total reach"
            value={displayMetric(reach, { allowZero: false })}
            title={formatExactNumber(reach) || undefined}
            hint={reach != null ? "platform reach" : "Unavailable from scrapers"}
            good={reach != null && reach > 0}
          />
        </div>
      </section>

      {/* Shortcuts that are NOT already sidebar destinations (Feed / Wallet) */}
      <section className="rounded-3xl border border-[#D9CBB3] bg-[#FBF7F0] p-4 min-w-0">
        <h2 className="font-editorial text-sm font-semibold mb-3 text-[#2A201A]">Shortcuts</h2>
        <div className="grid grid-cols-2 gap-2">
          <Action to="/marketplace?tab=campaigns" icon={Briefcase} label="View campaigns" hint="Marketplace" />
          <Action to="/invitations" icon={FileText} label="Invitations" hint="Brand invites" />
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, good, warn, title }) {
  return (
    <div className="rounded-2xl border border-[#D9CBB3] bg-[#FBF7F0] p-3 sm:p-3.5 min-w-0" title={title}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[#6B5D50] font-semibold truncate">{label}</span>
        <Icon className="w-3.5 h-3.5 text-[#2A201A] shrink-0" strokeWidth={2.35} />
      </div>
      <p className="font-money text-lg sm:text-xl font-bold tabular-nums tracking-tight truncate text-[#2A201A]">{value}</p>
      <p className={`text-[11px] mt-0.5 font-medium ${good ? "text-[#5A6B4E]" : warn ? "text-[#A3412F]" : "text-[#6B5D50]"}`}>
        {hint}
      </p>
    </div>
  );
}

function Action({ to, icon: Icon, label, hint }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-[#D9CBB3] bg-[#F6F0E6] px-3 py-2.5 hover:border-[#A9824A] hover:bg-[#E7DAC4] transition-colors min-w-0"
    >
      <span className="w-8 h-8 rounded-full bg-[#FBF7F0] border border-[#D9CBB3] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#2A201A]" strokeWidth={2.35} />
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-sm font-semibold truncate text-[#2A201A]">{label}</span>
        <span className="block text-[10px] text-[#6B5D50] truncate">{hint}</span>
      </span>
    </Link>
  );
}
