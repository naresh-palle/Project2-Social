import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Send, Users } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav("/login");
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex items-center justify-center">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">Opening the studio…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-24">
        <div className="hairline-b pb-8 mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
              § {user.role === "owner" ? "Owner desk" : "Creator desk"}
            </p>
            <h1 className="font-editorial text-6xl md:text-7xl leading-none mt-2">
              {user.name}<span className="tick">.</span>
            </h1>
            <p className="font-mono text-[11px] tracking-[0.22em] uppercase opacity-60 mt-3">
              {user.role === "owner" ? user.company || "Owner" : user.handle || "Creator"} ·{" "}
              {user.email}
            </p>
          </div>
          {user.role === "owner" ? (
            <Link to="/campaigns/new" data-testid="new-campaign-btn" className="btn-solid">
              <Plus className="w-4 h-4" /> New campaign
            </Link>
          ) : (
            <Link to="/marketplace" data-testid="browse-campaigns-btn" className="btn-solid">
              <Send className="w-4 h-4" /> Browse briefs
            </Link>
          )}
        </div>

        {user.role === "owner" ? <OwnerPanel /> : <InfluencerPanel />}
      </div>
      <Footer />
    </div>
  );
}

function OwnerPanel() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/campaigns?mine=true").then((r) => setItems(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-6">
        Your live briefs · {items.length}
      </h2>
      {items.length === 0 ? (
        <Empty label="No briefs yet. Post the first one." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function InfluencerPanel() {
  const [apps, setApps] = useState([]);
  useEffect(() => {
    api.get("/applications/mine").then((r) => setApps(r.data)).catch(() => {});
  }, []);
  return (
    <div>
      <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-6">
        Your applications · {apps.length}
      </h2>
      {apps.length === 0 ? (
        <Empty label="No pitches yet. Head to the marketplace." />
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <div key={a.id} className="hairline-b pb-4 grid grid-cols-12 gap-4 items-baseline" data-testid={`app-${a.id}`}>
              <div className="col-span-12 md:col-span-6">
                <div className="font-editorial text-2xl">{a.campaign_title || "Untitled"}</div>
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">
                  {a.campaign_brand}
                </div>
              </div>
              <div className="col-span-6 md:col-span-3 font-mono text-[11px] tracking-[0.2em] uppercase opacity-70">
                Rate · ${a.rate}
              </div>
              <div className="col-span-6 md:col-span-3 text-right font-mono text-[11px] tracking-[0.25em] uppercase">
                <span className={a.status === "accepted" ? "text-[#FF3B30]" : "opacity-60"}>
                  {a.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignRow({ c }) {
  const [apps, setApps] = useState(null);
  const load = async () => {
    try {
      const { data } = await api.get(`/campaigns/${c.id}/applications`);
      setApps(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to load");
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="hairline-t hairline-b hairline-l hairline-r p-6 flex flex-col justify-between min-h-[220px]"
      data-testid={`campaign-${c.id}`}
    >
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{c.brand}</div>
        <h3 className="font-editorial text-3xl leading-tight mt-2">{c.title}</h3>
        <p className="text-sm opacity-70 mt-3 line-clamp-3">{c.description}</p>
      </div>
      <div className="mt-4 flex items-baseline justify-between hairline-t pt-3">
        <div className="font-mono text-[11px] tracking-[0.2em] uppercase">
          <Users className="inline w-3 h-3 mr-1" />
          {apps?.length ?? c.applications_count} pitches
        </div>
        <div className="font-editorial italic text-xl">${c.budget}</div>
      </div>
      {apps && apps.length > 0 && (
        <div className="mt-4 space-y-1">
          {apps.slice(0, 3).map((a) => (
            <div key={a.id} className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-70 truncate">
              → {a.influencer_name} · ${a.rate}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Empty({ label }) {
  return (
    <div className="hairline-t hairline-b py-24 text-center">
      <div className="font-editorial italic text-4xl opacity-70">{label}</div>
    </div>
  );
}
