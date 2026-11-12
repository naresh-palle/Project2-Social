"""
Official OAuth 2.0 flows for Google, Facebook, and Instagram (Business Login).

- Authorization code + state validation
- PKCE (S256) for Google and Instagram where supported
- Token exchange and profile fetch happen on the backend only
- Client secrets never leave the server

Instagram: uses Meta "Business Login for Instagram" (instagram.com/oauth),
NOT Facebook Login. Professional Instagram accounts are required; Advanced
Access / App Review may be needed for production traffic.
"""

from __future__ import annotations

import hashlib
import base64
import logging
import os
import secrets
import time
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode

import httpx

logger = logging.getLogger("cr8.oauth")

# In-memory OAuth state store ( co-located API instances ). TTL 10 minutes.
_OAUTH_STATES: Dict[str, dict] = {}
STATE_TTL_SEC = 600

# Runtime Meta credentials (Mongo/admin bootstrap). Env vars still win when set.
_RUNTIME_META: Dict[str, str] = {}


def set_runtime_meta_credentials(
    *,
    facebook_app_id: Optional[str] = None,
    facebook_app_secret: Optional[str] = None,
    instagram_app_id: Optional[str] = None,
    instagram_app_secret: Optional[str] = None,
) -> Dict[str, str]:
    """Apply Meta app credentials at runtime (e.g. after admin bootstrap)."""
    mapping = {
        "facebook_app_id": facebook_app_id,
        "facebook_app_secret": facebook_app_secret,
        "instagram_app_id": instagram_app_id,
        "instagram_app_secret": instagram_app_secret,
    }
    for key, value in mapping.items():
        if value is not None and str(value).strip():
            _RUNTIME_META[key] = str(value).strip()
    return dict(_RUNTIME_META)


def clear_runtime_meta_credentials() -> None:
    _RUNTIME_META.clear()


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_pkce() -> Tuple[str, str]:
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def create_oauth_state(
    provider: str,
    *,
    mode: str = "login",
    role: Optional[str] = None,
    link_user_id: Optional[str] = None,
    frontend_redirect: Optional[str] = None,
) -> Tuple[str, str, str]:
    """Returns (state, code_verifier, code_challenge)."""
    state = secrets.token_urlsafe(24)
    verifier, challenge = generate_pkce()
    _OAUTH_STATES[state] = {
        "provider": provider,
        "mode": mode,
        "role": role,
        "link_user_id": link_user_id,
        "frontend_redirect": frontend_redirect,
        "code_verifier": verifier,
        "created_at": time.time(),
    }
    _purge_expired_states()
    return state, verifier, challenge


def pop_oauth_state(state: str) -> Optional[dict]:
    _purge_expired_states()
    return _OAUTH_STATES.pop(state, None)


def _purge_expired_states() -> None:
    now = time.time()
    dead = [k for k, v in _OAUTH_STATES.items() if now - v.get("created_at", 0) > STATE_TTL_SEC]
    for k in dead:
        _OAUTH_STATES.pop(k, None)


def frontend_base() -> str:
    return (
        os.environ.get("FRONTEND_URL")
        or os.environ.get("PUBLIC_APP_URL")
        or "https://flugr.in"
    ).rstrip("/")


def api_public_base() -> str:
    return (
        os.environ.get("API_PUBLIC_URL")
        or os.environ.get("BACKEND_PUBLIC_URL")
        or "https://project2-social.onrender.com"
    ).rstrip("/")


def oauth_callback_url(provider: str) -> str:
    # Prefer explicit override; else API host + /api/oauth/{provider}/callback
    override = os.environ.get(f"{provider.upper()}_REDIRECT_URI")
    if override:
        return override.rstrip("/")
    return f"{api_public_base()}/api/oauth/{provider}/callback"


def google_client_id() -> str:
    return (
        os.environ.get("GOOGLE_CLIENT_ID")
        or "858111971322-uf792cb63b4u97u1fu494kngaajuaibr.apps.googleusercontent.com"
    )


