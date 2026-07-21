import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";

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
const PLATFORMS = ["instagram", "youtube", "twitter"];

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Influencer State
  const [f, setF] = useState({
      category: "",
      languages: [],
      city: "",
      availability: "",
      platform_metrics: {
        instagram: { handle: "", followers: 0, engagement: 0, views: 0 },
        youtube: { handle: "", followers: 0, engagement: 0, views: 0 },
        twitter: { handle: "", followers: 0, engagement: 0, views: 0 }
      }
  });

  // Owner State
  const [industry, setIndustry] = useState("");

  if (!user) return null;

  // Agent flow
  if (user.role === "agent") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="font-editorial text-4xl mb-4 italic">Pending Approval</h1>
            <p className="font-mono text-xs uppercase tracking-widest opacity-60 leading-relaxed">
              Your agent account is currently under review by our administration team. You will be granted access once approved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const toggleLang = (l) => {
      setF({...f, languages: f.languages.includes(l) ? f.languages.filter(x => x !== l) : [...f.languages, l]});
  };

  const submitProfile = async () => {
    setSubmitting(true);
    setError("");
    try {
      let payload = { onboarding_status: "completed" };
      if (user.role === "influencer") {
          payload = { ...payload, ...f };
      } else if (user.role === "owner") {
          payload = { ...payload, industry };
      }
      
      await api.patch("/auth/me", payload);
      await refresh();
      nav("/dashboard");
    } catch (e) {
      setError("Failed to complete onboarding.");
      setSubmitting(false);
    }
  };

  // INFLUENCER STEP 1: NICHE & LANGUAGE
  if (user.role === "influencer" && step === 1) {
    return (
      <Layout step={1} title="Define your niche." subtitle="Step 01 / Identity">
        <div className="space-y-12">
          
          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Content Category *</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map(c => (
                    <label key={c} className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${f.category === c ? "border-[#FF3B30] bg-[#FF3B30]/10" : "border-white/10 hover:border-white/30"}`}>
                        <input type="radio" name="category" value={c} checked={f.category === c} onChange={e=>setF({...f, category: e.target.value})} className="accent-[#FF3B30]" />
                        <span className="text-xs font-mono uppercase tracking-widest">{c}</span>
                    </label>
                ))}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Languages You Speak *</h4>
            <div className="grid grid-cols-3 gap-3">
                {LANGUAGES.map(lang => (
                    <label key={lang} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={f.languages.includes(lang)} onChange={()=>toggleLang(lang)} className="accent-[#FF3B30] w-4 h-4" />
                        <span className="text-sm">{lang}</span>
                    </label>
                ))}
            </div>
          </div>

        </div>
        <div className="pt-12 flex justify-end">
          <button onClick={() => setStep(2)} disabled={!f.category || f.languages.length === 0} className="btn-solid disabled:opacity-50">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Layout>
    );
  }

  // INFLUENCER STEP 2: LOCATION
  if (user.role === "influencer" && step === 2) {
    return (
      <Layout step={2} title="Where are you based?" subtitle="Step 02 / Availability">
        <div className="space-y-8">
            <div>
                <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Base City *</h4>
                <select className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial" value={f.city} onChange={e=>setF({...f,city:e.target.value})}>
                    <option value="" className="bg-black">Select City...</option>
                    {CITIES.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
                </select>
            </div>
            <div>
                <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Current Availability *</h4>
                <select className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial" value={f.availability} onChange={e=>setF({...f,availability:e.target.value})}>
                    <option value="" className="bg-black">Select Availability...</option>
                    {AVAILABILITIES.map(a => <option key={a} value={a} className="bg-black">{a}</option>)}
                </select>
            </div>
        </div>
        <div className="pt-12 flex justify-between items-center">
          <button onClick={() => setStep(1)} className="font-mono text-xs tracking-widest uppercase opacity-60 hover:opacity-100">← Back</button>
          <button onClick={() => setStep(3)} disabled={!f.city || !f.availability} className="btn-solid disabled:opacity-50">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Layout>
    );
  }

  // INFLUENCER STEP 3: SOCIALS
  if (user.role === "influencer" && step === 3) {
    return (
      <Layout step={3} title="Connect your audience." subtitle="Step 03 / Socials">
        <div className="space-y-6">
            <p className="text-sm opacity-60 mb-6">Enter your primary handles. These can be updated later in your profile.</p>
            {PLATFORMS.map(plat => (
                <div key={plat} className="p-4 border border-white/10 bg-white/[0.02]">
                    <div className="font-editorial text-2xl capitalize mb-4 text-[#FF3B30]">{plat} {plat === "instagram" && "*"}</div>
                    <div>
                        <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Handle / Link</label>
                        <input className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-[#FF3B30] text-lg mt-2" 
                               value={f.platform_metrics[plat]?.handle || ""} 
                               onChange={e=>setF({
                                   ...f, 
                                   platform_metrics: {
                                       ...f.platform_metrics, 
                                       [plat]: {...f.platform_metrics[plat], handle: e.target.value}
                                   }
                               })} />
                    </div>
                </div>
            ))}
        </div>
        <div className="pt-12 flex justify-between items-center">
          <button onClick={() => setStep(2)} className="font-mono text-xs tracking-widest uppercase opacity-60 hover:opacity-100">← Back</button>
          <button onClick={() => setStep(4)} disabled={!f.platform_metrics.instagram.handle} className="btn-solid disabled:opacity-50">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
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
              <option value="" className="bg-black" disabled>Select your primary industry</option>
              {CATEGORIES.map(p => <option key={p} className="bg-black" value={p}>{p}</option>)}
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
          {user.role === "influencer" && (
            <>
                <div className="col-span-2">
                <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Category</div>
                <div className="font-mono text-xs uppercase leading-relaxed text-[#FF3B30]">{f.category}</div>
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
          <button onClick={() => setStep(user.role === "influencer" ? 3 : 1)} className="font-mono text-xs tracking-widest uppercase opacity-60 hover:opacity-100">
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
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] flex flex-col">
      <div className="grain" />
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
          <h1 className="font-editorial text-5xl md:text-6xl mb-12 leading-[1.15] italic">
            {title}
          </h1>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
