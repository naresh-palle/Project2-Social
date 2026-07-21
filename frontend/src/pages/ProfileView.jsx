import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { toast, Toaster } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ProfileView() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [chartRange, setChartRange] = useState(6);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/auth/me");
        setProfile(data);
      } catch (e) {
        toast.error("Failed to load profile");
        nav("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [nav]);

  if (loading) return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#F4F4F0]">
        <div className="animate-pulse font-mono tracking-widest text-sm">Loading Studio...</div>
      </div>
  );
  if (!profile) return null;

  const isCreator = profile.role === "influencer";

  const getFilteredChartData = () => {
    if (!profile.monthly_analytics) return [];
    return profile.monthly_analytics.slice(-chartRange);
  };
  
  const chartData = getFilteredChartData();

  const bestPlatform = Object.entries(profile.platform_metrics || {}).reduce((max, [k, v]) => {
      if (!v || !v.followers) return max;
      return (v.followers > (max.val?.followers || 0)) ? {key: k, val: v} : max;
  }, {key: null, val: null});

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      
      <div className="relative pt-24 px-6 md:px-12 max-w-7xl mx-auto">
        <button onClick={() => nav(-1)} className="absolute top-28 left-6 md:left-12 opacity-50 hover:opacity-100 flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase transition-opacity">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        <div className="mt-16 flex flex-col md:flex-row gap-12 items-end border-b border-white/10 pb-16 justify-between">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
                {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-32 h-32 md:w-48 md:h-48 object-cover grayscale contrast-125 border border-white/20 p-2" />
                ) : (
                    <div className="w-32 h-32 md:w-48 md:h-48 border border-white/20 p-2 flex items-center justify-center bg-white/5">
                        <span className="font-editorial text-4xl opacity-50">{profile.name?.[0]}</span>
                    </div>
                )}
                <div className="flex-1">
                    <div className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2 text-[#FF3B30]">
                        {profile.category || (isCreator ? "Creator" : "Brand")} · {profile.city || "Global"}
                    </div>
                    <h1 className="font-editorial text-5xl md:text-7xl leading-none">
                        {profile.name}
                    </h1>
                    <div className="font-mono text-sm opacity-60 mt-4 flex items-center gap-4">
                        <span>{profile.handle || "@profile"}</span>
                        {profile.languages?.length > 0 && (
                            <>
                                <span>·</span>
                                <span>{profile.languages.join(", ")}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div>
                <Link to="/profile/edit" className="btn-solid flex items-center gap-2">
                    <Edit2 className="w-4 h-4" /> Edit Profile
                </Link>
            </div>
        </div>

        <div className="py-16 grid grid-cols-1 md:grid-cols-12 gap-16">
            <div className={isCreator ? "md:col-span-4 space-y-12" : "md:col-span-12 space-y-12"}>
                <div>
                    <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">About</h3>
                    <p className="font-editorial italic text-2xl md:text-3xl leading-relaxed break-words whitespace-normal max-w-full">
                        {profile.bio || "No bio available."}
                    </p>
                </div>
                
                {isCreator && (
                    <>
                        <div className="hairline-t pt-8">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">Content Formats</h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.content_types?.map(t => (
                                    <span key={t} className="px-3 py-1 bg-white/5 border border-white/10 text-xs">{t}</span>
                                ))}
                            </div>
                        </div>

                        <div className="hairline-t pt-8">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-4">Details</h3>
                            <dl className="space-y-4 text-sm font-mono uppercase tracking-wider">
                                <div className="flex justify-between"><dt className="opacity-50">Experience</dt><dd>{profile.experience || "N/A"}</dd></div>
                                <div className="flex justify-between"><dt className="opacity-50">Base Rate</dt><dd>₹{profile.base_rate || 0}</dd></div>
                                <div className="flex justify-between"><dt className="opacity-50">Response Time</dt><dd>{profile.response_time || "N/A"}</dd></div>
                            </dl>
                        </div>
                    </>
                )}
            </div>

            <div className="md:col-span-8 space-y-16">
                {isCreator && chartData.length > 0 && (
                    <motion.div initial={{opacity:0, y:20}} whileInView={{opacity:1, y:0}} viewport={{once:true}} className="border border-white/10 bg-[#111] p-6 relative">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h2 className="font-editorial text-3xl">Audience Growth</h2>
                                <p className="font-mono text-[10px] tracking-widest uppercase opacity-50 mt-1">Aggregated Reach</p>
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorFoll" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#FF3B30" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                                    <Tooltip contentStyle={{backgroundColor:'#0A0A0A', borderColor:'rgba(255,255,255,0.1)', fontSize:'12px'}} itemStyle={{color:'#F4F4F0'}} />
                                    <Area type="monotone" dataKey="followers" stroke="#FF3B30" strokeWidth={2} fillOpacity={1} fill="url(#colorFoll)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                )}

                {isCreator && profile.portfolio?.length > 0 && (
                    <div>
                        <h2 className="font-editorial text-4xl mb-8">Selected Work</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {profile.portfolio.map((media, i) => (
                                <div key={i} className="aspect-[16/10] max-h-[260px] bg-white/5 border border-white/10 relative group overflow-hidden rounded-sm">
                                    {media && media.match(/\.(mp4|webm|ogg)$/i) ? (
                                        <video src={media} controls className="w-full h-full object-cover" />
                                    ) : (
                                        <img src={media} alt={`Work ${i+1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