def google_client_secret() -> str:
    return (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()


def facebook_app_id() -> str:
    return (
        os.environ.get("FACEBOOK_APP_ID")
        or os.environ.get("META_APP_ID")
        or _RUNTIME_META.get("facebook_app_id")
        or ""
    ).strip()


def facebook_app_secret() -> str:
    return (
        os.environ.get("FACEBOOK_APP_SECRET")
        or os.environ.get("META_APP_SECRET")
        or _RUNTIME_META.get("facebook_app_secret")
        or ""
    ).strip()


def instagram_app_id() -> str:
    # Instagram Login uses Instagram App ID (often same Meta app's Instagram product)
    return (
        os.environ.get("INSTAGRAM_APP_ID")
        or os.environ.get("FACEBOOK_APP_ID")
        or os.environ.get("META_APP_ID")
        or _RUNTIME_META.get("instagram_app_id")
        or _RUNTIME_META.get("facebook_app_id")
        or ""
    ).strip()


def instagram_app_secret() -> str:
    return (
        os.environ.get("INSTAGRAM_APP_SECRET")
        or os.environ.get("FACEBOOK_APP_SECRET")
        or os.environ.get("META_APP_SECRET")
        or _RUNTIME_META.get("instagram_app_secret")
        or _RUNTIME_META.get("facebook_app_secret")
        or ""
    ).strip()


def build_authorize_url(provider: str, state_meta: dict) -> str:
    provider = provider.lower()
    state = state_meta["state"]
    challenge = state_meta["code_challenge"]
    redirect_uri = oauth_callback_url(provider)

    if provider == "google":
        params = {
            "client_id": google_client_id(),
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "access_type": "online",
            "prompt": "select_account",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    if provider == "facebook":
        app_id = facebook_app_id()
        if not app_id:
            raise ValueError("FACEBOOK_APP_ID is not configured")
        params = {
            "client_id": app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            # Minimal permissions for identity + email
            "scope": "email,public_profile",
        }
        return f"https://www.facebook.com/v21.0/dialog/oauth?{urlencode(params)}"

    if provider == "instagram":
        app_id = instagram_app_id()
        if not app_id:
            raise ValueError("INSTAGRAM_APP_ID is not configured")
        # Business Login for Instagram (Instagram credentials, not Facebook Login)
        params = {
            "client_id": app_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "instagram_business_basic",
            "state": state,
        }
        return f"https://www.instagram.com/oauth/authorize?{urlencode(params)}"

    raise ValueError(f"Unsupported provider: {provider}")


async def exchange_code(provider: str, code: str, code_verifier: Optional[str]) -> Dict[str, Any]:
    """Exchange authorization code for tokens + normalized profile."""
    provider = provider.lower()
    redirect_uri = oauth_callback_url(provider)

    async with httpx.AsyncClient(timeout=30.0) as client:
        if provider == "google":
            data = {
                "code": code,
                "client_id": google_client_id(),
                "client_secret": google_client_secret(),
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
            if code_verifier:
                data["code_verifier"] = code_verifier
            if not data["client_secret"]:
                raise ValueError(
                    "GOOGLE_CLIENT_SECRET is required for Google authorization-code flow"
                )
            tok = await client.post("https://oauth2.googleapis.com/token", data=data)
            if tok.status_code >= 400:
                logger.error("Google token exchange failed: %s", tok.text[:400])
                raise ValueError("Google token exchange failed")
            tokens = tok.json()
            access = tokens.get("access_token")
            ui = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access}"},
            )
            if ui.status_code >= 400:
                raise ValueError("Failed to fetch Google profile")
            profile = ui.json()
            return {
                "provider": "google",
                "provider_user_id": str(profile.get("sub") or ""),
                "email": (profile.get("email") or "").lower().strip() or None,
                "email_verified": bool(profile.get("email_verified")),
                "name": profile.get("name") or "",
                "given_name": profile.get("given_name") or "",
                "family_name": profile.get("family_name") or "",
                "avatar": profile.get("picture"),
                "username": None,
                "access_token": access,
                "refresh_token": tokens.get("refresh_token"),
                "raw": {"userinfo": profile},
            }

        if provider == "facebook":
            app_id = facebook_app_id()
            app_secret = facebook_app_secret()
            if not app_id or not app_secret:
                raise ValueError("FACEBOOK_APP_ID / FACEBOOK_APP_SECRET are required")
            tok = await client.get(
                "https://graph.facebook.com/v21.0/oauth/access_token",
                params={
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            if tok.status_code >= 400:
                logger.error("Facebook token exchange failed: %s", tok.text[:400])
                raise ValueError("Facebook token exchange failed")
            tokens = tok.json()
            access = tokens.get("access_token")
            ui = await client.get(
                "https://graph.facebook.com/me",
                params={
                    "fields": "id,name,email,first_name,last_name,picture.type(large)",
                    "access_token": access,
                },
            )
            if ui.status_code >= 400:
                raise ValueError("Failed to fetch Facebook profile")
            profile = ui.json()
            pic = None
            try:
                pic = (((profile.get("picture") or {}).get("data") or {}).get("url"))
            except Exception:
                pic = None
            return {
                "provider": "facebook",
                "provider_user_id": str(profile.get("id") or ""),
                "email": (profile.get("email") or "").lower().strip() or None,
                "email_verified": bool(profile.get("email")),  # FB email implies verified delivery
                "name": profile.get("name") or "",
                "given_name": profile.get("first_name") or "",
                "family_name": profile.get("last_name") or "",
                "avatar": pic,
                "username": None,
                "access_token": access,
                "refresh_token": None,
                "raw": {"userinfo": profile},
            }

        if provider == "instagram":
            app_id = instagram_app_id()
            app_secret = instagram_app_secret()
            if not app_id or not app_secret:
                raise ValueError("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are required")
            # Short-lived token
            tok = await client.post(
                "https://api.instagram.com/oauth/access_token",
                data={
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            if tok.status_code >= 400:
                logger.error("Instagram token exchange failed: %s", tok.text[:400])
                raise ValueError(
                    "Instagram token exchange failed. Confirm Instagram Login product, "
                    "redirect URI, and professional account eligibility."
                )
            tokens = tok.json()
            # Response shape: { access_token, user_id } or { data: [...] }
            if isinstance(tokens.get("data"), list) and tokens["data"]:
                access = tokens["data"][0].get("access_token")
                ig_user_id = str(tokens["data"][0].get("user_id") or "")
            else:
                access = tokens.get("access_token")
                ig_user_id = str(tokens.get("user_id") or "")

            # Exchange for long-lived token (optional best-effort)
            try:
                ll = await client.get(
                    "https://graph.instagram.com/access_token",
                    params={
                        "grant_type": "ig_exchange_token",
                        "client_secret": app_secret,
                        "access_token": access,
                    },
                )
                if ll.status_code < 400:
                    access = ll.json().get("access_token") or access
            except Exception as e:
                logger.warning("Instagram long-lived exchange skipped: %s", e)

            ui = await client.get(
                "https://graph.instagram.com/me",
                params={
                    "fields": "id,username,account_type,name",
                    "access_token": access,
                },
            )
            if ui.status_code >= 400:
                logger.error("Instagram profile failed: %s", ui.text[:400])
                raise ValueError("Failed to fetch Instagram profile")
            profile = ui.json()
            username = profile.get("username") or ""
            return {
                "provider": "instagram",
                "provider_user_id": str(profile.get("id") or ig_user_id or ""),
                "email": None,  # Instagram Login does not provide email
                "email_verified": False,
                "name": profile.get("name") or username or "",
                "given_name": "",
                "family_name": "",
                "avatar": None,
                "username": username,
                "access_token": access,
                "refresh_token": None,
                "raw": {"userinfo": profile},
            }

    raise ValueError(f"Unsupported provider: {provider}")


def provider_configured(provider: str) -> Dict[str, Any]:
    p = provider.lower()
    if p == "google":
        return {
            "provider": "google",
            "configured": bool(google_client_id()),
            "auth_code_ready": bool(google_client_id() and google_client_secret()),
            "note": "GIS ID-token login works with client ID only; redirect OAuth needs GOOGLE_CLIENT_SECRET.",
        }
    if p == "facebook":
        ok = bool(facebook_app_id() and facebook_app_secret())
        return {
            "provider": "facebook",
            "configured": ok,
            "auth_code_ready": ok,
            "note": "Requires Meta app with Facebook Login; add redirect URI.",
        }
    if p == "instagram":
        ok = bool(instagram_app_id() and instagram_app_secret())
        return {
            "provider": "instagram",
            "configured": ok,
            "auth_code_ready": ok,
            "note": (
                "Uses Business Login for Instagram (instagram_business_basic), not Facebook Login. "
                "Professional Instagram account required; App Review/Advanced Access may be pending."
            ),
        }
    return {"provider": p, "configured": False, "auth_code_ready": False}
