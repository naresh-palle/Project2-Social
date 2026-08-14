"""
CR8 Support & AI Ticket Management System
Mounted onto the main API router by server.py.

Roles:
  - support         — agent who can view queue, reply, update status
  - support_admin   — can assign, escalate, close any ticket + manage queue
  - admin           — full access (existing)

User flows:
  - Any authenticated user can create tickets and chat with AI help
  - AI can suggest escalating to a ticket; optional auto-create
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Literal, Callable, Awaitable

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

SUPPORT_STAFF_ROLES = ("support", "support_admin", "admin")
TICKET_CATEGORIES = ("Payment", "Account", "Technical Bug", "Dispute", "Other")
TICKET_PRIORITIES = ("Low", "Medium", "High", "Urgent")
TICKET_STATUSES = ("open", "in_progress", "waiting_user", "resolved", "closed")

KNOWLEDGE_BASE = """
CR8 Studio is an influencer marketplace connecting brands (owners), creators (influencers), and agencies (agents).

Payments & escrow:
- Brands fund campaign escrow via wallet / Stripe-style flows.
- Creators are paid after deliverable approval; platform commission is deducted from payouts.
- Refunds return escrow to the brand wallet when campaigns cancel.

Matching:
- Matching uses niche, audience, past performance, and campaign requirements.
- Creator levels (Rising / Pro / Elite) unlock premium campaigns.

Disputes:
- Users can open a Dispute ticket from Support for rejected deliverables or payment issues.
- Support staff review briefs, messages, and deliverables before deciding.

Accounts:
- Roles: owner (brand), influencer (creator), agent (agency), admin, support, support_admin.
- Demo logins use password demo1234 for creator@ / company@ / agent@ cr8.studio.
- Profile edit supports Apify social scrape for Instagram / YouTube / Facebook.

