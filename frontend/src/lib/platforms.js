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

function asConnectionList(rawConnections) {
  if (Array.isArray(rawConnections)) return rawConnections;
  if (rawConnections && typeof rawConnections === "object") {
    return Object.entries(rawConnections).map(([platform, row]) => ({ platform, ...(row || {}) }));
  }
  return [];
}

function normalizePlatformId(platform) {
  const p = String(platform || "").trim().toLowerCase();
  if (p === "x" || p === "x (twitter)" || p === "twitter/x") return "twitter";
  if (p === "yt" || p === "you tube") return "youtube";
  if (p === "fb" || p === "meta") return "facebook";
  if (p === "ig" || p === "insta") return "instagram";
  return p;
}

/**
 * Platforms that already have an active handle (profile metrics) or OAuth link.
 * Used so Connect Social Accounts never re-offers an active platform.
 */
export function connectedSocialPlatforms(user) {
  if (!user || typeof user !== "object") return [];
  const out = new Set();

  const metrics = user.platform_metrics && typeof user.platform_metrics === "object"
    ? user.platform_metrics
    : {};
  for (const [plat, row] of Object.entries(metrics)) {
    const id = normalizePlatformId(plat);
    if (id && hasPlatformHandle(row)) out.add(id);
  }

  for (const c of asConnectionList(user.oauth_connections)) {
    const id = normalizePlatformId(c.platform);
    if (!id) continue;
    const oauthHandle = String(
      c.account_name || c.platform_username || c.handle || c.username || ""
    ).trim();
    if (oauthHandle || c.connected === true || c.status === "connected") out.add(id);
  }

  return SOCIAL_PLATFORMS.filter((p) => out.has(p));
}

/**
 * Merge profile `platform_metrics` (scraped numbers + handles) with `oauth_connections`
 * (avatar only). Profile handles/numbers win whenever a metrics handle exists so
 * Dashboard matches Profile Social metrics.
 */
export function analyticsConnections(user) {
  if (!user || typeof user !== "object") return [];

  const metrics = user.platform_metrics && typeof user.platform_metrics === "object"
    ? user.platform_metrics
    : {};
  const connections = asConnectionList(user.oauth_connections);
  const oauthByPlat = {};
  for (const c of connections) {
    const plat = normalizePlatformId(c.platform);
    if (plat) oauthByPlat[plat] = c;
  }

  const plats = [
    ...SOCIAL_PLATFORMS,
    ...Object.keys(metrics).map(normalizePlatformId).filter((p) => p && !SOCIAL_PLATFORMS.includes(p)),
    ...Object.keys(oauthByPlat).filter((p) => !SOCIAL_PLATFORMS.includes(p) && !(p in metrics)),
  ];

  const seen = new Set();
  const out = [];
  for (const plat of plats) {
    if (!plat || seen.has(plat)) continue;
    seen.add(plat);

    const row = metrics[plat] && typeof metrics[plat] === "object" ? metrics[plat] : {};
    const oauth = oauthByPlat[plat] || {};
    const metricsHandle = String(row.handle || row.username || "").trim();
    const oauthHandle = String(
      oauth.platform_username ||
      oauth.handle ||
      oauth.username ||
      oauth.account_name ||
      ""
    ).trim();
    const handle = metricsHandle || oauthHandle;
    if (!handle) continue;

    const metricFollowers = Number(row.followers ?? row.subscribers) || 0;
    const oauthFollowers = Number(oauth.analytics?.followers ?? oauth.followers) || 0;
    const metricEr = Number(row.engagement ?? row.er);
    const oauthEr = Number(oauth.analytics?.er ?? oauth.analytics?.engagement) || 0;
    const metricViews = Number(row.views) || 0;
    const oauthViews = Number(oauth.analytics?.views) || 0;
    const metricPosts = Number(row.posts) || 0;
    const oauthPosts = Number(oauth.analytics?.posts) || 0;

    // Profile metrics identity wins — do not blend a different OAuth account's stats/name.
    const useMetrics = Boolean(metricsHandle);
    const followers = useMetrics ? metricFollowers : oauthFollowers;
    const er = useMetrics
      ? (Number.isFinite(metricEr) ? metricEr : 0)
      : oauthEr;
    const views = useMetrics ? metricViews : oauthViews;
    const posts = useMetrics ? metricPosts : oauthPosts;

    out.push({
      platform: plat,
      handle,
      // Same ID the Profile "Social metrics" panel shows
      account_name: handle,
      profile_picture: oauth.profile_picture || null,
      last_sync_time: row.last_synced || oauth.last_sync_time || user.analytics_last_synced || null,
      followers,
      er,
      engagement: er,
      views,
      posts,
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
