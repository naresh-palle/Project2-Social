import { Link2, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ICONS,
  SOCIAL_PLATFORM_HOVER_COLORS
} from "@/lib/platforms";

export function SocialConnect({ connectedPlatforms = [], onConnect }) {
  const [loading, setLoading] = useState(null);
  const [activePrompt, setActivePrompt] = useState(null);
  const [handleInput, setHandleInput] = useState("");

  const connectAccount = async (platformId, handle) => {
    if (!handle) return;
    setLoading(platformId);
    try {
      // Create the platform_metrics object with the provided handle
      const platform_metrics = {
        [platformId]: { handle }
      };
      
      // Sync analytics directly (this will fetch real data from Apify)
      const res = await api.post("/creators/sync-analytics", { platform_metrics });
      
      if (res.data?.ok) {
        toast.success(res.data?.message || `Successfully connected ${SOCIAL_PLATFORM_LABELS[platformId]}!`);
        if (onConnect) onConnect();
      } else {
        toast.error(res.data?.message || res.data?.error || `Failed to connect ${platformId}`);
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.response?.data?.message;
      toast.error(detail || `Failed to connect ${platformId}`);
    } finally {
      setLoading(null);
      setActivePrompt(null);
      setHandleInput("");
    }
  };
  
  if (connectedPlatforms.length >= SOCIAL_PLATFORMS.length) return null;

  return (
    <div className="bg-white/5 border border-[#F4F4F0]/10 p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-editorial text-2xl">Connect Social Accounts</h2>
          <p className="text-sm opacity-60 mt-1">Link your profiles to sync real-time analytics.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {SOCIAL_PLATFORMS.filter(p => !connectedPlatforms.includes(p)).map(p => {
          const isConnected = false;
          const Icon = SOCIAL_PLATFORM_ICONS[p];
          const name = SOCIAL_PLATFORM_LABELS[p];
          const color = SOCIAL_PLATFORM_HOVER_COLORS[p];
          const isPrompting = activePrompt === p;
          
          if (isPrompting) {
            return (
              <div key={p} className={`flex flex-col p-4 border border-white/20 bg-white/5 rounded-xl transition-all ${color}`}>
                 <div className="flex justify-between items-center mb-3">
                   <div className="flex items-center gap-2">
                     <Icon className="w-4 h-4" />
                     <span className="font-sans text-xs uppercase tracking-widest font-bold">{name}</span>
                   </div>
                   <button onClick={() => setActivePrompt(null)} className="text-white/50 hover:text-white">
                     <X className="w-4 h-4" />
                   </button>
                 </div>
                 <input 
                   type="text" 
                   autoFocus
                   placeholder="@handle or URL"
                   value={handleInput}
                   onChange={(e) => setHandleInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') connectAccount(p, handleInput);
                   }}
                   className="w-full bg-black/40 border border-white/10 rounded-3xl px-3 py-2 font-mono text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 mb-3"
                 />
                 <button 
                   onClick={() => connectAccount(p, handleInput)}
                   disabled={loading === p || !handleInput}
                   className="w-full bg-[#FF3B30] text-white hover:bg-[#e03126] font-sans text-[10px] uppercase tracking-widest font-bold py-2 rounded-3xl disabled:opacity-50"
                 >
                   {loading === p ? "Connecting..." : "Confirm"}
                 </button>
              </div>
            );
          }

          return (
            <button
              key={p}
              onClick={() => setActivePrompt(p)}
              disabled={isConnected}
              className={`flex items-center gap-3 p-4 border rounded-xl transition-all text-left group
                ${isConnected 
                  ? "border-[#34C759]/30 bg-[#34C759]/5 cursor-default" 
                  : `border-white/10 bg-white/[0.02] cursor-pointer ${color}`
                }
              `}
            >
              <div className={`p-2 rounded-full bg-white/5 ${isConnected ? "text-[#34C759]" : "group-hover:text-current"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[10px] tracking-widest uppercase mb-1 opacity-70">
                  {name}
                </div>
                <div className="text-sm font-bold">
                  Connect
                </div>
              </div>
              {isConnected && <div className="text-[#34C759]"><Link2 className="w-4 h-4" /></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