AI Help:
- The CR8 Assistant answers product questions using this knowledge base.
- If unsure, it should recommend opening a support ticket at /support.
"""

FAQ_BY_ROLE = {
    "influencer": [
        {"question": "How do I get paid?", "answer": "Once a campaign deliverable is approved, funds move from escrow to your wallet and can be withdrawn within 3–5 business days."},
        {"question": "How does matching work?", "answer": "We pair creators with brands using niche, audience fit, past performance, and campaign requirements."},
        {"question": "Can I dispute a rejection?", "answer": "Yes. Open a Dispute ticket in Support with the campaign link and our team will review."},
        {"question": "Do I pay a platform fee?", "answer": "No upfront fee. A platform commission is deducted from the final payout and shown before you accept."},
    ],
    "owner": [
        {"question": "How do I fund escrow?", "answer": "Add funds to your brand wallet, then lock escrow when launching a campaign."},
        {"question": "Can I rehire a creator?", "answer": "Yes — rehire from any completed campaign; loyalty discounts may apply."},
        {"question": "What if a creator misses a deadline?", "answer": "The campaign can be canceled and escrow returned to your wallet."},
        {"question": "How many revision rounds?", "answer": "Brands typically get up to two revision rounds before final approval."},
    ],
    "agent": [
        {"question": "How do agency approvals work?", "answer": "New agencies wait for admin approval before accessing full marketplace tools."},
        {"question": "Can I manage multiple creators?", "answer": "Yes — approved agencies can represent creators and coordinate briefs from the Agency Desk."},
    ],
    "admin": [
        {"question": "How do I resolve disputes?", "answer": "Use Support Desk tickets with category Dispute, or promote a support_admin to own the queue."},
        {"question": "How do I manage payouts?", "answer": "Review Wallet / Transactions in Admin; support tickets of type Payment should be linked to the user id."},
    ],
    "support": [
        {"question": "How do I take a ticket?", "answer": "Open the ticket and set status to In Progress — you become the assignee."},
        {"question": "When should I escalate?", "answer": "Escalate payment disputes over ₹50k or policy exceptions to support_admin."},
    ],
    "support_admin": [
        {"question": "How do I assign agents?", "answer": "Patch the ticket with assignee_id of a support user."},
        {"question": "Can I close tickets?", "answer": "Yes — set status to resolved or closed after the user confirms."},
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


def is_support_staff(user: dict) -> bool:
    return (user or {}).get("role") in SUPPORT_STAFF_ROLES


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
    class TicketCreate(BaseModel):
        subject: str = Field(min_length=3, max_length=200)
        category: Literal["Payment", "Account", "Technical Bug", "Dispute", "Other"] = "Other"
        priority: Literal["Low", "Medium", "High", "Urgent"] = "Medium"
        description: str = Field(min_length=5, max_length=8000)
        campaign_id: Optional[str] = None

    class TicketPatch(BaseModel):
        status: Optional[Literal["open", "in_progress", "waiting_user", "resolved", "closed"]] = None
        priority: Optional[Literal["Low", "Medium", "High", "Urgent"]] = None
        assignee_id: Optional[str] = None
        internal_note: Optional[str] = Field(default=None, max_length=4000)

    class TicketMessageIn(BaseModel):
        body: str = Field(min_length=1, max_length=8000)
        internal: bool = False  # staff-only note

    class AiChatIn(BaseModel):
        message: str = Field(min_length=1, max_length=4000)
        history: List[Dict[str, str]] = Field(default_factory=list)
        create_ticket_if_needed: bool = False

    class AiDraftIn(BaseModel):
        instruction: Optional[str] = Field(default=None, max_length=1000)

    async def _audit(**kwargs):
        if write_audit_log:
            # Normalize to write_audit_log(user_id=..., action=..., ...)
            payload = dict(kwargs)
            if "actor_id" in payload and "user_id" not in payload:
                payload["user_id"] = payload.pop("actor_id")
            payload.pop("target_type", None)
            payload.pop("target_id", None)
            try:
                await write_audit_log(**payload)
            except TypeError:
                await write_audit_log(
                    action=payload.get("action", "support"),
                    user_id=payload.get("user_id"),
                    meta=payload.get("meta"),
                    details=str(payload.get("meta") or ""),
                )

    async def _notify(user_id: str, title: str, body: str, link: str = "/support"):
        if push_notification:
            try:
                await push_notification(user_id, "support", f"{title}: {body}", {"link": link})
            except Exception as e:
                logger.warning("support notify failed: %s", e)

    async def ensure_indexes():
        await db.support_tickets.create_index("id", unique=True)
        await db.support_tickets.create_index([("user_id", 1), ("created_at", -1)])
        await db.support_tickets.create_index([("status", 1), ("priority", 1), ("updated_at", -1)])
        await db.support_tickets.create_index([("assignee_id", 1), ("status", 1)])
        await db.support_messages.create_index("id", unique=True)
        await db.support_messages.create_index([("ticket_id", 1), ("created_at", 1)])
        await db.support_ai_sessions.create_index("id", unique=True)
        await db.support_ai_sessions.create_index([("user_id", 1), ("updated_at", -1)])

    async def seed_support_users():
        demo_hash = hash_password("demo1234")
        seeds = [
            {
                "email": "support@cr8.studio",
                "username": "supportagent",
                "name": "CR8 Support",
                "role": "support",
                "handle": "@support",
            },
            {
                "email": "support.admin@cr8.studio",
                "username": "supportadmin",
                "name": "CR8 Support Admin",
                "role": "support_admin",
                "handle": "@support.admin",
            },
        ]
        for s in seeds:
            existing = await db.users.find_one({"email": s["email"]})
            base = {
                "password_hash": demo_hash,
                "name": s["name"],
                "username": s["username"],
                "role": s["role"],
                "handle": s["handle"],
                "company": "CR8 Studio",
                "bio": "Support desk",
                "verified": True,
                "wallet": 0,
                "onboarding_status": "completed",
                "agent_approved": True,
                "avatar": None,
                "niches": [],
                "platforms": [],
            }
            if not existing:
                await db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "email": s["email"],
                    "created_at": now_iso(),
                    **base,
                })
                logger.info("Seeded support user %s", s["email"])
            else:
                await db.users.update_one(
                    {"email": s["email"]},
                    {"$set": base},
                )

    def _public_ticket(doc: dict, include_internal: bool = False) -> dict:
        t = clean(doc) if clean else _clean_doc(doc)
        if not t:
            return {}
        if not include_internal:
            t.pop("internal_notes", None)
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
        return f"T-{1000 + count + 1}"

    async def _create_ticket_internal(current: dict, inp: TicketCreate) -> dict:
        ticket_id = f"tkt_{uuid.uuid4().hex[:12]}"
        number = await _next_ticket_number()
        now = now_iso()
        doc = {
            "id": ticket_id,
            "number": number,
            "user_id": current["id"],
            "user_name": current.get("name") or current.get("username") or current.get("email"),
            "user_email": current.get("email"),
            "user_role": current.get("role"),
            "subject": inp.subject.strip(),
            "category": inp.category,
            "priority": inp.priority,
            "description": inp.description.strip(),
            "campaign_id": inp.campaign_id,
            "status": "open",
            "assignee_id": None,
            "assignee_name": None,
            "internal_notes": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.support_tickets.insert_one(doc)
        msg = {
            "id": f"smsg_{uuid.uuid4().hex[:12]}",
            "ticket_id": ticket_id,
            "author_id": current["id"],
            "author_name": doc["user_name"],
            "author_role": current.get("role"),
            "body": inp.description.strip(),
            "internal": False,
            "created_at": now,
        }
        await db.support_messages.insert_one(msg)
        staff = await db.users.find(
            {"role": {"$in": ["support", "support_admin"]}},
            {"_id": 0, "id": 1},
        ).to_list(20)
        for s in staff:
            await _notify(s["id"], f"New ticket {number}", inp.subject, link="/support")
        await _audit(
            actor_id=current["id"],
            action="support_ticket_created",
            target_type="support_ticket",
            target_id=ticket_id,
            meta={"number": number, "category": inp.category, "priority": inp.priority},
        )
        return doc

    @api_router.get("/support/faqs")
    async def support_faqs(current: dict = Depends(get_current_user)):
        role = current.get("role") or "influencer"
        faqs = FAQ_BY_ROLE.get(role) or FAQ_BY_ROLE["influencer"]
        return {"role": role, "faqs": faqs}

    @api_router.get("/support/stats")
    async def support_stats(current: dict = Depends(get_current_user)):
        await require_role(current, list(SUPPORT_STAFF_ROLES))
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        open_n = await db.support_tickets.count_documents({"status": {"$in": ["open", "in_progress", "waiting_user"]}})
        urgent = await db.support_tickets.count_documents({"status": {"$in": ["open", "in_progress"]}, "priority": "Urgent"})
        mine = await db.support_tickets.count_documents({"assignee_id": current["id"], "status": {"$nin": ["closed", "resolved"]}})
        resolved_today = await db.support_tickets.count_documents({
            "status": {"$in": ["resolved", "closed"]},
            "updated_at": {"$gte": day_start},
        })
        # Tickets this agent personally finished today
        finished_today_by_me = await db.support_tickets.count_documents({
            "assignee_id": current["id"],
            "status": {"$in": ["resolved", "closed"]},
            "updated_at": {"$gte": day_start},
        })
        return {
            "open": open_n,
            "urgent": urgent,
            "assigned_to_me": mine,
            "resolved_today": resolved_today,
            "finished_today_by_me": finished_today_by_me,
        }

    @api_router.get("/support/agents")
    async def list_support_agents(current: dict = Depends(get_current_user)):
        await require_role(current, ["support_admin", "admin"])
        cursor = db.users.find(
            {"role": {"$in": ["support", "support_admin", "admin"]}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "avatar": 1},
        )
        return {"agents": await cursor.to_list(100)}

    @api_router.post("/support/tickets")
    async def create_ticket(inp: TicketCreate, current: dict = Depends(get_current_user)):
        doc = await _create_ticket_internal(current, inp)
        return {"ok": True, "ticket": _public_ticket(doc, include_internal=False)}

    @api_router.get("/support/tickets")
    async def list_tickets(
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        q: Optional[str] = None,
        mine: bool = False,
        limit: int = Query(50, ge=1, le=200),
        current: dict = Depends(get_current_user),
    ):
        query: Dict[str, Any] = {}
        if is_support_staff(current):
            if mine:
                query["assignee_id"] = current["id"]
        else:
            query["user_id"] = current["id"]

        if status:
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            if statuses:
                query["status"] = {"$in": statuses}
        if priority:
            query["priority"] = priority
        if category:
            query["category"] = category
        if q:
            rx = {"$regex": re.escape(q.strip()), "$options": "i"}
            query["$or"] = [{"subject": rx}, {"number": rx}, {"user_name": rx}, {"user_email": rx}]

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
        msgs = await db.support_messages.find(
            {"ticket_id": ticket_id, **({} if staff else {"internal": {"$ne": True}})},
            {"_id": 0},
        ).sort("created_at", 1).to_list(500)
        return {
            "ticket": _public_ticket(ticket, include_internal=staff),
            "messages": [clean(m) if clean else _clean_doc(m) for m in msgs],
            "staff": staff,
        }

    @api_router.post("/support/tickets/{ticket_id}/messages")
    async def post_ticket_message(
        ticket_id: str,
        inp: TicketMessageIn,
        current: dict = Depends(get_current_user),
    ):
        ticket = await _get_ticket_or_404(ticket_id)
        await _assert_ticket_access(ticket, current, write=True)
        staff = is_support_staff(current)
        if inp.internal and not staff:
            raise HTTPException(status_code=403, detail="Internal notes are staff-only")

        now = now_iso()
        msg = {
            "id": f"smsg_{uuid.uuid4().hex[:12]}",
            "ticket_id": ticket_id,
            "author_id": current["id"],
            "author_name": current.get("name") or current.get("username"),
            "author_role": current.get("role"),
            "body": inp.body.strip(),
            "internal": bool(inp.internal and staff),
            "created_at": now,
        }
        await db.support_messages.insert_one(msg)

        updates: Dict[str, Any] = {"updated_at": now}
        if staff and not inp.internal:
            if ticket.get("status") == "open":
                updates["status"] = "in_progress"
            if not ticket.get("assignee_id"):
                updates["assignee_id"] = current["id"]
                updates["assignee_name"] = current.get("name")
            # waiting on user after staff reply
            if ticket.get("status") in ("open", "in_progress", "waiting_user"):
                updates["status"] = "waiting_user"
        elif not staff:
            if ticket.get("status") == "waiting_user":
                updates["status"] = "in_progress"

        await db.support_tickets.update_one({"id": ticket_id}, {"$set": updates})

        # Notify the other party
        if staff and not inp.internal:
            await _notify(ticket["user_id"], f"Update on {ticket.get('number')}", "Support replied to your ticket.")
        elif not staff and ticket.get("assignee_id"):
            await _notify(ticket["assignee_id"], f"Reply on {ticket.get('number')}", "User replied to the ticket.")

        return {"ok": True, "message": clean(msg) if clean else _clean_doc(msg)}

    @api_router.patch("/support/tickets/{ticket_id}")
    async def patch_ticket(
        ticket_id: str,
        inp: TicketPatch,
        current: dict = Depends(get_current_user),
    ):
        ticket = await _get_ticket_or_404(ticket_id)
        staff = is_support_staff(current)
        # Users may only reopen/close their own in limited ways
        if not staff:
            await _assert_ticket_access(ticket, current)
            if inp.assignee_id or inp.internal_note or (inp.priority and inp.priority != ticket.get("priority")):
                raise HTTPException(status_code=403, detail="Only support staff can change that field")
            if inp.status and inp.status not in ("closed", "open"):
                raise HTTPException(status_code=403, detail="Invalid status for user")
        else:
            await require_role(current, list(SUPPORT_STAFF_ROLES))

        updates: Dict[str, Any] = {"updated_at": now_iso()}
        if inp.status:
            updates["status"] = inp.status
        if inp.priority and staff:
            updates["priority"] = inp.priority
        if inp.assignee_id is not None and staff:
            if inp.assignee_id == "":
                updates["assignee_id"] = None
                updates["assignee_name"] = None
            else:
                agent = await db.users.find_one({"id": inp.assignee_id}, {"_id": 0, "id": 1, "name": 1, "role": 1})
                if not agent or agent.get("role") not in SUPPORT_STAFF_ROLES:
                    raise HTTPException(status_code=400, detail="Assignee must be support staff")
                updates["assignee_id"] = agent["id"]
                updates["assignee_name"] = agent.get("name")
                if ticket.get("status") == "open":
                    updates["status"] = "in_progress"

        if inp.internal_note and staff:
            note = {
                "id": f"note_{uuid.uuid4().hex[:8]}",
                "author_id": current["id"],
                "author_name": current.get("name"),
                "body": inp.internal_note.strip(),
                "created_at": now_iso(),
            }
            await db.support_tickets.update_one(
                {"id": ticket_id},
                {"$set": updates, "$push": {"internal_notes": note}},
            )
        else:
            await db.support_tickets.update_one({"id": ticket_id}, {"$set": updates})

        await _audit(
            actor_id=current["id"],
            action="support_ticket_updated",
            target_type="support_ticket",
            target_id=ticket_id,
            meta={k: updates[k] for k in updates if k != "updated_at"},
        )
        fresh = await _get_ticket_or_404(ticket_id)
        return {"ok": True, "ticket": _public_ticket(fresh, include_internal=staff)}

    @api_router.post("/support/ai/chat")
    async def support_ai_chat(inp: AiChatIn, current: dict = Depends(get_current_user)):
        role = current.get("role") or "user"
        faqs = FAQ_BY_ROLE.get(role) or FAQ_BY_ROLE["influencer"]
        faq_text = "\n".join(f"Q: {f['question']}\nA: {f['answer']}" for f in faqs)

        history_lines = []
        for h in (inp.history or [])[-8]:
            r = h.get("role") or "user"
            c = (h.get("content") or "").strip()
            if c:
                history_lines.append(f"{r}: {c}")

        system = (
            "You are the CR8 Studio Support AI assistant. Be concise, friendly, and accurate. "
            "Use ONLY the knowledge base and FAQs below. If you cannot help confidently, "
            "say so and recommend opening a support ticket. "
            "If the user clearly needs a human (payments stuck, account ban, dispute), "
            "end with the line: ESCALATE_TICKET=yes"
        )
        prompt = (
            f"User role: {role}\nName: {current.get('name')}\n\n"
            f"KNOWLEDGE BASE:\n{KNOWLEDGE_BASE}\n\n"
            f"FAQs:\n{faq_text}\n\n"
            f"Conversation:\n" + ("\n".join(history_lines) + "\n" if history_lines else "")
            + f"user: {inp.message.strip()}\nassistant:"
        )

        reply = None
        escalate = False
        if call_llm:
            try:
                reply = (await call_llm(system, prompt) or "").strip()
            except Exception as e:
                logger.warning("support AI LLM failed: %s", e)

        if not reply:
            # Deterministic fallback from FAQs
            msg_l = inp.message.lower()
            for f in faqs:
                keys = [w for w in re.split(r"\W+", f["question"].lower()) if len(w) > 3]
                if sum(1 for k in keys if k in msg_l) >= 2:
                    reply = f["answer"] + "\n\nIf you still need help, open a ticket in Support."
                    break
            if not reply:
                reply = (
                    "I couldn't find a confident answer in the CR8 knowledge base. "
                    "Please open a support ticket with details (and a campaign link if relevant) "
                    "and our team will follow up."
                )
                escalate = True

        if "ESCALATE_TICKET=yes" in reply:
            escalate = True
            reply = reply.replace("ESCALATE_TICKET=yes", "").strip()

        ticket = None
        if escalate and inp.create_ticket_if_needed:
            doc = await _create_ticket_internal(
                current,
                TicketCreate(
                    subject=(inp.message.strip()[:80] or "Help request from AI chat"),
                    category="Other",
                    priority="Medium",
                    description=(
                        f"Auto-created from AI Help chat.\n\nUser message:\n{inp.message.strip()}\n\n"
                        f"AI reply:\n{reply}"
                    ),
                ),
            )
            ticket = _public_ticket(doc, include_internal=False)

        # Persist lightweight session (simple replace of recent messages)
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
                "$set": {
                    "updated_at": now_iso(),
                    "last_message": inp.message[:500],
                    "messages": messages,
                },
                "$setOnInsert": {
                    "id": f"ais_{uuid.uuid4().hex[:10]}",
                    "user_id": current["id"],
                    "created_at": now_iso(),
                },
            },
            upsert=True,
        )

        return {
            "ok": True,
            "reply": reply,
            "escalate": escalate,
            "ticket": ticket,
        }

    @api_router.post("/support/tickets/{ticket_id}/ai-draft")
    async def support_ai_draft(
        ticket_id: str,
        inp: AiDraftIn,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, list(SUPPORT_STAFF_ROLES))
        ticket = await _get_ticket_or_404(ticket_id)
        msgs = await db.support_messages.find(
            {"ticket_id": ticket_id, "internal": {"$ne": True}},
            {"_id": 0},
        ).sort("created_at", 1).to_list(50)
        thread = "\n".join(f"{m.get('author_role')}: {m.get('body')}" for m in msgs)
        system = "You are a CR8 support agent. Draft a short, professional reply to the user. No markdown headings."
        prompt = (
            f"Ticket {ticket.get('number')} | {ticket.get('category')} | {ticket.get('priority')}\n"
            f"Subject: {ticket.get('subject')}\n\nThread:\n{thread}\n\n"
            f"Extra instruction: {inp.instruction or 'Be empathetic and propose next steps.'}\n"
            "Draft:"
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
                f"Thanks for contacting CR8 Support about \"{ticket.get('subject')}\". "
                "We're looking into this and will update you shortly.\n\n— CR8 Support"
            )
        return {"ok": True, "draft": draft}

    return ensure_indexes, seed_support_users
