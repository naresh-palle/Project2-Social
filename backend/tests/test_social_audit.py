"""Unit tests for Social Media Audit engine."""
from social_audit import (
    build_social_audit,
    can_access_social_audit,
    AUDIT_STATUSES,
    ISSUE_SEVERITIES,
)


def test_rbac_blocks_admin_and_support():
    assert can_access_social_audit({"role": "influencer"}) is True
    assert can_access_social_audit({"role": "owner"}) is True
    assert can_access_social_audit({"role": "agent"}) is True
    assert can_access_social_audit({"role": "admin"}) is False
    assert can_access_social_audit({"role": "support_agent"}) is False
    assert can_access_social_audit({"role": "support_admin"}) is False
    assert can_access_social_audit({"role": "support"}) is False


def test_audit_detects_no_platforms_critical():
    user = {
        "id": "u1",
        "name": "Flugr",
        "username": "flugr",
        "role": "influencer",
        "platform_metrics": {},
        "bio": "",
        "avatar": None,
    }
    audit = build_social_audit(user)
    assert audit["status"] in AUDIT_STATUSES
    assert audit["score"] < 100
    assert any(i["severity"] == "Critical" for i in audit["issues"])
    assert audit["execution_status"] == "completed"
    assert audit["user_id"] == "u1"


def test_audit_healthy_when_platforms_complete():
    user = {
        "id": "u2",
        "name": "Creator",
        "username": "creator",
        "role": "influencer",
        "bio": "Hello world bio",
        "avatar": "https://example.com/a.png",
        "mobile": "9999999999",
        "city": "Mumbai",
        "analytics_last_synced": "2099-01-01T00:00:00",
        "platform_metrics": {
            "instagram": {
                "handle": "creator_ig",
                "followers": 10000,
                "engagement": 500,
                "engagementRate": 5.0,
                "views": 20000,
                "posts": 40,
                "last_synced": "2099-01-01T00:00:00",
            },
            "youtube": {
                "handle": "creator_yt",
                "followers": 5000,
                "engagement": 200,
                "engagementRate": 4.0,
                "views": 100000,
                "posts": 20,
                "last_synced": "2099-01-01T00:00:00",
            },
            "facebook": {
                "handle": "creator_fb",
                "followers": 3000,
                "engagement": 100,
                "engagementRate": 3.0,
                "views": None,
                "posts": 10,
                "last_synced": "2099-01-01T00:00:00",
            },
            "twitter": {
                "handle": "creator_x",
                "followers": 2000,
                "engagement": 80,
                "engagementRate": 4.0,
                "views": None,
                "posts": 50,
                "last_synced": "2099-01-01T00:00:00",
            },
        },
    }
    audit = build_social_audit(user)
    assert audit["status"] == "Healthy" or audit["score"] >= 70
    assert len(audit["platforms"]) == 4
    assert all(p["connected"] for p in audit["platforms"])
    for iss in audit["issues"]:
        assert iss["severity"] in ISSUE_SEVERITIES
        assert "title" in iss and "recommended_action" in iss


def test_raise_ticket_input_model():
    from social_audit import RaiseTicketIn

    m = RaiseTicketIn(issue_id="iss_abcdef12")
    assert m.issue_id.startswith("iss_")
    assert m.note is None

    user = {
        "id": "u3",
        "name": "X",
        "role": "owner",
        "platform_metrics": {
            "instagram": {"handle": "brand", "followers": 100, "engagementRate": 1},
        },
    }
    jobs = [{"status": "failed", "platform": "instagram", "error_message": "timeout", "url": "ig/brand"}]
    audit = build_social_audit(user, scraper_jobs=jobs)
    assert audit["scraper_status"] == "failed"
    assert any(i["category"] == "Scraper Failure" for i in audit["issues"])
