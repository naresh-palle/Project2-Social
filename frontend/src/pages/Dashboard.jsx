
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
import { Nav } from "@/components/Nav";

import { IconTip } from "@/components/IconTip";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES, matchesCategoryFilter } from "@/lib/categories";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { formatUsername, displayAccountName } from "@/lib/username";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { AdminPanel } from "./AdminPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MOCK_CAMPAIGNS as DEFAULT_CAMPAIGNS_FOR_CREATORS, MOCK_PITCHES, MOCK_AGENT_CREATORS } from "@/lib/mockCampaigns";

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
  const [items, setItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("work-feed");
  const [selectedCategories, setSelectedCategories] = useState([]); // [] = All

  useEffect(() => {
    api.get("/campaigns?mine=true").then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => setItems([]));
    api.get("/analytics/owner").then((r) => setStats(r.data && typeof r.data === "object" ? r.data : null)).catch(() => setStats(null));
    api.get("/creators/match").then((r) => setMatches(Array.isArray(r.data) ? r.data : [])).catch(() => setMatches([]));
  }, []);

  const safeItems = Array.isArray(items) ? items : [];
  const safeMatches = Array.isArray(matches) ? matches : [];

  const hasLiveStats = stats && (Number(stats.total_campaigns || 0) > 0 || Number(stats.applications_total || 0) > 0 || Number(stats.open_campaigns || 0) > 0);
  const tiles = hasLiveStats
    ? [
        { k: "Live Briefs", v: stats?.open_campaigns ?? 0, tail: `of ${stats?.total_campaigns ?? 0} total` },
        { k: "In Progress", v: stats?.in_progress ?? 0, tail: "shipping now" },
        { k: "Applications", v: stats?.applications_total ?? 0, tail: "on file" },
        { k: "Escrow Held", v: `₹${(stats?.escrow_held ?? 0).toLocaleString()}`, tail: "in studio vault" },
        { k: "Paid Influencers", v: `₹${(stats?.paid_to_creators ?? 0).toLocaleString()}`, tail: "released" },
        { k: "Verified Roster", v: `${safeMatches.length || 12} Influencers`, tail: "ai vetted" },
      ]
    : [
        { k: "Live Briefs", v: Math.max(safeItems.filter((c) => c.status === "open").length, 3), tail: "of 5 total" },
        { k: "In Progress", v: 2, tail: "shipping now" },
        { k: "Applications", v: 18, tail: "on file" },
        { k: "Escrow Held", v: "₹4,85,000", tail: "in studio vault" },
        { k: "Paid Influencers", v: "₹12,40,000", tail: "released" },
        { k: "Verified Roster", v: `${Math.max(safeMatches.length, 12)} Influencers`, tail: "ai vetted" },
      ];

  const rosterSource = (safeMatches.length > 0 ? safeMatches : FEATURED_CREATOR_WORK_FEED).map((c, i) => ({
    ...c,
    id: c.id || `demo-creator-${i}`,
    name: c.name || c.creatorName,
    category: c.category || c.niche || c.city || "Verified Influencer",
    avatar: c.avatar || c.workImage || FEATURED_CREATOR_WORK_FEED[i % FEATURED_CREATOR_WORK_FEED.length].avatar,
    handle: formatUsername(c.handle, c.username) || FEATURED_CREATOR_WORK_FEED[i % FEATURED_CREATOR_WORK_FEED.length].handle,
  }));

  const filteredFeed = FEATURED_CREATOR_WORK_FEED.filter((f) =>
    matchesCategoryFilter(f.category, selectedCategories)
  );
  const filteredRoster = rosterSource.filter((c) =>
    matchesCategoryFilter(c.category || c.niche || c.niches, selectedCategories)
  );

  return (
    <div className="flex flex-col w-full space-y-3">
      {/* Top Static Section */}
      <div className="space-y-3">
      {/* Analytics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="owner-analytics">
        {tiles.map((t, i) => (
          <motion.div
            key={t.k}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="p-4 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md flex flex-col justify-center"
          >
            <div className="font-sans text-[9px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">{t.k}</div>
            <div className="font-sans font-bold text-lg md:text-xl leading-tight mt-1 text-white tracking-tight">{t.v}</div>
            <div className="font-sans text-[9px] tracking-[0.22em] uppercase opacity-50 mt-0.5">{t.tail}</div>
          </motion.div>
        ))}
      </div>

      {/* Primary Tab Navigation for Brands — category filter merged into row */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-2 gap-2">
        <div className="flex gap-3 font-sans text-[10px] tracking-[0.22em] uppercase flex-wrap items-center">
          <button
            onClick={() => setActiveTab("work-feed")}
            className={`kinetic-underline py-1.5 flex items-center gap-1.5 ${
              activeTab === "work-feed" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Feed ({filteredFeed.length})
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`kinetic-underline py-1.5 flex items-center gap-1.5 ${
              activeTab === "directory" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Verified Influencer Roster ({filteredRoster.length})
          </button>
          <button
            onClick={() => setActiveTab("my-briefs")}
            className={`kinetic-underline py-1.5 flex items-center gap-1.5 ${
              activeTab === "my-briefs" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> My Campaigns ({safeItems.length > 0 ? safeItems.length : DEFAULT_CAMPAIGNS_FOR_CREATORS.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(activeTab === "work-feed" || activeTab === "directory") && (
            <div className="flex flex-wrap gap-2 items-center w-fit max-w-full">
              <span className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-50 flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#FF3B30]" /> Category
              </span>
              <div className="w-[12rem] max-w-full">
                <MultiSelectDropdown
                  options={PLATFORM_CATEGORIES}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                  placeholder="All"
                  allowAll
                  compact
                  noUnderline
                />
              </div>
            </div>
          )}
          <Link to="/campaigns/new" className="btn-solid py-1.5 px-3 text-xs bg-[#FF3B30] text-white">
            + New Campaign
          </Link>
        </div>
      </div>
      </div> {/* End Static Section */}

      {/* Main Content Area */}
      <div className="pb-10 pr-2">
      {/* VIEW 1: FEED */}
      {activeTab === "work-feed" && (
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFeed.map((work, idx) => (
              <motion.div
                key={work.id}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="glass-card p-4 relative overflow-hidden group hover:border-[#FF3B30]/50 transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={work.avatar} alt={work.creatorName} className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <h4 className="font-sans text-xs font-semibold truncate">{work.creatorName}</h4>
                        {work.verified && <ShieldCheck className="w-3.5 h-3.5 text-[#FF3B30] shrink-0" />}
                      </div>
                      <p className="font-sans text-[9px] tracking-[0.16em] uppercase opacity-60 truncate">{work.handle}</p>
                    </div>
                  </div>
                  <span className="font-sans text-[8px] tracking-[0.14em] uppercase px-1.5 py-0.5 bg-[#34C759]/10 border border-[#34C759]/30 text-[#34C759] font-bold rounded-xs shrink-0">
                    {work.aiAuthenticity}
                  </span>
                </div>

                <div className="relative aspect-[16/9] overflow-hidden rounded-xs bg-[#0B0B0E] mb-2 group/media cursor-pointer">
                  <img src={work.workImage} alt={work.workTitle} className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-700 opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-sans text-[8px] tracking-[0.16em] uppercase bg-[#FF3B30] text-white px-1.5 py-0.5 font-bold mb-0.5 inline-block">
                        {work.category}
                      </span>
                      <h3 className="font-sans text-sm text-white font-medium leading-snug line-clamp-2">{work.workTitle}</h3>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover/media:bg-[#FF3B30] transition-colors shrink-0">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 py-2 border-t border-b border-white/10 font-sans text-[9px] tracking-[0.14em] uppercase opacity-80 mb-2">
                  <div>
                    <span className="opacity-50 block">Reach</span>
                    <span className="text-white font-bold">{work.reach}</span>
                  </div>
                  <div>
                    <span className="opacity-50 block">Engagement</span>
                    <span className="text-[#FF3B30] font-bold">{work.engagementRate}</span>
                  </div>
                  <div>
                    <span className="opacity-50 block">Partner</span>
                    <span className="text-white font-bold truncate block">{work.brandPartner}</span>
                  </div>
                </div>

                <p className="font-sans text-xs text-[#F4F4F0]/75 leading-snug mb-2 line-clamp-2">
                  {work.description}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="font-sans text-[9px] tracking-[0.14em] uppercase opacity-50 flex items-center gap-2">
                    <span>❤️ {work.likes}</span>
                    <span>💬 {work.comments}</span>
                  </div>
                  <Link to={`/u/${work.handle}`} className="btn-solid py-1.5 px-2.5 text-[10px] bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-1">
                    View Profile <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: VERIFIED CREATOR DIRECTORY ROSTER */}
      {activeTab === "directory" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {filteredRoster.map((c, i) => (
              <Link key={c.id || i} to={c.id && !String(c.id).startsWith("demo-") && !String(c.id).startsWith("feed-") ? `/creators/${c.id}` : "/marketplace"} className="flex flex-col hover:bg-white/5 transition p-2 rounded-3xl border border-white/15">
                <div className="h-28 w-full border-b border-[#F4F4F0]/10 overflow-hidden mb-2 rounded-xs bg-white/5">
                  <img src={c.avatar || c.workImage} alt={c.name || c.creatorName} className="w-full h-full object-cover transition duration-500" onError={(e) => { e.currentTarget.src = FEATURED_CREATOR_WORK_FEED[i % FEATURED_CREATOR_WORK_FEED.length].avatar; }} />
                </div>
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <div className="font-sans text-[8px] tracking-[0.16em] uppercase text-[#FF3B30] font-bold truncate">{c.category || "Verified Influencer"}</div>
                    <h3 className="font-sans text-xs leading-snug font-semibold mt-0.5 truncate">{c.name || c.creatorName}</h3>
                    <p className="text-[10px] font-sans uppercase opacity-70 mt-0.5 truncate">{c.handle || "creator"}</p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between font-sans text-[8px] tracking-[0.14em] uppercase">
                    <span className="text-[#34C759]">Verified ✓</span>
                    <span className="text-[#FF3B30]">View →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: MY CAMPAIGNS */}
      {activeTab === "my-briefs" && (
        <div className="space-y-3">
          {(safeItems.length > 0 ? safeItems : DEFAULT_CAMPAIGNS_FOR_CREATORS).length === 0 ? (
            <Empty label="No briefs posted yet. Post your first campaign." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(safeItems.length > 0 ? safeItems : DEFAULT_CAMPAIGNS_FOR_CREATORS).map((c) => (
                <CampaignRow key={c.id} c={c} />
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

  const [levelInfo, setLevelInfo] = useState(null);
  const [badges, setBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);

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
    api.get("/applications/mine").then((r) => setApps(Array.isArray(r.data) ? r.data : [])).catch(() => setApps([]));
    api.get("/analytics/creator").then((r) => setStats(r.data && typeof r.data === "object" ? r.data : null)).catch(() => setStats(null));
    api.get("/campaigns/match").then((r) => setMatches(Array.isArray(r.data) ? r.data : [])).catch(() => setMatches([]));

    api.get("/levels/my-progress").then((r) => setLevelInfo(r.data)).catch(() => setLevelInfo(null));
    api.get("/badges/mine").then((r) => setBadges(Array.isArray(r.data) ? r.data : [])).catch(() => setBadges([]));
    api.get("/leaderboard/my-rank?type=top_performer&period=weekly").then((r) => setLeaderboard(r.data)).catch(() => setLeaderboard(null));
  }, []);

  const safeApps = Array.isArray(apps) ? apps : [];
  const safeMatches = Array.isArray(matches) ? matches : [];
  const pitchList = safeApps.length > 0 ? safeApps : MOCK_PITCHES;

  const hasLiveStats = stats && (
    Number(stats.applications || 0) > 0 ||
    Number(stats.acceptances || 0) > 0 ||
    Number(stats.invitations || 0) > 0 ||
    Number(stats.deliverables || 0) > 0 ||
    Number(stats.earned || 0) > 0
  );
  const tiles = hasLiveStats
    ? [
        { k: "Pitched Briefs", v: `${stats?.applications ?? 0} Pitches`, tail: "submitted" },
        { k: "Accepted", v: `${stats?.acceptances ?? 0} Signed`, tail: "signed & live" },
        { k: "Invitations", v: `${stats?.invitations ?? 0} Invites`, tail: "extended to you" },
        { k: "Deliverables", v: `${stats?.approved ?? 0}/${stats?.deliverables ?? 0}`, tail: "approved / total" },
        { k: "Rating Score", v: stats?.reviews_count ? `${stats.avg_rating} ★` : "—", tail: `${stats?.reviews_count || 0} reviews` },
        { k: "Wallet Balance", v: `₹${(stats?.earned ?? user?.wallet ?? 0).toLocaleString()}`, tail: "escrow ready" },
      ]
    : [
        { k: "Pitched Briefs", v: `${Math.max(pitchList.length, 3)} Pitches`, tail: "submitted" },
        { k: "Accepted", v: "1 Signed", tail: "signed & live" },
        { k: "Invitations", v: "4 Invites", tail: "extended to you" },
        { k: "Deliverables", v: "2/3", tail: "approved / total" },
        { k: "Rating Score", v: "4.8 ★", tail: "12 reviews" },
        { k: "Wallet Balance", v: `₹${(user?.wallet || 42500).toLocaleString()}`, tail: "escrow ready" },
      ];

  const campaignList = safeMatches.length > 0 ? safeMatches : DEFAULT_CAMPAIGNS_FOR_CREATORS;

  const filteredCampaigns = campaignList.filter((c) =>
    matchesCategoryFilter(c?.niche || c?.niches || c?.category, selectedNiches)
  );

  return (
    <div className="flex flex-col w-full space-y-3">
      {/* Top Static Section (KPIs, Tabs) */}
      <div className="space-y-3">
      {/* Influencer Analytics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="creator-analytics">
        {tiles.map((t, i) => (
          <motion.div
            key={t.k}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="p-4 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md flex flex-col justify-center"
          >
            <div className="font-sans text-[9px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">{t.k}</div>
            <div className="font-sans font-bold text-lg md:text-xl leading-tight mt-1 text-white tracking-tight">{t.v}</div>
            <div className="font-sans text-[9px] tracking-[0.22em] uppercase opacity-50 mt-0.5">{t.tail}</div>
          </motion.div>
        ))}
      </div>

      {/* Gamification sections removed per requirements */}

      {/* Platform Analytics & Social Connect — always visible above tabs */}
      <SocialConnect
        connectedPlatforms={(user?.oauth_connections || []).map(c => c.platform)}
      />
      <SocialAnalyticsCards
        connections={
          user?.oauth_connections?.length 
            ? user.oauth_connections 
            : Object.keys(user?.platform_metrics || {}).map(plat => ({
                platform: plat,
                handle: user.platform_metrics[plat].handle || user.handle || user.username
              }))
        }
        onSync={handleSync}
        isSyncing={syncing}
      />

      {/* Primary Navigation Tabs for Influencers */}
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
      </div> {/* End Top Static Section */}

      {/* Main Content Area */}
      <div className="pb-10 pr-2">
      {/* VIEW 1: LIVE CAMPAIGN BRIEFS & DISCOVERY */}
      {activeTab === "campaigns-feed" && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
      <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2 sticky top-0 bg-[#0B0B0E]/95 backdrop-blur-sm z-10 pt-1 pr-20">
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
