import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Instagram, Youtube, Twitter, Facebook, ArrowUpRight, ArrowDownRight, Activity, Users, MapPin, Sparkles } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatUsername } from "@/lib/username";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, hasPlatformHandle, socialOrNA, socialMetricOrNA } from "@/lib/platforms";
import { withDirectoryMedia, isVideoUrl } from "@/lib/directoryMedia";

export default function CreatorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState(6);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/creators/${id}`);
        setCreator(withDirectoryMedia(data));
      } catch {
        toast.error("Failed to load influencer");
        nav("/marketplace");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, nav]);

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

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Compact hero */}
      <div className="border-b border-white/10 pb-4 mb-4 pr-20">
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
                <MapPin className="w-3 h-3" /> {creator.city || "Global"}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: about + rate + campaigns */}
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
            {creator.content_types?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {creator.content_types.map((ct) => (
                  <span key={ct} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-[9px] uppercase tracking-widest text-white/55">
                    {ct}
                  </span>
                ))}
              </div>
            )}
          </section>

          {creator.past_campaigns?.length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-2">Past campaigns</h3>
              <div className="space-y-2">
                {creator.past_campaigns.slice(0, 6).map((c, i) => (
                  <div key={i} className="py-1.5 border-b border-white/5 last:border-0">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                      {[c.brand, c.date].filter(Boolean).join(" · ")}
                    </div>
                    <div className="font-sans text-sm font-medium">{c.title || c.name || "Campaign"}</div>
                    {c.result && <div className="font-mono text-[10px] text-[#34C759] mt-0.5">{c.result}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: platforms + portfolio + charts */}
        <div className="lg:col-span-8 space-y-4">
          <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Audience</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOCIAL_PLATFORMS.map((plat) => {
                const pm = creator.platform_metrics?.[plat] || {};
                const connected = hasPlatformHandle(pm);
                const Icon = plat === "instagram" ? Instagram : plat === "youtube" ? Youtube : plat === "twitter" ? Twitter : Facebook;
                const growth = Number(pm.growth) || 0;
                const isGrowthPos = growth >= 0;
                return (
                  <div key={plat} className={`p-3 rounded-xl border ${connected ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-60"}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 shrink-0 opacity-70" />
                        <div className="min-w-0">
                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50">{SOCIAL_PLATFORM_LABELS[plat] || plat}</div>
                          <div className="font-mono text-xs truncate">{socialOrNA(pm.handle)}</div>
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
                        <div className="font-mono text-[8px] tracking-widest uppercase opacity-40">ER</div>
                      </div>
                      <div>
                        <div className="font-sans text-sm font-bold tabular-nums">
                          {connected ? socialMetricOrNA(pm.views, (n) => `${(n / 1000).toFixed(1)}K`) : "—"}
                        </div>
                        <div className="font-mono text-[8px] tracking-widest uppercase opacity-40">Views</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {creator.portfolio?.length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Portfolio</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {creator.portfolio.map((media, i) => (
                  isVideoUrl(media) ? (
                    <div key={i} className="relative w-full aspect-video overflow-hidden bg-black/40 rounded-lg border border-white/10">
                      <video src={media} className="w-full h-full object-cover" muted loop playsInline autoPlay preload="metadata" />
                      <span className="absolute bottom-1.5 left-1.5 font-mono text-[8px] tracking-widest uppercase bg-black/55 px-1.5 py-0.5 rounded">Reel</span>
                    </div>
                  ) : (
                    <img key={i} src={media} alt="" className="w-full aspect-square object-cover rounded-lg border border-white/10" />
                  )
                ))}
              </div>
            </section>
          )}

          {chartData.length > 0 && (
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3 gap-2">
                <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/45">Trends</h3>
                <div className="flex gap-1">
                  {[1, 3, 6, 12].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setChartRange(r)}
                      className={`font-mono text-[9px] tracking-widest uppercase px-2 py-1 border rounded-full transition-colors ${
                        chartRange === r ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/10 opacity-50 hover:opacity-100"
                      }`}
                    >
                      {r === 1 ? "30D" : r === 3 ? "90D" : `${r}M`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-44">
                  <div className="font-mono text-[10px] mb-2 flex items-center gap-1.5 opacity-70">
                    <Users className="w-3.5 h-3.5 text-[#FF3B30]" /> Followers
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorF" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#FF3B30" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="rgba(244,244,240,0.2)" fontSize={9} tickMargin={6} />
                      <YAxis stroke="rgba(244,244,240,0.2)" fontSize={9} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={32} />
                      <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", borderColor: "rgba(244,244,240,0.1)" }} itemStyle={{ color: "#F4F4F0" }} />
                      <Area type="monotone" dataKey="followers" stroke="#FF3B30" fillOpacity={1} fill="url(#colorF)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-44">
                  <div className="font-mono text-[10px] mb-2 flex items-center gap-1.5 opacity-70">
                    <Activity className="w-3.5 h-3.5 text-[#34C759]" /> Engagement %
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorE" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34C759" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#34C759" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="rgba(244,244,240,0.2)" fontSize={9} tickMargin={6} />
                      <YAxis stroke="rgba(244,244,240,0.2)" fontSize={9} width={28} />
                      <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", borderColor: "rgba(244,244,240,0.1)" }} itemStyle={{ color: "#F4F4F0" }} />
                      <Area type="monotone" dataKey="engagement" stroke="#34C759" fillOpacity={1} fill="url(#colorE)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
