import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, Plus, X, Upload, Sparkles, Loader2, RefreshCw, CheckCircle2, Crop, Pencil } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError, firstErrorField } from "@/lib/api";
import { uploadImage } from "@/lib/upload";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { ImageCropModal } from "@/components/ImageCropModal";
import { DateField, toIsoDate } from "@/components/DateField";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES } from "@/lib/categories";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  emptyPlatformMetrics,
  hasPlatformHandle,
  socialOrNA,
  socialMetricOrNA,
} from "@/lib/platforms";
import { formatUsername } from "@/lib/username";

function normalizeHandle(raw) {
  const s = String(raw || "").trim().replace(/^@+/, "").replace(/\s+/g, "");
  return s ? `@${s}` : "";
}

function toList(val) {
  if (Array.isArray(val)) return val.filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
  if (!val) return [];
  return String(val).split(",").map((x) => x.trim()).filter(Boolean);
}

const LANGUAGES = [
  "English", "Hindi", "Assamese", "Bengali", "Bodo", "Dogri", 
  "Gujarati", "Kannada", "Kashmiri", "Konkani", "Maithili", 
  "Malayalam", "Manipuri", "Marathi", "Nepali", "Odia", 
  "Punjabi", "Sanskrit", "Santali", "Sindhi", "Tamil", "Telugu", "Urdu"
];
const AVAILABILITIES = ["Immediately", "2 weeks", "1 month"];
const EXPERIENCES = ["0-6 months", "6-12 months", "1-2 years", "2-5 years", "5+ years"];
const CONTENT_TYPES = [
  "Instagram Posts (Photos)", "Instagram Reels (Short Videos)", "Instagram Stories",
  "YouTube Shorts", "YouTube Long-form", "Twitter/X Threads", "Blog Posts / Articles", "Podcasts"
];
const RESPONSE_TIMES = ["Within 2 hours", "Within 24 hours", "Within 2 days", "Within 1 week"];
const PLATFORMS = SOCIAL_PLATFORMS;

