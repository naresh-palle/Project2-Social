import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, Plus, X, Upload, Sparkles, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { toast, Toaster } from "sonner";

const CATEGORIES = [
  "Fashion & Style", "Food & Cooking", "Beauty & Makeup", 
  "Technology & Gadgets", "Fitness & Health", "Lifestyle & Home",
  "Travel & Adventure", "Business & Entrepreneurship", 
  "Entertainment & Gaming", "Education & Learning", "Other"
];
const LANGUAGES = [
  "English", "Hindi", "Assamese", "Bengali", "Bodo", "Dogri", 
  "Gujarati", "Kannada", "Kashmiri", "Konkani", "Maithili", 
  "Malayalam", "Manipuri", "Marathi", "Nepali", "Odia", 
  "Punjabi", "Sanskrit", "Santali", "Sindhi", "Tamil", "Telugu", "Urdu"
];
const CITIES = ["Mumbai", "Bangalore", "Hyderabad", "Delhi", "Pune", "Chennai", "Kolkata", "Pan-India", "Other"];
const AVAILABILITIES = ["Immediately", "2 weeks", "1 month"];
const EXPERIENCES = ["0-6 months", "6-12 months", "1-2 years", "2-5 years", "5+ years"];
const CONTENT_TYPES = [
  "Instagram Posts (Photos)", "Instagram Reels (Short Videos)", "Instagram Stories",
  "YouTube Shorts", "YouTube Long-form", "Twitter/X Threads", "Blog Posts / Articles", "Podcasts"
];
const RESPONSE_TIMES = ["Within 2 hours", "Within 24 hours", "Within 2 days", "Within 1 week"];
const PLATFORMS = ["instagram", "youtube", "twitter", "facebook"];

