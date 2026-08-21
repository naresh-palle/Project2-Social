import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { formatUsername } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";

const TABS = [
  { id: "all", label: "All" },
  { id: "influencer", label: "Influencers" },
  { id: "brand", label: "Brands" },
  { id: "production", label: "Production" },
];

function profileHref(item) {
  const t = item.target_type;
  const id = item.target_id;
  if (t === "brand") return `/brands/${id}`;
  if (t === "production") return `/production/${id}`;
  return `/creators/${id}`;
}

export default function Wishlist() {
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === "all" ? {} : { target_type: tab };
      const { data } = await api.get("/wishlist", { params });
      setItems(data.items || []);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (item) => {
    try {
      await api.post("/wishlist", {
        target_id: item.target_id,
        target_type: item.target_type,
        action: "remove",
      });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success("Removed from wishlist");
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Could not remove");
    }
  };

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] pb-10">
      <div className="border-b border-white/10 pb-3 mb-4">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
          <Heart className="w-3.5 h-3.5" /> Saved for later
        </p>
        <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight mt-1">My Wishlist</h1>
        <p className="font-sans text-sm text-white/50 mt-1">Influencers, brands, and production talent you saved.</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-5 font-sans text-[11px] tracking-[0.28em] uppercase">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`kinetic-underline py-1 ${tab === t.id ? "text-[#FF3B30]" : "opacity-60"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center font-mono text-xs uppercase tracking-widest opacity-50">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center font-sans italic text-2xl opacity-60">No saved profiles yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const p = item.profile || {};
            const title =
              p.company ||
              p.name ||
              formatUsername(p.handle, p.username) ||
              "Profile";
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex gap-3"
                data-testid={`wishlist-item-${item.target_id}`}
              >
                <Link to={profileHref(item)} className="shrink-0">
                  {p.avatar ? (
                    <img src={p.avatar} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center font-bold">
                      {(title[0] || "?").toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={profileHref(item)} className="font-sans font-semibold truncate block hover:italic">
                    {title}
                  </Link>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                    {item.target_type}
                    {p.production_category_label ? ` · ${p.production_category_label}` : ""}
                    {p.industry ? ` · ${p.industry}` : ""}
                    {formatUserLocation(p) ? ` · ${formatUserLocation(p)}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Link
                      to={profileHref(item)}
                      className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
