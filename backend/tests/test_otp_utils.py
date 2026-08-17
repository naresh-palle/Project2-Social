"""Timezone-safe OTP expiry + signup wallet regression tests (no Mongo)."""
from datetime import datetime, timedelta, timezone
from pathlib import Path

from otp_utils import otp_expired, parse_otp_datetime


def test_parse_naive_datetime_becomes_utc():
    naive = datetime(2026, 8, 17, 12, 0, 0)
    parsed = parse_otp_datetime(naive)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(0)


def test_parse_z_suffix_iso():
    parsed = parse_otp_datetime("2026-08-17T12:00:00Z")
    assert parsed == datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)


def test_naive_expiry_compared_to_aware_now_does_not_raise():
    past = datetime(2020, 1, 1, 0, 0, 0)  # naive
    now = datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)
    assert otp_expired(past, now) is True


def test_aware_future_expiry_not_expired():
    future = datetime.now(timezone.utc) + timedelta(minutes=10)
    assert otp_expired(future) is False
    assert otp_expired(future.isoformat()) is False


def test_iso_string_expiry_past():
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert otp_expired(past) is True


def test_missing_expiry_is_not_expired():
    assert otp_expired(None) is False
    assert otp_expired("") is False
    assert otp_expired("not-a-date") is False


def test_create_registered_user_wallet_is_zero_not_demo_index():
    src = (Path(__file__).resolve().parents[1] / "server.py").read_text()
    start = src.find("async def _create_registered_user")
    end = src.find("async def mobile_register")
    body = src[start:end]
    assert start > 0 and end > start
    assert "i * 1500" not in body
    assert '"wallet": 0' in body
    assert "consume=False" in src[end:end + 800]
    assert "otp_record[\"otp\"]" not in src[src.find("async def register_old"): src.find("async def google_login")]
