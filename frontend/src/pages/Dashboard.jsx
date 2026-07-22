import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Send, Users } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

import { AdminPanel } from "./AdminPanel";

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
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border border-[#F4F4F0]/20">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center font-editorial italic text-3xl text-white"
                  style={{ backgroundColor: `hsl(${user.name.length * 45}, 65%, 40%)` }}
                >
                  {user.name?.[0]}
                </div>
              )}
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                § {user.role === "admin" ? "Super Admin" : user.role === "owner" ? "Owner desk" : user.role === "agent" ? "Agent desk" : "Creator desk"}
              </p>
              <h1 className="font-editorial text-6xl md:text-7xl leading-[1.15] mt-2">
                {user.name}<span className="tick">.</span>
              </h1>
              <p className="font-mono text-[11px] tracking-[0.22em] uppercase opacity-60 mt-3">
                {user.role === "admin" ? "Platform Console" : user.role === "owner" ? user.company || "Owner" : user.role === "agent" ? "Agent" : user.handle || "Creator"} ·{" "}
                {user.email}
              </p>
            </div>
          </div>
          {user.role === "owner" || (user.role === "agent" && (user.agent_type === "company_agent" || !user.agent_type)) ? (
            <Link to="/campaigns/new" data-testid="new-campaign-btn" className="btn-solid">
              <Plus className="w-4 h-4" /> New campaign
            </Link>
          ) : user.role !== "admin" ? (
            <Link to="/marketplace" data-testid="browse-campaigns-btn" className="btn-solid">
              <Send className="w-4 h-4" /> Browse briefs
            </Link>
          ) : null}
        </div>

        {user.role === "admin" ? <AdminPanel /> : user.role === "owner" ? <OwnerPanel /> : user.role === "agent" ? <AgentPanel /> : <InfluencerPanel />}
      </div>
      <Footer />
    </div>
  );
}

