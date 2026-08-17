"""
Normalized social analytics on top of existing Apify-scraped platform_metrics.

Does not call Apify or change scrapers — only processes stored / scrape-result data.
Missing platform metrics stay null (UI: N/A). Reach is never equated to views.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple

SOCIAL_PLATFORMS = ("facebook", "instagram", "twitter", "youtube")

# Platforms where profile scrapers typically do not expose lifetime view totals.
PROFILE_VIEWS_UNRELIABLE_WHEN_ZERO = frozenset({"instagram", "facebook", "twitter"})


def parse_number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    if n < 0:
        return None
    return n


def parse_int(value: Any) -> Optional[int]:
    n = parse_number(value)
    if n is None:
        return None
    return int(n)


def _first_number(item: Dict[str, Any], keys: Sequence[str]) -> Optional[float]:
    for key in keys:
        if key in item and item.get(key) is not None:
            n = parse_number(item.get(key))
            if n is not None:
                return n
    return None


def _post_list(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    for key in ("latestPosts", "latest_posts", "posts", "recentPosts", "topPosts", "items"):
        raw = item.get(key)
        if isinstance(raw, list):
            return [p for p in raw if isinstance(p, dict)]
    return []


def _post_id(post: Dict[str, Any], platform: str) -> str:
    for key in ("id", "shortCode", "shortcode", "postId", "videoId", "url", "link"):
        val = post.get(key)
        if val:
            return f"{platform}:{val}"
    return f"{platform}:{hash(frozenset((k, str(v)) for k, v in list(post.items())[:6]))}"


def aggregate_posts(platform: str, posts: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Deduplicate posts and sum interaction / view metrics."""
    seen = set()
    likes = comments = shares = saves = views = 0
    likes_n = comments_n = shares_n = saves_n = views_n = 0
    for post in posts:
        pid = _post_id(post, platform)
        if pid in seen:
            continue
        seen.add(pid)
        like = _first_number(post, ("likesCount", "likes", "likeCount", "diggCount", "reactionsCount", "reactions"))
        comment = _first_number(post, ("commentsCount", "comments", "commentCount", "replyCount"))
        share = _first_number(post, ("sharesCount", "shares", "shareCount", "reposts", "retweetCount"))
        save = _first_number(post, ("savesCount", "saves", "saveCount", "bookmarksCount", "collectCount"))
        view = _first_number(
            post,
            ("videoViewCount", "videoPlayCount", "playCount", "viewCount", "viewsCount", "views", "videoViews"),
        )
        if like is not None:
            likes += int(like)
            likes_n += 1
        if comment is not None:
            comments += int(comment)
            comments_n += 1
        if share is not None:
            shares += int(share)
            shares_n += 1
        if save is not None:
            saves += int(save)
            saves_n += 1
        if view is not None:
            views += int(view)
            views_n += 1
    return {
        "contentCount": len(seen) or None,
        "likes": likes if likes_n else None,
        "comments": comments if comments_n else None,
        "shares": shares if shares_n else None,
        "saves": saves if saves_n else None,
        "videoViews": views if views_n else None,
        "views": views if views_n else None,
    }


def calculate_engagement(
    likes: Optional[int] = None,
    comments: Optional[int] = None,
    shares: Optional[int] = None,
    saves: Optional[int] = None,
) -> Optional[int]:
    parts = [v for v in (likes, comments, shares, saves) if v is not None]
    if not parts:
        return None
    return int(sum(parts))


def calculate_engagement_rate(
    engagement: Optional[float],
    *,
    followers: Optional[float] = None,
    views: Optional[float] = None,
    stored_rate: Optional[float] = None,
) -> Tuple[Optional[float], Optional[str]]:
    """
    Prefer interaction / followers, then interaction / views, then platform-reported rate.
    Returns (rate_percent, methodology).
    """
    if engagement is not None and followers and followers > 0:
        return round((engagement / followers) * 100, 2), "followers"
    if engagement is not None and views and views > 0:
        return round((engagement / views) * 100, 2), "views"
    if stored_rate is not None:
        rate = float(stored_rate)
        # Absolute interaction totals mistakenly stored as "engagement"
        if rate > 100 and followers and followers > 0:
            return round((rate / followers) * 100, 2), "followers"
        if 0 <= rate <= 100:
            return round(rate, 2), "platform_reported"
    return None, None


