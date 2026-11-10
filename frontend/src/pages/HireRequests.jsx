import { useCallback, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function HireRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/marketplace/hire-requests");
      setRequests(data.requests || []);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, status) => {
    try {
      await api.post(`/marketplace/hire-requests/${id}/action`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Action failed");
    }
  };

  const isProd = user?.role === "production" || user?.role === "admin";

  return (
    <div className="w-full pb-10 text-[#1E1B4B]">
      <div className="border-b border-[#1E1B4B]/08 pb-3 mb-5">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF2D55] font-bold">Production desk</p>
        <h1 className="font-sans text-3xl font-bold tracking-tight mt-1">Hire Requests</h1>
      </div>

      {loading ? (
        <div className="py-16 text-center opacity-50 font-mono text-xs uppercase tracking-widest">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center font-sans italic text-xl opacity-60">No hire requests yet.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <article key={r.id} className="rounded-2xl border border-[#1E1B4B]/08 bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-sans font-semibold">
                    {isProd ? r.requester_name : r.production_name}
                  </h3>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8] mt-0.5">
                    {r.service || "General"} · {r.status} · {r.created_at?.slice?.(0, 10)}
                  </p>
                  {r.message ? <p className="font-sans text-sm text-[#64748B] mt-2">{r.message}</p> : null}
                  {r.budget != null ? (
                    <p className="font-mono text-[10px] text-[#14B8A6] mt-1">Budget ₹{Number(r.budget).toLocaleString()}</p>
                  ) : null}
                  {r.quote != null ? (
                    <p className="font-mono text-[10px] text-[#FF2D55] mt-1">Quote ₹{Number(r.quote).toLocaleString()}</p>
                  ) : null}
                </div>
                {isProd && r.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => act(r.id, "accepted")}
                      className="px-3 py-1.5 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/40 text-[#14B8A6] font-mono text-[9px] uppercase tracking-widest"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => act(r.id, "rejected")}
                      className="px-3 py-1.5 rounded-full border border-[#1E1B4B]/10 font-mono text-[9px] uppercase tracking-widest"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
