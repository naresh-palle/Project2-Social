"""Marketplace discovery — brands, wishlists, production hire, combo invites, campaign ROI."""
from __future__ import annotations

import logging
import math
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger("marketplace")

PRODUCTION_CATEGORIES = {
    "camera": {
        "label": "Camera Team",
        "roles": ["Cameraman", "Videographer", "Photography team", "Camera operator", "Production crew"],
    },
    "editing": {
        "label": "Video Editing Team",
        "roles": ["Video editor", "Reels/Shorts editor", "YouTube editor", "Motion graphics editor", "Post-production specialist"],
    },
    "voiceover": {
        "label": "Voice Over Artists",
        "roles": ["Male voice artist", "Female voice artist", "Regional-language voice artist", "Professional narration"],
    },
    "script": {
        "label": "Script Writers",
        "roles": ["Advertisement scripts", "Reel scripts", "YouTube scripts", "Campaign scripts", "Storyboards"],
    },
}

WISHLIST_TYPES = {"influencer", "creator", "brand", "production"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip(user: dict) -> dict:
    out = dict(user or {})
    out.pop("_id", None)
    out.pop("password_hash", None)
    out.pop("oauth_connections", None)
    return out


def _num(v, default=None):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def _haversine_km(lat1, lon1, lat2, lon2) -> Optional[float]:
    try:
        la1, lo1, la2, lo2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (TypeError, ValueError):
        return None
    r = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1)
    dl = math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# Approximate city centroids for nearest sort (India focus)
CITY_COORDS = {
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
    "chandigarh": (30.7333, 76.7794),
    "goa": (15.2993, 74.1240),
    "kochi": (9.9312, 76.2673),
    "indore": (22.7196, 75.8577),
}


def _coords_for(user: dict) -> Optional[tuple]:
    if user.get("lat") is not None and user.get("lng") is not None:
        try:
            return float(user["lat"]), float(user["lng"])
        except (TypeError, ValueError):
            pass
    city = (user.get("city") or user.get("location") or "").strip().lower()
    if city in CITY_COORDS:
        return CITY_COORDS[city]
    for k, v in CITY_COORDS.items():
        if k in city:
            return v
    return None


class WishlistBody(BaseModel):
    target_id: str
    target_type: str = "influencer"  # influencer | creator | brand | production
    action: str = "add"  # add | remove | toggle


class CreatorDirectoryQuery(BaseModel):
    q: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    niches: List[str] = Field(default_factory=list)
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    followers_min: Optional[float] = None
    followers_max: Optional[float] = None
    engagement_min: Optional[float] = None
    engagement_max: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    sort: str = "engagement"  # engagement | newest | cost_asc | cost_desc | nearest | quality
    page: int = 1
    limit: int = 24


class BrandDirectoryQuery(BaseModel):
    q: Optional[str] = None
    industry: Optional[str] = None
    industries: List[str] = Field(default_factory=list)
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    sort: str = "newest"  # newest | name | campaigns
    page: int = 1
    limit: int = 24


class ProductionDirectoryQuery(BaseModel):
    q: Optional[str] = None
    category: Optional[str] = None  # camera | editing | voiceover | script
    categories: List[str] = Field(default_factory=list)
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    in_house_only: Optional[bool] = None
    sort: str = "rating"  # rating | newest | cost_asc | cost_desc | nearest
    page: int = 1
    limit: int = 24


class SimilarCreatorsBody(BaseModel):
    creator_id: str
    limit: int = 12


class ComboInviteBody(BaseModel):
    campaign_id: str
    creator_ids: List[str] = Field(min_length=1, max_length=20)
    message: Optional[str] = None
    offer_per_creator: Optional[Dict[str, float]] = None
    default_offer: Optional[float] = None


class HireRequestBody(BaseModel):
    production_id: str
    message: Optional[str] = None
    service: Optional[str] = None
    budget: Optional[float] = None
    campaign_id: Optional[str] = None


class HireActionBody(BaseModel):
    status: str  # accepted | rejected | quoted | completed
    quote: Optional[float] = None
    note: Optional[str] = None


class ProductionProfileBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Optional[str] = None
    production_category: str = "camera"
    production_role: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    bio: Optional[str] = None
    services: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = None
    base_rate: Optional[float] = None
    availability: Optional[str] = "available"
    languages: List[str] = Field(default_factory=list)
    portfolio: List[str] = Field(default_factory=list)
    avatar: Optional[str] = None
    in_house: bool = False
    password: Optional[str] = None


class ProductionUpdateBody(BaseModel):
    name: Optional[str] = None
    production_category: Optional[str] = None
    production_role: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    bio: Optional[str] = None
    services: Optional[List[str]] = None
    experience_years: Optional[float] = None
    base_rate: Optional[float] = None
    availability: Optional[str] = None
    languages: Optional[List[str]] = None
    portfolio: Optional[List[str]] = None
    avatar: Optional[str] = None
    in_house: Optional[bool] = None
    banned: Optional[bool] = None


