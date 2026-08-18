"""
Social Media Audit — evaluates connected platform_metrics / Apify sync health.

Eligible: influencer, owner, agent (NOT admin, NOT support category).
Reuses users.platform_metrics, social_analytics, scraper_jobs, support tickets.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from social_analytics import (
    SOCIAL_PLATFORMS,
    aggregate_creator_analytics,
    parse_number,
)

AUDIT_STATUSES = (
    "Healthy",
    "Needs Attention",
    "Action Required",
    "Audit In Progress",
    "Audit Failed",
)

ISSUE_SEVERITIES = ("Low", "Medium", "High", "Critical")

BUSINESS_ROLES = ("influencer", "owner", "agent")
BLOCKED_AUDIT_ROLES = ("admin", "support", "support_agent", "support_lead", "support_admin")

STALE_HOURS = 72


class RaiseTicketIn(BaseModel):
    issue_id: str = Field(min_length=3, max_length=40)
    note: Optional[str] = Field(default=None, max_length=2000)


def _iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def can_access_social_audit(user: dict) -> bool:
    role = (user or {}).get("role") or ""
    if role in BLOCKED_AUDIT_ROLES:
        return False
    return role in BUSINESS_ROLES


def _parse_ts(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    try:
        ts = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    except Exception:
        return None


def _hours_since(raw: Any) -> Optional[float]:
    ts = _parse_ts(raw)
    if not ts:
        return None
    now = datetime.now(timezone.utc)
    return max(0.0, (now - ts).total_seconds() / 3600.0)


def _profile_completeness(user: dict) -> Dict[str, Any]:
    checks = {
        "name": bool((user.get("name") or "").strip()),
        "bio": bool((user.get("bio") or "").strip()),
        "avatar": bool(user.get("avatar")),
        "mobile": bool(user.get("mobile")),
        "city": bool(user.get("city") or user.get("location")),
        "social_handle": False,
    }
    pm = user.get("platform_metrics") if isinstance(user.get("platform_metrics"), dict) else {}
    connected = 0
    for plat in SOCIAL_PLATFORMS:
        row = pm.get(plat) if isinstance(pm.get(plat), dict) else {}
        if str(row.get("handle") or "").strip():
            connected += 1
            checks["social_handle"] = True
    score = int(round(100 * sum(1 for v in checks.values() if v) / max(len(checks), 1)))
    return {"score": score, "checks": checks, "connected_platforms": connected}


def _issue(
    *,
    title: str,
    severity: str,
    platform: str,
    account: str,
    description: str,
    recommended_action: str,
    category: str = "Social Media Audit",
) -> Dict[str, Any]:
    return {
        "id": f"iss_{uuid.uuid4().hex[:10]}",
        "title": title,
        "severity": severity if severity in ISSUE_SEVERITIES else "Medium",
        "platform": platform,
        "account": account or "",
        "description": description,
        "detected_at": _iso(),
        "recommended_action": recommended_action,
        "status": "Open",
        "category": category,
    }


def build_social_audit(
    user: dict,
    *,
    overview: Optional[Dict[str, Any]] = None,
    scraper_jobs: Optional[List[dict]] = None,
) -> Dict[str, Any]:
    """Pure function: produce an audit document from existing social data."""
    overview = overview or aggregate_creator_analytics(user.get("platform_metrics"))
    pm = user.get("platform_metrics") if isinstance(user.get("platform_metrics"), dict) else {}
    completeness = _profile_completeness(user)
    issues: List[Dict[str, Any]] = []
    warnings: List[str] = []
    recommendations: List[str] = []
    platforms_out: List[Dict[str, Any]] = []

    last_synced = user.get("analytics_last_synced")
    hours = _hours_since(last_synced)
    scraper_status = "ok"
    failed_jobs = [j for j in (scraper_jobs or []) if (j or {}).get("status") == "failed"]
    if failed_jobs:
        scraper_status = "failed"
        issues.append(
            _issue(
                title="Recent scraper failure",
                severity="High",
                platform=failed_jobs[0].get("platform") or "unknown",
                account=str((failed_jobs[0].get("url") or ""))[:80],
                description=failed_jobs[0].get("error_message") or "Apify scrape job failed",
                recommended_action="Re-sync analytics from Profile Edit, or raise a support ticket if it keeps failing.",
                category="Scraper Failure",
            )
        )

    for plat in SOCIAL_PLATFORMS:
        row = pm.get(plat) if isinstance(pm.get(plat), dict) else {}
        handle = str(row.get("handle") or "").strip()
        connected = bool(handle)
        plat_overview = (overview.get("platforms") or {}).get(plat) or {}
        followers = plat_overview.get("followers") if connected else None
        views = plat_overview.get("views") if connected else None
        reach = plat_overview.get("reach") if connected else None
        er = plat_overview.get("engagementRate") if connected else None
        following = parse_number(row.get("following")) if connected else None

        plat_issues = []
        api_status = "not_connected"
        freshness = None
        if connected:
            api_status = "connected"
            freshness = row.get("last_synced") or last_synced
            fh = _hours_since(freshness)
            if fh is not None and fh > STALE_HOURS:
                api_status = "stale"
                plat_issues.append(
                    _issue(
                        title=f"{plat.title()} data is stale",
                        severity="Medium",
                        platform=plat,
                        account=handle,
                        description=f"Last sync was about {int(fh)} hours ago (threshold {STALE_HOURS}h).",
                        recommended_action="Open Profile Edit and run Sync analytics.",
                        category="Stale Data",
                    )
                )
            if followers is None or followers == 0:
                plat_issues.append(
                    _issue(
                        title=f"{plat.title()} missing follower count",
                        severity="Medium" if plat != "twitter" else "Low",
                        platform=plat,
                        account=handle,
                        description="Connected handle has no follower metric stored yet.",
                        recommended_action="Sync analytics (Apify supports IG/FB/YT). For X, confirm handle and sync when available.",
                        category="Missing Data",
                    )
                )
            if plat in ("instagram", "facebook") and views is None:
                warnings.append(f"{plat}: views often unavailable from public scrapers — shown as N/A.")
            if plat == "youtube" and (views is None or views == 0):
                plat_issues.append(
                    _issue(
                        title="YouTube views missing",
                        severity="High",
                        platform=plat,
                        account=handle,
                        description="Channel total views were not returned by the last scrape.",
                        recommended_action="Re-sync YouTube analytics; verify GOOGLE/Apify YouTube actor is configured.",
                        category="Missing Data",
                    )
                )
            if er is None or er == 0:
                warnings.append(f"{plat}: engagement rate is 0 or unavailable.")
                recommendations.append(f"Improve {plat} posting cadence and CTAs to raise engagement.")
            if plat == "twitter":
                recommendations.append("X profile: add a clear bio and pin an intro post (brand audit best practice).")
            if plat == "instagram":
                recommendations.append("Instagram: keep bio + CTA updated; post Reels regularly.")
            if plat == "facebook":
                recommendations.append("Facebook: add a professional cover photo and post 3–4× weekly.")
            if plat == "youtube":
                recommendations.append("YouTube: optimize banner/thumbnails; mix Shorts + long-form.")

        issues.extend(plat_issues)
        platforms_out.append(
            {
                "platform": plat,
                "connected": connected,
                "handle": handle or None,
                "followers": followers,
                "following": following,
                "engagement": plat_overview.get("engagement") if connected else None,
                "engagementRate": er,
                "engagementRateBasis": plat_overview.get("engagementRateBasis") if connected else None,
                "views": views,
                "reach": reach,
                "posts": plat_overview.get("contentCount") if connected else None,
                "api_status": api_status,
                "last_synced": freshness,
                "issues_count": len(plat_issues),
            }
        )

    if completeness["connected_platforms"] == 0:
        issues.append(
            _issue(
                title="No social platforms connected",
                severity="Critical",
                platform="all",
                account="",
                description="No Facebook, Instagram, X, or YouTube handle is connected.",
                recommended_action="Connect at least one platform in Profile Edit and sync analytics.",
                category="Account Connection",
            )
        )
        recommendations.append("Connect Instagram + YouTube first for strongest public metrics.")

    if completeness["score"] < 70:
        issues.append(
            _issue(
                title="Profile incomplete",
                severity="Medium",
                platform="profile",
                account=user.get("username") or user.get("name") or "",
                description=f"Profile completeness score is {completeness['score']}% (name, bio, avatar, mobile, location, social).",
                recommended_action="Complete missing profile fields in Profile Edit.",
                category="Profile Quality",
            )
        )

    # Score 0–100
    score = 100
    for iss in issues:
        score -= {"Critical": 25, "High": 15, "Medium": 8, "Low": 3}.get(iss["severity"], 5)
    score = max(0, min(100, score))
    if hours is not None and hours > STALE_HOURS:
        score = max(0, score - 5)

    if any(i["severity"] == "Critical" for i in issues):
        status = "Action Required"
    elif any(i["severity"] in ("High", "Medium") for i in issues):
        status = "Needs Attention"
    elif issues:
        status = "Needs Attention"
    else:
        status = "Healthy"

    audit_id = f"saudit_{uuid.uuid4().hex[:12]}"
    return {
        "id": audit_id,
        "user_id": user.get("id"),
        "user_name": user.get("name") or user.get("username"),
        "user_role": user.get("role"),
        "status": status,
        "score": score,
        "profile_completeness": completeness,
        "overview": {
            "followers": overview.get("followers"),
            "following": None,
            "engagement": overview.get("engagement"),
            "engagementRate": overview.get("engagementRate"),
            "engagementRateBasis": overview.get("engagementRateBasis"),
            "views": overview.get("views"),
            "reach": overview.get("reach"),
            "contentCount": overview.get("contentCount"),
            "platformsConnected": overview.get("platformsConnected"),
        },
        "platforms": platforms_out,
        "issues": issues,
        "warnings": warnings,
        "recommendations": list(dict.fromkeys(recommendations))[:12],
        "scraper_status": scraper_status,
        "data_freshness": {
            "analytics_last_synced": last_synced,
            "hours_since_sync": round(hours, 1) if hours is not None else None,
            "stale_threshold_hours": STALE_HOURS,
        },
        "execution_status": "completed",
        "created_at": _iso(),
        "methodology": overview.get("methodology") or {},
    }


def setup_social_audit(
    api_router,
    *,
    db,
    get_current_user,
    require_role,
    clean,
    now_iso,
    push_notification,
    write_audit_log,
    logger,
):
    from fastapi import Depends, HTTPException, Query, Body
    from support_features import is_support_staff, has_perm

    async def _require_business_audit_user(current: dict):
        if not can_access_social_audit(current):
            raise HTTPException(status_code=403, detail="Social Media Audit is not available for Admin or Support accounts")
        return current

    async def _load_user(user_id: str) -> dict:
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        return u

    async def _recent_jobs(user_id: str, limit: int = 10) -> list:
        return await db.scraper_jobs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    async def _run_and_store(user: dict) -> dict:
        jobs = await _recent_jobs(user["id"])
        audit = build_social_audit(user, scraper_jobs=jobs)
        await db.social_audits.insert_one(dict(audit))
        if write_audit_log:
            await write_audit_log(
                action="Social Media Audit",
                user_id=user.get("id"),
                username=user.get("username"),
                details=f"Audit {audit['status']} score={audit['score']}",
                status="Completed",
                meta={"audit_id": audit["id"], "issues": len(audit.get("issues") or [])},
            )
        return audit

    @api_router.post("/social-audit/run")
    async def run_social_audit(current: dict = Depends(get_current_user)):
        await _require_business_audit_user(current)
        user = await _load_user(current["id"])
        return await _run_and_store(user)

    @api_router.get("/social-audit/me")
    async def my_social_audit(current: dict = Depends(get_current_user)):
        await _require_business_audit_user(current)
        latest = await db.social_audits.find_one({"user_id": current["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        if not latest:
            user = await _load_user(current["id"])
            latest = await _run_and_store(user)
        return latest

    @api_router.get("/social-audit/history")
    async def my_social_audit_history(
        limit: int = Query(default=20, le=50),
        current: dict = Depends(get_current_user),
    ):
        await _require_business_audit_user(current)
        rows = await db.social_audits.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return rows

    @api_router.get("/social-audit/{audit_id}")
    async def get_social_audit(audit_id: str, current: dict = Depends(get_current_user)):
        doc = await db.social_audits.find_one({"id": audit_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Audit not found")
        if doc.get("user_id") == current.get("id") and can_access_social_audit(current):
            return doc
        if is_support_staff(current) and has_perm(current, "support.tickets.view"):
            return doc
        if current.get("role") == "admin":
            return doc
        raise HTTPException(status_code=403, detail="Forbidden")

    @api_router.get("/social-audit/user/{user_id}")
    async def support_view_user_audits(
        user_id: str,
        limit: int = Query(default=20, le=50),
        current: dict = Depends(get_current_user),
    ):
        if not (current.get("role") == "admin" or (is_support_staff(current) and has_perm(current, "support.users.view_context"))):
            raise HTTPException(status_code=403, detail="Forbidden")
        rows = await db.social_audits.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return {"user_id": user_id, "audits": rows}

    @api_router.post("/social-audit/{audit_id}/raise-ticket")
    async def raise_ticket_from_audit(
        audit_id: str,
        inp: RaiseTicketIn = Body(...),
        current: dict = Depends(get_current_user),
    ):
        await _require_business_audit_user(current)
        audit = await db.social_audits.find_one({"id": audit_id, "user_id": current["id"]}, {"_id": 0})
        if not audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        issue = next((i for i in (audit.get("issues") or []) if i.get("id") == inp.issue_id), None)
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found on this audit")
        if issue.get("status") == "Ticket Raised" and issue.get("ticket_id"):
            existing = await db.support_tickets.find_one({"id": issue["ticket_id"]}, {"_id": 0})
            if existing:
                return existing

        # Reuse support ticket collection via direct insert + notify (avoid circular import of ticket creator)
        from support_features import user_type_from_role

        last = await db.support_tickets.find_one({}, {"number": 1}, sort=[("created_at", -1)])
        n = 1000
        if last and isinstance(last.get("number"), str) and (
            last["number"].startswith("FLUGR-") or last["number"].startswith("CR8-")
        ):
            try:
                n = int(last["number"].split("-")[1]) + 1
            except Exception:
                n = 1001
        ticket_id = f"tkt_{uuid.uuid4().hex[:12]}"
        plat = issue.get("platform") or "unknown"
        subject = f"[Social Audit] {issue.get('title')} ({plat})"
        description = (
            f"{issue.get('description')}\n\n"
            f"Recommended action: {issue.get('recommended_action')}\n"
            f"{(inp.note or '').strip()}"
        ).strip()
        severity = issue.get("severity") or "Medium"
        if severity not in ("Low", "Medium", "High", "Critical"):
            severity = "Medium"
        now = now_iso() if callable(now_iso) else _iso()
        # SLA hours by priority (same as support_features._sla_due)
        sla_hours = {"Critical": 4, "High": 8, "Medium": 24, "Low": 48}.get(severity, 24)
        sla_due = (datetime.utcnow() + timedelta(hours=sla_hours)).isoformat()
        doc = {
            "id": ticket_id,
            "number": f"FLUGR-{n}",
            "user_id": current["id"],
            "user_name": current.get("name") or current.get("username"),
            "user_email": current.get("email"),
            "user_role": current.get("role"),
            "user_type": user_type_from_role(current.get("role")),
            "subject": subject[:200],
            "category": "Social Media Audit",
            "priority": severity,
            "description": description[:8000],
            "campaign_id": None,
            "tags": ["social-audit", plat, issue.get("category") or "issue"],
            "status": "open",
            "ai_status": "none",
            "ai_conversation": [],
            "ai_classification": None,
            "assignee_id": None,
            "assignee_name": None,
            "escalated": False,
            "sla_due_at": sla_due,
            "sla_breached": False,
            "internal_notes": [],
            "created_at": now,
            "updated_at": now,
            "social_audit": {
                "audit_id": audit["id"],
                "issue_id": issue.get("id"),
                "platform": plat,
                "account": issue.get("account"),
                "severity": severity,
                "category": issue.get("category"),
                "audit_status": audit.get("status"),
                "audit_score": audit.get("score"),
                "scraper_status": audit.get("scraper_status"),
                "audit_timestamp": audit.get("created_at"),
                "issue_description": issue.get("description"),
                "recommended_action": issue.get("recommended_action"),
            },
            "history": [
                {
                    "actor_id": current["id"],
                    "actor_name": current.get("name") or current.get("username"),
                    "actor_role": current.get("role"),
                    "action": "created_from_social_audit",
                    "previous_status": None,
                    "new_status": "open",
                    "comment": subject,
                    "timestamp": now,
                }
            ],
        }
        await db.support_tickets.insert_one(doc)
        # Seed first user message so Support Center thread is not empty
        await db.support_messages.insert_one({
            "id": f"smsg_{uuid.uuid4().hex[:12]}",
            "ticket_id": ticket_id,
            "author_id": current["id"],
            "author_name": doc["user_name"],
            "author_role": current.get("role"),
            "body": description[:8000],
            "internal": False,
            "source": "social_audit",
            "created_at": now,
        })
        # Mark issue linked
        await db.social_audits.update_one(
            {"id": audit_id, "issues.id": issue["id"]},
            {"$set": {"issues.$.status": "Ticket Raised", "issues.$.ticket_id": ticket_id}},
        )
        try:
            if push_notification:
                await push_notification(
                    current["id"],
                    "support",
                    f"Support ticket {doc['number']} created from your social audit",
                    {"ticket_id": ticket_id, "link": "/support"},
                )
                staff = await db.users.find(
                    {"role": {"$in": ["support", "support_agent", "support_lead", "support_admin"]}, "active": {"$ne": False}},
                    {"id": 1},
                ).to_list(100)
                for s in staff:
                    if s.get("id"):
                        await push_notification(
                            s["id"],
                            "support",
                            f"New social-audit ticket {doc['number']}: {issue.get('title')}",
                            {"ticket_id": ticket_id, "link": "/support/ops?tab=tickets"},
                        )
        except Exception as e:
            if logger:
                logger.warning("social audit ticket notify failed: %s", e)
        try:
            if write_audit_log:
                await write_audit_log(
                    action="support_ticket_created",
                    user_id=current["id"],
                    username=current.get("username"),
                    details=f"Social audit ticket {doc['number']}",
                    meta={"ticket_id": ticket_id, "audit_id": audit_id, "issue_id": issue["id"], "actor_type": "user"},
                )
        except Exception as e:
            if logger:
                logger.warning("social audit ticket audit-log failed: %s", e)
        out = dict(doc)
        out.pop("_id", None)
        return out

    @api_router.post("/social-audit/user/{user_id}/retry")
    async def support_retry_audit(user_id: str, current: dict = Depends(get_current_user)):
        if not (current.get("role") == "admin" or (is_support_staff(current) and has_perm(current, "support.tickets.update"))):
            raise HTTPException(status_code=403, detail="Forbidden")
        user = await _load_user(user_id)
        if not can_access_social_audit(user):
            raise HTTPException(status_code=400, detail="Target user is not eligible for social audits")
        return await _run_and_store(user)

    async def ensure_indexes():
        await db.social_audits.create_index("id", unique=True)
        await db.social_audits.create_index([("user_id", 1), ("created_at", -1)])

    return ensure_indexes
