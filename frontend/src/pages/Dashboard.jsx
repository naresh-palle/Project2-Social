
import { SocialConnect } from "@/components/SocialConnect";
import { SocialAnalyticsCards } from "@/components/SocialAnalyticsCards";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Send, Users, Sparkles, ShieldCheck, Eye, Star, Play, 
  Filter, ArrowRight, Lock, CheckCircle2, TrendingUp, Clock, 
  ExternalLink, MessageSquare, Briefcase, Award, Zap, FileText, Newspaper, Compass, Search
} from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { Nav } from "@/components/Nav";

import { IconTip } from "@/components/IconTip";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES, matchesCategoryFilter } from "@/lib/categories";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { formatUsername, displayAccountName } from "@/lib/username";
import { analyticsConnections, connectedSocialPlatforms } from "@/lib/platforms";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { AdminPanel } from "./AdminPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MOCK_CAMPAIGNS as DEFAULT_CAMPAIGNS_FOR_CREATORS, MOCK_PITCHES, MOCK_AGENT_CREATORS } from "@/lib/mockCampaigns";
import { CreatorDashboard } from "@/components/CreatorDashboard";

export default function Dashboard() {
  const { user, loading, refresh } = useAuth();
  const nav = useNavigate();
  const [showOnline, setShowOnline] = useState(true);

  useEffect(() => {
    if (!loading && !user) nav("/login");
    else if (!loading && user) {
        if (["support", "support_agent", "support_lead", "support_admin"].includes(user.role)) {
          nav("/support/ops");
          return;
        }
        if (user.role === "agent" && !user.agent_approved) nav("/onboarding/agent");
        else if (user.role !== "admin" && user.onboarding_status !== "completed") nav(`/onboarding/${user.role}`);
    }
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex items-center justify-center">
        <div className="font-sans text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] animate-pulse">Opening the studio…</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col w-full">

        {user?.role === "admin" ? (
          <AdminPanel />
        ) : user?.role === "owner" ? (
          <OwnerPanel />
        ) : user?.role === "agent" ? (
          <AgentPanel />
        ) : user?.role === "production" ? (
          <ProductionPanel />
        ) : (
          <InfluencerPanel />
        )}
      </div>
    </ErrorBoundary>
  );
}

/* =========================================================================
   1. BRAND / COMPANY PANEL — INFLUENCERS WORK AND FEED (Primary for Brands)
   ========================================================================= */
const FEATURED_CREATOR_WORK_FEED = [
  {
    id: "feed-1",
    creatorName: "Aarav Sharma",
    handle: "aarav.style",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    workTitle: "Cyberpunk Streetwear Editorial Reel",
    workImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800",
    category: "Fashion & Style",
    reach: "520K Reach",
    engagementRate: "5.8% ER",
    aiAuthenticity: "99% Real Audience",
    verified: true,
    likes: "42.5K",
    comments: "1.2K",
    brandPartner: "Studio Noir Apparel",
    description: "High-contrast cinematic short reel featuring luxury obsidian streetwear aesthetics. 48-hour sales conversion breakdown: +22% store traffic."
  },
  {
    id: "feed-2",
    creatorName: "Priya Varma",
    handle: "priya.tech.reviews",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400",
    workTitle: "AI Influencer Studio Workstation Review",
    workImage: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=800",
    category: "Technology & SaaS",
    reach: "380K Reach",
    engagementRate: "6.2% ER",
    aiAuthenticity: "98% Real Audience",
    verified: true,
    likes: "28.9K",
    comments: "890",
    brandPartner: "HyperTech AI",
    description: "In-depth 4K unboxing and automated workflow breakdown. Generated over 1,400 app trial signups via custom tracking link."
  },
  {
    id: "feed-3",
    creatorName: "Rohan Kapoor",
    handle: "rohan.aesthetic",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
    workTitle: "Organic Skin Glow Serum Campaign",
    workImage: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800",
    category: "Beauty & Cosmetics",
    reach: "610K Reach",
    engagementRate: "7.1% ER",
    aiAuthenticity: "100% Real Audience",
    verified: true,
    likes: "54.1K",
    comments: "2.1K",
    brandPartner: "Veda Organics",
    description: "Macro skin texture video highlighting natural serum absorption. 94% positive sentiment analysis score in automated caption audit."
  },
  {
    id: "feed-4",
    creatorName: "Neha Gupta",
    handle: "neha.fitness.pro",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    workTitle: "High-Intensity Pro Performance Workout",
    workImage: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=800",
    category: "Fitness & Wellness",
    reach: "290K Reach",
    engagementRate: "8.4% ER",
    aiAuthenticity: "97% Real Audience",
    verified: true,
    likes: "36.2K",
    comments: "740",
    brandPartner: "PulseFit Apparel",
    description: "Dynamic training reel demonstrating breathable stretch gear. High retention rate with 82% video completion percentage."
  },
  {
    id: "feed-5",
    creatorName: "Anya Singh",
    handle: "anya.arts",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
    workTitle: "Monsoon Capsule Lookbook Reel",
    workImage: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&q=80&w=800",
    category: "Fashion & Style",
    reach: "340K Reach",
    engagementRate: "6.4% ER",
    aiAuthenticity: "98% Real Audience",
    verified: true,
    likes: "31.2K",
    comments: "980",
    brandPartner: "Acme Brand",
    description: "Editorial capsule storytelling with city rain ambience. Drove +18% PDP views in 72 hours."
  },
  {
    id: "feed-6",
    creatorName: "Vikram Patel",
    handle: "vikram.food",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400",
    workTitle: "Street Kitchen Collab Series",
    workImage: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=800",
    category: "Food & Cooking",
    reach: "410K Reach",
    engagementRate: "7.8% ER",
    aiAuthenticity: "99% Real Audience",
    verified: true,
    likes: "47.0K",
    comments: "1.6K",
    brandPartner: "Zomato",
    description: "High-retention cooking short with branded CTA. Generated 2.1K app opens via tracked link."
  }
];

function OwnerPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [pendingApps, setPendingApps] = useState([]);

  useEffect(() => {
    api.get("/campaigns?mine=true").then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => setItems([]));
    if (user?.role === "owner") {
      api.get("/analytics/owner").then((r) => setStats(r.data && typeof r.data === "object" ? r.data : null)).catch(() => setStats(null));
    }
  }, [user?.role]);

  useEffect(() => {
    const loadPending = async () => {
      const camps = Array.isArray(items) ? items : [];
      const open = camps.filter((c) => ["open", "in_progress", "active"].includes((c.status || "").toLowerCase())).slice(0, 8);
      const rows = [];
      for (const c of open) {
        try {
          const { data } = await api.get(`/campaigns/${c.id}/applications`);
          const apps = (Array.isArray(data) ? data : []).filter((a) => (a.status || "") === "pending");
          apps.forEach((a) => rows.push({ ...a, campaign_title: c.title, campaign_id: c.id }));
        } catch {
          /* skip */
        }
      }
      setPendingApps(rows.slice(0, 6));
    };
    if (items.length) loadPending();
  }, [items]);

  const safeItems = Array.isArray(items) ? items : [];
  const activeCamps = safeItems.filter((c) => ["open", "in_progress", "active", "live"].includes((c.status || "").toLowerCase()));
  const hasLiveStats = stats && (
    Number(stats.total_campaigns || 0) > 0
    || Number(stats.applications_total || 0) > 0
    || Number(stats.open_campaigns || 0) > 0
    || Number(stats.active_campaigns || 0) > 0
  );

  const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString()}`;
  const fmtCompact = (n) => {
    const v = Number(n) || 0;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (v >= 1_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(Math.round(v));
  };

  const tiles = hasLiveStats
    ? [
        { k: "Active Campaigns", v: stats?.active_campaigns ?? activeCamps.length, tail: `of ${stats?.total_campaigns ?? safeItems.length} total`, to: "/marketplace?tab=campaigns" },
        { k: "Applications Pending", v: stats?.applications_pending ?? pendingApps.length, tail: "awaiting action", to: "/marketplace?tab=campaigns" },
        { k: "Deliverables Pending", v: stats?.deliverables_pending ?? 0, tail: "review / approve", to: "/marketplace?tab=campaigns" },
        { k: "Pending Payments", v: fmtMoney(stats?.pending_payments ?? stats?.escrow_held ?? 0), tail: `${stats?.pending_payments_count ?? 0} payments pending`, to: "/wallet" },
        { k: "Total Spends", v: fmtMoney(stats?.total_spend ?? stats?.paid_to_creators ?? 0), tail: "released to creators", to: "/wallet" },
        { k: "Influencers Hired", v: stats?.influencers_hired ?? 0, tail: "accepted creators", to: "/influencers" },
      ]
    : [
        { k: "Active Campaigns", v: Math.max(activeCamps.length, 3), tail: `of ${Math.max(safeItems.length, 5)} total`, to: "/marketplace?tab=campaigns" },
        { k: "Applications Pending", v: Math.max(pendingApps.length, 4), tail: "awaiting action", to: "/marketplace?tab=campaigns" },
        { k: "Deliverables Pending", v: 2, tail: "review / approve", to: "/marketplace?tab=campaigns" },
        { k: "Pending Payments", v: "₹1,25,000", tail: "4 payments pending", to: "/wallet" },
        { k: "Total Spends", v: "₹8,40,000", tail: "released to creators", to: "/wallet" },
        { k: "Influencers Hired", v: 18, tail: "accepted creators", to: "/influencers" },
      ];

  const perf = hasLiveStats
    ? {
        reach: stats?.total_reach ? fmtCompact(stats.total_reach) : "—",
        engagement: stats?.total_engagement ? fmtCompact(stats.total_engagement) : "—",
        er: stats?.avg_engagement_rate != null ? `${Number(stats.avg_engagement_rate).toFixed(1)}%` : "—",
        spend: fmtMoney(stats?.total_spend ?? stats?.paid_to_creators ?? 0),
        revenue: stats?.revenue_generated ? fmtMoney(stats.revenue_generated) : "—",
        roas: stats?.avg_roas != null ? `${Number(stats.avg_roas).toFixed(2)}x` : "—",
      }
    : {
        reach: "4.8M",
        engagement: "386K",
        er: "8.1%",
        spend: "₹8.4L",
        revenue: "₹24.6L",
        roas: "2.93x",
      };

  return (
    <div className="flex flex-col w-full space-y-4 min-w-0 overflow-x-hidden">
      {/* Header + primary actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">Brand Desk</p>
          <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate">
            {user?.company || user?.name || "Brand Dashboard"}
          </h1>
          <p className="font-sans text-xs opacity-50 mt-1">Campaign operations, applications, payments & performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/marketplace?tab=campaigns"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/20 text-[10px] uppercase tracking-widest font-mono hover:border-white/40"
          >
            <Briefcase className="w-3.5 h-3.5" /> My Campaigns
          </Link>
          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#FF3B30] text-white text-[10px] uppercase tracking-widest font-mono font-bold hover:bg-[#e03126]"
          >
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="owner-analytics">
        {tiles.map((t, i) => (
          <Link key={t.k} to={t.to || "/dashboard"}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.04 }}
              className="p-4 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md flex flex-col justify-center h-full hover:border-[#FF3B30]/40 transition-colors"
            >
              <div className="font-sans text-[9px] tracking-[0.22em] uppercase text-[#FF3B30] font-bold leading-tight">{t.k}</div>
              <div className="font-sans font-bold text-lg md:text-xl leading-tight mt-1.5 text-white tracking-tight tabular-nums">{t.v}</div>
              <div className="font-sans text-[9px] tracking-[0.16em] uppercase opacity-50 mt-1 leading-snug">{t.tail}</div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Campaign performance + payment spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30] font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Campaign Performance
            </h2>
            <Link to="/influencers" className="font-mono text-[9px] uppercase tracking-widest opacity-50 hover:opacity-100">Discover influencers →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["Total Reach", perf.reach],
              ["Total Engagement", perf.engagement],
              ["Engagement Rate", perf.er],
              ["Total Spend", perf.spend],
              ["Revenue Generated", perf.revenue],
              ["ROAS", perf.roas],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">{label}</div>
                <div className="font-sans text-lg font-bold mt-1 tabular-nums">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30] font-bold mb-3">Payments</h2>
          <div className="space-y-3 flex-1">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">Pending</div>
              <div className="font-sans text-2xl font-bold mt-0.5 tabular-nums">
                {hasLiveStats ? fmtMoney(stats?.pending_payments ?? stats?.escrow_held ?? 0) : "₹1,25,000"}
              </div>
              <div className="font-sans text-[10px] opacity-50 mt-0.5">
                {hasLiveStats ? `${stats?.pending_payments_count ?? 0} payments pending` : "4 payments pending"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">Paid</div>
                <div className="font-sans text-sm font-bold mt-0.5 tabular-nums">
                  {hasLiveStats ? fmtMoney(stats?.paid_to_creators ?? 0) : "₹12,40,000"}
                </div>
              </div>
              <div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">Escrow</div>
                <div className="font-sans text-sm font-bold mt-0.5 tabular-nums">
                  {hasLiveStats ? fmtMoney(stats?.escrow_held ?? 0) : "₹4,85,000"}
                </div>
              </div>
            </div>
          </div>
          <Link to="/wallet" className="mt-4 inline-flex justify-center px-3 py-2 rounded-full border border-white/20 text-[9px] uppercase tracking-widest font-mono hover:border-[#FF3B30]/50">
            Open Wallet →
          </Link>
        </div>
      </div>

      {/* Active campaigns */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/50">Active Campaigns</h2>
          <Link to="/marketplace?tab=campaigns" className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">View all →</Link>
        </div>
        {(activeCamps.length > 0 ? activeCamps : safeItems).length === 0 ? (
          <Empty label="No campaigns yet. Create your first campaign." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(activeCamps.length > 0 ? activeCamps : safeItems).slice(0, 4).map((c) => (
              <CampaignRow key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* Pending applications */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/50">Pending Applications</h2>
          <Link to="/influencers" className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">Discover influencers →</Link>
        </div>
        {pendingApps.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center font-sans text-sm opacity-50">
            No applications waiting right now.
          </div>
        ) : (
          <div className="space-y-2">
            {pendingApps.map((a) => (
              <Link
                key={a.id || `${a.campaign_id}-${a.influencer_id}`}
                to={`/campaigns/${a.campaign_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 hover:border-[#FF3B30]/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-sans text-sm font-semibold truncate">{a.influencer_name || a.name || "Creator"}</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 truncate">{a.campaign_title}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {a.rate != null ? (
                    <span className="font-sans text-sm font-bold text-[#34C759]">₹{Number(a.rate).toLocaleString()}</span>
                  ) : null}
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">Review →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================================
   2. CREATOR / INFLUENCER PANEL — CAMPAIGNS & BRIEF DISCOVERY (Primary for Influencers)
   ========================================================================= */
