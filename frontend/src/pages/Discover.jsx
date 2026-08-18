import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, SlidersHorizontal, X, Check, GitCompare, FileSearch, ChevronLeft, ChevronRight, MessageSquare,
} from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { ApifyLookupPanel } from "@/components/ApifyLookupPanel";
import { PLATFORM_CATEGORIES } from "@/lib/categories";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatUsername } from "@/lib/username";

const PLATFORMS = ["instagram", "youtube", "facebook", "twitter"];
const TIERS = ["nano", "micro", "mid", "macro", "mega"];
const LANGS = ["Telugu", "Hindi", "Tamil", "Kannada", "English", "Bengali", "Marathi"];
const UNAVAILABLE = "Data unavailable";
const errMsg = (e) => formatApiError(e?.response?.data?.detail);

function fmtNum(n) {
  if (n == null || n === "") return UNAVAILABLE;
  const v = Number(n);
  if (!Number.isFinite(v)) return UNAVAILABLE;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}

function fmtPct(n) {
  if (n == null || n === "") return UNAVAILABLE;
  const v = Number(n);
  if (!Number.isFinite(v)) return UNAVAILABLE;
  return `${v.toFixed(1)}%`;
}

function riskTone(risk) {
  if (risk === "high") return "text-[#FF3B30]";
  if (risk === "medium") return "text-[#FF9500]";
  if (risk === "low") return "text-[#34C759]";
  return "text-white/45";
}

