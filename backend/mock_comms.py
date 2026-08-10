"""
Mock conversations, messages, and invitations for demo accounts.
Tagged with mock=True so they can be cleared/reseeded safely.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple


def _now(offset_minutes: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=offset_minutes)).isoformat()


def _uname(u: dict) -> str:
    return (u.get("username") or u.get("handle") or u.get("name") or "user").lstrip("@").rstrip(".,")


async def _by_email(db, email: str) -> Optional[dict]:
    return await db.users.find_one({"email": email.lower()}, {"password_hash": 0, "two_fa_secret": 0})


async def _first_role(db, role: str, exclude_id: Optional[str] = None) -> Optional[dict]:
    q: Dict[str, Any] = {"role": role}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.users.find_one(q, {"password_hash": 0, "two_fa_secret": 0})


async def clear_mock_comms(db) -> Dict[str, int]:
    r1 = await db.messages.delete_many({"mock": True})
    r2 = await db.conversations.delete_many({"mock": True})
    r3 = await db.invitations.delete_many({"mock": True})
    return {
        "messages": r1.deleted_count,
        "conversations": r2.deleted_count,
        "invitations": r3.deleted_count,
    }


async def _ensure_dm(
    db,
    a: dict,
    b: dict,
    *,
    title: str,
    brand: str,
    messages: List[Tuple[str, str, int]],
) -> str:
    """messages: list of (sender_key 'a'|'b', content, minutes_ago)."""
    ids = sorted([a["id"], b["id"]])
    existing = await db.conversations.find_one({
        "mock": True,
        "kind": "dm",
        "participant_ids": {"$all": ids},
    })
    if existing:
        convo_id = existing["id"]
    else:
        owner = a if a.get("role") in ("owner", "admin", "agent") else b
        creator = b if owner["id"] == a["id"] else a
        if creator.get("role") not in ("influencer", None) and a.get("role") == "influencer":
            creator = a
            owner = b
        convo_id = f"mock_convo_{uuid.uuid4().hex[:10]}"
        await db.conversations.insert_one({
            "id": convo_id,
            "kind": "dm",
            "mock": True,
            "campaign_id": None,
            "campaign_title": title,
            "campaign_brand": brand,
            "owner_id": owner["id"],
            "creator_id": creator["id"],
            "brand_id": owner["id"] if owner.get("role") == "owner" else None,
            "agent_id": owner["id"] if owner.get("role") == "agent" else None,
            "participant_ids": [a["id"], b["id"]],
            "created_at": _now(max(m[2] for m in messages) + 30),
            "last_at": _now(min(m[2] for m in messages)),
            "pinned": False,
            "archived_by": [],
        })

    for sender_key, content, mins in messages:
        sender = a if sender_key == "a" else b
        exists = await db.messages.find_one({
            "mock": True,
            "conversation_id": convo_id,
            "content": content,
            "sender_id": sender["id"],
        })
        if exists:
            continue
        await db.messages.insert_one({
            "id": f"mock_msg_{uuid.uuid4().hex[:10]}",
            "conversation_id": convo_id,
            "sender_id": sender["id"],
            "sender_name": sender.get("name") or sender.get("company") or "User",
            "sender_role": sender.get("role") or "influencer",
            "content": content,
            "media_url": None,
            "media_type": None,
            "reply_to_id": None,
            "created_at": _now(mins),
            "read_by": [sender["id"]],
            "edited": False,
            "deleted": False,
            "mock": True,
        })
    await db.conversations.update_one(
        {"id": convo_id},
        {"$set": {"last_at": _now(min(m[2] for m in messages))}},
    )
    return convo_id


async def _ensure_invitation(
    db,
    *,
    owner: dict,
    creator: dict,
    campaign_title: str,
    campaign_brand: str,
    offer: int,
    message: str,
    status: str = "pending",
    minutes_ago: int = 120,
) -> None:
    existing = await db.invitations.find_one({
        "mock": True,
        "owner_id": owner["id"],
        "creator_id": creator["id"],
        "campaign_title": campaign_title,
    })
    if existing:
        return
    camp = await db.campaigns.find_one({"owner_id": owner["id"]}) or await db.campaigns.find_one({})
    campaign_id = camp["id"] if camp else f"mock_camp_{uuid.uuid4().hex[:8]}"
    if not camp:
        # ephemeral campaign stub so invitation enrichment has a title
        await db.campaigns.insert_one({
            "id": campaign_id,
            "title": campaign_title,
            "brand": campaign_brand,
            "description": "Mock campaign for demo invitations.",
            "budget": offer,
            "niches": ["Lifestyle & Home"],
            "platforms": ["instagram"],
            "deliverables": "1 Reel + 2 Stories",
            "owner_id": owner["id"],
            "status": "active",
            "created_at": _now(minutes_ago + 60),
            "mock": True,
        })
    await db.invitations.insert_one({
        "id": f"mock_inv_{uuid.uuid4().hex[:10]}",
        "campaign_id": campaign_id,
        "campaign_title": campaign_title,
        "campaign_brand": campaign_brand,
        "creator_id": creator["id"],
        "creator_name": creator.get("name") or "Creator",
        "creator_handle": _uname(creator),
        "owner_id": owner["id"],
        "brand_id": owner["id"],
        "offer": offer,
        "message": message,
        "status": status,
        "counter_offer": None,
        "note": None,
        "created_at": _now(minutes_ago),
        "mock": True,
    })


async def seed_mock_comms(db, logger=None, target_user=None) -> Dict[str, Any]:
    """Seed cross-role mock DMs + invitations for demo accounts."""
    admin = await _by_email(db, "admin@cr8.studio") or await _first_role(db, "admin")
    creator = await _by_email(db, "creator@cr8.studio") or await _first_role(db, "influencer")
    company = (
        await _by_email(db, "company@cr8.studio")
        or await _by_email(db, "studio@cr8.studio")
        or await _first_role(db, "owner")
    )
    agent = await _by_email(db, "agent@cr8.studio") or await _first_role(db, "agent")
    studio = await _by_email(db, "studio@cr8.studio") or company

    if target_user:
        role = target_user.get("role")
        if role == "admin":
            admin = target_user
        elif role == "influencer":
            creator = target_user
        elif role == "owner":
            company = target_user
            studio = target_user
        elif role == "agent":
            agent = target_user

    if not admin or not creator or not company:
        if logger:
            logger.warning("mock_comms: missing admin/creator/company — skipped")
        return {"ok": False, "reason": "missing_users"}

    # Creator ↔ Company
    await _ensure_dm(
        db, company, creator,
        title="Summer Drop Collab",
        brand=company.get("company") or company.get("name") or "Brand",
        messages=[
            ("a", "Hi! Loved your recent reels — we'd love you on our Summer Drop brief.", 180),
            ("b", "Thanks! Happy to review. What's the deliverable mix and timeline?", 160),
            ("a", "1 Reel + 2 Stories, 10-day turnaround. Offer ₹45,000 via escrow.", 140),
            ("b", "That works. Please send the invitation and product brief.", 120),
            ("a", "Invitation sent from Invitations. Looking forward to locking this in!", 90),
        ],
    )

    # Creator ↔ Admin
    await _ensure_dm(
        db, admin, creator,
        title="Account Support",
        brand="CR8 Studio",
        messages=[
            ("a", "Welcome to CR8. Your creator studio is verified and ready for briefs.", 400),
            ("b", "Thanks Admin! Can you confirm escrow withdrawals are enabled?", 380),
            ("a", "Yes — wallet payouts are live. Ping us anytime if a brand brief looks off.", 360),
        ],
    )

    # Company ↔ Admin
    await _ensure_dm(
        db, admin, company,
        title="Brand Desk Support",
        brand="CR8 Studio",
        messages=[
            ("a", "Brand desk tip: invite creators from Campaign → Send invitation for faster matching.", 420),
            ("b", "Got it. We'll shortlist creators this week for the flagship launch.", 400),
            ("a", "Great. Escrow treasury is funded — you're clear to extend offers.", 380),
        ],
    )

    if agent:
        await _ensure_dm(
            db, company, agent,
            title="Agency Roster Intro",
            brand=company.get("company") or "Brand",
            messages=[
                ("b", "Sharing two roster creators available for your Q3 tech showcase.", 300),
                ("a", "Please send rates for YouTube integration + usage rights.", 280),
                ("b", "Base ₹1,20,000 with 90-day licensing. Shall I open a DM with the creator?", 260),
            ],
        )
        await _ensure_dm(
            db, admin, agent,
            title="Agency Verification",
            brand="CR8 Studio",
            messages=[
                ("a", "Agency verification complete. You can pitch roster talent to brand desks.", 500),
                ("b", "Appreciate it — uploading updated rate cards today.", 480),
            ],
        )

    if studio and studio["id"] != company["id"]:
        await _ensure_dm(
            db, studio, creator,
            title="Studio Noir Retainer",
            brand=studio.get("company") or "Studio Noir",
            messages=[
                ("a", "We're opening a monthly retainer for lifestyle creators. Interested?", 220),
                ("b", "Yes — share expected posts/month and exclusivity terms.", 200),
            ],
        )

    # Campaign invitations (visible to creators as received; companies as extended)
    await _ensure_invitation(
        db,
        owner=company,
        creator=creator,
        campaign_title="Summer Drop — Reel + Stories",
        campaign_brand=company.get("company") or "Acme Brand",
        offer=45000,
        message="We think you're a perfect fit for our Summer Drop. 1 Reel + 2 Stories.",
        status="pending",
        minutes_ago=100,
    )
    await _ensure_invitation(
        db,
        owner=company,
        creator=creator,
        campaign_title="Festive Lookbook Capsule",
        campaign_brand=company.get("company") or "Acme Brand",
        offer=75000,
        message="Flagship festive lookbook — 2 Reels, full product seeding included.",
        status="accepted",
        minutes_ago=2400,
    )
    if studio and studio["id"] != company["id"]:
        extra_creator = await _first_role(db, "influencer", exclude_id=creator["id"]) or creator
        await _ensure_invitation(
            db,
            owner=studio,
            creator=extra_creator,
            campaign_title="Noir Atelier — Brand Film",
            campaign_brand=studio.get("company") or "Studio Noir",
            offer=120000,
            message="Short brand film cameo + IG carousel. Premium usage rights.",
            status="pending",
            minutes_ago=60,
        )

    # Extra creator invitations so company desk looks populated
    other_creators = await db.users.find(
        {"role": "influencer", "id": {"$ne": creator["id"]}},
        {"password_hash": 0},
    ).limit(3).to_list(3)
    for idx, c in enumerate(other_creators):
        await _ensure_invitation(
            db,
            owner=company,
            creator=c,
            campaign_title=["UGC Pack — 5 Assets", "Launch Teaser Stories", "Creator AMA Live"][idx % 3],
            campaign_brand=company.get("company") or "Acme Brand",
            offer=[28000, 35000, 55000][idx % 3],
            message="Shortlisted from marketplace. Review offer and respond when ready.",
            status=["pending", "pending", "rejected"][idx % 3],
            minutes_ago=80 + idx * 40,
        )

    if logger:
        logger.info("mock_comms: seeded DMs + invitations for demo roles")
    return {"ok": True, "admin": bool(admin), "creator": bool(creator), "company": bool(company), "agent": bool(agent)}


async def ensure_mock_comms_if_empty(db, current: dict, logger=None) -> bool:
    """If the current user has no conversations, seed global mock comms once."""
    user_id = current.get("id")
    role = current.get("role")
    if role == "admin":
        count = await db.conversations.count_documents({"mock": True})
    else:
        count = await db.conversations.count_documents({
            "$or": [
                {"owner_id": user_id},
                {"creator_id": user_id},
                {"brand_id": user_id},
                {"agent_id": user_id},
                {"participant_ids": user_id},
            ]
        })
    if count > 0:
        return False
    await seed_mock_comms(db, logger=logger, target_user=current)
    return True
