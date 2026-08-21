import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "camera", label: "Camera Team" },
  { id: "editing", label: "Video Editing" },
  { id: "voiceover", label: "Voice Over" },
  { id: "script", label: "Script Writers" },
];

export function AdminProduction() {
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("all"); // all | in_house | external
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    production_category: "camera",
    production_role: "",
    city: "Mumbai",
    state: "Maharashtra",
    base_rate: "",
    in_house: true,
    bio: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/production");
      setMembers(data.members || []);
      setRequests(data.hire_requests || []);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Failed to load production team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMembers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members.filter((m) => {
      if (categoryFilter && m.production_category !== categoryFilter) return false;
      if (teamFilter === "in_house" && !m.in_house) return false;
      if (teamFilter === "external" && m.in_house) return false;
      if (!needle) return true;
      const hay = [
        m.name,
        m.production_role,
        m.production_category_label,
        m.city,
        m.state,
        ...(m.services || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [members, categoryFilter, teamFilter, q]);

  const filteredRequests = useMemo(() => {
    if (!categoryFilter && teamFilter === "all") return requests;
    const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
    return requests.filter((r) => {
      const m = memberById[r.production_id];
      if (!m) return true;
      if (categoryFilter && m.production_category !== categoryFilter) return false;
      if (teamFilter === "in_house" && !m.in_house) return false;
      if (teamFilter === "external" && m.in_house) return false;
      return true;
    });
  }, [requests, members, categoryFilter, teamFilter]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/production", {
        ...form,
        base_rate: form.base_rate ? Number(form.base_rate) : undefined,
      });
      toast.success("Production profile created");
      setForm({
        name: "",
        email: "",
        production_category: "camera",
        production_role: "",
        city: "Mumbai",
        state: "Maharashtra",
        base_rate: "",
        in_house: true,
        bio: "",
      });
      load();
    } catch (err) {
      toast.error(formatApiError(err?.response?.data?.detail) || "Create failed");
    }
  };

  const toggleInHouse = async (m) => {
    try {
      await api.patch(`/admin/production/${m.id}`, { in_house: !m.in_house });
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Update failed");
    }
  };

  const seed = async () => {
    try {
      const { data } = await api.post("/marketplace/seed-demo");
      toast.success(`Seeded · prod +${data.production || 0} · perf +${data.performance || 0}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Seed failed");
    }
  };

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-bold">Hire / Production Team</h2>
          <p className="font-sans text-sm text-white/50">
            Filter, create, and manage in-house and external production professionals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/marketplace?tab=hire"
            className="px-3 py-1.5 rounded-full border border-white/15 font-mono text-[9px] uppercase tracking-widest"
          >
            Open marketplace
          </Link>
          <button type="button" onClick={seed} className="px-3 py-1.5 rounded-full border border-white/15 font-mono text-[9px] uppercase tracking-widest">
            Seed demo data
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">Filters</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className={`px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-widest ${!categoryFilter ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}
          >
            All categories
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-widest ${categoryFilter === c.id ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            ["all", "All teams"],
            ["in_house", "In-House"],
            ["external", "External"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTeamFilter(id)}
              className={`px-2.5 py-1 rounded-full border text-[9px] uppercase tracking-widest ${teamFilter === id ? "border-[#FF3B30] text-[#FF3B30]" : "border-white/15"}`}
            >
              {label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, role, city…"
            className="ml-auto bg-black/40 border border-white/15 rounded-full px-3 py-1.5 text-sm min-w-[12rem]"
          />
        </div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">
          Showing {filteredMembers.length} of {members.length} members · {filteredRequests.length} hire requests
        </p>
      </div>

      <form onSubmit={create} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <h3 className="sm:col-span-2 lg:col-span-3 font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">Create profile</h3>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" />
        <select value={form.production_category} onChange={(e) => setForm({ ...form, production_category: e.target.value })} className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-[var(--fg)]">
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={form.production_role} onChange={(e) => setForm({ ...form, production_role: e.target.value })} placeholder="Role (e.g. Cameraman)" className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" />
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" />
        <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" />
        <input type="number" value={form.base_rate} onChange={(e) => setForm({ ...form, base_rate: e.target.value })} placeholder="Base rate ₹" className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <input type="checkbox" checked={form.in_house} onChange={(e) => setForm({ ...form, in_house: e.target.checked })} />
          In-House Team
        </label>
        <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Bio / services" className="sm:col-span-2 lg:col-span-3 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm" rows={2} />
        <button type="submit" className="sm:col-span-2 lg:col-span-3 px-4 py-2 rounded-full bg-[#FF3B30] text-white font-mono text-[10px] uppercase tracking-widest font-bold w-fit">
          Create member
        </button>
      </form>

      {loading ? (
        <div className="py-10 text-center opacity-50 font-mono text-xs uppercase tracking-widest">Loading…</div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-white/45">Members · {filteredMembers.length}</h3>
          {filteredMembers.map((m) => (
            <div key={m.id} className="rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-sans font-semibold">{m.name}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                  {m.production_category_label} · {m.production_role} · {m.city}
                  {m.in_house ? " · In-House" : " · External"}
                  {m.base_rate != null ? ` · ₹${Number(m.base_rate).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/production/${m.id}`} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">
                  View
                </Link>
                <button type="button" onClick={() => toggleInHouse(m)} className="px-2 py-1 rounded-full border border-white/15 text-[9px] uppercase tracking-widest">
                  Mark {m.in_house ? "External" : "In-House"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Delete this production profile?")) return;
                    try {
                      await api.delete(`/admin/production/${m.id}`);
                      load();
                    } catch (e) {
                      toast.error(formatApiError(e?.response?.data?.detail) || "Delete failed");
                    }
                  }}
                  className="px-2 py-1 rounded-full border border-[#FF3B30]/40 text-[#FF3B30] text-[9px] uppercase tracking-widest"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!filteredMembers.length && (
            <p className="opacity-50 italic text-sm py-6 text-center">No production members match these filters.</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-white/45">Incoming hire requests · {filteredRequests.length}</h3>
        {filteredRequests.slice(0, 30).map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
            <span className="font-semibold">{r.requester_name}</span>
            <span className="text-white/45"> → {r.production_name}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 ml-2">{r.status}</span>
          </div>
        ))}
        {!filteredRequests.length && <p className="opacity-50 italic text-sm">No hire requests for this filter.</p>}
      </div>
    </div>
  );
}
