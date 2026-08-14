import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowLeft, Play, ChevronLeft, Sparkles } from "lucide-react";

import { IconTip } from "@/components/IconTip";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES, matchesCategoryFilter } from "@/lib/categories";
import { api } from "@/lib/api";
import { formatUsername } from "@/lib/username";
import { useLenis } from "@/lib/useLenis";
import { withDirectoryMedia, isVideoUrl } from "@/lib/directoryMedia";
import { getTopSocialAccount } from "@/lib/platforms";

function formatFollowers(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return v ? String(v) : "—";
}

function DirectoryMediaTile({ src, className = "", priority = false }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const video = isVideoUrl(src);

  useEffect(() => {
    if (!video || !videoRef.current) return;
    const el = videoRef.current;
    el.muted = true;
    const play = () => el.play().catch(() => {});
    play();
  }, [video, src]);

  if (!src || failed) {
    return <div className={`bg-white/5 ${className}`} />;
  }

  if (video) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onError={() => setFailed(true)}
        />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.16em] uppercase text-white/90">
          <Play className="w-2.5 h-2.5 fill-current" /> Reel
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      className={`h-full w-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

function CreatorDirectoryCard({ creator, index }) {
  const c = withDirectoryMedia(creator);
  const top = getTopSocialAccount(c);
  const socialName = top.handle || formatUsername(c.handle, c.username) || c.name || "influencer";
  const reel = (c.portfolio || []).slice(0, 4);
  const hero = reel[0] || c.avatar;
  const thumbs = reel.slice(1, 4);
  const followerCount = top.followers > 0 ? top.followers : Number(c.followers) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay: Math.min(index, 12) * 0.04 }}
      data-testid={`creator-${c.id}`}
    >
      <Link to={`/creators/${c.id}`} className="group block">
        <div className="aspect-[3/4] overflow-hidden relative bg-white/[0.03]">
          <div className="absolute inset-0 grid grid-rows-[1fr_0.42fr] gap-px bg-white/10">
            <DirectoryMediaTile
              src={hero}
              priority={index < 6}
              className="transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div className="grid grid-cols-3 gap-px bg-white/10 min-h-0">
              {(thumbs.length ? thumbs : [c.avatar, c.cover_photo, hero]).slice(0, 3).map((src, i) => (
                <DirectoryMediaTile key={`${c.id}-t-${i}`} src={src} className="min-h-0" />
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
          {top.label ? (
            <span className="pointer-events-none absolute top-1.5 left-1.5 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.14em] uppercase text-white/90">
              {top.label}
            </span>
          ) : null}
          {c.match_score != null ? (
            <span 
              className="absolute top-1.5 right-1.5 bg-[#34C759]/20 text-[#34C759] px-2 py-0.5 font-sans text-[10px] tracking-wide uppercase font-semibold rounded-3xl border border-[#34C759]/30"
              title={c.match_reasons ? c.match_reasons.join('\n') : ''}
            >
              {c.match_score}% Match
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-1.5">
          <div className="min-w-0">
            <div className="font-sans text-sm leading-tight truncate group-hover:italic transition-all" title={socialName}>
              {socialName}
            </div>
            {(c.name && socialName !== c.name) ? (
              <div className="font-sans text-[9px] tracking-[0.12em] uppercase opacity-45 truncate mt-0.5">
                {c.name}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 font-sans text-[10px] tracking-[0.14em] uppercase opacity-65">
            {formatFollowers(followerCount)}
          </div>
        </div>
        <div className="mt-0.5 font-sans text-[9px] tracking-[0.14em] uppercase opacity-40 truncate">
          {(c.niches || []).slice(0, 2).join(" · ") || c.category || "Influencer"}
        </div>
      </Link>
    </motion.div>
  );
}

export default function Marketplace() {
  useLenis();
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
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">

      <div className="flex flex-col h-full overflow-y-auto w-full flex-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6 mb-8">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> § The Directory
            </p>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-2">Directory</h1>
          </div>
        </div>

        {/* Tabs + search in bordered box */}
        <div className="mt-3 border border-white/15 rounded-3xl px-3 py-2 flex flex-wrap items-center gap-3 justify-between">
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
              <Search className="w-4 h-4 opacity-60" />
              <input
                data-testid="search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-transparent focus:outline-none w-36 md:w-56 font-sans text-sm"
                placeholder="Search…"
                aria-label="Search"
              />
            </div>
            <IconTip label="Search">
              <button
                type="submit"
                className="inline-flex items-center justify-center w-9 h-9 border border-white/20 bg-white/5 hover:bg-white/15"
                data-testid="search-submit"
                title="Search"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </IconTip>
          </form>
        </div>

        <div className="mt-3 max-w-sm ml-auto">
          <MultiSelectDropdown
            options={PLATFORM_CATEGORIES}
            selected={categories}
            onChange={setCategories}
            placeholder="All"
            allowAll
            compact
            label="Platform categories"
          />
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-3 md:px-6 pb-16">
        {tab === "creators" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-3">
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
          <div className="space-y-6">
            {campaigns.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.04 }}
                data-testid={`campaign-row-${c.id}`}
              >
                <Link to={`/campaigns/${c.id}`} className="group block hairline-b py-6 grid grid-cols-12 gap-6 items-baseline">
                  <div className="col-span-12 md:col-span-1 font-sans text-[10px] tracking-[0.25em] uppercase opacity-60">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <div className="font-sans text-[10px] tracking-[0.25em] uppercase opacity-60">{c.brand}</div>
                    <div className="font-sans text-3xl md:text-4xl leading-tight mt-1 group-hover:italic transition-all">
                      {c.title}
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-3 font-sans text-[11px] tracking-[0.2em] uppercase opacity-70">
                    {(c.niches || []).join(" · ")}
                  </div>
                  <div className="col-span-3 md:col-span-2 font-sans italic text-2xl">₹{c.budget}</div>
                  <div className="col-span-3 md:col-span-1 text-right font-sans text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] group-hover:translate-x-1 transition-transform">
                    View →
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
