import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowLeft } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES, matchesCategoryFilter } from "@/lib/categories";
import { api } from "@/lib/api";
import { useLenis } from "@/lib/useLenis";

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
    // Client-side multi-category filter when more than one selected (or refine API results)
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
      
      <Nav />

      <div className="pt-28 pb-8 max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="hairline-b pb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-[10px] tracking-[0.3em] uppercase opacity-60">§ The Directory</p>
            <h1 className="font-sans text-5xl md:text-7xl font-bold tracking-tight leading-[1.15] mt-2">
              The <span className="italic">file</span> on record<span className="tick">.</span>
            </h1>
          </div>
          <Link to="/dashboard" data-testid="back-to-dashboard-btn" className="font-sans text-[11px] tracking-[0.28em] uppercase kinetic-underline flex items-center gap-2 mb-2 text-[#FF3B30]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex gap-8 font-sans text-[11px] tracking-[0.28em] uppercase">
            {["creators", "campaigns"].map((t) => (
              <button
                key={t}
                data-testid={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`kinetic-underline ${tab === t ? "text-[#FF3B30]" : "opacity-60"}`}
              >
                {t === "creators" ? `Creators · ${creators.length}` : `Briefs · ${campaigns.length}`}
              </button>
            ))}
          </div>
          <form onSubmit={onSearch} className="flex items-center gap-3">
            <div className="flex items-center gap-2 hairline-b py-2 pl-2 pr-3">
              <Search className="w-4 h-4 opacity-60" />
              <input
                data-testid="search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-transparent focus:outline-none w-40 md:w-64 font-sans text-sm"
              />
            </div>
            <button type="submit" className="btn-pill" data-testid="search-submit">Search</button>
          </form>
        </div>

        <div className="mt-6 max-w-md">
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

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pb-24">
        {tab === "creators" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {creators.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.05 }}
                data-testid={`creator-${c.id}`}
              >
                <Link to={`/creators/${c.id}`} className="group block">
                  <div className="aspect-[4/5] overflow-hidden hairline-b relative">
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.name} className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.06]" />
                    ) : (
                      <div className="h-full w-full bg-white/5 flex items-center justify-center font-sans text-6xl italic opacity-40">
                        {c.name?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <div className="font-sans text-2xl leading-tight">{c.name}</div>
                      <div className="font-sans text-[10px] tracking-[0.22em] uppercase opacity-60">
                        {c.handle}
                      </div>
                    </div>
                    <div className="font-sans text-[11px] tracking-[0.2em] uppercase opacity-70">
                      {c.followers ? `${Math.round(c.followers / 1000)}K` : "—"}
                    </div>
                  </div>
                  <div className="mt-2 font-sans text-[10px] tracking-[0.2em] uppercase opacity-50">
                    {(c.niches || []).slice(0, 3).join(" · ")}
                  </div>
                </Link>
              </motion.div>
            ))}
            {creators.length === 0 && (
              <div className="col-span-full py-24 text-center font-sans italic text-3xl opacity-60">
                No creators on file for this filter.
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
      <Footer />
    </div>
  );
}
