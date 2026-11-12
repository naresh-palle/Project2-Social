"""
Central CR8 onboarding / profile-completion evaluation.

Successful authentication is not equivalent to completed registration.
Incomplete users may browse campaigns but cannot access the full dashboard
or participation APIs until mandatory fields + email/mobile verification pass.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# Public registration categories (Support is never self-serve)
PUBLIC_ROLES = ("influencer", "owner", "agent")
INTERNAL_ROLES = (
    "admin",
    "production",
    "support",
    "support_agent",
    "support_lead",
    "support_admin",
)

# Suggested lifecycle statuses (may combine with discrete verified flags)
STATUS_REGISTERED = "REGISTERED"
STATUS_EMAIL_PENDING = "EMAIL_PENDING"
STATUS_MOBILE_PENDING = "MOBILE_PENDING"
STATUS_PROFILE_INCOMPLETE = "PROFILE_INCOMPLETE"
STATUS_VERIFICATION_PENDING = "VERIFICATION_PENDING"
STATUS_COMPLETED = "COMPLETED"
STATUS_SUSPENDED = "SUSPENDED"

REGISTRATION_METHODS = ("INSTAGRAM", "FACEBOOK", "GOOGLE", "MOBILE", "EMAIL", "PASSWORD")


def _truthy(val: Any) -> bool:
    return val is True or str(val).lower() in ("1", "true", "yes")


def _has_text(val: Any) -> bool:
    return bool(str(val or "").strip())


def _normalize_mobile(raw: Any) -> str:
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def has_social_handle(user: dict) -> bool:
    """Influencer must have at least one platform handle / Instagram username."""
    handle = str(user.get("handle") or "").strip()
    if handle:
        return True
    for acct in user.get("social_accounts") or []:
        if isinstance(acct, dict) and str(acct.get("handle") or "").strip():
            return True
    pm = user.get("platform_metrics") or {}
    if isinstance(pm, dict):
        for plat in ("instagram", "youtube", "facebook", "twitter"):
            row = pm.get(plat) or {}
            if isinstance(row, dict) and str(row.get("handle") or "").strip():
                return True
    # Linked Instagram OAuth identity counts
    for link in user.get("auth_providers") or []:
        if isinstance(link, dict) and str(link.get("provider") or "").lower() == "instagram":
            if str(link.get("username") or link.get("provider_user_id") or "").strip():
                return True
    for link in user.get("oauth_connections") or []:
        if isinstance(link, dict) and str(link.get("platform") or "").lower() == "instagram":
            if str(link.get("handle") or link.get("username") or "").strip():
                return True
    return False


def has_primary_category(user: dict) -> bool:
    niches = user.get("niches")
    if isinstance(niches, list) and any(str(x).strip() for x in niches):
        return True
    cat = user.get("category")
    if isinstance(cat, list) and any(str(x).strip() for x in cat):
        return True
    if isinstance(cat, str) and cat.strip():
        return True
    return False


def email_is_verified(user: dict) -> bool:
    if _truthy(user.get("email_verified")):
        return True
    # Legacy: fully onboarded accounts treated as email-verified
    if user.get("onboarding_status") == "completed" and _has_text(user.get("email")):
        return True
    return False


def mobile_is_verified(user: dict) -> bool:
    if _truthy(user.get("mobile_verified")):
        return True
    # Legacy grandfather: completed onboarding with a mobile on file
    if (
        user.get("onboarding_status") == "completed"
        and _normalize_mobile(user.get("mobile") or user.get("phone"))
    ):
        return True
    return False


def missing_mandatory_fields(user: dict) -> List[str]:
    """Return human-readable missing mandatory items (excluding verification)."""
    missing: List[str] = []
    role = (user.get("role") or "").strip()

    if role in INTERNAL_ROLES:
        return missing

    if not _has_text(user.get("name")):
        missing.append("full_name")
    if not _has_text(user.get("email")):
        missing.append("email")
    if not _normalize_mobile(user.get("mobile") or user.get("phone")):
        missing.append("mobile_number")
    if role not in PUBLIC_ROLES and role != "production":
        missing.append("user_category")

    if role == "influencer":
        if not has_primary_category(user):
            missing.append("content_category")
        if not has_social_handle(user):
            missing.append("instagram_or_social_handle")
    elif role == "owner":
        if not _has_text(user.get("company")):
            missing.append("company_name")
        if not _has_text(user.get("industry") or user.get("category")):
            missing.append("industry")
    elif role == "agent":
        if not _has_text(user.get("company") or user.get("name")):
            missing.append("agent_name")
        if not _has_text(user.get("mobile") or user.get("phone")):
            missing.append("contact_information")

    return missing


def compute_profile_completion_status(user: dict) -> str:
    if _truthy(user.get("banned")) or user.get("status") == "banned":
        return STATUS_SUSPENDED

    role = (user.get("role") or "").strip()
    if role in ("admin", "support", "support_agent", "support_lead", "support_admin"):
        return STATUS_COMPLETED
    # Hire/Production is admin-provisioned — honor existing onboarding_status
    if role == "production":
        if user.get("onboarding_status") == "completed":
            return STATUS_COMPLETED
        return STATUS_PROFILE_INCOMPLETE

    # Preserve access for accounts already marked completed before stricter rules
    if user.get("onboarding_status") == "completed" and email_is_verified(user) and mobile_is_verified(user):
        return STATUS_COMPLETED
    if user.get("onboarding_completed") is True and email_is_verified(user) and mobile_is_verified(user):
        return STATUS_COMPLETED

    missing = missing_mandatory_fields(user)
    email_ok = email_is_verified(user)
    mobile_ok = mobile_is_verified(user)

    if not missing and email_ok and mobile_ok:
        # Agents still need approval for full ops, but profile itself can be COMPLETED
        return STATUS_COMPLETED

    if missing:
        # Prefer more specific verification statuses when only verifies remain
        if set(missing) <= {"user_category"} or missing:
            if not email_ok and not mobile_ok:
                return STATUS_VERIFICATION_PENDING if not missing else STATUS_PROFILE_INCOMPLETE
            return STATUS_PROFILE_INCOMPLETE

    if not email_ok and not mobile_ok:
        return STATUS_VERIFICATION_PENDING
    if not email_ok:
        return STATUS_EMAIL_PENDING
    if not mobile_ok:
        return STATUS_MOBILE_PENDING
    return STATUS_PROFILE_INCOMPLETE


def is_onboarding_complete(user: dict) -> bool:
    """Full platform access — mandatory profile + email + mobile verified."""
    role = (user.get("role") or "").strip()
    if role in ("admin", "support", "support_agent", "support_lead", "support_admin"):
        return True
    if role == "production":
        return user.get("onboarding_status") == "completed"

    # Grandfather existing completed accounts (do not lock out on new field rules)
    if user.get("onboarding_status") == "completed" and email_is_verified(user) and mobile_is_verified(user):
        return True
    if user.get("onboarding_completed") is True and email_is_verified(user) and mobile_is_verified(user):
        return True

    return compute_profile_completion_status(user) == STATUS_COMPLETED


def is_dashboard_accessible(user: dict) -> bool:
    """Agents with pending approval stay off the main dashboard (existing rule)."""
    if not is_onboarding_complete(user):
        return False
    if user.get("role") == "agent" and user.get("agent_approved") is False:
        return False
    if user.get("onboarding_status") == "declined":
        return False
    return True


def campaigns_path_for_role(role: Optional[str]) -> str:
    r = (role or "influencer").strip()
    if r in ("owner", "agent"):
        return "/marketplace?tab=campaigns"
    if r == "production":
        return "/hire-requests"
    return "/marketplace?tab=campaigns"


def onboarding_path_for_user(user: dict) -> str:
    role = (user.get("role") or "influencer").strip()
    if role not in PUBLIC_ROLES and role != "production":
        role = "influencer"
    return f"/onboarding/{role}"


def enrich_user_public(user: dict) -> dict:
    """Attach computed onboarding fields for API responses (does not persist)."""
    out = dict(user)
    status = compute_profile_completion_status(out)
    complete = status == STATUS_COMPLETED and (
        out.get("role") != "agent" or out.get("agent_approved") is not False
        or out.get("onboarding_status") in ("completed", "approved", "pending_approval")
    )
    # onboarding_completed = profile+verifies done (agent approval is separate)
    profile_done = status == STATUS_COMPLETED
    out["profile_completion_status"] = out.get("profile_completion_status") or status
    # Always refresh computed view for clients
    out["profile_completion_status"] = status
    out["onboarding_completed"] = profile_done
    out["email_verified"] = email_is_verified(out)
    out["mobile_verified"] = mobile_is_verified(out)
    out["missing_mandatory_fields"] = missing_mandatory_fields(out)
    out["dashboard_accessible"] = is_dashboard_accessible(out)
    out["restricted_mode"] = not is_dashboard_accessible(out)
    out["campaigns_path"] = campaigns_path_for_role(out.get("role"))
    out["onboarding_path"] = onboarding_path_for_user(out)
    return out


def persistence_patch_from_user(user: dict) -> Dict[str, Any]:
    """Fields to $set when syncing computed status into Mongo."""
    status = compute_profile_completion_status(user)
    patch = {
        "profile_completion_status": status,
        "onboarding_completed": status == STATUS_COMPLETED,
        "email_verified": email_is_verified(user),
        "mobile_verified": mobile_is_verified(user),
    }
    # Keep legacy onboarding_status in sync when fully complete (non-agent-approval path)
    if status == STATUS_COMPLETED and user.get("role") != "agent":
        if user.get("onboarding_status") not in ("completed", "approved"):
            patch["onboarding_status"] = "completed"
    elif status == STATUS_COMPLETED and user.get("role") == "agent":
        if user.get("agent_approved") is True:
            patch["onboarding_status"] = "completed"
        elif user.get("onboarding_status") not in ("pending_approval", "declined", "completed"):
            patch["onboarding_status"] = "pending_approval"
    return patch


def migration_defaults_for_existing(user: dict) -> Dict[str, Any]:
    """
    Safe migration for existing accounts:
    - Completed onboarded users keep full access (grandfather verifies).
    - Never invent fake social links.
    """
    patch: Dict[str, Any] = {}
    role = (user.get("role") or "").strip()

    if "registration_method" not in user or not user.get("registration_method"):
        patch["registration_method"] = "EMAIL"

    if "auth_providers" not in user:
        patch["auth_providers"] = list(user.get("auth_providers") or [])

    if user.get("onboarding_status") == "completed" or role in INTERNAL_ROLES:
        if _has_text(user.get("email")) and not _truthy(user.get("email_verified")):
            patch["email_verified"] = True
        if _normalize_mobile(user.get("mobile") or user.get("phone")) and not _truthy(
            user.get("mobile_verified")
        ):
            patch["mobile_verified"] = True
        patch["onboarding_completed"] = True
        patch["profile_completion_status"] = STATUS_COMPLETED
    else:
        # Merge current doc with patch for accurate compute
        merged = {**user, **patch}
        patch.update(persistence_patch_from_user(merged))

    return patch


# Paths / API prefixes incomplete users may still hit
ALLOWED_PATH_PREFIXES_INCOMPLETE = (
    "/api/auth/",
    "/api/categories",
    "/api/campaigns",  # GET browse only — writes gated separately
    "/api/marketplace",
    "/api/uploads",
    "/api/settings",
    "/api/notifications",
    "/api/pincode",
    "/api/oauth/",
)

# Write endpoints that require completed onboarding
RESTRICTED_WRITE_SUFFIXES = (
    "/apply",
    "/fund",
    "/release",
)


def api_allowed_while_incomplete(method: str, path: str) -> bool:
    """Backend gate helper for incomplete profiles."""
    path = path or ""
    method = (method or "GET").upper()

    # Always allow auth, oauth, health-ish
    for prefix in (
        "/api/auth/",
        "/api/oauth/",
        "/api/categories",
        "/api/pincode",
        "/api/settings",
        "/api/notifications",
        "/api/uploads",
    ):
        if path.startswith(prefix):
            return True

    # Campaign / marketplace browse
    if method == "GET" and (
        path.startswith("/api/campaigns")
        or path.startswith("/api/marketplace")
        or path.startswith("/api/creators")
        or path.startswith("/api/brands")
    ):
        return True

    # Block participation / mutation campaign actions
    if path.startswith("/api/campaigns") and method != "GET":
        return False

    # Messages, wallet mutations, etc.
    if path.startswith("/api/messages") or path.startswith("/api/wallet"):
        return False

    return False
