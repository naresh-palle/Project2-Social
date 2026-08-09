import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Loader2, Plus, X, Instagram, Youtube, Twitter, Facebook } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, emptyPlatformMetrics } from "@/lib/platforms";

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
const PLATFORMS = SOCIAL_PLATFORMS;

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [categoriesList, setCategoriesList] = useState([]);

  useEffect(() => {
    api.get('/categories').then(res => setCategoriesList(res.data)).catch(console.error);
  }, []);

  // Influencer State
  const [f, setF] = useState(() => {
    const saved = localStorage.getItem("onboarding_f");
    if (saved) return JSON.parse(saved);
    return {
      category: [],
      languages: [],
      city: "",
      availability: "",
      platform_metrics: emptyPlatformMetrics(),
    };
  });

  useEffect(() => {
    localStorage.setItem("onboarding_f", JSON.stringify(f));
  }, [f]);

  // Owner State
  const [industry, setIndustry] = useState("");

  // Agent State
  const [agentForm, setAgentForm] = useState({
    company: user?.company || "",
    agent_type: user?.agent_type || "company_agent",
    industry: user?.industry || "Fashion & Apparel",
    city: user?.city || "Bangalore",
    website: user?.website || "",
    bio: user?.bio || "",
    roster_size: user?.roster_size || "10-50 influencers"
  });
  const [isEditingAgent, setIsEditingAgent] = useState(false);

  // Manual Auth State
  const [manualAuthPlatform, setManualAuthPlatform] = useState(null);
  const [manualAuthHandle, setManualAuthHandle] = useState("");

  if (!user) return null;

  // AGENT ONBOARDING & APPROVAL WORKFLOW
  if (user.role === "agent") {
    const isPending = user.onboarding_status === "pending_approval" || (user.onboarding_status === "completed" && !user.agent_approved && user.onboarding_status !== "declined");
    const isDeclined = user.onboarding_status === "declined";
    const isApproved = user.agent_approved;

    const submitAgentApplication = async (e) => {
      e?.preventDefault();
      setSubmitting(true);
      setError("");
      try {
        await api.patch("/auth/me", {
          ...agentForm,
          onboarding_status: "pending_approval",
          agent_approved: false
        });
        await refresh();
        setIsEditingAgent(false);
      } catch (err) {
        setError("Failed to submit application. Please try again.");
      } finally {
        setSubmitting(false);
      }
    };

    // 1. Pending Approval Review Screen (Shown after Agent submits details)
    if (isPending && !isEditingAgent) {
      return (
        <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
          <Nav />
          <div className="flex-1 flex items-center justify-center p-6 pt-24 pb-12">
            <div className="max-w-xl w-full bg-[#121212] border border-white/15 p-8 md:p-12 rounded-sm shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                  § Application Under Review
                </span>
                <span className="font-mono text-xs uppercase text-orange-400 bg-orange-400/10 px-3 py-1 border border-orange-400/30 rounded-xs font-semibold">
                  Pending Admin Approval
                </span>
              </div>

              <div>
                <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight font-bold">
                  Your Agency File is Submitted
                </h1>
                <p className="font-mono text-xs opacity-70 mt-2 leading-relaxed">
                  Super Admin is currently verifying your agency credentials. Once approved, your dedicated Agent Console will unlock automatically.
                </p>
              </div>

              <div className="bg-white/5 p-5 border border-white/10 rounded-sm space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="opacity-50">Agency / Company:</span>
                  <span className="text-white font-bold">{user.company || "Agency"}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="opacity-50">Agent Type:</span>
                  <span className="text-[#FF3B30] font-bold">
                    {user.agent_type === "influencer_agent" ? "⭐ Influencer Agent" : "🏢 Company Agent"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="opacity-50">Industry Focus:</span>
                  <span className="text-white">{user.industry || "General"}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="opacity-50">Location:</span>
                  <span className="text-white">{user.city || "Global"}</span>
                </div>
                {user.website && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="opacity-50">Official Website:</span>
                    <a href={user.website} target="_blank" rel="noreferrer" className="text-[#FF3B30] hover:underline">
                      {user.website} ↗
                    </a>
                  </div>
                )}
                {user.bio && (
                  <div className="pt-1">
                    <span className="opacity-50 block mb-1">Representation Statement:</span>
                    <span className="text-white/80 italic">{user.bio}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditingAgent(true)}
                  className="btn-pill text-xs py-2 px-4"
                >
                  ✏️ Edit Application Details
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await refresh();
                    if (user.agent_approved) nav("/dashboard");
                  }}
                  className="btn-solid py-2 px-5 text-xs bg-[#FF3B30] text-white"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 hidden" />
                  Check Status 🔄
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. Application Declined Screen
    if (isDeclined && !isEditingAgent) {
      return (
        <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
          <Nav />
          <div className="flex-1 flex items-center justify-center p-6 pt-24 pb-12">
            <div className="max-w-xl w-full bg-[#121212] border border-[#FF3B30]/40 p-8 md:p-12 rounded-sm shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                  § Application Status Update
                </span>
                <span className="font-mono text-xs uppercase text-[#FF3B30] bg-[#FF3B30]/10 px-3 py-1 border border-[#FF3B30]/30 rounded-xs font-semibold">
                  Revision Required
                </span>
              </div>

              <div>
                <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight font-bold text-white">
                  Application Revision Needed
                </h1>
                <div className="mt-4 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-sm font-mono text-xs text-white">
                  <span className="text-[#FF3B30] font-bold uppercase block mb-1">Admin Feedback:</span>
                  {user.decline_reason || "Agency credentials require further verification before granting full access."}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingAgent(true)}
                  className="btn-solid py-3 px-6 text-sm bg-[#FF3B30] text-white hover:bg-[#e03126]"
                >
                  ✏️ Update &amp; Resubmit Details →
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. Agent Onboarding Details Entry Form
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center p-6 pt-24 pb-12">
          <form
            onSubmit={submitAgentApplication}
            className="max-w-2xl w-full bg-[#121212] border border-white/15 p-8 md:p-12 rounded-sm shadow-2xl space-y-8"
          >
            <div className="border-b border-white/10 pb-4">
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                § Talent Agent Application
              </span>
              <h1 className="font-sans text-3xl md:text-5xl font-bold tracking-tight mt-1">
                Agency <span className="italic text-[#FF3B30]">Credentials</span>
              </h1>
              <p className="font-mono text-xs opacity-70 mt-2">
                Enter your complete agency details below. Your file will be submitted to Super Admin for verification.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/30 font-mono text-xs text-[#FF3B30]">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Agent Type Selection Cards */}
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70 block mb-2">
                  Talent Agent Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setAgentForm({ ...agentForm, agent_type: "company_agent" })}
                    className={`p-4 border text-left rounded-sm transition-all cursor-pointer ${
                      agentForm.agent_type === "company_agent"
                        ? "border-[#FF3B30] bg-[#FF3B30]/10 text-white font-bold"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-editorial text-lg text-white">🏢 Company Agent</div>
                    <div className="font-mono text-[10px] uppercase opacity-70 mt-1">
                      Represent brand clients, manage client roster, and post campaign briefs
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAgentForm({ ...agentForm, agent_type: "influencer_agent" })}
                    className={`p-4 border text-left rounded-sm transition-all cursor-pointer ${
                      agentForm.agent_type === "influencer_agent"
                        ? "border-[#FF3B30] bg-[#FF3B30]/10 text-white font-bold"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-editorial text-lg text-white">⭐ Influencer Agent</div>
                    <div className="font-mono text-[10px] uppercase opacity-70 mt-1">
                      Manage influencer roster, receive admin campaign briefs &amp; arrange talent
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                    Agency / Company Name *
                  </label>
                  <input
                    required
                    className="inp"
                    value={agentForm.company}
                    onChange={(e) => setAgentForm({ ...agentForm, company: e.target.value })}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                    Industry Specialization *
                  </label>
                  <select
                    className="inp bg-[#121212] cursor-pointer"
                    value={agentForm.industry}
                    onChange={(e) => setAgentForm({ ...agentForm, industry: e.target.value })}
                  >
                    <option value="Fashion & Apparel">Fashion & Apparel</option>
                    <option value="Beauty & Cosmetics">Beauty & Cosmetics</option>
                    <option value="Technology & SaaS">Technology & SaaS</option>
                    <option value="Gaming & Esports">Gaming & Esports</option>
                    <option value="Luxury Goods">Luxury Goods</option>
                    <option value="Food & Beverages">Food & Beverages</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                    Headquarters / City *
                  </label>
                  <input
                    required
                    className="inp"
                    value={agentForm.city}
                    onChange={(e) => setAgentForm({ ...agentForm, city: e.target.value })}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                    Official Website / Portfolio *
                  </label>
                  <input
                    type="url"
                    required
                    className="inp font-mono text-sm"
                    value={agentForm.website}
                    onChange={(e) => setAgentForm({ ...agentForm, website: e.target.value })}
                    placeholder=""
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                  Representation Bio &amp; Agency Statement *
                </label>
                <textarea
                  required
                  rows={4}
                  className="inp resize-none mt-2"
                  value={agentForm.bio}
                  onChange={(e) => setAgentForm({ ...agentForm, bio: e.target.value })}
                  placeholder=""
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-solid py-4 px-8 text-base bg-[#FF3B30] text-white hover:bg-[#e03126] flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  <>Send Application for Admin Approval →</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const connectAccount = (platformId) => {
    setManualAuthPlatform(platformId);
    setManualAuthHandle("");
  };

  const saveManualAccount = async (e) => {
    e.preventDefault();
    if (!manualAuthHandle) return;
    
    try {
      const updatedConnections = [...(user?.oauth_connections || []), {
        platform: manualAuthPlatform,
        handle: manualAuthHandle,
        connected_at: new Date().toISOString()
      }];
      
      await api.patch("/auth/me", { oauth_connections: updatedConnections });
      await refresh();
      setManualAuthPlatform(null);
      setManualAuthHandle("");
      toast.success(`${manualAuthPlatform} connected successfully!`);
    } catch (err) {
      toast.error("Failed to save account connection.");
    }
  };
const toggleCategory = (c) => {
    const currentCats = Array.isArray(f.category) 
      ? f.category 
      : (typeof f.category === "string" && f.category ? f.category.split(", ").filter(Boolean) : []);
    
    const updated = currentCats.includes(c) 
      ? currentCats.filter(x => x !== c) 
      : [...currentCats, c];
    
    setF({ ...f, category: updated });
  };

  const toggleLang = (l) => {
      setF({...f, languages: f.languages.includes(l) ? f.languages.filter(x => x !== l) : [...f.languages, l]});
  };

  const submitProfile = async () => {
    setSubmitting(true);
    setError("");
    try {
      let payload = { onboarding_status: "completed" };
      const isInfluencer = user.role === "influencer" || user.role === "creator";
      if (isInfluencer) {
          const categoryStr = Array.isArray(f.category) ? f.category.join(", ") : f.category;
          const nichesArr = Array.isArray(f.category) ? f.category : (f.category ? [f.category] : []);
          payload = {
            ...payload,
            category: categoryStr,
            niches: nichesArr,
            languages: f.languages,
            city: f.city,
            location: f.city,
            availability: f.availability,
            platform_metrics: f.platform_metrics,
          };
      } else if (user.role === "owner") {
          payload = { ...payload, industry };
      }
      
      await api.patch("/auth/me", payload);
      await refresh();
      nav("/dashboard");
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message || "Failed to complete onboarding.");
      setSubmitting(false);
    }
  };


  const isInfluencer = user.role === "influencer" || user.role === "creator";

  // INFLUENCER STEP 1: NICHE & PROFILE
  if (isInfluencer && step === 1) {
    const currentCats = Array.isArray(f.category) 
      ? f.category 
      : (typeof f.category === "string" && f.category ? f.category.split(", ").filter(Boolean) : []);

    return (
      <Layout step={1} title="Define your niche & availability." subtitle="Step 01 / Identity">
        <div className="space-y-12">
          
          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Content Category *</h4>
            <MultiSelectDropdown 
               options={categoriesList.map(c => typeof c === 'string' ? c : c.name)}
               selected={currentCats}
               onChange={(vals) => setF({...f, category: vals})}
               placeholder="Select Categories..."
            />
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Languages You Speak *</h4>
            <MultiSelectDropdown 
               options={LANGUAGES}
               selected={f.languages}
               onChange={(vals) => setF({...f, languages: vals})}
               placeholder="Select Languages..."
            />
          </div>


          <div>
              <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Current Availability *</h4>
              <MultiSelectDropdown 
                 options={AVAILABILITIES}
                 selected={f.availability ? [f.availability] : []}
                 onChange={(vals) => setF({...f, availability: vals[0] || ""})}
                 placeholder="Select Availability..."
                 single={true}
              />
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Connect your audience.</h4>
            <p className="text-sm opacity-60 mb-6">Securely connect your social accounts via official OAuth.</p>
            <div className="flex flex-wrap gap-4 mb-4">
               {PLATFORMS.map(plat => {
                   const isConnected = user?.oauth_connections?.some(c => c.platform === plat);
                   return (
                      <button key={plat} onClick={() => !isConnected && connectAccount(plat)} type="button" className={`p-4 border rounded-full transition-colors flex items-center justify-center ${isConnected ? "border-[#34C759] text-[#34C759] bg-[#34C759]/10" : "border-white/10 hover:border-white/30 text-white/70"}`}>
                          {plat === "instagram" && <Instagram className="w-8 h-8" />}
                          {plat === "facebook" && <Facebook className="w-8 h-8" />}
                          {plat === "twitter" && <Twitter className="w-8 h-8" />}
                          {plat === "youtube" && <Youtube className="w-8 h-8" />}
                      </button>
                   );
               })}
            </div>
          </div>
        </div>
        <div className="pt-12 flex justify-end">
          <button
            onClick={() => setStep(4)}
            disabled={currentCats.length === 0 || f.languages.length === 0 || !f.availability || !user?.oauth_connections?.length}
            className="btn-solid disabled:opacity-50"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <AnimatePresence>
          {manualAuthPlatform && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#121212] border border-white/10 p-6 md:p-8 rounded-sm w-full max-w-md shadow-2xl relative"
              >
                <button 
                  onClick={() => setManualAuthPlatform(null)}
                  className="absolute top-4 right-4 text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <h3 className="font-editorial text-2xl mb-2 capitalize">Connect {manualAuthPlatform}</h3>
                <p className="font-mono text-[10px] text-white/50 uppercase tracking-wider mb-6">
                  Please enter your exact handle or username.
                </p>

                <form onSubmit={saveManualAccount} className="space-y-6">
                  <div>
                    <label className="font-mono text-[10px] uppercase opacity-70 block mb-2">
                      {manualAuthPlatform} Handle / Username *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-mono">@</span>
                      <input 
                        type="text" 
                        required
                        value={manualAuthHandle}
                        onChange={(e) => setManualAuthHandle(e.target.value.replace(/^@/, ''))}
                        className="inp pl-8 w-full"
                        placeholder="username"
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button 
                      type="button" 
                      onClick={() => setManualAuthPlatform(null)}
                      className="px-4 py-2 font-mono text-xs text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={!manualAuthHandle}
                      className="btn-solid py-2 px-6 bg-[#FF3B30] text-white disabled:opacity-50"
                    >
                      Save & Connect
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Layout>
    );
  }

  // Owner Step 1: Industry
  if (user.role === "owner" && step === 1) {
    return (
      <Layout step={1} title="Define your market." subtitle="Step 01 / Industry">
        <div className="space-y-6">
           <select 
              value={industry} 
              onChange={e => setIndustry(e.target.value)}
              className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial"
            >
              <option value="" className="bg-[#0B0B0E]" disabled>Select your primary industry</option>
              {categoriesList.map(c => typeof c === 'string' ? c : c.name).map(p => <option key={p} className="bg-[#0B0B0E]" value={p}>{p}</option>)}
            </select>
          <div className="pt-8 flex justify-end">
            <button 
              onClick={() => setStep(4)}
              disabled={!industry}
              className="btn-solid disabled:opacity-50"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // FINAL STEP: Review
  return (
    <Layout step={4} title="Review your profile." subtitle="Final Step / Confirmation">
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-6 p-6 border border-[#F4F4F0]/10 bg-white/5">
          <div>
            <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Name</div>
            <div className="font-editorial text-2xl">{user.name}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Location</div>
            <div className="font-editorial text-2xl">{f.city || user.city}</div>
          </div>
          {user.role === "owner" && (
            <div className="col-span-2">
              <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Industry</div>
              <div className="font-editorial text-2xl text-[#FF3B30]">{industry}</div>
            </div>
          )}
          {isInfluencer && (
            <>
                <div className="col-span-2">
                <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Category</div>
                <div className="font-mono text-xs uppercase leading-relaxed text-[#FF3B30]">
                  {Array.isArray(f.category) ? f.category.join(", ") : f.category}
                </div>
                </div>
                <div className="col-span-2">
                <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Languages</div>
                <div className="font-mono text-xs uppercase leading-relaxed text-[#FF3B30]">{f.languages.join(", ")}</div>
                </div>
            </>
          )}
        </div>

        {error && <div className="text-[#FF3B30] font-mono text-xs">{error}</div>}

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(1)} className="font-mono text-xs tracking-widest uppercase opacity-60 hover:opacity-100">
            ← Back
          </button>
          <button onClick={submitProfile} disabled={submitting} className="btn-solid disabled:opacity-50">
            {submitting ? "Confirming..." : "Confirm & Enter Studio"}
          </button>
        </div>
      </div>
    </Layout>
  );
}

function Layout({ step, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      
      <Nav />
      <div className="flex-1 flex items-center justify-center p-6 mt-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={step}
          className="w-full max-w-3xl"
        >
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-4 text-[#FF3B30]">
            {subtitle}
          </div>
          <h1 className="font-sans text-4xl md:text-6xl font-bold tracking-tight mb-12 leading-[1.15] italic">
            {title}
          </h1>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
