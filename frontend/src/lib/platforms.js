/** Canonical social platform order across Edit Profile, Profile, Creator Detail, etc. */
export const SOCIAL_PLATFORMS = ["facebook", "instagram", "twitter", "youtube"];

export const SOCIAL_PLATFORM_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter",
  youtube: "YouTube",
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