export default function ProfileEdit() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const avatarRef = useRef(null);
  const portfolioRef = useRef(null);

  useEffect(() => {
    if (user) {
      setF({
        name: user.name || "",
        handle: user.handle || "",
        bio: user.bio || "",
        avatar: user.avatar || "",
        city: user.city || "Bangalore",
        availability: user.availability || "Immediately",
        platform_metrics: user.platform_metrics || {
          instagram: { handle: "", followers: 0, engagement: 0, views: 0 },
          youtube: { handle: "", followers: 0, engagement: 0, views: 0 },
          twitter: { handle: "", followers: 0, engagement: 0, views: 0 },
          facebook: { handle: "", followers: 0, engagement: 0, views: 0 }
        },
        category: user.category || "",
        languages: user.languages || [],
        base_rate: user.base_rate || 0,
        portfolio: user.portfolio || [],
        past_campaigns: user.past_campaigns || [],
        experience: user.experience || "",
        content_types: user.content_types || [],
        response_time: user.response_time || "",
        
        // for owners/agents
        company: user.company || "",
        industry: user.industry || "",
        website: user.website || "",
      });
    }
  }, [user]);

  // Handle Escape key to cancel editing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        nav("/profile");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nav]);

  if (!user || !f) return null;
  const isCreator = user.role === "influencer";

  const toggleArray = (key, val) =>
    setF({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] });

  // Portfolio Images
  const addPortfolio = () => setF({ ...f, portfolio: [...f.portfolio, ""] });
  const setPortfolio = (i, v) => setF({ ...f, portfolio: f.portfolio.map((p, j) => j === i ? v : p) });
  const removePortfolio = (i) => setF({ ...f, portfolio: f.portfolio.filter((_, j) => j !== i) });
  const onPortfolioPick = async (e) => {
    const files = Array.from(e.target.files || []);
    const urls = [];
    for (const file of files) {
      const url = await uploadImage(file);
      if (url) urls.push(url);
    }
    if (urls.length) { setF({ ...f, portfolio: [...f.portfolio, ...urls] }); toast.success(`${urls.length} image(s) added.`); }
    e.target.value = "";
  };

  // Past Campaigns
  const addCampaign = () => setF({ ...f, past_campaigns: [...f.past_campaigns, { brand: "", title: "", result: "", date: "" }] });
  const setCampaign = (i, key, v) => {
    const c = [...f.past_campaigns];
    c[i] = { ...c[i], [key]: v };
    setF({ ...f, past_campaigns: c });
  };
  const removeCampaign = (i) => setF({ ...f, past_campaigns: f.past_campaigns.filter((_, j) => j !== i) });

  const onAvatarPick = async (e) => {
    const url = await uploadImage(e.target.files?.[0]);
    if (url) { setF({ ...f, avatar: url }); toast.success("Avatar uploaded."); }
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/auth/me", {
        ...f,
        base_rate: Number(f.base_rate) || 0,
        portfolio: f.portfolio.filter(Boolean),
        past_campaigns: f.past_campaigns.filter(c => c.brand || c.title)
      });
      await refresh();
      toast.success("Profile saved.");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  const runAiCuration = async () => {
    setAiBusy(true);
    try {
      const { data } = await api.post("/ai/suggest-profile", { 
          handle: f.handle, 
          name: f.name,
          bio: f.bio,
          niches: [f.category || "General"],
          city: f.city,
          state: f.state,
          languages: f.languages,
          experience: f.experience,
          content_types: f.content_types,
          platform_metrics: f.platform_metrics
      });
      if (data.bio) setF(prev => ({ ...prev, bio: data.bio }));
      if (data.portfolio && Array.isArray(data.portfolio)) {
          setF(prev => ({ ...prev, portfolio: [...prev.portfolio.filter(Boolean), ...data.portfolio] }));
      }
      if (data.category) setF(prev => ({ ...prev, category: data.category }));
      if (data.languages) setF(prev => ({ ...prev, languages: data.languages }));
      if (data.experience) setF(prev => ({ ...prev, experience: data.experience }));
      if (data.content_types) setF(prev => ({ ...prev, content_types: data.content_types }));
      if (data.response_time) setF(prev => ({ ...prev, response_time: data.response_time }));
      if (data.base_rate) setF(prev => ({ ...prev, base_rate: data.base_rate }));
      if (data.availability) setF(prev => ({ ...prev, availability: data.availability }));
      if (data.past_campaigns) setF(prev => ({ ...prev, past_campaigns: data.past_campaigns }));
      if (data.platform_metrics) {
         setF(prev => ({
             ...prev, 
             platform_metrics: {
                 ...prev.platform_metrics,
                 ...data.platform_metrics
             }
         }));
      }
      toast.success("AI Curation applied.");
    } catch (e) {
      toast.error("AI curation failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const refreshAnalytics = async () => {
    setSyncBusy(true);
    try {
      const { data } = await api.post("/creators/sync-analytics");
      
      if (data.message.includes("No social media platforms connected")) {
          toast.info(data.message);
      } else {
          toast.success(data.message);
      }
      
      setF(prev => ({ 
          ...prev, 
          platform_metrics: data.metrics || prev.platform_metrics,
          monthly_analytics: data.monthly_analytics || prev.monthly_analytics
      }));
    } catch (e) {
      toast.error("Failed to sync analytics.");
    } finally {
      setSyncBusy(false);
    }
  };

  const getCompletion = () => {
    if (!isCreator) return 100;
    let score = 0;
    if (f.name) score += 10;
    if (f.bio) score += 15;
    if (f.avatar) score += 10;
    if (f.city) score += 5;
    if (f.category) score += 15;
    if (f.languages?.length) score += 5;
    if (f.base_rate > 0) score += 5;
    if (f.portfolio?.length) score += 15;
    if (Object.values(f.platform_metrics || {}).some(p => p && p.handle)) score += 20;
    return score;
  };
  const completion = getCompletion();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-4xl mx-auto px-6 md:px-10 pb-24 relative">
        {/* Close Button */}
        <button 
          type="button" 
          onClick={() => nav("/profile")} 
          className="absolute top-10 right-6 md:right-10 p-2 opacity-50 hover:opacity-100 transition-opacity"
          title="Close (Esc)"
        >
          <X className="w-8 h-8" />
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Edit profile</p>
                <h1 className="font-editorial text-6xl md:text-7xl leading-[1.15] mt-2">
                Your <span className="italic">file</span><span className="tick">.</span>
                </h1>
            </div>
            {isCreator && (
                <div className="flex flex-col items-end gap-4">
                  <div className="flex items-center gap-4">
                      <div className="text-right">
                          <div className="font-editorial text-2xl text-[#FF3B30]">{completion}%</div>
                          <div className="font-mono text-[9px] tracking-widest uppercase opacity-60">Profile Completion</div>
                      </div>
                      <div className="w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-[#FF3B30] opacity-20" style={{ height: `${completion}%`, top: 'auto', bottom: 0 }} />
                      </div>
                  </div>
                    <button type="button" onClick={refreshAnalytics} disabled={syncBusy} className="btn-outline border-white/20 hover:border-white px-4 py-2">
                        {syncBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {syncBusy ? "Syncing…" : "Refresh Analytics"}
                    </button>
                </div>
            )}
        </div>

        <motion.form onSubmit={submit} className="mt-16 space-y-16" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          
          {/* SECTION 1: BASIC */}
          <section className="space-y-6">
              <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">1. Basic</h2>
              <F label="Name *"><input required className="inp" value={f.name} onChange={e=>setF({...f,name:e.target.value})} /></F>
              {isCreator ? (
                <F label="Handle / Username *"><input required className="inp" value={f.handle} onChange={e=>setF({...f,handle:e.target.value})} /></F>
              ) : (
                <>
                  <F label="Company"><input className="inp" value={f.company} onChange={e=>setF({...f,company:e.target.value})} /></F>
                  <F label="Industry"><input className="inp" value={f.industry} onChange={e=>setF({...f,industry:e.target.value})} /></F>
                  <F label="Website"><input className="inp" value={f.website} onChange={e=>setF({...f,website:e.target.value})} /></F>
                </>
              )}
              <F label="Bio / About *">
                  <textarea required rows={4} className="inp resize-none" value={f.bio} onChange={e=>setF({...f,bio:e.target.value})} maxLength={500} />
                  <div className="flex justify-between items-center mt-2">
                      {isCreator && (
                          <button type="button" onClick={runAiCuration} disabled={aiBusy} className="btn-solid bg-[#F4F4F0] text-[#0A0A0A] hover:bg-[#FF3B30] hover:text-white px-3 py-1.5 text-[10px]">
                              {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {aiBusy ? "Curating…" : "AI Curation"}
                          </button>
                      )}
                      <div className="text-right text-[10px] opacity-40 flex-1">{f.bio.length}/500</div>
                  </div>
              </F>
              <F label="Profile Picture *">
                <div className="flex items-center gap-4 mt-2">
                  {f.avatar && <img src={f.avatar} alt="" className="w-16 h-16 object-cover hairline-t hairline-b hairline-l hairline-r" />}
                  <input ref={avatarRef} type="file" accept="image/*,video/*" hidden onChange={onAvatarPick} />
                  <div 
                      onClick={()=>avatarRef.current?.click()}
                      className="inp flex-1 flex items-center justify-center gap-2 cursor-pointer opacity-80 hover:opacity-100 transition"
                  >
                      <Upload className="w-4 h-4" />
                      <span>Add Image/s and Upload Videos</span>
                  </div>
                </div>
              </F>
          </section>

          {/* LANGUAGES (Available for all) */}
          <section className="space-y-6">
              <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">Languages You Speak</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {LANGUAGES.map(lang => (
                      <label key={lang} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={f.languages.includes(lang)} onChange={()=>toggleArray("languages", lang)} className="accent-[#FF3B30] w-4 h-4" />
                          <span className="text-sm">{lang}</span>
                      </label>
                  ))}
              </div>
          </section>

          {isCreator && (
            <>
              {/* SECTION 2: LOCATION */}
              <section className="space-y-6">
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">2. Location & Availability</h2>
                  <div className="grid grid-cols-2 gap-6">
                      <F label="City *">
                          <select required className="inp" value={f.city} onChange={e=>setF({...f,city:e.target.value})}>
                              <option value="" className="bg-[#0A0A0A]">Select City...</option>
                              {CITIES.map(c => <option key={c} value={c} className="bg-[#0A0A0A]">{c}</option>)}
                          </select>
                      </F>
                      <F label="Availability *">
                          <select required className="inp" value={f.availability} onChange={e=>setF({...f,availability:e.target.value})}>
                              <option value="" className="bg-[#0A0A0A]">Select Availability...</option>
                              {AVAILABILITIES.map(a => <option key={a} value={a} className="bg-[#0A0A0A]">{a}</option>)}
                          </select>
                      </F>
                  </div>
              </section>

              {/* SECTION 3: SOCIAL */}
              <section className="space-y-6">
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">3. Our Social Presence</h2>
                  <p className="text-xs opacity-60">Enter your handles and metrics. Metrics are publicly visible. Connect Facebook, Instagram, YouTube, and Twitter.</p>
                  
                  {PLATFORMS.map(plat => {
                      const isConnected = !!f.platform_metrics[plat]?.handle;
                      return (
                      <div key={plat} className={`p-6 border transition-colors ${isConnected ? "border-[#34C759] bg-[#34C759]/5" : "border-white/10 bg-white/[0.02]"}`}>
                          <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-2 font-editorial text-3xl capitalize text-[#FF3B30]">
                                  {plat} {plat === "instagram" && "*"}
                                  {isConnected && <CheckCircle2 className="w-5 h-5 text-[#34C759]" />}
                              </div>
                              {f.platform_metrics[plat]?.last_synced && (
                                  <div className="font-mono text-[9px] tracking-widest opacity-50">Last synced: {new Date(f.platform_metrics[plat].last_synced).toLocaleDateString()}</div>
                              )}
                          </div>
                          
                          <F label={`${plat} Handle`}>
                              <input required={plat==="instagram"} className="inp font-mono text-sm" 
                                     value={f.platform_metrics[plat]?.handle || ""} 
                                     onChange={e=>setF({
                                         ...f, 
                                         platform_metrics: {
                                             ...f.platform_metrics, 
                                             [plat]: {...(f.platform_metrics[plat] || {}), handle: e.target.value}
                                         }
                                     })} />
                          </F>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                              <F label={plat==="youtube" ? "Subscribers" : "Followers"}>
                                  <input type="number" className="inp text-xl"
                                         value={f.platform_metrics[plat]?.followers || ""}
                                         onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), followers: Number(e.target.value)}}})} />
                              </F>
                              <F label="Engagement (%)">
                                  <input type="number" step="0.1" className="inp text-xl"
                                         value={f.platform_metrics[plat]?.engagement || ""}
                                         onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), engagement: Number(e.target.value)}}})} />
                              </F>
                              <F label="Views (3M)">
                                  <input type="number" className="inp text-xl"
                                         value={f.platform_metrics[plat]?.views || ""}
                                         onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), views: Number(e.target.value)}}})} />
                              </F>
                              <F label="Posts / Videos">
                                  <input type="number" className="inp text-xl"
                                         value={f.platform_metrics[plat]?.posts || ""}
                                         onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), posts: Number(e.target.value)}}})} />
                              </F>
                          </div>
                      </div>
                  )})}
              </section>

              {/* SECTION 4: NICHE */}
              <section className="space-y-6">
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">4. Content Niche / Category *</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {CATEGORIES.map(c => (
                          <label key={c} className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${f.category === c ? "border-[#FF3B30] bg-[#FF3B30]/10" : "border-white/10 hover:border-white/30"}`}>
                              <input type="radio" name="category" value={c} checked={f.category === c} onChange={e=>setF({...f, category: e.target.value})} className="accent-[#FF3B30]" required />
                              <span className="text-xs font-mono uppercase tracking-widest">{c}</span>
                          </label>
                      ))}
                  </div>
              </section>

              {/* SECTION 5: RATE */}
              <section className="space-y-6">
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">5. Rate</h2>
                  <F label="Base Rate (INR) *">
                      <input type="number" required className="inp font-editorial text-3xl" value={f.base_rate || ""} onChange={e=>setF({...f,base_rate:Number(e.target.value)})} />
                  </F>
              </section>

              {/* SECTION 7: PORTFOLIO */}
              <section className="space-y-6">
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">7. Your Portfolio & Past Work</h2>
                  
                  <F label="Portfolio Images and Videos">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {f.portfolio.map((p, i) => (
                        <div key={i} className="relative group aspect-square bg-black border border-white/10">
                          {p && (p.match(/\.(mp4|webm|ogg)$/i) ? (
                              <video src={p} className="w-full h-full object-cover" controls />
                          ) : (
                              <img src={p} alt="" className="w-full h-full object-cover" />
                          ))}
                          <button type="button" onClick={()=>removePortfolio(i)} className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex mt-6">
                      <input ref={portfolioRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPortfolioPick} />
                      <button type="button" onClick={()=>portfolioRef.current?.click()} className="btn-solid py-4 px-6 text-sm flex-1 justify-center bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white">
                        <Upload className="w-4 h-4" /> Add Image/s and Upload Videos
                      </button>
                    </div>
                  </F>

                  <div className="mt-8">
                      <F label="Past Campaigns (Optional)">
                          <div className="space-y-4 mt-2">
                              {f.past_campaigns.map((c, i) => (
                                  <div key={i} className="p-4 border border-white/10 bg-white/[0.02] relative">
                                      <button type="button" onClick={()=>removeCampaign(i)} className="absolute top-2 right-2 opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
                                      <div className="grid grid-cols-2 gap-4">
                                          <input className="inp" value={c.brand} onChange={e=>setCampaign(i, 'brand', e.target.value)} />
                                          <input className="inp" value={c.date} onChange={e=>setCampaign(i, 'date', e.target.value)} />
                                          <input className="inp col-span-2" value={c.title} onChange={e=>setCampaign(i, 'title', e.target.value)} />
                                          <input className="inp col-span-2" value={c.result} onChange={e=>setCampaign(i, 'result', e.target.value)} />
                                      </div>
                                  </div>
                              ))}
                              <button type="button" onClick={addCampaign} className="btn-pill mt-2">
                                <Plus className="w-4 h-4" /> Add Past Campaign
                              </button>
                          </div>
                      </F>
                  </div>
              </section>

              {/* SECTION 8: ADDITIONAL */}
              <section className="space-y-6">
                  <h2 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 border-b border-white/10 pb-2">8. Additional Information</h2>
                  
                  <F label="Years of Experience *">
                      <select required className="inp" value={f.experience} onChange={e=>setF({...f,experience:e.target.value})}>
                          <option value="" className="bg-[#0A0A0A]">Select Experience...</option>
                          {EXPERIENCES.map(ex => <option key={ex} value={ex} className="bg-[#0A0A0A]">{ex}</option>)}
                      </select>
                  </F>

                  <F label="Response Time *">
                      <select required className="inp" value={f.response_time} onChange={e=>setF({...f,response_time:e.target.value})}>
                          <option value="" className="bg-[#0A0A0A]">Select Response Time...</option>
                          {RESPONSE_TIMES.map(r => <option key={r} value={r} className="bg-[#0A0A0A]">{r}</option>)}
                      </select>
                  </F>

                  <div className="pt-4">
                      <F label="Content Types You Create *">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                              {CONTENT_TYPES.map(type => (
                                  <label key={type} className="flex items-center gap-3 cursor-pointer">
                                      <input type="checkbox" checked={f.content_types.includes(type)} onChange={()=>toggleArray("content_types", type)} className="accent-[#FF3B30] w-4 h-4" />
                                      <span className="text-sm">{type}</span>
                                  </label>
                              ))}
                          </div>
                      </F>
                  </div>
              </section>
            </>
          )}

          <div className="pt-8">
            <button type="submit" disabled={busy} className="btn-solid w-full justify-center py-5 bg-[#FF3B30] text-white text-xl">
              <Save className="w-5 h-5" /> {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </motion.form>
      </div>
      <Footer />
      <style>{`.inp { margin-top: 0.5rem; width: 100%; background: transparent; border-bottom: 1px solid rgba(244,244,240,0.14); padding: 0.75rem 0; outline: none; font-size: 1.05rem; color: #F4F4F0; }
      .inp:focus { border-color: #FF3B30; }`}</style>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">{label}</label>
      {children}
    </div>
  );
}
