import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { useLenis } from "@/lib/useLenis";

const CATEGORIES = [
  "Fashion & Style", "Food & Cooking", "Beauty & Makeup", 
  "Technology & Gadgets", "Fitness & Health", "Lifestyle & Home",
  "Travel & Adventure", "Business & Entrepreneurship", 
  "Entertainment & Gaming", "Education & Learning", "Other"
];

export default function Marketplace() {
  useLenis();
  const [tab, setTab] = useState("creators");
  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState("");

  const load = async () => {
    const params = { q: q || undefined, niche: niche || undefined };
    const [c, cp] = await Promise.all([
      api.get("/creators", { params }),
      api.get("/campaigns", { params }),
    ]);
    setCreators(c.data);
    setCampaigns(cp.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niche]);
  const onSearch = (e) => { e.preventDefault(); load(); };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />

      <div className="pt-28 pb-8 max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="hairline-b pb-8">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ The Directory</p>
          <h1 className="font-editorial text-6xl md:text-8xl leading-[1.15] mt-2">
            The <span className="italic">file</span> on record<span className="tick">.</span>
          </h1>
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex gap-8 font-mono text-[11px] tracking-[0.28em] uppercase">
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
                className="bg-transparent focus:outline-none w-40 md:w-64 font-mono text-sm"
              />
            </div>
            <button type="submit" className="btn-pill" data-testid="search-submit">Search</button>
          </form>
        </div>

        {/* Niche pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Pill active={niche === ""} onClick={() => setNiche("")} label="All" />
          {CATEGORIES.map((n) => (
            <Pill key={n} active={niche === n} onClick={() => setNiche(n)} label={n} />
          ))}
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
                      <div className="h-full w-full bg-white/5 flex items-center justify-center font-editorial text-6xl italic opacity-40">
                        {c.name?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <div className="font-editorial text-2xl leading-tight">{c.name}</div>
                      <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">
                        {c.handle}
                      </div>
                    </div>
                    <div className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-70">
                      {c.followers ? `${Math.round(c.followers / 1000)}K` : "—"}
                    </div>
                  </div>
                  <div className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase opacity-50">
                    {(c.niches || []).slice(0, 3).join(" · ")}
                  </div>
                </Link>
              </motion.div>
            ))}
            {creators.length === 0 && (
              <div className="col-span-full py-24 text-center font-editorial italic text-3xl opacity-60">
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
                  <div className="col-span-12 md:col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{c.brand}</div>
                    <div className="font-editorial text-3xl md:text-4xl leading-tight mt-1 group-hover:italic transition-all">
                      {c.title}
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-3 font-mono text-[11px] tracking-[0.2em] uppercase opacity-70">
                    {(c.niches || []).join(" · ")}
                  </div>
                  <div className="col-span-3 md:col-span-2 font-editorial italic text-2xl">₹{c.budget}</div>
                  <div className="col-span-3 md:col-span-1 text-right font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] group-hover:translate-x-1 transition-transform">
                    View →
                  </div>
                </Link>
              </motion.div>
            ))}
            {campaigns.length === 0 && (
              <div className="py-24 text-center font-editorial italic text-3xl opacity-60">
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

function Pill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={`niche-${label}`}
      className={`px-4 py-1.5 rounded-full font-mono text-[10px] tracking-[0.22em] uppercase transition-colors ${
        active ? "bg-[#FF3B30] text-[#F4F4F0]" : "hairline-t hairline-b hairline-l hairline-r hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}
