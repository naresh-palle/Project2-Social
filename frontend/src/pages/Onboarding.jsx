import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Loader2, AlertCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Nav } from "@/components/Nav";

const ALL_CATEGORIES = [
  "Fashion", "Beauty", "Skincare", "Makeup", "Haircare", "Food", "Cooking", "Recipes",
  "Travel", "Luxury Travel", "Adventure", "Fitness", "Gym", "Yoga", "Health & Wellness",
  "Nutrition", "Technology", "Gadgets", "AI & Tech", "Gaming", "Esports", "Education",
  "Finance", "Stock Market", "Crypto", "Business", "Entrepreneurship", "Career", "Motivation",
  "Comedy", "Entertainment", "Movies", "Music", "Dance", "Photography", "Videography",
  "Parenting", "Kids", "Pet Care", "Automobiles", "Electric Vehicles", "Motorcycles",
  "Home Decor", "Interior Design", "DIY", "Art & Craft", "Books", "Product Reviews",
  "Unboxing", "News", "Politics", "Agriculture", "Real Estate", "Shopping", "E-commerce",
  "Sustainability", "Environment", "Spirituality", "Religion", "Science", "Coding",
  "Programming", "Web Development", "Mobile Development", "UI/UX Design", "Graphic Design",
  "Animation", "Digital Marketing", "Affiliate Marketing", "Podcast", "Public Speaking",
  "Local Culture", "Events", "Wedding", "Lifestyle Vlogging", "Daily Vlogs", "Short-form Content", "Memes"
];

const PLATFORMS = ["Instagram", "YouTube", "Facebook", "X (Twitter)", "LinkedIn", "Snapchat", "Moj", "Josh", "ShareChat", "Chingari"];

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  
  const [step, setStep] = useState(1);
  const [socials, setSocials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [industry, setIndustry] = useState("");
  
  // Social fetch state
  const [platform, setPlatform] = useState("Instagram");
  const [handle, setHandle] = useState("");
  const [fetching, setFetching] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const addSocial = async () => {
    if (!handle) return;
    setFetching(true);
    try {
      const { data } = await api.post("/social/fetch", { platform, handle });
      setSocials([...socials, { platform, handle, ...data }]);
      setHandle("");
    } catch (e) {
      setError("Failed to fetch social stats.");
    }
    setFetching(false);
  };

  const toggleCategory = (c) => {
    if (categories.includes(c)) {
      setCategories(categories.filter((x) => x !== c));
    } else {
      setCategories([...categories, c]);
    }
  };

  const submitProfile = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        onboarding_status: "completed",
        niches: user.role === "influencer" ? categories : [industry],
        industry: user.role === "owner" ? industry : null,
        social_accounts: socials,
        platforms: socials.map(s => s.platform)
      };
      await api.patch("/auth/me", payload);
      await refresh();
      nav("/dashboard");
    } catch (e) {
      setError("Failed to complete onboarding.");
      setSubmitting(false);
    }
  };

  // Influencer Step 1: Socials
  if (user.role === "influencer" && step === 1) {
    return (
      <Layout step={1} title="Connect your audience." subtitle="Step 01 / Socials">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <select 
              value={platform} 
              onChange={e => setPlatform(e.target.value)}
              className="col-span-1 bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg font-mono"
            >
              {PLATFORMS.map(p => <option key={p} className="bg-black">{p}</option>)}
            </select>
            <input 
              type="text" 
              placeholder="@handle or URL" 
              value={handle}
              onChange={e => setHandle(e.target.value)}
              className="col-span-2 bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg"
            />
          </div>
          <button 
            onClick={addSocial}
            disabled={fetching || !handle}
            className="btn-outline w-full justify-center disabled:opacity-50"
          >
            {fetching ? <Loader2 className="animate-spin w-4 h-4" /> : <><Plus className="w-4 h-4 mr-2" /> Add Social Account</>}
          </button>

          {socials.length > 0 && (
            <div className="mt-8 space-y-4">
              <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60">Connected Accounts</h4>
              {socials.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-4 border border-[#F4F4F0]/10 rounded-sm">
                  <div>
                    <div className="font-editorial text-xl">{s.handle}</div>
                    <div className="font-mono text-xs opacity-60">{s.platform}</div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <div>{s.followers.toLocaleString()} Followers</div>
                    <div className="text-[#34C759]">{s.engagement_rate}% ER</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-8 flex justify-end">
            <button 
              onClick={() => setStep(2)}
              disabled={socials.length === 0}
              className="btn-solid disabled:opacity-50"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Influencer Step 2: Categories
  if (user.role === "influencer" && step === 2) {
    return (
      <Layout step={2} title="Define your niche." subtitle="Step 02 / Categories (Select at least 3)">
        <div className="flex flex-wrap gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {ALL_CATEGORIES.map(c => {
            const active = categories.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`px-4 py-2 font-mono text-xs tracking-widest uppercase transition-colors duration-200 border ${
                  active ? "border-[#FF3B30] bg-[#FF3B30] text-white" : "border-[#F4F4F0]/20 hover:border-[#F4F4F0]/50"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="pt-8 flex justify-between items-center">
          <button onClick={() => setStep(1)} className="font-mono text-xs tracking-widest uppercase opacity-60 hover:opacity-100">
            ← Back
          </button>
          <button 
            onClick={() => setStep(3)}
            disabled={categories.length < 3}
            className="btn-solid disabled:opacity-50"
          >
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
              {ALL_CATEGORIES.map(p => <option key={p} className="bg-black" value={p}>{p}</option>)}
            </select>
          <div className="pt-8 flex justify-end">
            <button 
              onClick={() => setStep(2)}
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

  // Step 3 / 2: Review
  return (
    <Layout step={step} title="Review your profile." subtitle="Final Step / Confirmation">
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-6 p-6 border border-[#F4F4F0]/10 bg-white/5">
          <div>
            <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Name</div>
            <div className="font-editorial text-2xl">{user.name}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Location</div>
            <div className="font-editorial text-2xl">{user.city}, {user.state}</div>
          </div>
          {user.role === "owner" && (
            <div className="col-span-2">
              <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Industry</div>
              <div className="font-editorial text-2xl text-[#FF3B30]">{industry}</div>
            </div>
          )}
          {user.role === "influencer" && (
            <div className="col-span-2">
              <div className="font-mono text-[10px] tracking-widest uppercase opacity-50 mb-1">Categories</div>
              <div className="font-mono text-xs uppercase leading-relaxed text-[#FF3B30]">{categories.join(" · ")}</div>
            </div>
          )}
        </div>

        {error && <div className="text-[#FF3B30] font-mono text-xs">{error}</div>}

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(step - 1)} className="font-mono text-xs tracking-widest uppercase opacity-60 hover:opacity-100">
            ← Back
          </button>
          <button 
            onClick={submitProfile}
            disabled={submitting}
            className="btn-solid disabled:opacity-50"
          >
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
          className="w-full max-w-2xl"
        >
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mb-4 text-[#FF3B30]">
            {subtitle}
          </div>
          <h1 className="font-editorial text-5xl md:text-6xl mb-12 leading-none italic">
            {title}
          </h1>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
