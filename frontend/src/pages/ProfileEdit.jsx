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
  const locationBackfillRef = useRef(false);

  useEffect(() => {
    if (user) {
      const uname = user.username || "";
      const handleFromDb = user.handle || (uname ? `@${uname}` : "");
      setF({
        name: user.name || "",
        username: uname,
        handle: handleFromDb,
        bio: (/curating high-end aesthetics|focus on luxury and design/i.test(user.bio || "") ? "" : (user.bio || "")),
        avatar: user.avatar || "",
        pincode: user.pincode || "",
        city: user.city || "",
        state: user.state || "",
        availability: user.availability || "Immediately",
        platform_metrics: user.platform_metrics || {
          instagram: { handle: "", followers: 0, engagement: 0, views: 0 },
          youtube: { handle: "", followers: 0, engagement: 0, views: 0 },
          twitter: { handle: "", followers: 0, engagement: 0, views: 0 },
          facebook: { handle: "", followers: 0, engagement: 0, views: 0 }
        },
        category: user.category || user.niches || "",
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

  // Backfill city/state from signup pincode when missing on the account
  useEffect(() => {
    if (!user || locationBackfillRef.current) return;
    const pin = (user.pincode || "").toString().trim();
    if (!pin || pin.length !== 6) return;
    if (user.city && user.state) return;

    locationBackfillRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/location/pincode/${pin}`);
        if (cancelled) return;
        const city = data?.city && data.city !== "Unknown" ? data.city : "";
        const state = data?.state && data.state !== "Unknown" ? data.state : "";
        if (!city && !state) return;
        setF((prev) => prev ? {
          ...prev,
          city: prev.city || city,
          state: prev.state || state,
          pincode: prev.pincode || pin,
        } : prev);
        await api.patch("/auth/me", {
          ...(city ? { city, location: city } : {}),
          ...(state ? { state } : {}),
        });
        await refresh();
      } catch (_) {
        /* ignore lookup failures */
      }
    })();
    return () => { cancelled = true; };
  }, [user, refresh]);

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

  // Past Campaigns (optional, max 5)
  const addCampaign = () => {
    if (f.past_campaigns.length >= 5) {
      toast.error("Maximum limit reached: You can add at most 5 past campaigns.");
      return;
    }
    setF({
      ...f,
      past_campaigns: [...f.past_campaigns, { brand: "", title: "", date: "", result: "", post_url: "" }],
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

    // City / state come from signup (pincode) — not required to re-enter here

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
      // Username comes from account signup; keep handle synced for profile display
      if (!(f.username || f.handle)?.toString().trim()) {
        toast.error("Missing Data: Username is missing from your account.");
        document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!f.platform_metrics?.instagram?.handle?.trim()) {
        toast.error("Missing Data: Instagram handle is required in Social Presence.");
        document.getElementById("sec-social")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // Content niche is optional

      if (!f.base_rate || Number(f.base_rate) <= 0) {
        toast.error("Missing Data: Please specify your Pricing & Rates in Section 5.");
        document.getElementById("sec-rate")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      // Past campaigns are optional — empty rows are ignored on save

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
      const handleValue = (f.handle || (f.username ? `@${f.username}` : "")).trim();
      await api.patch("/auth/me", {
        ...f,
        handle: handleValue,
        base_rate: Number(f.base_rate) || 0,
        portfolio: f.portfolio.filter(Boolean),
        past_campaigns: (f.past_campaigns || []).filter(
          (c) => c.brand?.trim() || c.title?.trim() || c.post_url?.trim() || c.result?.trim() || c.date?.trim()
        ),
      });
      await refresh();
      toast.success("Profile saved.");
      nav("/profile");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  const runAiCuration = async () => {
    const niches = Array.isArray(f.category)
      ? f.category.filter(Boolean)
      : (f.category ? String(f.category).split(",").map((s) => s.trim()).filter(Boolean) : []);
    const city = (f.city || "").trim();
    const state = (f.state || "").trim();

    if (!niches.length) {
      toast.error("Select at least one niche below, then run AI Curation.");
      document.getElementById("sec-niche")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const who = f.name || (f.username ? `@${f.username}` : "Creator");
    const loc = [city, state].filter(Boolean).join(", ") || "India";
    const localBio = niches.length === 1
      ? `${who} — specializing in ${niches[0]}, based in ${loc}.`
      : niches.length === 2
        ? `${who} — specializing in ${niches[0]} and ${niches[1]}, based in ${loc}.`
        : `${who} — specializing in ${niches.slice(0, -1).join(", ")}, and ${niches[niches.length - 1]}, based in ${loc}.`;

    const looksHardcoded = (bio) => {
      const t = (bio || "").toLowerCase();
      return (
        t.includes("curating high-end aesthetics") ||
        t.includes("focus on luxury and design") ||
        t.includes("luxury, design, and editorial")
      );
    };

    // Instant local bio from niches + location (never luxury filler)
    setF((prev) => ({ ...prev, bio: localBio }));
    setAiBusy(true);

    try {
      const { data } = await api.post("/ai/suggest-profile", {
        handle: f.handle || (f.username ? `@${f.username}` : ""),
        name: f.name,
        username: f.username,
        bio: localBio,
        niches,
        city: city || undefined,
        state: state || undefined,
        languages: f.languages,
        experience: f.experience,
        content_types: f.content_types,
        platform_metrics: f.platform_metrics,
        base_rate: f.base_rate,
        response_time: f.response_time,
        availability: f.availability,
      });

      let bio = (data?.bio || "").trim();
      if (!bio || looksHardcoded(bio)) bio = localBio;
      // Must mention at least one niche keyword
      const lowered = bio.toLowerCase();
      if (!niches.some((n) => lowered.includes(String(n).split("&")[0].trim().toLowerCase().slice(0, 5)))) {
        bio = localBio;
      }

      setF((prev) => {
        const next = { ...prev, bio };
        if ((!prev.languages || !prev.languages.length) && Array.isArray(data?.languages) && data.languages.length) {
          next.languages = data.languages;
        }
        if (!prev.experience && data?.experience) next.experience = data.experience;
        if ((!prev.content_types || !prev.content_types.length) && Array.isArray(data?.content_types) && data.content_types.length) {
          next.content_types = data.content_types;
        }
        if (!prev.response_time && data?.response_time) next.response_time = data.response_time;
        return next;
      });
      toast.success(`Bio updated from ${niches.slice(0, 2).join(" · ")}${city ? ` · ${city}` : ""}.`);
    } catch (e) {
      // Local bio already applied
      toast.success(`Bio set from your niches · ${loc}.`);
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
    if (f.city?.trim()) score += 10;

    if (isCreator) {
      if (f.handle?.trim() || f.username?.trim()) score += 10; else missing.push("Username");
      const cats = Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : []);
      if (cats.length > 0) score += 10;
      if (Number(f.base_rate) > 0) score += 10; else missing.push("Base Rate");
      if (f.past_campaigns?.some((c) => c.brand?.trim() || c.title?.trim())) score += 10;
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
      <div className="pt-20 max-w-6xl mx-auto px-4 md:px-8 pb-10 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="pr-12 md:pr-0">
                <p className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">§ Edit profile</p>
                <h1 className="font-editorial text-2xl md:text-3xl leading-[1.15] mt-1">
                Your <span className="italic">file</span><span className="tick">.</span>
                </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 border border-white/10">
                  <div className="w-9 h-9 rounded-full border-2 border-[#FF3B30]/30 flex items-center justify-center relative overflow-hidden bg-white/5">
                      <div className="absolute inset-0 bg-[#FF3B30] opacity-30 transition-all duration-500" style={{ height: `${completion}%`, top: 'auto', bottom: 0 }} />
                      <span className="font-sans text-[10px] font-bold z-10 text-white">{completion}%</span>
                  </div>
                  <div className="text-right">
                      <div className="font-sans text-[10px] tracking-widest uppercase opacity-70">Complete</div>
                      {missingFields.length > 0 && (
                        <div className="font-sans text-[9px] uppercase tracking-wider text-orange-400 max-w-[140px] truncate">
                          {missingFields.slice(0, 2).join(" · ")}
                        </div>
                      )}
                  </div>
              </div>
              <button 
                type="button" 
                onClick={() => nav("/profile")} 
                className="p-2.5 bg-[#1A1A1A] border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-lg transition-all duration-300 shrink-0"
                title="Close (Esc)"
                data-testid="profile-edit-close-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
        </div>

        <motion.form onSubmit={submit} className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 items-start" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          
          {/* SECTION 1: BASIC & BRAND COMPANY DETAILS */}
          <section id="sec-basic" className="space-y-2">
              <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                <span className="mr-2">01</span>
                Basic details
              </h2>
              <F label="Full Name *"><input required className="inp" value={f.name} onChange={e=>setF({...f,name:e.target.value})} /></F>
              
              {!isCreator && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1" id="sec-company">
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
                <F label="Username">
                  <input
                    className="inp opacity-80"
                    value={f.username ? `@${String(f.username).replace(/^@/, "")}` : ""}
                    readOnly
                    disabled
                    data-testid="reg-username-readonly"
                  />
                </F>
              )}
              {isCreator && (
                <div id="sec-niche" className="space-y-1.5">
                  <F label="Niches (for AI bio)">
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
                      <option value="" className="bg-[#0B0B0E]">Add a niche…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c} className="bg-[#0B0B0E]">{c}</option>
                      ))}
                    </select>
                  </F>
                  {((Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : [])).length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : [])).map((c) => (
                        <span key={c} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/10 border border-white/20 text-white text-[10px] font-sans rounded-sm">
                          {c}
                          <button
                            type="button"
                            onClick={() => {
                              const currentCats = Array.isArray(f.category) ? f.category : (f.category ? f.category.split(", ") : []);
                              setF({ ...f, category: currentCats.filter((x) => x !== c) });
                            }}
                            className="hover:text-[#FF3B30]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <F label="Bio / About *">
                  <textarea required rows={2} className="inp resize-none text-sm" value={f.bio} onChange={e=>setF({...f,bio:e.target.value})} maxLength={500} />
                  <div className="flex justify-between items-center mt-1 gap-2 flex-wrap">
                      {isCreator && (
                          <button type="button" onClick={runAiCuration} disabled={aiBusy} className="btn-solid bg-[#F4F4F0] text-[#0A0A0A] hover:bg-[#FF3B30] hover:text-white px-3 py-1 text-[10px]">
                              {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {aiBusy ? "Curating…" : "AI from niches + location"}
                          </button>
                      )}
                      <div className="text-right text-[10px] opacity-40 flex-1">{f.bio.length}/500</div>
                  </div>
              </F>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Profile Picture *">
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {f.avatar && <img src={f.avatar} alt="" className="w-12 h-12 object-cover border border-white/20 rounded-sm" />}
                    <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
                    <button type="button" onClick={()=>avatarRef.current?.click()} className="btn-solid bg-white/10 hover:bg-[#FF3B30] text-white px-3 py-1.5 text-[10px] flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> {f.avatar ? "Replace" : "Upload"}
                    </button>
                    {f.avatar && (
                      <button type="button" onClick={recropAvatar} className="btn-solid bg-white/5 hover:bg-white/15 text-white px-2 py-1.5 text-[10px] flex items-center gap-1">
                        <Crop className="w-3.5 h-3.5" /> Crop
                      </button>
                    )}
                  </div>
                </F>
                <F label="Cover Photo">
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {f.cover_photo && <img src={f.cover_photo} alt="" className="w-16 h-10 object-cover border border-white/20 rounded-sm" />}
                    <input ref={coverRef} type="file" accept="image/*" hidden onChange={onCoverPick} />
                    <button type="button" onClick={() => coverRef.current?.click()} className="btn-solid bg-white/10 hover:bg-[#FF3B30] text-white px-3 py-1.5 text-[10px] flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> {f.cover_photo ? "Replace" : "Upload"}
                    </button>
                    {f.cover_photo && (
                      <button type="button" onClick={recropCover} className="btn-solid bg-white/5 hover:bg-white/15 text-white px-2 py-1.5 text-[10px] flex items-center gap-1">
                        <Crop className="w-3.5 h-3.5" /> Crop
                      </button>
                    )}
                  </div>
                </F>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <label className="flex items-center justify-between py-2 border border-white/10 px-3 rounded-xs cursor-pointer">
                <div>
                  <span className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 block">Private account</span>
                  <span className="font-sans text-[10px] opacity-40">Approved followers only</span>
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
          <section className="space-y-2">
              <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                Languages
              </h2>
              <div className="space-y-2">
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

          {/* SECTION 2: LOCATION from signup */}
          <section id="sec-location" className="space-y-2">
              <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                <span className="mr-2">02</span>
                Location
              </h2>
              <p className="font-sans text-[10px] tracking-wider uppercase opacity-50">From signup pincode</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="select-none pointer-events-none opacity-80">
                    <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">Pincode</label>
                    <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center">
                      {f.pincode || "—"}
                    </div>
                  </div>
                  <div className="select-none pointer-events-none opacity-80">
                    <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">City</label>
                    <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center" data-testid="edit-city">
                      {f.city || "—"}
                    </div>
                  </div>
                  <div className="select-none pointer-events-none opacity-80">
                    <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">State</label>
                    <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center" data-testid="edit-state">
                      {f.state || "—"}
                    </div>
                  </div>
              </div>
          </section>

          {/* SECTION 3: OUR SOCIAL PRESENCE (Available for Creators & Brands, 4 in a Row) */}
          <section id="sec-social" className="space-y-2">
              <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                <span className="mr-2">03</span>
                Social accounts
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    {PLATFORMS.map(plat => {
                        const isConnected = !!f.platform_metrics[plat]?.handle;
                        return (
                        <div key={plat} className={`p-2.5 border transition-colors flex flex-col justify-between rounded-sm ${isConnected ? "border-[#34C759] bg-[#34C759]/5" : "border-white/10 bg-white/[0.02]"}`}>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1.5 font-sans text-[11px] tracking-[0.14em] uppercase text-[#FF3B30] font-semibold">
                                    {plat} {plat === "instagram" && "*"}
                                    {isConnected && <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" />}
                                </div>
                            </div>
                            
                            <div>
                                <input required={plat==="instagram"} className="inp font-sans text-xs py-1" 
                                       placeholder={`@${plat}_handle`}
                                       value={f.platform_metrics[plat]?.handle || ""} 
                                       onChange={e=>setF({
                                           ...f, 
                                           platform_metrics: {
                                               ...f.platform_metrics, 
                                               [plat]: {...(f.platform_metrics[plat] || {}), handle: e.target.value}
                                           }
                                       })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 font-sans">
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

              {/* Niches already edited in Basic for creators — keep compact section for brands */}
              {!isCreator && (
              <section id="sec-niche" className="space-y-2">
                  <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                    <span className="mr-2">04</span>
                    Niches (optional)
                  </h2>
                  
                  <div className="space-y-2">
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
              )}

              {isCreator && (
                <section id="sec-rate" className="space-y-2">
                    <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                      <span className="mr-2">05</span>
                      Pricing &amp; rates
                    </h2>
                    <F label="Base Rate (INR) *">
                        <input type="number" required min={1} className="inp font-sans text-lg" value={f.base_rate || ""} onChange={e=>setF({...f,base_rate:Number(e.target.value)})} />
                    </F>
                </section>
              )}

              {/* SECTION 6: PORTFOLIO & PAST WORK (Creators Only) */}
              {isCreator && (
                <section className="space-y-3 lg:col-span-2">
                    <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                      <span className="mr-2">06</span>
                      Portfolio
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
                        <button type="button" onClick={()=>portfolioRef.current?.click()} className="btn-solid py-2 px-4 text-xs flex-1 justify-center bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white">
                          <Upload className="w-4 h-4" /> Add Image/s and Upload Videos
                        </button>
                      </div>
                    </F>

                    <div className="mt-3" id="sec-campaigns">
                        <F label="Past Campaigns (optional, max 5)">
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
                                            <input className="inp text-xs py-1.5" placeholder="" value={c.brand || ""} onChange={e=>setCampaign(i, 'brand', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-3">
                                            <input className="inp text-xs py-1.5" placeholder="" value={c.title || ""} onChange={e=>setCampaign(i, 'title', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <DateField value={c.date || ""} onChange={(v)=>setCampaign(i, 'date', v)} placeholder="Campaign date" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <input className="inp text-xs py-1.5" placeholder="" value={c.result || ""} onChange={e=>setCampaign(i, 'result', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <input type="url" className="inp text-xs py-1.5 font-mono" placeholder="" value={c.post_url || ""} onChange={e=>setCampaign(i, 'post_url', e.target.value)} />
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
                <section className="space-y-3 lg:col-span-2" id="sec-content-types">
                    <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                      <span className="mr-2">07</span>
                      Additional
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

          <div className="pt-2 lg:col-span-2">
            <button type="submit" disabled={busy} className="btn-solid w-full justify-center py-2.5 bg-[#FF3B30] text-white text-sm">
              <Save className="w-5 h-5" /> {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </motion.form>

        <div className="mt-6">
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
      <style>{`.inp { margin-top: 0.25rem; width: 100%; background: transparent; border-bottom: 1px solid rgba(244,244,240,0.14); padding: 0.5rem 0; outline: none; font-size: 1rem; color: #F4F4F0; font-family: 'Manrope', sans-serif; }
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
    <section id="sec-security" className="space-y-3 pt-2">
      <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
        Security
      </h2>
      <div className="bg-white/[0.02] p-4 border border-white/10 space-y-3">
        <p className="font-sans text-sm opacity-60">Password changes are saved separately from your profile. Leave blank if you only want to update profile details.</p>
        <F label="Current Password">
          <input 
            type="password" 
            className="inp"
            placeholder="••••••••" 
            autoComplete="current-password"
            value={pwdForm.current_password} 
            onChange={e => setPwdForm({ ...pwdForm, current_password: e.target.value })} 
          />
        </F>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <F label="New Password (Min 8 chars, Alphanumeric)">
            <input 
              type="password" 
              className="inp"
              placeholder="••••••••" 
              autoComplete="new-password"
              value={pwdForm.new_password} 
              onChange={e => setPwdForm({ ...pwdForm, new_password: e.target.value })} 
            />
          </F>
          <F label="Confirm New Password">
            <input 
              type="password" 
              className="inp"
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
    <div className="space-y-0">
      <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">{label}</label>
      {children}
    </div>
  );
}
