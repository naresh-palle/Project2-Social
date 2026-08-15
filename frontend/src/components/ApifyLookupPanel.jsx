import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";

const LOOKUP_PLATFORMS = ["instagram", "youtube", "facebook"];

function fmt(n) {
  if (n == null || n === "") return "Data unavailable";
  const v = Number(n);
  if (!Number.isFinite(v)) return "Data unavailable";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}

export function ApifyLookupPanel({ compact = false }) {
  const [health, setHealth] = useState(null);
  const [platform, setPlatform] = useState("instagram");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/apify/health")
      .then(({ data }) => setHealth(data))
      .catch(() => setHealth({ success: false, status: "error" }));
  }, []);

  const status = health?.status;
  const connected = health?.success && status === "connected";
  const badge = !health
    ? { label: "Checking Apify…", cls: "text-white/45" }
    : connected
      ? { label: "Apify connected", cls: "text-[#34C759]" }
      : status === "not_configured"
        ? { label: "Data source not configured", cls: "text-[#FF9500]" }
        : { label: "Apify error", cls: "text-[#FF3B30]" };

  const verify = async (e) => {
    e?.preventDefault();
    if (!handle.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post("/discover/apify-lookup", {
        platform,
        handle: handle.trim(),
      });
      setResult(data);
    } catch (err) {
      setResult({
        ok: false,
        configured: connected,
        message: formatApiError(err?.response?.data?.detail) || "Lookup failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const profile = result?.profile;

  return (
    <section className={`rounded-2xl border border-white/10 bg-[#121212] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">Verify a social ID</p>
          <h2 className="font-sans text-sm font-semibold">Live Apify lookup</h2>
        </div>
        <span className={`font-mono text-[9px] uppercase tracking-widest ${badge.cls}`}>{badge.label}</span>
      </div>
      <p className="font-sans text-[11px] text-white/45 mb-3">
        Paste an Instagram, YouTube, or Facebook username or profile URL. This checks the scraper only — it does not add a creator to the catalog.
      </p>
      <form onSubmit={verify} className="flex flex-wrap gap-2 items-end">
        <label className="font-mono text-[9px] uppercase tracking-widest text-white/40">
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 block bg-[#0B0B0E] border border-white/15 rounded-full px-3 py-1.5 font-sans text-xs"
          >
            {LOOKUP_PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[12rem] font-mono text-[9px] uppercase tracking-widest text-white/40">
          User ID or URL
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle or https://instagram.com/…"
            className="mt-1 w-full bg-transparent border-b border-white/15 py-1.5 font-sans text-xs outline-none"
          />
        </label>
        <button type="submit" disabled={busy || !handle.trim()} className="btn-solid text-[10px] px-4 py-2 inline-flex items-center gap-1 disabled:opacity-40">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {busy ? "Checking…" : "Verify"}
        </button>
      </form>
      {busy ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-white/40">Apify can take 10–30 seconds…</p>
      ) : null}
      {result ? (
        <div className="mt-3 rounded-xl border border-white/10 p-3">
          <p className={`font-sans text-xs ${result.ok ? "text-[#34C759]" : "text-[#FF9500]"}`}>
            {result.message || (result.ok ? "Live Apify result" : "No result")}
          </p>
          {profile ? (
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                ["Followers", fmt(profile.followers ?? profile.subscribers)],
                ["Posts", fmt(profile.posts)],
                ["Views", fmt(profile.views)],
                ["Engagement", profile.engagement == null ? "Data unavailable" : `${Number(profile.engagement).toFixed(2)}%`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[8px] uppercase tracking-widest text-white/40">{k}</dt>
                  <dd className="font-sans text-sm font-bold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {result.handle ? (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-white/35">
              {result.platform} · @{String(result.handle).replace(/^@/, "")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
