
import sys

with open("frontend/src/pages/Onboarding.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert MultiSelectDropdown before export default function Onboarding
dropdown_code = """
const MultiSelectDropdown = ({ options, selected, onChange, placeholder, single = false }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
       <div onClick={() => setOpen(!open)} className="w-full bg-transparent hairline-b py-4 cursor-pointer text-xl font-editorial flex justify-between items-center group focus:border-[#FF3B30] border-b border-white/10 hover:border-white/30 transition-colors">
          <span className={selected.length > 0 ? "" : "opacity-50"}>
             {selected.length > 0 ? selected.join(", ") : placeholder}
          </span>
          <span className="text-xs opacity-50 group-hover:opacity-100 transition-opacity">?</span>
       </div>
       {open && (
         <div className="absolute top-full left-0 w-full max-h-60 overflow-y-auto bg-[#0B0B0E] border border-white/10 z-50 shadow-2xl">
           {options.map(opt => {
              const isSel = selected.includes(opt);
              return (
                 <div key={opt} onClick={() => {
                     if (single) {
                         onChange([opt]);
                         setOpen(false);
                     } else {
                         if (isSel) onChange(selected.filter(x => x !== opt));
                         else onChange([...selected, opt]);
                     }
                 }} className={`p-4 cursor-pointer hover:bg-white/5 border-b border-white/5 flex justify-between items-center transition-colors ${isSel ? "text-[#FF3B30]" : "opacity-70 hover:opacity-100"}`}>
                    <span className="font-editorial text-xl">{opt}</span>
                    {isSel && <span>?</span>}
                 </div>
              )
           })}
         </div>
       )}
    </div>
  )
}

"""
if "const MultiSelectDropdown" not in content:
    idx = content.find("export default function Onboarding")
    content = content[:idx] + dropdown_code + content[idx:]


# 2. Replace Content Category block
old_cat = """          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Content Category * (Multi-Select)</h4>
            <p className="text-xs opacity-50 mb-2">Hold Ctrl (Windows) or Command (Mac) to select multiple.</p>
            <select 
              multiple
              value={currentCats} 
              onChange={e => {
                  const options = [...e.target.selectedOptions];
                  const values = options.map(o => o.value);
                  setF({...f, category: values});
              }}
              className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial min-h-[160px]"
            >
              {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0B0B0E] p-2 mb-1">{c}</option>)}
            </select>
          </div>"""

new_cat = """          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Content Category *</h4>
            <MultiSelectDropdown 
               options={CATEGORIES}
               selected={currentCats}
               onChange={(vals) => setF({...f, category: vals})}
               placeholder="Select Categories..."
            />
          </div>"""

content = content.replace(old_cat, new_cat)

# 3. Replace Languages block
old_lang = """          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Languages You Speak *</h4>
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
          </div>"""

new_lang = """          <div>
            <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Languages You Speak *</h4>
            <MultiSelectDropdown 
               options={LANGUAGES}
               selected={f.languages}
               onChange={(vals) => setF({...f, languages: vals})}
               placeholder="Select Languages..."
            />
          </div>"""

content = content.replace(old_lang, new_lang)

# 4. Remove Base City block
old_city = """          <div>
             <h4 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-2">Base City *</h4>
             <select className="w-full bg-transparent hairline-b py-4 focus:outline-none focus:border-[#FF3B30] text-xl font-editorial" value={f.city} onChange={e=>setF({...f,city:e.target.value})}>
                 <option value="" className="bg-[#0B0B0E]">Select City...</option>
                 {CITIES.map(c => <option key={c} value={c} className="bg-[#0B0B0E]">{c}</option>)}
             </select>
          </div>"""

content = content.replace(old_city, "")

# 5. Connect Audience clickable icons
old_aud = """            {PLATFORMS.map(plat => (
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
            ))}"""

new_aud = """            {PLATFORMS.map(plat => {
                const handle = f.platform_metrics[plat]?.handle;
                let link = "";
                if (plat === "instagram") link = handle ? `https://instagram.com/${handle.replace("@","")}` : "https://instagram.com";
                if (plat === "youtube") link = handle ? `https://youtube.com/${handle.replace("@","")}` : "https://youtube.com";
                if (plat === "twitter") link = handle ? `https://twitter.com/${handle.replace("@","")}` : "https://twitter.com";
                
                return (
                <div key={plat} className="p-4 border border-white/10 bg-white/[0.02] mb-4">
                    <div className="font-editorial text-2xl capitalize mb-4 text-[#FF3B30] flex items-center gap-3">
                      <a href={link} target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
                         {plat === "instagram" && <Instagram className="w-6 h-6" />}
                         {plat === "youtube" && <Youtube className="w-6 h-6" />}
                         {plat === "twitter" && <Twitter className="w-6 h-6" />}
                      </a>
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
                )
            })}"""

content = content.replace(old_aud, new_aud)

# 6. Remove f.city from the disabled check in Continue button!
content = content.replace("!f.city ||", "")


with open("frontend/src/pages/Onboarding.jsx", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")

