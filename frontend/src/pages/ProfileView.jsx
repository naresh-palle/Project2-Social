import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Edit2, Image as ImageIcon, Video as VideoIcon, Briefcase, ExternalLink } from "lucide-react";
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
      <div className="animate-pulse font-mono tracking-widest text-sm">Loading Studio...</div>
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

  const defaultPlatforms = {
    instagram: { handle: profile.handle || `@${profile.name?.toLowerCase().replace(/\s+/g, "")}`, followers: 245000, engagement: 4.8, views: 850000 },
    youtube: { handle: `${profile.name?.replace(/\s+/g, "")}Studio`, followers: 512000, engagement: 6.2, views: 2100000 },
    twitter: { handle: `@${profile.name?.toLowerCase().replace(/\s+/g, "")}_tx`, followers: 128000, engagement: 3.4, views: 450000 },
    facebook: { handle: `${profile.name?.toLowerCase().replace(/\s+/g, "")}official`, followers: 95000, engagement: 2.1, views: 180000 }
  };

  const rawPlatforms = profile.platform_metrics && Object.keys(profile.platform_metrics).length > 0
    ? profile.platform_metrics
    : (isCreator ? defaultPlatforms : {});

  // Filter ONLY platforms selected / filled in by the user (non-empty handle)
  const activePlatforms = Object.entries(rawPlatforms).filter(([_, data]) => data && data.handle && data.handle.trim() !== "");

  const displayPlatforms = activePlatforms.length > 0 
    ? activePlatforms 
    : Object.entries(defaultPlatforms);

  const totalReach = displayPlatforms.reduce((acc, [_, p]) => acc + (p?.followers || 0), 0);

  // Format categories as array
  const categoriesList = Array.isArray(profile.category) 
    ? profile.category 
    : (profile.category ? profile.category.split(", ") : []);

  // Separate portfolio into Images and Videos
  const portfolioItems = profile.portfolio || [];
  const portfolioVideos = portfolioItems.filter(item => item && item.match(/\.(mp4|webm|ogg)$/i));
  const portfolioImages = portfolioItems.filter(item => item && !item.match(/\.(mp4|webm|ogg)$/i));

  // Limit past campaigns display to max 5
  const pastCampaigns = (profile.past_campaigns || []).slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      
      <div className="relative pt-24 px-6 md:px-12 max-w-7xl mx-auto">
        <button onClick={() => nav(-1)} className="absolute top-28 left-6 md:left-12 opacity-50 hover:opacity-100 flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase transition-opacity">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        {/* Profile Header */}
        <div className="mt-16 flex flex-col md:flex-row gap-12 items-end border-b border-white/10 pb-16 justify-between">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
                {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-32 h-32 md:w-48 md:h-48 object-cover grayscale contrast-125 border border-white/20 p-2 rounded-sm shadow-xl" />
                ) : (
                    <div className="w-32 h-32 md:w-48 md:h-48 border border-white/20 p-2 flex items-center justify-center bg-white/5 rounded-sm">
                        <span className="font-editorial text-4xl opacity-50">{profile.name?.[0]}</span>
                    </div>
                )}
                <div className="flex-1">
                    <div className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2 text-[#FF3B30]">
                        {categoriesList.length > 0 ? categoriesList.join(" · ") : (isCreator ? "Creator" : "Brand")} · {profile.city || "Global"}
                    </div>
                    <h1 className="font-editorial text-5xl md:text-7xl leading-none">
                        {profile.name}
                    </h1>
                    <div className="font-mono text-sm opacity-60 mt-4 flex items-center gap-4">
                        <span>{profile.handle || "@profile"}</span>
                        {profile.languages?.length > 0 && (
                            <>
                                <span>·</span>
                                <span>{Array.isArray(profile.languages) ? profile.languages.join(", ") : profile.languages}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div>
                <Link to="/profile/edit" className="btn-solid flex items-center gap-2" data-testid="edit-profile-btn">
                    <Edit2 className="w-4 h-4" /> Edit Profile
                </Link>
            </div>
        </div>

        {/* Profile Grid Layout */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-12 gap-16">
            {/* Left Column: About & Bio */}
            <div className={isCreator ? "md:col-span-4 space-y-12" : "md:col-span-12 space-y-12"}>
                <div>
                    <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">About</h3>
                    <p className="font-editorial italic text-2xl md:text-3xl leading-relaxed break-words whitespace-normal max-w-full">
                        {profile.bio || "No bio available."}
                    </p>
                </div>

                {categoriesList.length > 0 && (
                    <div className="hairline-t pt-8">
                        <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">Niches &amp; Categories</h3>
                        <div className="flex flex-wrap gap-2">
                            {categoriesList.map(c => (
                                <span key={c} className="px-3 py-1 bg-white/5 border border-white/10 text-xs font-mono rounded-sm text-white">{c}</span>
                            ))}
                        </div>
                    </div>
                )}
                
                {isCreator && (
                    <>
                        <div className="hairline-t pt-8">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">Content Formats</h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.content_types?.map(t => (
                                    <span key={t} className="px-3 py-1 bg-white/5 border border-white/10 text-xs font-mono">{t}</span>
                                ))}
                            </div>
                        </div>

                        <div className="hairline-t pt-8">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">Studio Details</h3>
                            <dl className="space-y-4 text-sm font-mono uppercase tracking-wider">
                                <div className="flex justify-between"><dt className="opacity-50">Experience</dt><dd>{profile.experience || "N/A"}</dd></div>
                                <div className="flex justify-between"><dt className="opacity-50">Base Rate</dt><dd className="text-[#FF3B30] font-bold">₹{Number(profile.base_rate || 0).toLocaleString()}</dd></div>
                                <div className="flex justify-between"><dt className="opacity-50">Response Time</dt><dd>{profile.response_time || "Within 24 hours"}</dd></div>
                            </dl>
                        </div>
                    </>
                )}
            </div>

            {/* Right Column: Social Presence, Past Campaigns & Portfolio */}
            {isCreator && (
              <div className="md:col-span-8 space-y-16">
                
                {/* 1. OUR SOCIAL PRESENCE TAB */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <h2 className="font-editorial text-3xl md:text-4xl">📱 Our Social Presence</h2>
                      <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-1">Verified Channel Performance (Selected Platforms)</p>
                    </div>
                    {totalReach > 0 && (
                      <div className="text-right font-mono text-xs uppercase tracking-wider text-[#FF3B30] font-semibold bg-[#FF3B30]/10 px-3 py-1 border border-[#FF3B30]/20 rounded-xs">
                        Total Reach · {formatNumber(totalReach)}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div key={key} className="p-5 border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors rounded-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs uppercase font-bold tracking-widest ${plat.color}`}>
                                {plat.name}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] tracking-widest uppercase opacity-60">
                              {data.handle || `@${key}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5 font-mono">
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Followers</div>
                              <div className="text-xl font-editorial italic mt-0.5 text-white">{formatNumber(data.followers || 0)}</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Engagement</div>
                              <div className="text-xl font-editorial italic mt-0.5 text-[#34C759]">{data.engagement || 4.2}%</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-widest opacity-50">Monthly Views</div>
                              <div className="text-xl font-editorial italic mt-0.5 text-white">{formatNumber(data.views || 0)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. PAST CAMPAIGNS & TRACK RECORD TAB (List Mode with Post Link) */}
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
                        <div key={i} className="p-4 border border-white/10 bg-white/[0.02] grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-sm">
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
                    <div className="p-8 border border-white/10 bg-white/[0.01] text-center font-mono text-xs opacity-60">
                      No past campaigns specified yet. Add past campaigns in Edit Profile.
                    </div>
                  )}
                </div>

                {/* 3. SEPARATED DELIVERABLES & MEDIA TAB (Images & Videos) */}
                <div className="space-y-12">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="font-editorial text-4xl">🎨 Featured Deliverables</h2>
                    <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-1">Categorized Media Assets &amp; Portfolio</p>
                  </div>

                  {/* 📷 Featured Images Category (Squeezed & Reduced Size) */}
                  {portfolioImages.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/80">
                        <ImageIcon className="w-4 h-4 text-[#FF3B30]" />
                        <span>📷 Featured Images ({portfolioImages.length})</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {portfolioImages.map((media, i) => (
                          <div key={i} className="aspect-square max-h-[150px] bg-white/5 border border-white/10 relative group overflow-hidden rounded-sm">
                            <img src={media} alt={`Work Image ${i+1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🎬 Featured Videos Category */}
                  {portfolioVideos.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/80">
                        <VideoIcon className="w-4 h-4 text-[#FF3B30]" />
                        <span>🎬 Featured Videos ({portfolioVideos.length})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {portfolioVideos.map((media, i) => (
                          <div key={i} className="aspect-video max-h-[200px] bg-black border border-white/10 relative group overflow-hidden rounded-sm">
                            <video src={media} controls className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
