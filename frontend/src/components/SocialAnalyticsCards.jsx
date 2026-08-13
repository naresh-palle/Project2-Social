import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ICONS,
  SOCIAL_PLATFORM_COLORS
} from "@/lib/platforms";

export function SocialAnalyticsCards({ connections = [], onSync, isSyncing }) {
  if (!connections || connections.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-editorial text-xl">Platform Analytics</h3>
          <p className="text-xs opacity-60 font-mono tracking-widest uppercase mt-1">Connected Accounts</p>
        </div>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors text-xs font-mono uppercase tracking-widest disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync Data"}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connections.map(c => {
          const Icon = SOCIAL_PLATFORM_ICONS[c.platform] || SOCIAL_PLATFORM_ICONS.instagram;
          const colorClass = SOCIAL_PLATFORM_COLORS[c.platform] || "text-white";
          const platformLabel = SOCIAL_PLATFORM_LABELS[c.platform] || c.platform;
          
          return (
            <div key={c.platform} className="bg-white/[0.02] border border-[#F4F4F0]/10 p-6 rounded-3xl hover:border-white/20 hover:bg-white/[0.04] transition-all shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                    {c.profile_picture ? (
                      <img src={c.profile_picture} alt={c.account_name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon className={`w-5 h-5 ${colorClass}`} />
                    )}
                  </div>
                  <div>
                    <div className="font-bold">{c.account_name || "Connected Account"}</div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase opacity-50 mt-0.5">
                      <Icon className={`w-3 h-3 ${colorClass}`} /> {platformLabel}
                    </div>
                  </div>
                </div>
                {c.last_sync_time && (
                  <div className="text-[10px] font-mono uppercase opacity-40 text-right">
                    Synced<br/>{formatDistanceToNow(new Date(c.last_sync_time))} ago
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                <div>
                  <div className="text-[10px] font-mono tracking-widest uppercase opacity-50 mb-1">Followers</div>
                  <div className="text-xl font-editorial">{c.analytics?.followers?.toLocaleString() || "0"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-widest uppercase opacity-50 mb-1">ER</div>
                  <div className="text-xl font-editorial text-[#34C759]">{c.analytics?.er || "0"}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-widest uppercase opacity-50 mb-1">Views</div>
                  <div className="text-xl font-editorial">{c.analytics?.views || "0"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono tracking-widest uppercase opacity-50 mb-1">Posts</div>
                  <div className="text-xl font-editorial">{c.analytics?.posts?.toLocaleString() || "0"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
