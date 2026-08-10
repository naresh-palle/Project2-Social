import { Link2 } from "lucide-react";
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

  const connectAccount = async (platformId) => {
    setLoading(platformId);
    try {
      const res = await api.get(`/oauth/${platformId}/login`);
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      toast.error(`Failed to connect ${platformId}`);
      setLoading(null);
    }
  };
  if (connectedPlatforms.length >= SOCIAL_PLATFORMS.length) return null;

  return (
    <div className="bg-white/5 border border-[#F4F4F0]/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-editorial text-2xl">Connect Social Accounts</h2>
          <p className="text-sm opacity-60 mt-1">Link your profiles to sync analytics and showcase your reach securely.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {SOCIAL_PLATFORMS.filter(p => !connectedPlatforms.includes(p)).map(p => {
          const isConnected = false;
          const Icon = SOCIAL_PLATFORM_ICONS[p];
          const name = SOCIAL_PLATFORM_LABELS[p];
          const color = SOCIAL_PLATFORM_HOVER_COLORS[p];
          
          return (
            <button
              key={p}
              onClick={() => !isConnected && connectAccount(p)}
              disabled={isConnected || loading === p}
              className={`flex items-center gap-3 p-4 border transition-all text-left group
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
                  {loading === p ? "Connecting..." : isConnected ? "Connected" : "Connect"}
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
