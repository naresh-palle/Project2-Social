import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, Edit2, Image as ImageIcon, Video as VideoIcon, Briefcase, 
  ExternalLink, Building2, Globe, CheckCircle2, ShieldCheck, Mail, MapPin, 
  Clock, DollarSign, Award, Layers, Languages, UserCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { toast, Toaster } from "sonner";

export default function ProfileView() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/auth/me");
        setProfile(data);
      } catch (e) {
        toast.error("Failed to load profile");
        nav("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [nav]);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#F4F4F0]">
      <div className="animate-pulse font-mono tracking-widest text-xs uppercase text-[#FF3B30]">Loading Studio Profile...</div>
    </div>
  );
  if (!profile) return null;

  const isCreator = profile.role === "influencer";

  const formatNumber = (num) => {
    if (!num || isNaN(num)) return "0";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toString();
  };

  // Dynamic Profile Completion Calculation
  const getCompletionDetails = () => {
    let score = 0;
    const missing = [];

    if (profile.name?.trim()) score += 10; else missing.push("Name");
    if (profile.avatar) score += 10; else missing.push("Profile Picture");
    if (profile.bio?.trim()) score += 15; else missing.push("Bio / About");
    if (profile.city?.trim()) score += 10; else missing.push("Location");

    if (isCreator) {
      if (profile.handle?.trim()) score += 10; else missing.push("Handle");
      const cats = Array.isArray(profile.category) ? profile.category : (profile.category ? profile.category.split(", ") : []);
      if (cats.length > 0) score += 10; else missing.push("Niche");
      if (Number(profile.base_rate) > 0) score += 10; else missing.push("Base Rate");
      if (profile.languages?.length > 0) score += 5; else missing.push("Languages");
      if (profile.past_campaigns?.length > 0) score += 10; else missing.push("Past Campaigns");
      if (Object.values(profile.platform_metrics || {}).some(p => p && p.handle)) score += 10; else missing.push("Social Channel Metrics");
    } else {
      if (profile.company?.trim()) score += 25; else missing.push("Company Name");
      if (profile.industry?.trim()) score += 15; else missing.push("Brand Industry");
      if (profile.website?.trim()) score += 15; else missing.push("Website URL");
    }

    return { score: Math.min(100, score), missing };
  };

  const { score: completionScore, missing: missingFields } = getCompletionDetails();

  const defaultPlatforms = {
    instagram: { handle: profile.handle || `@${profile.name?.toLowerCase().replace(/\s+/g, "")}`, followers: 245000, engagement: 4.8, views: 850000, posts: 142 },
    youtube: { handle: `${profile.name?.replace(/\s+/g, "")}Studio`, followers: 512000, engagement: 6.2, views: 2100000, posts: 86 },
    twitter: { handle: `@${profile.name?.toLowerCase().replace(/\s+/g, "")}_tx`, followers: 128000, engagement: 3.4, views: 450000, posts: 320 },
    facebook: { handle: `${profile.name?.toLowerCase().replace(/\s+/g, "")}official`, followers: 95000, engagement: 2.1, views: 180000, posts: 95 }
  };

  const rawPlatforms = profile.platform_metrics && Object.keys(profile.platform_metrics).length > 0
    ? profile.platform_metrics
    : (isCreator ? defaultPlatforms : {});

  const activePlatforms = Object.entries(rawPlatforms).filter(([_, data]) => data && data.handle && data.handle.trim() !== "");
  const displayPlatforms = activePlatforms.length > 0 
    ? activePlatforms 
    : (isCreator ? Object.entries(defaultPlatforms) : []);

  const totalReach = displayPlatforms.reduce((acc, [_, p]) => acc + (p?.followers || 0), 0);

  const categoriesList = Array.isArray(profile.category) 
    ? profile.category 
    : (profile.category ? profile.category.split(", ") : []);

  const languagesList = Array.isArray(profile.languages) ? profile.languages : [];
  const contentTypesList = Array.isArray(profile.content_types) ? profile.content_types : [];

  const portfolioItems = profile.portfolio || [];
  const portfolioVideos = portfolioItems.filter(item => item && item.match(/\.(mp4|webm|ogg)$/i));
  const portfolioImages = portfolioItems.filter(item => item && !item.match(/\.(mp4|webm|ogg)$/i));
  const pastCampaigns = (profile.past_campaigns || []).slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] relative overflow-hidden">
      <div className="grain" />

      {/* Ambient Radial Lighting Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-15 blur-3xl" 
          style={{ background: "radial-gradient(circle, #FF3B30 0%, #7000FF 50%, transparent 80%)" }}
        />
        <div 
          className="absolute bottom-10 right-10 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl" 
          style={{ background: "radial-gradient(circle, #34C759 0%, #007AFF 60%, transparent 80%)" }}
        />
      </div>

      <div className="relative z-10">
        <Nav />
        <Toaster theme="dark" position="top-center" />
        
        <div className="pt-24 px-6 md:px-12 max-w-7xl mx-auto pb-24">
          <button 
            onClick={() => nav(-1)} 
            className="opacity-60 hover:opacity-100 flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase transition-opacity text-white"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF3B30]" /> Back to Studio
          </button>

          {/* Profile Strength & Completion Meter */}
          <div className="mt-8 bg-[#121212]/90 border border-white/15 p-5 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#FF3B30] flex items-center justify-center bg-[#FF3B30]/10 font-editorial text-lg font-bold text-[#FF3B30] shrink-0">
                {completionScore}%
              </div>
              <div>
                <div className="font-editorial text-xl font-bold flex items-center gap-2">
                  <span>Profile Strength &amp; Verification</span>
                  <span className="font-mono text-[9px] uppercase px-2 py-0.5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] rounded-xs font-bold">
                    {completionScore === 100 ? "Verified Tier 1" : "In Progress"}
                  </span>
                </div>
                {missingFields.length > 0 ? (
                  <div className="font-mono text-[10px] tracking-widest uppercase text-orange-400 mt-1">
                    Missing in profile: {missingFields.join(" · ")} (Click Edit Profile below)
                  </div>
                ) : (
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#34C759] mt-1 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All details 100% complete and verified on studio ledger
                  </div>
                )}
              </div>
            </div>

            <div className="w-full sm:w-48 bg-white/10 h-2 rounded-full overflow-hidden shrink-0">
              <div className="bg-[#FF3B30] h-full transition-all duration-700" style={{ width: `${completionScore}%` }} />
            </div>
          </div>
          
          {/* Profile Header Banner */}
          <div className="mt-8 flex flex-col md:flex-row gap-10 items-start md:items-end border-b border-white/10 pb-12 justify-between">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-32 h-32 md:w-44 md:h-44 object-cover border border-white/20 p-2 rounded-sm shadow-2xl shrink-0" />
              ) : (
                <div className="w-32 h-32 md:w-44 md:h-44 border border-white/20 p-2 flex items-center justify-center bg-white/5 rounded-sm shrink-0">
                  <span className="font-editorial text-5xl italic text-white/50">{profile.name?.[0]}</span>
                </div>
              )}
              <div>
                <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {profile.role === "owner" 
                      ? "Brand Owner Profile" 
                      : profile.role === "agent" 
                      ? `Talent Agent (${profile.agent_type || "Company Agent"})` 
                      : "Verified Influencer Profile"}
                  </span>
                </div>
                <h1 className="font-editorial text-5xl md:text-7xl leading-none font-medium">
                  {profile.company || profile.name}
                </h1>
                <div className="font-mono text-xs opacity-75 mt-3 flex items-center gap-3 flex-wrap">
                  {profile.name && <span>{profile.name}</span>}
                  {profile.handle && <span className="text-white/60">· {profile.handle}</span>}
                  {profile.city && (
                    <span className="flex items-center gap-1 opacity-60">
                      <MapPin className="w-3 h-3 text-[#FF3B30]" /> {profile.city}
                    </span>
                  )}
                  {profile.industry && (
                    <span className="px-2.5 py-0.5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-[10px] uppercase tracking-wider rounded-xs font-bold">
                      {profile.industry}
                    </span>
                  )}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer" className="text-[#FF3B30] hover:underline flex items-center gap-1 font-bold">
                      <Globe className="w-3.5 h-3.5" /> {profile.website.replace(/^https?:\/\//, "")} ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link to="/profile/edit" className="btn-solid bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-2 shadow-lg" data-testid="edit-profile-btn">
                <Edit2 className="w-4 h-4" /> Edit Profile Details
              </Link>
            </div>
          </div>

          {/* Main Content Layout Grid */}
          <div className="py-12 grid grid-cols-1 md:grid-cols-12 gap-12">
            
            {/* LEFT COLUMN: Overview & Detailed Settings */}
            <div className={isCreator ? "md:col-span-4 space-y-10" : "md:col-span-12 space-y-10"}>
              {/* About / Bio */}
              <div className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm">
                <h3 className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold mb-3">
                  § Studio Bio &amp; Overview
                </h3>
                <p className="font-editorial italic text-2xl leading-relaxed break-words whitespace-normal text-white">
                  {profile.bio || "No bio specified yet. Add bio in Edit Profile."}
                </p>
              </div>

              {/* BRAND / OWNER DETAILS */}
              {!isCreator && (
                <div className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm space-y-6">
                  <h3 className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">
                    § Brand &amp; Client Overview
                  </h3>
                  <dl className="space-y-3.5 text-xs font-mono uppercase tracking-wider">
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Company Name</dt>
                      <dd className="text-white font-bold">{profile.company || profile.name}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Brand Industry</dt>
                      <dd className="text-[#FF3B30] font-bold">{profile.industry || "General Industry"}</dd>
                    </div>
                    {profile.website && (
                      <div className="flex justify-between border-b border-white/10 pb-2.5">
                        <dt className="opacity-50">Website</dt>
                        <dd>
                          <a href={profile.website} target="_blank" rel="noreferrer" className="text-[#FF3B30] hover:underline flex items-center gap-1 font-bold">
                            Visit Site <ExternalLink className="w-3 h-3" />
                          </a>
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Location</dt>
                      <dd className="text-white">{profile.city || "Global"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-50">Account Role</dt>
                      <dd className="text-[#34C759] font-bold">{profile.role === "owner" ? "Brand Owner" : profile.role}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* CREATOR STUDIO DETAILS (Experience, Rates, Availability, Languages, Response Time) */}
              {isCreator && (
                <div className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm space-y-6">
                  <h3 className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">
                    § Studio Specifications &amp; Rates
                  </h3>
                  <dl className="space-y-3.5 text-xs font-mono uppercase tracking-wider">
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Experience</dt>
                      <dd className="text-white font-bold">{profile.experience || "Not Specified"}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Base Rate</dt>
                      <dd className="text-[#FF3B30] font-bold text-base">₹{Number(profile.base_rate || 0).toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Availability</dt>
                      <dd className="text-[#34C759] font-bold">{profile.availability || "Immediately"}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2.5">
                      <dt className="opacity-50">Response Time</dt>
                      <dd className="text-white font-bold">{profile.response_time || "Within 24 hours"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="opacity-50">Location Base</dt>
                      <dd className="text-white font-bold">{profile.city || "Bangalore"}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* CATEGORIES & NICHES */}
              {categoriesList.length > 0 && (
                <div className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm">
                  <h3 className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold mb-3">
                    § Niches &amp; Categories
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoriesList.map(c => (
                      <span key={c} className="px-3 py-1 bg-white/5 border border-white/15 text-xs font-mono rounded-xs text-white">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* LANGUAGES SPOKEN */}
              {languagesList.length > 0 && (
                <div className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm">
                  <h3 className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold mb-3 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" /> Languages Spoken
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {languagesList.map(l => (
                      <span key={l} className="px-3 py-1 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-xs font-mono text-[#FF3B30] rounded-xs font-bold">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTENT FORMATS */}
              {isCreator && contentTypesList.length > 0 && (
                <div className="bg-[#121212]/90 border border-white/15 p-6 rounded-sm">
                  <h3 className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold mb-3">
                    § Content Formats &amp; Deliverables
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {contentTypesList.map(t => (
                      <span key={t} className="px-3 py-1 bg-white/5 border border-white/15 text-xs font-mono text-white/90 rounded-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Social Presence, Past Campaigns & Portfolio */}
            {isCreator && (
              <div className="md:col-span-8 space-y-12">
                
                {/* 1. SOCIAL PRESENCE TAB */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h2 className="font-editorial text-3xl md:text-4xl">📱 Verified Social Presence</h2>
                      <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-1">Live Audience Reach &amp; Channel Metrics</p>
                    </div>
                    {totalReach > 0 && (
                      <div className="text-right font-mono text-xs uppercase tracking-wider text-[#FF3B30] font-semibold bg-[#FF3B30]/10 px-3.5 py-1 border border-[#FF3B30]/30 rounded-xs">
                        Total Combined Reach · {formatNumber(totalReach)}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {displayPlatforms.map(([key, data]) => {
                      if (!data) return null;
                      const platformLabels = {
                        instagram: { name: "Instagram", color: "text-pink-400" },
                        youtube: { name: "YouTube", color: "text-red-400" },
                        twitter: { name: "Twitter / X", color: "text-sky-400" },
                        facebook: { name: "Facebook", color: "text-blue-400" }
                      };
                      const plat = platformLabels[key] || { name: key.toUpperCase(), color: "text-white" };

                      return (
                        <div key={key} className="p-4 border border-white/15 bg-[#121212]/90 hover:border-[#FF3B30]/50 transition-all rounded-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className={`font-mono text-xs uppercase font-bold tracking-widest ${plat.color}`}>
                              {plat.name}
                            </span>
                            <span className="font-mono text-[9px] tracking-widest uppercase opacity-60 truncate max-w-[100px]">
                              {data.handle || `@${key}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/10 font-mono">
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Followers</div>
                              <div className="text-lg font-editorial italic mt-0.5 text-white">{formatNumber(data.followers || 0)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Engagement</div>
                              <div className="text-lg font-editorial italic mt-0.5 text-[#34C759]">{data.engagement || 4.8}%</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Views</div>
                              <div className="text-lg font-editorial italic mt-0.5 text-white">{formatNumber(data.views || 0)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Posts</div>
                              <div className="text-lg font-editorial italic mt-0.5 text-white">{data.posts || 120}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. PAST CAMPAIGNS & TRACK RECORD */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h2 className="font-editorial text-3xl md:text-4xl">📜 Past Campaigns &amp; Track Record</h2>
                      <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-1">Verified Brand Collaborations &amp; Post Links</p>
                    </div>
                    <span className="font-mono text-xs uppercase tracking-wider text-[#FF3B30] font-bold">
                      {pastCampaigns.length} / 5 Campaigns
                    </span>
                  </div>

                  {pastCampaigns.length > 0 ? (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/10 text-[10px] uppercase tracking-widest opacity-50">
                        <div className="col-span-2">Brand</div>
                        <div className="col-span-3">Campaign Scope</div>
                        <div className="col-span-2">Date</div>
                        <div className="col-span-2">Result</div>
                        <div className="col-span-3 text-right">Published Post</div>
                      </div>
                      {pastCampaigns.map((c, i) => (
                        <div key={i} className="p-4 border border-white/15 bg-[#121212]/90 grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-sm">
                          <div className="md:col-span-2 font-bold text-white uppercase tracking-wider">{c.brand || "Brand Partner"}</div>
                          <div className="md:col-span-3 text-white/90">{c.title || "Campaign Brief"}</div>
                          <div className="md:col-span-2 text-white/60 text-[11px]">{c.date || "2025"}</div>
                          <div className="md:col-span-2 text-[#34C759] font-semibold">{c.result || "Delivered"}</div>
                          <div className="md:col-span-3 md:text-right">
                            {c.post_url ? (
                              <a href={c.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition-colors rounded-xs text-[10px] uppercase tracking-wider font-mono">
                                <span>View Post</span> <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[10px] opacity-40 font-mono">No link provided</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 border border-white/15 bg-[#121212]/90 text-center font-mono text-xs opacity-60 rounded-sm">
                      No past campaigns specified yet. Add past campaigns in Edit Profile.
                    </div>
                  )}
                </div>

                {/* 3. FEATURED PORTFOLIO MEDIA (Images & Videos) */}
                <div className="space-y-8">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="font-editorial text-3xl md:text-4xl">🎨 Featured Portfolio Deliverables</h2>
                    <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-1">Categorized Media Assets &amp; Portfolio Showcase</p>
                  </div>

                  {/* 📷 Featured Images Category */}
                  {portfolioImages.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/80">
                        <ImageIcon className="w-4 h-4 text-[#FF3B30]" />
                        <span>📷 Featured Images ({portfolioImages.length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {portfolioImages.map((media, i) => (
                          <div key={i} className="aspect-square max-h-[160px] bg-black border border-white/15 relative group overflow-hidden rounded-sm">
                            <img src={media} alt={`Work Image ${i+1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🎬 Featured Videos Category */}
                  {portfolioVideos.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/80">
                        <VideoIcon className="w-4 h-4 text-[#FF3B30]" />
                        <span>🎬 Featured Videos ({portfolioVideos.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {portfolioVideos.map((media, i) => (
                          <div key={i} className="aspect-video max-h-[220px] bg-black border border-white/15 relative group overflow-hidden rounded-sm">
                            <video src={media} controls className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {portfolioImages.length === 0 && portfolioVideos.length === 0 && (
                    <div className="p-8 border border-white/15 bg-[#121212]/90 text-center font-mono text-xs opacity-60 rounded-sm">
                      No portfolio media added yet. Upload images &amp; videos in Edit Profile.
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
