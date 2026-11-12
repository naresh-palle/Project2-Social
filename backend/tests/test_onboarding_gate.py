from onboarding_gate import (
    compute_profile_completion_status,
    is_onboarding_complete,
    is_dashboard_accessible,
    missing_mandatory_fields,
)


def test_google_signup_incomplete_without_mobile():
    user = {
        "role": "influencer",
        "name": "Ada",
        "email": "ada@gmail.com",
        "email_verified": True,
        "mobile": None,
        "mobile_verified": False,
        "onboarding_status": "pending",
        "niches": [],
    }
    assert "mobile_number" in missing_mandatory_fields(user)
    assert compute_profile_completion_status(user) == "PROFILE_INCOMPLETE"
    assert is_onboarding_complete(user) is False
    assert is_dashboard_accessible(user) is False


def test_complete_influencer():
    user = {
        "role": "influencer",
        "name": "Ada",
        "email": "ada@gmail.com",
        "email_verified": True,
        "mobile": "9876543210",
        "mobile_verified": True,
        "niches": ["Fashion & Style"],
        "handle": "@ada",
        "onboarding_status": "pending",
    }
    assert missing_mandatory_fields(user) == []
    assert compute_profile_completion_status(user) == "COMPLETED"
    assert is_onboarding_complete(user) is True


def test_grandfather_completed_user():
    user = {
        "role": "influencer",
        "name": "Legacy",
        "email": "legacy@cr8.studio",
        "mobile": "9123456789",
        "onboarding_status": "completed",
        # stricter fields may be missing
        "niches": [],
    }
    assert is_onboarding_complete(user) is True
    assert compute_profile_completion_status(user) == "COMPLETED"


def test_agent_pending_approval_blocks_dashboard():
    user = {
        "role": "agent",
        "name": "Agency",
        "email": "a@x.com",
        "email_verified": True,
        "mobile": "9876543210",
        "mobile_verified": True,
        "company": "Agency Co",
        "onboarding_status": "pending_approval",
        "onboarding_completed": True,
        "agent_approved": False,
        "profile_completion_status": "COMPLETED",
    }
    assert is_onboarding_complete(user) is True
    assert is_dashboard_accessible(user) is False
