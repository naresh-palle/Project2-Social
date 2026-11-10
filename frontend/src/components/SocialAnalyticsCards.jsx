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
          <p className="text-[10px] text-[#475569] uppercase tracking-wider font-semibold hidden sm:block">Strength per connected account</p>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#1E1B4B]/08 hover:border-[#1E1B4B]/15 hover:bg-[#F7F8FC] transition-colors text-[10px] font-sans uppercase tracking-wider disabled:opacity-50 rounded-full"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {connections.map(c => {
          const Icon = SOCIAL_PLATFORM_ICONS[c.platform] || SOCIAL_PLATFORM_ICONS.instagram;
          const colorClass = SOCIAL_PLATFORM_COLORS[c.platform] || "text-[#1E1B4B]";
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
            <div key={c.platform} className="bg-[#F8FAFC] border border-[#1E1B4B]/08 px-3 py-2.5 rounded-2xl hover:border-[#1E1B4B]/12 hover:bg-[#F1F5F9] transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#F7F8FC] flex items-center justify-center overflow-hidden border border-[#1E1B4B]/08 shrink-0">
                    {c.profile_picture ? (
                      <img src={c.profile_picture} alt={c.account_name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-sans text-base sm:text-lg font-bold tracking-tight truncate text-[#1E1B4B]">
                      {c.handle || c.account_name ? (
                        <span className="text-[#FF2D55]">@{String(c.handle || c.account_name).replace(/^@/, "")}</span>
                      ) : (
                        <span className="text-[#64748B]">Not connected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#475569] mt-0.5">
                      <Icon className={`w-3 h-3 ${colorClass}`} /> {platformLabel}
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider ${
                          c.verified || c.is_verified
                            ? "bg-[#14B8A6]/15 text-[#0F766E] border border-[#14B8A6]/35"
                            : "bg-[#F7F8FC] text-[#475569] border border-[#1E1B4B]/08"
                        }`}
                      >
                        {c.verified || c.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </div>
                </div>
                {c.last_sync_time && (
                  <div className="text-[9px] uppercase text-[#475569] text-right shrink-0 pl-2">
                    {formatDistanceToNow(new Date(c.last_sync_time))} ago
                  </div>
                )}
              </div>

              <div className="metric-grid-5 pt-2 border-t border-[#1E1B4B]/06">
                <div className="min-w-0" title={formatExactNumber(followers) || undefined}>
                  <div className="text-[9px] uppercase tracking-wider text-[#475569] font-semibold mb-0.5">Followers</div>
                  <div className="text-sm font-bold tabular-nums truncate text-[#1E1B4B]">{displayMetric(followers, { format: formatCompactNumber })}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-[#475569] font-semibold mb-0.5">ER</div>
                  <div className="text-sm font-bold tabular-nums text-[#0F766E] truncate">{formatEngagementRate(er)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-[#475569] font-semibold mb-0.5">Status</div>
                  <div className={`text-sm font-bold truncate ${c.verified || c.is_verified ? "text-[#0F766E]" : "text-[#475569]"}`}>
                    {c.verified || c.is_verified ? "Verified" : "Unverified"}
                  </div>
                </div>
                <div className="min-w-0" title={formatExactNumber(views) || undefined}>
                  <div className="text-[9px] uppercase tracking-wider text-[#475569] font-semibold mb-0.5">Views</div>
                  <div className="text-sm font-bold tabular-nums truncate text-[#1E1B4B]">{displayMetric(views, { format: formatCompactNumber, allowZero: c.platform === "youtube" })}</div>
                </div>
                <div className="min-w-0" title={formatExactNumber(reach) || undefined}>
                  <div className="text-[9px] uppercase tracking-wider text-[#475569] font-semibold mb-0.5">Reach</div>
                  <div className="text-sm font-bold tabular-nums truncate text-[#1E1B4B]">{displayMetric(reach, { format: formatCompactNumber, allowZero: false })}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
