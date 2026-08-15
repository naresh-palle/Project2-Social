import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X, TrendingUp, Clock, Hash, MapPin, Users, FileText, Megaphone, ChevronLeft } from "lucide-react";

import { api } from "@/lib/api";
import { formatUsername, displayAccountName } from "@/lib/username";
import { toast } from "sonner";

const TABS = [
  { id: "all", label: "All", icon: Search },
  { id: "users", label: "Users", icon: Users },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "hashtags", label: "Hashtags", icon: Hash },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "location", label: "Location", icon: MapPin },
];

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [tab, setTab] = useState("all");
  const [results, setResults] = useState(null);
  const [recent, setRecent] = useState([]);
  const [trending, setTrending] = useState({ searches: [], hashtags: [] });
  const [loading, setLoading] = useState(false);

  const loadMeta = async () => {
    try {
      const [rRes, tRes] = await Promise.all([api.get("/search/recent"), api.get("/search/trending")]);
      setRecent(rRes.data || []);
      setTrending(tRes.data || { searches: [], hashtags: [] });
    } catch {}
  };

  useEffect(() => {
    loadMeta();
    if (initialQ) {
      runSearch(initialQ, "all");
    }
  }, []);

  const runSearch = async (query = q, kind = tab) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get("/search", { params: { q: query.trim(), kind } });
      setResults(data);
      loadMeta();
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const clearRecent = async () => {
    try {
      await api.delete("/search/recent");
      setRecent([]);
      toast.success("Recent searches cleared");
    } catch {
      toast.error("Could not clear history");
    }
  };

  const items = results
    ? tab === "all"
      ? [
          ...(results.users || []),
          ...(results.posts || []),
          ...(results.hashtags || []),
          ...(results.campaigns || []),
          ...(results.locations || []),
        ]
      : tab === "users"
        ? results.users || []
        : tab === "posts"
          ? results.posts || []
          : tab === "hashtags"
            ? results.hashtags || []
            : tab === "campaigns"
              ? results.campaigns || []
              : results.locations || []
    : [];

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <div className="flex flex-col w-full pb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-4 mb-5 w-full pr-20">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> ⚡ Search
              </p>
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1.5">Search</h1>
            </div>
          </div>

        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(); }}
          className="mt-8 flex gap-2 border border-white/15 bg-[#121212] p-2 rounded-xs"
        >
          <Search className="w-5 h-5 opacity-50 ml-2 shrink-0 self-center" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search influencers, posts, hashtags…"
            className="flex-1 bg-transparent outline-none font-mono text-sm py-2"
          />
          {q && (
            <button type="button" onClick={() => { setQ(""); setResults(null); }} className="p-2 opacity-50 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          )}
          <button type="submit" disabled={loading} className="px-4 py-2 bg-[#FF3B30] font-mono text-xs uppercase tracking-widest font-bold">
            {loading ? "…" : "Go"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); if (q.trim()) runSearch(q, t.id); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border rounded-xs transition-all ${
                tab === t.id ? "bg-[#FF3B30] border-[#FF3B30] text-white" : "border-white/20 text-white/60 hover:border-white/40"
              }`}
            >
              <t.icon className="w-3 h-3" /> {t.label}
            </button>
          ))}
        </div>

        {!results && (
          <div className="mt-8 space-y-8">
            
            {/* Trending Section */}
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30] flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5" /> Trending
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-8">
                <div className="space-y-1.5">
                  <h4 className="font-sans text-[9px] uppercase opacity-40 mb-1.5 tracking-widest">Top Hashtags</h4>
                  {(trending.hashtags || []).slice(0, 5).map((h) => (
                    <button
                      key={h.tag}
                      type="button"
                      onClick={() => { setQ(`#${h.tag}`); setTab("hashtags"); runSearch(`#${h.tag}`, "hashtags"); }}
                      className="w-full text-left px-3 py-2 border border-white/10 bg-white/[0.02] hover:border-[#FF3B30]/40 rounded-xs transition-colors flex justify-between items-center"
                    >
                      <span className="font-editorial text-base">#{h.tag}</span>
                      <span className="font-mono text-[9px] opacity-50">{h.count} posts</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-sans text-[9px] uppercase opacity-40 mb-1.5 tracking-widest">Top Searches</h4>
                  {(trending.searches || []).slice(0, 5).map((s) => (
                    <button
                      key={s.query}
                      type="button"
                      onClick={() => { setQ(s.query); runSearch(s.query); }}
                      className="w-full text-left px-3 py-2 border border-white/10 bg-white/[0.02] hover:border-[#FF3B30]/40 font-mono text-xs rounded-xs transition-colors"
                    >
                      {s.query}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Recent
                </h3>
                {recent.length > 0 && (
                  <button type="button" onClick={clearRecent} className="font-mono text-[10px] opacity-50 hover:text-white uppercase transition-colors">
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {recent.length === 0 ? (
                  <p className="font-mono text-[10px] opacity-40 italic">No recent searches</p>
                ) : (
                  recent.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setQ(r.query); runSearch(r.query, r.kind || tab); }}
                      className="w-full flex items-center justify-between px-3 py-2 border border-white/10 bg-white/[0.02] hover:border-[#FF3B30]/40 font-mono text-xs rounded-xs transition-colors"
                    >
                      <span className="truncate pr-2">{r.query}</span>
                      {r.kind && (
                        <span className="shrink-0 text-[9px] px-1.5 py-0.5 uppercase tracking-widest bg-white/10 text-white/60 rounded-3xl">
                          {r.kind}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {results && (
          <div className="mt-10 space-y-3">
            {items.length === 0 ? (
              <p className="font-sans text-xl font-medium tracking-tight opacity-40 text-center py-12">No results found</p>
            ) : (
              tab === "all" ? (
                <div className="space-y-8">
                  {results.users?.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] mb-3">Users</h3>
                      <div className="space-y-3">
                        {results.users.map((item, i) => <SearchResult key={`user-${item.id || i}`} tab="users" item={item} />)}
                      </div>
                    </div>
                  )}
                  {results.posts?.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] mb-3">Posts</h3>
                      <div className="space-y-3">
                        {results.posts.map((item, i) => <SearchResult key={`post-${item.id || i}`} tab="posts" item={item} />)}
                      </div>
                    </div>
                  )}
                  {results.hashtags?.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] mb-3">Hashtags</h3>
                      <div className="space-y-3">
                        {results.hashtags.map((item, i) => <SearchResult key={`hash-${item.tag || i}`} tab="hashtags" item={item} />)}
                      </div>
                    </div>
                  )}
                  {results.campaigns?.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] mb-3">Campaigns</h3>
                      <div className="space-y-3">
                        {results.campaigns.map((item, i) => <SearchResult key={`camp-${item.id || i}`} tab="campaigns" item={item} />)}
                      </div>
                    </div>
                  )}
                  {results.locations?.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] mb-3">Locations</h3>
                      <div className="space-y-3">
                        {results.locations.map((item, i) => <SearchResult key={`loc-${item.id || i}`} tab="location" item={item} />)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                items.map((item, i) => (
                  <SearchResult key={item.id || item.tag || i} tab={tab} item={item} />
                ))
              )
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function SearchResult({ tab, item }) {
  if (tab === "users" || tab === "location") {
    const primary = displayAccountName(item, formatUsername(item.handle, item.username) || item.name || "user");
    const subtitle =
      item.role === "owner" || item.role === "agent"
        ? formatUsername(item.handle, item.username) || null
        : (item.name && primary !== item.name ? item.name : null);
    return (
      <Link
        to={`/u/${item.id}`}
        className="flex items-center gap-4 p-4 border border-white/10 bg-[#121212] hover:border-[#FF3B30]/40 rounded-xs"
      >
        {item.avatar && <img src={item.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-white/20" />}
        <div>
          <div className="font-sans text-base md:text-lg font-semibold">{primary}</div>
          {subtitle ? (
            <div className="font-sans text-[10px] text-[#FF3B30] uppercase mt-0.5">{subtitle}</div>
          ) : (
            <div className="font-sans text-[10px] opacity-50 uppercase mt-0.5">{item.role || "member"}</div>
          )}
        </div>
      </Link>
    );
  }
  if (tab === "posts") {
    return (
      <div className="p-4 border border-white/10 bg-[#121212] rounded-xs">
        <div className="font-mono text-[10px] opacity-60">
          {formatUsername(item.author?.handle, item.author?.username) || item.author?.name || "user"}
        </div>
        <p className="font-mono text-sm mt-1 line-clamp-3">{item.text || item.title}</p>
      </div>
    );
  }
  if (tab === "hashtags") {
    return (
      <div className="p-4 border border-white/10 bg-[#121212] rounded-xs">
        <span className="font-editorial text-2xl text-[#FF3B30]">#{item.tag}</span>
        <span className="font-mono text-xs opacity-50 ml-3">{item.count} posts</span>
      </div>
    );
  }
  if (tab === "campaigns") {
    return (
      <Link to={`/campaigns/${item.id}`} className="block p-4 border border-white/10 bg-[#121212] hover:border-[#FF3B30]/40 rounded-xs">
        <div className="font-editorial text-xl">{item.title}</div>
        <div className="font-mono text-[10px] opacity-60 mt-1">{item.brand}</div>
      </Link>
    );
  }
  return null;
}
