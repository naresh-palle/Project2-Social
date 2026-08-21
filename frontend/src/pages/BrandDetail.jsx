import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Heart, MapPin, ExternalLink } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatUserLocation } from "@/lib/location";

function fmt(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}

export default function BrandDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/marketplace/brands/${id}`);
        setBrand(data);
        setWishlisted(!!data.wishlisted);
      } catch {
        toast.error("Brand not found");
        nav("/marketplace?tab=brands");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, nav]);

  const toggleWishlist = async () => {
    try {
      const { data } = await api.post("/wishlist", {
        target_id: id,
        target_type: "brand",
        action: "toggle",
      });
      setWishlisted(!!data.wishlisted);
      toast.success(data.wishlisted ? "Saved to wishlist" : "Removed from wishlist");
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Wishlist failed");
    }
  };

  if (loading) {
    return <div className="py-24 text-center font-mono text-xs uppercase tracking-widest opacity-50">Loading…</div>;
  }
  if (!brand) return null;

  const name = brand.company || brand.name || "Brand";

  return (
    <div className="w-full pb-10 text-[#F4F4F0]">
      <div className="border-b border-white/10 pb-4 mb-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          {brand.avatar ? (
            <img src={brand.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover border border-white/15" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-bold">
              {name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">Brand profile</p>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight truncate">{name}</h1>
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/45 mt-1 flex flex-wrap gap-2">
              <span>{brand.industry || brand.category || "General"}</span>
              {formatUserLocation(brand) ? (
                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{formatUserLocation(brand)}</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleWishlist}
              className={`px-3 py-1.5 rounded-full border font-mono text-[9px] uppercase tracking-widest inline-flex items-center gap-1 ${
                wishlisted ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-current" : ""}`} />
              {wishlisted ? "Saved" : "Wishlist"}
            </button>
            {brand.website ? (
              <a
                href={brand.website}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-full border border-white/15 font-mono text-[9px] uppercase tracking-widest inline-flex items-center gap-1"
              >
                Website <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[
            ["Active campaigns", brand.active_campaigns],
            ["Previous campaigns", brand.previous_campaigns],
            ["Creators hired", brand.creators_hired],
            ["Rating", brand.rating != null ? brand.rating : "—"],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">{label}</p>
              <p className="font-sans text-lg font-bold tabular-nums mt-0.5">{val ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mb-6">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-2">Overview</h2>
        <p className="font-sans text-sm text-white/80 leading-relaxed max-w-3xl">
          {brand.overview || brand.bio || "No brand overview yet."}
        </p>
        {brand.objectives?.length ? (
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-3">
            Objectives · {brand.objectives.filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </section>

      <section className="mb-6">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Active campaigns</h2>
        <div className="space-y-2">
          {(brand.active_campaign_list || []).map((c) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:border-[#FF3B30]/40"
            >
              <div className="font-sans font-semibold">{c.title}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                {(c.niches || []).slice(0, 3).join(" · ") || c.category || "Campaign"}
                {c.budget != null ? ` · ₹${Number(c.budget).toLocaleString()}` : ""}
              </div>
            </Link>
          ))}
          {!brand.active_campaign_list?.length && (
            <p className="font-sans text-sm opacity-50 italic">No active campaigns.</p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Previous campaigns</h2>
        <div className="space-y-2">
          {(brand.previous_campaign_list || []).slice(0, 8).map((c) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className="block rounded-2xl border border-white/10 px-4 py-3 hover:border-white/25"
            >
              <div className="font-sans font-semibold">{c.title}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">{c.status || "closed"}</div>
            </Link>
          ))}
          {!brand.previous_campaign_list?.length && (
            <p className="font-sans text-sm opacity-50 italic">No previous campaigns on file.</p>
          )}
        </div>
      </section>

      {(brand.campaign_performance || []).length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Campaign performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {brand.campaign_performance.slice(0, 6).map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-sans font-semibold">{p.campaign_name}</div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-1">
                  {p.campaign_objective} · {p.campaign_date}
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div><div className="font-bold tabular-nums text-sm">{fmt(p.total_reach)}</div><div className="font-mono text-[8px] uppercase text-white/40">Reach</div></div>
                  <div><div className="font-bold tabular-nums text-sm">{fmt(p.total_engagement)}</div><div className="font-mono text-[8px] uppercase text-white/40">Engagement</div></div>
                  <div><div className="font-bold tabular-nums text-sm">{p.roas != null ? `${p.roas}x` : "—"}</div><div className="font-mono text-[8px] uppercase text-white/40">ROAS</div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(brand.creators_hired_list || []).length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/45 mb-3">Creators previously hired</h2>
          <div className="flex flex-wrap gap-3">
            {brand.creators_hired_list.map((c) => (
              <Link
                key={c.id}
                to={`/creators/${c.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 hover:border-[#FF3B30]/40"
              >
                {c.avatar ? <img src={c.avatar} alt="" className="w-6 h-6 rounded-full object-cover" /> : null}
                <span className="font-sans text-sm">{c.name || c.handle}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