function OwnerPanel() {
  const [items, setItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/campaigns?mine=true").then((r) => setItems(r.data)).catch(() => {});
    api.get("/analytics/owner").then((r) => setStats(r.data)).catch(() => {});
    api.get("/creators/match").then((r) => setMatches(r.data)).catch(() => {});
  }, []);

  const tiles = stats ? [
    { k: "Live briefs", v: stats.open_campaigns, tail: `of ${stats.total_campaigns} total` },
    { k: "In progress", v: stats.in_progress, tail: "shipping now" },
    { k: "Applications", v: stats.applications_total, tail: "on file" },
    { k: "Escrow held", v: `₹${stats.escrow_held.toLocaleString()}`, tail: "in the vault" },
    { k: "Paid to creators", v: `₹${stats.paid_to_creators.toLocaleString()}`, tail: "released" },
    { k: "Conversations", v: stats.conversations, tail: "in the studio" },
  ] : [];

  return (
    <div>
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 mb-14 hairline-t hairline-b hairline-l hairline-r" data-testid="owner-analytics">
          {tiles.map((t, i) => (
            <motion.div
              key={t.k}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className={`p-5 md:p-6 ${i < tiles.length - 1 ? "hairline-r" : ""} ${i < 3 ? "md:hairline-b" : ""}`}
            >
              <div className="font-mono text-[9px] tracking-[0.28em] uppercase opacity-60">{t.k}</div>
              <div className="font-editorial italic text-4xl md:text-5xl leading-[1.15] mt-2">{t.v}</div>
              <div className="font-mono text-[9px] tracking-[0.22em] uppercase opacity-50 mt-2">{t.tail}</div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 mb-14 hairline-t hairline-b hairline-l hairline-r animate-pulse">
          {["LIVE BRIEFS", "IN PROGRESS", "APPLICATIONS", "ESCROW HELD", "PAID TO CREATORS", "CONVERSATIONS"].map((label, i) => (
            <div key={i} className={`p-5 md:p-6 ${i < 5 ? "hairline-r" : ""} ${i < 3 ? "md:hairline-b" : ""}`}>
              <div className="font-mono text-[9px] tracking-[0.28em] uppercase opacity-40">{label}</div>
              <div className="h-10 w-24 bg-white/10 my-2 rounded-xs" />
              <div className="h-3 w-16 bg-white/5 rounded-xs" />
            </div>
          ))}
        </div>
      )}
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

      <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-6 mt-12">
        Recommended Creators · {matches.length}
      </h2>
      {matches.length === 0 ? (
        <Empty label="No matches found." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {matches.slice(0, 4).map((c) => (
            <Link key={c.id} to={`/creators/${c.id}`} className="hairline-t hairline-b hairline-l hairline-r flex flex-col hover:bg-white/5 transition">
              {c.avatar && (
                <div className="h-48 w-full border-b border-[#F4F4F0]/10 overflow-hidden">
                  <img src={c.avatar} alt={c.name} className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition duration-500" />
                </div>
              )}
              <div className="p-6 flex flex-col justify-between flex-1">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{c.city || "Unknown"}, {c.state}</div>
                  <h3 className="font-editorial text-2xl leading-tight mt-2">{c.name}</h3>
                  <p className="text-xs font-mono uppercase opacity-70 mt-2 text-[#FF3B30]">{c.niches?.join(", ")}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InfluencerPanel() {
  const [apps, setApps] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/applications/mine").then((r) => setApps(r.data)).catch(() => {});
    api.get("/analytics/creator").then((r) => setStats(r.data)).catch(() => {});
    api.get("/campaigns/match").then((r) => setMatches(r.data)).catch(() => {});
  }, []);
  const tiles = stats ? [
    { k: "Applications", v: stats.applications, tail: "pitched" },
    { k: "Accepted", v: stats.acceptances, tail: "signed" },
    { k: "Invitations", v: stats.invitations, tail: "extended to you" },
    { k: "Deliverables", v: `${stats.approved}/${stats.deliverables}`, tail: "approved / total" },
    { k: "Rating", v: stats.reviews_count ? stats.avg_rating : "—", tail: `${stats.reviews_count} reviews` },
    { k: "Wallet", v: `₹${stats.earned.toLocaleString()}`, tail: "on the books" },
  ] : [];

  return (
    <div>
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 mb-14 hairline-t hairline-b hairline-l hairline-r" data-testid="creator-analytics">
          {tiles.map((t, i) => (
            <motion.div
              key={t.k}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className={`p-5 md:p-6 ${i < tiles.length - 1 ? "hairline-r" : ""} ${i < 3 ? "md:hairline-b" : ""}`}
            >
              <div className="font-mono text-[9px] tracking-[0.28em] uppercase opacity-60">{t.k}</div>
              <div className="font-editorial italic text-4xl md:text-5xl leading-[1.15] mt-2">{t.v}</div>
              <div className="font-mono text-[9px] tracking-[0.22em] uppercase opacity-50 mt-2">{t.tail}</div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 mb-14 hairline-t hairline-b hairline-l hairline-r animate-pulse">
          {["APPLICATIONS", "ACCEPTED", "INVITATIONS", "DELIVERABLES", "RATING", "WALLET"].map((label, i) => (
            <div key={i} className={`p-5 md:p-6 ${i < 5 ? "hairline-r" : ""} ${i < 3 ? "md:hairline-b" : ""}`}>
              <div className="font-mono text-[9px] tracking-[0.28em] uppercase opacity-40">{label}</div>
              <div className="h-10 w-24 bg-white/10 my-2 rounded-xs" />
              <div className="h-3 w-16 bg-white/5 rounded-xs" />
            </div>
          ))}
        </div>
      )}
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
                Rate · ₹{a.rate ? Number(a.rate).toLocaleString() : "—"}
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

      <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-6 mt-12">
        Recommended Briefs · {matches.length}
      </h2>
      {matches.length === 0 ? (
        <Empty label="No matches found." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {matches.slice(0, 3).map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentPanel() {
  const { user } = useAuth();
  const [agentType, setAgentType] = useState(user?.agent_type || "company_agent");
  const [creators, setCreators] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [adminBriefs, setAdminBriefs] = useState([]);
  const [associatedBrands, setAssociatedBrands] = useState(user?.associated_brands || [
    { name: "Acme Luxe Ltd.", industry: "Fashion & Apparel", contact: "brand@acmeluxe.com", status: "Active Client" },
    { name: "HyperTech Global", industry: "Technology & SaaS", contact: "marketing@hypertech.io", status: "Active Client" },
    { name: "Veda Organics", industry: "Health & Wellness", contact: "collab@vedaorganics.in", status: "Active Client" }
  ]);
  const [newBrandModal, setNewBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandIndustry, setNewBrandIndustry] = useState("Fashion & Apparel");

  useEffect(() => {
    api.get("/creators").then((r) => setCreators(r.data)).catch(() => {});
    api.get("/campaigns").then((r) => {
      setCampaigns(r.data);
      setAdminBriefs(r.data.slice(0, 4));
    }).catch(() => {});
  }, []);

  const addBrand = (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const updated = [...associatedBrands, { name: newBrandName, industry: newBrandIndustry, contact: "client@agency.com", status: "Active Client" }];
    setAssociatedBrands(updated);
    setNewBrandName("");
    setNewBrandModal(false);
    toast.success("Brand added to client roster");
    api.patch("/auth/me", { associated_brands: updated }).catch(() => {});
  };

  return (
    <div className="space-y-8">
      {/* AGENT TYPE TOGGLE BAR */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6 flex-wrap gap-4">
        <div>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
            § Talent Agent Console
          </span>
          <h2 className="font-editorial text-3xl md:text-4xl mt-1">
            {agentType === "company_agent" ? "Company & Brand Agent" : "Influencer & Talent Agent"}
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-1.5 border border-white/10 rounded-sm">
          <button
            type="button"
            onClick={() => setAgentType("company_agent")}
            className={`font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded-xs transition-all ${
              agentType === "company_agent"
                ? "bg-[#FF3B30] text-white font-bold shadow-md"
                : "text-white/70 hover:text-white"
            }`}
          >
            🏢 Company Agent
          </button>
          <button
            type="button"
            onClick={() => setAgentType("influencer_agent")}
            className={`font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded-xs transition-all ${
              agentType === "influencer_agent"
                ? "bg-[#FF3B30] text-white font-bold shadow-md"
                : "text-white/70 hover:text-white"
            }`}
          >
            ⭐ Influencer Agent
          </button>
        </div>
      </div>

      {/* TYPE 1: INFLUENCER AGENT VIEW */}
      {agentType === "influencer_agent" ? (
        <div className="space-y-12">
          {/* Section 1: Admin Promotion Briefs & Creator Assignments */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-editorial text-2xl">📋 Admin Promotion Briefs &amp; Creator Assignments</h3>
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-0.5">
                  Admin campaign details — arrange creators from your roster to fulfill briefs
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {adminBriefs.map((brief) => (
                <div key={brief.id} className="p-6 border border-white/10 bg-white/[0.02] flex flex-col justify-between rounded-sm">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-[10px] uppercase text-[#FF3B30] tracking-widest font-bold">
                        Admin Promotion Brief
                      </span>
                      <span className="font-mono text-xs text-[#34C759]">₹{brief.budget?.toLocaleString()} Budget</span>
                    </div>
                    <h4 className="font-editorial text-2xl font-bold">{brief.title}</h4>
                    <p className="font-mono text-xs opacity-70 mt-2 line-clamp-2">{brief.description}</p>
                    <div className="mt-4 font-mono text-[10px] uppercase opacity-60">
                      Deliverables: {brief.deliverables || "1x Reel + Stories"}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase opacity-50">Arrange Influencers</span>
                    <button
                      type="button"
                      onClick={() => toast.success(`Assigned influencers to campaign ${brief.title}`)}
                      className="btn-solid py-2 px-4 text-xs bg-[#FF3B30] text-white hover:bg-[#e03126]"
                    >
                      Arrange Influencer Roster →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Scouted Influencers Roster */}
          <div>
            <h3 className="font-editorial text-2xl mb-4">⭐ Scouted Creator Roster ({creators.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {creators.map((c) => (
                <Link key={c.id} to={`/creators/${c.id}`} className="hairline-t hairline-b hairline-l hairline-r flex flex-col hover:bg-white/5 transition">
                  {c.avatar && (
                    <div className="h-48 w-full border-b border-[#F4F4F0]/10 overflow-hidden">
                      <img src={c.avatar} alt={c.name} className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition duration-500" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col justify-between flex-1">
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{c.city || "Unknown"}</div>
                      <h4 className="font-editorial text-2xl leading-tight mt-2">{c.name}</h4>
                      <p className="text-xs font-mono uppercase opacity-70 mt-2 text-[#FF3B30]">{c.niches?.join(", ")}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* TYPE 2: COMPANY AGENT VIEW */
        <div className="space-y-12">
          {/* Section 1: Associated Brands & Companies */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-editorial text-2xl">🏢 Associated Brands &amp; Companies</h3>
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-0.5">
                  Brand clients represented by your agency
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewBrandModal(true)}
                className="btn-solid text-xs py-2 px-4 bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Associated Brand
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {associatedBrands.map((brand, i) => (
                <div key={i} className="p-6 border border-white/10 bg-white/[0.02] flex flex-col justify-between rounded-sm">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-[10px] uppercase text-[#FF3B30] tracking-widest font-bold">
                        {brand.status || "Active Client"}
                      </span>
                    </div>
                    <h4 className="font-editorial text-3xl font-bold">{brand.name}</h4>
                    <div className="font-mono text-xs text-[#34C759] mt-1">{brand.industry}</div>
                    <div className="font-mono text-[11px] opacity-60 mt-3">{brand.contact}</div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <Link to="/campaigns/new" className="text-xs font-mono text-[#FF3B30] hover:underline flex items-center gap-1">
                      + Post Campaign ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Client Campaigns & Option to Post New Campaign */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-editorial text-2xl">📢 Client Campaigns ({campaigns.length})</h3>
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-0.5">
                  Live campaign briefs created for your associated brand clients
                </p>
              </div>
              <Link to="/campaigns/new" className="btn-solid py-2.5 px-5 text-sm bg-[#FF3B30] text-white flex items-center gap-2">
                <Plus className="w-4 h-4" /> Post New Campaign
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {campaigns.map((c) => (
                <CampaignRow key={c.id} c={c} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal to Add Associated Brand */}
      {newBrandModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#121212] border border-white/20 p-8 max-w-md w-full rounded-sm relative">
            <h3 className="font-editorial text-3xl mb-4">Add Associated Brand Client</h3>
            <form onSubmit={addBrand} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Brand / Company Name *</label>
                <input
                  required
                  className="inp"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Acme Studio Ltd."
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Brand Industry *</label>
                <select
                  className="inp bg-[#121212] cursor-pointer"
                  value={newBrandIndustry}
                  onChange={(e) => setNewBrandIndustry(e.target.value)}
                >
                  <option value="Fashion & Apparel">Fashion & Apparel</option>
                  <option value="Beauty & Cosmetics">Beauty & Cosmetics</option>
                  <option value="Technology & SaaS">Technology & SaaS</option>
                  <option value="Food & Beverages (F&B)">Food & Beverages (F&B)</option>
                  <option value="Luxury Goods">Luxury Goods</option>
                  <option value="Health & Fitness">Health & Fitness</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setNewBrandModal(false)} className="btn-pill">Cancel</button>
                <button type="submit" className="btn-solid bg-[#FF3B30] text-white">Add Brand Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignRow({ c }) {
  const { user } = useAuth();
  const [apps, setApps] = useState(null);
  const load = async () => {
    if (!user || user.role !== "owner") {
        setApps([]);
        return;
    }
    try {
      const { data } = await api.get(`/campaigns/${c.id}/applications`);
      setApps(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to load");
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {user?.role === "owner" ? (apps ? `${apps.length} pitches` : "Loading...") : "Recommended Match"}
        </div>
        <div className="font-editorial italic text-xl">₹{c.budget}</div>
      </div>
      {apps && apps.length > 0 && (
        <div className="mt-4 space-y-1">
          {apps.slice(0, 3).map((a) => (
            <div key={a.id} className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-70 truncate">
              → {a.influencer_name} · ₹{a.rate}
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
