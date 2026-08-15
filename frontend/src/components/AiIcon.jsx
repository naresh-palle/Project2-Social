/**
 * Shared AI-generated icon glyphs (transparent PNGs in public/icons).
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

const TONES = {
  white: "",
  muted: "opacity-70",
  brand: "opacity-100",
  soft: "opacity-90",
};

export function aiIconSrc(name) {
  const file = ICON_FILES[name] || ICON_FILES.sparkles;
  const base = process.env.PUBLIC_URL || "";
  return `${base}/icons/${file}?v=3`;
}

export function AiIcon({
  name,
  alt = "",
  className = "w-4 h-4",
  tone = "white",
  title,
  ...rest
}) {
  const toneClass = TONES[tone] || "";
  return (
    <img
      src={aiIconSrc(name)}
      alt={alt}
      title={title}
      draggable={false}
      className={`ai-icon inline-block shrink-0 object-contain ${toneClass} ${className}`}
      {...rest}
    />
  );
}

export default AiIcon;
