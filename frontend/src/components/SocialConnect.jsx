import { Instagram, Facebook, Twitter, Youtube, Link2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Instagram, color: "hover:bg-pink-600/20 hover:border-pink-600 hover:text-pink-500" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "hover:bg-blue-600/20 hover:border-blue-600 hover:text-blue-500" },
  { id: "twitter", name: "X (Twitter)", icon: Twitter, color: "hover:bg-sky-500/20 hover:border-sky-500 hover:text-sky-400" },
  { id: "youtube", name: "YouTube", icon: Youtube, color: "hover:bg-red-600/20 hover:border-red-600 hover:text-red-500" }
];

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

  return (
    <div className="bg-white/5 border border-[#F4F4F0]/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-editorial text-2xl">Connect Social Accounts</h2>
          <p className="text-sm opacity-60 mt-1">Link your profiles to sync analytics and showcase your reach securely.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLATFORMS.map(p => {
          const isConnected = connectedPlatforms.includes(p.id);
          const Icon = p.icon;
          
          return (
            <button
              key={p.id}
              onClick={() => !isConnected && connectAccount(p.id)}
              disabled={isConnected || loading === p.id}
              className={`flex items-center gap-3 p-4 border transition-all text-left group
                ${isConnected 
                  ? "border-[#34C759]/30 bg-[#34C759]/5 cursor-default" 
                  : `border-white/10 bg-white/[0.02] cursor-pointer ${p.color}`
                }
              `}
            >
              <div className={`p-2 rounded-full bg-white/5 ${isConnected ? "text-[#34C759]" : "group-hover:text-current"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-mono text-[10px] tracking-widest uppercase mb-1 opacity-70">
                  {p.name}
                </div>
                <div className="text-sm font-bold">
                  {loading === p.id ? "Connecting..." : isConnected ? "Connected" : "Connect"}
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
