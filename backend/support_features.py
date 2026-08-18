"""
flugr Support Operations — independent SUPPORT user category.

Support is NOT an Influencer/Company/Agent role. Sub-roles:
  - support_agent  (legacy alias: support)
  - support_lead
  - support_admin

Platform admin retains full access for ops.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Literal, Set

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field, EmailStr

# Canonical support category roles (independent of influencer/owner/agent)
SUPPORT_AGENT = "support_agent"
SUPPORT_LEAD = "support_lead"
SUPPORT_ADMIN = "support_admin"
LEGACY_SUPPORT = "support"  # migrated → support_agent

SUPPORT_CATEGORY_ROLES = (SUPPORT_AGENT, SUPPORT_LEAD, SUPPORT_ADMIN, LEGACY_SUPPORT)
SUPPORT_STAFF_ROLES = (*SUPPORT_CATEGORY_ROLES, "admin")


class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    category: str = "Other"
    priority: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    description: str = Field(min_length=5, max_length=8000)
    campaign_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class TicketPatch(BaseModel):
    status: Optional[str] = None
    priority: Optional[Literal["Low", "Medium", "High", "Critical"]] = None
    assignee_id: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    escalate: Optional[bool] = None
    internal_note: Optional[str] = Field(default=None, max_length=4000)


class TicketMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    internal: bool = False


class AiChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: List[Dict[str, str]] = Field(default_factory=list)
    create_ticket_if_needed: bool = False


class AiDraftIn(BaseModel):
    instruction: Optional[str] = Field(default=None, max_length=1000)


class SupportUserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8)
    support_role: Literal["support_agent", "support_lead", "support_admin"] = "support_agent"


class SupportUserPatch(BaseModel):
    name: Optional[str] = None
    support_role: Optional[Literal["support_agent", "support_lead", "support_admin"]] = None
    active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


class KbArticleIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=2, max_length=20000)
    tags: List[str] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=list)
    active: bool = True


class KbArticlePatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    body: Optional[str] = Field(default=None, min_length=2, max_length=20000)
    tags: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    active: Optional[bool] = None


class AiConfigPatch(BaseModel):
    enabled: Optional[bool] = None
    auto_escalate: Optional[bool] = None
    greeting: Optional[str] = Field(default=None, max_length=500)
    model_hint: Optional[str] = Field(default=None, max_length=80)
    max_history: Optional[int] = Field(default=None, ge=2, le=40)


# Permissions
PERMS: Dict[str, Set[str]] = {
    SUPPORT_AGENT: {
        "support.dashboard.view",
        "support.tickets.view",
        "support.tickets.claim",
        "support.tickets.update",
        "support.tickets.reply",
        "support.tickets.internal_note",
        "support.tickets.resolve",
        "support.tickets.reopen",
        "support.users.view_context",
        "support.knowledge_base.view",
        "support.analytics.view_own",
    },
    SUPPORT_LEAD: {
        "support.dashboard.view",
        "support.tickets.view",
        "support.tickets.view_all",
        "support.tickets.claim",
        "support.tickets.assign",
        "support.tickets.update",
        "support.tickets.reply",
        "support.tickets.internal_note",
        "support.tickets.resolve",
        "support.tickets.reopen",
        "support.tickets.escalate",
        "support.users.view",
        "support.users.view_context",
        "support.knowledge_base.view",
        "support.analytics.view",
        "support.queues.manage",
        "support.audit.view",
    },
    SUPPORT_ADMIN: set(),  # filled below as union of all
    "admin": set(),
}
# Support admin + platform admin get everything
_ALL_PERMS = {
    "support.dashboard.view",
    "support.tickets.view",
    "support.tickets.view_all",
    "support.tickets.create",
    "support.tickets.claim",
    "support.tickets.assign",
    "support.tickets.update",
    "support.tickets.reply",
    "support.tickets.internal_note",
    "support.tickets.resolve",
    "support.tickets.reopen",
    "support.tickets.escalate",
    "support.users.view",
    "support.users.view_context",
    "support.users.manage",
    "support.knowledge_base.view",
    "support.knowledge_base.manage",
    "support.analytics.view",
    "support.analytics.view_own",
    "support.queues.manage",
    "support.ai.configure",
    "support.audit.view",
}
PERMS[SUPPORT_ADMIN] = set(_ALL_PERMS)
PERMS["admin"] = set(_ALL_PERMS)
PERMS[LEGACY_SUPPORT] = set(PERMS[SUPPORT_AGENT])
PERMS[SUPPORT_LEAD] = PERMS[SUPPORT_LEAD] | PERMS[SUPPORT_AGENT]

TICKET_CATEGORIES = ("Payment", "Account", "Technical Bug", "Dispute", "Campaign", "Profile", "Social Media Audit", "Other")
TICKET_PRIORITIES = ("Low", "Medium", "High", "Critical")
TICKET_STATUSES = (
    "new", "ai_handling", "open", "assigned", "investigating", "in_progress",
    "action_required", "pending_user", "pending_support", "resolved", "closed", "reopened",
)
AI_STATUSES = ("ai_handling", "ai_resolved", "ai_escalated", "human_handling", "none")

USER_TYPE_LABELS = {
    "influencer": "Influencer",
    "owner": "Company",
    "agent": "Agent",
    "admin": "Admin",
}

KNOWLEDGE_BASE = """
flugr is an influencer marketplace connecting brands (companies/owners), creators (influencers), and agencies (agents).

