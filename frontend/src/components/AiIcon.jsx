/**
 * Shared AI-generated icon assets (public/icons).
 * Use <AiIcon name="dashboard" /> anywhere in the app.
 */
const ICON_FILES = {
  dashboard: "nav-dashboard.png",
  feed: "nav-feed.png",
  directory: "nav-directory.png",
  leaderboard: "nav-leaderboard.png",
  referrals: "nav-referrals.png",
  users: "nav-referrals.png",
  staff: "nav-referrals.png",
  invitations: "nav-invitations.png",
  wallet: "nav-wallet.png",
  profile: "nav-profile.png",
  settings: "nav-settings.png",
  tickets: "nav-tickets.png",
  knowledge: "nav-knowledge.png",
  ai: "nav-ai.png",
  analytics: "nav-analytics.png",
  audit: "nav-audit.png",
  search: "action-search.png",
  logout: "action-logout.png",
  bell: "action-bell.png",
  notifications: "action-bell.png",
  support: "action-support.png",
  sparkles: "action-sparkles.png",
  create: "action-create.png",
  refresh: "action-refresh.png",
  "view-public": "view-public.png",
  edit: "edit-profile.png",
};

export function aiIconSrc(name) {
  const file = ICON_FILES[name] || ICON_FILES.sparkles;
  const base = process.env.PUBLIC_URL || "";
  return `${base}/icons/${file}`;
}

export function AiIcon({
  name,
  alt = "",
  className = "w-4 h-4",
  rounded = false,
  ...rest
}) {
  return (
    <img
      src={aiIconSrc(name)}
      alt={alt}
      draggable={false}
      className={`${rounded ? "rounded-full object-cover" : "object-contain"} ${className}`}
      {...rest}
    />
  );
}

export default AiIcon;
