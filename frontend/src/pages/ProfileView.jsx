import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Edit2, Image as ImageIcon, Video as VideoIcon,
  ExternalLink, ShieldCheck, MapPin, CheckCircle2
, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

import { toast } from "sonner";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  hasPlatformHandle,
  socialOrNA,
  socialMetricOrNA,
} from "@/lib/platforms";
import { formatUsername, displayAccountName } from "@/lib/username";
import { withBrandDisplayDefaults } from "@/lib/brandProfileDefaults";

export default function ProfileView() {
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/auth/me");
        setProfile(withBrandDisplayDefaults(data));
      } catch (e) {
        toast.error("Failed to load profile");
        nav("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [nav]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse font-sans tracking-widest text-xs uppercase text-[#FF3B30]">Loading profile...</div>
      </div>
    );
  }
  if (!profile) return null;

  const isInfluencer = profile.role === "influencer";

  const formatNumber = (num) => {
    if (!num || isNaN(num)) return "0";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return String(num);
  };

  const getCompletionDetails = () => {
    let score = 0;
    const missing = [];

    if (profile.name?.trim()) score += 10; else missing.push("Name");
    if (profile.avatar) score += 10; else missing.push("Photo");
    if (profile.bio?.trim()) score += 15; else missing.push("Bio");
    if (profile.city?.trim()) score += 10;

    if (isInfluencer) {
      if ((profile.handle || profile.username)?.trim()) score += 10; else missing.push("Username");
      const cats = Array.isArray(profile.category)
        ? profile.category
        : (profile.category ? String(profile.category).split(", ") : []);
      if (cats.length > 0) score += 10;
      if (Number(profile.base_rate) > 0) score += 10; else missing.push("Base rate");
      if (profile.languages?.length > 0) score += 5;
      if (profile.past_campaigns?.length > 0) score += 10;
      if (Object.values(profile.platform_metrics || {}).some((p) => p && p.handle)) score += 10;
      else missing.push("Social handle");
    } else {
      if (profile.company?.trim()) score += 25; else missing.push("Company");
      if (profile.industry?.trim()) score += 15; else missing.push("Industry");
      if (profile.website?.trim()) score += 15; else missing.push("Website");
    }

    return { score: Math.min(100, score), missing };
  };

  const { score: completionScore, missing: missingFields } = getCompletionDetails();

  const rawPlatforms = profile.platform_metrics && typeof profile.platform_metrics === "object"
    ? profile.platform_metrics
    : {};
  const displayPlatforms = SOCIAL_PLATFORMS.map((key) => [key, rawPlatforms[key] || {}]);
  const totalReach = displayPlatforms.reduce((acc, [, p]) => {
    if (!hasPlatformHandle(p)) return acc;
    return acc + (Number(p?.followers || p?.subscribers) || 0);
  }, 0);

  const categoriesList = Array.isArray(profile.category)
    ? profile.category
    : (profile.category ? String(profile.category).split(", ").filter(Boolean) : []);
  const languagesList = Array.isArray(profile.languages) ? profile.languages : [];
  const contentTypesList = Array.isArray(profile.content_types) ? profile.content_types : [];
  
  const portfolioItems = profile.portfolio || [];
  const portfolioVideos = portfolioItems.filter((item) => item && /\.(mp4|webm|ogg)$/i.test(item));
  const portfolioImages = portfolioItems.filter((item) => item && !/\.(mp4|webm|ogg)$/i.test(item));
  const pastCampaigns = (profile.past_campaigns || []).slice(0, 5);
  const displayName = displayAccountName(profile, "Profile");

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full flex-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 mb-8">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> ⚡ Profile Details
              </p>
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-2">Profile</h1>
            </div>
        <Link
          to="/profile/edit"
          className="btn-solid bg-[#FF3B30] text-white hover:bg-[#e03126] inline-flex items-center gap-2 rounded-full px-5 shadow-lg shadow-[#FF3B30]/20"
        >
          <Edit2 className="w-4 h-4" /> Edit Profile
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Main Information */}
        <div className="md:col-span-8 space-y-6">
          
          {/* Profile Summary Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row gap-6 items-center sm:items-start relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <ShieldCheck className="w-48 h-48" />
            </div>
            
            <div className="relative shrink-0">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="w-28 h-28 object-cover rounded-full border-4 border-white/10 shadow-xl"
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-full border-4 border-white/10 flex items-center justify-center shrink-0 shadow-xl"
                  style={{ backgroundColor: `hsl(${((displayName || "CR8").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
                >
                  <span className="font-sans text-4xl font-bold text-white">
                    {(displayName || "?")[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              {profile.verified && (
                <div className="absolute bottom-1 right-1 bg-[#34C759] border-[3px] border-[#0B0B0E] p-1 rounded-full shadow-lg">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <h2 className="font-sans text-2xl font-bold text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                  {displayName}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#34C759]/10 border border-[#34C759]/30 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.8)] animate-pulse"></div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#34C759] font-bold">Active</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 mt-4">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Role</p>
                  <p className="font-sans text-sm text-white font-medium capitalize">{profile.role === "owner" ? "Brand" : profile.role === "agent" ? "Agency" : "Influencer"}</p>
                </div>
                {isInfluencer && (
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Level</p>
                    <p className="font-sans text-sm text-[#FF3B30] font-medium">{profile.creator_level || "Beginner"}</p>
                  </div>
                )}
                {(profile.role === "owner" || profile.role === "agent") && profile.company && (
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Company</p>
                    <p className="font-sans text-sm text-white font-medium">{profile.company}</p>
                  </div>
                )}
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-widest text-white/40 mb-0.5">E-mail</p>
                  <p className="font-sans text-sm text-white font-medium break-all">{profile.email}</p>
                </div>
                {profile.website && (
                  <div>
                    <p className="font-sans text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Website</p>
                    <a href={profile.website} target="_blank" rel="noreferrer" className="font-sans text-sm text-[#FF3B30] font-medium hover:underline inline-flex items-center gap-1 break-all">
                      {profile.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Basic Information Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <h3 className="font-sans text-[12px] tracking-[0.16em] uppercase text-white/80 font-semibold mb-6 flex items-center gap-2">
              Basic Information <span className="text-white/30 text-[10px] font-normal">[Non-Editable Here]</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-white/5 pb-6">
              <div>
                <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">Username</p>
                <div className="bg-black/30 border border-white/5 rounded-3xl px-4 py-2 font-mono text-sm text-white inline-block">
                  {profile.username ? `@${profile.username}` : "N/A"}
                </div>
              </div>
              <div>
                <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">Joined Date</p>
                <div className="bg-black/30 border border-white/5 rounded-3xl px-4 py-2 font-sans text-sm text-white inline-block">
                  {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "2024"}
                </div>
              </div>
              <div>
                <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">Base Rate</p>
                <div className="bg-black/30 border border-white/5 rounded-3xl px-4 py-2 font-sans text-sm text-white inline-block">
                  {profile.base_rate ? `$${profile.base_rate}` : "N/A"}
                </div>
              </div>
              <div>
                <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">User ID</p>
                <div className="bg-black/30 border border-white/5 rounded-3xl px-4 py-2 font-mono text-xs text-white/60 inline-block truncate max-w-full">
                  {profile.id || profile._id?.substring(0, 8) || "N/A"}
                </div>
              </div>
            </div>

            <div className="pt-6">
              <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">Bio</p>
              <p className="font-sans text-sm leading-relaxed text-white/90">
                {profile.bio || "No bio provided."}
              </p>
            </div>
          </div>

          {/* Personal Information Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <h3 className="font-sans text-[12px] tracking-[0.16em] uppercase text-white/80 font-semibold mb-6 flex items-center gap-2">
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">Location</p>
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <MapPin className="w-4 h-4 text-white/40" />
                  <span className="font-sans text-sm text-white">
                    {profile.city || profile.state ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}` : "Not specified"}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="font-sans text-[11px] text-[#FF3B30] mb-2 font-medium">Languages</p>
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <span className="font-sans text-sm text-white">
                    {languagesList.length > 0 ? languagesList.join(", ") : "Not specified"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Occupation / Professional Information Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <h3 className="font-sans text-[12px] tracking-[0.16em] uppercase text-white/80 font-semibold mb-6 flex items-center gap-2">
              Professional Attributes
            </h3>
            
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col items-center justify-center bg-black/20 border border-[#34C759]/20 rounded-2xl p-4 min-w-[120px]">
                <div className="w-10 h-10 rounded-full bg-[#34C759]/10 flex items-center justify-center mb-3">
                  <span className="text-xl text-[#34C759]">✨</span>
                </div>
                <span className="font-sans text-sm font-medium text-white text-center">
                  {categoriesList.length > 0 ? categoriesList[0] : "General"}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-1">Primary Niche</span>
              </div>
              
              {categoriesList.slice(1, 3).map((cat, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center bg-black/20 border border-[#0A84FF]/20 rounded-2xl p-4 min-w-[120px]">
                  <div className="w-10 h-10 rounded-full bg-[#0A84FF]/10 flex items-center justify-center mb-3">
                    <span className="text-xl text-[#0A84FF]">🎯</span>
                  </div>
                  <span className="font-sans text-sm font-medium text-white text-center">{cat}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-1">Niche</span>
                </div>
              ))}
              
              {contentTypesList.length > 0 && (
                <div className="flex flex-col items-center justify-center bg-black/20 border border-[#BF5AF2]/20 rounded-2xl p-4 min-w-[120px]">
                  <div className="w-10 h-10 rounded-full bg-[#BF5AF2]/10 flex items-center justify-center mb-3">
                    <span className="text-xl text-[#BF5AF2]">📸</span>
                  </div>
                  <span className="font-sans text-sm font-medium text-white text-center">{contentTypesList[0]}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-1">Content</span>
                </div>
              )}
            </div>
          </div>

          {/* Portfolio Grid if applicable */}
          {isInfluencer && (portfolioImages.length > 0 || portfolioVideos.length > 0) && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <h3 className="font-sans text-[12px] tracking-[0.16em] uppercase text-white/80 font-semibold mb-6">
                Portfolio Media
              </h3>
              
              {portfolioImages.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-wider opacity-60 mb-3">
                    <ImageIcon className="w-3.5 h-3.5 text-[#FF3B30]" /> Images ({portfolioImages.length})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {portfolioImages.map((media, i) => (
                      <div key={i} className="aspect-square rounded-xl border border-white/10 overflow-hidden bg-black/50 hover:border-white/30 transition-colors">
                        <img src={media} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {portfolioVideos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-wider opacity-60 mb-3">
                    <VideoIcon className="w-3.5 h-3.5 text-[#FF3B30]" /> Videos ({portfolioVideos.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {portfolioVideos.map((media, i) => (
                      <div key={i} className="aspect-video rounded-xl border border-white/10 overflow-hidden bg-black/50 hover:border-white/30 transition-colors">
                        <video src={media} controls className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Supporting Widgets */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Onboarding / Profile Status Widget */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <h3 className="font-sans text-[12px] tracking-[0.16em] uppercase text-white/80 font-semibold mb-4">
              Profile Status
            </h3>
            
            <div className="mb-5">
              <div className="flex justify-between font-sans text-xs mb-2">
                <span className="text-white/60">Completion</span>
                <span className="text-[#FF3B30] font-bold">{completionScore}%</span>
              </div>
              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                <div className="bg-[#FF3B30] h-full rounded-full" style={{ width: `${completionScore}%` }} />
              </div>
            </div>

            <div className="space-y-3">
              {completionScore === 100 ? (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#34C759]/10 border border-[#34C759]/20">
                  <CheckCircle2 className="w-5 h-5 text-[#34C759] shrink-0" />
                  <div>
                    <p className="font-sans text-xs text-white font-medium">All set!</p>
                    <p className="font-sans text-[10px] text-white/60 mt-0.5">Your profile is fully complete and visible to brands.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-sans text-[10px] uppercase tracking-widest text-white/50 mb-1">Missing Info Tasks</p>
                  {missingFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0" />
                      <span className="font-sans text-xs text-white/80">Add {field}</span>
                    </div>
                  ))}
                  <Link to="/profile/edit" className="block text-center mt-4 font-sans text-xs text-[#FF3B30] hover:underline">
                    Complete Profile Now →
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Social Accounts Metrics Widget */}
          {isInfluencer && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-sans text-[12px] tracking-[0.16em] uppercase text-white/80 font-semibold">
                  Social Metrics
                </h3>
                <span className="px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] text-[10px] font-bold rounded-full">
                  {formatNumber(totalReach)} Total
                </span>
              </div>

              <div className="space-y-3">
                {SOCIAL_PLATFORMS.map((key) => {
                  const data = rawPlatforms[key] || {};
                  const connected = hasPlatformHandle(data);
                  
                  return (
                    <div key={key} className={`p-4 rounded-2xl border ${connected ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-70"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-sans text-xs uppercase tracking-wider text-[#FF3B30] font-semibold">
                          {SOCIAL_PLATFORM_LABELS[key] || key}
                        </span>
                        <span className={`font-mono text-[9px] truncate max-w-[50%] ${connected ? "text-white/60" : "text-white/30"}`}>
                          {socialOrNA(data?.handle)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between font-sans">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider opacity-40">{key === "youtube" ? "Subs" : "Followers"}</div>
                          <div className="text-sm font-bold tabular-nums mt-0.5 text-white">
                            {connected ? socialMetricOrNA(data.followers ?? data.subscribers, formatNumber) : "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-wider opacity-40">ER %</div>
                          <div className={`text-sm font-bold tabular-nums mt-0.5 ${connected ? "text-[#34C759]" : "text-white"}`}>
                            {connected ? socialMetricOrNA(data.engagement, (n) => `${Number(n).toFixed(1)}%`) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