Payments & escrow: Brands fund campaign escrow; creators are paid after deliverable approval.
Matching: niche, audience, past performance, campaign requirements.
Disputes: open a Dispute ticket; Support Operations reviews briefs and deliverables.
Accounts: Influencer, Company (owner), Agent, Admin, and Support Operations are separate categories.
Demo passwords: demo1234 for creator@ / company@ / agent@ / support@ / support.lead@ / support.admin@ cr8.studio.
"""

FAQ_BY_ROLE = {
    "influencer": [
        {"question": "How do I get paid?", "answer": "Funds release to your wallet after deliverable approval."},
        {"question": "Can I dispute a rejection?", "answer": "Yes — open a Dispute ticket in Support."},
    ],
    "owner": [
        {"question": "How do I fund escrow?", "answer": "Add funds to your brand wallet, then lock escrow on the campaign."},
    ],
    "agent": [
        {"question": "How do agency approvals work?", "answer": "Admins approve new agencies before full marketplace access."},
    ],
}


def _iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def _clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    out = dict(doc)
    out.pop("_id", None)
    return out


def normalize_support_role(role: Optional[str]) -> Optional[str]:
    if role == LEGACY_SUPPORT:
        return SUPPORT_AGENT
    return role


def is_support_category(user: dict) -> bool:
    """True only for Support Operations users (not platform admin business roles)."""
    return (user or {}).get("role") in SUPPORT_CATEGORY_ROLES


def is_support_staff(user: dict) -> bool:
    return (user or {}).get("role") in SUPPORT_STAFF_ROLES


def support_perms(user: dict) -> Set[str]:
    role = normalize_support_role((user or {}).get("role")) or ""
    if (user or {}).get("role") == "admin":
        return set(_ALL_PERMS)
    return set(PERMS.get(role, set()) | PERMS.get((user or {}).get("role"), set()))


def has_perm(user: dict, perm: str) -> bool:
    return perm in support_perms(user)


def user_type_from_role(role: Optional[str]) -> str:
    if role == "owner":
        return "company"
    if role == "influencer":
        return "influencer"
    if role == "agent":
        return "agent"
    if role in SUPPORT_CATEGORY_ROLES:
        return "support"
    return role or "unknown"


def setup_support(
    api_router: APIRouter,
    *,
    db,
    get_current_user,
    require_role,
    clean,
    now_iso,
    hash_password,
    push_notification,
    send_email,
    email_template,
    write_audit_log,
    call_llm,
    logger,
):
    async def _audit(actor: dict, action: str, *, ticket_id: str = None, details: str = "", meta: dict = None):
        if not write_audit_log:
            return
        try:
            await write_audit_log(
                action=action,
                user_id=actor.get("id"),
                username=actor.get("username") or actor.get("name"),
                user=actor.get("name"),
                details=details,
                meta={
                    **(meta or {}),
                    "actor_type": "support" if is_support_category(actor) else actor.get("role"),
                    "ticket_id": ticket_id,
                },
            )
        except Exception as e:
            logger.warning("support audit failed: %s", e)

    async def _notify(user_id: str, title: str, body: str, link: str = "/support"):
        if push_notification:
            try:
                await push_notification(user_id, "support", f"{title}: {body}", {"link": link})
            except Exception as e:
                logger.warning("support notify failed: %s", e)

    def _require_perm(current: dict, perm: str):
        if not has_perm(current, perm):
            raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")

    async def ensure_indexes():
        await db.support_tickets.create_index("id", unique=True)
        await db.support_tickets.create_index([("user_id", 1), ("created_at", -1)])
        await db.support_tickets.create_index([("user_type", 1), ("status", 1)])
        await db.support_tickets.create_index([("status", 1), ("priority", 1), ("updated_at", -1)])
        await db.support_tickets.create_index([("assignee_id", 1), ("status", 1)])
        await db.support_tickets.create_index([("ai_status", 1), ("updated_at", -1)])
        await db.support_messages.create_index("id", unique=True)
        await db.support_messages.create_index([("ticket_id", 1), ("created_at", 1)])
        await db.support_ai_sessions.create_index("id", unique=True)
        await db.support_ai_sessions.create_index([("user_id", 1), ("updated_at", -1)])
        await db.support_kb.create_index("id", unique=True)
        await db.support_kb.create_index([("active", 1), ("updated_at", -1)])
        await db.support_ai_config.create_index("id", unique=True)

    async def _touch_last_active(user: dict):
        if not user or not user.get("id") or not is_support_category(user):
            return
        try:
            await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_iso()}})
        except Exception:
            pass

    async def _ensure_kb_seed():
        count = await db.support_kb.count_documents({})
        if count:
            return
        defaults = [
            {"title": "Payments & escrow", "body": "Brands fund campaign escrow; creators are paid after deliverable approval.", "tags": ["payment", "escrow"], "roles": ["influencer", "company", "agent"]},
            {"title": "Disputes", "body": "Open a Dispute ticket; Support Operations reviews briefs and deliverables.", "tags": ["dispute"], "roles": ["influencer", "company"]},
            {"title": "Agency approvals", "body": "Admins approve new agencies before full marketplace access.", "tags": ["agent"], "roles": ["agent"]},
            {"title": "Account categories", "body": "Influencer, Company (owner), Agent, Admin, and Support Operations are separate categories.", "tags": ["account"], "roles": ["influencer", "company", "agent"]},
        ]
        now = now_iso()
        for d in defaults:
            await db.support_kb.insert_one({
                "id": f"kb_{uuid.uuid4().hex[:10]}",
                "title": d["title"],
                "body": d["body"],
                "tags": d["tags"],
                "roles": d["roles"],
                "active": True,
                "created_at": now,
                "updated_at": now,
            })

    async def _get_ai_config() -> dict:
        cfg = await db.support_ai_config.find_one({"id": "default"})
        if cfg:
            return clean(cfg) if clean else _clean_doc(cfg)
        default = {
            "id": "default",
            "enabled": True,
            "auto_escalate": True,
            "greeting": "Hi — I'm flugr AI Support. How can I help?",
            "model_hint": "default",
            "max_history": 10,
            "updated_at": now_iso(),
        }
        await db.support_ai_config.update_one({"id": "default"}, {"$setOnInsert": default}, upsert=True)
        return default

    async def seed_support_users():
        demo_hash = hash_password("demo1234")
        seeds = [
            {"email": "support@cr8.studio", "username": "supportagent", "name": "flugr Support Agent",
             "role": SUPPORT_AGENT, "handle": "@support.agent"},
            {"email": "support.lead@cr8.studio", "username": "supportlead", "name": "flugr Support Lead",
             "role": SUPPORT_LEAD, "handle": "@support.lead"},
            {"email": "support.admin@cr8.studio", "username": "supportadmin", "name": "flugr Support Admin",
             "role": SUPPORT_ADMIN, "handle": "@support.admin"},
        ]
        await _ensure_kb_seed()
        await _get_ai_config()
        # Also migrate legacy role "support" → support_agent
        await db.users.update_many({"role": LEGACY_SUPPORT}, {"$set": {"role": SUPPORT_AGENT, "user_category": "support"}})
        for s in seeds:
            existing = await db.users.find_one({"email": s["email"]})
            base = {
                "password_hash": demo_hash,
                "name": s["name"],
                "username": s["username"],
                "role": s["role"],
                "user_category": "support",
                "handle": s["handle"],
                "company": "flugr Support Operations",
                "bio": "Internal Support Operations",
                "verified": True,
                "wallet": 0,
                "onboarding_status": "completed",
                "agent_approved": True,
                "active": True,
                "avatar": None,
                "niches": [],
                "platforms": [],
            }
            if not existing:
                await db.users.insert_one({"id": str(uuid.uuid4()), "email": s["email"], "created_at": now_iso(), **base})
                logger.info("Seeded support user %s (%s)", s["email"], s["role"])
            else:
                await db.users.update_one({"email": s["email"]}, {"$set": base})

    def _public_ticket(doc: dict, include_internal: bool = False) -> dict:
        t = clean(doc) if clean else _clean_doc(doc)
        if not t:
            return {}
        if not include_internal:
            t.pop("internal_notes", None)
        t["user_type_label"] = USER_TYPE_LABELS.get(
            "owner" if t.get("user_type") == "company" else t.get("user_type") or t.get("user_role"),
            t.get("user_type") or t.get("user_role") or "User",
        )
        return t

    async def _get_ticket_or_404(ticket_id: str) -> dict:
        ticket = await db.support_tickets.find_one({"id": ticket_id})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return ticket

    async def _assert_ticket_access(ticket: dict, current: dict, *, write: bool = False):
        if is_support_staff(current):
            return
        if ticket.get("user_id") != current.get("id"):
            raise HTTPException(status_code=403, detail="Forbidden")
        if write and ticket.get("status") in ("closed",):
            raise HTTPException(status_code=400, detail="Ticket is closed")

    async def _next_ticket_number() -> str:
        count = await db.support_tickets.count_documents({})
        return f"FLUGR-{1000 + count + 1}"

    def _sla_due(priority: str) -> str:
        hours = {"Critical": 4, "High": 8, "Medium": 24, "Low": 48}.get(priority, 24)
        return (datetime.utcnow() + timedelta(hours=hours)).isoformat()

    async def _create_ticket_internal(
        current: dict,
        inp: TicketCreate,
        *,
        ai_status: str = "none",
        ai_conversation: list = None,
        ai_classification: dict = None,
    ) -> dict:
        ticket_id = f"tkt_{uuid.uuid4().hex[:12]}"
        number = await _next_ticket_number()
        now = now_iso()
        utype = user_type_from_role(current.get("role"))
        doc = {
            "id": ticket_id,
            "number": number,
            "user_id": current["id"],
            "user_name": current.get("name") or current.get("username") or current.get("email"),
            "user_email": current.get("email"),
            "user_role": current.get("role"),
            "user_type": utype,
            "subject": inp.subject.strip(),
            "category": inp.category if inp.category in TICKET_CATEGORIES else "Other",
            "priority": inp.priority,
            "description": inp.description.strip(),
            "campaign_id": inp.campaign_id,
            "tags": list(inp.tags or []),
            "status": "new" if ai_status == "ai_escalated" else "open",
            "ai_status": ai_status,
            "ai_conversation": list(ai_conversation or []),
            "ai_classification": ai_classification or {},
            "assignee_id": None,
            "assignee_name": None,
            "escalated": False,
            "sla_due_at": _sla_due(inp.priority),
            "sla_breached": False,
            "internal_notes": [],
            "history": [
                {
                    "actor_id": current["id"],
                    "actor_name": current.get("name") or current.get("username"),
                    "actor_role": current.get("role"),
                    "action": "created",
                    "previous_status": None,
                    "new_status": "new" if ai_status == "ai_escalated" else "open",
                    "comment": inp.subject.strip()[:200],
                    "timestamp": now,
                }
            ],
            "created_at": now,
            "updated_at": now,
        }
        await db.support_tickets.insert_one(doc)
        await db.support_messages.insert_one({
            "id": f"smsg_{uuid.uuid4().hex[:12]}",
            "ticket_id": ticket_id,
            "author_id": current["id"],
            "author_name": doc["user_name"],
            "author_role": current.get("role"),
            "body": inp.description.strip(),
            "internal": False,
            "source": "user",
            "created_at": now,
        })
        # Attach AI transcript as system messages
        for turn in (ai_conversation or []):
            await db.support_messages.insert_one({
                "id": f"smsg_{uuid.uuid4().hex[:12]}",
                "ticket_id": ticket_id,
                "author_id": "ai" if turn.get("role") == "assistant" else current["id"],
                "author_name": "flugr AI Support" if turn.get("role") == "assistant" else doc["user_name"],
                "author_role": "ai" if turn.get("role") == "assistant" else current.get("role"),
                "body": turn.get("content") or "",
                "internal": False,
                "source": "ai",
                "created_at": now,
            })
        staff = await db.users.find(
            {"role": {"$in": list(SUPPORT_CATEGORY_ROLES)}, "active": {"$ne": False}},
            {"_id": 0, "id": 1},
        ).to_list(50)
        for s in staff:
            await _notify(s["id"], f"New ticket {number}", f"[{utype}] {inp.subject}", link="/support")
        await _audit(current, "support_ticket_created", ticket_id=ticket_id,
                     meta={"number": number, "user_type": utype, "category": inp.category})
        return doc

    # ── Me / permissions ──
    @api_router.get("/support/me")
    async def support_me(current: dict = Depends(get_current_user)):
        role = normalize_support_role(current.get("role"))
        return {
            "id": current.get("id"),
            "name": current.get("name"),
            "email": current.get("email"),
            "role": current.get("role"),
            "support_role": role if is_support_category(current) else None,
            "user_category": "support" if is_support_category(current) else user_type_from_role(current.get("role")),
            "is_support": is_support_category(current),
            "permissions": sorted(support_perms(current)) if is_support_staff(current) else [],
        }

    @api_router.get("/support/faqs")
    async def support_faqs(current: dict = Depends(get_current_user)):
        role = current.get("role") or "influencer"
        faqs = FAQ_BY_ROLE.get(role) or FAQ_BY_ROLE["influencer"]
        return {"role": role, "faqs": faqs}

    @api_router.get("/support/stats")
    async def support_stats(current: dict = Depends(get_current_user)):
        _require_perm(current, "support.dashboard.view")
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        async def cnt(q):
            return await db.support_tickets.count_documents(q)

        open_statuses = ["new", "open", "assigned", "in_progress", "pending_user", "pending_support", "reopened", "ai_handling"]
        total = await cnt({})
        return {
            "total": total,
            "new": await cnt({"status": "new"}),
            "unassigned": await cnt({"assignee_id": None, "status": {"$in": open_statuses}}),
            "my_open": await cnt({"assignee_id": current["id"], "status": {"$in": open_statuses}}),
            "influencer": await cnt({"user_type": "influencer", "status": {"$in": open_statuses}}),
            "company": await cnt({"user_type": "company", "status": {"$in": open_statuses}}),
            "agent": await cnt({"user_type": "agent", "status": {"$in": open_statuses}}),
            "critical": await cnt({"priority": "Critical", "status": {"$in": open_statuses}}),
            "ai_resolved": await cnt({"ai_status": "ai_resolved"}),
            "ai_escalated": await cnt({"ai_status": "ai_escalated"}),
            "pending_user": await cnt({"status": "pending_user"}),
            "pending_support": await cnt({"status": "pending_support"}),
            "sla_breached": await cnt({"sla_breached": True, "status": {"$in": open_statuses}}),
            "resolved_today": await cnt({"status": {"$in": ["resolved", "closed"]}, "updated_at": {"$gte": day_start}}),
            "finished_today_by_me": await cnt({
                "assignee_id": current["id"],
                "status": {"$in": ["resolved", "closed"]},
                "updated_at": {"$gte": day_start},
            }),
            # legacy keys
            "open": await cnt({"status": {"$in": open_statuses}}),
            "urgent": await cnt({"priority": {"$in": ["Critical", "High"]}, "status": {"$in": open_statuses}}),
            "assigned_to_me": await cnt({"assignee_id": current["id"], "status": {"$in": open_statuses}}),
        }

    @api_router.get("/support/agents")
    async def list_support_agents(current: dict = Depends(get_current_user)):
        _require_perm(current, "support.tickets.assign")
        cursor = db.users.find(
            {"role": {"$in": list(SUPPORT_CATEGORY_ROLES)}, "active": {"$ne": False}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "avatar": 1, "active": 1},
        )
        return {"agents": await cursor.to_list(200)}

    # ── Support user management (Support Admin) ──
    @api_router.get("/support/staff")
    async def list_support_staff(current: dict = Depends(get_current_user)):
        _require_perm(current, "support.users.view")
        users = await db.users.find(
            {"role": {"$in": list(SUPPORT_CATEGORY_ROLES)}},
            {"_id": 0, "password_hash": 0, "two_fa_secret": 0},
        ).to_list(200)
        out = []
        for u in users:
            open_n = await db.support_tickets.count_documents({
                "assignee_id": u["id"],
                "status": {"$nin": ["resolved", "closed"]},
            })
            resolved_n = await db.support_tickets.count_documents({
                "assignee_id": u["id"],
                "status": {"$in": ["resolved", "closed"]},
            })
            breached_n = await db.support_tickets.count_documents({
                "assignee_id": u["id"],
                "sla_breached": True,
            })
            handled = resolved_n + open_n
            sla_pct = round(100.0 * (1 - (breached_n / handled)), 1) if handled else 100.0
            out.append({
                **(clean(u) if clean else _clean_doc(u)),
                "support_role": normalize_support_role(u.get("role")),
                "open_tickets": open_n,
                "resolved_tickets": resolved_n,
                "sla_breached_tickets": breached_n,
                "sla_performance": sla_pct,
                "last_active": u.get("last_active") or u.get("updated_at") or u.get("created_at"),
                "status": "active" if u.get("active", True) else "inactive",
            })
        return {"users": out}

    @api_router.post("/support/staff")
    async def create_support_staff(inp: SupportUserCreate, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.users.manage")
        email = inp.email.lower().strip()
        username = inp.username.lower().strip()
        if await db.users.find_one({"$or": [{"email": email}, {"username": username}]}):
            raise HTTPException(status_code=400, detail="Email or username already exists")
        doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "username": username,
            "name": inp.name.strip(),
            "password_hash": hash_password(inp.password),
            "role": inp.support_role,
            "user_category": "support",
            "handle": f"@{username}",
            "company": "flugr Support Operations",
            "verified": True,
            "wallet": 0,
            "onboarding_status": "completed",
            "agent_approved": True,
            "active": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(doc)
        await _audit(current, "support_user_created", details=email, meta={"role": inp.support_role})
        return {"ok": True, "user": {k: v for k, v in doc.items() if k != "password_hash"}}

    @api_router.patch("/support/staff/{user_id}")
    async def patch_support_staff(user_id: str, inp: SupportUserPatch, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.users.manage")
        target = await db.users.find_one({"id": user_id, "role": {"$in": list(SUPPORT_CATEGORY_ROLES)}})
        if not target:
            raise HTTPException(status_code=404, detail="Support user not found")
        updates: Dict[str, Any] = {}
        if inp.name is not None:
            updates["name"] = inp.name.strip()
        if inp.support_role is not None:
            updates["role"] = inp.support_role
            updates["user_category"] = "support"
        if inp.active is not None:
            updates["active"] = inp.active
        if inp.password:
            updates["password_hash"] = hash_password(inp.password)
        if updates:
            await db.users.update_one({"id": user_id}, {"$set": updates})
            await _audit(current, "support_user_updated", details=user_id, meta=updates)
        fresh = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        return {"ok": True, "user": fresh}

    @api_router.post("/support/tickets")
    async def create_ticket(inp: TicketCreate, current: dict = Depends(get_current_user)):
        if is_support_category(current):
            raise HTTPException(status_code=400, detail="Support staff should not open end-user tickets here")
        doc = await _create_ticket_internal(current, inp)
        return {"ok": True, "ticket": _public_ticket(doc, include_internal=False)}

    @api_router.get("/support/tickets")
    async def list_tickets(
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        user_type: Optional[str] = None,
        ai_status: Optional[str] = None,
        assignment: Optional[str] = None,
        q: Optional[str] = None,
        mine: bool = False,
        escalated: Optional[bool] = None,
        limit: int = Query(100, ge=1, le=300),
        current: dict = Depends(get_current_user),
    ):
        query: Dict[str, Any] = {}
        if is_support_staff(current):
            _require_perm(current, "support.tickets.view")
            if mine or assignment == "mine":
                query["assignee_id"] = current["id"]
            elif assignment == "unassigned":
                query["assignee_id"] = None
            elif assignment and assignment not in ("all", ""):
                query["assignee_id"] = assignment
            if not has_perm(current, "support.tickets.view_all") and "assignee_id" not in query:
                # Agents see unassigned + own by default unless filtered
                query["$or"] = [{"assignee_id": None}, {"assignee_id": current["id"]}]
        else:
            query["user_id"] = current["id"]

        if status:
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            # map legacy waiting_user → pending_user
            mapped = []
            for s in statuses:
                if s == "waiting_user":
                    mapped.append("pending_user")
                else:
                    mapped.append(s)
            if mapped:
                query["status"] = {"$in": mapped}
        if priority:
            # map Urgent → Critical for legacy
            pr = "Critical" if priority == "Urgent" else priority
            query["priority"] = pr
        if category:
            query["category"] = category
        if user_type and user_type.lower() not in ("all", ""):
            ut = user_type.lower()
            if ut == "company":
                ut = "company"
            query["user_type"] = ut
        if ai_status:
            query["ai_status"] = ai_status
        if escalated is not None:
            query["escalated"] = escalated
        if q:
            rx = {"$regex": re.escape(q.strip()), "$options": "i"}
            query.setdefault("$and", []).append({
                "$or": [{"subject": rx}, {"number": rx}, {"user_name": rx}, {"user_email": rx}, {"description": rx}]
            })

        # SLA breach refresh (best-effort)
        now = datetime.utcnow().isoformat()
        await db.support_tickets.update_many(
            {"sla_due_at": {"$lt": now}, "status": {"$nin": ["resolved", "closed"]}, "sla_breached": {"$ne": True}},
            {"$set": {"sla_breached": True}},
        )

        cursor = db.support_tickets.find(query, {"_id": 0}).sort("updated_at", -1).limit(limit)
        items = await cursor.to_list(limit)
        return {
            "tickets": [_public_ticket(t, include_internal=is_support_staff(current)) for t in items],
            "staff": is_support_staff(current),
        }

    @api_router.get("/support/tickets/{ticket_id}")
    async def get_ticket(ticket_id: str, current: dict = Depends(get_current_user)):
        ticket = await _get_ticket_or_404(ticket_id)
        await _assert_ticket_access(ticket, current)
        staff = is_support_staff(current)
        if staff:
            _require_perm(current, "support.tickets.view")
            await _audit(current, "support_ticket_viewed", ticket_id=ticket_id)
        msgs = await db.support_messages.find(
            {"ticket_id": ticket_id, **({} if staff else {"internal": {"$ne": True}})},
            {"_id": 0},
        ).sort("created_at", 1).to_list(800)

        user_context = None
        if staff and has_perm(current, "support.users.view_context"):
            u = await db.users.find_one(
                {"id": ticket.get("user_id")},
                {"_id": 0, "password_hash": 0, "two_fa_secret": 0, "wallet": 0},
            )
            if u:
                ut = user_type_from_role(u.get("role"))
                user_context = {
                    "id": u.get("id"),
                    "name": u.get("name"),
                    "email": u.get("email"),
                    "role": u.get("role"),
                    "user_type": ut,
                    "company": u.get("company"),
                    "handle": u.get("handle") or u.get("username"),
                    "city": u.get("city"),
                    "verified": u.get("verified"),
                    "onboarding_status": u.get("onboarding_status"),
                    "platforms": u.get("platforms") or [],
                    "niches": u.get("niches") or [],
                    "industry": u.get("industry"),
                    "agent_approved": u.get("agent_approved"),
                }
                if ut == "influencer":
                    camp_n = await db.campaigns.count_documents({
                        "$or": [
                            {"applications.influencer_id": u.get("id")},
                            {"accepted_influencers": u.get("id")},
                        ]
                    }) if hasattr(db, "campaigns") else 0
                    user_context["campaign_participations"] = camp_n
                elif ut == "company":
                    owned = await db.campaigns.count_documents({"owner_id": u.get("id")}) if hasattr(db, "campaigns") else 0
                    user_context["campaigns_owned"] = owned
                elif ut == "agent":
                    roster = await db.users.count_documents({"agent_id": u.get("id"), "role": "influencer"})
                    user_context["roster_size"] = roster

        if staff:
            await _touch_last_active(current)

        return {
            "ticket": _public_ticket(ticket, include_internal=staff),
            "messages": [clean(m) if clean else _clean_doc(m) for m in msgs],
            "ai_conversation": ticket.get("ai_conversation") or [],
            "user_context": user_context,
            "staff": staff,
            "permissions": sorted(support_perms(current)) if staff else [],
        }

    @api_router.post("/support/tickets/{ticket_id}/messages")
    async def post_ticket_message(ticket_id: str, inp: TicketMessageIn, current: dict = Depends(get_current_user)):
        ticket = await _get_ticket_or_404(ticket_id)
        await _assert_ticket_access(ticket, current, write=True)
        staff = is_support_staff(current)
        if inp.internal:
            if not staff:
                raise HTTPException(status_code=403, detail="Internal notes are staff-only")
            _require_perm(current, "support.tickets.internal_note")
        elif staff:
            _require_perm(current, "support.tickets.reply")

        now = now_iso()
        msg = {
            "id": f"smsg_{uuid.uuid4().hex[:12]}",
            "ticket_id": ticket_id,
            "author_id": current["id"],
            "author_name": current.get("name") or current.get("username"),
            "author_role": current.get("role"),
            "body": inp.body.strip(),
            "internal": bool(inp.internal and staff),
            "source": "support" if staff else "user",
            "created_at": now,
        }
        await db.support_messages.insert_one(msg)
        if staff:
            await _touch_last_active(current)

        updates: Dict[str, Any] = {"updated_at": now, "ai_status": "human_handling"}
        if staff and not inp.internal:
            if not ticket.get("assignee_id"):
                updates["assignee_id"] = current["id"]
                updates["assignee_name"] = current.get("name")
            updates["status"] = "pending_user"
        elif not staff:
            if ticket.get("status") in ("pending_user", "resolved"):
                updates["status"] = "pending_support" if ticket.get("assignee_id") else "open"

        await db.support_tickets.update_one({"id": ticket_id}, {"$set": updates})
        await _audit(current, "support_internal_note" if inp.internal else "support_reply",
                     ticket_id=ticket_id)

        if staff and not inp.internal:
            await _notify(ticket["user_id"], f"Update on {ticket.get('number')}", "Support replied to your ticket.")
        elif not staff and ticket.get("assignee_id"):
            await _notify(ticket["assignee_id"], f"Reply on {ticket.get('number')}", "User replied.")

        return {"ok": True, "message": clean(msg) if clean else _clean_doc(msg)}

    @api_router.post("/support/tickets/{ticket_id}/claim")
    async def claim_ticket(ticket_id: str, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.tickets.claim")
        ticket = await _get_ticket_or_404(ticket_id)
        if ticket.get("assignee_id") and ticket.get("assignee_id") != current["id"]:
            if not has_perm(current, "support.tickets.assign"):
                raise HTTPException(status_code=400, detail="Ticket already assigned")
        prev = ticket.get("status")
        now = now_iso()
        hist = {
            "actor_id": current["id"],
            "actor_name": current.get("name") or current.get("username"),
            "actor_role": current.get("role"),
            "action": "claimed",
            "previous_status": prev,
            "new_status": "assigned",
            "comment": "Ticket claimed",
            "timestamp": now,
        }
        await db.support_tickets.update_one(
            {"id": ticket_id},
            {
                "$set": {
                    "assignee_id": current["id"],
                    "assignee_name": current.get("name"),
                    "status": "assigned",
                    "ai_status": "human_handling",
                    "updated_at": now,
                },
                "$push": {"history": hist},
            },
        )
        await _audit(current, "support_ticket_assigned", ticket_id=ticket_id, meta={"assignee_id": current["id"]})
        await _touch_last_active(current)
        if ticket.get("user_id"):
            await _notify(ticket["user_id"], f"Ticket {ticket.get('number')}", "Support assigned your ticket.")
        fresh = await _get_ticket_or_404(ticket_id)
        return {"ok": True, "ticket": _public_ticket(fresh, include_internal=True)}

    @api_router.patch("/support/tickets/{ticket_id}")
    async def patch_ticket(ticket_id: str, inp: TicketPatch, current: dict = Depends(get_current_user)):
        ticket = await _get_ticket_or_404(ticket_id)
        staff = is_support_staff(current)

        if not staff:
            await _assert_ticket_access(ticket, current)
            if inp.assignee_id or inp.internal_note or inp.tags is not None or inp.escalate:
                raise HTTPException(status_code=403, detail="Only support staff can change that field")
            if inp.status and inp.status not in ("closed", "open", "reopened"):
                raise HTTPException(status_code=403, detail="Invalid status for user")
        else:
            _require_perm(current, "support.tickets.update")
            if inp.assignee_id is not None:
                _require_perm(current, "support.tickets.assign")
            if inp.escalate:
                _require_perm(current, "support.tickets.escalate")
            if inp.status in ("resolved", "closed"):
                _require_perm(current, "support.tickets.resolve")
            if inp.status == "reopened":
                _require_perm(current, "support.tickets.reopen")

        updates: Dict[str, Any] = {"updated_at": now_iso()}
        prev_status = ticket.get("status")
        if inp.status:
            st = inp.status
            if st == "waiting_user":
                st = "pending_user"
            elif st == "investigating":
                st = "investigating"
            elif st == "action_required":
                st = "action_required"
            if st not in TICKET_STATUSES and st != "waiting_user":
                raise HTTPException(status_code=400, detail="Invalid status")
            updates["status"] = st
        if inp.priority and staff:
            updates["priority"] = inp.priority
            updates["sla_due_at"] = _sla_due(inp.priority)
        if inp.category and staff:
            updates["category"] = inp.category
        if inp.tags is not None and staff:
            updates["tags"] = inp.tags
        if inp.escalate and staff:
            updates["escalated"] = True
            updates["status"] = "pending_support"
        if inp.assignee_id is not None and staff:
            if inp.assignee_id == "":
                updates["assignee_id"] = None
                updates["assignee_name"] = None
            else:
                agent = await db.users.find_one(
                    {"id": inp.assignee_id, "role": {"$in": list(SUPPORT_CATEGORY_ROLES)}},
                    {"_id": 0, "id": 1, "name": 1},
                )
                if not agent:
                    raise HTTPException(status_code=400, detail="Assignee must be a Support Operations user")
                updates["assignee_id"] = agent["id"]
                updates["assignee_name"] = agent.get("name")
                if ticket.get("status") in ("new", "open", "ai_handling"):
                    updates["status"] = "assigned"

        hist_entry = None
        if "status" in updates and updates["status"] != prev_status:
            hist_entry = {
                "actor_id": current["id"],
                "actor_name": current.get("name") or current.get("username"),
                "actor_role": current.get("role"),
                "action": "status_change",
                "previous_status": prev_status,
                "new_status": updates["status"],
                "comment": (inp.internal_note or "").strip()[:500] if staff else "",
                "timestamp": updates["updated_at"],
            }

        push_ops: Dict[str, Any] = {}
        if hist_entry:
            push_ops["history"] = hist_entry

        if inp.internal_note and staff:
            _require_perm(current, "support.tickets.internal_note")
            note = {
                "id": f"note_{uuid.uuid4().hex[:8]}",
                "author_id": current["id"],
                "author_name": current.get("name"),
                "body": inp.internal_note.strip(),
                "created_at": now_iso(),
            }
            push_ops["internal_notes"] = note
            await db.support_tickets.update_one(
                {"id": ticket_id},
                {"$set": updates, "$push": push_ops} if push_ops else {"$set": updates},
            )
            await _audit(current, "support_internal_note", ticket_id=ticket_id)
        else:
            op: Dict[str, Any] = {"$set": updates}
            if push_ops:
                op["$push"] = push_ops
            await db.support_tickets.update_one({"id": ticket_id}, op)
            await _audit(current, "support_ticket_updated", ticket_id=ticket_id,
                         meta={k: updates[k] for k in updates if k != "updated_at"})

        if staff and "status" in updates and updates["status"] != prev_status and ticket.get("user_id"):
            label = str(updates["status"]).replace("_", " ")
            body = f"Status is now {label}."
            if updates["status"] in ("resolved", "closed"):
                body = "Your ticket was resolved." if updates["status"] == "resolved" else "Your ticket was closed."
            await _notify(ticket["user_id"], f"Ticket {ticket.get('number')}", body)

        fresh = await _get_ticket_or_404(ticket_id)
        if staff:
            await _touch_last_active(current)
        return {"ok": True, "ticket": _public_ticket(fresh, include_internal=staff)}

    @api_router.get("/support/knowledge")
    async def list_kb(current: dict = Depends(get_current_user)):
        _require_perm(current, "support.knowledge_base.view")
        items = await db.support_kb.find({}, {"_id": 0}).sort("updated_at", -1).to_list(200)
        return {"articles": items}

    @api_router.post("/support/knowledge")
    async def create_kb(inp: KbArticleIn = Body(...), current: dict = Depends(get_current_user)):
        _require_perm(current, "support.knowledge_base.manage")
        now = now_iso()
        doc = {
            "id": f"kb_{uuid.uuid4().hex[:10]}",
            "title": inp.title.strip(),
            "body": inp.body.strip(),
            "tags": list(inp.tags or []),
            "roles": list(inp.roles or []),
            "active": bool(inp.active),
            "created_at": now,
            "updated_at": now,
            "created_by": current.get("id"),
        }
        await db.support_kb.insert_one(doc)
        await _audit(current, "support_kb_created", details=doc["title"], meta={"id": doc["id"]})
        await _touch_last_active(current)
        return {"ok": True, "article": doc}

    @api_router.patch("/support/knowledge/{article_id}")
    async def patch_kb(article_id: str, inp: KbArticlePatch, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.knowledge_base.manage")
        existing = await db.support_kb.find_one({"id": article_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")
        updates: Dict[str, Any] = {"updated_at": now_iso()}
        if inp.title is not None:
            updates["title"] = inp.title.strip()
        if inp.body is not None:
            updates["body"] = inp.body.strip()
        if inp.tags is not None:
            updates["tags"] = inp.tags
        if inp.roles is not None:
            updates["roles"] = inp.roles
        if inp.active is not None:
            updates["active"] = inp.active
        await db.support_kb.update_one({"id": article_id}, {"$set": updates})
        await _audit(current, "support_kb_updated", details=article_id, meta=updates)
        await _touch_last_active(current)
        fresh = await db.support_kb.find_one({"id": article_id}, {"_id": 0})
        return {"ok": True, "article": fresh}

    @api_router.delete("/support/knowledge/{article_id}")
    async def delete_kb(article_id: str, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.knowledge_base.manage")
        res = await db.support_kb.delete_one({"id": article_id})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail="Article not found")
        await _audit(current, "support_kb_deleted", details=article_id)
        return {"ok": True}

    @api_router.get("/support/ai/config")
    async def get_ai_config(current: dict = Depends(get_current_user)):
        if not (has_perm(current, "support.ai.configure") or has_perm(current, "support.knowledge_base.view")):
            raise HTTPException(status_code=403, detail="Missing permission")
        return {"config": await _get_ai_config()}

    @api_router.patch("/support/ai/config")
    async def patch_ai_config(inp: AiConfigPatch, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.ai.configure")
        updates: Dict[str, Any] = {"updated_at": now_iso()}
        if inp.enabled is not None:
            updates["enabled"] = inp.enabled
        if inp.auto_escalate is not None:
            updates["auto_escalate"] = inp.auto_escalate
        if inp.greeting is not None:
            updates["greeting"] = inp.greeting.strip()
        if inp.model_hint is not None:
            updates["model_hint"] = inp.model_hint.strip()
        if inp.max_history is not None:
            updates["max_history"] = inp.max_history
        await db.support_ai_config.update_one({"id": "default"}, {"$set": updates}, upsert=True)
        await _audit(current, "support_ai_config_updated", meta=updates)
        await _touch_last_active(current)
        return {"ok": True, "config": await _get_ai_config()}

    @api_router.get("/support/analytics")
    async def support_analytics(current: dict = Depends(get_current_user)):
        if not (has_perm(current, "support.analytics.view") or has_perm(current, "support.analytics.view_own")):
            raise HTTPException(status_code=403, detail="Missing permission: support.analytics.view")
        open_statuses = ["new", "open", "assigned", "in_progress", "pending_user", "pending_support", "reopened", "ai_handling"]
        by_type = {}
        for ut in ("influencer", "company", "agent"):
            by_type[ut] = {
                "open": await db.support_tickets.count_documents({"user_type": ut, "status": {"$in": open_statuses}}),
                "resolved": await db.support_tickets.count_documents({"user_type": ut, "status": {"$in": ["resolved", "closed"]}}),
                "sla_breached": await db.support_tickets.count_documents({"user_type": ut, "sla_breached": True, "status": {"$in": open_statuses}}),
            }
        by_priority = {}
        for p in TICKET_PRIORITIES:
            by_priority[p] = await db.support_tickets.count_documents({"priority": p, "status": {"$in": open_statuses}})
        agents = await db.users.find(
            {"role": {"$in": list(SUPPORT_CATEGORY_ROLES)}, "active": {"$ne": False}},
            {"_id": 0, "id": 1, "name": 1, "role": 1},
        ).to_list(100)
        agent_stats = []
        for a in agents:
            if not has_perm(current, "support.analytics.view") and a["id"] != current["id"]:
                continue
            agent_stats.append({
                "id": a["id"],
                "name": a.get("name"),
                "role": normalize_support_role(a.get("role")),
                "open": await db.support_tickets.count_documents({"assignee_id": a["id"], "status": {"$in": open_statuses}}),
                "resolved": await db.support_tickets.count_documents({"assignee_id": a["id"], "status": {"$in": ["resolved", "closed"]}}),
                "sla_breached": await db.support_tickets.count_documents({"assignee_id": a["id"], "sla_breached": True}),
            })
        return {
            "by_user_type": by_type,
            "by_priority": by_priority,
            "agents": agent_stats,
            "escalated_open": await db.support_tickets.count_documents({"escalated": True, "status": {"$in": open_statuses}}),
            "ai_escalated": await db.support_tickets.count_documents({"ai_status": "ai_escalated"}),
            "ai_resolved": await db.support_tickets.count_documents({"ai_status": "ai_resolved"}),
        }

    @api_router.get("/support/audit")
    async def support_audit(
        limit: int = Query(100, ge=1, le=300),
        ticket_id: Optional[str] = None,
        current: dict = Depends(get_current_user),
    ):
        _require_perm(current, "support.audit.view")
        q: Dict[str, Any] = {
            "$or": [
                {"action": {"$regex": "^support_"}},
                {"meta.actor_type": "support"},
            ]
        }
        if ticket_id:
            q = {"$and": [q, {"$or": [{"meta.ticket_id": ticket_id}, {"details": {"$regex": ticket_id}}]}]}
        items = await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return {"logs": items}

    @api_router.post("/support/ai/chat")
    async def support_ai_chat(inp: AiChatIn, current: dict = Depends(get_current_user)):
        if is_support_category(current):
            raise HTTPException(status_code=400, detail="AI Help is for business users; use the Support Dashboard")

        cfg = await _get_ai_config()
        if not cfg.get("enabled", True):
            return {
                "ok": True,
                "reply": "AI Support is temporarily unavailable. Please open a ticket from Support Center.",
                "escalate": True,
                "classification": {
                    "user_type": user_type_from_role(current.get("role")),
                    "category": "other",
                    "intent": "ai_disabled",
                    "priority": "Medium",
                    "requires_human": True,
                },
                "ticket": None,
            }

        role = current.get("role") or "user"
        utype = user_type_from_role(role)
        faqs = FAQ_BY_ROLE.get(role) or FAQ_BY_ROLE.get("influencer") or []
        faq_text = "\n".join(f"Q: {f['question']}\nA: {f['answer']}" for f in faqs)
        kb_articles = await db.support_kb.find({"active": True}, {"_id": 0, "title": 1, "body": 1}).to_list(50)
        kb_extra = "\n".join(f"- {a.get('title')}: {a.get('body')}" for a in kb_articles)
        kb_text = f"{KNOWLEDGE_BASE}\n{kb_extra}".strip()

        history_lines = []
        max_h = int(cfg.get("max_history") or 10)
        for h in (inp.history or [])[-max_h]:
            r = h.get("role") or "user"
            c = (h.get("content") or "").strip()
            if c:
                history_lines.append(f"{r}: {c}")

        system = (
            "You are flugr first-line AI Support. Be concise and accurate. "
            "Use ONLY the knowledge base. If you cannot help confidently, say so and "
            "end with the exact line: ESCALATE_TICKET=yes. "
            f"The user category is {utype}."
        )
        prompt = (
            f"User type: {utype}\nRole: {role}\nName: {current.get('name')}\n\n"
            f"KNOWLEDGE BASE:\n{kb_text}\n\nFAQs:\n{faq_text}\n\n"
            f"Conversation:\n" + ("\n".join(history_lines) + "\n" if history_lines else "")
            + f"user: {inp.message.strip()}\nassistant:"
        )

        reply = None
        escalate = False
        classification = {
            "user_type": utype,
            "category": "other",
            "intent": "general",
            "priority": "Medium",
            "requires_human": False,
        }
        msg_l = inp.message.lower()
        if any(k in msg_l for k in ("pay", "escrow", "wallet", "payout")):
            classification["category"] = "payment"
            classification["intent"] = "payment_issue"
            classification["priority"] = "High"
        elif any(k in msg_l for k in ("campaign", "brief", "deliverable")):
            classification["category"] = "campaign"
            classification["intent"] = "campaign_issue"
            classification["priority"] = "High"
        elif any(k in msg_l for k in ("profile", "edit", "login", "password")):
            classification["category"] = "profile"
            classification["intent"] = "edit_profile"
            classification["priority"] = "Medium"

        if call_llm:
            try:
                reply = (await call_llm(system, prompt) or "").strip()
            except Exception as e:
                logger.warning("support AI LLM failed: %s", e)

        if not reply:
            for f in faqs:
                keys = [w for w in re.split(r"\W+", f["question"].lower()) if len(w) > 3]
                if sum(1 for k in keys if k in msg_l) >= 2:
                    reply = f["answer"] + "\n\nIf you still need help, I can open a support ticket."
                    break
            if not reply:
                reply = (
                    "I couldn't resolve this from the flugr knowledge base. "
                    "I can escalate to our Support Operations team."
                )
                escalate = True

        if "ESCALATE_TICKET=yes" in (reply or ""):
            escalate = True
            reply = reply.replace("ESCALATE_TICKET=yes", "").strip()
        if not cfg.get("auto_escalate", True):
            escalate = False
        classification["requires_human"] = escalate

        # Persist AI session
        prev = await db.support_ai_sessions.find_one({"user_id": current["id"]})
        messages = list((prev or {}).get("messages") or [])
        messages.extend([
            {"role": "user", "content": inp.message, "at": now_iso()},
            {"role": "assistant", "content": reply, "at": now_iso()},
        ])
        messages = messages[-40:]
        await db.support_ai_sessions.update_one(
            {"user_id": current["id"]},
            {
                "$set": {"updated_at": now_iso(), "last_message": inp.message[:500], "messages": messages,
                         "user_type": utype, "classification": classification},
                "$setOnInsert": {"id": f"ais_{uuid.uuid4().hex[:10]}", "user_id": current["id"], "created_at": now_iso()},
            },
            upsert=True,
        )

        ticket = None
        if escalate and inp.create_ticket_if_needed:
            cat_map = {"payment": "Payment", "campaign": "Campaign", "profile": "Profile", "other": "Other"}
            doc = await _create_ticket_internal(
                current,
                TicketCreate(
                    subject=(inp.message.strip()[:80] or "AI escalated help request"),
                    category=cat_map.get(classification["category"], "Other"),
                    priority=classification["priority"] if classification["priority"] in TICKET_PRIORITIES else "Medium",
                    description=f"Auto-created from AI Support.\n\nUser ({utype}):\n{inp.message.strip()}\n\nAI:\n{reply}",
                    tags=[utype, "ai-escalated"],
                ),
                ai_status="ai_escalated",
                ai_conversation=messages[-12:],
                ai_classification=classification,
            )
            ticket = _public_ticket(doc)
            await _audit(current, "support_ai_escalation", ticket_id=doc["id"], meta=classification)

        return {
            "ok": True,
            "reply": reply,
            "escalate": escalate,
            "classification": classification,
            "ticket": ticket,
        }

    @api_router.post("/support/tickets/{ticket_id}/ai-draft")
    async def support_ai_draft(ticket_id: str, inp: AiDraftIn, current: dict = Depends(get_current_user)):
        _require_perm(current, "support.tickets.reply")
        ticket = await _get_ticket_or_404(ticket_id)
        msgs = await db.support_messages.find(
            {"ticket_id": ticket_id, "internal": {"$ne": True}}, {"_id": 0},
        ).sort("created_at", 1).to_list(80)
        thread = "\n".join(f"{m.get('author_role')}: {m.get('body')}" for m in msgs)
        system = "You are a flugr Support Operations agent. Draft a short professional reply. No markdown headings."
        prompt = (
            f"Ticket {ticket.get('number')} | type={ticket.get('user_type')} | {ticket.get('category')} | {ticket.get('priority')}\n"
            f"Subject: {ticket.get('subject')}\n\nThread:\n{thread}\n\n"
            f"Instruction: {inp.instruction or 'Be empathetic and propose next steps.'}\nDraft:"
        )
        draft = None
        if call_llm:
            try:
                draft = (await call_llm(system, prompt) or "").strip()
            except Exception as e:
                logger.warning("ai-draft failed: %s", e)
        if not draft:
            draft = (
                f"Hi {ticket.get('user_name') or 'there'},\n\n"
                f"Thanks for contacting flugr Support about \"{ticket.get('subject')}\". "
                "We're looking into this and will update you shortly.\n\n— flugr Support Operations"
            )
        await _touch_last_active(current)
        return {"ok": True, "draft": draft}

    return ensure_indexes, seed_support_users
