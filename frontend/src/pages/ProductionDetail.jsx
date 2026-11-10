import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, MapPin } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { formatUserLocation } from "@/lib/location";

export default function ProductionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/marketplace/production/${id}`);
        setMember(data);
        setWishlisted(!!data.wishlisted);
      } catch {
        toast.error("Profile not found");
        nav("/marketplace?tab=hire");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, nav]);

  const toggleWishlist = async () => {
    try {
      const { data } = await api.post("/wishlist", {
        target_id: id,
        target_type: "production",
        action: "toggle",
      });
      setWishlisted(!!data.wishlisted);
      toast.success(data.wishlisted ? "Saved" : "Removed");
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Failed");
    }
  };

  const requestHire = async (e) => {
    e.preventDefault();
    if (!["owner", "influencer", "agent", "admin"].includes(user?.role)) {
      toast.error("Only brands and creators can hire production talent");
      return;
    }
    setBusy(true);
    try {
      await api.post("/marketplace/hire-requests", {
        production_id: id,
        message: message || "Requesting a quote for production work",
        budget: budget ? Number(budget) : undefined,
        service: member?.production_role,
      });
      toast.success("Hire / quote request sent");
      setMessage("");
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center font-mono text-xs uppercase tracking-widest opacity-50">Loading…</div>;
  }
  if (!member) return null;

  return (
    <div className="w-full pb-10 text-[#1E1B4B]">
      <div className="border-b border-[#1E1B4B]/08 pb-4 mb-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          {member.avatar ? (
            <img src={member.avatar} alt="" className="w-24 h-24 rounded-2xl object-cover border border-[#1E1B4B]/10" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-[#EEF2FF] flex items-center justify-center text-3xl font-bold">
              {(member.name || "?")[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-1">
              {member.in_house ? (
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#14B8A6] border border-[#14B8A6]/40 px-2 py-0.5 rounded-full">
                  In-House Team
                </span>
              ) : (
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] border border-[#1E1B4B]/10 px-2 py-0.5 rounded-full">
                  External
                </span>
              )}
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF2D55]">
                {member.production_category_label || member.production_category}
              </span>
            </div>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">{member.name}</h1>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mt-1">
              {member.production_role}
              {formatUserLocation(member) ? (
                <span className="inline-flex items-center gap-1 ml-2"><MapPin className="w-3 h-3" />{formatUserLocation(member)}</span>
              ) : null}
            </p>
            <p className="font-sans text-sm text-[#64748B] mt-3 max-w-2xl">{member.description || member.bio}</p>
          </div>
          <button
            type="button"
            onClick={toggleWishlist}
            className={`self-start px-3 py-1.5 rounded-full border font-mono text-[9px] uppercase tracking-widest inline-flex items-center gap-1 ${
              wishlisted ? "border-[#FF2D55] text-[#FF2D55]" : "border-[#1E1B4B]/10"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? "fill-current" : ""}`} />
            Wishlist
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[
            ["Rate", member.base_rate != null ? `₹${Number(member.base_rate).toLocaleString()}` : "—"],
            ["Experience", member.experience_years != null ? `${member.experience_years} yrs` : "—"],
            ["Rating", member.rating != null ? `${member.rating} (${member.reviews_count || 0})` : "—"],
            ["Availability", member.availability || "—"],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border border-[#1E1B4B]/08 bg-[#F8FAFC] px-3 py-2">
              <p className="font-mono text-[8px] uppercase tracking-widest text-[#94A3B8]">{label}</p>
              <p className="font-sans text-base font-bold mt-0.5">{val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-5">
          <section>
            <h2 className="font-mono text-[10px] tracking-widest uppercase text-[#94A3B8] mb-2">Services</h2>
            <div className="flex flex-wrap gap-2">
              {(member.services || []).map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full border border-[#1E1B4B]/10 font-mono text-[9px] uppercase tracking-widest">
                  {s}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-mono text-[10px] tracking-widest uppercase text-[#94A3B8] mb-2">Languages</h2>
            <p className="font-sans text-sm">{(member.languages || []).join(", ") || "—"}</p>
          </section>
          <section>
            <h2 className="font-mono text-[10px] tracking-widest uppercase text-[#94A3B8] mb-2">Portfolio</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(member.portfolio || []).map((src, i) => (
                <img key={i} src={src} alt="" className="aspect-video object-cover rounded-xl border border-[#1E1B4B]/08" />
              ))}
              {!member.portfolio?.length && <p className="opacity-50 italic text-sm">No portfolio items yet.</p>}
            </div>
          </section>
          {(member.previous_work || []).length > 0 && (
            <section>
              <h2 className="font-mono text-[10px] tracking-widest uppercase text-[#94A3B8] mb-2">Previous work</h2>
              <ul className="space-y-2">
                {member.previous_work.map((w, i) => (
                  <li key={i} className="rounded-xl border border-[#1E1B4B]/08 px-3 py-2 text-sm">
                    <span className="font-semibold">{w.title}</span>
                    <span className="text-[#94A3B8]"> · {w.client} · {w.year}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="lg:col-span-5">
          <form onSubmit={requestHire} className="rounded-2xl border border-[#1E1B4B]/08 bg-[#F8FAFC] p-4 sticky top-4">
            <h2 className="font-mono text-[10px] tracking-widest uppercase text-[#FF2D55] mb-3">Request quote / Hire</h2>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Describe the shoot, edit, VO, or script brief…"
              className="w-full bg-[#F7F8FC] border border-[#1E1B4B]/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF2D55]/50"
            />
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Budget (₹)"
              className="mt-2 w-full bg-[#F7F8FC] border border-[#1E1B4B]/10 rounded-xl px-3 py-2 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full py-2.5 rounded-full bg-[#FF2D55] text-white font-mono text-[10px] uppercase tracking-widest font-bold disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send hire request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
