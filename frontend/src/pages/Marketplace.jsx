import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowLeft, Play, ChevronLeft, Sparkles } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";

import { IconTip } from "@/components/IconTip";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES, matchesCategoryFilter } from "@/lib/categories";
import { api } from "@/lib/api";
import { formatUsername } from "@/lib/username";
import { withDirectoryMedia, isVideoUrl } from "@/lib/directoryMedia";
import { getTopSocialAccount } from "@/lib/platforms";

function formatFollowers(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return v ? String(v) : "—";
}

function DirectoryMediaTile({ src, fallbackSrc = "", className = "", priority = false }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const active = useFallback && fallbackSrc ? fallbackSrc : src;
  const video = isVideoUrl(active);

  useEffect(() => {
    setFailed(false);
    setUseFallback(false);
  }, [src, fallbackSrc]);

  useEffect(() => {
    if (!video || !videoRef.current) return;
    const el = videoRef.current;
    el.muted = true;
    const play = () => el.play().catch(() => {});
    play();
  }, [video, active]);

  const onFail = () => {
    if (!useFallback && fallbackSrc && fallbackSrc !== active) {
      setUseFallback(true);
      return;
    }
    setFailed(true);
  };

  if (!active || failed) {
    return <div className={`bg-white/10 ${className}`} />;
  }

  if (video) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <video
          ref={videoRef}
          src={active}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onError={onFail}
        />
        <span className="theme-keep-dark pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.16em] uppercase text-white/90">
          <Play className="w-2.5 h-2.5 fill-current" /> Reel
        </span>
      </div>
    );
  }

  return (
    <img
      src={active}
      alt=""
      loading={priority ? "eager" : "lazy"}
      className={`h-full w-full object-cover ${className}`}
      onError={onFail}
    />
  );
}

