import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Edit2, Image as ImageIcon, Video as VideoIcon,
  ExternalLink, ShieldCheck, MapPin,
} from "lucide-react";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
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
      <div className="min-h-screen bg-[#0B0B0E] flex items-center justify-center text-[#F4F4F0]">
        <div className="animate-pulse font-sans tracking-widest text-xs uppercase text-[#FF3B30]">Loading profile…</div>
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
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      <Nav />
      <ThemeToaster />

      <div className="pt-24 px-4 md:px-8 max-w-6xl mx-auto pb-12">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="opacity-60 hover:opacity-100 inline-flex items-center gap-2 font-sans text-[11px] tracking-widest uppercase"
        >
          <ArrowLeft className="w-4 h-4 text-[#FF3B30]" /> Back
        </button>

        <div className="mt-4 border border-white/10 bg-white/[0.02] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full border border-[#FF3B30]/40 flex items-center justify-center bg-[#FF3B30]/10 font-sans text-sm font-bold text-[#FF3B30] shrink-0">
              {completionScore}%
            </div>
            <div className="min-w-0">
              <div className="font-sans text-[11px] tracking-[0.14em] uppercase text-[#FF3B30] font-semibold">
                Profile strength
                <span className="ml-2 text-[9px] px-1.5 py-0.5 border border-[#FF3B30]/30 bg-[#FF3B30]/10">
                  {completionScore === 100 ? "Complete" : "In progress"}
                </span>
              </div>
              {missingFields.length > 0 ? (
                <p className="font-sans text-[11px] text-orange-400/90 mt-0.5 truncate">
                  Missing: {missingFields.slice(0, 4).join(", ")}{missingFields.length > 4 ? "…" : ""}
                </p>
              ) : (
                <p className="font-sans text-[11px] text-[#34C759] mt-0.5">All required details complete</p>
              )}
            </div>
          </div>
          <div className="w-full sm:w-40 bg-white/10 h-1.5 rounded-full overflow-hidden shrink-0">
            <div className="bg-[#FF3B30] h-full transition-all duration-700" style={{ width: `${completionScore}%` }} />
          </div>
        </div>

        <div className="mt-4 relative">
          {profile.cover_photo && (
            <div className="w-full h-28 md:h-36 overflow-hidden border border-white/10">
              <img src={profile.cover_photo} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div
            className={`flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between border-b border-white/10 pb-5 ${
              profile.cover_photo ? "-mt-10 md:-mt-12 relative z-[1] px-1" : "mt-4"
            }`}
          >
            <div className="flex gap-3 items-end min-w-0">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="w-20 h-20 md:w-24 md:h-24 object-cover border-2 border-[#0B0B0E] shadow-xl shrink-0 bg-[#0B0B0E]"
                />
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 border-2 border-[#0B0B0E] bg-white/5 flex items-center justify-center shrink-0 shadow-xl">
                  <span className="font-sans text-2xl font-bold text-white/50">
                    {(displayName || "?")[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 pb-0.5">
                <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold inline-flex items-center gap-1.5 flex-wrap">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  {profile.role === "owner" ? "Brand" : profile.role === "agent" ? "Agency" : "Influencer"}
                  {profile.verified && <span className="text-[#34C759] normal-case tracking-normal">· Verified</span>}
                </p>
                <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight leading-tight mt-1 break-all">
                  {displayName}
                </h1>
                {(profile.role === "owner" || profile.role === "agent") && profile.company && profile.company !== displayName && (
                  <p className="font-sans text-sm text-white/70 mt-1">{profile.company}</p>
                )}
                <div className="font-sans text-xs opacity-70 mt-1.5 flex items-center gap-2 flex-wrap">
                  {profile.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#FF3B30]" />
                      {profile.city}{profile.state ? `, ${profile.state}` : ""}
                    </span>
                  )}
                  {profile.industry && (
                    <span className="px-2 py-0.5 bg-[#FF3B30]/10 border border-[#FF3B30]/25 text-[#FF3B30] text-[10px] uppercase tracking-wider">
                      {profile.industry}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Link
              to="/profile/edit"
              className="btn-solid bg-[#FF3B30] text-white hover:bg-[#e03126] inline-flex items-center gap-2 shrink-0 self-start sm:self-end"
              data-testid="edit-profile-btn"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </Link>
          </div>
        </div>

        <div className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 space-y-3">
            <div className="border border-white/10 bg-white/[0.02] p-3">
              <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold mb-2">Bio</h3>
              <p className="font-sans text-sm leading-relaxed text-white/90 break-words">
                {profile.bio || "No bio yet."}
              </p>
            </div>

            {!isInfluencer && (
              <div className="border border-white/10 bg-white/[0.02] p-3 space-y-3">
                <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">Brand details</h3>
                <dl className="space-y-2.5 text-xs font-sans">
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Company</dt>
                    <dd className="font-semibold text-right">{profile.company || profile.name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Industry</dt>
                    <dd className="text-[#FF3B30] font-semibold text-right">{profile.industry || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Size · Employees</dt>
                    <dd className="font-semibold text-right">{profile.company_size || profile.employees || "—"}</dd>
                  </div>
                  {(profile.website || profile.linkedin) && (
                    <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                      <dt className="opacity-50 uppercase tracking-wider">Links</dt>
                      <dd className="text-right space-y-1">
                        {profile.website && (
                          <a href={profile.website} target="_blank" rel="noreferrer" className="text-[#FF3B30] hover:underline inline-flex items-center gap-1">
                            Website <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {profile.linkedin && (
                          <a href={profile.linkedin} target="_blank" rel="noreferrer" className="text-[#FF3B30] hover:underline inline-flex items-center gap-1 ml-2">
                            LinkedIn <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="opacity-50 uppercase tracking-wider">Location</dt>
                    <dd className="font-semibold text-right">{[profile.city, profile.state].filter(Boolean).join(", ") || profile.location || "—"}</dd>
                  </div>
                </dl>
              </div>
            )}

            {isInfluencer && (
              <div className="border border-white/10 bg-white/[0.02] p-3 space-y-3">
                <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">Specs &amp; rates</h3>
                <dl className="space-y-2.5 text-xs font-sans">
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Experience</dt>
                    <dd className="font-semibold">{profile.experience || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Base rate</dt>
                    <dd className="text-[#FF3B30] font-bold">₹{Number(profile.base_rate || 0).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Availability</dt>
                    <dd className="text-[#34C759] font-semibold">{profile.availability || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-white/10 pb-2">
                    <dt className="opacity-50 uppercase tracking-wider">Response</dt>
                    <dd className="font-semibold">{profile.response_time || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="opacity-50 uppercase tracking-wider">Location</dt>
                    <dd className="font-semibold">{[profile.city, profile.state].filter(Boolean).join(", ") || "—"}</dd>
                  </div>
                </dl>
              </div>
            )}

            {categoriesList.length > 0 && (
              <div className="border border-white/10 bg-white/[0.02] p-3">
                <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold mb-2">Niches</h3>
                <div className="flex flex-wrap gap-1.5 items-start">
                  {categoriesList.map((c) => (
                    <span
                      key={c}
                      className="inline-flex w-fit max-w-full whitespace-nowrap px-2.5 py-1 bg-white/5 border border-white/10 text-[11px] font-sans leading-tight"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {languagesList.length > 0 && (
              <div className="border border-white/10 bg-white/[0.02] p-3">
                <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold mb-2">Languages</h3>
                <div className="flex flex-wrap gap-1.5 items-start">
                  {languagesList.map((l) => (
                    <span
                      key={l}
                      className="inline-flex w-fit max-w-full whitespace-nowrap px-2.5 py-1 bg-[#FF3B30]/10 border border-[#FF3B30]/25 text-[11px] font-sans text-[#FF3B30] leading-tight"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isInfluencer && contentTypesList.length > 0 && (
              <div className="border border-white/10 bg-white/[0.02] p-3">
                <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold mb-2">Content types</h3>
                <div className="flex flex-wrap gap-1.5 items-start">
                  {contentTypesList.map((t) => (
                    <span
                      key={t}
                      className="inline-flex w-fit max-w-full whitespace-nowrap px-2.5 py-1 bg-white/5 border border-white/10 text-[11px] font-sans text-white/85 leading-tight"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-8 space-y-5">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3 gap-3">
                  <h2 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">Social accounts</h2>
                  <div className="flex items-center gap-3 shrink-0">
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noreferrer" className="font-sans text-[10px] uppercase tracking-wider text-[#FF3B30] hover:underline inline-flex items-center gap-1">
                        Website <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.linkedin && (
                      <a href={profile.linkedin} target="_blank" rel="noreferrer" className="font-sans text-[10px] uppercase tracking-wider text-[#FF3B30] hover:underline inline-flex items-center gap-1">
                        LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {totalReach > 0 && (
                      <span className="font-sans text-[10px] uppercase tracking-wider text-[#FF3B30]">
                        Reach · {formatNumber(totalReach)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {displayPlatforms.map(([key, data]) => {
                      const connected = hasPlatformHandle(data);
                      return (
                        <div key={key} className={`p-3 border ${connected ? "border-white/10 bg-white/[0.02]" : "border-white/10 bg-white/[0.02] opacity-90"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-sans text-[10px] uppercase tracking-wider text-[#FF3B30] font-semibold">
                              {SOCIAL_PLATFORM_LABELS[key] || key}
                            </span>
                            <span className={`font-sans text-[10px] truncate max-w-[45%] ${connected ? "opacity-60" : "opacity-45"}`}>
                              {socialOrNA(data?.handle)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-white/10 font-sans">
                            <div>
                              <div className="text-[9px] uppercase tracking-wider opacity-45">{key === "youtube" ? "Subs" : "Followers"}</div>
                              <div className="text-base font-bold tabular-nums mt-0.5">
                                {connected ? socialMetricOrNA(data.followers ?? data.subscribers, formatNumber) : "N/A"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-wider opacity-45">ER %</div>
                              <div className={`text-base font-bold tabular-nums mt-0.5 ${connected ? "text-[#34C759]" : ""}`}>
                                {connected ? socialMetricOrNA(data.engagement, (n) => `${Number(n).toFixed(1)}%`) : "N/A"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-wider opacity-45">Views</div>
                              <div className="text-base font-bold tabular-nums mt-0.5">
                                {connected ? socialMetricOrNA(data.views, formatNumber) : "N/A"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase tracking-wider opacity-45">Posts</div>
                              <div className="text-base font-bold tabular-nums mt-0.5">
                                {connected ? socialMetricOrNA(data.posts, formatNumber) : "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </div>

              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <h2 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">Past campaigns</h2>
                  <span className="font-sans text-[10px] uppercase tracking-wider opacity-50">{pastCampaigns.length}/5</span>
                </div>
                {pastCampaigns.length > 0 ? (
                  <div className="space-y-2 font-sans text-xs">
                    {pastCampaigns.map((c, i) => (
                      <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border border-white/10 bg-white/[0.02] items-center">
                        <div className="md:col-span-2 font-semibold truncate">{c.brand || "—"}</div>
                        <div className="md:col-span-3 opacity-80 truncate">{c.title || "—"}</div>
                        <div className="md:col-span-2 opacity-60">{c.date || "—"}</div>
                        <div className="md:col-span-2 text-[#34C759]">{c.result || "—"}</div>
                        <div className="md:col-span-3 md:text-right">
                          {c.post_url ? (
                            <a href={c.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#FF3B30] text-[10px] uppercase tracking-wider hover:underline">
                              View post <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="opacity-40 text-[10px]">No link</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-white/10 bg-white/[0.02] text-center font-sans text-xs opacity-50">
                    No past campaigns yet.
                  </div>
                )}
              </div>

              {isInfluencer && (
              <>
              <div>
                <div className="border-b border-white/10 pb-2 mb-3">
                  <h2 className="font-sans text-[10px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">Portfolio</h2>
                </div>
                {portfolioImages.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-wider opacity-60 mb-2">
                      <ImageIcon className="w-3.5 h-3.5 text-[#FF3B30]" /> Images ({portfolioImages.length})
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {portfolioImages.map((media, i) => (
                        <div key={i} className="aspect-square max-h-[140px] border border-white/10 overflow-hidden bg-[#0B0B0E]">
                          <img src={media} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {portfolioVideos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-wider opacity-60 mb-2">
                      <VideoIcon className="w-3.5 h-3.5 text-[#FF3B30]" /> Videos ({portfolioVideos.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {portfolioVideos.map((media, i) => (
                        <div key={i} className="aspect-video max-h-[200px] border border-white/10 overflow-hidden bg-[#0B0B0E]">
                          <video src={media} controls className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {portfolioImages.length === 0 && portfolioVideos.length === 0 && (
                  <div className="p-4 border border-white/10 bg-white/[0.02] text-center font-sans text-xs opacity-50">
                    No portfolio media yet.
                  </div>
                )}
              </div>
              </>
              )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