function InfluencerPanel() {
  const { user, refresh } = useAuth();
  const [apps, setApps] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns-feed");
  const [selectedNiches, setSelectedNiches] = useState([]); // [] = All

  const [wallet, setWallet] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/creators/sync-analytics");
      await refresh();
    } catch (e) {
      console.error(e);
    }
    setSyncing(false);
  };

  useEffect(() => {
    refresh();
    api.get("/applications/mine").then((r) => setApps(Array.isArray(r.data) ? r.data : [])).catch(() => setApps([]));
    api.get("/analytics/creator").then((r) => setStats(r.data && typeof r.data === "object" ? r.data : null)).catch(() => setStats(null));
    api.get("/campaigns/match").then((r) => setMatches(Array.isArray(r.data) ? r.data : [])).catch(() => setMatches([]));
    api.get("/wallet").then((r) => setWallet(r.data)).catch(() => setWallet(null));
  }, [refresh]);

  const safeApps = Array.isArray(apps) ? apps : [];
  const safeMatches = Array.isArray(matches) ? matches : [];
  const pitchList = safeApps.length > 0 ? safeApps : MOCK_PITCHES;

  const campaignList = safeMatches.length > 0 ? safeMatches : DEFAULT_CAMPAIGNS_FOR_CREATORS;

  const filteredCampaigns = campaignList.filter((c) =>
    matchesCategoryFilter(c?.niche || c?.niches || c?.category, selectedNiches)
  );

  return (
    <div className="flex flex-col w-full min-w-0 space-y-4">
      <CreatorDashboard
        user={user}
        stats={stats}
        wallet={wallet}
        campaigns={filteredCampaigns}
        pitchCount={safeApps.length}
      />

      <SocialConnect
        connectedPlatforms={connectedSocialPlatforms(user)}
        onConnect={refresh}
      />
      <SocialAnalyticsCards
        connections={analyticsConnections(user)}
        onSync={handleSync}
        isSyncing={syncing}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex gap-4 font-sans text-[11px] tracking-[0.22em] uppercase flex-wrap">
          <button
            onClick={() => setActiveTab("campaigns-feed")}
            className={`kinetic-underline py-1.5 flex items-center gap-1.5 ${
              activeTab === "campaigns-feed" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#FF3B30]" /> Live Campaign Briefs ({filteredCampaigns.length})
          </button>
          <button
            onClick={() => setActiveTab("my-pitches")}
            className={`kinetic-underline py-1.5 flex items-center gap-1.5 ${
              activeTab === "my-pitches" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> My Pitches & Applications ({pitchList.length})
          </button>
        </div>
        {activeTab === "campaigns-feed" && (
          <div className="flex flex-wrap gap-2 items-center">
            <Link
              to="/marketplace?tab=campaigns&view=map"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF3B30]/45 text-[#FF3B30] text-[10px] uppercase tracking-widest font-bold hover:bg-[#FF3B30]/10"
            >
              <Compass className="w-3.5 h-3.5" /> Map
            </Link>
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-50 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#FF3B30]" /> Category
            </span>
            <div className="w-[13rem] max-w-full">
              <MultiSelectDropdown
                options={PLATFORM_CATEGORIES}
                selected={selectedNiches}
                onChange={setSelectedNiches}
                placeholder="All"
                allowAll
                compact
                noUnderline
              />
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0">
      {/* VIEW 1: LIVE CAMPAIGN BRIEFS & DISCOVERY */}
      {activeTab === "campaigns-feed" && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCampaigns.map((c, idx) => (
            <motion.div
              key={c.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="glass-card p-4 relative overflow-hidden group hover:border-[#FF3B30]/50 transition-all duration-500 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-bold rounded-xs flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {c.aiMatch || "96% AI Match"}
                  </span>
                  <span className="font-sans text-[8px] tracking-[0.16em] uppercase text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 border border-[#34C759]/30 rounded-xs flex items-center gap-1 font-bold">
                    <Lock className="w-3 h-3" /> Escrow
                  </span>
                </div>
                <p className="font-sans text-[9px] tracking-[0.22em] uppercase opacity-60 mb-0.5">{c.brand}</p>
                <h3 className="font-sans text-sm font-semibold leading-snug group-hover:text-[#FF3B30] transition-colors">
                  {c.title}
                </h3>
                <p className="font-sans text-xs opacity-70 mt-2 leading-relaxed line-clamp-2">
                  {c.description}
                </p>
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1 font-sans text-[10px] opacity-75">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-[#FF3B30] shrink-0" />
                    <span className="truncate">{c.deliverables || "2x Reels + 4x Stories"}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="font-sans text-[8px] tracking-[0.18em] uppercase opacity-50 block">Budget</span>
                  <span className="font-sans text-base text-white font-bold">
                    ₹{typeof c.budget === "number" ? c.budget.toLocaleString() : (c.budget ?? "N/A")}
                  </span>
                </div>
                <Link
                  to={`/campaigns/${c.id}`}
                  className="btn-solid py-1.5 px-3 text-[10px] bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-1"
                >
                  Pitch <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* VIEW 2: MY PITCHES & APPLICATION TRACKER */}
      {activeTab === "my-pitches" && (
        <div className="space-y-3">
          {pitchList.length === 0 ? (
            <Empty label="No pitches submitted yet. Pitch live briefs above." />
          ) : (
            <div className="space-y-3">
              {pitchList.map((a) => (
                <div key={a.id} className="p-3 bg-[#121212]/90 border border-white/15 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-[9px] tracking-[0.22em] uppercase text-[#FF3B30] font-bold">{a.campaign_brand || a.brand}</p>
                    <h4 className="font-sans text-sm font-bold mt-0.5">{a.campaign_title || "Campaign Brief"}</h4>
                    <p className="font-sans text-xs opacity-60 mt-0.5">
                      {a.note || `Pitch Rate: ₹${a.rate ? Number(a.rate).toLocaleString() : (a.budget ? Number(a.budget).toLocaleString() : "—")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-sans text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 border rounded-xs font-bold ${
                      a.status === "accepted" ? "bg-[#34C759]/10 border-[#34C759]/40 text-[#34C759]"
                        : a.status === "shortlisted" ? "bg-[#FF9500]/10 border-[#FF9500]/40 text-[#FF9500]"
                        : "bg-white/5 border-white/20 text-white/70"
                    }`}>
                      {a.status}
                    </span>
                    <Link to={`/campaigns/${a.campaign_id}`} className="btn-solid py-1.5 px-3 text-[10px] bg-white/10 hover:bg-[#FF3B30] text-white">
                      View ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div> {/* End Scrollable Area */}
    </div>
  );
}

/* =========================================================================
   3. TALENT AGENT PANEL (Supports Company Agents & Influencer Agents)
   ========================================================================= */
const DEFAULT_COMPANY_AGENT_BRANDS = [
  { name: "Acme Luxe Apparel Ltd.", industry: "Fashion & Apparel", contact: "partnerships@acmeluxe.com", tier: "Enterprise VIP", activeCampaigns: 3, budget: "₹12,50,000", status: "Active Client" },
  { name: "HyperTech Global SaaS", industry: "Technology & SaaS", contact: "marketing@hypertech.io", tier: "Corporate Client", activeCampaigns: 2, budget: "₹8,00,000", status: "Active Client" },
  { name: "Veda Organics Skincare", industry: "Beauty & Wellness", contact: "collab@vedaorganics.in", tier: "Growth Brand", activeCampaigns: 2, budget: "₹5,50,000", status: "Active Client" }
];

function AgentPanel() {
  const { user } = useAuth();
  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [associatedBrands] = useState(user?.associated_brands?.length ? user.associated_brands : DEFAULT_COMPANY_AGENT_BRANDS);

  useEffect(() => {
    api.get("/creators").then((r) => setCreators(Array.isArray(r.data) ? r.data : [])).catch(() => setCreators([]));
    api.get("/campaigns").then((r) => setCampaigns(Array.isArray(r.data) ? r.data : [])).catch(() => setCampaigns([]));
  }, []);

  const isInfluencerAgent = user?.agent_type === "influencer_agent";
  const creatorList = (Array.isArray(creators) && creators.length > 0) ? creators : MOCK_AGENT_CREATORS;
  const campaignList = (Array.isArray(campaigns) && campaigns.length > 0) ? campaigns : DEFAULT_CAMPAIGNS_FOR_CREATORS;

  return (
    <div className="w-full space-y-3 pb-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2 sticky top-0 bg-[#0B0B0E]/95 backdrop-blur-sm z-10 pt-1">
        <div>
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
            § Talent Representative Console
          </span>
          <h2 className="font-sans text-base font-bold mt-0.5">
            {isInfluencerAgent ? "⭐ Influencer & Talent Agent Desk" : "🏢 Company & Brand Agent Desk"}
          </h2>
        </div>
      </div>

      {isInfluencerAgent ? (
        <div className="space-y-3">
          <h3 className="font-sans text-sm font-semibold opacity-70">Scouted Influencer Roster ({creatorList.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {creatorList.map((c) => (
              <Link key={c.id} to={String(c.id).startsWith("demo-") ? "/marketplace" : `/creators/${c.id}`} className="flex flex-col hover:bg-white/5 transition p-2 border border-white/15 rounded-3xl">
                <div className="h-24 w-full border-b border-[#F4F4F0]/10 overflow-hidden mb-2 rounded-xs bg-white/5">
                  <img src={c.avatar} alt={c.name} className="w-full h-full object-cover transition duration-500" />
                </div>
                <h4 className="font-sans text-xs font-semibold truncate">{c.name}</h4>
                <p className="text-[9px] font-sans uppercase opacity-70 text-[#FF3B30] mt-0.5 truncate">{c.niches?.join(", ")}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-sans text-sm font-semibold opacity-70">Associated Brands ({associatedBrands.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {associatedBrands.map((b) => (
                <div key={b.name} className="p-4 border border-white/15 rounded-3xl bg-white/[0.02]">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">{b.tier || "Client"}</div>
                  <h4 className="font-sans text-sm font-bold mt-1">{b.name}</h4>
                  <p className="text-xs text-white/50 mt-1">{b.industry}</p>
                  <div className="mt-3 flex justify-between text-[10px] font-mono uppercase tracking-wider text-white/60">
                    <span>{b.activeCampaigns || 0} campaigns</span>
                    <span>{b.budget}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-sans text-sm font-semibold opacity-70">Client Campaigns ({campaignList.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {campaignList.map((c) => (
                <CampaignRow key={c.id} c={c} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductionPanel() {
  const nav = useNavigate();
  const [requests, setRequests] = useState([]);
  useEffect(() => {
    api.get("/marketplace/hire-requests").then((r) => setRequests(r.data?.requests || [])).catch(() => {});
  }, []);
  const pending = requests.filter((r) => r.status === "pending").length;
  return (
    <div className="w-full pb-8">
      <div className="border-b border-white/10 pb-4 mb-5">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">Hire / Production Team</p>
        <h1 className="font-sans text-3xl font-bold tracking-tight mt-1">Production desk</h1>
        <p className="font-sans text-sm text-white/50 mt-1">Manage hire requests from brands and creators.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">Pending requests</p>
          <p className="font-sans text-2xl font-bold mt-1">{pending}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">Total requests</p>
          <p className="font-sans text-2xl font-bold mt-1">{requests.length}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => nav("/hire-requests")} className="px-4 py-2 rounded-full bg-[#FF3B30] text-white font-mono text-[10px] uppercase tracking-widest font-bold">
          Open hire requests
        </button>
        <button type="button" onClick={() => nav("/profile")} className="px-4 py-2 rounded-full border border-white/15 font-mono text-[10px] uppercase tracking-widest">
          Edit profile
        </button>
        <button type="button" onClick={() => nav("/wishlist")} className="px-4 py-2 rounded-full border border-white/15 font-mono text-[10px] uppercase tracking-widest">
          Wishlist
        </button>
      </div>
    </div>
  );
}

function CampaignRow({ c }) {
  const { user } = useAuth();
  const [apps, setApps] = useState(null);
  useEffect(() => {
    if (user?.role === "owner") {
      api.get(`/campaigns/${c.id}/applications`).then(r => setApps(r.data)).catch(() => {});
    }
  }, [c.id, user?.role]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="p-3 bg-[#121212]/90 border border-white/15 rounded-3xl flex flex-col justify-between min-h-0 hover:border-[#FF3B30]/50 transition-all"
    >
      <div>
        <div className="font-sans text-[10px] tracking-[0.22em] uppercase text-[#FF3B30] font-bold">{c.brand}</div>
        <h3 className="font-sans text-sm leading-snug font-semibold mt-1">{c.title}</h3>
        <p className="text-xs font-sans opacity-70 mt-1.5 line-clamp-2 leading-relaxed">{c.description}</p>
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-2">
        <div className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-60">
          Budget:
        </div>
        <div className="font-sans text-sm text-white font-semibold">₹{c.budget}</div>
      </div>
    </motion.div>
  );
}

function Empty({ label }) {
  return (
    <div className="border border-white/10 py-10 text-center rounded-3xl bg-white/[0.01]">
      <div className="font-sans italic text-lg opacity-60">{label}</div>
    </div>
  );
}
