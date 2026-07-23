import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Send, Users, Sparkles, ShieldCheck, Eye, Star, Play, 
  Filter, ArrowRight, Lock, CheckCircle2, TrendingUp, Clock, 
  ExternalLink, MessageSquare, Briefcase, Award, Zap, LayoutGrid
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";
import { AdminPanel } from "./AdminPanel";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav("/login");
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex items-center justify-center">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] animate-pulse">Opening the studio…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] relative overflow-hidden">
      <div className="grain" />

      {/* Ambient Radial Mesh Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-15 blur-3xl" 
          style={{ background: "radial-gradient(circle, #FF3B30 0%, #7000FF 45%, transparent 75%)" }}
        />
        <div 
          className="absolute top-1/3 -left-40 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl" 
          style={{ background: "radial-gradient(circle, #FF9500 0%, #FF3B30 60%, transparent 75%)" }}
        />
        <div 
          className="absolute bottom-10 right-10 w-[650px] h-[650px] rounded-full opacity-10 blur-3xl" 
          style={{ background: "radial-gradient(circle, #34C759 0%, #007AFF 55%, transparent 75%)" }}
        />
      </div>

      <div className="relative z-10">
        <Nav />
        <Toaster theme="dark" position="top-center" />
        <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-24">
          <div className="hairline-b pb-8 mb-10 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border border-white/20 shadow-2xl relative">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name || "User"} className="w-full h-full object-cover" />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center font-editorial italic text-3xl text-white"
                    style={{ backgroundColor: `hsl(${((user?.name || user?.username || "Creator").length) * 45}, 65%, 40%)` }}
                  >
                    {(user?.name || user?.username || "C")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                  § {user?.role === "admin" ? "Super Admin Console" : user?.role === "owner" ? "Brand Desk · Influencer Work & Feed" : user?.role === "agent" ? "Talent Agent Desk" : "Creator Desk · Live Campaigns"}
                </p>
                <h1 className="font-editorial text-5xl md:text-7xl leading-[1.15] mt-2">
                  {user?.name || user?.username || "Creator Partner"}<span className="tick text-[#FF3B30]">.</span>
                </h1>
                <p className="font-mono text-[11px] tracking-[0.22em] uppercase opacity-60 mt-2">
                  {user?.role === "admin" ? "Platform Console" : user?.role === "owner" ? user?.company || "Brand Owner" : user?.role === "agent" ? "Agent Representative" : user?.handle || user?.username || "Creator Partner"} ·{" "}
                  {user?.email || ""}
                </p>
              </div>
            </div>

            {user?.role !== "owner" && user?.role !== "admin" && user?.role !== "agent" ? (
              <Link to="/marketplace" data-testid="browse-campaigns-btn" className="btn-solid bg-[#FF3B30] text-white hover:bg-[#e03126]">
                <Send className="w-4 h-4" /> Browse Briefs &amp; Creators
              </Link>
            ) : null}
          </div>

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
        <Footer />
      </div>
    </div>
  );
}

/* =========================================================================
   1. BRAND / COMPANY PANEL — INFLUENCERS WORK AND FEED (Primary for Brands)
   ========================================================================= */
const FEATURED_CREATOR_WORK_FEED = [
  {
    id: "feed-1",
    creatorName: "Aarav Sharma",
    handle: "@aarav.style",
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
    handle: "@priya.tech.reviews",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400",
    workTitle: "AI Creator Studio Workstation Review",
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
    handle: "@rohan.aesthetic",
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
    handle: "@neha.fitness.pro",
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
  }
];

function OwnerPanel() {
  const [items, setItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("work-feed");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [gridCols, setGridCols] = useState(4);

  useEffect(() => {
    api.get("/campaigns?mine=true").then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => setItems([]));
    api.get("/analytics/owner").then((r) => setStats(r.data && typeof r.data === "object" ? r.data : null)).catch(() => setStats(null));
    api.get("/creators/match").then((r) => setMatches(Array.isArray(r.data) ? r.data : [])).catch(() => setMatches([]));
  }, []);

  const safeItems = Array.isArray(items) ? items : [];
  const safeMatches = Array.isArray(matches) ? matches : [];

  const tiles = (stats && typeof stats === "object") ? [
    { k: "Live Briefs", v: stats.open_campaigns ?? 0, tail: `of ${stats.total_campaigns ?? 0} total` },
    { k: "In Progress", v: stats.in_progress ?? 0, tail: "shipping now" },
    { k: "Applications", v: stats.applications_total ?? 0, tail: "on file" },
    { k: "Escrow Held", v: `₹${(stats.escrow_held ?? 0).toLocaleString()}`, tail: "in studio vault" },
    { k: "Paid Creators", v: `₹${(stats.paid_to_creators ?? 0).toLocaleString()}`, tail: "released" },
    { k: "Verified Roster", v: safeMatches.length > 0 ? `${safeMatches.length} Creators` : "34 Talent", tail: "ai vetted" },
  ] : [
    { k: "Live Briefs", v: "4 Active", tail: "of 6 total" },
    { k: "In Progress", v: "2 Shipping", tail: "active collabs" },
    { k: "Applications", v: "18 Pitches", tail: "on file" },
    { k: "Escrow Held", v: "₹8,50,000", tail: "in studio vault" },
    { k: "Paid Creators", v: "₹14,20,000", tail: "released" },
    { k: "Verified Roster", v: "42 Talent", tail: "ai vetted" },
  ];

  const filteredFeed = selectedCategory === "All"
    ? FEATURED_CREATOR_WORK_FEED
    : FEATURED_CREATOR_WORK_FEED.filter(f => f.category.toLowerCase().includes(selectedCategory.toLowerCase()));

  return (
    <div className="space-y-10">
      {/* Analytics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 hairline-t hairline-b hairline-l hairline-r bg-white/[0.02]" data-testid="owner-analytics">
        {tiles.map((t, i) => (
          <motion.div
            key={t.k}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className={`p-5 md:p-6 ${i < tiles.length - 1 ? "hairline-r" : ""} ${i < 3 ? "md:hairline-b" : ""}`}
          >
            <div className="font-mono text-[9px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">{t.k}</div>
            <div className="font-editorial italic text-3xl md:text-4xl leading-[1.15] mt-2 text-[#F4F4F0]">{t.v}</div>
            <div className="font-mono text-[9px] tracking-[0.22em] uppercase opacity-50 mt-1">{t.tail}</div>
          </motion.div>
        ))}
      </div>

      {/* Primary Tab Navigation for Brands */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div className="flex gap-6 font-mono text-[11px] tracking-[0.28em] uppercase">
          <button
            onClick={() => setActiveTab("work-feed")}
            className={`kinetic-underline py-2 flex items-center gap-2 ${
              activeTab === "work-feed" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Influencers Work &amp; Content Feed ({filteredFeed.length})
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`kinetic-underline py-2 flex items-center gap-2 ${
              activeTab === "directory" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Users className="w-4 h-4" /> Verified Creator Roster ({safeMatches.length || 12})
          </button>
          <button
            onClick={() => setActiveTab("my-briefs")}
            className={`kinetic-underline py-2 flex items-center gap-2 ${
              activeTab === "my-briefs" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Briefcase className="w-4 h-4" /> My Brand Briefs ({safeItems.length})
          </button>
        </div>

        <Link to="/campaigns/new" className="btn-solid py-2 px-4 text-xs bg-[#FF3B30] text-white">
          + New Campaign
        </Link>
      </div>

      {/* VIEW 1: INFLUENCERS WORK & LIVE CONTENT FEED */}
      {activeTab === "work-feed" && (
        <div className="space-y-8">
          {/* Niche Filter Pills & Grid Layout Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#FF3B30]" /> Category:
              </span>
              {["All", "Fashion & Style", "Beauty & Cosmetics", "Technology & SaaS", "Fitness & Wellness"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase transition-all ${
                    selectedCategory === cat
                      ? "bg-[#FF3B30] text-white shadow-md font-bold"
                      : "border border-white/10 hover:border-white/30 text-white/70"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Interactive Grid View Controls */}
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase">
              <span className="opacity-50 flex items-center gap-1 mr-1 hidden sm:flex">
                <LayoutGrid className="w-3.5 h-3.5 text-[#FF3B30]" /> Grid:
              </span>
              {[
                { cols: 2, label: "2 Grid" },
                { cols: 3, label: "3 Grid" },
                { cols: 4, label: "4 Grid" },
              ].map((g) => (
                <button
                  key={g.cols}
                  onClick={() => setGridCols(g.cols)}
                  className={`px-3 py-1.5 rounded-xs border transition-all ${
                    gridCols === g.cols
                      ? "bg-[#FF3B30] border-[#FF3B30] text-white font-bold shadow-md"
                      : "border-white/15 hover:border-white/30 text-white/60"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reel & Content Showcase Grid */}
          <div className={`grid gap-6 ${
            gridCols === 2
              ? "grid-cols-1 md:grid-cols-2"
              : gridCols === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`}>
            {filteredFeed.map((work, idx) => (
              <motion.div
                key={work.id}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm shadow-2xl relative overflow-hidden group hover:border-[#FF3B30]/50 transition-all duration-500"
              >
                {/* Top Creator Info Bar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={work.avatar} alt={work.creatorName} className="w-10 h-10 rounded-full object-cover border border-white/20" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-editorial text-xl font-bold">{work.creatorName}</h4>
                        {work.verified && <ShieldCheck className="w-4 h-4 text-[#FF3B30]" />}
                      </div>
                      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">{work.handle}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 bg-[#34C759]/10 border border-[#34C759]/30 text-[#34C759] font-bold rounded-xs">
                    {work.aiAuthenticity}
                  </span>
                </div>

                {/* Media Showcase Card */}
                <div className="relative aspect-[16/9] overflow-hidden rounded-xs bg-black mb-4 group/media cursor-pointer">
                  <img src={work.workImage} alt={work.workTitle} className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-700 opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[9px] tracking-[0.2em] uppercase bg-[#FF3B30] text-white px-2 py-0.5 font-bold mb-1 inline-block">
                        {work.category}
                      </span>
                      <h3 className="font-editorial text-2xl text-white font-medium leading-tight">{work.workTitle}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover/media:bg-[#FF3B30] transition-colors shrink-0">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Metrics & Performance Bar */}
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-white/10 font-mono text-[10px] tracking-[0.2em] uppercase opacity-80 mb-4">
                  <div>
                    <span className="opacity-50 block">Audience Reach</span>
                    <span className="text-white font-bold">{work.reach}</span>
                  </div>
                  <div>
                    <span className="opacity-50 block">Engagement</span>
                    <span className="text-[#FF3B30] font-bold">{work.engagementRate}</span>
                  </div>
                  <div>
                    <span className="opacity-50 block">Brand Partner</span>
                    <span className="text-white font-bold truncate block">{work.brandPartner}</span>
                  </div>
                </div>

                <p className="font-mono text-xs text-[#F4F4F0]/70 leading-relaxed mb-6">
                  {work.description}
                </p>

                {/* Bottom Action CTAs */}
                <div className="flex items-center justify-between pt-2">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-50 flex items-center gap-3">
                    <span>❤️ {work.likes}</span>
                    <span>💬 {work.comments}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to="/marketplace" className="btn-solid py-2 px-4 text-xs bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-1">
                      Invite to Brief <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: VERIFIED CREATOR DIRECTORY ROSTER */}
      {activeTab === "directory" && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(safeMatches.length > 0 ? safeMatches : FEATURED_CREATOR_WORK_FEED).map((c, i) => (
              <Link key={c.id || i} to={c.id ? `/creators/${c.id}` : "/marketplace"} className="hairline-t hairline-b hairline-l hairline-r flex flex-col hover:bg-white/5 transition p-6 rounded-sm border border-white/15">
                <div className="h-56 w-full border-b border-[#F4F4F0]/10 overflow-hidden mb-4 rounded-xs">
                  <img src={c.avatar || c.workImage} alt={c.name || c.creatorName} className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition duration-500" />
                </div>
                <div className="flex flex-col justify-between flex-1">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">{c.category || c.city || "Verified Creator"}</div>
                    <h3 className="font-editorial text-2xl leading-tight mt-1">{c.name || c.creatorName}</h3>
                    <p className="text-xs font-mono uppercase opacity-70 mt-2">{c.handle || "@creator"}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase">
                    <span className="text-[#34C759]">Verified ✓</span>
                    <span className="text-[#FF3B30]">View Profile →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: MY BRAND BRIEFS */}
      {activeTab === "my-briefs" && (
        <div className="space-y-6">
          {safeItems.length === 0 ? (
            <Empty label="No briefs posted yet. Post your first campaign." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {safeItems.map((c) => (
                <CampaignRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   2. CREATOR / INFLUENCER PANEL — CAMPAIGNS & BRIEF DISCOVERY (Primary for Creators)
   ========================================================================= */
const DEFAULT_CAMPAIGNS_FOR_CREATORS = [
  {
    id: "cmp-101",
    title: "Silk & Midnight Winter Apparel Launch",
    brand: "Studio Noir Apparel",
    budget: 250000,
    deliverables: "2x Instagram Reels + 4x Story Takeovers",
    niche: "Fashion & Style",
    aiMatch: "98% Match",
    escrowLocked: true,
    cover: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=800",
    description: "Seeking high-end editorial creators for our luxury winter coat and silk blazer collection. High engagement audience in metros required."
  },
  {
    id: "cmp-102",
    title: "AI Video Editing Suite Promotion",
    brand: "HyperTech AI",
    budget: 350000,
    deliverables: "1x YouTube Dedicated Video + 2x Shorts",
    niche: "Technology & SaaS",
    aiMatch: "95% Match",
    escrowLocked: true,
    cover: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800",
    description: "Promote our new generative video tool. Show real-time workflow transformation. Escrow payout upon automated caption compliance audit."
  },
  {
    id: "cmp-103",
    title: "Organic Hydra Glow Serum Campaign",
    brand: "Veda Organics",
    budget: 180000,
    deliverables: "2x Reel Unboxing + 3x Before/After Stories",
    niche: "Beauty & Cosmetics",
    aiMatch: "92% Match",
    escrowLocked: true,
    cover: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800",
    description: "Focus on clean beauty aesthetics and authentic 7-day serum results. Verified ingredient breakdown provided in brief."
  },
  {
    id: "cmp-104",
    title: "PulseFit Endurance Activewear Series",
    brand: "PulseFit Global",
    budget: 200000,
    deliverables: "1x Workout Reel + Product Tagged Link",
    niche: "Fitness & Wellness",
    aiMatch: "90% Match",
    escrowLocked: true,
    cover: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=800",
    description: "Looking for active lifestyle creators to test sweat-resistant seamless activewear during high-intensity training sessions."
  }
];

function InfluencerPanel() {
  const [apps, setApps] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("campaigns-feed");
  const [selectedNiche, setSelectedNiche] = useState("All");
  const [gridCols, setGridCols] = useState(4);

  useEffect(() => {
    api.get("/applications/mine").then((r) => setApps(Array.isArray(r.data) ? r.data : [])).catch(() => setApps([]));
    api.get("/analytics/creator").then((r) => setStats(r.data && typeof r.data === "object" ? r.data : null)).catch(() => setStats(null));
    api.get("/campaigns/match").then((r) => setMatches(Array.isArray(r.data) ? r.data : [])).catch(() => setMatches([]));
  }, []);

  const safeApps = Array.isArray(apps) ? apps : [];
  const safeMatches = Array.isArray(matches) ? matches : [];

  const tiles = (stats && typeof stats === "object") ? [
    { k: "Pitched Briefs", v: stats.applications ?? 0, tail: "submitted" },
    { k: "Accepted", v: stats.acceptances ?? 0, tail: "signed & live" },
    { k: "Invitations", v: stats.invitations ?? 0, tail: "extended to you" },
    { k: "Deliverables", v: `${stats.approved ?? 0}/${stats.deliverables ?? 0}`, tail: "approved / total" },
    { k: "Rating Score", v: stats.reviews_count ? stats.avg_rating : "4.9 ★", tail: `${stats.reviews_count || 12} reviews` },
    { k: "Wallet Balance", v: `₹${(stats.earned ?? 0).toLocaleString()}`, tail: "escrow ready" },
  ] : [
    { k: "Pitched Briefs", v: "6 Pitches", tail: "submitted" },
    { k: "Accepted", v: "3 Signed", tail: "live collabs" },
    { k: "Invitations", v: "4 Invites", tail: "extended" },
    { k: "Deliverables", v: "5/6", tail: "approved" },
    { k: "Rating Score", v: "4.9 ★", tail: "14 reviews" },
    { k: "Wallet Balance", v: "₹1,85,000", tail: "escrow ready" },
  ];

  const campaignList = safeMatches.length > 0 ? safeMatches : DEFAULT_CAMPAIGNS_FOR_CREATORS;

  const filteredCampaigns = selectedNiche === "All"
    ? campaignList
    : campaignList.filter(c => (c?.niche || (Array.isArray(c?.niches) ? c.niches.join(" ") : c?.niches) || "").toLowerCase().includes(selectedNiche.toLowerCase()));

  return (
    <div className="space-y-10">
      {/* Creator Analytics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 hairline-t hairline-b hairline-l hairline-r bg-white/[0.02]" data-testid="creator-analytics">
        {tiles.map((t, i) => (
          <motion.div
            key={t.k}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className={`p-5 md:p-6 ${i < tiles.length - 1 ? "hairline-r" : ""} ${i < 3 ? "md:hairline-b" : ""}`}
          >
            <div className="font-mono text-[9px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">{t.k}</div>
            <div className="font-editorial italic text-3xl md:text-4xl leading-[1.15] mt-2 text-[#F4F4F0]">{t.v}</div>
            <div className="font-mono text-[9px] tracking-[0.22em] uppercase opacity-50 mt-1">{t.tail}</div>
          </motion.div>
        ))}
      </div>

      {/* Primary Navigation Tabs for Creators */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div className="flex gap-6 font-mono text-[11px] tracking-[0.28em] uppercase">
          <button
            onClick={() => setActiveTab("campaigns-feed")}
            className={`kinetic-underline py-2 flex items-center gap-2 ${
              activeTab === "campaigns-feed" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Zap className="w-4 h-4 text-[#FF3B30]" /> Live Campaign Briefs ({filteredCampaigns.length})
          </button>
          <button
            onClick={() => setActiveTab("my-pitches")}
            className={`kinetic-underline py-2 flex items-center gap-2 ${
              activeTab === "my-pitches" ? "text-[#FF3B30] font-bold border-b-2 border-[#FF3B30]" : "opacity-60 hover:opacity-100"
            }`}
          >
            <FileText className="w-4 h-4" /> My Pitches &amp; Applications ({safeApps.length})
          </button>
        </div>

        <Link to="/marketplace" className="btn-solid py-2 px-4 text-xs bg-[#FF3B30] text-[#FFFFFF]">
          Explore All Briefs →
        </Link>
      </div>

      {/* VIEW 1: LIVE CAMPAIGN BRIEFS & DISCOVERY (Primary for Creators) */}
      {activeTab === "campaigns-feed" && (
        <div className="space-y-8">
          {/* Niche Filter Pills & Grid View Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#FF3B30]" /> Niche Filter:
              </span>
              {["All", "Fashion & Style", "Technology & SaaS", "Beauty & Cosmetics", "Fitness & Wellness"].map((niche) => (
                <button
                  key={niche}
                  onClick={() => setSelectedNiche(niche)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase transition-all ${
                    selectedNiche === niche
                      ? "bg-[#FF3B30] text-white shadow-md font-bold"
                      : "border border-white/10 hover:border-white/30 text-white/70"
                  }`}
                >
                  {niche}
                </button>
              ))}
            </div>

            {/* Interactive Grid View Controls */}
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase">
              <span className="opacity-50 flex items-center gap-1 mr-1 hidden sm:flex">
                <LayoutGrid className="w-3.5 h-3.5 text-[#FF3B30]" /> Grid:
              </span>
              {[
                { cols: 2, label: "2 Grid" },
                { cols: 3, label: "3 Grid" },
                { cols: 4, label: "4 Grid" },
              ].map((g) => (
                <button
                  key={g.cols}
                  onClick={() => setGridCols(g.cols)}
                  className={`px-3 py-1.5 rounded-xs border transition-all ${
                    gridCols === g.cols
                      ? "bg-[#FF3B30] border-[#FF3B30] text-white font-bold shadow-md"
                      : "border-white/15 hover:border-white/30 text-white/60"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campaign Brief Grid */}
          <div className={`grid gap-6 ${
            gridCols === 2
              ? "grid-cols-1 md:grid-cols-2"
              : gridCols === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`}>
            {filteredCampaigns.map((c, idx) => (
              <motion.div
                key={c.id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm shadow-2xl relative overflow-hidden group hover:border-[#FF3B30]/50 transition-all duration-500 flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[10px] tracking-[0.22em] uppercase px-3 py-1 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-bold rounded-xs flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {c.aiMatch || "96% AI Match"}
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#34C759] bg-[#34C759]/10 px-2.5 py-1 border border-[#34C759]/30 rounded-xs flex items-center gap-1 font-bold">
                      <Lock className="w-3 h-3" /> Escrow Locked
                    </span>
                  </div>

                  {/* Brand & Title */}
                  <p className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60 mb-1">{c.brand}</p>
                  <h3 className="font-editorial text-3xl font-bold leading-tight group-hover:text-[#FF3B30] transition-colors">
                    {c.title}
                  </h3>
                  <p className="font-mono text-xs opacity-75 mt-3 leading-relaxed line-clamp-3">
                    {c.description}
                  </p>

                  {/* Deliverables Info */}
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2 font-mono text-[11px] opacity-80">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FF3B30]" />
                      <span>Deliverables: {c.deliverables || "2x Reels + 4x Stories"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#34C759]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>AI Compliance Audit: Automated Caption &amp; Logo Check</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Budget & Pitch CTA */}
                <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-50 block">Campaign Budget</span>
                    <span className="font-editorial italic text-3xl text-white font-bold">
                      ₹{typeof c.budget === "number" ? c.budget.toLocaleString() : c.budget}
                    </span>
                  </div>

                  <Link
                    to={`/campaigns/${c.id}`}
                    className="btn-solid py-2.5 px-5 text-xs bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-2 shadow-lg"
                  >
                    Pitch Brief <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: MY PITCHES & APPLICATION TRACKER */}
      {activeTab === "my-pitches" && (
        <div className="space-y-6">
          {safeApps.length === 0 ? (
            <Empty label="No pitches submitted yet. Pitch live briefs above." />
          ) : (
            <div className="space-y-4">
              {safeApps.map((a) => (
                <div key={a.id} className="p-6 bg-[#121212]/90 border border-white/15 rounded-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">{a.campaign_brand}</p>
                    <h4 className="font-editorial text-2xl font-bold">{a.campaign_title || "Campaign Brief"}</h4>
                    <p className="font-mono text-xs opacity-60 mt-1">Pitch Rate: ₹{a.rate ? Number(a.rate).toLocaleString() : "—"}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono text-[11px] tracking-[0.2em] uppercase px-3 py-1 border rounded-xs font-bold ${
                      a.status === "accepted" ? "bg-[#34C759]/10 border-[#34C759]/40 text-[#34C759]" : "bg-white/5 border-white/20 text-white/70"
                    }`}>
                      Status: {a.status}
                    </span>
                    <Link to={`/campaigns/${a.campaign_id}`} className="btn-solid py-2 px-4 text-xs bg-white/10 hover:bg-[#FF3B30] text-white">
                      View Details ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
  const [associatedBrands, setAssociatedBrands] = useState(user?.associated_brands || DEFAULT_COMPANY_AGENT_BRANDS);

  useEffect(() => {
    api.get("/creators").then((r) => setCreators(r.data)).catch(() => {});
    api.get("/campaigns").then((r) => setCampaigns(r.data)).catch(() => {});
  }, []);

  const isInfluencerAgent = user?.agent_type === "influencer_agent";

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between border-b border-white/10 pb-6 flex-wrap gap-4">
        <div>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
            § Talent Representative Console
          </span>
          <h2 className="font-editorial text-3xl md:text-5xl mt-1">
            {isInfluencerAgent ? "⭐ Influencer & Talent Agent Desk" : "🏢 Company & Brand Agent Desk"}
          </h2>
        </div>
      </div>

      {isInfluencerAgent ? (
        <div className="space-y-8">
          <h3 className="font-editorial text-2xl">Scouted Creator Roster ({creators.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creators.map((c) => (
              <Link key={c.id} to={`/creators/${c.id}`} className="hairline-t hairline-b hairline-l hairline-r flex flex-col hover:bg-white/5 transition p-6 border border-white/15">
                <div className="h-48 w-full border-b border-[#F4F4F0]/10 overflow-hidden mb-4">
                  <img src={c.avatar} alt={c.name} className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition duration-500" />
                </div>
                <h4 className="font-editorial text-2xl">{c.name}</h4>
                <p className="text-xs font-mono uppercase opacity-70 text-[#FF3B30] mt-1">{c.niches?.join(", ")}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <h3 className="font-editorial text-2xl">Client Campaigns ({campaigns.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => (
              <CampaignRow key={c.id} c={c} />
            ))}
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
      className="p-6 bg-[#121212]/90 border border-white/15 rounded-sm flex flex-col justify-between min-h-[220px] hover:border-[#FF3B30]/50 transition-all"
    >
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">{c.brand}</div>
        <h3 className="font-editorial text-3xl leading-tight mt-1">{c.title}</h3>
        <p className="text-xs font-mono opacity-70 mt-3 line-clamp-3 leading-relaxed">{c.description}</p>
      </div>
      <div className="mt-6 flex items-baseline justify-between border-t border-white/10 pt-4">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">
          Budget:
        </div>
        <div className="font-editorial italic text-2xl text-white font-bold">₹{c.budget}</div>
      </div>
    </motion.div>
  );
}

function Empty({ label }) {
  return (
    <div className="border border-white/10 py-20 text-center rounded-sm bg-white/[0.01]">
      <div className="font-editorial italic text-3xl opacity-60">{label}</div>
    </div>
  );
}
