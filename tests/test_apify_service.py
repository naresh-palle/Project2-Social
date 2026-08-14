"""Unit tests for Apify URL validation / normalization (no live Apify calls)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from apify_service import (  # noqa: E402
    normalize_profile_item,
    parse_social_url,
    platform_from_actor,
    strip_handle,
    validate_scrape_url,
)


def test_parse_instagram_url():
    plat, handle = parse_social_url("https://www.instagram.com/cr8.studio/")
    assert plat == "instagram"
    assert handle == "cr8.studio"


def test_parse_youtube_handle_url():
    plat, handle = parse_social_url("https://youtube.com/@SomeCreator")
    assert plat == "youtube"
    assert handle == "SomeCreator"


def test_validate_bare_handle():
    url = validate_scrape_url("@brand_official")
    assert "instagram.com/brand_official" in url


def test_validate_rejects_twitter():
    try:
        validate_scrape_url("https://twitter.com/foo")
        assert False, "expected ValueError"
    except ValueError as e:
        assert "Unsupported" in str(e)


def test_strip_handle_from_url():
    assert strip_handle("https://instagram.com/hello.world/") == "hello.world"
    assert strip_handle("@hello.world") == "hello.world"


def test_normalize_instagram_item():
    out = normalize_profile_item(
        "instagram",
        {"username": "x", "fullName": "X User", "biography": "bio", "followersCount": 12, "postsCount": 3},
    )
    assert out["platform"] == "instagram"
    assert out["handle"] == "x"
    assert out["followers"] == 12
    assert out["bio"] == "bio"


def test_platform_from_actor():
    assert platform_from_actor("apify~instagram-scraper") == "instagram"
    assert platform_from_actor("streamhut~youtube-scraper") == "youtube"


if __name__ == "__main__":
    test_parse_instagram_url()
    test_parse_youtube_handle_url()
    test_validate_bare_handle()
    test_validate_rejects_twitter()
    test_strip_handle_from_url()
    test_normalize_instagram_item()
    test_platform_from_actor()
    print("ok")