def setup_marketplace(
    api_router,
    *,
    db,
    get_current_user: Callable,
    require_role: Callable,
    push_notification: Callable,
    now_iso: Callable,
    hash_password: Callable,
    clean: Callable,
    write_audit_log: Optional[Callable] = None,
    logger=logger,
):
    async def ensure_indexes():
        await db.users.create_index("role")
        await db.users.create_index([("role", 1), ("production_category", 1)])
        await db.users.create_index([("role", 1), ("in_house", 1)])
        await db.users.create_index([("role", 1), ("city", 1)])
        await db.users.create_index([("role", 1), ("followers", 1)])
        await db.users.create_index([("role", 1), ("base_rate", 1)])
        await db.users.create_index([("role", 1), ("engagement_rate", 1)])
        await db.wishlists.create_index([("user_id", 1), ("target_id", 1), ("target_type", 1)], unique=True)
        await db.wishlists.create_index([("user_id", 1), ("created_at", -1)])
        await db.hire_requests.create_index("id", unique=True)
        await db.hire_requests.create_index([("requester_id", 1), ("created_at", -1)])
        await db.hire_requests.create_index([("production_id", 1), ("status", 1)])
        await db.campaign_performance.create_index("id", unique=True)
        await db.campaign_performance.create_index([("creator_id", 1), ("campaign_date", -1)])
        await db.campaign_performance.create_index([("brand_id", 1), ("campaign_date", -1)])
        await db.creator_combos.create_index("id", unique=True)
        await db.creator_combos.create_index([("brand_id", 1), ("created_at", -1)])
        await db.creator_combos.create_index("campaign_id")

    def _engagement(u: dict) -> Optional[float]:
        if u.get("engagement_rate") is not None:
            return _num(u.get("engagement_rate"))
        pm = u.get("platform_metrics") or {}
        rates = []
        for row in pm.values():
            if isinstance(row, dict) and row.get("engagement") is not None:
                rates.append(_num(row.get("engagement")))
        rates = [r for r in rates if r is not None]
        return sum(rates) / len(rates) if rates else None

    def _followers(u: dict) -> float:
        if u.get("followers") is not None:
            return _num(u.get("followers"), 0) or 0
        pm = u.get("platform_metrics") or {}
        best = 0.0
        for row in pm.values():
            if isinstance(row, dict):
                best = max(best, _num(row.get("followers"), 0) or 0)
        return best

    def _creator_card(u: dict, origin: Optional[dict] = None, wishlist_ids: Optional[set] = None) -> dict:
        er = _engagement(u)
        fol = _followers(u)
        dist = None
        if origin:
            a, b = _coords_for(origin), _coords_for(u)
            if a and b:
                dist = round(_haversine_km(a[0], a[1], b[0], b[1]) or 0, 1)
        perf = u.get("campaign_kpis") or {}
        return {
            "id": u.get("id"),
            "name": u.get("name"),
            "username": u.get("username"),
            "handle": u.get("handle") or u.get("username"),
            "avatar": u.get("avatar"),
            "cover_photo": u.get("cover_photo"),
            "bio": u.get("bio"),
            "role": u.get("role"),
            "niches": u.get("niches") or [],
            "category": u.get("category") or ((u.get("niches") or [None])[0]),
            "city": u.get("city"),
            "state": u.get("state"),
            "country": u.get("country") or "India",
            "location": u.get("location") or u.get("city"),
            "followers": fol,
            "engagement_rate": er,
            "base_rate": _num(u.get("base_rate")),
            "platforms": u.get("platforms") or [],
            "platform_metrics": u.get("platform_metrics") or {},
            "portfolio": u.get("portfolio") or [],
            "verified": bool(u.get("verified")),
            "created_at": u.get("created_at"),
            "distance_km": dist,
            "wishlisted": bool(wishlist_ids and u.get("id") in wishlist_ids),
            "campaign_kpis": {
                "completed_campaigns": perf.get("completed_campaigns") or u.get("completed_campaigns") or 0,
                "avg_campaign_reach": perf.get("avg_campaign_reach"),
                "avg_campaign_engagement": perf.get("avg_campaign_engagement"),
                "avg_roi": perf.get("avg_roi"),
                "avg_roas": perf.get("avg_roas"),
                "success_rate": perf.get("success_rate"),
                "avg_reach": perf.get("avg_reach") or u.get("average_reach"),
                "avg_views": perf.get("avg_views") or u.get("average_views"),
            },
            "content_type": u.get("content_type") or u.get("content_types") or [],
            "audience": u.get("audience") or u.get("audience_demographics") or {},
        }

    def _brand_card(u: dict, wishlist_ids: Optional[set] = None, extras: Optional[dict] = None) -> dict:
        extras = extras or {}
        return {
            "id": u.get("id"),
            "name": u.get("name") or u.get("company"),
            "company": u.get("company") or u.get("name"),
            "avatar": u.get("avatar"),
            "cover_photo": u.get("cover_photo"),
            "bio": u.get("bio"),
            "industry": u.get("industry") or u.get("category"),
            "category": u.get("category") or u.get("industry"),
            "city": u.get("city"),
            "state": u.get("state"),
            "country": u.get("country") or "India",
            "location": u.get("location") or u.get("city"),
            "website": u.get("website"),
            "linkedin": u.get("linkedin"),
            "social": u.get("social") or {},
            "role": "owner",
            "created_at": u.get("created_at"),
            "wishlisted": bool(wishlist_ids and u.get("id") in wishlist_ids),
            "active_campaigns": extras.get("active_campaigns", 0),
            "previous_campaigns": extras.get("previous_campaigns", 0),
            "avg_budget": extras.get("avg_budget"),
            "rating": extras.get("rating"),
            "creators_hired": extras.get("creators_hired", 0),
        }

    def _production_card(u: dict, wishlist_ids: Optional[set] = None, origin: Optional[dict] = None) -> dict:
        cat = u.get("production_category") or "camera"
        meta = PRODUCTION_CATEGORIES.get(cat, {"label": cat.title(), "roles": []})
        dist = None
        if origin:
            a, b = _coords_for(origin), _coords_for(u)
            if a and b:
                dist = round(_haversine_km(a[0], a[1], b[0], b[1]) or 0, 1)
        return {
            "id": u.get("id"),
            "name": u.get("name"),
            "username": u.get("username"),
            "avatar": u.get("avatar"),
            "bio": u.get("bio"),
            "role": "production",
            "production_category": cat,
            "production_category_label": meta["label"],
            "production_role": u.get("production_role") or (meta["roles"][0] if meta["roles"] else None),
            "services": u.get("services") or meta["roles"][:3],
            "experience_years": _num(u.get("experience_years")),
            "base_rate": _num(u.get("base_rate")),
            "availability": u.get("availability") or "available",
            "languages": u.get("languages") or [],
            "portfolio": u.get("portfolio") or [],
            "previous_work": u.get("previous_work") or [],
            "city": u.get("city"),
            "state": u.get("state"),
            "country": u.get("country") or "India",
            "location": u.get("location") or u.get("city"),
            "in_house": bool(u.get("in_house")),
            "rating": _num(u.get("rating")),
            "reviews_count": u.get("reviews_count") or 0,
            "distance_km": dist,
            "wishlisted": bool(wishlist_ids and u.get("id") in wishlist_ids),
            "created_at": u.get("created_at"),
        }

    async def _wishlist_ids(user_id: str, target_type: Optional[str] = None) -> set:
        q: Dict[str, Any] = {"user_id": user_id}
        if target_type:
            q["target_type"] = target_type
        rows = await db.wishlists.find(q, {"_id": 0, "target_id": 1}).to_list(2000)
        return {r["target_id"] for r in rows if r.get("target_id")}

    def _sort_creators(cards: List[dict], sort: str, origin: Optional[dict] = None) -> List[dict]:
        key = (sort or "engagement").lower()
        if key in ("engagement", "highest_engagement", "engagement_rate"):
            cards.sort(key=lambda c: _num(c.get("engagement_rate"), -1) or -1, reverse=True)
        elif key in ("newest", "new"):
            cards.sort(key=lambda c: c.get("created_at") or "", reverse=True)
        elif key in ("cost_asc", "price_asc", "cost_low"):
            cards.sort(key=lambda c: _num(c.get("base_rate"), 1e18) or 1e18)
        elif key in ("cost_desc", "price_desc", "cost_high"):
            cards.sort(key=lambda c: _num(c.get("base_rate"), -1) or -1, reverse=True)
        elif key == "nearest":
            cards.sort(key=lambda c: _num(c.get("distance_km"), 1e9) or 1e9)
        elif key in ("followers",):
            cards.sort(key=lambda c: _num(c.get("followers"), -1) or -1, reverse=True)
        elif key in ("quality", "roi"):
            cards.sort(
                key=lambda c: _num((c.get("campaign_kpis") or {}).get("avg_roas"), -1)
                or _num(c.get("engagement_rate"), -1)
                or -1,
                reverse=True,
            )
        return cards

    def _mongo_creators(body: CreatorDirectoryQuery) -> Dict[str, Any]:
        filt: Dict[str, Any] = {"role": "influencer", "banned": {"$ne": True}}
        ands: List[Dict[str, Any]] = []
        cats = list(body.categories or []) + list(body.niches or [])
        cats = [c for c in cats if c]
        if cats:
            rx = "|".join(re.escape(c) for c in cats)
            ands.append({"$or": [
                {"niches": {"$in": cats}},
                {"category": {"$regex": rx, "$options": "i"}},
                {"niches": {"$elemMatch": {"$regex": rx, "$options": "i"}}},
            ]})
        if body.q:
            rx = re.escape(body.q)
            ands.append({"$or": [
                {"name": {"$regex": rx, "$options": "i"}},
                {"username": {"$regex": rx, "$options": "i"}},
                {"handle": {"$regex": rx, "$options": "i"}},
                {"bio": {"$regex": rx, "$options": "i"}},
            ]})
        if body.city:
            filt["city"] = {"$regex": re.escape(body.city), "$options": "i"}
        if body.state:
            filt["state"] = {"$regex": re.escape(body.state), "$options": "i"}
        if body.country:
            ands.append({"$or": [
                {"country": {"$regex": re.escape(body.country), "$options": "i"}},
                {"location": {"$regex": re.escape(body.country), "$options": "i"}},
            ]})
        fol: Dict[str, Any] = {}
        if body.followers_min is not None:
            fol["$gte"] = float(body.followers_min)
        if body.followers_max is not None:
            fol["$lte"] = float(body.followers_max)
        if fol:
            filt["followers"] = fol
        price: Dict[str, Any] = {}
        if body.price_min is not None:
            price["$gte"] = float(body.price_min)
        if body.price_max is not None:
            price["$lte"] = float(body.price_max)
        if price:
            filt["base_rate"] = price
        if ands:
            filt["$and"] = ands
        return filt

    # ---------- Wishlist ----------
    @api_router.post("/wishlist")
    async def wishlist_mutate(body: WishlistBody, current: dict = Depends(get_current_user)):
        t = (body.target_type or "influencer").lower()
        if t == "creator":
            t = "influencer"
        if t not in WISHLIST_TYPES:
            raise HTTPException(status_code=400, detail="Invalid target_type")
        existing = await db.wishlists.find_one(
            {"user_id": current["id"], "target_id": body.target_id, "target_type": t}
        )
        action = (body.action or "add").lower()
        if action == "toggle":
            action = "remove" if existing else "add"
        if action == "remove":
            await db.wishlists.delete_one(
                {"user_id": current["id"], "target_id": body.target_id, "target_type": t}
            )
            return {"ok": True, "wishlisted": False}
        if not existing:
            await db.wishlists.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current["id"],
                "target_id": body.target_id,
                "target_type": t,
                "created_at": now_iso(),
            })
        return {"ok": True, "wishlisted": True}

    @api_router.get("/wishlist")
    async def wishlist_list(
        target_type: Optional[str] = None,
        current: dict = Depends(get_current_user),
    ):
        q: Dict[str, Any] = {"user_id": current["id"]}
        if target_type:
            tt = target_type.lower()
            if tt == "creator":
                tt = "influencer"
            q["target_type"] = tt
        rows = await db.wishlists.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
        items = []
        for r in rows:
            tid = r.get("target_id")
            tt = r.get("target_type")
            user = await db.users.find_one({"id": tid}, {"_id": 0, "password_hash": 0})
            if not user:
                continue
            if tt in ("influencer", "creator"):
                card = _creator_card(user, wishlist_ids={tid})
            elif tt == "brand":
                card = _brand_card(user, wishlist_ids={tid})
            elif tt == "production":
                card = _production_card(user, wishlist_ids={tid})
            else:
                card = _strip(user)
            items.append({**r, "profile": card})
        return {"items": items, "total": len(items)}

    @api_router.get("/wishlist/ids")
    async def wishlist_ids(current: dict = Depends(get_current_user)):
        rows = await db.wishlists.find({"user_id": current["id"]}, {"_id": 0, "target_id": 1, "target_type": 1}).to_list(2000)
        by_type: Dict[str, List[str]] = {}
        for r in rows:
            by_type.setdefault(r.get("target_type") or "influencer", []).append(r["target_id"])
        return {"ids": by_type}

    # ---------- Creators directory (enhanced filters + sort) ----------
    @api_router.post("/marketplace/creators")
    async def marketplace_creators(body: CreatorDirectoryQuery, current: dict = Depends(get_current_user)):
        mongo = _mongo_creators(body)
        page = max(1, int(body.page or 1))
        limit = min(60, max(1, int(body.limit or 24)))
        # Pull a wider window then filter engagement + sort in Python for combined filters
        users = await db.users.find(mongo, {"_id": 0, "password_hash": 0}).to_list(400)
        wl = await _wishlist_ids(current["id"], "influencer")
        cards = [_creator_card(u, origin=current, wishlist_ids=wl) for u in users]
        out = []
        for c in cards:
            er = c.get("engagement_rate")
            if body.engagement_min is not None:
                if er is None or er < float(body.engagement_min):
                    continue
            if body.engagement_max is not None:
                if er is None or er > float(body.engagement_max):
                    continue
            out.append(c)
        out = _sort_creators(out, body.sort, current)
        total = len(out)
        start = (page - 1) * limit
        return {
            "creators": out[start:start + limit],
            "total": total,
            "page": page,
            "limit": limit,
            "filters": body.model_dump(),
        }

    @api_router.get("/marketplace/creators")
    async def marketplace_creators_get(
        q: Optional[str] = None,
        category: Optional[str] = None,
        categories: Optional[str] = None,
        country: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        followers_min: Optional[float] = None,
        followers_max: Optional[float] = None,
        engagement_min: Optional[float] = None,
        engagement_max: Optional[float] = None,
        price_min: Optional[float] = None,
        price_max: Optional[float] = None,
        sort: str = "engagement",
        page: int = 1,
        limit: int = 24,
        current: dict = Depends(get_current_user),
    ):
        cats = []
        if category:
            cats.append(category)
        if categories:
            cats.extend([c.strip() for c in categories.split(",") if c.strip()])
        body = CreatorDirectoryQuery(
            q=q, categories=cats, country=country, state=state, city=city,
            followers_min=followers_min, followers_max=followers_max,
            engagement_min=engagement_min, engagement_max=engagement_max,
            price_min=price_min, price_max=price_max, sort=sort, page=page, limit=limit,
        )
        return await marketplace_creators(body, current)

    # ---------- Brands discovery (for creators) ----------
    @api_router.post("/marketplace/brands")
    async def marketplace_brands(body: BrandDirectoryQuery, current: dict = Depends(get_current_user)):
        filt: Dict[str, Any] = {"role": "owner", "banned": {"$ne": True}}
        ands: List[Dict[str, Any]] = []
        inds = list(body.industries or [])
        if body.industry:
            inds.append(body.industry)
        if inds:
            rx = "|".join(re.escape(i) for i in inds)
            ands.append({"$or": [
                {"industry": {"$regex": rx, "$options": "i"}},
                {"category": {"$regex": rx, "$options": "i"}},
            ]})
        if body.q:
            rx = re.escape(body.q)
            ands.append({"$or": [
                {"name": {"$regex": rx, "$options": "i"}},
                {"company": {"$regex": rx, "$options": "i"}},
                {"bio": {"$regex": rx, "$options": "i"}},
            ]})
        if body.city:
            filt["city"] = {"$regex": re.escape(body.city), "$options": "i"}
        if body.state:
            filt["state"] = {"$regex": re.escape(body.state), "$options": "i"}
        if body.country:
            filt["country"] = {"$regex": re.escape(body.country), "$options": "i"}
        if ands:
            filt["$and"] = ands
        users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).to_list(300)
        wl = await _wishlist_ids(current["id"], "brand")
        cards = []
        for u in users:
            camps = await db.campaigns.find({"owner_id": u["id"]}, {"_id": 0}).to_list(100)
            active = [c for c in camps if (c.get("status") or "").lower() in ("open", "active", "live", "published")]
            prev = [c for c in camps if c not in active]
            budgets = [_num(c.get("budget"), 0) or 0 for c in camps]
            hired = set()
            for c in camps:
                for cid in (c.get("hired_creators") or c.get("creator_ids") or []):
                    hired.add(cid)
            cards.append(_brand_card(u, wl, {
                "active_campaigns": len(active),
                "previous_campaigns": len(prev),
                "avg_budget": (sum(budgets) / len(budgets)) if budgets else None,
                "creators_hired": len(hired),
            }))
        sort = (body.sort or "newest").lower()
        if sort == "name":
            cards.sort(key=lambda c: (c.get("company") or c.get("name") or "").lower())
        elif sort == "campaigns":
            cards.sort(key=lambda c: c.get("active_campaigns") or 0, reverse=True)
        else:
            cards.sort(key=lambda c: c.get("created_at") or "", reverse=True)
        page = max(1, int(body.page or 1))
        limit = min(60, max(1, int(body.limit or 24)))
        start = (page - 1) * limit
        return {"brands": cards[start:start + limit], "total": len(cards), "page": page, "limit": limit}

    @api_router.get("/marketplace/brands")
    async def marketplace_brands_get(
        q: Optional[str] = None,
        industry: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        sort: str = "newest",
        page: int = 1,
        limit: int = 24,
        current: dict = Depends(get_current_user),
    ):
        return await marketplace_brands(
            BrandDirectoryQuery(q=q, industry=industry, city=city, state=state, country=country, sort=sort, page=page, limit=limit),
            current,
        )

    @api_router.get("/marketplace/brands/{brand_id}")
    async def marketplace_brand_detail(brand_id: str, current: dict = Depends(get_current_user)):
        u = await db.users.find_one({"id": brand_id, "role": "owner"}, {"_id": 0, "password_hash": 0})
        if not u:
            raise HTTPException(status_code=404, detail="Brand not found")
        camps = await db.campaigns.find({"$or": [{"owner_id": brand_id}, {"brand_id": brand_id}]}, {"_id": 0}).sort("created_at", -1).to_list(100)
        active = [c for c in camps if (c.get("status") or "").lower() in ("open", "active", "live", "published", "")]
        prev = [c for c in camps if c not in active]
        perf = await db.campaign_performance.find({"brand_id": brand_id}, {"_id": 0}).sort("campaign_date", -1).to_list(50)
        hired_ids = set()
        for c in camps:
            for cid in (c.get("hired_creators") or []):
                hired_ids.add(cid)
        for p in perf:
            if p.get("creator_id"):
                hired_ids.add(p["creator_id"])
        creators = []
        if hired_ids:
            creators = await db.users.find(
                {"id": {"$in": list(hired_ids)}, "role": "influencer"},
                {"_id": 0, "password_hash": 0, "name": 1, "avatar": 1, "handle": 1, "id": 1, "niches": 1},
            ).to_list(40)
        wl = await _wishlist_ids(current["id"], "brand")
        card = _brand_card(u, wl, {
            "active_campaigns": len(active),
            "previous_campaigns": len(prev),
            "creators_hired": len(hired_ids),
        })
        revs = await db.reviews.find({"target_id": brand_id}, {"_id": 0}).to_list(100)
        rating = round(sum(r.get("rating", 0) for r in revs) / len(revs), 1) if revs else None
        return {
            **card,
            "overview": u.get("bio") or u.get("company_overview") or "",
            "active_campaign_list": active[:20],
            "previous_campaign_list": prev[:20],
            "campaign_performance": perf,
            "creators_hired_list": creators,
            "objectives": list({c.get("objective") or c.get("goal") for c in camps if c.get("objective") or c.get("goal")}),
            "rating": rating,
            "reviews_count": len(revs),
            "reviews": revs[:20],
        }

    # ---------- Similar creators + combo hire ----------
    @api_router.post("/marketplace/creators/similar")
    async def similar_creators(body: SimilarCreatorsBody, current: dict = Depends(get_current_user)):
        await require_role(current, ["owner", "agent", "admin"])
        base = await db.users.find_one({"id": body.creator_id, "role": "influencer"}, {"_id": 0, "password_hash": 0})
        if not base:
            raise HTTPException(status_code=404, detail="Creator not found")
        niches = set(base.get("niches") or [])
        if base.get("category"):
            niches.add(base.get("category"))
        fol = _followers(base)
        er = _engagement(base) or 0
        rate = _num(base.get("base_rate"), 0) or 0
        city = (base.get("city") or "").lower()
        content = set(base.get("content_type") or base.get("content_types") or [])
        candidates = await db.users.find(
            {"role": "influencer", "id": {"$ne": body.creator_id}, "banned": {"$ne": True}},
            {"_id": 0, "password_hash": 0},
        ).to_list(400)
        scored = []
        for u in candidates:
            score = 0.0
            un = set(u.get("niches") or [])
            if u.get("category"):
                un.add(u.get("category"))
            overlap = len(niches & un)
            score += overlap * 18
            uf, ue = _followers(u), _engagement(u) or 0
            if fol > 0:
                ratio = abs(uf - fol) / max(fol, 1)
                score += max(0, 20 - ratio * 20)
            score += max(0, 15 - abs(ue - er) * 2)
            ur = _num(u.get("base_rate"), 0) or 0
            if rate > 0 and ur > 0:
                score += max(0, 12 - abs(ur - rate) / max(rate, 1) * 12)
            if city and (u.get("city") or "").lower() == city:
                score += 14
            elif city and (u.get("state") or "") == (base.get("state") or ""):
                score += 6
            uc = set(u.get("content_type") or u.get("content_types") or [])
            score += len(content & uc) * 8
            # Audience similarity (age/gender buckets if present)
            ba = (base.get("audience") or base.get("audience_demographics") or {})
            ua = (u.get("audience") or u.get("audience_demographics") or {})
            if ba.get("primary_age") and ba.get("primary_age") == ua.get("primary_age"):
                score += 10
            if ba.get("gender_skew") and ba.get("gender_skew") == ua.get("gender_skew"):
                score += 6
            scored.append((score, u))
        scored.sort(key=lambda x: x[0], reverse=True)
        wl = await _wishlist_ids(current["id"], "influencer")
        limit = min(20, max(1, int(body.limit or 12)))
        creators = []
        for score, u in scored[:limit]:
            card = _creator_card(u, origin=current, wishlist_ids=wl)
            card["similarity_score"] = round(score, 1)
            creators.append(card)
        return {"seed": _creator_card(base, origin=current, wishlist_ids=wl), "creators": creators}

    @api_router.post("/marketplace/combo-invite")
    async def combo_invite(body: ComboInviteBody, current: dict = Depends(get_current_user)):
        await require_role(current, ["owner", "agent", "admin"])
        camp = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
        if not camp:
            raise HTTPException(status_code=404, detail="Campaign not found")
        ids = list(dict.fromkeys(body.creator_ids))
        if len(ids) not in (5, 10) and not (1 <= len(ids) <= 20):
            # Allow 5 or 10 preferred; still accept other sizes 1–20 for flexibility
            pass
        creators = await db.users.find(
            {"id": {"$in": ids}, "role": "influencer"},
            {"_id": 0, "password_hash": 0},
        ).to_list(40)
        if len(creators) != len(ids):
            raise HTTPException(status_code=400, detail="One or more creators not found")
        offers = body.offer_per_creator or {}
        default = body.default_offer
        members = []
        total = 0.0
        invitations = []
        for c in creators:
            offer = _num(offers.get(c["id"]), None)
            if offer is None:
                offer = default if default is not None else _num(c.get("base_rate"), 0) or 0
            total += float(offer)
            members.append({
                "creator_id": c["id"],
                "name": c.get("name"),
                "handle": c.get("handle") or c.get("username"),
                "avatar": c.get("avatar"),
                "offer": float(offer),
                "status": "pending",
            })
            # Individual invitation so each creator can accept/reject
            existing = await db.invitations.find_one({"campaign_id": body.campaign_id, "creator_id": c["id"]})
            if existing:
                invitations.append(existing.get("id"))
                continue
            inv = {
                "id": str(uuid.uuid4()),
                "campaign_id": body.campaign_id,
                "creator_id": c["id"],
                "owner_id": current["id"],
                "brand_id": current["id"],
                "offer": int(offer),
                "message": body.message or f"Group campaign invite for {camp.get('title')}",
                "status": "pending",
                "combo_group": True,
                "created_at": now_iso(),
            }
            await db.invitations.insert_one(inv)
            invitations.append(inv["id"])
            try:
                await push_notification(
                    c["id"], "invitation",
                    f"Group campaign invite: {camp.get('title')}",
                    {"campaign_id": camp["id"], "invitation_id": inv["id"], "combo": True},
                )
            except Exception:
                pass
        combo = {
            "id": str(uuid.uuid4()),
            "brand_id": current["id"],
            "campaign_id": body.campaign_id,
            "campaign_title": camp.get("title"),
            "members": members,
            "creator_ids": ids,
            "invitation_ids": invitations,
            "message": body.message,
            "estimated_total_cost": total,
            "status": "pending",
            "created_at": now_iso(),
        }
        await db.creator_combos.insert_one(dict(combo))
        combo.pop("_id", None)
        return combo

    @api_router.get("/marketplace/combos")
    async def list_combos(current: dict = Depends(get_current_user)):
        if current.get("role") in ("owner", "agent", "admin"):
            rows = await db.creator_combos.find({"brand_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
        else:
            rows = await db.creator_combos.find({"creator_ids": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
        return {"combos": rows}

    # ---------- Past campaigns / ROI ----------
    @api_router.get("/marketplace/creators/{creator_id}/past-campaigns")
    async def past_campaigns(creator_id: str, current: dict = Depends(get_current_user)):
        rows = await db.campaign_performance.find(
            {"creator_id": creator_id}, {"_id": 0}
        ).sort("campaign_date", -1).to_list(50)
        if not rows:
            # Derive light stubs from completed invitations/applications if any
            apps = await db.applications.find(
                {"influencer_id": creator_id, "status": {"$in": ["accepted", "completed", "hired"]}},
                {"_id": 0},
            ).to_list(20)
            for a in apps:
                camp = await db.campaigns.find_one({"id": a.get("campaign_id")}, {"_id": 0})
                if not camp:
                    continue
                rows.append({
                    "id": f"derived-{a.get('id')}",
                    "creator_id": creator_id,
                    "campaign_name": camp.get("title"),
                    "brand_name": camp.get("brand") or camp.get("company"),
                    "campaign_category": (camp.get("niches") or [None])[0] or camp.get("category"),
                    "campaign_objective": camp.get("objective") or camp.get("goal") or camp.get("description"),
                    "campaign_date": camp.get("created_at"),
                    "derived": True,
                })
        # Summary KPIs
        def avg(key):
            vals = [_num(r.get(key)) for r in rows if _num(r.get(key)) is not None]
            return round(sum(vals) / len(vals), 2) if vals else None

        summary = {
            "completed_campaigns": len(rows),
            "avg_reach": avg("total_reach"),
            "avg_views": avg("total_views"),
            "avg_engagement": avg("total_engagement"),
            "avg_engagement_rate": avg("engagement_rate"),
            "avg_roi": avg("roi"),
            "avg_roas": avg("roas"),
            "success_rate": None,
        }
        successes = [r for r in rows if (_num(r.get("roas")) or 0) >= 1 or (_num(r.get("engagement_rate")) or 0) >= 3]
        if rows:
            summary["success_rate"] = round(100 * len(successes) / len(rows), 1)
        return {"campaigns": rows, "summary": summary}

    @api_router.get("/marketplace/creators/{creator_id}/roi-profile")
    async def roi_profile(creator_id: str, current: dict = Depends(get_current_user)):
        user = await db.users.find_one({"id": creator_id, "role": "influencer"}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Creator not found")
        past = await past_campaigns(creator_id, current)
        card = _creator_card(user)
        return {
            **card,
            "kpis": {
                "followers": card["followers"],
                "average_reach": past["summary"].get("avg_reach") or card["campaign_kpis"].get("avg_reach"),
                "average_views": past["summary"].get("avg_views") or card["campaign_kpis"].get("avg_views"),
                "engagement_rate": card["engagement_rate"],
                "average_campaign_reach": past["summary"].get("avg_reach"),
                "average_campaign_engagement": past["summary"].get("avg_engagement"),
                "campaign_success_rate": past["summary"].get("success_rate"),
                "completed_campaigns": past["summary"].get("completed_campaigns"),
                "average_roi": past["summary"].get("avg_roi"),
                "average_roas": past["summary"].get("avg_roas"),
                "audience_demographics": user.get("audience") or user.get("audience_demographics") or {},
            },
            "top_campaigns": (past.get("campaigns") or [])[:5],
            "past_campaigns": past.get("campaigns") or [],
        }

    # ---------- Production team ----------
    @api_router.get("/marketplace/production/categories")
    async def production_categories():
        return {
            "categories": [
                {"id": k, "label": v["label"], "roles": v["roles"]}
                for k, v in PRODUCTION_CATEGORIES.items()
            ]
        }

    @api_router.post("/marketplace/production")
    async def marketplace_production(body: ProductionDirectoryQuery, current: dict = Depends(get_current_user)):
        filt: Dict[str, Any] = {"role": "production", "banned": {"$ne": True}}
        ands: List[Dict[str, Any]] = []
        cats = list(body.categories or [])
        if body.category:
            cats.append(body.category)
        if cats:
            filt["production_category"] = {"$in": cats}
        if body.q:
            rx = re.escape(body.q)
            ands.append({"$or": [
                {"name": {"$regex": rx, "$options": "i"}},
                {"bio": {"$regex": rx, "$options": "i"}},
                {"production_role": {"$regex": rx, "$options": "i"}},
                {"services": {"$regex": rx, "$options": "i"}},
            ]})
        if body.city:
            filt["city"] = {"$regex": re.escape(body.city), "$options": "i"}
        if body.state:
            filt["state"] = {"$regex": re.escape(body.state), "$options": "i"}
        if body.country:
            filt["country"] = {"$regex": re.escape(body.country), "$options": "i"}
        if body.in_house_only:
            filt["in_house"] = True
        price: Dict[str, Any] = {}
        if body.price_min is not None:
            price["$gte"] = float(body.price_min)
        if body.price_max is not None:
            price["$lte"] = float(body.price_max)
        if price:
            filt["base_rate"] = price
        if ands:
            filt["$and"] = ands
        users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).to_list(300)
        wl = await _wishlist_ids(current["id"], "production")
        cards = [_production_card(u, wl, current) for u in users]
        sort = (body.sort or "rating").lower()
        if sort in ("cost_asc", "price_asc"):
            cards.sort(key=lambda c: _num(c.get("base_rate"), 1e18) or 1e18)
        elif sort in ("cost_desc", "price_desc"):
            cards.sort(key=lambda c: _num(c.get("base_rate"), -1) or -1, reverse=True)
        elif sort == "nearest":
            cards.sort(key=lambda c: _num(c.get("distance_km"), 1e9) or 1e9)
        elif sort == "newest":
            cards.sort(key=lambda c: c.get("created_at") or "", reverse=True)
        else:
            cards.sort(key=lambda c: _num(c.get("rating"), -1) or -1, reverse=True)
        page = max(1, int(body.page or 1))
        limit = min(60, max(1, int(body.limit or 24)))
        start = (page - 1) * limit
        return {"members": cards[start:start + limit], "total": len(cards), "page": page, "limit": limit}

    @api_router.get("/marketplace/production")
    async def marketplace_production_get(
        q: Optional[str] = None,
        category: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        price_min: Optional[float] = None,
        price_max: Optional[float] = None,
        in_house_only: Optional[bool] = None,
        sort: str = "rating",
        page: int = 1,
        limit: int = 24,
        current: dict = Depends(get_current_user),
    ):
        return await marketplace_production(
            ProductionDirectoryQuery(
                q=q, category=category, city=city, state=state, country=country,
                price_min=price_min, price_max=price_max, in_house_only=in_house_only,
                sort=sort, page=page, limit=limit,
            ),
            current,
        )

    @api_router.get("/marketplace/production/{member_id}")
    async def production_detail(member_id: str, current: dict = Depends(get_current_user)):
        u = await db.users.find_one({"id": member_id, "role": "production"}, {"_id": 0, "password_hash": 0})
        if not u:
            raise HTTPException(status_code=404, detail="Production member not found")
        wl = await _wishlist_ids(current["id"], "production")
        revs = await db.reviews.find({"target_id": member_id}, {"_id": 0}).to_list(50)
        card = _production_card(u, wl, current)
        if revs:
            card["rating"] = round(sum(r.get("rating", 0) for r in revs) / len(revs), 1)
            card["reviews_count"] = len(revs)
        return {**card, "reviews": revs[:20], "description": u.get("bio")}

    @api_router.post("/marketplace/hire-requests")
    async def create_hire_request(body: HireRequestBody, current: dict = Depends(get_current_user)):
        await require_role(current, ["owner", "influencer", "agent", "admin"])
        prod = await db.users.find_one({"id": body.production_id, "role": "production"})
        if not prod:
            raise HTTPException(status_code=404, detail="Production member not found")
        doc = {
            "id": str(uuid.uuid4()),
            "requester_id": current["id"],
            "requester_name": current.get("name") or current.get("company"),
            "requester_role": current.get("role"),
            "production_id": body.production_id,
            "production_name": prod.get("name"),
            "message": body.message,
            "service": body.service,
            "budget": body.budget,
            "campaign_id": body.campaign_id,
            "status": "pending",
            "quote": None,
            "created_at": now_iso(),
        }
        await db.hire_requests.insert_one(dict(doc))
        try:
            await push_notification(
                body.production_id, "hire_request",
                f"New hire request from {doc['requester_name']}",
                {"hire_request_id": doc["id"]},
            )
        except Exception:
            pass
        doc.pop("_id", None)
        return doc

    @api_router.get("/marketplace/hire-requests")
    async def list_hire_requests(current: dict = Depends(get_current_user)):
        role = current.get("role")
        if role == "admin":
            q: Dict[str, Any] = {}
        elif role == "production":
            q = {"production_id": current["id"]}
        else:
            q = {"requester_id": current["id"]}
        rows = await db.hire_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
        return {"requests": rows}

    @api_router.post("/marketplace/hire-requests/{req_id}/action")
    async def act_hire_request(req_id: str, body: HireActionBody, current: dict = Depends(get_current_user)):
        req = await db.hire_requests.find_one({"id": req_id})
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        is_prod = req.get("production_id") == current["id"]
        is_admin = current.get("role") == "admin"
        if not (is_prod or is_admin):
            raise HTTPException(status_code=403, detail="Forbidden")
        status = (body.status or "").lower()
        if status not in ("accepted", "rejected", "quoted", "completed"):
            raise HTTPException(status_code=400, detail="Invalid status")
        update: Dict[str, Any] = {"status": status, "updated_at": now_iso()}
        if body.quote is not None:
            update["quote"] = float(body.quote)
        if body.note:
            update["note"] = body.note
        await db.hire_requests.update_one({"id": req_id}, {"$set": update})
        try:
            await push_notification(
                req["requester_id"], "hire_request",
                f"Hire request {status}",
                {"hire_request_id": req_id, "status": status},
            )
        except Exception:
            pass
        return {"ok": True, **update}

    # ---------- Admin production management ----------
    @api_router.get("/admin/production")
    async def admin_list_production(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        users = await db.users.find({"role": "production"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
        reqs = await db.hire_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {
            "members": [_production_card(u) for u in users],
            "hire_requests": reqs,
            "categories": [
                {"id": k, "label": v["label"], "roles": v["roles"]}
                for k, v in PRODUCTION_CATEGORIES.items()
            ],
        }

    @api_router.post("/admin/production")
    async def admin_create_production(body: ProductionProfileBody, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        cat = body.production_category if body.production_category in PRODUCTION_CATEGORIES else "camera"
        email = (body.email or f"prod_{uuid.uuid4().hex[:8]}@flugr.studio").lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Email already registered")
        uid = str(uuid.uuid4())
        username = re.sub(r"[^a-z0-9]", "", (body.name or "crew").lower())[:16] + uid[:4]
        pwd = body.password or f"Prod@{uid[:6]}"
        doc = {
            "id": uid,
            "email": email,
            "username": username,
            "password_hash": hash_password(pwd),
            "name": body.name,
            "role": "production",
            "production_category": cat,
            "production_role": body.production_role or PRODUCTION_CATEGORIES[cat]["roles"][0],
            "services": body.services or PRODUCTION_CATEGORIES[cat]["roles"][:3],
            "city": body.city,
            "state": body.state,
            "country": body.country or "India",
            "bio": body.bio or "",
            "experience_years": body.experience_years,
            "base_rate": body.base_rate,
            "availability": body.availability or "available",
            "languages": body.languages or ["English", "Hindi"],
            "portfolio": body.portfolio or [],
            "previous_work": [],
            "avatar": body.avatar,
            "in_house": bool(body.in_house),
            "rating": 4.6,
            "reviews_count": 0,
            "onboarding_status": "completed",
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(doc))
        if write_audit_log:
            try:
                await write_audit_log(current["id"], "production_create", details=body.name, meta={"id": uid, "in_house": body.in_house})
            except Exception:
                pass
        out = _production_card(doc)
        out["temp_password"] = pwd if not body.password else None
        return out

    @api_router.patch("/admin/production/{member_id}")
    async def admin_update_production(member_id: str, body: ProductionUpdateBody, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        u = await db.users.find_one({"id": member_id, "role": "production"})
        if not u:
            raise HTTPException(status_code=404, detail="Not found")
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        if data:
            data["updated_at"] = now_iso()
            await db.users.update_one({"id": member_id}, {"$set": data})
        updated = await db.users.find_one({"id": member_id}, {"_id": 0, "password_hash": 0})
        return _production_card(updated)

    @api_router.delete("/admin/production/{member_id}")
    async def admin_delete_production(member_id: str, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        res = await db.users.delete_one({"id": member_id, "role": "production"})
        if not res.deleted_count:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    # ---------- Seed marketplace demo data ----------
    @api_router.post("/marketplace/seed-demo")
    async def seed_marketplace_demo(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        result = await seed_marketplace_data(db, hash_password=hash_password, now_iso=now_iso)
        return result

    return ensure_indexes


async def seed_marketplace_data(db, *, hash_password, now_iso) -> dict:
    """Idempotent demo data for marketplace features. Does not wipe existing users."""
    created = {"production": 0, "performance": 0, "brands_enriched": 0, "creators_enriched": 0}

    def _fol(u: dict) -> float:
        try:
            return float(u.get("followers") or 80000)
        except (TypeError, ValueError):
            return 80000.0

    # Enrich existing influencers with rates / engagement / audience if missing
    creators = await db.users.find({"role": "influencer"}, {"_id": 0}).to_list(200)
    for i, c in enumerate(creators):
        updates: Dict[str, Any] = {}
        if c.get("base_rate") is None:
            fol = _fol(c)
            updates["base_rate"] = int(min(250000, max(8000, fol * 0.08)))
        if c.get("engagement_rate") is None:
            updates["engagement_rate"] = round(random.uniform(2.5, 9.5), 2)
        if not c.get("audience") and not c.get("audience_demographics"):
            updates["audience"] = {
                "primary_age": random.choice(["18-24", "25-34", "35-44"]),
                "gender_skew": random.choice(["female", "male", "balanced"]),
                "top_cities": [c.get("city") or "Mumbai", "Delhi", "Bangalore"][:3],
            }
        if not c.get("content_type") and not c.get("content_types"):
            updates["content_type"] = random.sample(
                ["reels", "stories", "youtube", "shorts", "static"], k=2
            )
        if not c.get("country"):
            updates["country"] = "India"
        if updates:
            await db.users.update_one({"id": c["id"]}, {"$set": updates})
            created["creators_enriched"] += 1

    brands = await db.users.find({"role": "owner"}, {"_id": 0}).to_list(100)
    industries = ["Fashion", "Beauty", "Tech", "FMCG", "Food & Beverage", "Travel", "Fitness", "Finance"]
    for i, b in enumerate(brands):
        updates = {}
        if not b.get("industry"):
            updates["industry"] = industries[i % len(industries)]
        if not b.get("country"):
            updates["country"] = "India"
        if not b.get("website"):
            company = (b.get("company") or b.get("name") or "brand").lower().replace(" ", "")
            updates["website"] = f"https://www.{company}.example"
        if updates:
            await db.users.update_one({"id": b["id"]}, {"$set": updates})
            created["brands_enriched"] += 1

    # In-house + external production team (demo logins: password demo1234)
    # Primary desk + one per category for easy testing.
    prod_seeds = [
        # email, username, name, category, role, city, state, in_house, rate, langs
        ("production@cr8.studio", "proddemo", "Production Desk Demo", "camera", "Cameraman", "Mumbai", "Maharashtra", True, 18000, ["English", "Hindi"]),
        ("camera@cr8.studio", "camerademo", "Aarav Lens", "camera", "Cameraman", "Mumbai", "Maharashtra", True, 18000, ["English", "Hindi"]),
        ("videographer@cr8.studio", "videodemo", "Pixel Crew Studio", "camera", "Videographer", "Hyderabad", "Telangana", True, 25000, ["English", "Telugu"]),
        ("photo.team@cr8.studio", "photodemo", "Frame & Focus", "camera", "Photography team", "Bangalore", "Karnataka", False, 22000, ["English", "Kannada"]),
        ("editor@cr8.studio", "editordemo", "ReelCut Editors", "editing", "Reels/Shorts editor", "Delhi", "Delhi", True, 12000, ["English", "Hindi"]),
        ("motion@cr8.studio", "motiondemo", "MotionForge", "editing", "Motion graphics editor", "Pune", "Maharashtra", True, 20000, ["English", "Marathi"]),
        ("youtube.edit@cr8.studio", "yteditdemo", "YouTube Finish Lab", "editing", "YouTube editor", "Chennai", "Tamil Nadu", False, 15000, ["English", "Tamil"]),
        ("voice@cr8.studio", "voicedemo", "Voice of Priya", "voiceover", "Female voice artist", "Mumbai", "Maharashtra", True, 8000, ["English", "Hindi"]),
        ("voice.male@cr8.studio", "voicemaledemo", "Baritone Raj", "voiceover", "Male voice artist", "Hyderabad", "Telangana", True, 9000, ["English", "Telugu", "Hindi"]),
        ("voice.regional@cr8.studio", "voiceregdemo", "Regional Tone Co", "voiceover", "Regional-language voice artist", "Kochi", "Kerala", False, 7500, ["English", "Malayalam"]),
        ("script@cr8.studio", "scriptdemo", "ScriptLab Ads", "script", "Advertisement scripts", "Bangalore", "Karnataka", True, 10000, ["English", "Hindi"]),
        ("storyboard@cr8.studio", "storydemo", "Storyboard North", "script", "Storyboards", "Delhi", "Delhi", True, 14000, ["English", "Hindi"]),
        ("reels.writer@cr8.studio", "reelwriterdemo", "Reel Writers HQ", "script", "Reel scripts", "Jaipur", "Rajasthan", False, 6000, ["English", "Hindi"]),
    ]
    demo_hash = hash_password("demo1234")
    created["production_accounts"] = []
    for email, username, name, cat, role, city, state, in_house, rate, langs in prod_seeds:
        existing = await db.users.find_one({"email": email})
        if existing:
            # Keep password aligned with other demo desks
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "password_hash": demo_hash,
                    "role": "production",
                    "production_category": cat,
                    "production_role": role,
                    "in_house": in_house,
                    "base_rate": rate,
                    "city": city,
                    "state": state,
                    "onboarding_status": "completed",
                }},
            )
            created["production_accounts"].append({"email": email, "username": username, "updated": True})
            continue
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "username": username,
            "password_hash": demo_hash,
            "name": name,
            "role": "production",
            "production_category": cat,
            "production_role": role,
            "services": PRODUCTION_CATEGORIES[cat]["roles"][:3],
            "city": city,
            "state": state,
            "country": "India",
            "bio": f"{role} specializing in brand and creator production. {PRODUCTION_CATEGORIES[cat]['label']}.",
            "experience_years": random.randint(3, 12),
            "base_rate": rate,
            "availability": "available",
            "languages": langs,
            "portfolio": [
                "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800",
                "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800",
                "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800",
            ],
            "previous_work": [
                {"title": "Brand launch film", "client": "Demo Brand", "year": 2025},
                {"title": "Creator collab package", "client": "Creator Desk", "year": 2024},
                {"title": "Festival campaign package", "client": "GlowCo", "year": 2024},
            ],
            "avatar": f"https://api.dicebear.com/7.x/shapes/svg?seed={username}",
            "in_house": in_house,
            "rating": round(random.uniform(4.2, 4.9), 1),
            "reviews_count": random.randint(4, 40),
            "onboarding_status": "completed",
            "created_at": now_iso(),
        })
        created["production"] += 1
        created["production_accounts"].append({"email": email, "username": username, "password": "demo1234", "created": True})

    # Keep legacy @flugr.production roster discoverable too (same password)
    legacy_prod = [
        ("Aarav Lens Legacy", "camera", "Cameraman", "Mumbai", "Maharashtra", True, 18000, ["English", "Hindi"]),
        ("Pixel Crew Legacy", "camera", "Videographer", "Hyderabad", "Telangana", True, 25000, ["English", "Telugu"]),
    ]
    for name, cat, role, city, state, in_house, rate, langs in legacy_prod:
        email = f"{re.sub(r'[^a-z0-9]', '', name.lower())}@flugr.production"
        if await db.users.find_one({"email": email}):
            continue
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "username": re.sub(r"[^a-z0-9]", "", name.lower())[:18],
            "password_hash": demo_hash,
            "name": name,
            "role": "production",
            "production_category": cat,
            "production_role": role,
            "services": PRODUCTION_CATEGORIES[cat]["roles"][:3],
            "city": city,
            "state": state,
            "country": "India",
            "bio": f"{role} — legacy demo roster entry.",
            "experience_years": random.randint(3, 12),
            "base_rate": rate,
            "availability": "available",
            "languages": langs,
            "portfolio": [
                "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800",
            ],
            "previous_work": [],
            "avatar": f"https://api.dicebear.com/7.x/shapes/svg?seed={uid[:8]}",
            "in_house": in_house,
            "rating": round(random.uniform(4.2, 4.9), 1),
            "reviews_count": random.randint(4, 20),
            "onboarding_status": "completed",
            "created_at": now_iso(),
        })
        created["production"] += 1

    # Campaign performance case studies for creators
    brand_names = [(b.get("company") or b.get("name"), b.get("id")) for b in brands] or [("Nike Demo", None), ("GlowCo", None)]
    objectives = ["Awareness", "Conversions", "App installs", "Product launch", "Engagement"]
    for c in creators[:12]:
        existing_n = await db.campaign_performance.count_documents({"creator_id": c["id"]})
        if existing_n >= 2:
            continue
        for j in range(2):
            brand_name, brand_id = brand_names[(hash(c["id"]) + j) % len(brand_names)]
            reach = int(_fol(c) * random.uniform(0.4, 2.2))
            views = int(reach * random.uniform(1.2, 2.8))
            eng = int(views * random.uniform(0.04, 0.12))
            er = round(100 * eng / max(reach, 1), 2)
            cost = int(c.get("base_rate") or random.randint(15000, 80000))
            revenue = int(cost * random.uniform(1.5, 5.5))
            roas = round(revenue / max(cost, 1), 2)
            doc = {
                "id": str(uuid.uuid4()),
                "creator_id": c["id"],
                "brand_id": brand_id,
                "campaign_name": f"{brand_name} — {random.choice(['Summer', 'Festive', 'Launch', 'Always-on'])} Campaign",
                "brand_name": brand_name,
                "campaign_category": (c.get("niches") or ["General"])[0],
                "campaign_objective": random.choice(objectives),
                "campaign_date": (datetime.now(timezone.utc) - timedelta(days=30 * (j + 1) + random.randint(0, 20))).date().isoformat(),
                "content_produced": random.choice(["Reels + Stories", "YouTube integration", "Static + Reel pack", "Shorts series"]),
                "posts_count": random.randint(2, 8),
                "total_reach": reach,
                "total_views": views,
                "total_impressions": int(reach * random.uniform(1.1, 1.6)),
                "total_engagement": eng,
                "engagement_rate": er,
                "likes": int(eng * 0.7),
                "comments": int(eng * 0.08),
                "shares": int(eng * 0.05),
                "saves": int(eng * 0.12),
                "clicks": int(reach * random.uniform(0.01, 0.04)),
                "leads": int(reach * random.uniform(0.002, 0.008)),
                "campaign_cost": cost,
                "revenue_generated": revenue,
                "roi": round((revenue - cost) / max(cost, 1), 2),
                "roas": roas,
                "key_outcome": random.choice([
                    "Exceeded reach goal by 28%",
                    "Top-performing reel in brand calendar",
                    "Strong conversion lift in target city",
                    "High save rate indicating purchase intent",
                ]),
                "brand_impact": random.choice([
                    "Improved aided awareness in 25–34 segment",
                    "Drove measurable ROAS above target",
                    "Expanded brand presence in regional markets",
                ]),
                "created_at": now_iso(),
            }
            await db.campaign_performance.insert_one(doc)
            created["performance"] += 1

        # Roll up KPIs onto user
        rows = await db.campaign_performance.find({"creator_id": c["id"]}, {"_id": 0}).to_list(20)
        if rows:
            def avg(k):
                vals = [float(r[k]) for r in rows if r.get(k) is not None]
                return round(sum(vals) / len(vals), 2) if vals else None
            await db.users.update_one({"id": c["id"]}, {"$set": {
                "campaign_kpis": {
                    "completed_campaigns": len(rows),
                    "avg_campaign_reach": avg("total_reach"),
                    "avg_campaign_engagement": avg("total_engagement"),
                    "avg_roi": avg("roi"),
                    "avg_roas": avg("roas"),
                    "success_rate": round(100 * len([r for r in rows if (r.get("roas") or 0) >= 1]) / len(rows), 1),
                    "avg_reach": avg("total_reach"),
                    "avg_views": avg("total_views"),
                }
            }})

    return {"ok": True, **created}
