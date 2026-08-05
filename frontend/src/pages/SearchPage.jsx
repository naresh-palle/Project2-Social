import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, TrendingUp, Clock, Hash, MapPin, Users, FileText, Megaphone } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { formatUsername } from "@/lib/username";
import { toast } from "sonner";

const TABS = [
  { id: "users", label: "Users", icon: Users },
  { id: "posts", label: "Posts", icon: FileText },
  { id: "hashtags", label: "Hashtags", icon: Hash },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "location", label: "Location", icon: MapPin },
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("users");
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
    ? tab === "users"
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
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <div className="pt-28 max-w-4xl mx-auto px-6 md:px-10 pb-24 flex-1 w-full">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Discover</p>
        <h1 className="font-sans text-4xl md:text-6xl font-bold tracking-tight mt-2">Search<span className="tick">.</span></h1>

        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(); }}
          className="mt-8 flex gap-2 border border-white/15 bg-[#121212] p-2 rounded-xs"
        >
          <Search className="w-5 h-5 opacity-50 ml-2 shrink-0 self-center" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search creators, posts, hashtags…"
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
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Recent
                </h3>
                {recent.length > 0 && (
                  <button type="button" onClick={clearRecent} className="font-mono text-[10px] opacity-50 hover:text-white uppercase">
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {recent.length === 0 ? (
                  <p className="font-mono text-xs opacity-40">No recent searches</p>
                ) : (
                  recent.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setQ(r.query); runSearch(r.query, r.kind || tab); }}
                      className="block w-full text-left p-3 border border-white/10 bg-white/[0.02] hover:border-[#FF3B30]/40 font-mono text-sm rounded-xs"
                    >
                      {r.query}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] flex items-center gap-2 mb-4">
                <TrendingUp className="w-3.5 h-3.5" /> Trending
              </h3>
              <div className="space-y-2">
                {(trending.hashtags || []).slice(0, 5).map((h) => (
                  <button
                    key={h.tag}
                    type="button"
                    onClick={() => { setQ(`#${h.tag}`); setTab("hashtags"); runSearch(`#${h.tag}`, "hashtags"); }}
                    className="block w-full text-left p-3 border border-white/10 bg-white/[0.02] hover:border-[#FF3B30]/40 rounded-xs"
                  >
                    <span className="font-editorial text-lg">#{h.tag}</span>
                    <span className="font-mono text-[10px] opacity-50 ml-2">{h.count} posts</span>
                  </button>
                ))}
                {(trending.searches || []).slice(0, 5).map((s) => (
                  <button
                    key={s.query}
                    type="button"
                    onClick={() => { setQ(s.query); runSearch(s.query); }}
                    className="block w-full text-left p-3 border border-white/10 bg-white/[0.02] hover:border-[#FF3B30]/40 font-mono text-sm rounded-xs"
                  >
                    {s.query}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-10 space-y-3">
            {items.length === 0 ? (
              <p className="font-sans text-xl font-medium tracking-tight opacity-40 text-center py-12">No results found</p>
            ) : (
              items.map((item, i) => (
                <SearchResult key={item.id || item.tag || i} tab={tab} item={item} />
              ))
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function SearchResult({ tab, item }) {
  if (tab === "users" || tab === "location") {
    return (
      <Link
        to={`/u/${item.id}`}
        className="flex items-center gap-4 p-4 border border-white/10 bg-[#121212] hover:border-[#FF3B30]/40 rounded-xs"
      >
        {item.avatar && <img src={item.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-white/20" />}
        <div>
          <div className="font-editorial text-xl">{item.name}</div>
          <div className="font-mono text-[10px] text-[#FF3B30] uppercase">{formatUsername(item.handle, item.username) || "user"}</div>
        </div>
      </Link>
    );
  }
  if (tab === "posts") {
    return (
      <div className="p-4 border border-white/10 bg-[#121212] rounded-xs">
        <div className="font-mono text-[10px] opacity-60">{item.author?.name}</div>
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
