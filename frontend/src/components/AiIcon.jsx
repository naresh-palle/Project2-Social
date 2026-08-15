/**
 * Shared AI-generated icon assets (public/icons).
 * Rendered via CSS mask so glyphs are always solid, high-contrast colors
 * (black plate is masked out; fill color is controllable).
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
  white: "#F4F4F0",
  muted: "rgba(244, 244, 240, 0.72)",
  brand: "#FF3B30",
  soft: "rgba(244, 244, 240, 0.9)",
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
  /** Fill color: white | muted | brand | soft | any CSS color */
  tone = "white",
  title,
  ...rest
}) {
  const src = aiIconSrc(name);
  const color = TONES[tone] || tone || TONES.white;

  return (
    <span
      role={alt ? "img" : "presentation"}
      aria-label={alt || undefined}
      title={title}
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      {...rest}
    />
  );
}

export default AiIcon;
