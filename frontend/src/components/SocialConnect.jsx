import { X } from "lucide-react";
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

  const connected = new Set(
    (connectedPlatforms || []).map((p) => String(p || "").trim().toLowerCase())
  );

  const connectAccount = async (platformId, handle) => {
    if (!handle) return;
    setLoading(platformId);
    try {
      const platform_metrics = {
        [platformId]: { handle }
      };
      
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

  const missing = SOCIAL_PLATFORMS.filter((p) => !connected.has(p));
  if (missing.length === 0) return null;

  return (
    <div className="bg-white/5 border border-white/10 px-3.5 py-3 rounded-2xl" data-testid="connect-social">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h2 className="font-sans text-sm font-semibold tracking-tight">Connect Social Accounts</h2>
        <p className="text-[11px] text-white/45 hidden sm:block">Link profiles to sync analytics</p>
      </div>
      
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {missing.map(p => {
          const Icon = SOCIAL_PLATFORM_ICONS[p];
          const name = SOCIAL_PLATFORM_LABELS[p];
          const color = SOCIAL_PLATFORM_HOVER_COLORS[p];
          const isPrompting = activePrompt === p;
          
          if (isPrompting) {
            return (
              <div key={p} className={`flex flex-col p-2.5 border border-white/20 bg-white/5 rounded-xl transition-all ${color}`}>
                 <div className="flex justify-between items-center mb-2">
                   <div className="flex items-center gap-1.5 min-w-0">
                     <Icon className="w-3.5 h-3.5 shrink-0" />
                     <span className="font-sans text-[10px] uppercase tracking-wider font-semibold truncate">{name}</span>
                   </div>
                   <button type="button" onClick={() => setActivePrompt(null)} className="text-white/50 hover:text-white">
                     <X className="w-3.5 h-3.5" />
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
                   className="w-full bg-black/40 border border-white/10 rounded-full px-2.5 py-1.5 font-sans text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 mb-2"
                 />
                 <button 
                   type="button"
                   onClick={() => connectAccount(p, handleInput)}
                   disabled={loading === p || !handleInput}
                   className="w-full bg-[#FF3B30] text-white hover:bg-[#e03126] font-sans text-[10px] uppercase tracking-wider font-bold py-1.5 rounded-full disabled:opacity-50"
                 >
                   {loading === p ? "Connecting..." : "Confirm"}
                 </button>
              </div>
            );
          }

          return (
            <button
              key={p}
              type="button"
              onClick={() => setActivePrompt(p)}
              className={`flex items-center gap-2 px-2.5 py-2 border rounded-xl transition-all text-left group border-white/10 bg-white/[0.02] cursor-pointer ${color}`}
            >
              <div className="p-1.5 rounded-full bg-white/5 group-hover:text-current">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[10px] tracking-wide uppercase opacity-55 truncate">
                  {name}
                </div>
                <div className="text-xs font-semibold leading-tight">
                  Connect
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