function DiscoverCard({ c, selected, onToggleCompare, onShortlist, onResearch }) {
  const handle = formatUsername(c.handle, c.username, c.name) || "creator";
  return (
    <article className="rounded-2xl border border-white/10 bg-[#121212] overflow-hidden flex flex-col h-full">
      <Link to={`/creators/${c.id}`} className="relative block aspect-[4/3] bg-white/5">
        {c.avatar ? (
          <img src={c.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center font-sans text-3xl opacity-40">
            {(c.name || "?")[0]}
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {(c.platforms || []).slice(0, 2).map((p) => (
            <span key={p} className="theme-keep-dark bg-black/55 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-white/90 rounded-full">
              {p}
            </span>
          ))}
          {c.verified ? (
            <span className="theme-keep-dark bg-[#34C759]/30 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-white rounded-full">Verified</span>
          ) : null}
        </div>
        {c.ai_match_score != null ? (
          <span className="absolute top-2 right-2 bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30 px-2 py-0.5 font-sans text-[10px] uppercase rounded-full">
            {Math.round(c.ai_match_score)} match
          </span>
        ) : null}
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <Link to={`/creators/${c.id}`} className="font-sans text-sm font-semibold truncate block hover:italic">
            {c.name || handle}
          </Link>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 truncate">
            @{String(handle).replace(/^@/, "")} · {c.category || (c.niches || [])[0] || "Creator"} · {c.location || c.city || UNAVAILABLE}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div>
            <div className="font-sans text-xs font-bold tabular-nums">{fmtNum(c.followers)}</div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">Followers</div>
          </div>
          <div>
            <div className="font-sans text-xs font-bold tabular-nums">{fmtPct(c.engagement_rate)}</div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">Engagement</div>
          </div>
          <div>
            <div className="font-sans text-xs font-bold tabular-nums">{c.quality_score != null ? Math.round(c.quality_score) : UNAVAILABLE}</div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-white/40">Quality</div>
          </div>
        </div>
        <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-widest text-white/40">
          <span>Views {fmtNum(c.average_views)}</span>
          <span>Growth {fmtPct(c.growth_30d)}</span>
          <span className={riskTone(c.risk)}>Risk {c.risk || UNAVAILABLE}</span>
        </div>
        <div className="mt-auto flex flex-wrap gap-1">
          <Link to={`/creators/${c.id}`} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest hover:border-[#FF3B30]">
            Profile
          </Link>
          <button type="button" onClick={() => onToggleCompare(c)} className={`px-2 py-1 rounded-full border text-[9px] uppercase tracking-widest ${selected ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}>
            Compare
          </button>
          <button type="button" onClick={() => onShortlist(c)} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">
            Shortlist
          </button>
          <button type="button" onClick={() => onResearch(c)} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest inline-flex items-center gap-1">
            <FileSearch className="w-3 h-3" /> Research
          </button>
        </div>
      </div>
    </article>
  );
}

const emptyFilters = () => ({
  platforms: [],
  categories: [],
  languages: [],
  tiers: [],
  city: "",
  q: "",
  followers_min: "",
  followers_max: "",
  engagement_rate_min: "",
  price_max: "",
  verified: "",
});

export default function Discover() {
  const [filters, setFilters] = useState(emptyFilters);
  const [nl, setNl] = useState("");
  const [creators, setCreators] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [compare, setCompare] = useState([]);
  const [compareRows, setCompareRows] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chat, setChat] = useState("");
  const [messages, setMessages] = useState([]);
  const [note, setNote] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [research, setResearch] = useState(null);
  const [researchOpen, setResearchOpen] = useState(false);

  const payloadFilters = useMemo(() => {
    const f = {};
    if (filters.platforms?.length) f.platforms = filters.platforms;
    if (filters.categories?.length) f.categories = filters.categories;
    if (filters.languages?.length) f.languages = filters.languages;
    if (filters.tiers?.length) f.tiers = filters.tiers;
    if (filters.city) f.city = filters.city;
    if (filters.q) f.q = filters.q;
    if (filters.followers_min) f.followers_min = Number(filters.followers_min);
    if (filters.followers_max) f.followers_max = Number(filters.followers_max);
    if (filters.engagement_rate_min) f.engagement_rate_min = Number(filters.engagement_rate_min);
    if (filters.price_max) f.price_max = Number(filters.price_max);
    if (filters.verified === "yes") f.verified = true;
    if (filters.verified === "no") f.verified = false;
    return f;
  }, [filters]);

  const search = useCallback(async (nextPage = 1, extra = {}) => {
    setLoading(true);
    try {
      const { data } = await api.post("/creators/search", {
        filters: { ...payloadFilters, ...extra.filters },
        campaign_id: campaignId || undefined,
        page: nextPage,
        limit: 24,
        sort: extra.sort || "quality",
      });
      setCreators(data.creators || []);
      setTotal(data.total || 0);
      setPage(nextPage);
      setNote("");
    } catch (e) {
      toast.error(errMsg(e) || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [payloadFilters, campaignId]);

  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    search(1);
  }, [search]);

  useEffect(() => {
    api.get("/campaigns", { params: { mine: true } }).then(({ data }) => {
      setCampaigns(Array.isArray(data) ? data : data?.items || []);
    }).catch(() => {});
  }, []);

  const runNl = async (e) => {
    e?.preventDefault();
    if (!nl.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/creators/ai-search", {
        query: nl.trim(),
        campaign_id: campaignId || undefined,
        page: 1,
        limit: 24,
      });
      setCreators(data.creators || []);
      setTotal(data.total || 0);
      setPage(1);
      setNote(data.llm_note || "");
      if (data.filters) {
        setFilters((prev) => ({
          ...prev,
          platforms: data.filters.platforms || prev.platforms,
          categories: data.filters.categories || prev.categories,
          languages: data.filters.languages || prev.languages,
          city: data.filters.city || data.filters.location || prev.city,
          followers_min: data.filters.followers_min ?? prev.followers_min,
          followers_max: data.filters.followers_max ?? prev.followers_max,
          engagement_rate_min: data.filters.engagement_rate_min ?? prev.engagement_rate_min,
        }));
      }
    } catch (err) {
      toast.error(errMsg(err) || "AI search failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleCompare = (c) => {
    setCompare((prev) => {
      if (prev.find((x) => x.id === c.id)) return prev.filter((x) => x.id !== c.id);
      if (prev.length >= 5) {
        toast.error("Compare up to 5 creators");
        return prev;
      }
      return [...prev, c];
    });
  };

  const shortlist = async (c) => {
    try {
      await api.post("/discover/shortlist", { creator_id: c.id, action: "add" });
      toast.success("Shortlisted");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const openResearch = async (c) => {
    setResearchOpen(true);
    setResearch({ loading: true, name: c.name });
    try {
      const { data } = await api.post(`/creators/${c.id}/deep-research`, {
        campaign_id: campaignId || undefined,
      });
      setResearch(data.report);
    } catch (e) {
      setResearch({ error: errMsg(e) || "Deep Research failed" });
    }
  };

  const runCompare = async () => {
    if (compare.length < 2) return;
    try {
      const { data } = await api.post("/creators/compare", {
        ids: compare.map((c) => c.id),
        campaign_id: campaignId || undefined,
      });
      setCompareRows(data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const sendAssistant = async (e) => {
    e?.preventDefault();
    if (!chat.trim()) return;
    const userMsg = chat.trim();
    setChat("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    try {
      const { data } = await api.post("/discover/assistant", {
        message: userMsg,
        filters: payloadFilters,
        selected_ids: compare.map((c) => c.id),
      });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      if (data.creators) {
        setCreators(data.creators);
        setTotal(data.total || data.creators.length);
      }
      if (data.action === "compare" && data.creators?.length >= 2) {
        setCompare(data.creators.slice(0, 5));
        setCompareRows(null);
      }
      if (data.action === "deep_research" && data.creators?.length) {
        const idx = Math.max(1, data.creator_index || 1) - 1;
        openResearch(data.creators[idx] || data.creators[0]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: errMsg(err) || "Assistant unavailable" }]);
    }
  };

  const pages = Math.max(1, Math.ceil(total / 24));

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] pb-28">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3 mb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
            <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Brand desk
          </p>
          <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Discover Influencers</h1>
          <p className="font-sans text-sm text-white/50 mt-1">Search the flugr catalog. Missing metrics show as Data unavailable — never invented.</p>
        </div>
        <button type="button" onClick={() => setAssistantOpen((v) => !v)} className="btn-pill inline-flex items-center gap-2 text-[10px]">
          <MessageSquare className="w-3.5 h-3.5" /> Assistant
        </button>
      </div>

      <form onSubmit={runNl} className="rounded-2xl border border-white/10 bg-[#121212] p-3 mb-3">
        <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">AI natural-language search</label>
        <div className="flex gap-2 mt-1">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF3B30]" />
            <input
              value={nl}
              onChange={(e) => setNl(e.target.value)}
              placeholder='Find Telugu technology creators in Hyderabad with 20K–500K followers and engagement above 4%.'
              className="w-full bg-transparent border-b border-white/15 pl-9 pr-3 py-2 font-sans text-sm outline-none"
            />
          </div>
          <button type="submit" className="btn-solid text-[10px] px-4">Search</button>
        </div>
        {note ? <p className="mt-2 font-sans text-[11px] text-[#FF9500]">{note}</p> : null}
      </form>

      <div className="mb-3">
        <ApifyLookupPanel compact />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button type="button" onClick={() => setShowFilters((v) => !v)} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest border border-white/15 rounded-full px-3 py-1">
          <SlidersHorizontal className="w-3 h-3" /> Filters
        </button>
        <input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Name or username"
          className="bg-transparent border border-white/15 rounded-full px-3 py-1 font-sans text-xs w-40"
        />
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="bg-[#121212] border border-white/15 rounded-full px-3 py-1 font-sans text-xs"
        >
          <option value="">No campaign brief</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <button type="button" onClick={() => search(1)} className="btn-solid text-[10px] px-3 py-1">
          Apply filters
        </button>
        <button type="button" onClick={() => { setFilters(emptyFilters()); setNl(""); }} className="font-mono text-[10px] uppercase tracking-widest text-white/45">
          Clear all
        </button>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-white/40">
          {loading && creators.length > 0 ? "Refreshing… · " : ""}{total} creators
        </span>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4 rounded-2xl border border-white/10 p-3">
          <MultiSelectDropdown label="Platform" options={PLATFORMS} selected={filters.platforms} onChange={(v) => setFilters((f) => ({ ...f, platforms: v }))} />
          <MultiSelectDropdown label="Category" options={PLATFORM_CATEGORIES} selected={filters.categories} onChange={(v) => setFilters((f) => ({ ...f, categories: v }))} />
          <MultiSelectDropdown label="Language" options={LANGS} selected={filters.languages} onChange={(v) => setFilters((f) => ({ ...f, languages: v }))} />
          <MultiSelectDropdown label="Tier" options={TIERS} selected={filters.tiers} onChange={(v) => setFilters((f) => ({ ...f, tiers: v }))} />
          <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            City
            <input value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            Min followers
            <input value={filters.followers_min} onChange={(e) => setFilters((f) => ({ ...f, followers_min: e.target.value }))} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            Max followers
            <input value={filters.followers_max} onChange={(e) => setFilters((f) => ({ ...f, followers_max: e.target.value }))} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            Min ER %
            <input value={filters.engagement_rate_min} onChange={(e) => setFilters((f) => ({ ...f, engagement_rate_min: e.target.value }))} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            Max rate ₹
            <input value={filters.price_max} onChange={(e) => setFilters((f) => ({ ...f, price_max: e.target.value }))} className="mt-1 w-full bg-transparent border-b border-white/15 py-1 font-sans text-xs" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">
            Verified
            <select value={filters.verified} onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value }))} className="mt-1 w-full bg-[#121212] border-b border-white/15 py-1 font-sans text-xs">
              <option value="">Any</option>
              <option value="yes">Verified</option>
              <option value="no">Unverified</option>
            </select>
          </label>
        </div>
      )}

      {loading && creators.length === 0 ? (
        <div className="py-16 text-center font-mono text-xs tracking-widest uppercase opacity-50">Loading catalog…</div>
      ) : creators.length === 0 ? (
        <div className="py-16 text-center font-sans text-sm text-white/50">No creators match these filters in the flugr catalog.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {creators.map((c) => (
            <DiscoverCard
              key={c.id}
              c={c}
              selected={!!compare.find((x) => x.id === c.id)}
              onToggleCompare={toggleCompare}
              onShortlist={shortlist}
              onResearch={openResearch}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button type="button" disabled={page <= 1} onClick={() => search(page - 1)} className="p-2 border border-white/15 rounded-full disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => search(page + 1)} className="p-2 border border-white/15 rounded-full disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {compare.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(960px,calc(100%-1.5rem))] rounded-2xl border border-white/15 bg-[#121212]/95 backdrop-blur-md p-3 flex flex-wrap items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#FF3B30]" />
          {compare.map((c) => (
            <button key={c.id} type="button" onClick={() => toggleCompare(c)} className="font-sans text-xs border border-white/15 rounded-full px-2 py-0.5">
              {c.name} <X className="inline w-3 h-3" />
            </button>
          ))}
          <button type="button" onClick={runCompare} className="ml-auto btn-solid text-[10px] px-3 py-1">Compare</button>
        </div>
      )}

      {compareRows && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setCompareRows(null)}>
          <div className="bg-[#121212] border border-white/15 rounded-3xl max-w-5xl w-full max-h-[85vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <h2 className="font-sans text-xl font-bold">Compare</h2>
              <button type="button" onClick={() => setCompareRows(null)}><X className="w-5 h-5" /></button>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="font-mono uppercase tracking-widest text-white/40">
                  <th className="p-2">Metric</th>
                  {compareRows.creators.map((c) => (
                    <th key={c.id} className="p-2">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["followers", "engagement_rate", "average_views", "growth_30d", "quality_score", "ai_match_score", "authenticity_score", "base_rate"].map((m) => (
                  <tr key={m} className="border-t border-white/10">
                    <td className="p-2 capitalize text-white/50">{m.replace(/_/g, " ")}</td>
                    {compareRows.creators.map((c) => {
                      const win = compareRows.winners?.[m] === c.id;
                      const val = m.includes("rate") && m !== "base_rate" && m !== "engagement_rate" ? c[m]
                        : m === "engagement_rate" || m === "growth_30d" ? fmtPct(c[m])
                        : m === "base_rate" || m === "followers" || m === "average_views" ? fmtNum(c[m])
                        : c[m] == null ? UNAVAILABLE : c[m];
                      return (
                        <td key={c.id} className={`p-2 ${win ? "text-[#34C759] font-bold" : ""}`}>
                          {win ? <Check className="inline w-3 h-3 mr-1" /> : null}
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {researchOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setResearchOpen(false)}>
          <div className="bg-[#121212] border border-white/15 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <h2 className="font-sans text-xl font-bold inline-flex items-center gap-2"><FileSearch className="w-5 h-5 text-[#FF3B30]" /> Deep Research</h2>
              <button type="button" onClick={() => setResearchOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            {research?.loading ? <p className="font-mono text-xs tracking-widest uppercase opacity-50">Generating from stored facts…</p> : null}
            {research?.error ? <p className="text-[#FF3B30] text-sm">{research.error}</p> : null}
            {research?.overview && (
              <div className="space-y-4 font-sans text-sm">
                <p className="text-white/70">{research.recommendation}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">{research.disclaimer}</p>
                {["overview", "performance", "audience", "content", "brand_fit", "risk"].map((sec) => (
                  <section key={sec} className="border border-white/10 rounded-2xl p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-white/45 mb-2">{sec.replace("_", " ")}</h3>
                    <pre className="whitespace-pre-wrap text-xs text-white/80">{JSON.stringify(research[sec], null, 2)}</pre>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {assistantOpen && (
        <aside className="fixed right-3 top-24 bottom-24 z-30 w-[min(360px,calc(100%-1.5rem))] rounded-2xl border border-white/15 bg-[#121212] flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 flex justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest">Discover assistant</span>
            <button type="button" onClick={() => setAssistantOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2 text-sm">
            {messages.length === 0 ? (
              <p className="text-white/45">Ask for Telugu fashion creators, then “only show 100K+ followers”, “compare the top 5”, or “deep research creator number 2”.</p>
            ) : messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right text-[#FF3B30]" : "text-white/80"}>{m.text}</div>
            ))}
          </div>
          <form onSubmit={sendAssistant} className="p-2 border-t border-white/10 flex gap-2">
            <input value={chat} onChange={(e) => setChat(e.target.value)} className="flex-1 bg-transparent border-b border-white/15 py-1 text-sm outline-none" placeholder="Ask flugr…" />
            <button type="submit" className="btn-solid text-[10px] px-2">Send</button>
          </form>
        </aside>
      )}
    </div>
  );
}
