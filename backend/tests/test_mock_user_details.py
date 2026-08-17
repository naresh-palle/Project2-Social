from mock_user_details import (
    CREATOR_DEMO_ENRICH,
    format_location,
    infer_state,
    missing_detail_patch,
)


def test_infer_state_known_cities():
    assert infer_state("Hyderabad") == "Telangana"
    assert infer_state("Mumbai") == "Maharashtra"
    assert infer_state("New Delhi") == "Delhi"


def test_format_location():
    assert format_location("Hyderabad", "Telangana") == "Hyderabad, Telangana"
    assert format_location("Goa", "Goa") == "Goa"


def test_missing_detail_patch_fills_blank_creator():
    patch = missing_detail_patch({
        "id": "u1",
        "email": "creator@cr8.studio",
        "role": "influencer",
        "name": "Creator Demo",
        "city": "",
        "state": None,
        "location": "Remote",
        "bio": "Demo creator.",
        "languages": [],
        "mobile": None,
    })
    assert patch["city"]
    assert patch["state"]
    assert "Hyderabad" in patch["location"] or "," in patch["location"]
    assert patch["languages"]
    assert patch["mobile"]
    assert "CR8" in patch["bio"] or "creates" in patch["bio"]


def test_missing_detail_patch_does_not_overwrite_city():
    patch = missing_detail_patch({
        "id": "u2",
        "email": "someone@gmail.com",
        "role": "influencer",
        "city": "Pune",
        "state": "",
        "location": "Pune",
        "bio": "Real bio that should stay",
        "languages": ["Marathi"],
        "mobile": "9000000000",
    })
    assert "city" not in patch or patch.get("city") == "Pune"
    assert patch.get("state") == "Maharashtra"
    assert "bio" not in patch
    assert "mobile" not in patch  # real email — do not invent phone
    assert "languages" not in patch


def test_creator_demo_enrich_has_location():
    assert CREATOR_DEMO_ENRICH["city"] == "Hyderabad"
    assert CREATOR_DEMO_ENRICH["state"] == "Telangana"
    assert "Hyderabad" in CREATOR_DEMO_ENRICH["location"]
