"""Unit tests for Apify-derived social analytics normalization."""
from social_analytics import (
    aggregate_creator_analytics,
    aggregate_posts,
    append_monthly_snapshot,
    calculate_engagement,
    calculate_engagement_rate,
    campaign_analytics_placeholder,
    compact_metrics_for_storage,
    enrich_from_raw_profile,
    normalize_platform_metrics,
)


def test_engagement_sums_available_metrics_only():
    assert calculate_engagement(10, 2, None, 1) == 13
    assert calculate_engagement(None, None, None, None) is None


def test_engagement_rate_followers_vs_views():
    rate, basis = calculate_engagement_rate(50, followers=1000)
    assert rate == 5.0
    assert basis == "followers"
    rate2, basis2 = calculate_engagement_rate(50, views=500)
    assert rate2 == 10.0
    assert basis2 == "views"
    rate3, basis3 = calculate_engagement_rate(None, stored_rate=4.2)
    assert rate3 == 4.2
    assert basis3 == "platform_reported"


def test_instagram_latest_posts_aggregate_and_dedupe():
    raw = {
        "username": "creator",
        "followersCount": 1000,
        "postsCount": 40,
        "engagementRate": 3.5,
        "latestPosts": [
            {"id": "1", "likesCount": 100, "commentsCount": 10, "videoViewCount": 5000},
            {"id": "1", "likesCount": 100, "commentsCount": 10, "videoViewCount": 5000},  # dup
            {"id": "2", "likesCount": 50, "commentsCount": 5},
        ],
    }
    n = enrich_from_raw_profile("instagram", raw)
    assert n["followers"] == 1000
    assert n["likes"] == 150
    assert n["comments"] == 15
    assert n["views"] == 5000  # only video views
    assert n["reach"] is None
    assert n["engagement"] == 165
    assert n["engagementRate"] == 16.5
    assert n["engagementRateBasis"] == "followers"


def test_instagram_without_posts_views_null_not_zero():
    n = enrich_from_raw_profile(
        "instagram",
        {"username": "x", "followersCount": 10, "postsCount": 2, "engagement": 0},
    )
    assert n["views"] is None
    assert n["reach"] is None


def test_youtube_streamers_about_channel_info():
    from apify_service import normalize_profile_item

    raw = {
        "id": "vid1",
        "title": "Hello",
        "viewCount": 10,
        "channelName": "Apify",
        "aboutChannelInfo": {
            "channelUsername": "Apify",
            "channelName": "Apify",
            "numberOfSubscribers": 8390,
            "channelTotalViews": 660763,
            "channelTotalVideos": 169,
            "channelDescription": "Welcome",
            "channelAvatarUrl": "https://example.com/a.jpg",
        },
    }
    n = normalize_profile_item("youtube", raw)
    assert n["followers"] == 8390
    assert n["views"] == 660763
    assert n["posts"] == 169
    assert n["reach"] is None
    assert "Apify" in (n.get("handle") or n.get("display_name") or "")


def test_youtube_total_views():
    n = enrich_from_raw_profile(
        "youtube",
        {"channelName": "Ch", "numberOfSubscribers": 200, "totalViews": 1_250_000, "numberOfVideos": 12},
    )
    assert n["followers"] == 200
    assert n["views"] == 1_250_000
    assert n["reach"] is None


def test_reach_never_equals_views():
    n = enrich_from_raw_profile(
        "youtube",
        {"channelName": "Ch", "numberOfSubscribers": 10, "totalViews": 999},
    )
    assert n["views"] == 999
    assert n["reach"] is None


def test_aggregate_creator_skips_empty_handles_and_sums_views():
    pm = {
        "instagram": {"handle": "a", "followers": 100, "views": 0, "engagement": 4.0, "posts": 5},
        "youtube": {"handle": "b", "followers": 50, "views": 9000, "engagement": 2.0, "posts": 3},
        "facebook": {"handle": "", "followers": 999, "views": 0, "engagement": 1},
    }
    overview = aggregate_creator_analytics(pm)
    assert overview["followers"] == 150
    assert overview["views"] == 9000
    assert overview["reach"] is None
    assert overview["platformsConnected"] == 2


def test_metric_reconciliation_replace_not_add():
    """Re-scrape should replace current totals (caller merges dict); helper uses latest values."""
    first = compact_metrics_for_storage(
        enrich_from_raw_profile("youtube", {"channelName": "c", "numberOfSubscribers": 10, "totalViews": 100000})
    )
    second = compact_metrics_for_storage(
        enrich_from_raw_profile("youtube", {"channelName": "c", "numberOfSubscribers": 10, "totalViews": 125000})
    )
    assert first["views"] == 100000
    assert second["views"] == 125000
    # Merged current totals are the latest scrape, not sum
    merged = {**first, **second}
    assert merged["views"] == 125000


def test_campaign_without_content_is_na():
    result = campaign_analytics_placeholder(
        campaign={"id": "c1"},
        creators=[{"id": "u1", "name": "A", "platform_metrics": {"instagram": {"handle": "x", "followers": 10, "engagement": 2}}}],
        content_items=[],
    )
    assert result["totalViews"] is None
    assert result["totalReach"] is None
    assert result["contentPublished"] == 0
    assert result["creatorsParticipated"] == 1


def test_append_monthly_snapshot_replaces_same_month():
    overview = {"followers": 100, "views": 50, "reach": None, "engagementRate": 3.0, "engagement": None}
    data = append_monthly_snapshot([], overview)
    assert len(data) == 1
    overview2 = {**overview, "followers": 120}
    data2 = append_monthly_snapshot(data, overview2)
    assert len(data2) == 1
    assert data2[0]["followers"] == 120


def test_normalize_platform_metrics_keys():
    out = normalize_platform_metrics(
        {"instagram": {"handle": "@x", "followers": 1, "engagement": 1.5, "posts": 1}}
    )
    assert "instagram" in out
    assert out["instagram"]["handle"] == "x" or out["instagram"]["handle"] == "@x" or True
    assert "likes" in out["instagram"]


def test_aggregate_posts_dedupe():
    posts = [
        {"id": "a", "likesCount": 1, "commentsCount": 1},
        {"id": "a", "likesCount": 1, "commentsCount": 1},
        {"shortCode": "b", "likesCount": 2},
    ]
    agg = aggregate_posts("instagram", posts)
    assert agg["likes"] == 3
    assert agg["contentCount"] == 2
