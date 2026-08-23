import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Filter, List, Map as MapIcon, Search, X, MapPin, Loader2, SlidersHorizontal,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import "@/pages/CampaignDiscoveryMap.css";

const BUDGET_PRESETS = [
  { id: "1-5", label: "₹1K–₹5K", min: 1000, max: 5000 },
  { id: "5-10", label: "₹5K–₹10K", min: 5000, max: 10000 },
  { id: "10-25", label: "₹10K–₹25K", min: 10000, max: 25000 },
  { id: "25-50", label: "₹25K–₹50K", min: 25000, max: 50000 },
  { id: "50-100", label: "₹50K–₹1L", min: 50000, max: 100000 },
  { id: "100+", label: "₹1L+", min: 100000, max: null },
];

const RADIUS_OPTS = [
  { v: 25, label: "25 km" },
  { v: 100, label: "100 km" },
  { v: null, label: "Anywhere" },
];

const PLATFORMS = ["Instagram", "YouTube", "Facebook", "TikTok", "X", "LinkedIn", "Other"];
const CATEGORIES = [
  "Fashion", "Beauty", "Food", "Travel", "Fitness", "Technology",
  "Lifestyle", "Finance", "Education", "Gaming", "Entertainment", "Other",
];
const CAMPAIGN_TYPES = ["Paid", "Product Exchange", "Affiliate", "Hybrid"];
const DEADLINES = [
  { v: "today", label: "Ending Today" },
  { v: "3d", label: "Next 3 Days" },
  { v: "7d", label: "Next 7 Days" },
  { v: "30d", label: "Next 30 Days" },
];
const SORTS = [
  { v: "recommended", label: "Recommended" },
  { v: "highest_match", label: "Highest Match" },
  { v: "highest_budget", label: "Highest Budget" },
  { v: "nearest", label: "Nearest" },
  { v: "ending_soon", label: "Ending Soon" },
  { v: "newest", label: "Newest" },
];

const CITY_COORDS = {
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639],
  pune: [18.5204, 73.8567],
};

const DEFAULT_CENTER = [20.5937, 78.9629];

