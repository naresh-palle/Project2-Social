import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Image as ImageIcon, Video as VideoIcon,
  ShieldCheck, CheckCircle2, ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  hasPlatformHandle,
  socialMetricOrNA,
} from "@/lib/platforms";
import {
  creatorOverviewFromSources,
  displayMetric,
  formatEngagementRate,
  engagementRateHint,
  formatCompactNumber,
  formatExactNumber,
} from "@/lib/socialAnalytics";
import { displayAccountName } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";
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
  const socialOverview = creatorOverviewFromSources({ user: profile });
  const categoriesList = uniqueLabels([
    ...(Array.isArray(profile.category) ? profile.category : (profile.category ? String(profile.category).split(/[,|]/) : [])),
    ...(Array.isArray(profile.niches) ? profile.niches : (profile.niches ? String(profile.niches).split(/[,|]/) : [])),
  ]);
  const languagesList = uniqueLabels(profile.languages);
  const contentTypesList = uniqueLabels(profile.content_types);
  const portfolioItems = profile.portfolio || [];
  const portfolioVideos = portfolioItems.filter((item) => item && /\.(mp4|webm|ogg)$/i.test(item));
  const portfolioImages = portfolioItems.filter((item) => item && !/\.(mp4|webm|ogg)$/i.test(item));
  const pastCampaigns = (profile.past_campaigns || []).filter((c) => {
    if (!c) return false;
    if (typeof c === "string") return Boolean(c.trim());
    return Boolean(c.title || c.name || c.brand);
  }).slice(0, 5);
  const connectedPlatforms = SOCIAL_PLATFORMS.filter((key) => hasPlatformHandle(rawPlatforms[key] || {}));
  const avgEngagement = socialOverview.engagementRate;
  const displayName = displayAccountName(profile, "Profile");
  const roleLabel = profile.role === "owner" ? "Brand" : profile.role === "agent" ? "Agency" : "Influencer";
  const locationLabel = formatUserLocation(profile) || "—";

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
              style={{ backgroundColor: `hsl(${((displayName || "flugr").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
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

      <div className="flex flex-col gap-4 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-4">
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden">
              <h3 className="font-sans text-[10px] tracking-widest uppercase text-white/50 mb-2">About</h3>
              <p className="font-sans text-sm leading-relaxed text-white/85 break-words">
                {profile.bio || "No bio provided."}
              </p>
            </section>

            {isInfluencer && (
              <section className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden flex-1">
                <h3 className="font-sans text-[10px] tracking-widest uppercase text-white/50 mb-3">Highlights</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <StatTile
                    label="Followers"
                    value={displayMetric(socialOverview.followers, { format: formatCompactNumber })}
                    title={formatExactNumber(socialOverview.followers) || undefined}
                  />
                  <StatTile
                    label="Total views"
                    value={displayMetric(socialOverview.views, { format: formatCompactNumber, allowZero: false })}
                    title={formatExactNumber(socialOverview.views) || undefined}
                  />
                  <StatTile
                    label="Total reach"
                    value={displayMetric(socialOverview.reach, { format: formatCompactNumber, allowZero: false })}
                    title={formatExactNumber(socialOverview.reach) || undefined}
                  />
                  <StatTile
                    label="Engagement rate"
                    value={formatEngagementRate(avgEngagement)}
                    accent={avgEngagement != null}
                    hint={engagementRateHint(socialOverview.engagementRateBasis)}
                  />
                  <StatTile label="Platforms" value={`${connectedPlatforms.length}/${SOCIAL_PLATFORMS.length}`} />
                  <StatTile label="Portfolio" value={String(portfolioItems.length)} />
                </div>

                <h4 className="font-sans text-[10px] tracking-widest uppercase text-white/50 mb-2">Collaboration</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 mb-0.5">Base rate</p>
                    <p className="font-sans text-lg font-bold text-[#FF3B30] tabular-nums">
                      {profile.base_rate ? `$${Number(profile.base_rate).toLocaleString()}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 mb-0.5">Availability</p>
                    <p className="font-sans text-lg font-semibold">{profile.availability || "—"}</p>
                  </div>
                </div>

                <ChipRow
                  label="Niches"
                  items={categoriesList}
                  href="/profile/edit#sec-niche"
                  empty="Add niches"
                />
                <ChipRow
                  label="Content"
                  items={contentTypesList}
                  href="/profile/edit#sec-content-types"
                  empty="Add content types"
                  tone="blue"
                />
                <ChipRow
                  label="Languages"
                  items={languagesList}
                  href="/profile/edit#sec-niche"
                  empty="Add languages"
                  tone="muted"
                />
              </section>
            )}

            {isInfluencer && (
              <section className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-sans text-[10px] tracking-widest uppercase text-white/50">Past campaigns</h3>
                  <Link to="/profile/edit#sec-campaigns" className="font-sans text-[10px] text-[#FF3B30] hover:underline shrink-0">
                    {pastCampaigns.length ? "Edit" : "Add"}
                  </Link>
                </div>
                {pastCampaigns.length > 0 ? (
                  <div className="space-y-1.5">
                    {pastCampaigns.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                        <span className="font-sans text-sm text-white truncate">
                          {typeof c === "string" ? c : (c?.title || c?.name || "Campaign")}
                        </span>
                        {(c?.brand || c?.year || c?.date || c?.result) && (
                          <span className="font-sans text-[9px] uppercase tracking-widest text-white/40 shrink-0">
                            {[c.brand, c.year || c.date, c.result].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-3 py-4">
                    <p className="font-sans text-sm text-white/70">No brand work on file yet.</p>
                    <Link to="/profile/edit#sec-campaigns" className="font-sans text-[11px] text-[#FF3B30] hover:underline mt-1 inline-block">
                      Add campaign history →
                    </Link>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="lg:col-span-5 min-w-0">
            {isInfluencer && (
              <section className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden h-full">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h3 className="font-sans text-[10px] tracking-widest uppercase text-white/50">Social metrics</h3>
                  <span className="px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] text-[9px] font-bold rounded-full shrink-0">
                    {displayMetric(socialOverview.followers, { format: formatCompactNumber })} followers
                  </span>
                </div>
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.map((key) => {
                    const data = rawPlatforms[key] || {};
                    const connected = hasPlatformHandle(data);
                    const followersVal = connected
                      ? socialMetricOrNA(data.followers ?? data.subscribers, formatNumber)
                      : "—";
                    const erVal = connected
                      ? socialMetricOrNA(data.engagement, (n) => `${Number(n).toFixed(1)}%`)
                      : "—";
                    const viewsRaw =
                      key === "instagram" || key === "facebook" || key === "twitter"
                        ? (data.views > 0 ? data.views : null)
                        : data.views;
                    const viewsVal = connected
                      ? displayMetric(viewsRaw, {
                          format: formatCompactNumber,
                          allowZero: key === "youtube",
                        })
                      : "—";
                    return (
                      <div
                        key={key}
                        className={`px-3 py-3 rounded-xl border ${connected ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-60"}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-2.5 min-w-0">
                          <span className="font-sans text-[11px] uppercase tracking-wider text-[#FF3B30] font-semibold truncate">
                            {SOCIAL_PLATFORM_LABELS[key] || key}
                          </span>
                          <span
                            className={`font-sans text-sm sm:text-base font-bold truncate text-right ${
                              connected ? "text-white" : "text-white/40"
                            }`}
                            title={connected ? String(data?.handle || "") : undefined}
                            data-testid={`social-handle-${key}`}
                          >
                            {connected
                              ? `@${String(data?.handle || "").replace(/^@/, "")}`
                              : "Not connected"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-sans text-sm">
                          <div className="min-w-0">
                            <p className="tabular-nums font-semibold truncate leading-tight text-base">{followersVal}</p>
                            <p className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">
                              {key === "youtube" ? "Subs" : "Followers"}
                            </p>
                          </div>
                          <div className="min-w-0 sm:text-center">
                            <p className={`tabular-nums font-semibold truncate leading-tight text-base ${connected ? "text-[#34C759]" : ""}`}>
                              {erVal}
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">ER</p>
                          </div>
                          <div className="min-w-0 sm:text-center">
                            <p className={`font-semibold truncate leading-tight text-sm ${
                              data.verified || data.is_verified ? "text-[#34C759]" : "text-white/70"
                            }`}>
                              {connected
                                ? (data.verified || data.is_verified ? "Verified" : "Unverified")
                                : "—"}
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">Status</p>
                          </div>
                          <div className="min-w-0 sm:text-right">
                            <p className="tabular-nums font-semibold truncate leading-tight text-base">{viewsVal}</p>
                            <p className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">Views</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {isInfluencer && (portfolioImages.length > 0 || portfolioVideos.length > 0) && (
          <section className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden w-full min-w-0">
            <h3 className="font-sans text-[10px] tracking-widest uppercase text-white/50 mb-3">Portfolio</h3>
            {portfolioImages.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-wider opacity-50 mb-2">
                  <ImageIcon className="w-3 h-3 text-[#FF3B30]" /> Images
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {portfolioImages.map((media, i) => (
                    <div key={i} className="aspect-square rounded-lg border border-white/10 overflow-hidden bg-black/50 min-w-0">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {portfolioVideos.map((media, i) => (
                    <div key={i} className="aspect-video rounded-lg border border-white/10 overflow-hidden bg-black/50 min-w-0">
                      <video src={media} controls className="w-full h-full object-cover block" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
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

function uniqueLabels(val) {
  const raw = Array.isArray(val) ? val : (val ? String(val).split(/[,|]/) : []);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const t = String(item || "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function StatTile({ label, value, accent = false, title, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5" title={title}>
      <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 mb-0.5">{label}</p>
      <p className={`font-sans text-lg font-bold tabular-nums ${accent ? "text-[#34C759]" : "text-white"}`}>{value}</p>
      {hint ? <p className="font-sans text-[9px] text-white/40 mt-0.5">{hint}</p> : null}
    </div>
  );
}

function ChipRow({ label, items, href, empty, tone = "default" }) {
  const toneClass = tone === "blue"
    ? "bg-[#0A84FF]/10 border-[#0A84FF]/20 text-[#0A84FF]"
    : tone === "muted"
      ? "bg-white/5 border-white/10 text-white/60"
      : "bg-[#FF3B30]/10 border-[#FF3B30]/20 text-[#FF3B30]";
  return (
    <div className="mb-2 last:mb-0">
      <p className="font-sans text-[9px] uppercase tracking-widest text-white/40 mb-1">{label}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className={`px-2 py-0.5 rounded-full border font-sans text-[9px] uppercase tracking-widest ${toneClass}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <Link to={href} className="font-sans text-[11px] text-white/45 hover:text-[#FF3B30] transition-colors">
          {empty} →
        </Link>
      )}
    </div>
  );
}
