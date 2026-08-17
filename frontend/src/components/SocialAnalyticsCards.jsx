import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ICONS,
  SOCIAL_PLATFORM_COLORS
} from "@/lib/platforms";

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCount(value) {
  return asNumber(value).toLocaleString();
}

export function SocialAnalyticsCards({ connections = [], onSync, isSyncing }) {
  if (!connections || connections.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="font-sans text-sm font-semibold tracking-tight">Platform Analytics</h3>
          <p className="text-[10px] text-white/40 uppercase tracking-wider hidden sm:block">Connected accounts</p>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors text-[10px] font-sans uppercase tracking-wider disabled:opacity-50 rounded-full"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Sync"}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {connections.map(c => {
          const Icon = SOCIAL_PLATFORM_ICONS[c.platform] || SOCIAL_PLATFORM_ICONS.instagram;
          const colorClass = SOCIAL_PLATFORM_COLORS[c.platform] || "text-white";
          const platformLabel = SOCIAL_PLATFORM_LABELS[c.platform] || c.platform;
          const analytics = c.analytics && typeof c.analytics === "object" ? c.analytics : {};
          const followers = asNumber(c.followers ?? analytics.followers);
          const er = asNumber(c.er ?? c.engagement ?? analytics.er ?? analytics.engagement);
          const views = asNumber(c.views ?? analytics.views);
          const posts = asNumber(c.posts ?? analytics.posts);
          
          return (
            <div key={c.platform} className="bg-white/[0.02] border border-white/10 px-3 py-2.5 rounded-2xl hover:border-white/20 hover:bg-white/[0.04] transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                    {c.profile_picture ? (
                      <img src={c.profile_picture} alt={c.account_name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-sans text-xs font-semibold truncate">{c.account_name || c.handle || "Connected"}</div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/45">
                      <Icon className={`w-3 h-3 ${colorClass}`} /> {platformLabel}
                    </div>
                  </div>
                </div>
                {c.last_sync_time && (
                  <div className="text-[9px] uppercase text-white/35 text-right shrink-0 pl-2">
                    {formatDistanceToNow(new Date(c.last_sync_time))} ago
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Followers</div>
                  <div className="text-sm font-semibold tabular-nums">{formatCount(followers)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">ER</div>
                  <div className="text-sm font-semibold tabular-nums text-[#34C759]">{er}%</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Views</div>
                  <div className="text-sm font-semibold tabular-nums">{formatCount(views)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Posts</div>
                  <div className="text-sm font-semibold tabular-nums">{formatCount(posts)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
