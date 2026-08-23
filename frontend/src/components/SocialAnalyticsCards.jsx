import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ICONS,
  SOCIAL_PLATFORM_COLORS
} from "@/lib/platforms";
import { displayMetric, formatEngagementRate, formatExactNumber, formatCompactNumber } from "@/lib/socialAnalytics";

export function SocialAnalyticsCards({ connections = [], onSync, isSyncing }) {
  if (!connections || connections.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="font-sans text-sm font-semibold tracking-tight">Social presence by platform</h3>
          <p className="text-[10px] text-white/40 uppercase tracking-wider hidden sm:block">Strength per connected account</p>
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
          const followers = c.followers ?? analytics.followers;
          const er = c.er ?? c.engagement ?? analytics.er ?? analytics.engagement;
          let views = c.views ?? analytics.views;
          if ((c.platform === "instagram" || c.platform === "facebook" || c.platform === "twitter") && Number(views) === 0) {
            views = null;
          }
          const reach = c.reach ?? analytics.reach ?? null;
          
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
                    <div className="font-sans text-sm font-bold tracking-tight truncate text-white">
                      {c.handle || c.account_name ? (
                        <span className="text-[#FF3B30]">@{String(c.handle || c.account_name).replace(/^@/, "")}</span>
                      ) : (
                        <span className="text-white/50">Not connected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45 mt-0.5">
                      <Icon className={`w-3 h-3 ${colorClass}`} /> {platformLabel}
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider ${
                          c.verified || c.is_verified
                            ? "bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/35"
                            : "bg-white/5 text-white/50 border border-white/10"
                        }`}
                      >
                        {c.verified || c.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </div>
                </div>
                {c.last_sync_time && (
                  <div className="text-[9px] uppercase text-white/35 text-right shrink-0 pl-2">
                    {formatDistanceToNow(new Date(c.last_sync_time))} ago
                  </div>
                )}
              </div>
              
              <div className="metric-grid-5 pt-2 border-t border-white/5">
                <div className="min-w-0" title={formatExactNumber(followers) || undefined}>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Followers</div>
                  <div className="text-sm font-semibold tabular-nums truncate">{displayMetric(followers, { format: formatCompactNumber })}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">ER</div>
                  <div className="text-sm font-semibold tabular-nums text-[#34C759] truncate">{formatEngagementRate(er)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Status</div>
                  <div className={`text-sm font-semibold truncate ${c.verified || c.is_verified ? "text-[#34C759]" : "text-white/55"}`}>
                    {c.verified || c.is_verified ? "Verified" : "Unverified"}
                  </div>
                </div>
                <div className="min-w-0" title={formatExactNumber(views) || undefined}>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Views</div>
                  <div className="text-sm font-semibold tabular-nums truncate">{displayMetric(views, { format: formatCompactNumber, allowZero: c.platform === "youtube" })}</div>
                </div>
                <div className="min-w-0" title={formatExactNumber(reach) || undefined}>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-0.5">Reach</div>
                  <div className="text-sm font-semibold tabular-nums truncate">{displayMetric(reach, { format: formatCompactNumber, allowZero: false })}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
