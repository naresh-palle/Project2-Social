import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Play, Heart, SlidersHorizontal, X } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { IconTip } from "@/components/IconTip";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PLATFORM_CATEGORIES } from "@/lib/categories";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatUsername } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";
import { withDirectoryMedia, isVideoUrl } from "@/lib/directoryMedia";
import { getTopSocialAccount } from "@/lib/platforms";
import { useAuth } from "@/lib/auth";

const SORT_OPTIONS = [
  { value: "engagement", label: "Highest Engagement" },
  { value: "newest", label: "Newest" },
  { value: "cost_asc", label: "Cost — Low to High" },
  { value: "cost_desc", label: "Cost — High to Low" },
  { value: "nearest", label: "Nearest" },
];

const BRAND_SORT = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A–Z" },
  { value: "campaigns", label: "Most Active Campaigns" },
];

const PROD_SORT = [
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "cost_asc", label: "Cost — Low to High" },
  { value: "cost_desc", label: "Cost — High to Low" },
  { value: "nearest", label: "Nearest" },
];

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Jaipur", "Kochi"];
const STATES = ["Maharashtra", "Delhi", "Karnataka", "Telangana", "Tamil Nadu", "West Bengal", "Rajasthan", "Kerala"];

function formatFollowers(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return v ? String(v) : "—";
}

function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return v ? String(Math.round(v)) : "—";
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
    el.play().catch(() => {});
  }, [video, active]);

  const onFail = () => {
    if (!useFallback && fallbackSrc && fallbackSrc !== active) {
      setUseFallback(true);
      return;
    }
    setFailed(true);
  };

  if (!active || failed) return <div className={`bg-white/10 ${className}`} />;
  if (video) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <video ref={videoRef} src={active} className="h-full w-full object-cover" muted loop playsInline autoPlay preload="metadata" onError={onFail} />
        <span className="theme-keep-dark pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.16em] uppercase text-white/90">
          <Play className="w-2.5 h-2.5 fill-current" /> Reel
        </span>
      </div>
    );
  }
  return (
    <img src={active} alt="" loading={priority ? "eager" : "lazy"} className={`h-full w-full object-cover ${className}`} onError={onFail} />
  );
}