function asStr(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function normalizeWebsite(raw) {
  const s = asStr(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/** Map API field names → Edit Profile section anchors. */
const FIELD_SECTION = {
  name: "sec-basic",
  bio: "sec-basic",
  avatar: "sec-basic",
  cover_photo: "sec-basic",
  handle: "sec-basic",
  date_of_birth: "sec-basic",
  gender: "sec-basic",
  company: "sec-company",
  industry: "sec-company",
  website: "sec-company",
  category: "sec-niche",
  niches: "sec-niche",
  languages: "sec-niche",
  city: "sec-location",
  state: "sec-location",
  location: "sec-location",
  platform_metrics: "sec-social",
  base_rate: "sec-rate",
  experience: "sec-content-types",
  response_time: "sec-content-types",
  content_types: "sec-content-types",
  past_campaigns: "sec-campaigns",
  portfolio: "sec-campaigns",
};

function scrollToFieldError(field) {
  const section = FIELD_SECTION[field] || "sec-basic";
  document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function buildProfilePayload(f, { handleValue, platformHandlesOnly }) {
  const category = Array.isArray(f.category) ? f.category.map(asStr).filter(Boolean) : toList(f.category);
  const languages = Array.isArray(f.languages) ? f.languages.map(asStr).filter(Boolean) : toList(f.languages);
  const content_types = Array.isArray(f.content_types) ? f.content_types.map(asStr).filter(Boolean) : toList(f.content_types);
  const portfolio = (Array.isArray(f.portfolio) ? f.portfolio : []).map(asStr).filter(Boolean);
  const past_campaigns = (f.past_campaigns || [])
    .filter((c) => c.brand?.trim() || c.title?.trim() || c.post_url?.trim() || c.result?.trim() || c.date?.trim())
    .map((c) => ({
      brand: asStr(c.brand).trim(),
      title: asStr(c.title).trim(),
      date: asStr(c.date).trim(),
      result: asStr(c.result).trim(),
      post_url: asStr(c.post_url).trim(),
    }));

  const payload = {
    name: asStr(f.name).trim(),
    bio: asStr(f.bio).trim(),
    avatar: asStr(f.avatar).trim() || null,
    cover_photo: asStr(f.cover_photo).trim() || null,
    handle: asStr(handleValue).trim() || null,
    company: asStr(f.company).trim() || null,
    industry: asStr(f.industry).trim() || null,
    website: normalizeWebsite(f.website) || null,
    // Niches multi-select lives in UI state as an array; API field `category` must be a string.
    category: category.length ? category.join(", ") : null,
    niches: category,
    languages,
    content_types,
    city: asStr(f.city).trim() || null,
    state: asStr(f.state).trim() || null,
    location: asStr(f.city).trim() || asStr(f.location).trim() || null,
    availability: asStr(f.availability).trim() || null,
    experience: asStr(f.experience).trim() || null,
    response_time: asStr(f.response_time).trim() || null,
    base_rate: Number(f.base_rate) || 0,
    date_of_birth: toIsoDate(f.date_of_birth) || null,
    gender: asStr(f.gender).trim() || null,
    is_private: !!f.is_private,
    agent_type: asStr(f.agent_type).trim() || null,
    portfolio,
    past_campaigns,
    platform_metrics: platformHandlesOnly,
  };

  // Drop nulls so we don't wipe optional fields unintentionally on backend exclude_unset...
  // Backend already drops nulls; keep explicit nulls only for optional clears we want.
  return payload;
}


export default function ProfileEdit() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [editingPlat, setEditingPlat] = useState(null);
  const [draftHandle, setDraftHandle] = useState("");
  const [savingPlat, setSavingPlat] = useState(null);
  const [cropState, setCropState] = useState(null); // { src, aspect, target: 'avatar'|'cover' }
  const avatarRef = useRef(null);
  const coverRef = useRef(null);
  const portfolioRef = useRef(null);
  const locationBackfillRef = useRef(false);

  useEffect(() => {
    if (user) {
      const uname = user.username || "";
      const handleFromDb = formatUsername(user.handle, uname);
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
        platform_metrics: {
          ...emptyPlatformMetrics(),
          ...(user.platform_metrics || {}),
        },
        category: toList(user.category || user.niches),
        languages: toList(user.languages),
        base_rate: user.base_rate || 0,
        portfolio: user.portfolio || [],
        past_campaigns: user.past_campaigns || [],
        experience: user.experience || "",
        content_types: toList(user.content_types),
        response_time: user.response_time || "",
        
        // for owners/agents
        company: user.company || "",
        industry: user.industry || "",
        website: user.website || "",
        agent_type: user.agent_type || "company_agent",
        cover_photo: user.cover_photo || "",
        date_of_birth: toIsoDate(user.date_of_birth) || "",
        gender: ["male", "female", "other"].includes(user.gender)
          ? user.gender
          : user.gender
            ? "other"
            : "",
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

  // Escape: cancel social ID edit first, otherwise leave editor
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (editingPlat) {
        setEditingPlat(null);
        setDraftHandle("");
        return;
      }
      nav("/profile");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nav, editingPlat]);

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
    try {
      const url = await uploadImage(file);
      if (!url) {
        toast.error("Upload failed.");
        throw new Error("Upload failed");
      }
      if (target === "avatar") {
        setF((prev) => ({ ...prev, avatar: url }));
        toast.success("Avatar uploaded. You can re-crop anytime before saving.");
      } else {
        setF((prev) => ({ ...prev, cover_photo: url }));
        toast.success("Cover photo uploaded.");
      }
      if (prevSrc?.startsWith("blob:")) URL.revokeObjectURL(prevSrc);
      setCropState(null);
    } catch (err) {
      // Keep modal open so user can retry; ImageCropModal resets busy state
      throw err;
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

    if (!f.gender?.trim() || !["male", "female", "other"].includes(f.gender)) {
      toast.error("Missing Data: Please select Gender (Male, Female, or Others).");
      document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!toIsoDate(f.date_of_birth)) {
      toast.error("Missing Data: Please select your Date of Birth.");
      document.getElementById("sec-basic")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const handleValue = formatUsername(f.handle, f.username);
      const platformHandlesOnly = {};
      PLATFORMS.forEach((plat) => {
        platformHandlesOnly[plat] = { handle: normalizeHandle(f.platform_metrics?.[plat]?.handle || "") };
      });
      const payload = buildProfilePayload(f, { handleValue, platformHandlesOnly });
      await api.patch("/auth/me", payload);
      // Auto-fetch metrics for saved handles
      if (isCreator && Object.values(platformHandlesOnly).some((p) => p.handle?.trim())) {
        try {
          await api.post("/creators/sync-analytics", { platform_metrics: platformHandlesOnly });
        } catch {}
      }
      await refresh();
      toast.success("Profile saved.");
      nav("/profile");
    } catch (err) {
      const detail = err.response?.data?.detail;
      const field = firstErrorField(detail);
      if (field) scrollToFieldError(field);
      toast.error(formatApiError(detail) || "Failed to save profile");
    } finally { setBusy(false); }
  };

  const runAiCuration = async () => {
    const niches = Array.isArray(f.category)
      ? f.category.filter(Boolean)
      : toList(f.category);
    const city = (f.city || "").trim();
    const state = (f.state || "").trim();

    if (!niches.length) {
      toast.error("Select at least 1 niche first, then click AI.");
      document.getElementById("sec-niche")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!city && !state) {
      toast.message("Tip: City/state from signup improves AI location wording.", { duration: 3500 });
    }

    const who = f.name || formatUsername(f.username) || "Creator";
    const loc = [city, state].filter(Boolean).join(", ") || "India";
    const nicheText = niches.length === 1
      ? niches[0]
      : niches.length === 2
        ? `${niches[0]} and ${niches[1]}`
        : `${niches.slice(0, -1).join(", ")}, and ${niches[niches.length - 1]}`;
    const localBio = `Based in ${loc}, ${who} creates content around ${nicheText}.`;

    const looksHardcoded = (bio) => {
      const t = (bio || "").toLowerCase();
      return (
        t.includes("curating high-end aesthetics") ||
        t.includes("focus on luxury and design") ||
        t.includes("luxury and design") ||
        t.includes("luxury, design, and editorial")
      );
    };

    setF((prev) => ({ ...prev, bio: localBio }));
    setAiBusy(true);

    try {
      const { data } = await api.post("/ai/suggest-profile", {
        handle: formatUsername(f.handle, f.username),
        name: f.name,
        username: f.username,
        bio: localBio,
        niches,
        city: city || undefined,
        state: state || undefined,
        languages: Array.isArray(f.languages) ? f.languages : toList(f.languages),
        experience: f.experience,
        content_types: Array.isArray(f.content_types) ? f.content_types : toList(f.content_types),
        platform_metrics: f.platform_metrics,
        base_rate: f.base_rate,
        response_time: f.response_time,
        availability: f.availability,
      });

      let bio = (data?.bio || "").trim();
      if (!bio || looksHardcoded(bio)) bio = localBio;
      const lowered = bio.toLowerCase();
      const nicheHit = niches.some((n) => {
        const token = String(n).split("&")[0].trim().toLowerCase().slice(0, 5);
        return token && lowered.includes(token);
      });
      if (!nicheHit) bio = localBio;

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
      if (data?.source === "ai" && bio !== localBio) {
        toast.success(`AI bio from ${niches.slice(0, 2).join(" · ")}${city ? ` · ${city}` : ""}`);
      } else {
        toast.success(`Bio from your niches + location${city ? ` (${city})` : ""}`);
      }
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.success(`Bio set from niches + ${loc}.`);
      if (detail) toast.message(String(detail), { duration: 4000 });
    } finally {
      setAiBusy(false);
    }
  };

  const refreshAnalytics = async (silent = false, metricsOverride = null) => {
    setSyncBusy(true);
    try {
      const source = metricsOverride || f?.platform_metrics || {};
      const handlesOnly = {};
      PLATFORMS.forEach((plat) => {
        const h = source?.[plat]?.handle || "";
        handlesOnly[plat] = { handle: h };
      });
      const { data } = await api.post("/creators/sync-analytics", { platform_metrics: handlesOnly });
      
      if (!silent) {
        if (data.message?.includes("No social media platforms connected")) {
            toast.info(data.message);
        } else {
            toast.success(data.message || "Metrics auto-fetched");
        }
      }
      
      setF(prev => ({ 
          ...prev, 
          platform_metrics: data.metrics || prev.platform_metrics,
          monthly_analytics: data.monthly_analytics || prev.monthly_analytics
      }));
      try { await refresh?.(); } catch {}
    } catch (e) {
      if (!silent) toast.error("Failed to sync analytics.");
    } finally {
      setSyncBusy(false);
    }
  };

  const startEditPlatform = (plat) => {
    const current = f?.platform_metrics?.[plat]?.handle || "";
    setEditingPlat(plat);
    setDraftHandle(current);
  };

  const cancelEditPlatform = () => {
    setEditingPlat(null);
    setDraftHandle("");
  };

  const savePlatformAccount = async (plat) => {
    const handle = normalizeHandle(draftHandle);
    if (plat === "instagram" && isCreator && !handle) {
      toast.error("Instagram handle is required");
      return;
    }
    setSavingPlat(plat);
    try {
      const nextPm = {
        ...(f.platform_metrics || {}),
        [plat]: {
          ...(f.platform_metrics?.[plat] || {}),
          handle,
        },
      };
      // Persist handles only (metrics come from auto-fetch)
      const handlesOnly = {};
      PLATFORMS.forEach((p) => {
        handlesOnly[p] = { handle: normalizeHandle(nextPm?.[p]?.handle || "") };
      });
      await api.patch("/auth/me", { platform_metrics: handlesOnly });
      setF((prev) => ({
        ...prev,
        platform_metrics: {
          ...(prev.platform_metrics || {}),
          [plat]: { ...(prev.platform_metrics?.[plat] || {}), handle },
        },
      }));
      setEditingPlat(null);
      setDraftHandle("");
      toast.success(`${plat} ID saved`);

      if (isCreator && handle) {
        await refreshAnalytics(false, handlesOnly);
      } else if (!handle) {
        setF((prev) => ({
          ...prev,
          platform_metrics: {
            ...(prev.platform_metrics || {}),
            [plat]: { handle: "", followers: 0, engagement: 0, views: 0, posts: 0 },
          },
        }));
      }
      try { await refresh?.(); } catch {}
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to save social ID");
    } finally {
      setSavingPlat(null);
    }
  };

  const setPlatformHandle = (plat, handle) => {
    setF((prev) => ({
      ...prev,
      platform_metrics: {
        ...prev.platform_metrics,
        [plat]: {
          ...(prev.platform_metrics?.[plat] || {}),
          handle,
        },
      },
    }));
  };

  const formatMetric = (n) => {
    const v = Number(n) || 0;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return String(v);
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
      <ThemeToaster />
      <div className="pt-20 max-w-4xl mx-auto px-3 md:px-5 pb-8 relative">
        <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#FF3B30] font-semibold">Edit profile</p>
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

        <motion.form noValidate onSubmit={submit} className="mt-4 space-y-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          
          {/* SECTION 1: BASIC */}
          <section id="sec-basic" className="space-y-3 border border-white/10 bg-white/[0.02] p-4">
              <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                <span className="mr-2">01</span>
                Basic details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isCreator ? (
                  <>
                    <F label="Full Name *"><input required className="inp" value={f.name} onChange={e=>setF({...f,name:e.target.value})} /></F>
                    <F label="Username">
                      <input
                        className="inp opacity-80"
                        value={formatUsername(f.username) || ""}
                        readOnly
                        disabled
                        data-testid="reg-username-readonly"
                      />
                    </F>
                  </>
                ) : (
                  <>
                    <F label="Company / Brand Name">
                      <input
                        className="inp opacity-80 cursor-not-allowed"
                        value={f.company || ""}
                        readOnly
                        disabled
                        title="Brand / company name cannot be changed"
                        data-testid="company-name-readonly"
                      />
                    </F>
                    <F label="Contact name *">
                      <input required className="inp" value={f.name} onChange={e=>setF({...f,name:e.target.value})} />
                    </F>
                  </>
                )}
              </div>

              {!isCreator && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="sec-company">
                  <F label="Brand Industry Category *">
                    <select required className="inp bg-[#0B0B0E] cursor-pointer" value={f.industry || ""} onChange={e=>setF({...f, industry: e.target.value})}>
                      <option value="" className="bg-[#0B0B0E]">Select Industry Category...</option>
                      {INDUSTRIES.map(ind => (
                        <option key={ind} value={ind} className="bg-[#0B0B0E]">{ind}</option>
                      ))}
                    </select>
                  </F>
                  <F label="Official Website URL *">
                    <input type="text" inputMode="url" required className="inp font-sans text-sm" placeholder="https://example.com" value={f.website || ""} onChange={e=>setF({...f, website: e.target.value})} />
                  </F>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="sec-niche">
                <MultiSelectDropdown
                  options={PLATFORM_CATEGORIES}
                  selected={Array.isArray(f.category) ? f.category : toList(f.category)}
                  onChange={(vals) => setF({ ...f, category: vals })}
                  placeholder="Select niches…"
                  compact
                  label={isCreator ? "Niches / Category (required for AI bio)" : "Niches / Category (optional)"}
                />
                <MultiSelectDropdown
                  options={LANGUAGES}
                  selected={Array.isArray(f.languages) ? f.languages : toList(f.languages)}
                  onChange={(vals) => setF({ ...f, languages: vals })}
                  placeholder="Select languages…"
                  compact
                  label="Languages"
                />
              </div>

              <F label="Bio / About *">
                  <textarea required rows={3} className="inp resize-none text-sm" value={f.bio} onChange={e=>setF({...f,bio:e.target.value})} maxLength={500} />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                      <div className="min-w-0">
                        {isCreator && (
                          <p className="font-sans text-[10px] opacity-50 leading-snug">
                            AI needs: <span className="text-white/80">1+ niche</span> selected above
                            {f.city ? <> · location <span className="text-white/80">{f.city}{f.state ? `, ${f.state}` : ""}</span></> : " · city from signup (optional)"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCreator && (
                            <button type="button" onClick={runAiCuration} disabled={aiBusy} className="edit-btn bg-[#F4F4F0] text-[#0A0A0A] hover:bg-[#FF3B30] hover:text-white">
                                {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {aiBusy ? "Curating…" : "AI from niches + location"}
                            </button>
                        )}
                        <div className="text-[10px] opacity-40">{(f.bio || "").length}/500</div>
                      </div>
                  </div>
              </F>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Profile Picture *">
                  <div className="flex items-center gap-2 flex-wrap">
                    {f.avatar && <img src={f.avatar} alt="" className="w-12 h-12 object-cover border border-white/20 rounded-sm" />}
                    <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
                    <button type="button" onClick={()=>avatarRef.current?.click()} className="edit-btn bg-white/10 hover:bg-[#FF3B30] text-white">
                      <Upload className="w-3 h-3" /> {f.avatar ? "Replace" : "Upload"}
                    </button>
                    {f.avatar && (
                      <button type="button" onClick={recropAvatar} className="edit-btn bg-white/5 hover:bg-white/15 text-white">
                        <Crop className="w-3 h-3" /> Crop
                      </button>
                    )}
                  </div>
                </F>
                <F label="Cover Photo">
                  <div className="flex items-center gap-2 flex-wrap">
                    {f.cover_photo && <img src={f.cover_photo} alt="" className="w-16 h-10 object-cover border border-white/20 rounded-sm" />}
                    <input ref={coverRef} type="file" accept="image/*" hidden onChange={onCoverPick} />
                    <button type="button" onClick={() => coverRef.current?.click()} className="edit-btn bg-white/10 hover:bg-[#FF3B30] text-white">
                      <Upload className="w-3 h-3" /> {f.cover_photo ? "Replace" : "Upload"}
                    </button>
                    {f.cover_photo && (
                      <button type="button" onClick={recropCover} className="edit-btn bg-white/5 hover:bg-white/15 text-white">
                        <Crop className="w-3 h-3" /> Crop
                      </button>
                    )}
                  </div>
                </F>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <F label="Date of Birth *">
                  <DateField
                    birthDate
                    required
                    value={f.date_of_birth || ""}
                    onChange={(v) => setF({ ...f, date_of_birth: v })}
                    placeholder="Select day, month, and year"
                  />
                </F>
                <F label="Gender *">
                  <select required className="inp bg-[#0B0B0E] cursor-pointer" value={f.gender || ""} onChange={(e) => setF({ ...f, gender: e.target.value })}>
                    <option value="" className="bg-[#0B0B0E]">Select gender…</option>
                    <option value="male" className="bg-[#0B0B0E]">Male</option>
                    <option value="female" className="bg-[#0B0B0E]">Female</option>
                    <option value="other" className="bg-[#0B0B0E]">Others</option>
                  </select>
                </F>
                <label className="flex items-center justify-between py-2 border border-white/10 px-3 rounded-xs cursor-pointer min-h-[48px]">
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
              </div>
          </section>

          {/* SECTION 2: LOCATION */}
          <section id="sec-location" className="space-y-2 border border-white/10 bg-white/[0.02] p-4">
              <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                <span className="mr-2">02</span>
                Location
              </h2>
              <p className="font-sans text-[10px] tracking-wider uppercase opacity-50">From signup pincode · used by AI bio</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="select-none pointer-events-none opacity-90">
                    <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">Pincode</label>
                    <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center">
                      {f.pincode || "—"}
                    </div>
                  </div>
                  <div className="select-none pointer-events-none opacity-90">
                    <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">City</label>
                    <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center" data-testid="edit-city">
                      {f.city || "—"}
                    </div>
                  </div>
                  <div className="select-none pointer-events-none opacity-90">
                    <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">State</label>
                    <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center" data-testid="edit-state">
                      {f.state || "—"}
                    </div>
                  </div>
              </div>
          </section>

          {/* SECTION 3: SOCIAL ACCOUNTS — edit/rename ID, Save auto-fetches metrics */}
          <section id="sec-social" className="space-y-2 border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
                <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold">
                  <span className="mr-2">03</span>
                  Social accounts
                </h2>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => refreshAnalytics(false)}
                    disabled={syncBusy || !!savingPlat}
                    className="edit-btn bg-white/10 hover:bg-[#FF3B30] text-white"
                  >
                    {syncBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {syncBusy ? "Fetching…" : "Refresh all metrics"}
                  </button>
                )}
              </div>
              <p className="font-sans text-[10px] tracking-wider uppercase opacity-50">
                Edit or rename each platform ID, then Save — followers, ER, views &amp; posts fetch automatically.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    {PLATFORMS.map(plat => {
                        const metrics = f.platform_metrics?.[plat] || {};
                        const savedHandle = normalizeHandle(metrics.handle || "");
                        const isConnected = hasPlatformHandle({ handle: savedHandle });
                        const isEditing = editingPlat === plat;
                        const isSaving = savingPlat === plat;
                        return (
                        <div key={plat} className={`p-2.5 border transition-colors flex flex-col justify-between rounded-sm ${isConnected ? "border-[#34C759] bg-[#34C759]/5" : "border-white/10 bg-white/[0.02]"}`}>
                            <div className="flex justify-between items-center mb-2 gap-2">
                                <div className="flex items-center gap-1.5 font-sans text-[11px] tracking-[0.14em] uppercase text-[#FF3B30] font-semibold">
                                    {SOCIAL_PLATFORM_LABELS[plat] || plat} {plat === "instagram" && isCreator && "*"}
                                    {isConnected && !isEditing && <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" />}
                                </div>
                                {!isEditing ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditPlatform(plat)}
                                    className="inline-flex items-center gap-1 font-sans text-[9px] uppercase tracking-widest text-white/60 hover:text-white border border-white/15 hover:border-white/40 px-2 py-1"
                                    data-testid={`social-edit-${plat}`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                    {isConnected ? "Rename" : "Add"}
                                  </button>
                                ) : null}
                            </div>
                            
                            <div>
                                <label className="font-sans text-[9px] opacity-50 uppercase tracking-widest block mb-0.5">ID / Handle</label>
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <input
                                      autoFocus
                                      className="inp font-sans text-xs py-1"
                                      placeholder={`@${plat}_handle`}
                                      value={draftHandle}
                                      onChange={(e) => setDraftHandle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          savePlatformAccount(plat);
                                        }
                                        if (e.key === "Escape") {
                                          e.preventDefault();
                                          cancelEditPlatform();
                                        }
                                      }}
                                      data-testid={`social-input-${plat}`}
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => savePlatformAccount(plat)}
                                        className="edit-btn bg-[#FF3B30] text-white flex-1 justify-center"
                                        data-testid={`social-save-${plat}`}
                                      >
                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                        {isSaving ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={cancelEditPlatform}
                                        className="edit-btn bg-white/10 text-white"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-0.5 py-2 border-b border-white/10 font-sans text-sm text-white/90 bg-white/[0.02] px-1 min-h-[36px] flex items-center truncate">
                                    {socialOrNA(savedHandle)}
                                  </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2 font-sans select-none">
                                <div className="opacity-80">
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">{plat==="youtube" ? "Subs" : "Followers"}</div>
                                    <div className="mt-0.5 py-1.5 border-b border-white/10 text-sm tabular-nums text-white/90 bg-white/[0.02] px-1 min-h-[32px] flex items-center" title="Auto-fetched on Save">
                                      {isConnected ? socialMetricOrNA(metrics.followers ?? metrics.subscribers, formatMetric) : "N/A"}
                                    </div>
                                </div>
                                <div className="opacity-80">
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">ER (%)</div>
                                    <div className="mt-0.5 py-1.5 border-b border-white/10 text-sm tabular-nums text-white/90 bg-white/[0.02] px-1 min-h-[32px] flex items-center" title="Auto-fetched on Save">
                                      {isConnected ? socialMetricOrNA(metrics.engagement, (n) => n.toFixed(1)) : "N/A"}
                                    </div>
                                </div>
                                <div className="opacity-80">
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">Views</div>
                                    <div className="mt-0.5 py-1.5 border-b border-white/10 text-sm tabular-nums text-white/90 bg-white/[0.02] px-1 min-h-[32px] flex items-center" title="Auto-fetched on Save">
                                      {isConnected ? socialMetricOrNA(metrics.views, formatMetric) : "N/A"}
                                    </div>
                                </div>
                                <div className="opacity-80">
                                    <div className="text-[9px] opacity-50 uppercase tracking-widest">Posts</div>
                                    <div className="mt-0.5 py-1.5 border-b border-white/10 text-sm tabular-nums text-white/90 bg-white/[0.02] px-1 min-h-[32px] flex items-center" title="Auto-fetched on Save">
                                      {isConnected ? socialMetricOrNA(metrics.posts, formatMetric) : "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )})}
                  </div>
              </section>

              {isCreator && (
                <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section id="sec-rate" className="space-y-2 border border-white/10 bg-white/[0.02] p-4">
                    <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                      <span className="mr-2">05</span>
                      Pricing &amp; rates
                    </h2>
                    <F label="Base Rate (INR) *">
                        <input type="number" required min={1} className="inp font-sans text-lg" value={f.base_rate || ""} onChange={e=>setF({...f,base_rate:Number(e.target.value)})} />
                    </F>
                </section>

                <section className="space-y-3 border border-white/10 bg-white/[0.02] p-4" id="sec-content-types">
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

                    <MultiSelectDropdown
                      options={CONTENT_TYPES}
                      selected={Array.isArray(f.content_types) ? f.content_types : toList(f.content_types)}
                      onChange={(vals) => setF({ ...f, content_types: vals })}
                      placeholder="Select content types…"
                      compact
                      label="Content types *"
                    />
                </section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="space-y-3 border border-white/10 bg-white/[0.02] p-4">
                    <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                      <span className="mr-2">06</span>
                      Portfolio
                    </h2>
                    
                    <F label="Images and Videos">
                      <div className="grid grid-cols-2 gap-2">
                        {f.portfolio.map((p, i) => (
                          <div key={i} className="relative group aspect-square bg-[#0B0B0E] border border-white/10">
                            {p && (p.match(/\.(mp4|webm|ogg)$/i) ? (
                                <video src={p} className="w-full h-full object-cover" controls />
                            ) : (
                                <img src={p} alt="" className="w-full h-full object-cover" />
                            ))}
                            <button type="button" onClick={()=>removePortfolio(i)} className="absolute top-1.5 right-1.5 p-1 bg-[#0B0B0E]/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <input ref={portfolioRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPortfolioPick} />
                        <button type="button" onClick={()=>portfolioRef.current?.click()} className="edit-btn bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white">
                          <Upload className="w-3 h-3" /> Add images / videos
                        </button>
                      </div>
                    </F>
                </section>
                </div>

                <section className="space-y-3 border border-white/10 bg-white/[0.02] p-4" id="sec-campaigns">
                        <h2 className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#FF3B30] font-semibold border-b border-white/10 pb-2">
                          Past campaigns
                        </h2>
                        <F label="Optional · max 5">
                            <div className="space-y-3">
                                <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-sans uppercase tracking-widest opacity-50">
                                    <div className="col-span-2">Brand</div>
                                    <div className="col-span-3">Campaign Scope</div>
                                    <div className="col-span-2">Date</div>
                                    <div className="col-span-2">Result</div>
                                    <div className="col-span-2">Post Link</div>
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
                                            <input type="text" inputMode="url" className="inp text-xs py-1.5 font-sans" placeholder="https://" value={c.post_url || ""} onChange={e=>setCampaign(i, 'post_url', e.target.value)} />
                                        </div>
                                        <div className="md:col-span-1 text-right">
                                            <button type="button" onClick={()=>removeCampaign(i)} className="p-2 opacity-60 hover:opacity-100 hover:text-[#FF3B30] transition-opacity">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {f.past_campaigns.length < 5 ? (
                                    <button type="button" onClick={addCampaign} className="edit-btn bg-white/5 hover:bg-white/10 text-white">
                                      <Plus className="w-3 h-3" /> Add campaign ({f.past_campaigns.length}/5)
                                    </button>
                                ) : (
                                    <div className="font-sans text-xs text-orange-400">
                                        Maximum limit reached (5/5)
                                    </div>
                                )}
                            </div>
                        </F>
                </section>
                </>
              )}

          <div className="pt-2">
            <button type="submit" disabled={busy} className="edit-btn bg-[#FF3B30] text-white hover:bg-[#e03126] px-5 py-2.5 text-[11px]">
              <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </motion.form>
      </div>
      <Footer />
      {cropState && (
        <ImageCropModal
          imageSrc={cropState.src}
          aspect={cropState.aspect}
          title={cropState.title}
          target={cropState.target || "default"}
          onCancel={() => {
            if (cropState.src?.startsWith("blob:")) URL.revokeObjectURL(cropState.src);
            setCropState(null);
          }}
          onComplete={onCropComplete}
        />
      )}
      <style>{`
      .edit-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.4rem 0.75rem; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; font-family: 'Manrope', sans-serif; font-weight: 600; border: none; cursor: pointer; transition: background-color 200ms ease, color 200ms ease, transform 200ms ease; line-height: 1.2; }
      .edit-btn:hover { transform: translateY(-1px); }
      .edit-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
      .edit-btn svg { flex-shrink: 0; width: 0.75rem; height: 0.75rem; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0.7; }
      html.theme-light input[type="date"]::-webkit-calendar-picker-indicator { filter: none; opacity: 0.7; }
      `}</style>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-normal block mb-0">{label}</label>
      {children}
    </div>
  );
}
