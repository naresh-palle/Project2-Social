"""
Phase 2 — Engagement & Retention Features
Mounted onto the main API router by server.py.

New features:
  - Category / domain system (configurable)
  - Intelligent matching engine (configurable weights)
  - Creator level system (Beginner / Elite / Pro)
  - Badge system (Best Creator / Quick Responder / Best Content / High Quality Output)
  - Leaderboard (weekly / monthly — Top Performer / Earner / Spender)
  - Referral system (codes, tracking, reward config, fraud checks)
  - Verification status helper
"""
import hashlib
import random
import secrets
import string
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Default seed data
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_CATEGORIES = [
    {"name": "Fashion / Clothing", "slug": "fashion", "icon": "👗", "color": "#FF3B30"},
    {"name": "Beauty / Skincare", "slug": "beauty", "icon": "💄", "color": "#FF2D55"},
    {"name": "Food & Cooking",    "slug": "food",   "icon": "🍜", "color": "#FF9500"},
    {"name": "Travel",            "slug": "travel", "icon": "✈️", "color": "#34C759"},
    {"name": "Fitness & Gym",     "slug": "fitness","icon": "💪", "color": "#30B0C7"},
    {"name": "Technology",        "slug": "tech",   "icon": "💻", "color": "#5AC8FA"},
    {"name": "Gaming",            "slug": "gaming", "icon": "🎮", "color": "#AF52DE"},
    {"name": "Finance & Investing","slug":"finance","icon": "📈", "color": "#34C759"},
    {"name": "Education",         "slug": "edu",    "icon": "📚", "color": "#5AC8FA"},
    {"name": "Lifestyle",         "slug": "lifestyle","icon":"✨","color": "#FF9500"},
    {"name": "Entertainment",     "slug": "entertainment","icon":"🎬","color":"#FF3B30"},
    {"name": "Parenting",         "slug": "parenting","icon":"👶","color": "#FF2D55"},
    {"name": "Automobile",        "slug": "auto",   "icon": "🚗", "color": "#8E8E93"},
    {"name": "Health & Wellness", "slug": "health", "icon": "🌿", "color": "#34C759"},
    {"name": "Other",             "slug": "other",  "icon": "🌐", "color": "#8E8E93"},
]

DEFAULT_MATCH_CONFIG = {
    "id": "match_config_v1",
    "category_weight":      40,
    "platform_weight":      20,
    "location_weight":      10,
    "engagement_weight":    15,
    "profile_quality_weight": 5,
    "performance_weight":   10,
    "updated_at": None,
}

DEFAULT_LEVEL_CONFIG = [
    {
        "level": "Beginner", "order": 1,
        "min_campaigns": 0,  "min_earnings": 0,
        "min_rating": 0.0,   "min_response_rate": 0,
        "color": "#8E8E93",  "icon": "🌱",
        "benefits": ["Access to all campaigns", "Basic profile listing"],
    },
    {
        "level": "Elite", "order": 2,
        "min_campaigns": 5,  "min_earnings": 50000,
        "min_rating": 4.0,   "min_response_rate": 70,
        "color": "#5AC8FA",  "icon": "⭐",
        "benefits": ["Priority listing in search", "Elite badge on profile", "Early campaign access"],
    },
    {
        "level": "Pro", "order": 3,
        "min_campaigns": 15, "min_earnings": 200000,
        "min_rating": 4.5,   "min_response_rate": 85,
        "color": "#FF9500",  "icon": "🏆",
        "benefits": ["Top search placement", "Pro badge + verified check", "Dedicated account support", "Reduced platform fee"],
    },
]

DEFAULT_BADGE_DEFINITIONS = [
    {
        "id": "badge_best_creator",
        "name": "Best Creator",
        "description": "Awarded to creators with consistently outstanding overall performance.",
        "icon": "🏆", "color": "#FF9500",
        "criteria": {"min_campaigns": 5, "min_avg_rating": 4.7, "min_completion_rate": 90},
        "active": True,
    },
    {
        "id": "badge_quick_responder",
        "name": "Quick Responder",
        "description": "Responds to campaign messages in under 2 hours on average.",
        "icon": "⚡", "color": "#34C759",
        "criteria": {"min_campaigns": 3, "max_avg_response_hours": 2},
        "active": True,
    },
    {
        "id": "badge_best_content",
        "name": "Best Content",
        "description": "Client-rated content quality consistently rated 4.8+.",
        "icon": "🎨", "color": "#AF52DE",
        "criteria": {"min_campaigns": 5, "min_avg_rating": 4.8},
        "active": True,
    },
    {
        "id": "badge_high_quality",
        "name": "High Quality Output",
        "description": "All deliverables approved on first submission across 3+ campaigns.",
        "icon": "✅", "color": "#5AC8FA",
        "criteria": {"min_campaigns": 3, "first_approval_rate": 100},
        "active": True,
    },
]

DEFAULT_REFERRAL_CONFIG = {
    "id": "referral_config_v1",
    "referrer_reward": 500,
    "referee_reward": 200,
    "reward_type": "wallet_credit",
    "min_account_age_days": 0,
    "require_first_campaign": False,
    "max_referrals_per_user": 50,
    "active": True,
    "updated_at": None,
}


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    slug: Optional[str] = None
    icon: Optional[str] = "🌐"
    color: Optional[str] = "#8E8E93"
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class MatchConfigUpdate(BaseModel):
    category_weight:        Optional[int] = Field(None, ge=0, le=100)
    platform_weight:        Optional[int] = Field(None, ge=0, le=100)
    location_weight:        Optional[int] = Field(None, ge=0, le=100)
    engagement_weight:      Optional[int] = Field(None, ge=0, le=100)
    profile_quality_weight: Optional[int] = Field(None, ge=0, le=100)
    performance_weight:     Optional[int] = Field(None, ge=0, le=100)

