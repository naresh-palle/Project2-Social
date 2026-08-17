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

function oauthAnalyticsEmpty(analytics) {
  if (!analytics || typeof analytics !== "object") return true;
  const followers = Number(analytics.followers) || 0;
  const er = Number(analytics.er ?? analytics.engagement) || 0;
  const views = Number(analytics.views) || 0;
  const posts = Number(analytics.posts) || 0;
  return followers === 0 && er === 0 && views === 0 && posts === 0;
}

function asConnectionList(rawConnections) {
  if (Array.isArray(rawConnections)) return rawConnections;
  if (rawConnections && typeof rawConnections === "object") {
    return Object.entries(rawConnections).map(([platform, row]) => ({ platform, ...(row || {}) }));
  }
  return [];
}

/**
 * Merge profile `platform_metrics` (scraped numbers) with `oauth_connections`
 * (avatar / display name) for dashboard Platform Analytics cards.
 * Profile stores engagement; cards historically read analytics.er.
 */
export function analyticsConnections(user) {
  if (!user || typeof user !== "object") return [];

  const metrics = user.platform_metrics && typeof user.platform_metrics === "object"
    ? user.platform_metrics
    : {};
  const connections = asConnectionList(user.oauth_connections);
  const oauthByPlat = {};
  for (const c of connections) {
    const plat = String(c.platform || "").toLowerCase();
    if (plat) oauthByPlat[plat] = c;
  }

  const plats = [
    ...SOCIAL_PLATFORMS,
    ...Object.keys(metrics).filter((p) => !SOCIAL_PLATFORMS.includes(p)),
    ...Object.keys(oauthByPlat).filter((p) => !SOCIAL_PLATFORMS.includes(p) && !(p in metrics)),
  ];

  const out = [];
  for (const plat of plats) {
    const row = metrics[plat] && typeof metrics[plat] === "object" ? metrics[plat] : {};
    const oauth = oauthByPlat[plat] || {};
    const handle = String(
      row.handle ||
      row.username ||
      oauth.account_name ||
      oauth.platform_username ||
      oauth.handle ||
      oauth.username ||
      ""
    ).trim();
    if (!handle) continue;

    const metricFollowers = Number(row.followers ?? row.subscribers) || 0;
    const oauthFollowers = Number(oauth.analytics?.followers ?? oauth.followers) || 0;
    const metricEr = Number(row.engagement ?? row.er) || 0;
    const oauthEr = Number(oauth.analytics?.er ?? oauth.analytics?.engagement) || 0;
    const preferMetrics = metricFollowers > 0 || metricEr > 0 || oauthAnalyticsEmpty(oauth.analytics);

    const followers = preferMetrics ? (metricFollowers || oauthFollowers) : (oauthFollowers || metricFollowers);
    const er = preferMetrics ? (metricEr || oauthEr) : (oauthEr || metricEr);
    const views = Number(row.views) || Number(oauth.analytics?.views) || 0;
    const posts = Number(row.posts) || Number(oauth.analytics?.posts) || 0;

    out.push({
      platform: plat,
      handle,
      account_name: oauth.account_name || handle,
      profile_picture: oauth.profile_picture || null,
      last_sync_time: row.last_synced || oauth.last_sync_time || user.analytics_last_synced || null,
      analytics: {
        followers,
        er,
        engagement: er,
        views,
        posts,
      },
    });
  }
  return out;
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
  const connections = asConnectionList(rawConnections);
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
  // Normalize profile URLs → @username
  if (handle) {
    const raw = handle.replace(/^@+/, "").trim();
    try {
      if (/^https?:\/\//i.test(raw) || raw.includes("instagram.com") || raw.includes("twitter.com") || raw.includes("x.com") || raw.includes("facebook.com") || raw.includes("youtube.com") || raw.includes("youtu.be")) {
        const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        const parts = url.pathname.split("/").filter(Boolean);
        // youtube.com/@handle or /channel/... or /c/...
        let slug = parts.find((p) => p.startsWith("@")) || parts[parts.length - 1] || "";
        slug = slug.replace(/^@+/, "").split("?")[0];
        if (slug && !["channel", "c", "user", "watch", "shorts", "reel", "p"].includes(slug.toLowerCase())) {
          handle = slug;
        }
      } else {
        handle = raw;
      }
    } catch {
      handle = raw.split("/").filter(Boolean).pop() || raw;
    }
    handle = String(handle).replace(/^@+/, "").trim();
    if (handle && best.platform !== "youtube" && best.platform !== "facebook") {
      handle = `@${handle}`;
    }
  }

  return {
    handle,
    followers: best.followers,
    platform: best.platform,
    label: SOCIAL_PLATFORM_LABELS[best.platform] || best.platform,
  };
}