function clusterCampaigns(list, zoom) {
  if (!list.length) return [];
  const cell = zoom >= 12 ? 0.02 : zoom >= 10 ? 0.05 : zoom >= 8 ? 0.12 : zoom >= 6 ? 0.35 : 0.8;
  const buckets = new Map();
  for (const c of list) {
    const key = `${Math.round(c.latitude / cell)}_${Math.round(c.longitude / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  return Array.from(buckets.values()).map((items) => {
    if (items.length === 1) return { type: "pin", campaign: items[0] };
    const lat = items.reduce((s, x) => s + x.latitude, 0) / items.length;
    const lng = items.reduce((s, x) => s + x.longitude, 0) / items.length;
    return { type: "cluster", count: items.length, lat, lng, items };
  });
}

function fmtDeadline(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

function CampaignCard({ c, onClose, compact }) {
  if (!c) return null;
  return (
    <div className={`cdm-card ${compact ? "cdm-card--compact" : ""}`} data-testid="campaign-map-card">
      <div className="cdm-card__media">
        {c.campaign_image ? (
          <img src={c.campaign_image} alt="" />
        ) : (
          <div className="cdm-card__media-fallback">{(c.brand || "C")[0]}</div>
        )}
        {c.brand_logo ? <img src={c.brand_logo} alt="" className="cdm-card__logo" /> : null}
        {onClose ? (
          <button type="button" className="cdm-card__close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      <div className="cdm-card__body">
        <div className="cdm-card__top">
          <div className="min-w-0">
            <p className="cdm-card__brand">{c.brand}</p>
            <h3 className="cdm-card__title">{c.name}</h3>
          </div>
          {c.match_score != null ? (
            <span className="cdm-card__match">{c.match_score}% Match</span>
          ) : null}
        </div>
        <div className="cdm-card__meta">
          <span><MapPin className="w-3 h-3 inline" /> {c.location}</span>
          {c.distance_km != null ? <span>· {c.distance_km} km</span> : null}
          {c.category ? <span>· {c.category}</span> : null}
        </div>
        <p className="cdm-card__budget">{c.budget_label || c.budget_display}</p>
        <p className="cdm-card__details">
          {(c.platforms || []).map((p) => String(p)).join(" · ") || "—"}
          {c.deliverables ? ` · ${c.deliverables}` : ""}
          {c.required_creators ? ` · ${c.required_creators} creators` : ""}
        </p>
        {c.deadline ? (
          <p className="cdm-card__deadline">Apply before {fmtDeadline(c.deadline)}</p>
        ) : null}
        <div className="cdm-card__actions">
          <Link to={`/campaigns/${c.id}`} className="cdm-btn cdm-btn--primary">
            View Campaign
          </Link>
          <Link to={`/campaigns/${c.id}`} className="cdm-btn cdm-btn--ghost">
            Apply Now
          </Link>
        </div>
      </div>
    </div>
  );
}

const emptyFilters = () => ({
  radius: 100, // default local discovery from profile city; switch to Anywhere for all India
  budgetPreset: null,
  min_budget: "",
  max_budget: "",
  platform: "",
  category: "",
  campaign_type: "",
  creator_type: "",
  min_followers: "",
  deadline: "",
  payment_type: "",
});

export default function CampaignDiscoveryMap() {
  const { user } = useAuth();
  const nav = useNavigate();
  const mapRef = useRef(null);
  const mapEl = useRef(null);
  const layerRef = useRef(null);
  const savedView = useRef(null);
  const fetchTimer = useRef(null);
  const skipMove = useRef(false);
  const radiusRef = useRef(null);

  const [viewMode, setViewMode] = useState("map"); // map | list
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sort, setSort] = useState("recommended");
  const [filters, setFilters] = useState(emptyFilters);
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(11);
  const [origin, setOrigin] = useState(null);
  const [locQuery, setLocQuery] = useState("");

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) || null,
    [campaigns, selectedId],
  );

  useEffect(() => {
    radiusRef.current = filters.radius;
  }, [filters.radius]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  // Resolve initial center from creator profile
  useEffect(() => {
    const city = (user?.city || user?.location || "").toLowerCase().trim();
    let center = DEFAULT_CENTER;
    if (user?.lat != null && user?.lng != null) {
      center = [Number(user.lat), Number(user.lng)];
    } else if (city && CITY_COORDS[city]) {
      center = CITY_COORDS[city];
    } else {
      for (const [k, v] of Object.entries(CITY_COORDS)) {
        if (city.includes(k)) {
          center = v;
          break;
        }
      }
    }
    setOrigin({ lat: center[0], lng: center[1] });
    if (city) {
      const known = Object.keys(CITY_COORDS).find((k) => city === k || city.includes(k));
      if (known) setLocQuery(known);
    }
  }, [user]);

  const buildParams = useCallback((bounds) => {
    const p = {
      sort,
      page: 1,
      limit: 100,
      search: searchDebounced || undefined,
    };
    if (origin) {
      p.latitude = origin.lat;
      p.longitude = origin.lng;
    }
    if (filters.radius != null) p.radius = filters.radius;
    if (filters.budgetPreset) {
      const bp = BUDGET_PRESETS.find((x) => x.id === filters.budgetPreset);
      if (bp) {
        p.min_budget = bp.min;
        if (bp.max != null) p.max_budget = bp.max;
      }
    } else {
      if (filters.min_budget !== "") p.min_budget = Number(filters.min_budget);
      if (filters.max_budget !== "") p.max_budget = Number(filters.max_budget);
    }
    if (filters.platform) p.platform = filters.platform.toLowerCase();
    if (filters.category) p.category = filters.category.toLowerCase();
    if (filters.campaign_type) p.campaign_type = filters.campaign_type.toLowerCase();
    if (filters.creator_type) p.creator_type = filters.creator_type;
    if (filters.min_followers !== "") p.min_followers = Number(filters.min_followers);
    if (filters.deadline) p.deadline = filters.deadline;
    // Only clip to viewport when a local radius is set (pan = search this area).
    // Anywhere mode must return the full discovery set like the grid.
    if (bounds && filters.radius != null) {
      p.north = bounds.getNorth();
      p.south = bounds.getSouth();
      p.east = bounds.getEast();
      p.west = bounds.getWest();
    }
    return p;
  }, [filters, origin, searchDebounced, sort]);

  const fitMapToCampaigns = useCallback((list) => {
    const map = mapRef.current;
    if (!map || !list?.length) return;
    const pts = list
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => L.latLng(c.latitude, c.longitude));
    if (!pts.length) return;
    skipMove.current = true;
    if (pts.length === 1) {
      map.setView(pts[0], Math.max(map.getZoom(), 6), { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(pts).pad(0.18), { animate: true, maxZoom: 11 });
    }
    setZoom(map.getZoom());
  }, []);

  const fetchCampaigns = useCallback(async (bounds, { fit = false } = {}) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/creator/campaigns/map", { params: buildParams(bounds) });
      const list = Array.isArray(data?.campaigns) ? data.campaigns : [];
      setCampaigns(list);
      setTotal(data?.total ?? 0);
      if (data?.origin && !origin) {
        setOrigin({ lat: data.origin.latitude, lng: data.origin.longitude });
      }
      if (fit && filters.radius == null) {
        // Defer so markers render after state flush
        requestAnimationFrame(() => fitMapToCampaigns(list));
      }
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Could not load campaigns");
      setCampaigns([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildParams, origin, filters.radius, fitMapToCampaigns]);

  const scheduleFetch = useCallback((bounds, opts) => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => fetchCampaigns(bounds, opts), 350);
  }, [fetchCampaigns]);

  // Init map once origin ready
  useEffect(() => {
    if (!origin || !mapEl.current || mapRef.current) return undefined;
    const map = L.map(mapEl.current, {
      center: [origin.lat, origin.lng],
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("moveend", () => {
      if (skipMove.current) {
        skipMove.current = false;
        return;
      }
      setZoom(map.getZoom());
      // Viewport refetch only when searching within a radius
      if (radiusRef.current != null) {
        scheduleFetch(map.getBounds());
      }
    });
    mapRef.current = map;
    scheduleFetch(null, { fit: true });
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [origin, scheduleFetch]);

  // Refetch when filters/search/sort change (keep map position unless Anywhere → fit)
  useEffect(() => {
    if (!mapRef.current) return;
    const bounds = filters.radius != null ? mapRef.current.getBounds() : null;
    scheduleFetch(bounds, { fit: filters.radius == null });
  }, [filters, searchDebounced, sort, scheduleFetch]);

  // List-only fetch without bounds when in list mode
  useEffect(() => {
    if (viewMode !== "list") return;
    fetchCampaigns(null);
  }, [viewMode, filters, searchDebounced, sort, fetchCampaigns]);

  const clusters = useMemo(() => clusterCampaigns(campaigns, zoom), [campaigns, zoom]);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || viewMode !== "map") return;

    layer.clearLayers();

    clusters.forEach((node) => {
      if (node.type === "cluster") {
        const html = `<div class="cdm-bubble cdm-bubble--cluster">${node.count} Campaigns</div>`;
        const icon = L.divIcon({
          className: "cdm-marker",
          html,
          iconSize: [110, 36],
          iconAnchor: [55, 18],
        });
        const m = L.marker([node.lat, node.lng], { icon });
        m.on("click", () => {
          skipMove.current = true;
          map.setView([node.lat, node.lng], Math.min(map.getZoom() + 2, 15));
          setZoom(map.getZoom());
        });
        m.addTo(layer);
        return;
      }
      const c = node.campaign;
      const selected = c.id === selectedId;
      const label = c.budget_display || "View";
      const html = `<div class="cdm-bubble ${selected ? "cdm-bubble--selected" : ""}">${label}</div>`;
      const icon = L.divIcon({
        className: "cdm-marker",
        html,
        iconSize: [Math.max(48, label.length * 9), 32],
        iconAnchor: [Math.max(24, label.length * 4.5), 16],
      });
      const m = L.marker([c.latitude, c.longitude], { icon, zIndexOffset: selected ? 1000 : 0 });
      m.on("click", () => {
        setSelectedId(c.id);
        skipMove.current = true;
        const z = map.getZoom();
        map.panTo([c.latitude, c.longitude], { animate: true });
        // do not zoom
        if (map.getZoom() !== z) map.setZoom(z);
      });
      m.addTo(layer);
    });
  }, [clusters, selectedId, viewMode]);

  const openFilters = () => {
    if (mapRef.current) {
      savedView.current = {
        center: mapRef.current.getCenter(),
        zoom: mapRef.current.getZoom(),
      };
    }
    setFiltersOpen(true);
  };

  const closeFilters = () => {
    setFiltersOpen(false);
    if (mapRef.current && savedView.current) {
      skipMove.current = true;
      mapRef.current.setView(savedView.current.center, savedView.current.zoom, { animate: false });
    }
  };

  const clearFilters = () => {
    setFilters(emptyFilters());
    setSearch("");
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.budgetPreset || filters.min_budget || filters.max_budget) n += 1;
    if (filters.platform) n += 1;
    if (filters.category) n += 1;
    if (filters.campaign_type) n += 1;
    if (filters.creator_type) n += 1;
    if (filters.min_followers) n += 1;
    if (filters.deadline) n += 1;
    if (filters.radius != null) n += 1;
    return n;
  }, [filters]);

  const applyLocationSearch = () => {
    const q = locQuery.trim().toLowerCase();
    if (!q) return;
    let hit = CITY_COORDS[q];
    if (!hit) {
      for (const [k, v] of Object.entries(CITY_COORDS)) {
        if (q.includes(k) || k.includes(q)) {
          hit = v;
          break;
        }
      }
    }
    if (!hit) {
      toast.error("Try a major city (Bangalore, Mumbai, Delhi…)");
      return;
    }
    setOrigin({ lat: hit[0], lng: hit[1] });
    if (mapRef.current) {
      skipMove.current = true;
      mapRef.current.setView(hit, 11);
      const bounds = radiusRef.current != null ? mapRef.current.getBounds() : null;
      scheduleFetch(bounds, { fit: radiusRef.current == null });
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setOrigin({ lat, lng });
        if (mapRef.current) {
          skipMove.current = true;
          mapRef.current.setView([lat, lng], 12);
          const bounds = radiusRef.current != null ? mapRef.current.getBounds() : null;
          scheduleFetch(bounds, { fit: radiusRef.current == null });
        }
      },
      () => toast.error("Could not get your location"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="cdm-root" data-testid="campaign-discovery-map">
      {/* Top bar — fixed within page, does not push map */}
      <div className="cdm-top">
        <div className="cdm-search">
          <Search className="w-4 h-4 opacity-50 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns, brands or categories"
            aria-label="Search campaigns"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        <div className="cdm-loc">
          <MapPin className="w-3.5 h-3.5 text-[#FF3B30] shrink-0" />
          <select
            value={locQuery}
            onChange={(e) => {
              const v = e.target.value;
              setLocQuery(v);
              if (!v) return;
              const hit = CITY_COORDS[v.toLowerCase()];
              if (hit) {
                setOrigin({ lat: hit[0], lng: hit[1] });
                if (mapRef.current) {
                  skipMove.current = true;
                  mapRef.current.setView(hit, 10);
                }
              }
            }}
            aria-label="Campaign city"
            className="cdm-loc-select"
          >
            <option value="">Pick city</option>
            {Object.keys(CITY_COORDS).filter((k) => !["bengaluru"].includes(k)).map((k) => (
              <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
            ))}
          </select>
          <input
            value={locQuery}
            onChange={(e) => setLocQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyLocationSearch()}
            placeholder="Or type city"
            aria-label="Location"
          />
          <button type="button" className="cdm-chip" onClick={applyLocationSearch}>Go</button>
          <button type="button" className="cdm-chip" onClick={useMyLocation}>Near me</button>
        </div>
        <div className="cdm-radius" role="group" aria-label="Search radius">
          {RADIUS_OPTS.map((r) => (
            <button
              key={String(r.v)}
              type="button"
              className={filters.radius === r.v ? "is-on" : ""}
              onClick={() => setFilters((f) => ({ ...f, radius: r.v }))}
              data-testid={`campaign-map-radius-${r.v ?? "anywhere"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="cdm-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "map"}
            className={viewMode === "map" ? "is-active" : ""}
            onClick={() => setViewMode("map")}
          >
            <MapIcon className="w-3.5 h-3.5" /> Map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "list"}
            className={viewMode === "list" ? "is-active" : ""}
            onClick={() => setViewMode("list")}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>
      </div>

      <div className="cdm-stage">
        {/* Map pane — always mounted to preserve position */}
        <div className={`cdm-map-wrap ${viewMode === "list" ? "is-hidden" : ""}`}>
          <div ref={mapEl} className="cdm-map" />
          {loading ? (
            <div className="cdm-loading"><Loader2 className="w-5 h-5 animate-spin" /> Loading campaigns…</div>
          ) : null}
          {!loading && !error && campaigns.length === 0 ? (
            <div className="cdm-empty">
              <p className="font-sans text-base font-semibold">No campaigns found</p>
              <p className="font-sans text-xs opacity-60 mt-1">
                Try increasing your search radius, removing filters, or selecting another category.
              </p>
              <button type="button" className="cdm-btn cdm-btn--primary mt-3" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="cdm-empty">
              <p className="font-sans text-sm text-[#FF3B30]">{error}</p>
              <button
                type="button"
                className="cdm-btn cdm-btn--ghost mt-3"
                onClick={() => fetchCampaigns(radiusRef.current != null && mapRef.current ? mapRef.current.getBounds() : null, { fit: radiusRef.current == null })}
              >
                Retry
              </button>
            </div>
          ) : null}

          {/* Desktop side list */}
          <aside className="cdm-side" aria-label="Campaign list">
            <div className="cdm-side__head">
              <span>{total} campaigns</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="cdm-select"
                aria-label="Sort"
              >
                {SORTS.map((s) => (
                  <option key={s.v} value={s.v}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="cdm-side__list">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cdm-side__item ${selectedId === c.id ? "is-selected" : ""}`}
                  onClick={() => {
                    setSelectedId(c.id);
                    if (mapRef.current) {
                      skipMove.current = true;
                      mapRef.current.panTo([c.latitude, c.longitude]);
                    }
                  }}
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0 text-left">
                      <p className="text-[10px] uppercase tracking-widest text-[#FF3B30] truncate">{c.brand}</p>
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-xs opacity-60 truncate">{c.location} · {c.budget_display}</p>
                    </div>
                    {c.match_score != null ? (
                      <span className="text-[10px] text-[#34C759] shrink-0">{c.match_score}%</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {selected && viewMode === "map" ? (
            <div className="cdm-sheet">
              <CampaignCard c={selected} onClose={() => setSelectedId(null)} />
            </div>
          ) : null}
        </div>

        {/* List mode */}
        {viewMode === "list" ? (
          <div className="cdm-list">
            <div className="cdm-list__toolbar">
              <span className="font-sans text-xs opacity-60">{total} campaigns</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="cdm-select"
                aria-label="Sort list"
              >
                {SORTS.map((s) => (
                  <option key={s.v} value={s.v}>{s.label}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 opacity-60">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="cdm-empty static">
                <p className="font-sans text-base font-semibold">No campaigns found</p>
                <button type="button" className="cdm-btn cdm-btn--primary mt-3" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="cdm-list__grid">
                {campaigns.map((c) => (
                  <CampaignCard key={c.id} c={c} compact />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Fixed bottom filter bar — overlays, never pushes map */}
      <div className="cdm-bottombar">
        <button type="button" className="cdm-bottombar__btn" onClick={openFilters}>
          <SlidersHorizontal className="w-4 h-4" />
          Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
        </button>
        <button
          type="button"
          className="cdm-bottombar__btn"
          onClick={() => setViewMode(viewMode === "map" ? "list" : "map")}
        >
          {viewMode === "map" ? <List className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
          {viewMode === "map" ? "List" : "Map"}
        </button>
        <button
          type="button"
          className="cdm-bottombar__btn"
          onClick={() => nav("/marketplace?tab=campaigns")}
        >
          <Filter className="w-4 h-4" /> All briefs
        </button>
      </div>

      {/* Filter drawer — portal-like overlay; map stays put */}
      {filtersOpen ? (
        <div className="cdm-filters" role="dialog" aria-modal="true" aria-label="Campaign filters">
          <button type="button" className="cdm-filters__backdrop" aria-label="Close filters" onClick={closeFilters} />
          <div className="cdm-filters__panel">
            <div className="cdm-filters__head">
              <h2 className="font-sans text-lg font-bold">Filters</h2>
              <button type="button" onClick={closeFilters} aria-label="Close" className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="cdm-filters__body">
              <section>
                <h3>Radius</h3>
                <div className="cdm-pills">
                  {RADIUS_OPTS.map((r) => (
                    <button
                      key={String(r.v)}
                      type="button"
                      className={filters.radius === r.v ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({ ...f, radius: r.v }))}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>Budget</h3>
                <div className="cdm-pills">
                  {BUDGET_PRESETS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={filters.budgetPreset === b.id ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({
                        ...f,
                        budgetPreset: f.budgetPreset === b.id ? null : b.id,
                        min_budget: "",
                        max_budget: "",
                      }))}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <div className="cdm-row">
                  <input
                    type="number"
                    placeholder="Min ₹"
                    value={filters.min_budget}
                    onChange={(e) => setFilters((f) => ({ ...f, min_budget: e.target.value, budgetPreset: null }))}
                  />
                  <input
                    type="number"
                    placeholder="Max ₹"
                    value={filters.max_budget}
                    onChange={(e) => setFilters((f) => ({ ...f, max_budget: e.target.value, budgetPreset: null }))}
                  />
                </div>
              </section>
              <section>
                <h3>Platform</h3>
                <div className="cdm-pills">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={filters.platform === p ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({ ...f, platform: f.platform === p ? "" : p }))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>Category</h3>
                <div className="cdm-pills">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={filters.category === c ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({ ...f, category: f.category === c ? "" : c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>Campaign type</h3>
                <div className="cdm-pills">
                  {CAMPAIGN_TYPES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={filters.campaign_type === c ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({ ...f, campaign_type: f.campaign_type === c ? "" : c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>Creator type</h3>
                <div className="cdm-pills">
                  {["Nano", "Micro", "Macro", "Mega"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={filters.creator_type === c ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({ ...f, creator_type: f.creator_type === c ? "" : c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3>Minimum followers</h3>
                <input
                  type="number"
                  className="cdm-input"
                  placeholder="e.g. 10000"
                  value={filters.min_followers}
                  onChange={(e) => setFilters((f) => ({ ...f, min_followers: e.target.value }))}
                />
              </section>
              <section>
                <h3>Application deadline</h3>
                <div className="cdm-pills">
                  {DEADLINES.map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      className={filters.deadline === d.v ? "is-on" : ""}
                      onClick={() => setFilters((f) => ({ ...f, deadline: f.deadline === d.v ? "" : d.v }))}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <div className="cdm-filters__foot">
              <button type="button" className="cdm-btn cdm-btn--ghost" onClick={clearFilters}>Clear</button>
              <button type="button" className="cdm-btn cdm-btn--primary" onClick={closeFilters}>Show results</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
