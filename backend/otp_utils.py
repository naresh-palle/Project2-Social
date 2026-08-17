"""Timezone-safe OTP expiry helpers (no Mongo / FastAPI imports)."""
from datetime import datetime, timezone
from typing import Any, Optional


def parse_otp_datetime(value: Any) -> Optional[datetime]:
    """Parse OTP created/expires timestamps into an aware UTC datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def otp_expired(expires_at: Any, now: Any = None) -> bool:
    """True when expires_at is in the past. Missing/unparseable expiry is not treated as expired."""
    expires = parse_otp_datetime(expires_at)
    if expires is None:
        return False
    if now is None:
        current = datetime.now(timezone.utc)
    else:
        current = parse_otp_datetime(now) or datetime.now(timezone.utc)
    return current > expires
