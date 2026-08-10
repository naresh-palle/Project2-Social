import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";

/** Canonical social platform order across Edit Profile, Profile, Influencer Detail, etc. */
export const SOCIAL_PLATFORMS = ["facebook", "instagram", "twitter", "youtube"];

export const SOCIAL_PLATFORM_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  youtube: "YouTube",
};

export const SOCIAL_PLATFORM_ICONS = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

export const SOCIAL_PLATFORM_COLORS = {
  instagram: "text-pink-500",
  facebook: "text-blue-500",
  twitter: "text-sky-400",
  youtube: "text-red-500",
};

export const SOCIAL_PLATFORM_HOVER_COLORS = {
  instagram: "hover:bg-pink-600/20 hover:border-pink-600 hover:text-pink-500",
  facebook: "hover:bg-blue-600/20 hover:border-blue-600 hover:text-blue-500",
  twitter: "hover:bg-sky-500/20 hover:border-sky-500 hover:text-sky-400",
  youtube: "hover:bg-red-600/20 hover:border-red-600 hover:text-red-500",
};

export function emptyPlatformMetrics() {
  return Object.fromEntries(
    SOCIAL_PLATFORMS.map((plat) => [plat, { handle: "", followers: 0, engagement: 0, views: 0, posts: 0 }])
  );
}

/** True when a platform has a usable handle/ID. */
export function hasPlatformHandle(data) {
  return !!(data && String(data.handle || "").trim());
}

/** Display helper: missing values show as N/A. */
export function socialOrNA(value, { format } = {}) {
  if (value == null || value === "") return "N/A";
  const s = String(value).trim();
  if (!s || s === "—" || s.toLowerCase() === "n/a") return "N/A";
  if (format) return format(value);
  return s;
}

export function socialMetricOrNA(value, formatFn) {
  if (value == null || value === "") return "N/A";
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return formatFn ? formatFn(n) : String(n);
}

/**
 * Pick the social account with the highest follower count from platform_metrics
 * (falls back to oauth_connections analytics). Returns display handle + count + platform.
 */
export function getTopSocialAccount(user) {
  if (!user || typeof user !== "object") {
    return { handle: null, followers: 0, platform: null, label: null };
  }

  let best = { handle: null, followers: -1, platform: null };

  const metrics = user.platform_metrics || {};
  const metricPlatforms = [
    ...SOCIAL_PLATFORMS,
    ...Object.keys(metrics).filter((p) => !SOCIAL_PLATFORMS.includes(p)),
  ];
  for (const plat of metricPlatforms) {
    const row = metrics[plat];
    if (!row || typeof row !== "object") continue;
    const handle = String(row.handle || row.username || "").trim();
    if (!handle) continue;
    const followers = Number(row.followers ?? row.subscribers ?? 0) || 0;
    if (followers > best.followers) {
      best = { handle, followers, platform: plat };
    }
  }

  const rawConnections = user.oauth_connections;
  const connections = Array.isArray(rawConnections)
    ? rawConnections
    : rawConnections && typeof rawConnections === "object"
      ? Object.entries(rawConnections).map(([platform, row]) => ({ platform, ...(row || {}) }))
      : [];
  for (const c of connections) {
    const plat = String(c.platform || "").toLowerCase();
    const handle = String(
      c.account_name || c.platform_username || c.handle || c.username || ""
    ).trim();
    if (!handle) continue;
    const followers = Number(c.analytics?.followers ?? c.followers ?? 0) || 0;
    if (followers > best.followers) {
      best = { handle, followers, platform: plat || best.platform };
    }
  }

  if (best.followers < 0) {
    // No platform handle with metrics — fall back to profile handle/username with top-level followers
    const fallback = String(user.handle || user.username || "").trim();
    return {
      handle: fallback || null,
      followers: Number(user.followers) || 0,
      platform: null,
      label: null,
    };
  }

  let handle = best.handle;
  if (handle && !handle.startsWith("@") && best.platform !== "youtube" && best.platform !== "facebook") {
    handle = `@${handle.replace(/^@/, "")}`;
  }

  return {
    handle,
    followers: best.followers,
    platform: best.platform,
    label: SOCIAL_PLATFORM_LABELS[best.platform] || best.platform,
  };
}
