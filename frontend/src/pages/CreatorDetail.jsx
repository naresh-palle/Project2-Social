import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Instagram, Youtube, Twitter, Facebook, ArrowUpRight, ArrowDownRight, Activity, TrendingUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { toast, Toaster } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function CreatorDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Chart state
  const [chartRange, setChartRange] = useState(6); // 1, 3, 6, 12 months

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/creators/${id}`);
        setCreator(data);
      } catch (e) {
        toast.error("Failed to load creator");
        nav("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, nav]);

  if (loading) return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#F4F4F0]">
        <div className="animate-pulse font-mono tracking-widest text-sm">Loading Studio...</div>
      </div>
  );
  if (!creator) return null;

  const handleMessage = () => {
    // Nav to messages with pre-selected user. (Stubbed)
    nav(`/messages?compose=${creator.id}`);
  };

  const getFilteredChartData = () => {
    if (!creator.monthly_analytics) return [];
    // Last `chartRange` items
    return creator.monthly_analytics.slice(-chartRange);
  };
  
  const chartData = getFilteredChartData();

  // Pick the best platform to highlight
  const bestPlatform = Object.entries(creator.platform_metrics || {}).reduce((max, [k, v]) => {
      if (!v || !v.followers) return max;
      return (v.followers > (max.val?.followers || 0)) ? {key: k, val: v} : max;
  }, {key: null, val: null});

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      
      {/* HEADER SECTION */}
      <div className="relative pt-24 px-6 md:px-12 max-w-7xl mx-auto">
        <button onClick={() => nav(-1)} className="absolute top-28 left-6 md:left-12 opacity-50 hover:opacity-100 flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase transition-opacity">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-12 gap-12 items-end border-b border-white/10 pb-16">
            <div className="md:col-span-8 flex flex-col md:flex-row gap-8 items-start md:items-end">
                {creator.avatar ? (
                    <img src={creator.avatar} alt={creator.name} className="w-32 h-32 md:w-48 md:h-48 object-cover grayscale contrast-125 border border-white/20 p-2" />
                ) : (
                    <div className="w-32 h-32 md:w-48 md:h-48 border border-white/20 p-2 flex items-center justify-center bg-white/5">
                        <span className="font-editorial text-4xl opacity-50">{creator.name[0]}</span>
                    </div>
                )}
                <div className="flex-1">
                    <div className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2 text-[#FF3B30]">
                        {creator.category || "Creator"} · {creator.city || "Global"}
                    </div>
                    <h1 className="font-editorial text-5xl md:text-7xl leading-none">
                        {creator.name}
                    </h1>
                    <div className="font-mono text-sm opacity-60 mt-4 flex items-center gap-4">
                        <span>{creator.handle || "@creator"}</span>
                        {creator.languages?.length > 0 && (
                            <>
                                <span>·</span>
                                <span>{creator.languages.join(", ")}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="md:col-span-4 flex flex-col items-start md:items-end gap-6 w-full">
                {bestPlatform.key && (
                    <div className="text-left md:text-right w-full">
                        <div className="font-editorial text-4xl md:text-5xl">{bestPlatform.val.followers.toLocaleString()}</div>
                        <div className="font-mono text-[10px] tracking-widest uppercase opacity-60">Total {bestPlatform.key} Audience</div>
                    </div>
                )}
                {user && user.role !== "influencer" && (
                    <button onClick={handleMessage} className="btn-solid w-full md:w-auto flex justify-center bg-[#FF3B30] text-white py-4">
                        <MessageSquare className="w-4 h-4 mr-2" /> Open Conversation
                    </button>
                )}
            </div>
        </div>
      </div>

      <div className="px-6 md:px-12 max-w-7xl mx-auto py-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* LEFT COLUMN: ABOUT & PORTFOLIO */}
          <div className="lg:col-span-4 space-y-16">
              
              <section>
                  <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 border-b border-white/10 pb-4 mb-6">About</h3>
                  <p className="font-serif text-lg leading-relaxed opacity-90">{creator.bio || "No bio provided."}</p>
                  
                  <div className="grid grid-cols-2 gap-6 mt-8">
                      <div>
                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50 mb-1">Base Rate</div>
                          <div className="font-editorial text-2xl text-[#FF3B30]">{creator.base_rate ? `₹${creator.base_rate.toLocaleString()}` : "N/A"}</div>
                      </div>
                      <div>
                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50 mb-1">Availability</div>
                          <div className="font-editorial text-2xl">{creator.availability || "Unknown"}</div>
                      </div>
                      <div className="col-span-2">
                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50 mb-1">Content Types</div>
                          <div className="font-mono text-xs mt-1 leading-relaxed opacity-80">{creator.content_types?.join(" · ") || "Standard Posts"}</div>
                      </div>
                  </div>
              </section>

              {creator.past_campaigns?.length > 0 && (
                  <section>
                      <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 border-b border-white/10 pb-4 mb-6">Past Campaigns</h3>
                      <div className="space-y-6">
                          {creator.past_campaigns.map((c, i) => (
                              <div key={i} className="group">
                                  <div className="font-mono text-xs opacity-50 mb-1">{c.brand} · {c.date}</div>
                                  <div className="font-editorial text-xl">{c.title}</div>
                                  <div className="font-mono text-xs text-[#34C759] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">↳ {c.result}</div>
                              </div>
                          ))}
                      </div>
                  </section>
              )}

          </div>

          {/* RIGHT COLUMN: ANALYTICS */}
          <div className="lg:col-span-8 space-y-16">
              
              {/* PLATFORM CARDS */}
              <section>
                  <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 border-b border-white/10 pb-4 mb-6">Audience Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {["instagram", "youtube", "twitter", "facebook"].map(plat => {
                          const pm = creator.platform_metrics?.[plat];
                          if (!pm || !pm.handle) return null;
                          
                          const Icon = plat === "instagram" ? Instagram : plat === "youtube" ? Youtube : plat === "twitter" ? Twitter : Facebook;
                          const isGrowthPos = pm.growth >= 0;

                          return (
                              <div key={plat} className="p-6 border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
                                  <div className="absolute -right-8 -top-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                      <Icon className="w-48 h-48" />
                                  </div>
                                  <div className="flex justify-between items-start relative z-10">
                                      <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-sm ${plat==='youtube'?'bg-red-500/10 text-red-500':plat==='twitter'?'bg-blue-400/10 text-blue-400':plat==='facebook'?'bg-blue-600/10 text-blue-600':'bg-pink-500/10 text-pink-500'}`}>
                                              <Icon className="w-5 h-5" />
                                          </div>
                                          <div>
                                              <div className="font-mono text-[10px] tracking-widest uppercase capitalize opacity-60">{plat}</div>
                                              <div className="font-mono text-sm">{pm.handle}</div>
                                          </div>
                                      </div>
                                      <div className={`flex items-center gap-1 font-mono text-xs ${isGrowthPos ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                                          {isGrowthPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                          {Math.abs(pm.growth)}%
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4 mt-8 relative z-10">
                                      <div>
                                          <div className="font-editorial text-2xl">{pm.followers.toLocaleString()}</div>
                                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50 mt-1">Audience</div>
                                      </div>
                                      <div>
                                          <div className="font-editorial text-2xl">{pm.engagement}%</div>
                                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50 mt-1">Engagement</div>
                                      </div>
                                      <div>
                                          <div className="font-editorial text-2xl">{(pm.views / 1000).toFixed(1)}K</div>
                                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-50 mt-1">Avg Views</div>
                                      </div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </section>

              {/* HISTORICAL CHARTS */}
              {chartData.length > 0 && (
                  <section>
                      <div className="flex justify-between items-end border-b border-white/10 pb-4 mb-8">
                          <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60">Performance Trends</h3>
                          <div className="flex gap-2">
                              {[1, 3, 6, 12].map(r => (
                                  <button key={r} onClick={() => setChartRange(r)} className={`font-mono text-[9px] tracking-widest uppercase px-3 py-1 border transition-colors ${chartRange === r ? 'border-[#FF3B30] text-[#FF3B30]' : 'border-white/10 opacity-50 hover:opacity-100'}`}>
                                      {r === 1 ? '30D' : r === 3 ? '90D' : `${r}M`}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-12">
                          <div className="h-64">
                              <div className="font-mono text-xs mb-4 flex items-center gap-2 opacity-80"><Users className="w-4 h-4 text-[#FF3B30]" /> Follower Growth</div>
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={chartData}>
                                      <defs>
                                          <linearGradient id="colorF" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor="#FF3B30" stopOpacity={0}/>
                                          </linearGradient>
                                      </defs>
                                      <XAxis dataKey="month" stroke="rgba(244,244,240,0.2)" fontSize={10} tickMargin={10} />
                                      <YAxis stroke="rgba(244,244,240,0.2)" fontSize={10} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                      <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(244,244,240,0.1)' }} itemStyle={{ color: '#F4F4F0' }} />
                                      <Area type="monotone" dataKey="followers" stroke="#FF3B30" fillOpacity={1} fill="url(#colorF)" />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>

                          <div className="h-64">
                              <div className="font-mono text-xs mb-4 flex items-center gap-2 opacity-80"><Activity className="w-4 h-4 text-[#34C759]" /> Engagement Rate (%)</div>
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={chartData}>
                                      <defs>
                                          <linearGradient id="colorE" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#34C759" stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor="#34C759" stopOpacity={0}/>
                                          </linearGradient>
                                      </defs>
                                      <XAxis dataKey="month" stroke="rgba(244,244,240,0.2)" fontSize={10} tickMargin={10} />
                                      <YAxis stroke="rgba(244,244,240,0.2)" fontSize={10} />
                                      <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(244,244,240,0.1)' }} itemStyle={{ color: '#F4F4F0' }} />
                                      <Area type="monotone" dataKey="engagement" stroke="#34C759" fillOpacity={1} fill="url(#colorE)" />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  </section>
              )}

              {/* PORTFOLIO GRID */}
              {creator.portfolio?.length > 0 && (
                  <section>
                      <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 border-b border-white/10 pb-4 mb-6">Visual Portfolio</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {creator.portfolio.map((img, i) => (
                              <img key={i} src={img} alt="" className="w-full h-48 object-cover grayscale hover:grayscale-0 transition-all duration-500" />
                          ))}
                      </div>
                  </section>
              )}

          </div>
      </div>
      <Footer />
    </div>
  );
}
