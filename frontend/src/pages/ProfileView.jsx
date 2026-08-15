import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Image as ImageIcon, Video as VideoIcon,
  ShieldCheck, MapPin, CheckCircle2, Sparkles
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  hasPlatformHandle,
  socialOrNA,
  socialMetricOrNA,
} from "@/lib/platforms";
import { displayAccountName } from "@/lib/username";
import { withBrandDisplayDefaults } from "@/lib/brandProfileDefaults";
import { IconTip } from "@/components/IconTip";
import { AiIcon } from "@/components/AiIcon";

export default function ProfileView() {
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/auth/me");
        setProfile(withBrandDisplayDefaults(data));
      } catch {
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
  const totalReach = SOCIAL_PLATFORMS.reduce((acc, key) => {
    const p = rawPlatforms[key] || {};
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
  const roleLabel = profile.role === "owner" ? "Brand" : profile.role === "agent" ? "Agency" : "Influencer";
  const locationLabel = profile.city || profile.state
    ? `${profile.city || ""}${profile.city && profile.state ? ", " : ""}${profile.state || ""}`
    : "—";

  return (
    <div className="flex flex-col w-full pb-6 pt-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-white/10 pb-3 mb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
            <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Account
          </p>
          <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-1">Profile</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconTip label="View as public profile" side="bottom">
            <Link
              to={`/u/${profile.id}`}
              aria-label="View as public profile"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/25 bg-white/10 hover:border-[#FF3B30] hover:bg-[#FF3B30]/15 transition-colors"
            >
              <AiIcon name="view-public" className="w-5 h-5" />
            </Link>
          </IconTip>
          <IconTip label="Edit" side="bottom">
            <Link
              to="/profile/edit"
              aria-label="Edit profile"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/25 bg-white/10 hover:border-[#FF3B30] hover:bg-[#FF3B30]/15 transition-colors"
            >
              <AiIcon name="edit" className="w-5 h-5" />
            </Link>
          </IconTip>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 mb-4 flex flex-col md:flex-row gap-4 items-start">
        <div className="relative shrink-0">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="w-20 h-20 object-cover rounded-full border-2 border-white/10" />
          ) : (
            <div
              className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center"
              style={{ backgroundColor: `hsl(${((displayName || "CR8").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
            >
              <span className="font-sans text-2xl font-bold text-white">{(displayName || "?")[0]?.toUpperCase()}</span>
            </div>
          )}
          {profile.verified && (
            <div className="absolute bottom-0 right-0 bg-[#34C759] border-2 border-[#0B0B0E] p-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="font-sans text-xl font-bold text-white tracking-tight truncate">{displayName}</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#34C759]/10 border border-[#34C759]/30 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#34C759] font-bold">Active</span>
            </span>
            {isInfluencer && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-2 py-0.5 rounded-full">
                {profile.creator_level || "Beginner"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            <Meta label="Role" value={roleLabel} />
            <Meta label="Username" value={profile.username ? `@${profile.username}` : "—"} />
            <Meta label="Email" value={profile.email || "—"} />
            <Meta label="Location" value={locationLabel} />
            {(profile.role === "owner" || profile.role === "agent") && profile.company && (
              <Meta label="Company" value={profile.company} />
            )}
            {profile.website && (
              <div>
                <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 mb-0.5">Website</p>
                <a href={profile.website} target="_blank" rel="noreferrer" className="font-sans text-sm text-[#FF3B30] hover:underline inline-flex items-center gap-1 truncate max-w-full">
                  Visit <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {isInfluencer && <Meta label="Base rate" value={profile.base_rate ? `$${profile.base_rate}` : "—"} />}
            <Meta label="Joined" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"} />
          </div>
        </div>

        <div className="w-full md:w-44 shrink-0 bg-black/25 border border-white/10 rounded-xl p-3">
          <div className="flex justify-between font-sans text-[10px] mb-1.5">
            <span className="text-white/50 uppercase tracking-widest">Complete</span>
            <span className="text-[#FF3B30] font-bold">{completionScore}%</span>
          </div>
          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-2">
            <div className="bg-[#FF3B30] h-full rounded-full" style={{ width: `${completionScore}%` }} />
          </div>
          {completionScore === 100 ? (
            <div className="flex items-center gap-1.5 text-[#34C759]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-sans text-[10px]">All set</span>
            </div>
          ) : (
            <Link to="/profile/edit" className="font-sans text-[10px] text-[#FF3B30] hover:underline">
              Finish {missingFields[0] || "profile"} →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-2">About</h3>
            <p className="font-sans text-sm leading-relaxed text-white/85 mb-3">
              {profile.bio || "No bio provided."}
            </p>
            <div className="flex flex-wrap gap-2">
              {languagesList.map((lang) => (
                <span key={lang} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-[9px] uppercase tracking-widest text-white/60">
                  {lang}
                </span>
              ))}
              {categoriesList.map((cat) => (
                <span key={cat} className="px-2 py-0.5 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/20 font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">
                  {cat}
                </span>
              ))}
              {contentTypesList.map((ct) => (
                <span key={ct} className="px-2 py-0.5 rounded-full bg-[#0A84FF]/10 border border-[#0A84FF]/20 font-mono text-[9px] uppercase tracking-widest text-[#0A84FF]">
                  {ct}
                </span>
              ))}
            </div>
          </section>

          {isInfluencer && pastCampaigns.length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-2">Past campaigns</h3>
              <div className="space-y-1.5">
                {pastCampaigns.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <span className="font-sans text-sm text-white truncate">
                      {typeof c === "string" ? c : (c?.title || c?.name || "Campaign")}
                    </span>
                    {(c?.brand || c?.year) && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 shrink-0">
                        {[c.brand, c.year].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {isInfluencer && (portfolioImages.length > 0 || portfolioVideos.length > 0) && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-3">Portfolio</h3>
              {portfolioImages.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-wider opacity-50 mb-2">
                    <ImageIcon className="w-3 h-3 text-[#FF3B30]" /> Images
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {portfolioImages.map((media, i) => (
                      <div key={i} className="aspect-square rounded-lg border border-white/10 overflow-hidden bg-black/50">
                        <img src={media} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {portfolioVideos.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-wider opacity-50 mb-2">
                    <VideoIcon className="w-3 h-3 text-[#FF3B30]" /> Videos
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {portfolioVideos.map((media, i) => (
                      <div key={i} className="aspect-video rounded-lg border border-white/10 overflow-hidden bg-black/50">
                        <video src={media} controls className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          {isInfluencer && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/50">Social metrics</h3>
                <span className="px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] text-[9px] font-bold rounded-full">
                  {formatNumber(totalReach)} reach
                </span>
              </div>
              <div className="space-y-2">
                {SOCIAL_PLATFORMS.map((key) => {
                  const data = rawPlatforms[key] || {};
                  const connected = hasPlatformHandle(data);
                  return (
                    <div key={key} className={`px-3 py-2.5 rounded-xl border ${connected ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-60"}`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-sans text-[11px] uppercase tracking-wider text-[#FF3B30] font-semibold">
                          {SOCIAL_PLATFORM_LABELS[key] || key}
                        </span>
                        <span className="font-mono text-[9px] truncate text-white/50 max-w-[45%]">
                          {socialOrNA(data?.handle)}
                        </span>
                      </div>
                      <div className="flex justify-between font-sans text-sm">
                        <span className="tabular-nums font-semibold">
                          {connected ? socialMetricOrNA(data.followers ?? data.subscribers, formatNumber) : "—"}
                          <span className="text-[9px] uppercase tracking-wider opacity-40 ml-1 font-normal">
                            {key === "youtube" ? "subs" : "followers"}
                          </span>
                        </span>
                        <span className={`tabular-nums font-semibold ${connected ? "text-[#34C759]" : ""}`}>
                          {connected ? socialMetricOrNA(data.engagement, (n) => `${Number(n).toFixed(1)}%`) : "—"}
                          <span className="text-[9px] uppercase tracking-wider opacity-40 ml-1 font-normal">ER</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 mb-0.5">{label}</p>
      <p className="font-sans text-sm text-white font-medium truncate" title={value}>{value}</p>
    </div>
  );
}