def _profile_reach(item: Dict[str, Any]) -> Optional[int]:
    """Only real reach/unique impressions — never views."""
    n = _first_number(
        item,
        (
            "reach",
            "pageReach",
            "accountsReached",
            "uniqueImpressions",
            "uniqueReach",
            "followersReached",
        ),
    )
    return int(n) if n is not None else None


def _profile_impressions(item: Dict[str, Any]) -> Optional[int]:
    n = _first_number(item, ("impressions", "pageImpressions", "impressionCount"))
    return int(n) if n is not None else None


def enrich_from_raw_profile(platform: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a raw Apify profile item into normalized metric fields.
    Safe to call on already-normalized rows (uses raw when present).
    """
    item = item or {}
    raw = item.get("raw") if isinstance(item.get("raw"), dict) else item
    plat = (platform or item.get("platform") or "").lower()

    posts_agg = aggregate_posts(plat, _post_list(raw))

    if plat == "facebook":
        followers = parse_int(
            item.get("followers")
            or _first_number(raw, ("followersCount", "followers", "fanCount", "likes"))
        )
    elif plat == "youtube":
        followers = parse_int(
            item.get("followers")
            or item.get("subscribers")
            or _first_number(raw, ("numberOfSubscribers", "subscribersCount", "followersCount", "followers"))
        )
    else:
        followers = parse_int(
            item.get("followers")
            or item.get("subscribers")
            or _first_number(raw, ("followersCount", "followers", "subscribersCount"))
        )
    content_count = parse_int(
        item.get("posts")
        or item.get("contentCount")
        or _first_number(raw, ("postsCount", "posts", "numberOfVideos", "videosCount"))
    )
    if content_count is None and posts_agg.get("contentCount"):
        content_count = posts_agg["contentCount"]

    likes = parse_int(item.get("likes")) if item.get("likes") is not None else posts_agg.get("likes")
    comments = parse_int(item.get("comments")) if item.get("comments") is not None else posts_agg.get("comments")
    shares = parse_int(item.get("shares")) if item.get("shares") is not None else posts_agg.get("shares")
    saves = parse_int(item.get("saves")) if item.get("saves") is not None else posts_agg.get("saves")

    # Lifetime / channel views — YouTube totalViews; IG/FB only when post video views exist
    views = None
    if plat == "youtube":
        views = parse_int(
            item.get("views")
            or _first_number(raw, ("totalViews", "viewsCount", "views"))
        )
    else:
        if item.get("views") is not None and parse_int(item.get("views")) is not None:
            # Treat legacy hardcoded 0 on IG/FB as unavailable
            v = parse_int(item.get("views"))
            if v and v > 0:
                views = v
            elif plat not in PROFILE_VIEWS_UNRELIABLE_WHEN_ZERO:
                views = v
        if views is None and posts_agg.get("videoViews") is not None:
            views = posts_agg["videoViews"]

    video_views = parse_int(item.get("videoViews")) if item.get("videoViews") is not None else posts_agg.get("videoViews")
    if video_views is None and plat == "youtube":
        video_views = views

    reach = parse_int(item.get("reach")) if item.get("reach") is not None else _profile_reach(raw)
    impressions = (
        parse_int(item.get("impressions")) if item.get("impressions") is not None else _profile_impressions(raw)
    )

    stored_rate = _first_number(
        item if "engagement" in item or "engagementRate" in item else raw,
        ("engagementRate", "engagement_rate", "er"),
    )
    if stored_rate is None:
        # Existing sync stores rate in `engagement` for IG when actor provides it
        eng_field = parse_number(item.get("engagement"))
        if eng_field is not None and eng_field <= 100:
            stored_rate = eng_field
        else:
            stored_rate = _first_number(raw, ("engagement",))

    engagement = calculate_engagement(likes, comments, shares, saves)
    # If Facebook page "likes" was mistaken for engagement absolute, ignore huge values without post breakdown
    if engagement is None and likes is None:
        abs_eng = parse_number(item.get("engagement_absolute") or raw.get("engagementAbsolute"))
        if abs_eng is not None:
            engagement = int(abs_eng)

    er, er_basis = calculate_engagement_rate(
        float(engagement) if engagement is not None else None,
        followers=float(followers) if followers else None,
        views=float(views) if views else None,
        stored_rate=stored_rate,
    )

    handle = (
        item.get("handle")
        or raw.get("username")
        or raw.get("channelName")
        or raw.get("pageName")
        or raw.get("handle")
        or ""
    )
    if isinstance(handle, str):
        handle = handle.lstrip("@").strip()

    return {
        "platform": plat or None,
        "handle": handle or None,
        "followers": followers,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "saves": saves,
        "views": views,
        "videoViews": video_views,
        "reach": reach,
        "impressions": impressions,
        "engagement": engagement,
        "engagementRate": er,
        "engagementRateBasis": er_basis,
        "contentCount": content_count,
        "estimatedReach": None,  # never invent; keep separate from actual reach
        "last_synced": item.get("last_synced"),
    }


def normalize_platform_metrics(platform_metrics: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    pm = platform_metrics if isinstance(platform_metrics, dict) else {}
    out: Dict[str, Dict[str, Any]] = {}
    for plat in SOCIAL_PLATFORMS:
        row = pm.get(plat)
        if not isinstance(row, dict):
            continue
        handle = str(row.get("handle") or "").strip()
        if not handle:
            continue
        out[plat] = enrich_from_raw_profile(plat, row)
    return out


def _sum_optional(values: Sequence[Optional[int]]) -> Optional[int]:
    present = [v for v in values if v is not None]
    if not present:
        return None
    return int(sum(present))


def _avg_optional(values: Sequence[Optional[float]]) -> Optional[float]:
    present = [v for v in values if v is not None]
    if not present:
        return None
    return round(sum(present) / len(present), 2)


def aggregate_creator_analytics(
    platform_metrics: Optional[Dict[str, Any]],
    *,
    monthly_analytics: Optional[List[Dict[str, Any]]] = None,
    snapshots: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    platforms = normalize_platform_metrics(platform_metrics)
    rows = list(platforms.values())

    followers = _sum_optional([r.get("followers") for r in rows])
    views = _sum_optional([r.get("views") for r in rows])
    reach = _sum_optional([r.get("reach") for r in rows])
    likes = _sum_optional([r.get("likes") for r in rows])
    comments = _sum_optional([r.get("comments") for r in rows])
    shares = _sum_optional([r.get("shares") for r in rows])
    saves = _sum_optional([r.get("saves") for r in rows])
    content_count = _sum_optional([r.get("contentCount") for r in rows])
    video_views = _sum_optional([r.get("videoViews") for r in rows])
    engagement = calculate_engagement(likes, comments, shares, saves)

    # Weighted ER by followers when rates exist; else average of platform rates
    weighted_num = 0.0
    weighted_den = 0.0
    rates = []
    bases = set()
    for r in rows:
        er = r.get("engagementRate")
        fol = r.get("followers") or 0
        if er is None:
            continue
        rates.append(er)
        if r.get("engagementRateBasis"):
            bases.add(r["engagementRateBasis"])
        if fol:
            weighted_num += er * fol
            weighted_den += fol
    if weighted_den > 0:
        engagement_rate = round(weighted_num / weighted_den, 2)
        er_basis = "followers" if "followers" in bases or len(bases) != 1 else next(iter(bases))
    else:
        engagement_rate = _avg_optional(rates)
        er_basis = next(iter(bases)) if len(bases) == 1 else ("mixed" if bases else None)

    if engagement is not None and followers and followers > 0 and engagement_rate is None:
        engagement_rate, er_basis = calculate_engagement_rate(float(engagement), followers=float(followers))

    growth = compute_growth(monthly_analytics=monthly_analytics, snapshots=snapshots)

    return {
        "followers": followers,
        "contentCount": content_count,
        "views": views,
        "reach": reach,
        "estimatedReach": None,
        "engagement": engagement,
        "engagementRate": engagement_rate,
        "engagementRateBasis": er_basis,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "saves": saves,
        "videoViews": video_views,
        "platformsConnected": len(rows),
        "platforms": platforms,
        "growth": growth,
        "methodology": {
            "engagement": "likes + comments + shares + saves (available metrics only)",
            "engagementRate": er_basis,
            "views": "sum of platform-provided view/play counts only",
            "reach": "platform-provided reach only; never equal to views",
        },
    }


def compute_growth(
    *,
    monthly_analytics: Optional[List[Dict[str, Any]]] = None,
    snapshots: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Optional[float]]:
    """Percent growth vs previous comparable period when enough history exists."""
    out = {
        "viewsGrowthPct": None,
        "reachGrowthPct": None,
        "engagementGrowthPct": None,
        "followerGrowthPct": None,
    }

    def pct(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
        if cur is None or prev is None or prev == 0:
            return None
        return round(((cur - prev) / prev) * 100, 2)

    months = [m for m in (monthly_analytics or []) if isinstance(m, dict)]
    if len(months) >= 2:
        a, b = months[-1], months[-2]
        out["viewsGrowthPct"] = pct(parse_number(a.get("views")), parse_number(b.get("views")))
        out["reachGrowthPct"] = pct(parse_number(a.get("reach")), parse_number(b.get("reach")))
        out["engagementGrowthPct"] = pct(
            parse_number(a.get("engagement") or a.get("engagementRate")),
            parse_number(b.get("engagement") or b.get("engagementRate")),
        )
        out["followerGrowthPct"] = pct(parse_number(a.get("followers")), parse_number(b.get("followers")))
        return out

    snaps = [s for s in (snapshots or []) if isinstance(s, dict)]
    if len(snaps) >= 2:
        # snaps usually newest-first
        ordered = sorted(
            snaps,
            key=lambda s: str(s.get("captured_at") or ""),
        )
        a, b = ordered[-1], ordered[-2]
        out["viewsGrowthPct"] = pct(parse_number(a.get("views")), parse_number(b.get("views")))
        out["reachGrowthPct"] = pct(parse_number(a.get("reach")), parse_number(b.get("reach")))
        out["engagementGrowthPct"] = pct(parse_number(a.get("engagement")), parse_number(b.get("engagement")))
        out["followerGrowthPct"] = pct(parse_number(a.get("followers")), parse_number(b.get("followers")))
    return out


def filter_by_date_range(
    items: Sequence[Dict[str, Any]],
    *,
    date_field: str = "captured_at",
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    if not start and not end:
        return list(items)
    out = []
    for item in items:
        raw = item.get(date_field) or item.get("published_at") or item.get("created_at")
        if not raw:
            continue
        try:
            ts = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if start and ts < start:
            continue
        if end and ts > end:
            continue
        out.append(item)
    return out


def parse_range_preset(preset: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Return (start, end) UTC for common presets."""
    if not preset or preset in ("all", "custom"):
        return None, None
    now = datetime.now(timezone.utc)
    end = now
    key = preset.lower().replace(" ", "_")
    days = {
        "today": 1,
        "last_7_days": 7,
        "last_7": 7,
        "7d": 7,
        "last_30_days": 30,
        "last_30": 30,
        "30d": 30,
        "last_90_days": 90,
        "last_90": 90,
        "90d": 90,
    }.get(key)
    if key == "this_year":
        start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        return start, end
    if days:
        from datetime import timedelta

        start = now - timedelta(days=days)
        return start, end
    return None, None


def append_monthly_snapshot(
    monthly: Optional[List[Dict[str, Any]]],
    overview: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Replace current month point or append — never double-count prior months."""
    data = [m for m in (monthly or []) if isinstance(m, dict)]
    now = datetime.now(timezone.utc)
    label = now.strftime("%b")
    year = now.year
    point = {
        "month": label,
        "year": year,
        "followers": overview.get("followers"),
        "views": overview.get("views"),
        "reach": overview.get("reach"),
        "engagement": overview.get("engagementRate"),
        "engagement_absolute": overview.get("engagement"),
        "likes": overview.get("likes"),
        "comments": overview.get("comments"),
        "captured_at": now.isoformat(),
    }
    replaced = False
    for i, row in enumerate(data):
        if row.get("month") == label and (row.get("year") is None or row.get("year") == year):
            data[i] = {**row, **point}
            replaced = True
            break
    if not replaced:
        data.append(point)
    if len(data) > 24:
        data = data[-24:]
    return data


def compact_metrics_for_storage(normalized_plat: Dict[str, Any]) -> Dict[str, Any]:
    """Shape written into users.platform_metrics (compatible with existing UI)."""
    out = {
        "handle": normalized_plat.get("handle") or "",
        "followers": normalized_plat.get("followers") or 0,
        "posts": normalized_plat.get("contentCount") or 0,
        "engagement": normalized_plat.get("engagementRate")
        if normalized_plat.get("engagementRate") is not None
        else 0,
        "likes": normalized_plat.get("likes"),
        "comments": normalized_plat.get("comments"),
        "shares": normalized_plat.get("shares"),
        "saves": normalized_plat.get("saves"),
        "reach": normalized_plat.get("reach"),
        "impressions": normalized_plat.get("impressions"),
        "videoViews": normalized_plat.get("videoViews"),
        "engagement_absolute": normalized_plat.get("engagement"),
        "engagementRateBasis": normalized_plat.get("engagementRateBasis"),
    }
    # Preserve null views for platforms without view totals (avoid fake 0)
    views = normalized_plat.get("views")
    out["views"] = views if views is not None else None
    if normalized_plat.get("platform") == "youtube" and normalized_plat.get("followers") is not None:
        out["subscribers"] = normalized_plat["followers"]
    return out


def dashboard_from_users(users: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Owner/admin-style aggregate across influencers with connected socials."""
    influencers = [u for u in users if u.get("role") == "influencer"]
    overviews = [aggregate_creator_analytics(u.get("platform_metrics")) for u in influencers]
    connected = [o for o in overviews if o.get("platformsConnected")]
    ers = [o["engagementRate"] for o in connected if o.get("engagementRate") is not None]
    return {
        "totalInfluencers": len(influencers),
        "totalContent": _sum_optional([o.get("contentCount") for o in connected]),
        "totalViews": _sum_optional([o.get("views") for o in connected]),
        "totalReach": _sum_optional([o.get("reach") for o in connected]),
        "totalEngagement": _sum_optional([o.get("engagement") for o in connected]),
        "averageEngagementRate": _avg_optional(ers),
        "creatorsWithSocials": len(connected),
    }


def campaign_analytics_placeholder(
    *,
    campaign: Dict[str, Any],
    creators: Sequence[Dict[str, Any]],
    content_items: Optional[Sequence[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Campaign metrics only from campaign-linked content when available.
    Profile-level Apify data is NOT attributed to a campaign (would be incorrect).
    """
    items = [c for c in (content_items or []) if isinstance(c, dict)]
    if not items:
        creator_rows = []
        for u in creators:
            overview = aggregate_creator_analytics(u.get("platform_metrics"))
            creator_rows.append(
                {
                    "id": u.get("id"),
                    "name": u.get("name") or u.get("username"),
                    "followers": overview.get("followers"),
                    "contentPublished": None,
                    "views": None,
                    "reach": None,
                    "likes": None,
                    "comments": None,
                    "shares": None,
                    "saves": None,
                    "engagement": None,
                    "engagementRate": overview.get("engagementRate"),
                    "engagementRateBasis": overview.get("engagementRateBasis"),
                    "note": "Campaign content metrics unavailable until post-level scrape data is linked",
                }
            )
        return {
            "campaign_id": campaign.get("id"),
            "totalReach": None,
            "totalViews": None,
            "totalEngagement": None,
            "engagementRate": None,
            "contentPublished": 0,
            "creatorsParticipated": len(creators),
            "likes": None,
            "comments": None,
            "shares": None,
            "saves": None,
            "creators": creator_rows,
            "note": "No campaign-linked content metrics from Apify profile scrapes",
        }

    # If content items exist with normalized metrics, aggregate (dedupe by platform+contentId)
    seen = set()
    likes = comments = shares = saves = views = reach = 0
    likes_n = comments_n = shares_n = saves_n = views_n = reach_n = 0
    for item in items:
        key = f"{item.get('platform')}:{item.get('contentId') or item.get('id') or item.get('url')}"
        if key in seen:
            continue
        seen.add(key)
        for field, bucket in (
            ("likes", "likes"),
            ("comments", "comments"),
            ("shares", "shares"),
            ("saves", "saves"),
            ("views", "views"),
            ("reach", "reach"),
        ):
            n = parse_int(item.get(field))
            if n is None:
                continue
            if field == "likes":
                likes += n
                likes_n += 1
            elif field == "comments":
                comments += n
                comments_n += 1
            elif field == "shares":
                shares += n
                shares_n += 1
            elif field == "saves":
                saves += n
                saves_n += 1
            elif field == "views":
                views += n
                views_n += 1
            elif field == "reach":
                reach += n
                reach_n += 1

    eng = calculate_engagement(
        likes if likes_n else None,
        comments if comments_n else None,
        shares if shares_n else None,
        saves if saves_n else None,
    )
    er, basis = calculate_engagement_rate(
        float(eng) if eng is not None else None,
        views=float(views) if views_n else None,
    )
    return {
        "campaign_id": campaign.get("id"),
        "totalReach": reach if reach_n else None,
        "totalViews": views if views_n else None,
        "totalEngagement": eng,
        "engagementRate": er,
        "engagementRateBasis": basis,
        "contentPublished": len(seen),
        "creatorsParticipated": len(creators),
        "likes": likes if likes_n else None,
        "comments": comments if comments_n else None,
        "shares": shares if shares_n else None,
        "saves": saves if saves_n else None,
        "creators": [],
    }