function CreatorDirectoryCard({ creator, index, selected, onSelect, onWishlist }) {
  const c = withDirectoryMedia(creator);
  const top = getTopSocialAccount(c);
  const socialName = formatUsername(top.handle, c.handle, c.username) || formatUsername(c.name) || "influencer";
  const displayHandle = socialName.startsWith("@") ? socialName : `@${socialName}`;
  const displayName = c.name || socialName.replace(/^@/, "");
  const reel = (c.portfolio || []).filter(Boolean);
  const hero = reel.find((u) => u && !isVideoUrl(u)) || c.cover_photo || c.avatar || reel[0];
  const thumbPool = [...reel.filter((u) => u && u !== hero), c.avatar, c.cover_photo, ...(c._mockMedia?.images || [])].filter(Boolean);
  const thumbs = [];
  for (const src of thumbPool) {
    if (thumbs.length >= 3) break;
    if (!thumbs.includes(src)) thumbs.push(src);
  }
  const followerCount = top.followers > 0 ? top.followers : Number(c.followers) || 0;
  const niches = (c.niches || []).slice(0, 2);
  const city = formatUserLocation(c);
  const er = c.engagement_rate != null ? Number(c.engagement_rate) : top.engagement != null ? Number(top.engagement) : null;
  const rate = c.base_rate != null && Number(c.base_rate) > 0 ? Number(c.base_rate) : null;
  const kpis = c.campaign_kpis || {};
  const availability = c.availability || c.status || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay: Math.min(index, 12) * 0.04 }}
      data-testid={`creator-${c.id}`}
      className="relative flex flex-col h-full"
    >
      <Link to={`/creators/${c.id}`} className="group block flex-1 min-w-0">
        <div className={`aspect-[3/4] overflow-hidden relative bg-white/[0.03] rounded-2xl border ${selected ? "border-[#FF3B30]" : "border-white/10"}`}>
          <div className="absolute inset-0 grid grid-rows-[1fr_0.42fr] gap-px bg-white/10">
            <DirectoryMediaTile src={hero} fallbackSrc={c.avatar || c.cover_photo || thumbs[0]} priority={index < 6} className="min-h-0 h-full w-full transition-transform duration-700 group-hover:scale-[1.04]" />
            <div className="grid grid-cols-3 gap-px bg-white/10 min-h-0">
              {thumbs.slice(0, 3).map((src, i) => (
                <DirectoryMediaTile key={`${c.id}-t-${i}`} src={src} fallbackSrc={c.avatar || hero} className="min-h-0 h-full w-full" />
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
          {top.label ? (
            <span className="theme-keep-dark pointer-events-none absolute top-1.5 left-1.5 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.14em] uppercase text-white/90 rounded-full">
              {top.label}
            </span>
          ) : null}
          {availability ? (
            <span className="theme-keep-dark pointer-events-none absolute top-1.5 right-1.5 bg-black/55 px-1.5 py-0.5 font-sans text-[8px] tracking-[0.14em] uppercase text-[#34C759] rounded-full">
              {String(availability).replace(/_/g, " ")}
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          <div>
            <div className="font-sans text-sm leading-tight truncate font-semibold group-hover:italic transition-all" title={displayName}>{displayName}</div>
            <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
              <div className="font-sans text-[11px] leading-tight truncate opacity-60" title={displayHandle}>{displayHandle}</div>
              <div className="shrink-0 font-sans text-[10px] tracking-[0.14em] uppercase text-[#FF3B30] font-semibold">{formatFollowers(followerCount)}</div>
            </div>
          </div>
          <div className="font-sans text-[9px] tracking-[0.12em] uppercase opacity-50 leading-relaxed">
            <span className="block truncate">{niches.join(" · ") || c.category || "Influencer"}</span>
            {city ? <span className="block truncate mt-0.5">{city}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[9px] uppercase tracking-widest text-white/45 pt-0.5">
            {er != null && Number.isFinite(er) ? <span className="text-[#34C759]/90">{er.toFixed(1)}% ER</span> : null}
            {rate != null ? <span>From ₹{rate.toLocaleString()}</span> : null}
            {kpis.avg_reach != null ? <span>Reach {formatCompact(kpis.avg_reach)}</span> : null}
            {kpis.avg_roas != null ? <span className="text-white/60">{kpis.avg_roas}x ROAS</span> : null}
          </div>
        </div>
      </Link>
      <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-1.5">
        <Link to={`/creators/${c.id}`} className="text-center px-1.5 py-2 rounded-full border border-white/15 text-[8px] uppercase tracking-widest hover:border-white/30">
          View
        </Link>
        <button
          type="button"
          onClick={() => onWishlist?.(c)}
          className="text-center px-1.5 py-2 rounded-full border border-white/15 text-[8px] uppercase tracking-widest inline-flex items-center justify-center gap-0.5 hover:border-white/30"
        >
          <Heart className={`w-2.5 h-2.5 shrink-0 ${c.wishlisted ? "fill-[#FF3B30] text-[#FF3B30]" : ""}`} /> Wishlist
        </button>
        {onSelect ? (
          <button
            type="button"
            onClick={() => onSelect(c)}
            className={`text-center px-1.5 py-2 rounded-full border text-[8px] uppercase tracking-widest ${selected ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15 hover:border-white/30"}`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : (
          <Link to={`/creators/${c.id}`} className="text-center px-1.5 py-2 rounded-full border border-[#FF3B30]/50 text-[#FF3B30] text-[8px] uppercase tracking-widest hover:bg-[#FF3B30]/10">
            Hire
          </Link>
        )}
      </div>
      {onSelect ? (
        <Link to={`/creators/${c.id}`} className="mt-1.5 text-center px-1.5 py-1.5 rounded-full border border-[#FF3B30]/40 text-[#FF3B30] text-[8px] uppercase tracking-widest hover:bg-[#FF3B30]/10">
          Hire
        </Link>
      ) : null}
    </motion.div>
  );
}

function BrandDirectoryCard({ brand, onWishlist }) {
  const b = brand;
  const industry = b.industry || b.category || "Brand";
  const location = formatUserLocation(b);
  const status = (b.active_campaigns || 0) > 0 ? "Hiring" : (b.previous_campaigns || 0) > 0 ? "Past campaigns" : "Open to collab";

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col min-h-[17rem]" data-testid={`brand-${b.id}`}>
      <Link to={`/brands/${b.id}`} className="flex gap-3 min-w-0">
        {b.avatar ? (
          <img src={b.avatar} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center font-bold shrink-0">
            {(b.company || b.name || "?")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-sans font-semibold leading-snug break-words hover:italic">{b.company || b.name}</h3>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/45 mt-1 leading-relaxed break-words">
            {industry}
          </p>
          {location ? (
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/35 mt-0.5 leading-relaxed break-words">
              {location}
            </p>
          ) : null}
        </div>
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <span className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
          (b.active_campaigns || 0) > 0
            ? "border-[#34C759]/40 text-[#34C759]"
            : "border-white/15 text-white/50"
        }`}>
          {status}
        </span>
        {b.rating != null ? (
          <span className="font-mono text-[8px] uppercase tracking-widest text-white/45">★ {Number(b.rating).toFixed(1)}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center">
        <div>
          <div className="font-bold text-sm tabular-nums">{b.active_campaigns || 0}</div>
          <div className="font-mono text-[8px] uppercase text-white/40 leading-tight mt-0.5">Active</div>
        </div>
        <div>
          <div className="font-bold text-sm tabular-nums">{b.previous_campaigns || 0}</div>
          <div className="font-mono text-[8px] uppercase text-white/40 leading-tight mt-0.5">Past</div>
        </div>
        <div>
          <div className="font-bold text-sm tabular-nums">{b.creators_hired || 0}</div>
          <div className="font-mono text-[8px] uppercase text-white/40 leading-tight mt-0.5">Hired</div>
        </div>
        <div>
          <div className="font-bold text-sm tabular-nums truncate px-0.5">
            {b.avg_budget != null ? `₹${formatCompact(b.avg_budget)}` : "—"}
          </div>
          <div className="font-mono text-[8px] uppercase text-white/40 leading-tight mt-0.5">Avg budget</div>
        </div>
      </div>

      {b.bio ? (
        <p className="mt-3 font-sans text-xs text-white/55 leading-snug line-clamp-2">{b.bio}</p>
      ) : null}

      <div className="mt-auto pt-4 flex flex-wrap gap-2">
        <Link to={`/brands/${b.id}`} className="px-3 py-1.5 rounded-full border border-white/15 text-[9px] uppercase tracking-widest hover:border-white/30">
          View
        </Link>
        <button
          type="button"
          onClick={() => onWishlist?.(b)}
          className="px-3 py-1.5 rounded-full border border-white/15 text-[9px] uppercase tracking-widest inline-flex items-center gap-1 hover:border-white/30"
        >
          <Heart className={`w-3 h-3 ${b.wishlisted ? "fill-[#FF3B30] text-[#FF3B30]" : ""}`} /> Wishlist
        </button>
        <Link to={`/brands/${b.id}`} className="px-3 py-1.5 rounded-full border border-[#FF3B30]/40 text-[#FF3B30] text-[9px] uppercase tracking-widest hover:bg-[#FF3B30]/10">
          Collaborate
        </Link>
      </div>
    </article>
  );
}

const emptyCreatorFilters = () => ({
  categories: [],
  country: "India",
  state: "",
  city: "",
  followers_min: "",
  followers_max: "",
  engagement_min: "",
  engagement_max: "",
  price_min: "",
  price_max: "",
  sort: "engagement",
});

const emptyBrandFilters = () => ({
  industry: "",
  city: "",
  state: "",
  country: "",
  sort: "newest",
});

function FilterField({ label, children }) {
  return (
    <div className="min-w-0">
      <label className="font-mono text-[8px] uppercase tracking-widest text-white/45 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const filterInputClass =
  "w-full bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5 text-sm text-[var(--fg)] focus:outline-none focus:border-[#FF3B30]/50";

export default function Marketplace() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab = ["creators", "campaigns", "brands", "hire"].includes(tabParam) ? tabParam : "creators";

  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [production, setProduction] = useState([]);
  const [prodCategories, setProdCategories] = useState([]);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(emptyCreatorFilters);
  const [draftFilters, setDraftFilters] = useState(emptyCreatorFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandFilters, setBrandFilters] = useState(emptyBrandFilters);
  const [brandDraft, setBrandDraft] = useState(emptyBrandFilters);
  const [brandFiltersOpen, setBrandFiltersOpen] = useState(false);
  const [prodCategory, setProdCategory] = useState("");
  const [prodSort, setProdSort] = useState("rating");
  const [prodCity, setProdCity] = useState("");
  const [prodInHouse, setProdInHouse] = useState("");
  const [prodPriceMin, setProdPriceMin] = useState("");
  const [prodPriceMax, setProdPriceMax] = useState("");
  const [selected, setSelected] = useState([]);
  const [comboCampaign, setComboCampaign] = useState("");
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [paySummary, setPaySummary] = useState(null);
  const isBrand = user?.role === "owner" || user?.role === "agent" || user?.role === "admin";

  // Lock URL to a single marketplace mode — no cross-category tabs
  useEffect(() => {
    if (!tabParam || !["creators", "campaigns", "brands", "hire"].includes(tabParam)) {
      setParams((prev) => {
        const n = new URLSearchParams(prev);
        n.set("tab", "creators");
        return n;
      }, { replace: true });
    }
  }, [tabParam, setParams]);

  const loadCreators = useCallback(async () => {
    try {
      const body = {
        q: q || undefined,
        categories: filters.categories,
        country: filters.country || undefined,
        state: filters.state || undefined,
        city: filters.city || undefined,
        followers_min: filters.followers_min ? Number(filters.followers_min) : undefined,
        followers_max: filters.followers_max ? Number(filters.followers_max) : undefined,
        engagement_min: filters.engagement_min ? Number(filters.engagement_min) : undefined,
        engagement_max: filters.engagement_max ? Number(filters.engagement_max) : undefined,
        price_min: filters.price_min ? Number(filters.price_min) : undefined,
        price_max: filters.price_max ? Number(filters.price_max) : undefined,
        sort: filters.sort || "engagement",
        page: 1,
        limit: 48,
      };
      const { data } = await api.post("/marketplace/creators", body);
      setCreators(data.creators || []);
      setTotal(data.total || 0);
    } catch {
      const { data } = await api.get("/creators", {
        params: {
          q: q || undefined,
          niche: filters.categories.length === 1 ? filters.categories[0] : undefined,
          city: filters.city || undefined,
          state: filters.state || undefined,
          followers_min: filters.followers_min || undefined,
          followers_max: filters.followers_max || undefined,
          engagement_min: filters.engagement_min || undefined,
          engagement_max: filters.engagement_max || undefined,
          price_min: filters.price_min || undefined,
          price_max: filters.price_max || undefined,
          sort: filters.sort || undefined,
        },
      });
      setCreators(Array.isArray(data) ? data : []);
      setTotal(Array.isArray(data) ? data.length : 0);
    }
  }, [q, filters]);

  const loadCampaigns = useCallback(async () => {
    const { data } = await api.get("/campaigns", { params: { q: q || undefined } });
    setCampaigns(Array.isArray(data) ? data : []);
  }, [q]);

  const loadBrands = useCallback(async () => {
    const { data } = await api.post("/marketplace/brands", {
      q: q || undefined,
      industry: brandFilters.industry || undefined,
      city: brandFilters.city || undefined,
      state: brandFilters.state || undefined,
      country: brandFilters.country || undefined,
      sort: brandFilters.sort || "newest",
      page: 1,
      limit: 48,
    });
    setBrands(data.brands || []);
  }, [q, brandFilters]);

  const loadProduction = useCallback(async () => {
    const { data } = await api.get("/marketplace/production", {
      params: {
        q: q || undefined,
        category: prodCategory || undefined,
        city: prodCity || undefined,
        price_min: prodPriceMin || undefined,
        price_max: prodPriceMax || undefined,
        in_house_only: prodInHouse === "yes" ? true : undefined,
        sort: prodSort,
        limit: 48,
      },
    });
    setProduction(data.members || []);
  }, [q, prodCategory, prodSort, prodCity, prodInHouse, prodPriceMin, prodPriceMax]);

  useEffect(() => {
    if (tab === "creators") loadCreators();
    else if (tab === "campaigns") loadCampaigns();
    else if (tab === "brands") loadBrands();
    else if (tab === "hire") loadProduction();
  }, [tab, loadCreators, loadCampaigns, loadBrands, loadProduction]);

  useEffect(() => {
    api.get("/marketplace/production/categories").then(({ data }) => {
      setProdCategories(data.categories || []);
    }).catch(() => {});
    if (isBrand) {
      api.get("/campaigns?mine=true").then(({ data }) => {
        setMyCampaigns(Array.isArray(data) ? data.filter((c) => c.status === "open" || c.status === "in_progress") : []);
      }).catch(() => setMyCampaigns([]));
    }
    if (user?.role === "owner") {
      api.get("/analytics/owner").then(({ data }) => setPaySummary(data)).catch(() => setPaySummary(null));
    }
  }, [isBrand, user?.role]);

  useEffect(() => {
    if (filtersOpen) setDraftFilters({ ...filters });
  }, [filtersOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (brandFiltersOpen) setBrandDraft({ ...brandFilters });
  }, [brandFiltersOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => {
    e.preventDefault();
    if (tab === "creators") loadCreators();
    else if (tab === "campaigns") loadCampaigns();
    else if (tab === "brands") loadBrands();
    else if (tab === "hire") loadProduction();
  };

  const toggleWishlist = async (item, targetType) => {
    try {
      const { data } = await api.post("/wishlist", {
        target_id: item.id,
        target_type: targetType,
        action: "toggle",
      });
      toast.success(data.wishlisted ? "Saved to wishlist" : "Removed");
      if (targetType === "influencer") {
        setCreators((prev) => prev.map((x) => (x.id === item.id ? { ...x, wishlisted: data.wishlisted } : x)));
      } else if (targetType === "brand") {
        setBrands((prev) => prev.map((x) => (x.id === item.id ? { ...x, wishlisted: data.wishlisted } : x)));
      } else {
        setProduction((prev) => prev.map((x) => (x.id === item.id ? { ...x, wishlisted: data.wishlisted } : x)));
      }
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Wishlist update failed");
    }
  };

  const toggleSelect = (c) => {
    setSelected((prev) => {
      if (prev.find((x) => x.id === c.id)) return prev.filter((x) => x.id !== c.id);
      if (prev.length >= 10) {
        toast.error("Select up to 10 creators");
        return prev;
      }
      return [...prev, c];
    });
  };

  const estimatedCost = selected.reduce((sum, c) => sum + (Number(c.base_rate) || 0), 0);

  const sendCombo = async () => {
    if (!comboCampaign) {
      toast.error("Pick a campaign");
      return;
    }
    if (![5, 10].includes(selected.length) && selected.length < 2) {
      toast.error("Select at least 2 creators (5 or 10 recommended)");
      return;
    }
    try {
      await api.post("/marketplace/combo-invite", {
        campaign_id: comboCampaign,
        creator_ids: selected.map((s) => s.id),
      });
      toast.success("Group invite sent");
      setSelected([]);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Combo invite failed");
    }
  };

  const applyCreatorFilters = () => {
    setFilters({ ...draftFilters, sort: filters.sort });
    setFiltersOpen(false);
  };

  const resetCreatorFilters = () => {
    const empty = emptyCreatorFilters();
    empty.sort = filters.sort;
    setDraftFilters(empty);
    setFilters(empty);
    setFiltersOpen(false);
  };

  const applyBrandFilters = () => {
    setBrandFilters({ ...brandDraft, sort: brandFilters.sort });
    setBrandFiltersOpen(false);
  };

  const resetBrandFilters = () => {
    const empty = emptyBrandFilters();
    empty.sort = brandFilters.sort;
    setBrandDraft(empty);
    setBrandFilters(empty);
    setBrandFiltersOpen(false);
  };

  const activeCreatorChips = useMemo(() => {
    const chips = [];
    (filters.categories || []).forEach((c) => chips.push({ key: `cat-${c}`, label: c, clear: () => setFilters((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) })) }));
    if (filters.city) chips.push({ key: "city", label: filters.city, clear: () => setFilters((f) => ({ ...f, city: "" })) });
    if (filters.state) chips.push({ key: "state", label: filters.state, clear: () => setFilters((f) => ({ ...f, state: "" })) });
    if (filters.followers_min || filters.followers_max) {
      const a = filters.followers_min ? formatFollowers(filters.followers_min) : "0";
      const b = filters.followers_max ? formatFollowers(filters.followers_max) : "∞";
      chips.push({ key: "followers", label: `${a}–${b} Followers`, clear: () => setFilters((f) => ({ ...f, followers_min: "", followers_max: "" })) });
    }
    if (filters.engagement_min) {
      chips.push({ key: "er", label: `>${filters.engagement_min}% ER`, clear: () => setFilters((f) => ({ ...f, engagement_min: "", engagement_max: "" })) });
    }
    if (filters.price_min || filters.price_max) {
      chips.push({
        key: "price",
        label: `₹${filters.price_min || "0"}–${filters.price_max || "∞"}`,
        clear: () => setFilters((f) => ({ ...f, price_min: "", price_max: "" })),
      });
    }
    return chips;
  }, [filters]);

  const pageTitle =
    tab === "campaigns" ? "Campaigns" : tab === "brands" ? "Brands" : tab === "hire" ? "Hire / Production" : "Influencers";
  const pageCount =
    tab === "creators" ? total || creators.length
      : tab === "campaigns" ? campaigns.length
        : tab === "brands" ? brands.length
          : production.length;

  const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || "Highest Engagement";
  const brandSortLabel = BRAND_SORT.find((o) => o.value === brandFilters.sort)?.label || "Newest";

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] flex flex-col pt-2 pb-24 min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-white/10 pb-3 mb-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
            <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Marketplace
          </p>
          <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-1">
            {pageTitle}
            <span className="ml-2 font-sans text-base font-normal opacity-40 tabular-nums">{pageCount}</span>
          </h1>
        </div>
      </div>

      {/* Influencers: payment strip for brand accounts */}
      {tab === "creators" && isBrand && paySummary ? (
        <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 flex flex-wrap gap-x-5 gap-y-2 items-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] font-bold">Creator payments</span>
          <span className="font-sans text-xs opacity-70">
            Pending <strong className="text-white">₹{Number(paySummary.pending_payments ?? paySummary.escrow_held ?? 0).toLocaleString()}</strong>
            {paySummary.pending_payments_count != null ? (
              <span className="opacity-50"> · {paySummary.pending_payments_count} open</span>
            ) : null}
          </span>
          <span className="font-sans text-xs opacity-70">
            Paid <strong className="text-white">₹{Number(paySummary.paid_to_creators ?? 0).toLocaleString()}</strong>
          </span>
          <span className="font-sans text-xs opacity-70">
            Total spend <strong className="text-white">₹{Number(paySummary.total_spend ?? paySummary.paid_to_creators ?? 0).toLocaleString()}</strong>
          </span>
          <Link to="/billing" className="ml-auto font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] hover:underline">
            Billing →
          </Link>
        </div>
      ) : null}

      {/* Toolbar — Filters | Sort | Search (no mixed category tabs) */}
      <div className="mb-3 rounded-2xl border border-white/15 px-3 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        {tab === "creators" ? (
          <>
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-full text-[9px] uppercase tracking-widest shrink-0 ${
                    filtersOpen || activeCreatorChips.length ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/20"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                  {activeCreatorChips.length ? ` · ${activeCreatorChips.length}` : ""}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[min(calc(100vw-1.5rem),22rem)] sm:w-[26rem] max-h-[min(70vh,32rem)] overflow-y-auto bg-[#121212] border-white/15 text-[#F4F4F0] p-4 z-[100]"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] mb-2">Content</p>
                    <MultiSelectDropdown
                      options={PLATFORM_CATEGORIES}
                      selected={draftFilters.categories}
                      onChange={(categories) => setDraftFilters((f) => ({ ...f, categories }))}
                      placeholder="All categories"
                      allowAll
                      compact
                      label="Category / Niche"
                    />
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] mb-2">Audience</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FilterField label="Min followers">
                        <input type="number" value={draftFilters.followers_min} onChange={(e) => setDraftFilters((f) => ({ ...f, followers_min: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                      <FilterField label="Max followers">
                        <input type="number" value={draftFilters.followers_max} onChange={(e) => setDraftFilters((f) => ({ ...f, followers_max: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                      <FilterField label="Min engagement %">
                        <input type="number" value={draftFilters.engagement_min} onChange={(e) => setDraftFilters((f) => ({ ...f, engagement_min: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                      <FilterField label="Max engagement %">
                        <input type="number" value={draftFilters.engagement_max} onChange={(e) => setDraftFilters((f) => ({ ...f, engagement_max: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] mb-2">Pricing</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FilterField label="Min price ₹">
                        <input type="number" value={draftFilters.price_min} onChange={(e) => setDraftFilters((f) => ({ ...f, price_min: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                      <FilterField label="Max price ₹">
                        <input type="number" value={draftFilters.price_max} onChange={(e) => setDraftFilters((f) => ({ ...f, price_max: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] mb-2">Location</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <FilterField label="Country">
                        <input value={draftFilters.country} onChange={(e) => setDraftFilters((f) => ({ ...f, country: e.target.value }))} className={filterInputClass} />
                      </FilterField>
                      <FilterField label="State">
                        <select value={draftFilters.state} onChange={(e) => setDraftFilters((f) => ({ ...f, state: e.target.value }))} className={filterInputClass}>
                          <option value="">Any</option>
                          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </FilterField>
                      <FilterField label="City">
                        <select value={draftFilters.city} onChange={(e) => setDraftFilters((f) => ({ ...f, city: e.target.value }))} className={filterInputClass}>
                          <option value="">Any</option>
                          {CITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </FilterField>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={applyCreatorFilters} className="px-4 py-2 rounded-full bg-[#FF3B30] text-white font-mono text-[10px] uppercase tracking-widest font-bold">
                      Apply Filters
                    </button>
                    <button type="button" onClick={resetCreatorFilters} className="px-4 py-2 rounded-full border border-white/15 font-mono text-[10px] uppercase tracking-widest">
                      Reset
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1.5 shrink-0 min-w-0">
              <span className="font-mono text-[8px] uppercase tracking-widest text-white/40 hidden sm:inline">Sort by</span>
              <select
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
                aria-label="Sort by"
                className="bg-white/5 border border-white/15 rounded-full px-3 py-2 text-[11px] text-[var(--fg)] max-w-[11rem] sm:max-w-[14rem] focus:outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <span className="hidden md:inline font-mono text-[9px] uppercase tracking-widest text-white/35 truncate max-w-[12rem]">
              {sortLabel}
            </span>
          </>
        ) : null}

        {tab === "brands" ? (
          <>
            <Popover open={brandFiltersOpen} onOpenChange={setBrandFiltersOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-full text-[9px] uppercase tracking-widest shrink-0 ${
                    brandFiltersOpen || brandFilters.industry || brandFilters.city || brandFilters.state
                      ? "border-[#FF3B30] text-[#FF3B30]"
                      : "border-white/20"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={8}
                className="w-[min(calc(100vw-1.5rem),20rem)] max-h-[min(70vh,28rem)] overflow-y-auto bg-[#121212] border-white/15 text-[#F4F4F0] p-4 z-[100]"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="space-y-3">
                  <FilterField label="Industry">
                    <input value={brandDraft.industry} onChange={(e) => setBrandDraft((f) => ({ ...f, industry: e.target.value }))} placeholder="e.g. Travel" className={filterInputClass} />
                  </FilterField>
                  <FilterField label="Country">
                    <input value={brandDraft.country} onChange={(e) => setBrandDraft((f) => ({ ...f, country: e.target.value }))} className={filterInputClass} />
                  </FilterField>
                  <FilterField label="State">
                    <select value={brandDraft.state} onChange={(e) => setBrandDraft((f) => ({ ...f, state: e.target.value }))} className={filterInputClass}>
                      <option value="">Any</option>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FilterField>
                  <FilterField label="City">
                    <select value={brandDraft.city} onChange={(e) => setBrandDraft((f) => ({ ...f, city: e.target.value }))} className={filterInputClass}>
                      <option value="">Any</option>
                      {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FilterField>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={applyBrandFilters} className="px-4 py-2 rounded-full bg-[#FF3B30] text-white font-mono text-[10px] uppercase tracking-widest font-bold">Apply Filters</button>
                    <button type="button" onClick={resetBrandFilters} className="px-4 py-2 rounded-full border border-white/15 font-mono text-[10px] uppercase tracking-widest">Reset</button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono text-[8px] uppercase tracking-widest text-white/40 hidden sm:inline">Sort by</span>
              <select
                value={brandFilters.sort}
                onChange={(e) => setBrandFilters((f) => ({ ...f, sort: e.target.value }))}
                className="bg-white/5 border border-white/15 rounded-full px-3 py-2 text-[11px] text-[var(--fg)] max-w-[12rem] focus:outline-none"
              >
                {BRAND_SORT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <span className="hidden md:inline font-mono text-[9px] uppercase tracking-widest text-white/35">{brandSortLabel}</span>
          </>
        ) : null}

        <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[10rem] sm:min-w-[14rem] sm:ml-auto">
          <div className="flex items-center gap-2 border-b border-white/20 py-1.5 pl-1.5 pr-2 flex-1 min-w-0">
            <AiIcon name="search" className="w-4 h-4 opacity-70 shrink-0" />
            <input
              data-testid="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-transparent focus:outline-none w-full min-w-0 font-sans text-sm"
              placeholder="Search…"
              aria-label="Search"
            />
          </div>
          <IconTip label="Search">
            <button type="submit" className="inline-flex items-center justify-center w-9 h-9 border border-white/20 bg-white/5 hover:bg-white/15 rounded-full shrink-0" data-testid="search-submit" title="Search" aria-label="Search">
              <AiIcon name="search" className="w-4 h-4" />
            </button>
          </IconTip>
        </form>
      </div>

      {tab === "creators" && activeCreatorChips.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {activeCreatorChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.04] text-[10px] font-sans hover:border-[#FF3B30]/50"
            >
              {chip.label} <X className="w-3 h-3 opacity-50" />
            </button>
          ))}
        </div>
      ) : null}

      {tab === "creators" && isBrand && selected.length > 0 ? (
        <div className="mb-4 sticky top-2 z-20 rounded-2xl border border-[#FF3B30]/40 bg-[#121212]/95 backdrop-blur p-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">
            Campaign Creator Group · {selected.length} selected · est. ₹{estimatedCost.toLocaleString()}
          </span>
          <select value={comboCampaign} onChange={(e) => setComboCampaign(e.target.value)} className="bg-black/40 border border-white/15 rounded-xl px-2 py-1.5 text-sm text-[var(--fg)] min-w-[10rem]">
            <option value="">Select campaign</option>
            {myCampaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button type="button" onClick={() => setSelected((s) => s.slice(0, 5))} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Use 5</button>
          <button type="button" onClick={() => setSelected((s) => s.slice(0, 10))} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Use 10</button>
          <button type="button" onClick={sendCombo} className="px-3 py-1.5 rounded-full bg-[#FF3B30] text-white font-mono text-[9px] uppercase tracking-widest font-bold">Invite group</button>
          <button type="button" onClick={() => setSelected([])} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Clear</button>
        </div>
      ) : null}

      {tab === "hire" ? (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={() => setProdCategory("")} className={`px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-widest ${!prodCategory ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}>All</button>
            {prodCategories.map((c) => (
              <button key={c.id} type="button" onClick={() => setProdCategory(c.id)} className={`px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-widest ${prodCategory === c.id ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={prodCity} onChange={(e) => setProdCity(e.target.value)} className="bg-white/5 border border-white/15 rounded-xl px-2 py-1.5 text-sm text-[var(--fg)]">
              <option value="">Any city</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={prodInHouse} onChange={(e) => setProdInHouse(e.target.value)} className="bg-white/5 border border-white/15 rounded-xl px-2 py-1.5 text-sm text-[var(--fg)]">
              <option value="">In-house + External</option>
              <option value="yes">In-House only</option>
            </select>
            <input type="number" value={prodPriceMin} onChange={(e) => setProdPriceMin(e.target.value)} placeholder="Min ₹" className="w-24 bg-white/5 border border-white/15 rounded-xl px-2 py-1.5 text-sm text-[var(--fg)]" />
            <input type="number" value={prodPriceMax} onChange={(e) => setProdPriceMax(e.target.value)} placeholder="Max ₹" className="w-24 bg-white/5 border border-white/15 rounded-xl px-2 py-1.5 text-sm text-[var(--fg)]" />
            <select value={prodSort} onChange={(e) => setProdSort(e.target.value)} className="bg-white/5 border border-white/15 rounded-xl px-2 py-1.5 text-sm text-[var(--fg)]">
              {PROD_SORT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" onClick={loadProduction} className="px-3 py-1.5 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Apply</button>
          </div>
        </div>
      ) : null}

      {tab === "creators" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-6">
          {creators.map((c, i) => (
            <CreatorDirectoryCard
              key={c.id}
              creator={c}
              index={i}
              selected={!!selected.find((x) => x.id === c.id)}
              onSelect={isBrand ? toggleSelect : undefined}
              onWishlist={(x) => toggleWishlist(x, "influencer")}
            />
          ))}
          {creators.length === 0 && (
            <div className="col-span-full py-16 text-center font-sans italic text-2xl opacity-60">No influencers match these filters.</div>
          )}
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <div className="space-y-2">
          {campaigns.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: Math.min(i, 10) * 0.03 }} data-testid={`campaign-row-${c.id}`}>
              <Link to={`/campaigns/${c.id}`} className="group block border border-white/10 hover:border-[#FF3B30]/40 rounded-2xl px-4 py-4 md:px-5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="grid grid-cols-12 gap-3 md:gap-4 items-center">
                  <div className="col-span-12 md:col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-50">{String(i + 1).padStart(2, "0")}</div>
                  <div className="col-span-12 md:col-span-5 min-w-0">
                    <div className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-50 truncate">{c.brand || "Brand"}</div>
                    <div className="font-sans text-lg md:text-xl font-semibold leading-tight mt-0.5 truncate group-hover:text-[#FF3B30] transition-colors">{c.title}</div>
                  </div>
                  <div className="col-span-12 sm:col-span-6 md:col-span-3 font-sans text-[10px] tracking-[0.16em] uppercase opacity-70 truncate">{(c.niches || []).slice(0, 3).join(" · ") || c.category || "General"}</div>
                  <div className="col-span-6 sm:col-span-3 md:col-span-2 font-sans text-lg font-bold text-[#34C759]">₹{Number(c.budget || 0).toLocaleString()}</div>
                  <div className="col-span-6 sm:col-span-3 md:col-span-1 text-right font-sans text-[10px] tracking-[0.2em] uppercase text-[#FF3B30]">View →</div>
                </div>
              </Link>
            </motion.div>
          ))}
          {campaigns.length === 0 && <div className="py-24 text-center font-sans italic text-3xl opacity-60">No briefs on file.</div>}
        </div>
      ) : null}

      {tab === "brands" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => (
            <BrandDirectoryCard key={b.id} brand={b} onWishlist={(x) => toggleWishlist(x, "brand")} />
          ))}
          {brands.length === 0 && <div className="col-span-full py-16 text-center font-sans italic text-2xl opacity-60">No brands found.</div>}
        </div>
      ) : null}

      {tab === "hire" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {production.map((m) => (
            <article key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid={`production-${m.id}`}>
              <Link to={`/production/${m.id}`} className="flex gap-3">
                {m.avatar ? <img src={m.avatar} alt="" className="w-14 h-14 rounded-xl object-cover" /> : (
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center font-bold">{(m.name || "?")[0]}</div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {m.in_house ? <span className="font-mono text-[8px] uppercase tracking-widest text-[#34C759]">In-House</span> : null}
                    <span className="font-mono text-[8px] uppercase tracking-widest text-[#FF3B30]">{m.production_category_label}</span>
                  </div>
                  <h3 className="font-sans font-semibold truncate hover:italic">{m.name}</h3>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 truncate">
                    {m.production_role}{formatUserLocation(m) ? ` · ${formatUserLocation(m)}` : ""}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between mt-3 font-mono text-[9px] uppercase tracking-widest text-white/45">
                <span>{m.base_rate != null ? `₹${Number(m.base_rate).toLocaleString()}` : "Quote"}</span>
                <span>{m.rating != null ? `★ ${m.rating}` : "—"}</span>
                <span>{m.availability || "—"}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link to={`/production/${m.id}`} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">View</Link>
                <button type="button" onClick={() => toggleWishlist(m, "production")} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Wishlist</button>
                <Link to={`/production/${m.id}`} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">Hire</Link>
              </div>
            </article>
          ))}
          {production.length === 0 && <div className="col-span-full py-16 text-center font-sans italic text-2xl opacity-60">No production talent found.</div>}
        </div>
      ) : null}
    </div>
  );
}
