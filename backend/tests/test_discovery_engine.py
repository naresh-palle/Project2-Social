"""Unit tests for discovery query builder, scoring, and providers — no Mongo."""
from discovery_engine import (
    UNAVAILABLE,
    ApifyProvider,
    authenticity_from_signals,
    cosine,
    creator_tier,
    embed_text,
    filters_to_mongo,
    growth_from_snapshots,
    growth_label,
    heuristic_parse_query,
    match_breakdown,
    merge_provider_profile,
    public_card,
    quality_components,
    research_template,
    facts_for_research,
    validate_filters,
)
from apify_service import strip_handle


def test_validate_filters_drops_unknown_and_sql():
    raw = {
        "platform": ["Instagram", "YouTube"],
        "followers_min": "20k",
        "engagement_rate_min": 4,
        "$where": "malicious",
        "inject": {"$gt": 1},
    }
    f = validate_filters(raw)
    assert "inject" not in f and "$where" not in f
    assert "instagram" in f["platforms"] and "youtube" in f["platforms"]
    assert f["followers_min"] == 20000
    assert f["engagement_rate_min"] == 4


def test_filters_to_mongo_never_includes_role_other_than_influencer():
    mongo = filters_to_mongo(validate_filters({
        "city": "Hyderabad",
        "followers_min": 20000,
        "followers_max": 500000,
        "category": "Technology",
    }))
    assert mongo["role"] == "influencer"
    assert mongo["followers"]["$gte"] == 20000
    assert mongo["followers"]["$lte"] == 500000


def test_heuristic_telugu_tech_hyderabad():
    f = heuristic_parse_query(
        "Find Telugu technology creators in Hyderabad with 20K–500K followers and engagement above 4%."
    )
    assert f.get("city") == "Hyderabad"
    assert "Telugu" in (f.get("languages") or [])
    assert f.get("followers_min") == 20000
    assert f.get("followers_max") == 500000
    assert f.get("engagement_rate_min") == 4
    assert any("Technology" in c for c in (f.get("categories") or []))


def test_creator_tier_and_quality_no_invention():
    assert creator_tier(5000) == "nano"
    assert creator_tier(80_000) == "mid"
    user = {"id": "c1", "followers": 12000, "bio": "Tech reviews", "niches": ["Technology & Gadgets"], "city": "Hyderabad"}
    q = quality_components(user)
    assert q["quality_score"] is not None
    assert any("unavailable" in r.lower() or "Growth" in r for r in q["reasons"])


def test_authenticity_wording_is_estimated():
    user = {"followers": 200000, "platform_metrics": {"instagram": {"followers": 200000, "engagement": 0.1}}}
    a = authenticity_from_signals(user)
    assert a["risk"] in {"low", "medium", "high"}
    assert "Estimated" in a["wording"]
    assert "definitely" not in a["wording"].lower()


def test_embeddings_cosine():
    a = embed_text(["telugu technology hyderabad smartphones"])
    b = embed_text(["telugu tech gadgets hyderabad"])
    c = embed_text(["cooking recipes italian pasta"])
    assert cosine(a, b) > cosine(a, c)


def test_growth_snapshots():
    snaps = [
        {"captured_at": "2026-01-01", "followers": 1000},
        {"captured_at": "2026-02-01", "followers": 1200},
    ]
    g = growth_from_snapshots(snaps, 30)
    assert g == 20.0
    assert growth_label(20) == "fast_growing"
    assert growth_from_snapshots([], 30) is None


def test_merge_provider_keeps_previous_on_empty():
    user = {"followers": 9000, "bio": "kept", "platform_metrics": {"instagram": {"handle": "@a", "followers": 9000}}}
    fetched = {"platform": "instagram", "followers": None, "bio": "", "handle": "@a"}
    patch = merge_provider_profile(user, fetched)
    pm = patch.get("platform_metrics", {}).get("instagram", {})
    assert pm.get("followers") == 9000 or user["platform_metrics"]["instagram"]["followers"] == 9000


def test_public_card_unavailable_growth():
    card = public_card({"id": "x", "name": "Ava", "followers": 15000, "niches": ["Fashion & Style"]})
    assert card["name"] == "Ava"
    assert card["growth_30d"] is None
    assert card["followers"] == 15000


def test_match_does_not_invent_budget():
    user = {"niches": ["Technology & Gadgets"], "platforms": ["instagram"], "city": "Hyderabad", "languages": ["Telugu"]}
    brief = {"niches": ["Technology & Gadgets"], "platforms": ["instagram"], "geography": "Hyderabad", "language": "Telugu"}
    m = match_breakdown(user, brief)
    assert m["match_score"] is not None
    assert m["breakdown"]["budget_fit"] is None
    assert any("unavailable" in w.lower() or "Engagement" in w for w in m["why"])


def test_research_template_marks_missing():
    facts = facts_for_research(
        {"id": "c", "name": "Kai", "followers": 1000, "platforms": ["youtube"]},
        {},
        [],
        [],
    )
    report = research_template(facts)
    assert report["performance"]["posting_frequency"] == UNAVAILABLE
    assert "Data unavailable" in report["disclaimer"] or report["content"]["formats"] == UNAVAILABLE


def test_apify_provider_unconfigured_returns_none():
    import asyncio
    provider = ApifyProvider(None)
    assert provider.is_configured() is False
    assert asyncio.run(provider.get_creator_profile("nasa", "instagram")) is None


def test_strip_handle_from_urls_and_at():
    assert strip_handle("@nasa") == "nasa"
    assert strip_handle("https://www.instagram.com/nasa/") == "nasa"
    assert strip_handle("https://www.youtube.com/@mkbhd") == "mkbhd"
    assert strip_handle("facebook.com/natgeo") == "natgeo"