function CreatorDirectoryCard({ creator, index }) {
  const c = withDirectoryMedia(creator);
  const top = getTopSocialAccount(c);
  const socialName =
    formatUsername(top.handle, c.handle, c.username) ||
    formatUsername(c.name) ||
    "influencer";
  const displayHandle = socialName.startsWith("@") ? socialName : `@${socialName}`;
  const reel = (c.portfolio || []).filter(Boolean);
  // Prefer still images for hero so blocked videos never leave a gray hole
  const hero =
    reel.find((u) => u && !isVideoUrl(u)) ||
    c.cover_photo ||
    c.avatar ||
    reel[0];
  const thumbPool = [
    ...reel.filter((u) => u && u !== hero),
    c.avatar,
    c.cover_photo,
    ...(c._mockMedia?.images || []),
  ].filter(Boolean);
  const thumbs = [];
  for (const src of thumbPool) {
    if (thumbs.length >= 3) break;
    if (!thumbs.includes(src)) thumbs.push(src);
  }
  while (thumbs.length < 3 && c._mockMedia?.images?.length) {
    const src = c._mockMedia.images[thumbs.length % c._mockMedia.images.length];
    thumbs.push(src);
  }
  const followerCount = top.followers > 0 ? top.followers : Number(c.followers) || 0;
  const niches = (c.niches || []).slice(0, 2);
  const city = c.city || c.location || "";
  const er = top.engagement != null ? Number(top.engagement) : null;
  const rate = c.base_rate != null && Number(c.base_rate) > 0 ? Number(c.base_rate) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay: Math.min(index, 12) * 0.04 }}
      data-testid={`creator-${c.id}`}
    >
      <Link to={`/creators/${c.id}`} className="group block h-full">
        <div className="aspect-[3/4] overflow-hidden relative bg-white/[0.03] rounded-2xl border border-white/10">
          <div className="absolute inset-0 grid grid-rows-[1fr_0.42fr] gap-px bg-white/10">
            <DirectoryMediaTile
              src={hero}
              fallbackSrc={c.avatar || c.cover_photo || thumbs[0]}
              priority={index < 6}
              className="min-h-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div className="grid grid-cols-3 gap-px bg-white/10 min-h-0">
              {thumbs.slice(0, 3).map((src, i) => (
                <DirectoryMediaTile
                  key={`${c.id}-t-${i}`}
                  src={src}
                  fallbackSrc={c.avatar || hero}
                  className="min-h-0 h-full w-full"
                />
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
          {top.label ? (
            <span className="theme-keep-dark pointer-events-none absolute top-1.5 left-1.5 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.14em] uppercase text-white/90 rounded-full">
              {top.label}
            </span>
          ) : null}
          {c.match_score != null ? (
            <span
              className="absolute top-1.5 right-1.5 bg-[#34C759]/20 text-[#34C759] px-2 py-0.5 font-sans text-[10px] tracking-wide uppercase font-semibold rounded-3xl border border-[#34C759]/30"
              title={c.match_reasons ? c.match_reasons.join("\n") : ""}
            >
              {c.match_score}% Match
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 space-y-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <div className="font-sans text-sm leading-tight truncate group-hover:italic transition-all font-medium" title={displayHandle}>
              {displayHandle}
            </div>
            <div className="shrink-0 font-sans text-[10px] tracking-[0.14em] uppercase text-[#FF3B30] font-semibold">
              {formatFollowers(followerCount)}
            </div>
          </div>
          {(c.name && formatUsername(c.name) !== socialName.replace(/^@/, "")) ? (
            <div className="font-sans text-[10px] text-white/50 truncate">{c.name}</div>
          ) : null}
          <div className="font-sans text-[9px] tracking-[0.12em] uppercase opacity-45 truncate">
            {niches.join(" · ") || c.category || "Influencer"}
            {city ? ` · ${city}` : ""}
          </div>
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-white/40">
            {er != null && Number.isFinite(er) ? <span className="text-[#34C759]/80">{er.toFixed(1)}% ER</span> : null}
            {rate != null ? <span>₹{rate.toLocaleString()}</span> : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Marketplace() {
  const [tab, setTab] = useState("creators");
  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState([]); // [] = All

  const load = async () => {
    const nicheParam = categories.length === 1 ? categories[0] : undefined;
    const params = { q: q || undefined, niche: nicheParam };
    const [c, cp] = await Promise.all([
      api.get("/creators", { params }),
      api.get("/campaigns", { params }),
    ]);
    const creatorList = Array.isArray(c.data) ? c.data : [];
    const campaignList = Array.isArray(cp.data) ? cp.data : [];
    setCreators(
      categories.length <= 1
        ? creatorList
        : creatorList.filter((x) => matchesCategoryFilter(x.category || x.niches || x.niche, categories))
    );
    setCampaigns(
      categories.length <= 1
        ? campaignList
        : campaignList.filter((x) => matchesCategoryFilter(x.niche || x.niches || x.category, categories))
    );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);
  const onSearch = (e) => { e.preventDefault(); load(); };

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] flex flex-col pt-2">
      <div className="flex flex-col w-full pb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-white/10 pb-3 mb-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Directory
            </p>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-1">Directory</h1>
          </div>
          <div className="w-full md:w-56">
            <MultiSelectDropdown
              options={PLATFORM_CATEGORIES}
              selected={categories}
              onChange={setCategories}
              placeholder="All categories"
              allowAll
              compact
              label="Categories"
            />
          </div>
        </div>

        <div className="mb-4 border border-white/15 rounded-3xl px-3 py-2 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-5 font-sans text-[11px] tracking-[0.28em] uppercase">
            {["creators", "campaigns"].map((t) => (
              <button
                key={t}
                data-testid={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`kinetic-underline py-1 ${tab === t ? "text-[#FF3B30]" : "opacity-60"}`}
              >
                {t === "creators" ? `Influencers · ${creators.length}` : `Briefs · ${campaigns.length}`}
              </button>
            ))}
          </div>
          <form onSubmit={onSearch} className="flex items-center gap-2">
            <div className="flex items-center gap-2 border-b border-white/20 py-1.5 pl-1.5 pr-2">
              <AiIcon name="search" className="w-4 h-4 opacity-70" />
              <input
                data-testid="search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-transparent focus:outline-none w-36 md:w-56 font-sans text-sm"
                placeholder={tab === "creators" ? "Search influencers…" : "Search briefs…"}
                aria-label="Search"
              />
            </div>
            <IconTip label="Search">
              <button
                type="submit"
                className="inline-flex items-center justify-center w-9 h-9 border border-white/20 bg-white/5 hover:bg-white/15 rounded-full"
                data-testid="search-submit"
                title="Search"
                aria-label="Search"
              >
                <AiIcon name="search" className="w-4 h-4" />
              </button>
            </IconTip>
          </form>
        </div>

        {tab === "creators" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {creators.map((c, i) => (
              <CreatorDirectoryCard key={c.id} creator={c} index={i} />
            ))}
            {creators.length === 0 && (
              <div className="col-span-full py-16 text-center font-sans italic text-2xl opacity-60">
                No influencers on file for this filter.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: Math.min(i, 10) * 0.03 }}
                data-testid={`campaign-row-${c.id}`}
              >
                <Link
                  to={`/campaigns/${c.id}`}
                  className="group block border border-white/10 hover:border-[#FF3B30]/40 rounded-2xl px-4 py-4 md:px-5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="grid grid-cols-12 gap-3 md:gap-4 items-center">
                    <div className="col-span-12 md:col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-50">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="col-span-12 md:col-span-5 min-w-0">
                      <div className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-50 truncate">{c.brand || "Brand"}</div>
                      <div className="font-sans text-lg md:text-xl font-semibold leading-tight mt-0.5 truncate group-hover:text-[#FF3B30] transition-colors">
                        {c.title}
                      </div>
                      {c.description ? (
                        <p className="font-sans text-xs text-white/50 mt-1 line-clamp-2">{c.description}</p>
                      ) : null}
                    </div>
                    <div className="col-span-6 md:col-span-3 font-sans text-[10px] tracking-[0.16em] uppercase opacity-70 truncate">
                      {(c.niches || []).slice(0, 3).join(" · ") || c.category || "General"}
                    </div>
                    <div className="col-span-3 md:col-span-2 font-sans text-lg font-bold text-[#34C759]">
                      ₹{Number(c.budget || 0).toLocaleString()}
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right font-sans text-[10px] tracking-[0.2em] uppercase text-[#FF3B30]">
                      View →
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {campaigns.length === 0 && (
              <div className="py-24 text-center font-sans italic text-3xl opacity-60">
                No briefs on file for this filter.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
