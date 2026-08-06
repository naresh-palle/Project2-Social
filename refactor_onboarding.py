
import sys

with open("frontend/src/pages/Onboarding.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add imports
if "Instagram" not in content:
    content = content.replace("import { ChevronRight, Loader2, Plus, X } from \"lucide-react\";", "import { ChevronRight, Loader2, Plus, X, Instagram, Youtube, Twitter } from \"lucide-react\";")

# Replace influencer steps
start_marker = "  // INFLUENCER STEP 1: NICHE & LANGUAGE"
end_marker = "  // Owner Step 1: Industry"

new_influencer_code = """  // INFLUENCER STEP 1: NICHE & PROFILE
  if (user.role === "influencer" && step === 1) {
    const currentCats = Array.isArray(f.category) 
      ? f.category 
      : (typeof f.category === "string" && f.category ? f.category.split(", ").filter(Boolean) : []);

    return (
      <Layout step={1} title="Define your niche & availability." subtitle="Step 01 / Identity">
        <div className="space-y-12">
          
          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Content Category * (Multi-Select)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORIES.map(c => {
                    const isSelected = currentCats.includes(c);
                    return (
                      <label key={c} className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${isSelected ? "border-[#FF3B30] bg-[#FF3B30]/10 text-white font-bold" : "border-white/10 hover:border-white/30 text-white/70"}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleCategory(c)} className="accent-[#FF3B30] w-4 h-4" />
                          <span className="text-xs font-mono uppercase tracking-widest">{c}</span>
                      </label>
                    );
                })}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Languages You Speak * Dropdown select</h4>
            <select 
              value={f.languages[0] || ""} 
              onChange={e => setF({...f, languages: [e.target.value]})} 
              className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial"
            >
              <option value="" className="bg-[#0B0B0E]">Select Language...</option>
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang} className="bg-[#0B0B0E]">{lang}</option>
              ))}
            </select>
          </div>

          <div>
             <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Base City *</h4>
             <select className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial" value={f.city} onChange={e=>setF({...f,city:e.target.value})}>
                 <option value="" className="bg-[#0B0B0E]">Select City...</option>
                 {CITIES.map(c => <option key={c} value={c} className="bg-[#0B0B0E]">{c}</option>)}
             </select>
          </div>
          <div>
              <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Current Availability *</h4>
              <select className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial" value={f.availability} onChange={e=>setF({...f,availability:e.target.value})}>
                  <option value="" className="bg-[#0B0B0E]">Select Availability...</option>
                  {AVAILABILITIES.map(a => <option key={a} value={a} className="bg-[#0B0B0E]">{a}</option>)}
              </select>
          </div>

          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-4">Connect your audience.</h4>
            <p className="text-sm opacity-60 mb-6">Enter your primary handles. These can be updated later in your profile.</p>
            {PLATFORMS.map(plat => (
                <div key={plat} className="p-4 border border-white/10 bg-white/[0.02] mb-4">
                    <div className="font-editorial text-2xl capitalize mb-4 text-[#FF3B30] flex items-center gap-3">
                      {plat === "instagram" && <Instagram className="w-6 h-6" />}
                      {plat === "youtube" && <Youtube className="w-6 h-6" />}
                      {plat === "twitter" && <Twitter className="w-6 h-6" />}
                      {plat} {plat === "instagram" && "*"}
                    </div>
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

        </div>
        <div className="pt-12 flex justify-end">
          <button onClick={() => setStep(4)} disabled={currentCats.length === 0 || f.languages.length === 0 || !f.city || !f.availability || !f.platform_metrics.instagram.handle} className="btn-solid disabled:opacity-50">
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Layout>
    );
  }

"""

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_influencer_code + content[end_idx:]
    
    # Also update the Back button on Final step
    content = content.replace("setStep(user.role === \"influencer\" ? 3 : 1)", "setStep(1)")
    
    with open("frontend/src/pages/Onboarding.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("FAILED TO FIND MARKERS")