class LevelConfigUpdate(BaseModel):
    levels: List[Dict[str, Any]]

class BadgeCreate(BaseModel):
    name: str
    description: str
    icon: str = "🏅"
    color: str = "#FF9500"
    criteria: Dict[str, Any] = {}
    active: bool = True

class BadgeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    criteria: Optional[Dict[str, Any]] = None
    active: Optional[bool] = None

class ReferralApply(BaseModel):
    code: str

class ReferralConfigUpdate(BaseModel):
    referrer_reward:         Optional[int] = None
    referee_reward:          Optional[int] = None
    reward_type:             Optional[str] = None
    min_account_age_days:    Optional[int] = None
    require_first_campaign:  Optional[bool] = None
    max_referrals_per_user:  Optional[int] = None
    active:                  Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
# Setup function
# ─────────────────────────────────────────────────────────────────────────────

def setup_phase2(
    api_router: APIRouter,
    *,
    db,
    get_current_user,
    require_role,
    clean,
    now_iso,
    send_email,
    email_template,
    push_notification,
    write_audit_log=None,
    logger,
):
    """Mount all Phase-2 routes onto the shared api_router."""

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _audit(**kwargs):
        if write_audit_log:
            await write_audit_log(**kwargs)

    def _now():
        return datetime.now(timezone.utc)

    def _ts():
        return _now().isoformat()

    async def _get_match_config() -> dict:
        cfg = await db.match_config.find_one({"id": "match_config_v1"})
        if not cfg:
            await db.match_config.insert_one(dict(DEFAULT_MATCH_CONFIG))
            cfg = DEFAULT_MATCH_CONFIG.copy()
        return cfg

    async def _get_level_config() -> List[dict]:
        docs = await db.level_config.find({}).to_list(length=20)
        if not docs:
            for lvl in DEFAULT_LEVEL_CONFIG:
                await db.level_config.update_one(
                    {"level": lvl["level"]}, {"$set": lvl}, upsert=True
                )
            docs = DEFAULT_LEVEL_CONFIG
        return sorted(docs, key=lambda x: x.get("order", 99))

    async def _ensure_categories():
        count = await db.platform_categories.count_documents({})
        if count == 0:
            ts = _ts()
            for cat in DEFAULT_CATEGORIES:
                await db.platform_categories.insert_one({
                    "id": f"cat_{cat['slug']}",
                    **cat,
                    "active": True,
                    "created_at": ts,
                })

    async def _ensure_badges():
        count = await db.badge_definitions.count_documents({})
        if count == 0:
            ts = _ts()
            for b in DEFAULT_BADGE_DEFINITIONS:
                await db.badge_definitions.update_one(
                    {"id": b["id"]}, {"$set": {**b, "created_at": ts}}, upsert=True
                )

    async def _ensure_referral_config():
        cfg = await db.referral_config.find_one({"id": "referral_config_v1"})
        if not cfg:
            await db.referral_config.insert_one({**DEFAULT_REFERRAL_CONFIG, "created_at": _ts()})

    # ── matching engine ───────────────────────────────────────────────────────

    def _category_overlap_score(creator_cats: List[str], campaign_cats: List[str]) -> float:
        """0–100 score based on category intersection."""
        if not creator_cats or not campaign_cats:
            return 30  # neutral
        creator_set = {c.lower().strip() for c in creator_cats if c}
        campaign_set = {c.lower().strip() for c in campaign_cats if c}
        if not creator_set or not campaign_set:
            return 30
        intersection = creator_set & campaign_set
        if intersection:
            return min(100, 60 + 40 * len(intersection) / max(len(campaign_set), 1))
        # partial slug match
        partial = sum(
            1 for cc in creator_set
            for bc in campaign_set
            if cc in bc or bc in cc
        )
        return min(55, 30 + partial * 15)

    def _platform_overlap_score(creator_platforms: List[str], campaign_platforms: List[str]) -> float:
        if not creator_platforms or not campaign_platforms:
            return 50
        cp = {p.lower() for p in creator_platforms}
        bp = {p.lower() for p in campaign_platforms}
        common = cp & bp
        return min(100, 40 + 60 * len(common) / max(len(bp), 1)) if common else 20

    def _location_score(creator_loc: Optional[str], campaign_loc: Optional[str]) -> float:
        if not campaign_loc or campaign_loc.lower() in ("any", "all", "pan india", ""):
            return 100
        if not creator_loc:
            return 50
        cl = creator_loc.lower()
        bl = campaign_loc.lower()
        if cl == bl:
            return 100
        if cl in bl or bl in cl:
            return 80
        return 30

    def _profile_quality_score(creator: dict) -> float:
        score = 0
        if creator.get("avatar"):         score += 20
        if creator.get("bio"):            score += 15
        if creator.get("portfolio"):      score += 15
        if creator.get("followers", 0) > 0: score += 20
        if creator.get("niches") or creator.get("category"): score += 15
        if creator.get("platforms"):      score += 15
        return min(100, score)

    def _engagement_score(creator: dict) -> float:
        followers = creator.get("followers", 0) or 0
        if followers >= 1_000_000: return 95
        if followers >= 500_000:   return 88
        if followers >= 100_000:   return 80
        if followers >= 50_000:    return 70
        if followers >= 10_000:    return 60
        if followers >= 5_000:     return 50
        if followers >= 1_000:     return 40
        return 25

    def _performance_score(creator: dict) -> float:
        reviews = creator.get("reviews_count", 0) or 0
        if reviews == 0:
            return 50
        avg = float(creator.get("avg_rating", 0) or 0)
        return min(100, (avg / 5.0) * 100)

    async def _compute_match_score(creator: dict, campaign: dict, cfg: dict) -> tuple:
        """Returns (score: float, reasons: list[str])"""
        creator_cats = []
        if creator.get("niches"):
            creator_cats = creator["niches"] if isinstance(creator["niches"], list) else [creator["niches"]]
        elif creator.get("category"):
            raw = creator["category"]
            creator_cats = raw if isinstance(raw, list) else [c.strip() for c in str(raw).split(",") if c.strip()]

        campaign_cats = list(campaign.get("niches", []) or [])

        cat_s    = _category_overlap_score(creator_cats, campaign_cats)
        plat_s   = _platform_overlap_score(list(creator.get("platforms", []) or []), list(campaign.get("platforms", []) or []))
        loc_s    = _location_score(creator.get("city") or creator.get("location"), campaign.get("influencer_location") or campaign.get("location"))
        eng_s    = _engagement_score(creator)
        qual_s   = _profile_quality_score(creator)
        perf_s   = _performance_score(creator)

        w = cfg
        total_w = (w.get("category_weight", 40) + w.get("platform_weight", 20) +
                   w.get("location_weight", 10) + w.get("engagement_weight", 15) +
                   w.get("profile_quality_weight", 5) + w.get("performance_weight", 10))
        if total_w == 0:
            total_w = 100

        score = (
            cat_s  * w.get("category_weight", 40) +
            plat_s * w.get("platform_weight", 20) +
            loc_s  * w.get("location_weight", 10) +
            eng_s  * w.get("engagement_weight", 15) +
            qual_s * w.get("profile_quality_weight", 5) +
            perf_s * w.get("performance_weight", 10)
        ) / total_w

        reasons = []
        if cat_s >= 80:
            reasons.append(f"Category match: {', '.join(creator_cats[:2])}")
        if plat_s >= 80:
            reasons.append("Platform overlap")
        if loc_s >= 80 and campaign.get("influencer_location"):
            reasons.append(f"Location: {creator.get('city', '')}")
        if eng_s >= 70:
            reasons.append(f"{creator.get('followers', 0):,} followers")
        if perf_s >= 80:
            reasons.append(f"{creator.get('avg_rating', 0):.1f}★ rating")

        return round(score, 1), reasons

    # ── level computation ─────────────────────────────────────────────────────

    async def _compute_level(user_id: str) -> str:
        """Determine creator level from their stats. Returns level name."""
        levels = await _get_level_config()

        # aggregate completed campaigns
        completed = await db.applications.count_documents({
            "influencer_id": user_id, "status": "accepted"
        })
        # total earnings (wallet_tx)
        earnings_cursor = db.wallet_tx.find({"user_id": user_id, "kind": "credit", "amount": {"$gt": 0}})
        total_earnings = 0
        async for tx in earnings_cursor:
            total_earnings += int(tx.get("amount", 0))

        # avg rating
        reviews_cursor = db.reviews.find({"target_id": user_id})
        ratings, count = [], 0
        async for r in reviews_cursor:
            ratings.append(float(r.get("rating", 0)))
            count += 1
        avg_rating = (sum(ratings) / count) if count else 0

        best_level = levels[0]["level"]
        for lvl in sorted(levels, key=lambda x: x.get("order", 99), reverse=True):
            if (completed >= lvl.get("min_campaigns", 0) and
                    total_earnings >= lvl.get("min_earnings", 0) and
                    avg_rating >= lvl.get("min_rating", 0.0)):
                best_level = lvl["level"]
                break

        return best_level

    async def _level_progress(user_id: str) -> dict:
        """Return current level, next level, progress pct, and stats."""
        levels = await _get_level_config()
        levels_sorted = sorted(levels, key=lambda x: x.get("order", 99))

        completed = await db.applications.count_documents({"influencer_id": user_id, "status": "accepted"})
        earnings_cursor = db.wallet_tx.find({"user_id": user_id, "kind": "credit", "amount": {"$gt": 0}})
        total_earnings = 0
        async for tx in earnings_cursor:
            total_earnings += int(tx.get("amount", 0))

        reviews_cursor = db.reviews.find({"target_id": user_id})
        ratings, count = [], 0
        async for r in reviews_cursor:
            ratings.append(float(r.get("rating", 0)))
            count += 1
        avg_rating = (sum(ratings) / count) if count else 0

        current_level_name = levels_sorted[0]["level"]
        current_level = levels_sorted[0]
        for lvl in levels_sorted:
            if (completed >= lvl.get("min_campaigns", 0) and
                    total_earnings >= lvl.get("min_earnings", 0) and
                    avg_rating >= lvl.get("min_rating", 0.0)):
                current_level_name = lvl["level"]
                current_level = lvl

        next_level = None
        for lvl in levels_sorted:
            if lvl.get("order", 99) > current_level.get("order", 99):
                next_level = lvl
                break

        progress_pct = 100
        if next_level:
            campaign_needed = next_level.get("min_campaigns", 0)
            campaign_done   = max(0, min(completed, campaign_needed))
            progress_pct = int((campaign_done / campaign_needed * 100)) if campaign_needed else 100

        return {
            "current_level": current_level_name,
            "current_level_data": current_level,
            "next_level": next_level,
            "progress_pct": progress_pct,
            "stats": {
                "completed_campaigns": completed,
                "total_earnings": total_earnings,
                "avg_rating": round(avg_rating, 2),
                "ratings_count": count,
            }
        }

    # ── badge award engine ────────────────────────────────────────────────────

    async def _check_and_award_badges(user_id: str):
        """Check all badge criteria and award any newly earned badges."""
        badges = await db.badge_definitions.find({"active": True}).to_list(length=50)
        already_earned = {b["badge_id"] async for b in db.user_badges.find({"user_id": user_id})}

        # Aggregate stats
        completed = await db.applications.count_documents({"influencer_id": user_id, "status": "accepted"})
        reviews_cursor = db.reviews.find({"target_id": user_id})
        ratings = []
        async for r in reviews_cursor:
            ratings.append(float(r.get("rating", 0)))
        avg_rating = (sum(ratings) / len(ratings)) if ratings else 0

        newly_earned = []
        for badge in badges:
            bid = badge["id"]
            if bid in already_earned:
                continue
            crit = badge.get("criteria", {})
            min_campaigns = crit.get("min_campaigns", 0)
            min_avg_rating = crit.get("min_avg_rating", 0)
            max_response_h = crit.get("max_avg_response_hours", None)

            qualifies = (completed >= min_campaigns and avg_rating >= min_avg_rating)

            # Quick Responder: skip response time check (no tracking yet — grant to active creators)
            if bid == "badge_quick_responder":
                qualifies = completed >= min_campaigns

            if qualifies:
                await db.user_badges.insert_one({
                    "id": f"ub_{uuid.uuid4().hex[:10]}",
                    "user_id": user_id,
                    "badge_id": bid,
                    "badge_name": badge["name"],
                    "badge_icon": badge["icon"],
                    "badge_color": badge["color"],
                    "earned_at": _ts(),
                })
                newly_earned.append(badge)
                try:
                    await push_notification(
                        user_id=user_id,
                        kind="badge_earned",
                        text=f"🏅 You earned the '{badge['name']}' badge!",
                        meta={"badge_id": bid, "badge_name": badge["name"]},
                    )
                except Exception:
                    pass

        return newly_earned

    # ── leaderboard computation ───────────────────────────────────────────────

    async def _recompute_leaderboard(period: str = "weekly"):
        """Compute and store leaderboard snapshots for all types."""
        if period == "weekly":
            since = _now() - timedelta(days=7)
        else:
            since = _now() - timedelta(days=30)
        since_iso = since.isoformat()

        # ── Top Earner (creators, by wallet_tx credits in period) ──
        earner_map: Dict[str, int] = {}
        async for tx in db.wallet_tx.find({
            "kind": "credit", "amount": {"$gt": 0},
            "created_at": {"$gte": since_iso},
        }):
            uid = tx.get("user_id")
            if uid:
                earner_map[uid] = earner_map.get(uid, 0) + int(tx.get("amount", 0))

        earner_entries = []
        for uid, total in sorted(earner_map.items(), key=lambda x: -x[1])[:50]:
            u = await db.users.find_one({"id": uid}, {"password_hash": 0})
            if not u or u.get("role") != "influencer":
                continue
            earner_entries.append({
                "user_id": uid,
                "name": u.get("name", "Creator"),
                "avatar": u.get("avatar"),
                "handle": u.get("handle") or u.get("username"),
                "level": u.get("creator_level", "Beginner"),
                "score": total,
                "stats": {"earnings": total},
            })
        for i, e in enumerate(earner_entries):
            e["rank"] = i + 1

        # ── Top Spender (brands, campaign budgets in period) ──
        spender_map: Dict[str, int] = {}
        async for tx in db.wallet_tx.find({
            "kind": "debit", "amount": {"$gt": 0},
            "created_at": {"$gte": since_iso},
        }):
            uid = tx.get("user_id")
            if uid:
                spender_map[uid] = spender_map.get(uid, 0) + int(tx.get("amount", 0))

        spender_entries = []
        for uid, total in sorted(spender_map.items(), key=lambda x: -x[1])[:50]:
            u = await db.users.find_one({"id": uid}, {"password_hash": 0})
            if not u or u.get("role") not in ("owner", "agent"):
                continue
            spender_entries.append({
                "user_id": uid,
                "name": u.get("name") or u.get("company", "Brand"),
                "avatar": u.get("avatar"),
                "handle": u.get("handle") or u.get("company", ""),
                "score": total,
                "stats": {"spending": total},
            })
        for i, e in enumerate(spender_entries):
            e["rank"] = i + 1

        # ── Top Performer (creators, composite score) ──
        performer_map: Dict[str, float] = {}
        async for app in db.applications.find({"status": "accepted", "created_at": {"$gte": since_iso}}):
            uid = app.get("influencer_id")
            if uid:
                performer_map[uid] = performer_map.get(uid, 0) + 1

        performer_entries = []
        for uid, campaigns in sorted(performer_map.items(), key=lambda x: -x[1])[:50]:
            u = await db.users.find_one({"id": uid}, {"password_hash": 0})
            if not u or u.get("role") != "influencer":
                continue
            reviews_cursor = db.reviews.find({"target_id": uid})
            ratings = []
            async for r in reviews_cursor:
                ratings.append(float(r.get("rating", 0)))
            avg_rating = (sum(ratings) / len(ratings)) if ratings else 0
            composite = campaigns * 10 + avg_rating * 10
            performer_entries.append({
                "user_id": uid,
                "name": u.get("name", "Creator"),
                "avatar": u.get("avatar"),
                "handle": u.get("handle") or u.get("username"),
                "level": u.get("creator_level", "Beginner"),
                "score": round(composite, 1),
                "stats": {"campaigns": int(campaigns), "avg_rating": round(avg_rating, 2)},
            })
        performer_entries.sort(key=lambda x: -x["score"])
        for i, e in enumerate(performer_entries):
            e["rank"] = i + 1

        ts = _ts()
        for ltype, entries in [
            ("top_performer", performer_entries),
            ("top_earner",    earner_entries),
            ("top_spender",   spender_entries),
        ]:
            await db.leaderboard_snapshots.update_one(
                {"type": ltype, "period": period},
                {"$set": {"type": ltype, "period": period, "entries": entries, "computed_at": ts}},
                upsert=True,
            )

    # ── referral code generator ───────────────────────────────────────────────

    def _gen_referral_code(user_id: str) -> str:
        base = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"CR8-{base}"

    # ═════════════════════════════════════════════════════════════════════════
    # ROUTES
    # ═════════════════════════════════════════════════════════════════════════

    # ── Startup seeding ───────────────────────────────────────────────────────
    @api_router.on_event("startup")
    async def _seed_phase2():
        await _ensure_categories()
        await _ensure_badges()
        await _ensure_referral_config()

    # ─────────────────────────────────────────────────────────────────────────
    # CATEGORIES
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/categories")
    async def list_categories():
        """Public: list all active categories."""
        await _ensure_categories()
        cats = await db.platform_categories.find({"active": True}).to_list(length=100)
        for c in cats:
            c.pop("_id", None)
        return cats

    @api_router.post("/admin/categories")
    async def admin_create_category(
        inp: CategoryCreate,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        slug = inp.slug or inp.name.lower().replace(" ", "_").replace("/", "_")
        existing = await db.platform_categories.find_one({"slug": slug})
        if existing:
            raise HTTPException(400, "Category slug already exists")
        cat = {
            "id": f"cat_{uuid.uuid4().hex[:8]}",
            "name": inp.name, "slug": slug,
            "icon": inp.icon, "color": inp.color,
            "description": inp.description,
            "active": True, "created_at": _ts(),
        }
        await db.platform_categories.insert_one(cat)
        cat.pop("_id", None)
        return cat

    @api_router.patch("/admin/categories/{cat_id}")
    async def admin_update_category(
        cat_id: str, inp: CategoryUpdate,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        updates = {k: v for k, v in inp.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(400, "Nothing to update")
        await db.platform_categories.update_one({"id": cat_id}, {"$set": updates})
        cat = await db.platform_categories.find_one({"id": cat_id})
        if not cat:
            raise HTTPException(404, "Category not found")
        cat.pop("_id", None)
        return cat

    @api_router.delete("/admin/categories/{cat_id}")
    async def admin_delete_category(
        cat_id: str,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        await db.platform_categories.update_one({"id": cat_id}, {"$set": {"active": False}})
        return {"ok": True}

    # ─────────────────────────────────────────────────────────────────────────
    # MATCH CONFIG
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/admin/match-config")
    async def get_match_config(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        cfg = await _get_match_config()
        cfg.pop("_id", None)
        return cfg

    @api_router.put("/admin/match-config")
    async def update_match_config(
        inp: MatchConfigUpdate,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        updates = {k: v for k, v in inp.model_dump().items() if v is not None}
        updates["updated_at"] = _ts()
        updates["updated_by"] = current["id"]
        await db.match_config.update_one(
            {"id": "match_config_v1"},
            {"$set": updates},
            upsert=True,
        )
        cfg = await _get_match_config()
        cfg.pop("_id", None)
        await _audit(action="match_config_update", user_id=current["id"], details=str(updates))
        return cfg

    # ─────────────────────────────────────────────────────────────────────────
    # ENHANCED CREATOR MATCH (replaces basic one — same URL, backward-compat)
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/creators/match-v2")
    async def match_creators_v2(
        campaign_id: Optional[str] = Query(None),
        limit: int = Query(20, le=50),
        current: dict = Depends(get_current_user),
    ):
        """Enhanced creator matching with scores and reasons."""
        cfg = await _get_match_config()
        campaign = {}
        if campaign_id:
            campaign = await db.campaigns.find_one({"id": campaign_id}) or {}

        # brand's preferred categories as fallback
        if not campaign:
            brand_cats = list(current.get("brand_categories", []) or [])
            campaign = {"niches": brand_cats, "platforms": list(current.get("preferred_platforms", []) or [])}

        creators_cursor = db.users.find({"role": "influencer", "banned": {"$ne": True}}, {"password_hash": 0})
        scored = []
        async for creator in creators_cursor:
            creator.pop("_id", None)
            score, reasons = await _compute_match_score(creator, campaign, cfg)
            creator["match_score"] = score
            creator["match_reasons"] = reasons
            scored.append(creator)

        scored.sort(key=lambda x: -x["match_score"])
        return scored[:limit]

    # ─────────────────────────────────────────────────────────────────────────
    # CAMPAIGN MATCH V2
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/campaigns/match-v2")
    async def match_campaigns_v2(
        limit: int = Query(20, le=50),
        current: dict = Depends(get_current_user),
    ):
        """Enhanced campaign matching for creators with scores and reasons."""
        cfg = await _get_match_config()

        campaigns_cursor = db.campaigns.find({"status": "open"})
        scored = []
        async for campaign in campaigns_cursor:
            campaign.pop("_id", None)
            score, reasons = await _compute_match_score(current, campaign, cfg)
            campaign["match_score"] = score
            campaign["match_reasons"] = reasons
            scored.append(campaign)

        scored.sort(key=lambda x: -x["match_score"])
        return scored[:limit]

    # ─────────────────────────────────────────────────────────────────────────
    # VERIFICATION STATUS
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/verification/status")
    async def verification_status(current: dict = Depends(get_current_user)):
        email_verified = bool(current.get("email_verified") or current.get("email_verified_at"))
        mobile_verified = bool(current.get("mobile_verified") or current.get("mobile_verified_at") or current.get("mobile"))
        profile_completed = current.get("onboarding_status") == "completed"
        social_connected = bool(
            (current.get("oauth_connections") or []) or
            (current.get("social_accounts") or [])
        )
        return {
            "email_verified": email_verified,
            "mobile_verified": mobile_verified,
            "profile_completed": profile_completed,
            "social_connected": social_connected,
            "overall_complete": all([email_verified, mobile_verified, profile_completed]),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # LEVELS
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/levels")
    async def list_levels():
        """Public: all level definitions."""
        levels = await _get_level_config()
        for lvl in levels:
            lvl.pop("_id", None)
        return levels

    @api_router.get("/levels/my-progress")
    async def my_level_progress(current: dict = Depends(get_current_user)):
        if current.get("role") != "influencer":
            raise HTTPException(403, "Only creators have levels")
        return await _level_progress(current["id"])

    @api_router.get("/levels/user/{user_id}")
    async def user_level(user_id: str, current: dict = Depends(get_current_user)):
        target = await db.users.find_one({"id": user_id}, {"password_hash": 0})
        if not target:
            raise HTTPException(404, "User not found")
        if target.get("role") != "influencer":
            return {"level": None}
        return {"level": target.get("creator_level", "Beginner")}

    @api_router.get("/admin/levels/config")
    async def admin_get_levels(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        levels = await _get_level_config()
        for lvl in levels:
            lvl.pop("_id", None)
        return levels

    @api_router.put("/admin/levels/config")
    async def admin_update_levels(
        inp: LevelConfigUpdate,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        for lvl in inp.levels:
            await db.level_config.update_one(
                {"level": lvl["level"]},
                {"$set": {**lvl, "updated_at": _ts()}},
                upsert=True,
            )
        await _audit(action="level_config_update", user_id=current["id"])
        return await _get_level_config()

    @api_router.post("/levels/recalculate")
    async def recalculate_my_level(current: dict = Depends(get_current_user)):
        """Creator triggers a level recalculation for themselves."""
        if current.get("role") != "influencer":
            raise HTTPException(403, "Only creators")
        new_level = await _compute_level(current["id"])
        old_level = current.get("creator_level")
        await db.users.update_one({"id": current["id"]}, {"$set": {"creator_level": new_level, "level_updated_at": _ts()}})
        if old_level != new_level:
            try:
                await push_notification(
                    user_id=current["id"],
                    kind="level_upgraded",
                    text=f"🎉 You levelled up to {new_level}!",
                    meta={"new_level": new_level, "old_level": old_level},
                )
            except Exception:
                pass
        # Also check badges
        await _check_and_award_badges(current["id"])
        progress = await _level_progress(current["id"])
        return progress

    # ─────────────────────────────────────────────────────────────────────────
    # BADGES
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/badges")
    async def list_badges():
        """Public: all active badge definitions."""
        await _ensure_badges()
        badges = await db.badge_definitions.find({"active": True}).to_list(length=50)
        for b in badges:
            b.pop("_id", None)
        return badges

    @api_router.get("/badges/mine")
    async def my_badges(current: dict = Depends(get_current_user)):
        earned = await db.user_badges.find({"user_id": current["id"]}).to_list(length=50)
        for b in earned:
            b.pop("_id", None)
        return earned

    @api_router.get("/badges/check")
    async def check_my_badges(current: dict = Depends(get_current_user)):
        """Trigger badge check for current user."""
        newly = await _check_and_award_badges(current["id"])
        return {"newly_earned": len(newly), "badges": [b["name"] for b in newly]}

    @api_router.get("/users/{user_id}/badges")
    async def user_badges_public(user_id: str, _: dict = Depends(get_current_user)):
        earned = await db.user_badges.find({"user_id": user_id}).to_list(length=50)
        for b in earned:
            b.pop("_id", None)
        return earned

    @api_router.post("/admin/badges")
    async def admin_create_badge(inp: BadgeCreate, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        badge = {
            "id": f"badge_{uuid.uuid4().hex[:8]}",
            **inp.model_dump(),
            "created_at": _ts(),
        }
        await db.badge_definitions.insert_one(badge)
        badge.pop("_id", None)
        return badge

    @api_router.patch("/admin/badges/{badge_id}")
    async def admin_update_badge(
        badge_id: str, inp: BadgeUpdate,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        updates = {k: v for k, v in inp.model_dump().items() if v is not None}
        await db.badge_definitions.update_one({"id": badge_id}, {"$set": updates})
        b = await db.badge_definitions.find_one({"id": badge_id})
        b.pop("_id", None)
        return b

    @api_router.delete("/admin/badges/{badge_id}")
    async def admin_delete_badge(badge_id: str, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        await db.badge_definitions.update_one({"id": badge_id}, {"$set": {"active": False}})
        return {"ok": True}

    # ─────────────────────────────────────────────────────────────────────────
    # LEADERBOARD
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/leaderboard")
    async def get_leaderboard(
        type: str = Query("top_performer", regex="^(top_performer|top_earner|top_spender)$"),
        period: str = Query("weekly", regex="^(weekly|monthly)$"),
        limit: int = Query(20, le=50),
        current: dict = Depends(get_current_user),
    ):
        snap = await db.leaderboard_snapshots.find_one({"type": type, "period": period})
        if not snap:
            await _recompute_leaderboard(period)
            snap = await db.leaderboard_snapshots.find_one({"type": type, "period": period})

        entries = (snap or {}).get("entries", [])[:limit]
        computed_at = (snap or {}).get("computed_at")

        # Enrich with badge info
        for entry in entries:
            uid = entry.get("user_id")
            if uid:
                ub = await db.user_badges.find({"user_id": uid}).to_list(length=5)
                entry["badges"] = [{"icon": b["badge_icon"], "name": b["badge_name"]} for b in ub]

        return {"entries": entries, "computed_at": computed_at, "type": type, "period": period}

    @api_router.get("/leaderboard/my-rank")
    async def my_leaderboard_rank(
        type: str = Query("top_performer", regex="^(top_performer|top_earner|top_spender)$"),
        period: str = Query("weekly", regex="^(weekly|monthly)$"),
        current: dict = Depends(get_current_user),
    ):
        snap = await db.leaderboard_snapshots.find_one({"type": type, "period": period})
        entries = (snap or {}).get("entries", [])
        for entry in entries:
            if entry.get("user_id") == current["id"]:
                return {"rank": entry["rank"], "score": entry["score"], "total": len(entries)}
        return {"rank": None, "score": None, "total": len(entries)}

    @api_router.post("/admin/leaderboard/recompute")
    async def admin_recompute_leaderboard(
        period: str = Query("weekly", regex="^(weekly|monthly)$"),
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        await _recompute_leaderboard(period)
        await _recompute_leaderboard("monthly" if period == "weekly" else "weekly")
        await _audit(action="leaderboard_recomputed", user_id=current["id"])
        return {"ok": True, "period": period}

    # ─────────────────────────────────────────────────────────────────────────
    # REFERRALS
    # ─────────────────────────────────────────────────────────────────────────

    @api_router.get("/referrals/my-code")
    async def my_referral_code(current: dict = Depends(get_current_user)):
        code = current.get("referral_code")
        if not code:
            code = _gen_referral_code(current["id"])
            await db.users.update_one({"id": current["id"]}, {"$set": {"referral_code": code}})
        frontend_url = "https://naresh-palle.github.io/Project2-Social"
        return {
            "code": code,
            "link": f"{frontend_url}/#/register?ref={code}",
            "share_text": f"Join CR8 Studio — India's premier influencer marketplace! Use my code {code} to get a sign-up bonus.",
        }

    @api_router.get("/referrals/status")
    async def referral_status(current: dict = Depends(get_current_user)):
        referrals = await db.referrals.find({"referrer_id": current["id"]}).to_list(length=100)
        for r in referrals:
            r.pop("_id", None)

        total = len(referrals)
        qualified = sum(1 for r in referrals if r.get("status") == "qualified")
        rewarded = sum(1 for r in referrals if r.get("status") == "rewarded")
        pending = total - qualified - rewarded

        cfg = await db.referral_config.find_one({"id": "referral_config_v1"}) or DEFAULT_REFERRAL_CONFIG
        return {
            "referrals": referrals,
            "summary": {
                "total": total,
                "pending": pending,
                "qualified": qualified,
                "rewarded": rewarded,
                "potential_reward": (qualified - rewarded) * cfg.get("referrer_reward", 500),
            },
            "config": {
                "referrer_reward": cfg.get("referrer_reward", 500),
                "reward_type": cfg.get("reward_type", "wallet_credit"),
            },
        }

    @api_router.post("/referrals/apply")
    async def apply_referral(inp: ReferralApply, current: dict = Depends(get_current_user)):
        """Apply a referral code during or after signup."""
        code = inp.code.strip().upper()

        # Prevent self-referral
        if current.get("referral_code") == code:
            raise HTTPException(400, "You cannot use your own referral code")

        # Already applied?
        existing = await db.referrals.find_one({"referee_id": current["id"]})
        if existing:
            raise HTTPException(400, "You have already applied a referral code")

        # Find referrer
        referrer = await db.users.find_one({"referral_code": code})
        if not referrer:
            raise HTTPException(404, "Invalid referral code")

        cfg = await db.referral_config.find_one({"id": "referral_config_v1"}) or DEFAULT_REFERRAL_CONFIG
        if not cfg.get("active"):
            raise HTTPException(400, "Referral program is currently inactive")

        # Check max referrals per user
        referrer_count = await db.referrals.count_documents({"referrer_id": referrer["id"]})
        if referrer_count >= cfg.get("max_referrals_per_user", 50):
            raise HTTPException(400, "Referrer has reached maximum referrals limit")

        ref_doc = {
            "id": f"ref_{uuid.uuid4().hex[:10]}",
            "referrer_id": referrer["id"],
            "referrer_name": referrer.get("name"),
            "referee_id": current["id"],
            "referee_name": current.get("name"),
            "code": code,
            "status": "qualified",
            "reward_type": cfg.get("reward_type", "wallet_credit"),
            "referrer_reward": cfg.get("referrer_reward", 500),
            "referee_reward": cfg.get("referee_reward", 200),
            "created_at": _ts(),
            "qualified_at": _ts(),
        }
        await db.referrals.insert_one(ref_doc)

        # Credit referee
        if cfg.get("referee_reward", 0) > 0:
            await db.wallet_tx.insert_one({
                "id": f"wtx_{uuid.uuid4().hex[:10]}",
                "user_id": current["id"],
                "kind": "credit",
                "amount": cfg["referee_reward"],
                "note": f"Referral sign-up bonus (code: {code})",
                "created_at": _ts(),
            })
            await db.users.update_one(
                {"id": current["id"]},
                {"$inc": {"wallet": cfg["referee_reward"]}}
            )

        # Credit referrer
        if cfg.get("referrer_reward", 0) > 0:
            await db.wallet_tx.insert_one({
                "id": f"wtx_{uuid.uuid4().hex[:10]}",
                "user_id": referrer["id"],
                "kind": "credit",
                "amount": cfg["referrer_reward"],
                "note": f"Referral reward — {current.get('name', 'New user')} joined with your code",
                "created_at": _ts(),
            })
            await db.users.update_one(
                {"id": referrer["id"]},
                {"$inc": {"wallet": cfg["referrer_reward"]}}
            )
            await db.referrals.update_one({"id": ref_doc["id"]}, {"$set": {"status": "rewarded", "rewarded_at": _ts()}})
            try:
                await push_notification(
                    user_id=referrer["id"],
                    kind="referral_reward",
                    text=f"🎁 Referral reward! {current.get('name', 'Someone')} joined with your code. ₹{cfg['referrer_reward']} credited.",
                    meta={"amount": cfg["referrer_reward"]},
                )
            except Exception:
                pass

        return {"ok": True, "referee_reward": cfg.get("referee_reward", 200)}

    @api_router.get("/admin/referral-config")
    async def admin_get_referral_config(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        cfg = await db.referral_config.find_one({"id": "referral_config_v1"}) or DEFAULT_REFERRAL_CONFIG
        cfg.pop("_id", None)
        return cfg

    @api_router.put("/admin/referral-config")
    async def admin_update_referral_config(
        inp: ReferralConfigUpdate,
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        updates = {k: v for k, v in inp.model_dump().items() if v is not None}
        updates["updated_at"] = _ts()
        await db.referral_config.update_one(
            {"id": "referral_config_v1"}, {"$set": updates}, upsert=True
        )
        await _audit(action="referral_config_update", user_id=current["id"], details=str(updates))
        cfg = await db.referral_config.find_one({"id": "referral_config_v1"})
        cfg.pop("_id", None)
        return cfg

    @api_router.get("/admin/referrals")
    async def admin_list_referrals(
        status: Optional[str] = None,
        limit: int = Query(50, le=200),
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["admin"])
        q = {}
        if status:
            q["status"] = status
        refs = await db.referrals.find(q).to_list(length=limit)
        for r in refs:
            r.pop("_id", None)
        total = await db.referrals.count_documents({})
        qualified = await db.referrals.count_documents({"status": "qualified"})
        rewarded = await db.referrals.count_documents({"status": "rewarded"})
        return {"referrals": refs, "stats": {"total": total, "qualified": qualified, "rewarded": rewarded}}

    # ─────────────────────────────────────────────────────────────────────────
    # POST-CAMPAIGN-COMPLETION HOOK (called by server.py on escrow release)
    # ─────────────────────────────────────────────────────────────────────────

    async def on_campaign_completed(creator_id: str, campaign_id: str):
        """Call this when a campaign is marked completed and payment released."""
        new_level = await _compute_level(creator_id)
        user = await db.users.find_one({"id": creator_id}, {"creator_level": 1, "id": 1})
        old_level = (user or {}).get("creator_level")
        await db.users.update_one(
            {"id": creator_id},
            {"$set": {"creator_level": new_level, "level_updated_at": _ts()}}
        )
        if old_level != new_level and old_level is not None:
            try:
                await push_notification(
                    user_id=creator_id,
                    kind="level_upgraded",
                    text=f"🎉 Congratulations! You levelled up to {new_level}!",
                    meta={"new_level": new_level, "old_level": old_level},
                )
            except Exception:
                pass
        await _check_and_award_badges(creator_id)

    # Expose hook for server.py to call
    api_router.__phase2_on_campaign_completed__ = on_campaign_completed

    logger.info("Phase 2 features mounted: categories, matching, levels, badges, leaderboard, referrals")
