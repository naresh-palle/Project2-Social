/** Shared formatting / display for Apify-derived social analytics. */

export function formatCompactNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const trim = (x) => String(x).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  if (abs >= 1_000_000_000) return `${trim((n / 1_000_000_000).toFixed(2))}B`;
  if (abs >= 1_000_000) return `${trim((n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2))}M`;
  if (abs >= 1_000) {
    const k = n / 1_000;
    if (abs >= 100_000) return `${Math.round(k)}K`;
    if (abs >= 10_000) return `${trim(k.toFixed(1))}K`;
    return `${trim(k.toFixed(2))}K`;
  }
  return String(Math.round(n));
}

export function formatExactNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString();
}

/** Missing metrics → N/A. Real zero is allowed when `allowZero` is true. */
export function displayMetric(value, { format = formatCompactNumber, allowZero = true } = {}) {
  if (value == null || value === "") return "N/A";
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  if (!allowZero && n === 0) return "N/A";
  return format ? format(n) : String(n);
}

export function formatEngagementRate(value) {
  if (value == null || value === "") return "N/A";
  const n = Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return `${n.toFixed(2)}%`;
}

export function engagementRateHint(basis) {
  if (!basis) return null;
  if (basis === "followers") return "Based on followers";
  if (basis === "views") return "Based on views";
  if (basis === "platform_reported") return "Platform-reported";
  if (basis === "mixed") return "Mixed denominators";
  return String(basis);
}

/**
 * Build overview KPIs from user.platform_metrics and optional /analytics/creator social payload.
 * Prefer API `social` object when present (server-normalized).
 */
export function creatorOverviewFromSources({ user, stats } = {}) {
  const social = stats?.social && typeof stats.social === "object" ? stats.social : null;
  if (social) {
    return {
      followers: social.followers ?? null,
      contentCount: social.contentCount ?? null,
      views: social.views ?? null,
      reach: social.reach ?? null,
      engagement: social.engagement ?? null,
      engagementRate: social.engagementRate ?? null,
      engagementRateBasis: social.engagementRateBasis ?? null,
      likes: social.likes ?? null,
      comments: social.comments ?? null,
      shares: social.shares ?? null,
      saves: social.saves ?? null,
      platforms: social.platforms || {},
      growth: social.growth || {},
      methodology: social.methodology || {},
    };
  }

  const pm = user?.platform_metrics && typeof user.platform_metrics === "object" ? user.platform_metrics : {};
  const connected = Object.entries(pm).filter(([, row]) => row && String(row.handle || "").trim());
  let followers = 0;
  let viewsSum = 0;
  let viewsAny = false;
  let posts = 0;
  let likes = 0;
  let likesAny = false;
  let comments = 0;
  let commentsAny = false;
  let shares = 0;
  let sharesAny = false;
  let saves = 0;
  let savesAny = false;
  let reach = null;
  const erVals = [];

  for (const [plat, row] of connected) {
    followers += Number(row.followers || row.subscribers) || 0;
    posts += Number(row.posts) || 0;
    const v = row.views;
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
      viewsSum += Number(v);
      viewsAny = true;
    } else if (v != null && Number.isFinite(Number(v)) && plat === "youtube") {
      viewsSum += Number(v);
      viewsAny = true;
    }
    if (row.reach != null && Number.isFinite(Number(row.reach))) {
      reach = (reach || 0) + Number(row.reach);
    }
    for (const [field, add] of [
      ["likes", (n) => { likes += n; likesAny = true; }],
      ["comments", (n) => { comments += n; commentsAny = true; }],
      ["shares", (n) => { shares += n; sharesAny = true; }],
      ["saves", (n) => { saves += n; savesAny = true; }],
    ]) {
      if (row[field] != null && Number.isFinite(Number(row[field]))) add(Number(row[field]));
    }
    const er = Number(row.engagement ?? row.er);
    if (Number.isFinite(er) && er > 0) erVals.push(er);
  }

  const engagement =
    likesAny || commentsAny || sharesAny || savesAny
      ? (likesAny ? likes : 0) + (commentsAny ? comments : 0) + (sharesAny ? shares : 0) + (savesAny ? saves : 0)
      : null;

  return {
    followers: connected.length ? followers : (stats?.followers ?? null),
    contentCount: connected.length ? posts : (stats?.posts ?? null),
    views: viewsAny ? viewsSum : (stats?.views ?? stats?.total_views ?? null),
    reach,
    engagement: engagement ?? stats?.total_engagement ?? null,
    engagementRate: erVals.length
      ? erVals.reduce((a, b) => a + b, 0) / erVals.length
      : (stats?.engagement_rate ?? stats?.avg_engagement ?? null),
    engagementRateBasis: stats?.engagement_rate_basis ?? null,
    likes: likesAny ? likes : null,
    comments: commentsAny ? comments : null,
    shares: sharesAny ? shares : null,
    saves: savesAny ? saves : null,
    platforms: {},
    growth: {},
    methodology: {},
  };
}
