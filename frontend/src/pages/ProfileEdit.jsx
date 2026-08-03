import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, Plus, X, Upload, Sparkles, Loader2, RefreshCw, CheckCircle2, Crop } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { toast, Toaster } from "sonner";
import { ImageCropModal } from "@/components/ImageCropModal";
import { DateField } from "@/components/DateField";

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
  const [cropState, setCropState] = useState(null); // { src, aspect, target: 'avatar'|'cover' }
  const avatarRef = useRef(null);
  const coverRef = useRef(null);
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
        agent_type: user.agent_type || "company_agent",
        cover_photo: user.cover_photo || "",
        date_of_birth: user.date_of_birth || "",
        gender: user.gender || "",
        is_private: user.is_private || false,
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

  // Past Campaigns (Max 5 Limit with Full Details Requirement)
  const addCampaign = () => {
    if (f.past_campaigns.length >= 5) {
      toast.error("Maximum limit reached: You can add at most 5 past campaigns.");
      return;
    }

    const incompleteIndex = f.past_campaigns.findIndex(
      c => !c.brand?.trim() || !c.title?.trim() || !c.date?.trim() || !c.result?.trim() || !c.post_url?.trim()
    );

    if (incompleteIndex !== -1) {
      toast.error(`Please enter full details (Brand, Title, Date, Result, Post Link) for Campaign #${incompleteIndex + 1} before adding a new row.`);
      return;
    }

    setF({ 
      ...f, 
      past_campaigns: [...f.past_campaigns, { brand: "", title: "", date: "", result: "", post_url: "" }] 
    });
  };
  const setCampaign = (i, key, v) => {
    const c = [...f.past_campaigns];
    c[i] = { ...c[i], [key]: v };
    setF({ ...f, past_campaigns: c });
  };
  const removeCampaign = (i) => setF({ ...f, past_campaigns: f.past_campaigns.filter((_, j) => j !== i) });

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const src = URL.createObjectURL(file);
    setCropState({ src, aspect: 1, target: "avatar", title: "Crop profile picture" });
  };

  const onCoverPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const src = URL.createObjectURL(file);
    setCropState({ src, aspect: 16 / 5, target: "cover", title: "Crop cover photo" });
  };

  const onCropComplete = async (file) => {
    const target = cropState?.target;
    const prevSrc = cropState?.src;
    setCropState(null);
    if (prevSrc) URL.revokeObjectURL(prevSrc);
    const url = await uploadImage(file);
    if (!url) {
      toast.error("Upload failed.");
      return;
    }
    if (target === "avatar") {
      setF((prev) => ({ ...prev, avatar: url }));
      toast.success("Avatar uploaded. You can re-crop anytime before saving.");
    } else {
      setF((prev) => ({ ...prev, cover_photo: url }));
      toast.success("Cover photo uploaded.");
    }
  };

  const recropAvatar = () => {
    if (!f.avatar) return;
    setCropState({ src: f.avatar, aspect: 1, target: "avatar", title: "Edit profile picture crop" });
  };

  const recropCover = () => {
    if (!f.cover_photo) return;
    setCropState({ src: f.cover_photo, aspect: 16 / 5, target: "cover", title: "Edit cover crop" });
  };

  const submit = async (e) => {
    e.preventDefault();

    // Client-side section validation & auto-scroll to missing data
    if (!f.name || f.name.trim() === "") {
      toast.error("Missing Data: Please enter your Name in Section 1.");
      document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!f.bio || f.bio.trim() === "") {
      toast.error("Missing Data: Please enter your Bio / About in Section 1.");
      document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!f.avatar) {
      toast.error("Missing Data: Please upload a Profile Picture in Section 1.");
      document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!f.city || f.city.trim() === "") {
      toast.error("Missing Data: Please enter your City / Location in Section 2.");
      document.getElementById("sec-location")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!isCreator) {
      if (!f.company?.trim()) {
        toast.error("Missing Data: Company / Brand Name is required.");
        document.getElementById("sec-company")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!f.industry?.trim()) {
        toast.error("Missing Data: Brand Industry is required.");
        document.getElementById("sec-company")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!f.website?.trim()) {
        toast.error("Missing Data: Official Website URL is required.");
        document.getElementById("sec-company")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    if (isCreator) {
      if (!f.handle?.trim()) {
        toast.error("Missing Data: Creator Handle is required in Section 1.");
        document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!f.platform_metrics?.instagram?.handle?.trim()) {
        toast.error("Missing Data: Instagram handle is required in Social Presence.");
        document.getElementById("sec-social")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const cats = Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : []);
      if (cats.length === 0) {
        toast.error("Missing Data: Please select at least one Content Niche / Category in Section 4.");
        document.getElementById("sec-niche")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!f.base_rate || Number(f.base_rate) <= 0) {
        toast.error("Missing Data: Please specify your Pricing & Rates in Section 5.");
        document.getElementById("sec-rate")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const validPast = f.past_campaigns.filter(c => c.brand?.trim() || c.title?.trim() || c.post_url?.trim());
      if (validPast.length === 0) {
        toast.error("Missing Data: Past Campaigns are required. Please add at least 1 Past Campaign in Section 6.");
        document.getElementById("sec-campaigns")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const incomplete = validPast.find(c => !c.brand?.trim() || !c.title?.trim() || !c.date?.trim() || !c.result?.trim() || !c.post_url?.trim());
      if (incomplete) {
        toast.error("Incomplete Campaign Details: Please enter full details (Brand, Title, Date, Result, Post Link) for all past campaigns.");
        document.getElementById("sec-campaigns")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!f.experience?.trim()) {
        toast.error("Missing Data: Years of Experience is required in Section 7.");
        document.getElementById("sec-content-types")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!f.response_time?.trim()) {
        toast.error("Missing Data: Response Time is required in Section 7.");
        document.getElementById("sec-content-types")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!f.content_types || f.content_types.length === 0) {
        toast.error("Missing Data: Please select at least one Content Type You Create in Section 7.");
        document.getElementById("sec-content-types")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

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
      nav("/profile");
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

  const INDUSTRIES = [
    "Fashion & Apparel", "Beauty & Cosmetics", "E-Commerce & Retail", 
    "Technology & SaaS", "Food & Beverages (F&B)", "Health & Fitness", 
    "Gaming & Esports", "Luxury Goods", "Travel & Hospitality", 
    "Entertainment & Media", "Automotive", "Financial & FinTech", "Other"
  ];

  const getCompletionDetails = () => {
    let score = 0;
    const missing = [];

    if (f.name?.trim()) score += 10; else missing.push("Name");
    if (f.avatar) score += 15; else missing.push("Profile Picture");
    if (f.bio?.trim()) score += 15; else missing.push("Bio / About");
    if (f.city?.trim()) score += 10; else missing.push("Location / City");

    if (isCreator) {
      if (f.handle?.trim()) score += 10; else missing.push("Handle");
      const cats = Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : []);
      if (cats.length > 0) score += 10; else missing.push("Category / Niche");
      if (Number(f.base_rate) > 0) score += 10; else missing.push("Base Rate");
      if (f.past_campaigns?.length > 0) score += 10; else missing.push("Past Campaigns");
      if (Object.values(f.platform_metrics || {}).some(p => p && p.handle)) score += 10; else missing.push("Social Handle");
    } else {
      if (f.company?.trim()) score += 20; else missing.push("Company Name");
      if (f.industry?.trim()) score += 15; else missing.push("Brand Industry");
      if (f.website?.trim()) score += 15; else missing.push("Website URL");
    }

    return { score: Math.min(100, score), missing };
  };
  const { score: completion, missing: missingFields } = getCompletionDetails();

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-4xl mx-auto px-6 md:px-10 pb-24 relative">
        {/* Floating Close Button */}
        <button 
          type="button" 
          onClick={() => nav("/profile")} 
          className="fixed top-24 right-6 md:right-12 p-3 bg-[#1A1A1A] border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-2xl transition-all duration-300 z-50 group"
          title="Close (Esc)"
          data-testid="profile-edit-close-btn"
        >
          <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <p className="font-sans text-[11px] tracking-[0.22em] uppercase text-[#FF3B30] font-semibold">§ Edit profile</p>
                <h1 className="font-editorial text-6xl md:text-7xl leading-[1.15] mt-2">
                Your <span className="italic">file</span><span className="tick">.</span>
                </h1>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-4 bg-white/5 p-3 border border-white/10 rounded-sm">
                  <div className="text-right">
                      <div className="font-editorial text-3xl font-bold text-[#FF3B30]">{completion}%</div>
                      <div className="font-mono text-[9px] tracking-widest uppercase opacity-70">Profile Completion Meter</div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-[#FF3B30]/30 flex items-center justify-center relative overflow-hidden bg-white/5">
                      <div className="absolute inset-0 bg-[#FF3B30] opacity-30 transition-all duration-500" style={{ height: `${completion}%`, top: 'auto', bottom: 0 }} />
                      <span className="font-mono text-xs font-bold z-10 text-white">{completion}%</span>
                  </div>
              </div>
              {missingFields.length > 0 && (
                <div className="font-mono text-[9px] uppercase tracking-wider text-orange-400">
                  Missing to 100%: {missingFields.slice(0, 3).join(" · ")}
                </div>
              )}
            </div>
        </div>

        <motion.form onSubmit={submit} className="mt-16 space-y-16" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          
          {/* SECTION 1: BASIC & BRAND COMPANY DETAILS */}
          <section id="sec-basic" className="space-y-6">
              <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">01</span>
                Basic &amp; Brand Details
              </h2>
              <F label="Full Name *"><input required className="inp" value={f.name} onChange={e=>setF({...f,name:e.target.value})} /></F>
              
              {!isCreator && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2" id="sec-company">
                  <F label="Company / Brand Name *">
                    <input 
                      required 
                      className="inp" 
                      value={f.company || ""} 
                      onChange={e=>setF({...f, company: e.target.value})} 
                      placeholder=""
                    />
                  </F>
                  <F label="Brand Industry Category *">
                    <select 
                      required 
                      className="inp bg-[#0B0B0E] cursor-pointer" 
                      value={f.industry || ""} 
                      onChange={e=>setF({...f, industry: e.target.value})}
                    >
                      <option value="" className="bg-[#0B0B0E]">Select Industry Category...</option>
                      {INDUSTRIES.map(ind => (
                        <option key={ind} value={ind} className="bg-[#0B0B0E]">{ind}</option>
                      ))}
                    </select>
                  </F>
                  <F label="Official Website URL *">
                    <input 
                      type="url"
                      required 
                      className="inp font-mono text-sm" 
                      value={f.website || ""} 
                      onChange={e=>setF({...f, website: e.target.value})} 
                      placeholder=""
                    />
                  </F>
                </div>
              )}

              {isCreator && (
                <F label="Creator Handle / Username *">
                  <input required className="inp font-mono text-sm" value={f.handle} onChange={e=>setF({...f,handle:e.target.value})} placeholder="" />
                </F>
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
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {f.avatar && <img src={f.avatar} alt="Profile Avatar" className="w-16 h-16 object-cover border border-white/20 p-1 rounded-sm" />}
                  <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
                  <button 
                      type="button"
                      onClick={()=>avatarRef.current?.click()}
                      className="btn-solid bg-white/10 hover:bg-[#FF3B30] text-white px-4 py-2.5 text-xs flex items-center gap-2 cursor-pointer transition"
                  >
                      <Upload className="w-4 h-4" />
                      <span>{f.avatar ? "Replace Profile Pic" : "Upload Profile Pic"}</span>
                  </button>
                  {f.avatar && (
                    <button
                      type="button"
                      onClick={recropAvatar}
                      className="btn-solid bg-white/5 hover:bg-white/15 text-white px-4 py-2.5 text-xs flex items-center gap-2"
                    >
                      <Crop className="w-4 h-4" /> Edit crop
                    </button>
                  )}
                </div>
              </F>
              <F label="Cover Photo">
                <div className="mt-2 space-y-2">
                  {f.cover_photo && (
                    <img src={f.cover_photo} alt="Cover" className="w-full h-32 object-cover border border-white/20 rounded-xs" />
                  )}
                  <input ref={coverRef} type="file" accept="image/*" hidden onChange={onCoverPick} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => coverRef.current?.click()} className="btn-solid bg-white/10 hover:bg-[#FF3B30] text-white px-4 py-2 text-xs flex items-center gap-2">
                      <Upload className="w-4 h-4" /> {f.cover_photo ? "Replace Cover" : "Upload Cover"}
                    </button>
                    {f.cover_photo && (
                      <button type="button" onClick={recropCover} className="btn-solid bg-white/5 hover:bg-white/15 text-white px-4 py-2 text-xs flex items-center gap-2">
                        <Crop className="w-4 h-4" /> Edit crop
                      </button>
                    )}
                  </div>
                </div>
              </F>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <F label="Date of Birth">
                  <DateField value={f.date_of_birth || ""} onChange={(v) => setF({ ...f, date_of_birth: v })} placeholder="Select date of birth" />
                </F>
                <F label="Gender">
                  <select className="inp bg-[#0B0B0E] cursor-pointer" value={f.gender || ""} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                    <option value="" className="bg-[#0B0B0E]">Prefer not to say</option>
                    <option value="female" className="bg-[#0B0B0E]">Female</option>
                    <option value="male" className="bg-[#0B0B0E]">Male</option>
                    <option value="non-binary" className="bg-[#0B0B0E]">Non-binary</option>
                    <option value="other" className="bg-[#0B0B0E]">Other</option>
                  </select>
                </F>
              </div>
              <label className="flex items-center justify-between py-3 border border-white/10 px-4 rounded-xs cursor-pointer">
                <div>
                  <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 block">Private Account</span>
                  <span className="font-mono text-xs opacity-50">Only approved followers see your posts</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!f.is_private}
                  onChange={(e) => setF({ ...f, is_private: e.target.checked })}
                  className="accent-[#FF3B30] w-5 h-5"
                />
              </label>
          </section>

          {/* LANGUAGES YOU SPEAK (Multi-Select Dropdown & Pills for All Users) */}
          <section className="space-y-6">
              <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                Languages You Speak
              </h2>
              <div className="space-y-4">
                  <F label="Select Languages (Multi-Select)">
                      <select 
                        className="inp cursor-pointer bg-[#0B0B0E]"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !f.languages.includes(val)) {
                            setF({ ...f, languages: [...f.languages, val] });
                          }
                          e.target.value = "";
                        }}
                      >
                        <option value="" className="bg-[#0B0B0E]">Select a language to add...</option>
                        {LANGUAGES.filter(lang => !f.languages.includes(lang)).map(lang => (
                          <option key={lang} value={lang} className="bg-[#0B0B0E]">{lang}</option>
                        ))}
                      </select>
                  </F>
                  
                  {/* Selected Languages Pills */}
                  {f.languages?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                          {f.languages.map(lang => (
                              <span key={lang} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs font-mono rounded-sm">
                                  {lang}
                                  <button type="button" onClick={() => toggleArray("languages", lang)} className="hover:text-white transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                  </button>
                              </span>
                          ))}
                      </div>
                  )}
              </div>
          </section>

          {/* SECTION 2: LOCATION & REGION (Available for all roles) */}
          <section id="sec-location" className="space-y-6">
              <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">02</span>
                Location &amp; Region Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <F label="City / Location *">
                      <input 
                        required
                        className="inp" 
                        value={f.city || ""} 
                        onChange={e=>setF({...f, city: e.target.value})} 
                        placeholder=""
                      />
                  </F>
                  <F label="State / Region">
                      <input 
                        className="inp" 
                        value={f.state || ""} 
                        onChange={e=>setF({...f, state: e.target.value})} 
                        placeholder=""
                      />
                  </F>
              </div>
          </section>

          {/* SECTION 3: OUR SOCIAL PRESENCE (Available for Creators & Brands, 4 in a Row) */}
          <section id="sec-social" className="space-y-6">
              <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">03</span>
                Social Presence &amp; Brand Accounts
              </h2>
              <p className="font-sans text-sm opacity-60">Enter official social handles and audience reach (Instagram, YouTube, Twitter/X, Facebook).</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {PLATFORMS.map(plat => {
                        const isConnected = !!f.platform_metrics[plat]?.handle;
                        return (
                        <div key={plat} className={`p-4 border transition-colors flex flex-col justify-between rounded-sm ${isConnected ? "border-[#34C759] bg-[#34C759]/5" : "border-white/10 bg-white/[0.02]"}`}>
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-1.5 font-editorial text-2xl capitalize text-[#FF3B30]">
                                    {plat} {plat === "instagram" && "*"}
                                    {isConnected && <CheckCircle2 className="w-4 h-4 text-[#34C759]" />}
                                </div>
                                <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">{plat}</span>
                            </div>
                            
                            <F label={`${plat} Handle`}>
                                <input required={plat==="instagram"} className="inp font-mono text-xs py-1" 
                                       placeholder={`@${plat}_handle`}
                                       value={f.platform_metrics[plat]?.handle || ""} 
                                       onChange={e=>setF({
                                           ...f, 
                                           platform_metrics: {
                                               ...f.platform_metrics, 
                                               [plat]: {...(f.platform_metrics[plat] || {}), handle: e.target.value}
                                           }
                                       })} />
                            </F>
                            <div className="grid grid-cols-2 gap-3 mt-4 font-mono">
                                <div>
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">{plat==="youtube" ? "Subs" : "Followers"}</div>
                                    <input type="number" className="inp text-sm py-0.5" placeholder=""
                                           value={f.platform_metrics[plat]?.followers || ""}
                                           onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), followers: Number(e.target.value)}}})} />
                                </div>
                                <div>
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">ER (%)</div>
                                    <input type="number" step="0.1" className="inp text-sm py-0.5" placeholder=""
                                           value={f.platform_metrics[plat]?.engagement || ""}
                                           onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), engagement: Number(e.target.value)}}})} />
                                </div>
                                <div>
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">Views</div>
                                    <input type="number" className="inp text-sm py-0.5" placeholder=""
                                           value={f.platform_metrics[plat]?.views || ""}
                                           onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), views: Number(e.target.value)}}})} />
                                </div>
                                <div>
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">Posts</div>
                                    <input type="number" className="inp text-sm py-0.5" placeholder=""
                                           value={f.platform_metrics[plat]?.posts || ""}
                                           onChange={e=>setF({...f, platform_metrics: {...f.platform_metrics, [plat]: {...(f.platform_metrics[plat] || {}), posts: Number(e.target.value)}}})} />
                                </div>
                            </div>
                        </div>
                    )})}
                  </div>
              </section>

              {/* SECTION 4: CONTENT NICHE / CATEGORY (Multi-Select Dropdown & Pills) */}
              <section id="sec-niche" className="space-y-6">
                  <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                    <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">04</span>
                    Content Niche / Category *
                  </h2>
                  
                  <div className="space-y-4">
                      <F label="Select Niches / Categories">
                          <select 
                            className="inp cursor-pointer bg-[#0B0B0E]"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const currentCats = Array.isArray(f.category) 
                                  ? f.category 
                                  : (f.category ? f.category.split(", ") : []);
                                if (!currentCats.includes(val)) {
                                  setF({ ...f, category: [...currentCats, val] });
                                }
                              }
                              e.target.value = "";
                            }}
                          >
                            <option value="" className="bg-[#0B0B0E]">Select a category to add...</option>
                            {CATEGORIES.map(c => (
                              <option key={c} value={c} className="bg-[#0B0B0E]">{c}</option>
                            ))}
                          </select>
                      </F>

                      {/* Selected Category Pills */}
                      {((Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : [])).length > 0) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                              {(Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : [])).map(c => (
                                  <span key={c} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white text-xs font-mono rounded-sm">
                                      {c}
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          const currentCats = Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : []);
                                          setF({ ...f, category: currentCats.filter(x => x !== c) });
                                        }} 
                                        className="hover:text-[#FF3B30] transition-colors"
                                      >
                                          <X className="w-3.5 h-3.5" />
                                      </button>
                                  </span>
                              ))}
                          </div>
                      )}
                  </div>
              </section>

              {isCreator && (
                <section id="sec-rate" className="space-y-6">
                    <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                      <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">05</span>
                      Pricing &amp; Rates
                    </h2>
                    <F label="Base Rate (INR) *">
                        <input type="number" required min={1} className="inp font-editorial text-3xl" value={f.base_rate || ""} onChange={e=>setF({...f,base_rate:Number(e.target.value)})} />
                    </F>
                </section>
              )}

              {/* SECTION 6: PORTFOLIO & PAST WORK (Creators Only) */}
              {isCreator && (
                <section className="space-y-6">
                    <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                      <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">06</span>
                      Portfolio &amp; Past Work
                    </h2>
                    
                    <F label="Portfolio Images and Videos">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {f.portfolio.map((p, i) => (
                          <div key={i} className="relative group aspect-square bg-[#0B0B0E] border border-white/10">
                            {p && (p.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video src={p} className="w-full h-full object-cover" controls />
                            ) : (
                                <img src={p} alt="" className="w-full h-full object-cover" />
                            ))}
                            <button type="button" onClick={()=>removePortfolio(i)} className="absolute top-2 right-2 p-1.5 bg-[#0B0B0E]/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
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

                    <div className="mt-8" id="sec-campaigns">
                        <F label="Past Campaigns * (Full Details Required for Each Entry, Max 5)">
                            <div className="space-y-3 mt-3">
                                <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-mono uppercase tracking-widest opacity-50">
                                    <div className="col-span-2">Brand *</div>
                                    <div className="col-span-3">Campaign Scope *</div>
                                    <div className="col-span-2">Date *</div>
                                    <div className="col-span-2">Result *</div>
                                    <div className="col-span-2">Post Link *</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {f.past_campaigns.map((c, i) => (
                                    <div key={i} className="p-3 border border-white/10 bg-white/[0.02] grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-sm">
                                        <div className="md:col-span-2">
                                            <input required className="inp text-xs py-1.5" placeholder="" value={c.brand || ""} onChange={e=>setCampaign(i, 'brand', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <input required className="inp text-xs py-1.5" placeholder="" value={c.title || ""} onChange={e=>setCampaign(i, 'title', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <DateField required value={c.date || ""} onChange={(v)=>setCampaign(i, 'date', v)} placeholder="Campaign date" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <input required className="inp text-xs py-1.5" placeholder="" value={c.result || ""} onChange={e=>setCampaign(i, 'result', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <input required type="url" className="inp text-xs py-1.5 font-mono" placeholder="" value={c.post_url || ""} onChange={e=>setCampaign(i, 'post_url', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-1 text-right">
                                            <button type="button" onClick={()=>removeCampaign(i)} className="p-2 opacity-60 hover:opacity-100 hover:text-[#FF3B30] transition-opacity">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {f.past_campaigns.length < 5 ? (
                                    <button type="button" onClick={addCampaign} className="btn-pill text-xs mt-2">
                                      <Plus className="w-3.5 h-3.5" /> Add Past Campaign Row ({f.past_campaigns.length}/5)
                                    </button>
                                ) : (
                                    <div className="font-mono text-xs text-orange-400 mt-2">
                                        Maximum limit reached (5/5 past campaigns added)
                                    </div>
                                )}
                            </div>
                        </F>
                    </div>
                </section>
              )}

              {isCreator && (
                <section className="space-y-6" id="sec-content-types">
                    <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
                      <span className="text-[#FF3B30] font-sans text-sm tracking-[0.2em] uppercase mr-3">07</span>
                      Additional Information
                    </h2>
                    
                    <F label="Years of Experience *">
                        <select required className="inp" value={f.experience} onChange={e=>setF({...f,experience:e.target.value})}>
                            <option value="" className="bg-[#0B0B0E]">Select Experience...</option>
                            {EXPERIENCES.map(ex => <option key={ex} value={ex} className="bg-[#0B0B0E]">{ex}</option>)}
                        </select>
                    </F>

                    <F label="Response Time *">
                        <select required className="inp" value={f.response_time} onChange={e=>setF({...f,response_time:e.target.value})}>
                            <option value="" className="bg-[#0B0B0E]">Select Response Time...</option>
                            {RESPONSE_TIMES.map(r => <option key={r} value={r} className="bg-[#0B0B0E]">{r}</option>)}
                        </select>
                    </F>

                    <div className="pt-4">
                        <F label="Content Types You Create * (Multi-Select)">
                            <select 
                              className="inp cursor-pointer bg-[#0B0B0E]"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val && !f.content_types.includes(val)) {
                                  setF({ ...f, content_types: [...f.content_types, val] });
                                }
                                e.target.value = "";
                              }}
                            >
                              <option value="" className="bg-[#0B0B0E]">Select content type to add...</option>
                              {CONTENT_TYPES.filter(t => !f.content_types.includes(t)).map(t => (
                                <option key={t} value={t} className="bg-[#0B0B0E]">{t}</option>
                              ))}
                            </select>

                            {/* Selected Content Types Pills */}
                            {f.content_types?.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-3">
                                    {f.content_types.map(type => (
                                        <span key={type} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs font-mono rounded-sm">
                                            {type}
                                            <button type="button" onClick={() => toggleArray("content_types", type)} className="hover:text-white transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </F>
                    </div>
                </section>
              )}

              {/* Password lives outside the profile form so empty password fields
                  never block Save profile via HTML5 required validation. */}

          <div className="pt-8">
            <button type="submit" disabled={busy} className="btn-solid w-full justify-center py-5 bg-[#FF3B30] text-white text-xl">
              <Save className="w-5 h-5" /> {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </motion.form>

        <div className="mt-16">
          <PasswordChangeSection />
        </div>
      </div>
      <Footer />
      {cropState && (
        <ImageCropModal
          imageSrc={cropState.src}
          aspect={cropState.aspect}
          title={cropState.title}
          onCancel={() => {
            if (cropState.src?.startsWith("blob:")) URL.revokeObjectURL(cropState.src);
            setCropState(null);
          }}
          onComplete={onCropComplete}
        />
      )}
      <style>{`.inp { margin-top: 0.5rem; width: 100%; background: transparent; border-bottom: 1px solid rgba(244,244,240,0.14); padding: 0.75rem 0; outline: none; font-size: 1.05rem; color: #F4F4F0; font-family: 'Manrope', sans-serif; }
      .inp:focus { border-color: #FF3B30; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0.7; }`}</style>
    </div>
  );
}

function PasswordChangeSection() {
  const [pwdForm, setPwdForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdErr, setPwdErr] = useState("");

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdErr("");

    if (!pwdForm.current_password) {
      setPwdErr("Current password is required");
      return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9]).{8,}$/.test(pwdForm.new_password)) {
      setPwdErr("New password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      setPwdErr("New password and confirm password do not match");
      return;
    }

    setPwdBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: pwdForm.current_password,
        new_password: pwdForm.new_password
      });
      toast.success("Password updated successfully!");
      setPwdForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to change password";
      setPwdErr(msg);
      toast.error(msg);
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <section id="sec-security" className="space-y-6 pt-4">
      <h2 className="font-editorial text-2xl md:text-3xl border-b border-white/10 pb-2">
        Security &amp; Modify Password
      </h2>
      <div className="bg-white/[0.02] p-6 border border-white/10 rounded-sm space-y-6">
        <p className="font-sans text-sm opacity-60">Password changes are saved separately from your profile. Leave blank if you only want to update profile details.</p>
        <F label="Current Password">
          <input 
            type="password" 
            className="inp font-mono" 
            placeholder="••••••••" 
            autoComplete="current-password"
            value={pwdForm.current_password} 
            onChange={e => setPwdForm({ ...pwdForm, current_password: e.target.value })} 
          />
        </F>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <F label="New Password (Min 8 chars, Alphanumeric)">
            <input 
              type="password" 
              className="inp font-mono" 
              placeholder="••••••••" 
              autoComplete="new-password"
              value={pwdForm.new_password} 
              onChange={e => setPwdForm({ ...pwdForm, new_password: e.target.value })} 
            />
          </F>
          <F label="Confirm New Password">
            <input 
              type="password" 
              className="inp font-mono" 
              placeholder="••••••••" 
              autoComplete="new-password"
              value={pwdForm.confirm_password} 
              onChange={e => setPwdForm({ ...pwdForm, confirm_password: e.target.value })} 
            />
          </F>
        </div>

        {pwdErr && (
          <p className="text-[#FF3B30] text-xs font-mono tracking-wider uppercase">{pwdErr}</p>
        )}

        <button 
          type="button" 
          onClick={handlePasswordChange}
          disabled={pwdBusy} 
          className="btn-solid text-xs bg-white/10 hover:bg-[#FF3B30] hover:text-white transition-colors py-3 px-8"
        >
          {pwdBusy ? "Updating Password…" : "Update Password"}
        </button>
      </div>
    </section>
  );
}

function F({ label, children }) {
  return (
    <div>
      <label className="font-sans text-[11px] tracking-[0.18em] uppercase opacity-60 font-medium">{label}</label>
      {children}
    </div>
  );
}
