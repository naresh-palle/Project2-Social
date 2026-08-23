import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Activity, MapPin, Heart } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatUsername } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, hasPlatformHandle, socialOrNA, socialMetricOrNA, SOCIAL_PLATFORM_ICONS } from "@/lib/platforms";
import { displayMetric, formatEngagementRate, engagementRateHint, formatCompactNumber, formatExactNumber } from "@/lib/socialAnalytics";
import { withDirectoryMedia, isVideoUrl } from "@/lib/directoryMedia";
import { useAuth } from "@/lib/auth";

function fmt(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}

export default function CreatorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState(6);
  const [intel, setIntel] = useState(null);
  const [tab, setTab] = useState("overview");
  const [research, setResearch] = useState(null);
  const [past, setPast] = useState({ campaigns: [], summary: {} });
  const [roi, setRoi] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [wishlisted, setWishlisted] = useState(false);
  const [comboSelected, setComboSelected] = useState([]);
  const isBrand = user?.role === "owner" || user?.role === "agent" || user?.role === "admin";

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/creators/${id}`);
        setCreator(withDirectoryMedia(data));
        try {
          const intelRes = await api.get(`/creators/${id}/intelligence`);
          setIntel(intelRes.data);
        } catch {
          setIntel(null);
        }
        try {
          const pastRes = await api.get(`/marketplace/creators/${id}/past-campaigns`);
          setPast(pastRes.data || { campaigns: [], summary: {} });
        } catch {
          setPast({ campaigns: [], summary: {} });
        }
        try {
          const roiRes = await api.get(`/marketplace/creators/${id}/roi-profile`);
          setRoi(roiRes.data);
          setWishlisted(!!roiRes.data?.wishlisted);
        } catch {
          setRoi(null);
        }
        if (isBrand) {
          try {
            const sim = await api.post("/marketplace/creators/similar", { creator_id: id, limit: 8 });
            setSimilar(sim.data.creators || []);
          } catch {
            setSimilar([]);
          }
        }
      } catch {
        toast.error("Failed to load influencer");
        nav("/marketplace");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, nav, isBrand]);

  const toggleWishlist = async () => {
    try {
      const { data } = await api.post("/wishlist", { target_id: id, target_type: "influencer", action: "toggle" });
      setWishlisted(!!data.wishlisted);
      toast.success(data.wishlisted ? "Saved to wishlist" : "Removed");
    } catch {
      toast.error("Wishlist failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] flex items-center justify-center text-[#F4F4F0]">
        <div className="animate-pulse font-mono tracking-widest text-sm">Loading…</div>
      </div>
    );
  }
  if (!creator) return null;

  const chartData = creator.monthly_analytics?.slice(-chartRange) || [];
  const bestPlatform = Object.entries(creator.platform_metrics || {}).reduce((max, [k, v]) => {
    if (!v || !v.followers) return max;
    return (v.followers > (max.val?.followers || 0)) ? { key: k, val: v } : max;
  }, { key: null, val: null });

  const displayName = formatUsername(creator.handle, creator.username) || creator.name || "Influencer";
  const niches = Array.isArray(creator.category)
    ? creator.category
    : (creator.category ? String(creator.category).split(",").map((s) => s.trim()).filter(Boolean) : []);
  const nichesLabel = niches.slice(0, 3).join(" · ") || "Influencer";
  const social = creator.social && typeof creator.social === "object" ? creator.social : null;
  const kpis = roi?.kpis || past?.summary || {};
  const pastCampaigns = past?.campaigns || [];

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="border-b border-white/10 pb-4 mb-4">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2 mb-3">
          <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Directory profile
        </p>

        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          {creator.avatar ? (
            <img src={creator.avatar} alt={displayName} className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-2xl border border-white/15 shrink-0" />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border border-white/15 flex items-center justify-center bg-white/5 shrink-0">
              <span className="font-sans text-2xl font-bold opacity-60">{displayName[0]}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[#34C759]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" /> Online
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">
                {creator.creator_level || "Beginner"}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/45 inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {formatUserLocation(creator) || "Location not set"}
              </span>
            </div>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight truncate">{displayName}</h1>
            {creator.name && creator.name !== displayName && (
              <p className="font-sans text-sm text-white/50 mt-0.5">{creator.name}</p>
            )}
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1.5 truncate">
              {nichesLabel}
              {creator.languages?.length ? ` · ${creator.languages.slice(0, 3).join(", ")}` : ""}
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end gap-3 shrink-0">
            {bestPlatform.key && (
              <div className="text-left md:text-right">
                <div className="font-sans text-2xl font-bold tabular-nums">{bestPlatform.val.followers.toLocaleString()}</div>
                <div className="font-mono text-[9px] tracking-widest uppercase opacity-50">{bestPlatform.key} audience</div>
              </div>
            )}
          </div>
        </div>

        {social && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4" data-testid="creator-social-overview">
            {[
              ["Followers", social.followers, false],
              ["Total views", social.views, true],
              ["Total reach", social.reach, true],
              ["Engagement rate", social.engagementRate, false, true],
            ].map(([label, val, zeroMissing, isEr]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2" title={!isEr ? (formatExactNumber(val) || undefined) : undefined}>
                <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">{label}</p>
                <p className="font-sans text-base font-bold tabular-nums mt-0.5">
                  {isEr ? formatEngagementRate(val) : displayMetric(val, { format: formatCompactNumber, allowZero: !zeroMissing })}
                </p>
                {isEr && engagementRateHint(social.engagementRateBasis) ? (
                  <p className="font-mono text-[8px] text-white/35 mt-0.5">{engagementRateHint(social.engagementRateBasis)}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3" data-testid="creator-roi-kpis">
          {[
            ["Avg campaign reach", fmt(kpis.average_campaign_reach || kpis.avg_reach)],
            ["Avg campaign eng.", fmt(kpis.average_campaign_engagement || kpis.avg_engagement)],
            ["Success rate", kpis.campaign_success_rate != null ? `${kpis.campaign_success_rate}%` : (kpis.success_rate != null ? `${kpis.success_rate}%` : "—")],
            ["Campaigns done", kpis.completed_campaigns ?? "—"],
            ["Avg ROI", kpis.average_roi != null ? kpis.average_roi : (kpis.avg_roi ?? "—")],
            ["Avg ROAS", kpis.average_roas != null ? `${kpis.average_roas}x` : (kpis.avg_roas != null ? `${kpis.avg_roas}x` : "—")],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">{label}</p>
              <p className="font-sans text-base font-bold tabular-nums mt-0.5">{val}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" onClick={toggleWishlist} className={`px-3 py-1 rounded-full border font-mono text-[9px] uppercase tracking-widest inline-flex items-center gap-1 ${wishlisted ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}>
            <Heart className={`w-3 h-3 ${wishlisted ? "fill-current" : ""}`} /> Wishlist
          </button>
          <button type="button" className="px-3 py-1 rounded-full border border-white/15 font-mono text-[9px] uppercase tracking-widest" onClick={async () => {
            try { await api.post("/discover/shortlist", { creator_id: creator.id, action: "add" }); toast.success("Shortlisted"); }
            catch { toast.error("Shortlist requires a brand login"); }
          }}>Shortlist</button>
          <button type="button" className="px-3 py-1 rounded-full border border-white/15 font-mono text-[9px] uppercase tracking-widest" onClick={async () => {
            try {
              const { data } = await api.post(`/creators/${creator.id}/deep-research`, {});
              setResearch(data.report); setTab("research");
            } catch { toast.error("Deep Research failed"); }
          }}>Deep Research</button>
          <Link to="/discover" className="px-3 py-1 rounded-full border border-white/15 font-mono text-[9px] uppercase tracking-widest">Discover</Link>
        </div>
        {intel?.quality && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
            {["engagement_quality", "audience_quality", "content_quality", "growth", "authenticity", "brand_safety"].map((k) => (
              <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">{k.replace(/_/g, " ")}</div>
                <div className="font-sans text-lg font-bold">{intel.quality.breakdown?.[k] ?? "Data unavailable"}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3 font-mono text-[9px] uppercase tracking-widest">
          {["overview", "campaigns", "analytics", "audience", "research"].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`pb-1 border-b-2 ${tab === t ? "border-[#FF3B30] text-[#FF3B30]" : "border-transparent text-white/45"}`}>{t === "campaigns" ? "Past campaigns" : t}</button>
          ))}
        </div>
      </div>

      {tab === "campaigns" ? (
        <div className="space-y-4 mb-6">
          <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/45">Campaign performance case studies</h2>
          {pastCampaigns.length === 0 ? (
            <p className="font-sans italic opacity-50">No past campaign performance on file yet.</p>
          ) : pastCampaigns.map((c) => (
            <article key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid={`past-campaign-${c.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-sans text-lg font-semibold">{c.campaign_name || c.title}</h3>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                    {c.brand_name} · {c.campaign_category} · {c.campaign_objective} · {c.campaign_date}
                  </p>
                </div>
                {c.roas != null ? (
                  <span className="font-sans text-xl font-bold text-[#34C759]">{c.roas}x ROAS</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-3">
                {[
                  ["Reach", fmt(c.total_reach)],
                  ["Views", fmt(c.total_views)],
                  ["Impressions", fmt(c.total_impressions)],
                  ["Engagement", fmt(c.total_engagement)],
                  ["ER", c.engagement_rate != null ? `${c.engagement_rate}%` : "—"],
                  ["Posts", c.posts_count ?? "—"],
                  ["Likes", fmt(c.likes)],
                  ["Comments", fmt(c.comments)],
                  ["Shares", fmt(c.shares)],
                  ["Saves", fmt(c.saves)],
                  ["Clicks", fmt(c.clicks)],
                  ["Leads", fmt(c.leads)],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg border border-white/10 px-2 py-1.5">
                    <div className="font-mono text-[8px] uppercase text-white/40">{label}</div>
                    <div className="font-sans text-sm font-bold tabular-nums">{val}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <div className="rounded-lg border border-white/10 px-2 py-1.5">
                  <div className="font-mono text-[8px] uppercase text-white/40">Campaign cost</div>
                  <div className="font-sans text-sm font-bold">{c.campaign_cost != null ? `₹${Number(c.campaign_cost).toLocaleString()}` : "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 px-2 py-1.5">
                  <div className="font-mono text-[8px] uppercase text-white/40">Revenue</div>
                  <div className="font-sans text-sm font-bold">{c.revenue_generated != null ? `₹${Number(c.revenue_generated).toLocaleString()}` : "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 px-2 py-1.5">
                  <div className="font-mono text-[8px] uppercase text-white/40">ROI</div>
                  <div className="font-sans text-sm font-bold">{c.roi ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-white/10 px-2 py-1.5">
                  <div className="font-mono text-[8px] uppercase text-white/40">Content</div>
                  <div className="font-sans text-sm font-bold truncate">{c.content_produced || "—"}</div>
                </div>
              </div>
              {(c.key_outcome || c.brand_impact) && (
                <div className="mt-3 font-sans text-sm text-white/70 space-y-1">
                  {c.key_outcome ? <p><span className="text-white/40">Outcome:</span> {c.key_outcome}</p> : null}
                  {c.brand_impact ? <p><span className="text-white/40">Brand impact:</span> {c.brand_impact}</p> : null}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {tab !== "campaigns" ? (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-4">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-2">About</h3>
            <p className="font-sans text-sm leading-relaxed text-white/85 mb-3">
              {creator.bio || "No bio provided."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-mono text-[9px] tracking-widest uppercase opacity-45 mb-0.5">Base rate</div>
                <div className="font-sans text-lg font-bold text-[#FF3B30]">
                  {creator.base_rate ? `₹${Number(creator.base_rate).toLocaleString()}` : "—"}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] tracking-widest uppercase opacity-45 mb-0.5">Availability</div>
                <div className="font-sans text-lg font-semibold">{creator.availability || "—"}</div>
              </div>
            </div>
          </section>

          {pastCampaigns.length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45">Past campaigns</h3>
                <button type="button" onClick={() => setTab("campaigns")} className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]">View all</button>
              </div>
              <div className="space-y-2">
                {pastCampaigns.slice(0, 4).map((c) => (
                  <div key={c.id} className="py-1.5 border-b border-white/5 last:border-0">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                      {[c.brand_name, c.campaign_date].filter(Boolean).join(" · ")}
                    </div>
                    <div className="font-sans text-sm font-medium">{c.campaign_name}</div>
                    <div className="font-mono text-[10px] text-[#34C759] mt-0.5">
                      Reach {fmt(c.total_reach)} · ER {c.engagement_rate != null ? `${c.engagement_rate}%` : "—"}
                      {c.roas != null ? ` · ROAS ${c.roas}x` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-8 space-y-4">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Audience</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOCIAL_PLATFORMS.map((plat) => {
                const pm = creator.platform_metrics?.[plat] || {};
                const connected = hasPlatformHandle(pm);
                const Icon = SOCIAL_PLATFORM_ICONS[plat];
                const growth = Number(pm.growth) || 0;
                const isGrowthPos = growth >= 0;
                return (
                  <div key={plat} className={`p-3 rounded-xl border ${connected ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-60"}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {Icon ? <Icon className="w-4 h-4 shrink-0 opacity-70" /> : null}
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50">{SOCIAL_PLATFORM_LABELS[plat] || plat}</div>
                          <div className={`font-sans text-sm font-bold truncate ${connected ? "text-white" : "text-white/40"}`}>
                            {connected ? `@${String(pm.handle || "").replace(/^@/, "")}` : "Not connected"}
                          </div>
                        </div>
                      </div>
                      {connected ? (
                        <div className={`flex items-center gap-0.5 font-mono text-[10px] ${isGrowthPos ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
                          {isGrowthPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(growth)}%
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="font-sans text-sm font-bold tabular-nums">
                          {connected ? socialMetricOrNA(pm.followers ?? pm.subscribers, (n) => n.toLocaleString()) : "—"}
                        </div>
                        <div className="font-mono text-[8px] tracking-widest uppercase opacity-40">Audience</div>
                      </div>
                      <div>
                        <div className="font-sans text-sm font-bold tabular-nums">
                          {connected ? socialMetricOrNA(pm.engagement, (n) => `${n}%`) : "—"}
                        </div>
                        <div className="font-mono text-[8px] tracking-widest uppercase opacity-40">Engagement</div>
                      </div>
                      <div>
                        <div className="font-sans text-sm font-bold tabular-nums">
                          {connected ? socialMetricOrNA(pm.views, (n) => formatCompactNumber(n)) : "—"}
                        </div>
                        <div className="font-mono text-[8px] tracking-widest uppercase opacity-40">Views</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {tab === "analytics" && chartData.length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Growth
                </h3>
                <div className="flex gap-1">
                  {[3, 6, 12].map((n) => (
                    <button key={n} type="button" onClick={() => setChartRange(n)} className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest ${chartRange === n ? "bg-[#FF3B30] text-white" : "border border-white/15"}`}>{n}m</button>
                  ))}
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#121212", border: "1px solid #333" }} />
                    <Area type="monotone" dataKey="followers" stroke="#FF3B30" fill="#FF3B30" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {tab === "research" && research && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-2">Deep research</h3>
              <pre className="whitespace-pre-wrap font-sans text-sm text-white/80">{typeof research === "string" ? research : JSON.stringify(research, null, 2)}</pre>
            </section>
          )}

          {(creator.portfolio || []).length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Portfolio</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {creator.portfolio.slice(0, 9).map((src, i) => (
                  isVideoUrl(src) ? (
                    <video key={i} src={src} className="aspect-square object-cover rounded-xl" muted playsInline />
                  ) : (
                    <img key={i} src={src} alt="" className="aspect-square object-cover rounded-xl" />
                  )
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      ) : null}

      {isBrand && similar.length > 0 && (
        <section className="mt-8 border-t border-white/10 pt-6">
          <h2 className="font-mono text-[10px] tracking-widest uppercase text-[#FF3B30] mb-1">Creators similar to this profile</h2>
          <p className="font-sans text-sm text-white/50 mb-4">Matched on niche, audience, location, followers, engagement, content type, and pricing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {similar.map((c) => {
              const selected = comboSelected.find((x) => x.id === c.id);
              return (
                <div key={c.id} className={`rounded-2xl border p-3 ${selected ? "border-[#FF3B30]" : "border-white/10"}`}>
                  <Link to={`/creators/${c.id}`} className="flex gap-2">
                    {c.avatar ? <img src={c.avatar} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-white/10" />}
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-semibold truncate">{c.name}</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-white/40 truncate">
                        {fmt(c.followers)} · {c.engagement_rate != null ? `${c.engagement_rate}%` : "—"} · sim {c.similarity_score}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setComboSelected((prev) => {
                      if (prev.find((x) => x.id === c.id)) return prev.filter((x) => x.id !== c.id);
                      if (prev.length >= 10) { toast.error("Max 10"); return prev; }
                      return [...prev, c];
                    })}
                    className="mt-2 w-full px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest"
                  >
                    {selected ? "Selected" : "Select for combo"}
                  </button>
                </div>
              );
            })}
          </div>
          {comboSelected.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[#FF3B30]/40 p-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">
                Group · {comboSelected.length} · est. ₹{comboSelected.reduce((s, c) => s + (Number(c.base_rate) || 0), 0).toLocaleString()}
              </span>
              <Link to="/marketplace?tab=creators" className="px-3 py-1 rounded-full bg-[#FF3B30] text-white font-mono text-[9px] uppercase tracking-widest">
                Continue in marketplace
              </Link>
              <button type="button" onClick={() => setComboSelected([])} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Clear</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
