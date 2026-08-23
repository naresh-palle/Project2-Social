"""
Creator Campaign Discovery Map — geo + budget-safe campaign pins for influencers.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field

from marketplace_features import CITY_COORDS, _coords_for, _haversine_km, _num


def _iso_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_date(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
        # YYYY-MM-DD or DD Mon YYYY-ish
        for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(s[:32], fmt)
            except ValueError:
                continue
    except Exception:
        return None
    return None


def _coords_for_campaign(camp: dict) -> Optional[Tuple[float, float]]:
    if camp.get("latitude") is not None and camp.get("longitude") is not None:
        try:
            return float(camp["latitude"]), float(camp["longitude"])
        except (TypeError, ValueError):
            pass
    if camp.get("lat") is not None and camp.get("lng") is not None:
        try:
            return float(camp["lat"]), float(camp["lng"])
        except (TypeError, ValueError):
            pass
    for key in ("location", "influencer_location", "city"):
        raw = (camp.get(key) or "").strip().lower()
        if not raw:
            continue
        # "Bangalore, India" / "Mumbai Metro" — match city tokens
        if raw in CITY_COORDS:
            return CITY_COORDS[raw]
        for part in re.split(r"[,/|\-–]+", raw):
            part = part.strip()
            if part in CITY_COORDS:
                return CITY_COORDS[part]
        for k, v in CITY_COORDS.items():
            if k in raw:
                return v
    return None


def _fallback_coords(camp: dict) -> Tuple[float, float]:
    """Place campaigns with no geo on an India-centered spiral so they still appear on the map."""
    seed = abs(hash(str(camp.get("id") or camp.get("title") or "c"))) % 10_000
    # Spread around central India so markers are distinct and findable when zoomed out
    base_lat, base_lng = 21.1465, 79.0882
    ring = (seed % 40) + 1
    angle = (seed % 360) * (math.pi / 180.0)
    dlat = (ring * 0.12) * math.cos(angle)
    dlng = (ring * 0.12) * math.sin(angle)
    return base_lat + dlat, base_lng + dlng


def _jitter_same_spot(lat: float, lng: float, camp_id: str) -> Tuple[float, float]:
    """Tiny offset so multiple campaigns in the same city aren't a single overlapping pin."""
    seed = abs(hash(str(camp_id))) % 997
    ang = (seed / 997.0) * 2 * math.pi
    r = 0.004 + (seed % 7) * 0.0015
    return lat + r * math.cos(ang), lng + r * math.sin(ang)


def format_budget_display(camp: dict) -> Dict[str, Any]:
    """Public budget label for creators — never leak hidden internal figures."""
    show = camp.get("show_budget_to_creator")
    if show is False or camp.get("show_budget_on_creator_map") is False:
        return {
            "budget_display": "View for details",
            "budget_type": "HIDDEN",
            "budget_value": None,
            "budget_label": "Budget available after selection",
        }

    per = _num(camp.get("budget_per_creator"))
    mn = _num(camp.get("minimum_budget") or camp.get("min_budget"))
    mx = _num(camp.get("maximum_budget") or camp.get("max_budget"))
    total = _num(camp.get("budget") or camp.get("total_budget"))
    payment = (camp.get("payment_type") or camp.get("campaign_type") or "paid").lower()

    if payment in ("negotiable", "tbd") or camp.get("budget_negotiable"):
        return {
            "budget_display": "Negotiable",
            "budget_type": "NEGOTIABLE",
            "budget_value": None,
            "budget_label": "Budget Negotiable",
        }

    def _compact(n: float) -> str:
        n = abs(float(n))
        if n >= 100_000:
            v = n / 100_000.0
            return f"₹{v:.0f}L" if abs(v - round(v)) < 0.05 else f"₹{v:.1f}L".replace(".0L", "L")
        if n >= 1000:
            v = n / 1000.0
            return f"₹{int(round(v))}K" if abs(v - round(v)) < 0.05 else f"₹{v:.1f}K".replace(".0K", "K")
        return f"₹{int(n)}"

    if per and per > 0:
        return {
            "budget_display": _compact(per),
            "budget_type": "PER_CREATOR",
            "budget_value": per,
            "budget_label": f"{_compact(per)} / Creator",
        }
    if mn and mx and mn > 0 and mx > 0 and mx != mn:
        label = f"{_compact(mn)} – {_compact(mx)}"
        return {
            "budget_display": f"{_compact(mn)}–{_compact(mx)}".replace("₹₹", "₹"),
            "budget_type": "RANGE",
            "budget_value": (mn + mx) / 2,
            "budget_label": label,
        }
    if total and total > 0:
        return {
            "budget_display": _compact(total),
            "budget_type": "FIXED",
            "budget_value": total,
            "budget_label": f"{_compact(total)} Campaign Budget",
        }
    return {
        "budget_display": "View",
        "budget_type": "UNKNOWN",
        "budget_value": None,
        "budget_label": "View Campaign for Details",
    }


def _effective_budget_for_filter(camp: dict) -> Optional[float]:
    info = format_budget_display(camp)
    if info["budget_type"] == "HIDDEN":
        return None
    return info.get("budget_value")


def _match_score(creator: dict, camp: dict) -> int:
    score = 40.0
    c_niches = {str(x).lower() for x in (creator.get("niches") or []) if x}
    camp_niches = {str(x).lower() for x in (camp.get("niches") or camp.get("creator_categories") or []) if x}
    if c_niches and camp_niches:
        score += min(25, len(c_niches & camp_niches) * 12)

    c_plats = set()
    pm = creator.get("platform_metrics") if isinstance(creator.get("platform_metrics"), dict) else {}
    for k, row in pm.items():
        if isinstance(row, dict) and (row.get("handle") or row.get("followers")):
            c_plats.add(str(k).lower())
    for p in creator.get("platforms") or []:
        c_plats.add(str(p).lower())
    camp_plats = {str(p).lower() for p in (camp.get("platforms") or []) if p}
    if c_plats and camp_plats and (c_plats & camp_plats):
        score += 15

    # Followers
    fol = 0.0
    if creator.get("followers") is not None:
        fol = _num(creator.get("followers"), 0) or 0
    else:
        for row in pm.values():
            if isinstance(row, dict):
                fol = max(fol, _num(row.get("followers"), 0) or 0)
    min_f = _num(camp.get("min_followers") or camp.get("minimum_followers"))
    if min_f and fol >= min_f:
        score += 10
    elif min_f and fol > 0:
        score += max(0, 10 * (fol / min_f) - 5)

    # Engagement
    er = _num(creator.get("engagement_rate"))
    if er is None:
        rates = []
        for row in pm.values():
            if isinstance(row, dict) and row.get("engagement") is not None:
                rates.append(_num(row.get("engagement"), 0) or 0)
        er = sum(rates) / len(rates) if rates else None
    min_er_raw = camp.get("min_engagement") or camp.get("minimum_engagement_rate")
    try:
        min_er = float(str(min_er_raw).replace("%", "").strip()) if min_er_raw not in (None, "") else None
    except (TypeError, ValueError):
        min_er = None
    if min_er is not None and er is not None and er >= min_er:
        score += 8

    # Location proximity bonus already applied via distance elsewhere; soft city match
    c_city = (creator.get("city") or creator.get("location") or "").lower()
    camp_loc = (camp.get("location") or camp.get("influencer_location") or "").lower()
    if c_city and camp_loc and (c_city in camp_loc or camp_loc in c_city):
        score += 7

    return int(max(0, min(99, round(score))))


def _public_card(camp: dict, creator: dict, origin: Optional[tuple]) -> Optional[dict]:
    coords = _coords_for_campaign(camp)
    approx = False
    if coords:
        lat, lng = _jitter_same_spot(coords[0], coords[1], str(camp.get("id") or ""))
    else:
        lat, lng = _fallback_coords(camp)
        approx = True
    budget = format_budget_display(camp)
    dist = None
    if origin and not approx:
        dist = _haversine_km(origin[0], origin[1], lat, lng)
        if dist is not None:
            dist = round(dist, 1)

    deadline = camp.get("application_deadline") or camp.get("deadline")
    platforms = camp.get("platforms") or []
    niches = camp.get("niches") or []
    deliverables = camp.get("deliverables")
    if isinstance(deliverables, list):
        deliverables_display = " + ".join(str(d) for d in deliverables if d)
    else:
        deliverables_display = str(deliverables or "—")

    required = camp.get("required_creators") or camp.get("creators_required") or None
    try:
        required = int(required) if required is not None else None
    except (TypeError, ValueError):
        required = None

    return {
        "id": camp.get("id"),
        "name": camp.get("title") or camp.get("name") or "Campaign",
        "brand": camp.get("brand") or "Brand",
        "brand_logo": camp.get("brand_logo"),
        "campaign_image": camp.get("cover") or camp.get("campaign_image"),
        "description": (camp.get("description") or "")[:280],
        "latitude": lat,
        "longitude": lng,
        "location": camp.get("location") or camp.get("influencer_location") or "India",
        "category": (niches[0] if niches else None) or camp.get("category") or "General",
        "niches": niches,
        "platforms": platforms,
        "campaign_type": camp.get("campaign_type") or camp.get("payment_type") or "Paid",
        "payment_type": camp.get("payment_type") or "Paid",
        "budget_display": budget["budget_display"],
        "budget_type": budget["budget_type"],
        "budget_label": budget["budget_label"],
        "budget": budget.get("budget_value"),
        "required_creators": required,
        "creators_selected": camp.get("creators_selected") or 0,
        "deliverables": deliverables_display,
        "deadline": deadline,
        "application_deadline": deadline,
        "min_followers": camp.get("min_followers") or camp.get("minimum_followers"),
        "min_engagement": camp.get("min_engagement") or camp.get("minimum_engagement_rate"),
        "creator_type": camp.get("influencer_type") or camp.get("creator_type"),
        "languages": camp.get("languages") or [],
        "content_types": camp.get("content_types") or [],
        "distance_km": dist,
        "location_approx": approx,
        "match_score": _match_score(creator, camp),
        "status": camp.get("status") or "open",
        "accepting_applications": camp.get("accepting_applications", True),
        "show_budget_to_creator": camp.get("show_budget_to_creator", True),
    }


class CampaignMapQuery(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None  # km; None = anywhere
    min_budget: Optional[float] = None
    max_budget: Optional[float] = None
    category: Optional[str] = None
    platform: Optional[str] = None
    campaign_type: Optional[str] = None
    creator_type: Optional[str] = None
    min_followers: Optional[float] = None
    max_followers: Optional[float] = None
    min_engagement: Optional[float] = None
    deadline: Optional[str] = None  # today | 3d | 7d | 30d
    search: Optional[str] = None
    sort: str = "recommended"
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None
    page: int = 1
    limit: int = 80


def setup_campaign_map(
    api_router,
    *,
    db,
    get_current_user: Callable,
    require_role: Callable,
    logger=None,
):
    def _eligible(camp: dict, now: datetime) -> bool:
        status = (camp.get("status") or "").lower().strip()
        # Align with marketplace grid: show discoverable campaigns, only drop clearly closed ones
        if status in ("draft", "cancelled", "canceled", "archived", "deleted", "closed", "completed", "rejected"):
            return False
        if camp.get("accepting_applications") is False and status not in ("", "open", "active", "live", "published"):
            return False
        deadline = _parse_date(camp.get("application_deadline") or camp.get("deadline"))
        if deadline and deadline.date() < now.date() and status in ("closed", "completed", "expired"):
            return False
        return True

    @api_router.get("/creator/campaigns/map")
    async def creator_campaigns_map(
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius: Optional[float] = None,
        min_budget: Optional[float] = None,
        max_budget: Optional[float] = None,
        category: Optional[str] = None,
        platform: Optional[str] = None,
        campaign_type: Optional[str] = None,
        creator_type: Optional[str] = None,
        min_followers: Optional[float] = None,
        max_followers: Optional[float] = None,
        min_engagement: Optional[float] = None,
        deadline: Optional[str] = None,
        search: Optional[str] = None,
        sort: str = "recommended",
        north: Optional[float] = None,
        south: Optional[float] = None,
        east: Optional[float] = None,
        west: Optional[float] = None,
        page: int = Query(1, ge=1),
        limit: int = Query(80, ge=1, le=120),
        current: dict = Depends(get_current_user),
    ):
        await require_role(current, ["influencer", "agent", "admin", "owner"])
        now = _iso_now()
        camps = await db.campaigns.find({}, {"_id": 0}).to_list(400)

        origin = None
        if latitude is not None and longitude is not None:
            try:
                origin = (float(latitude), float(longitude))
            except (TypeError, ValueError):
                origin = None
        if not origin:
            origin = _coords_for(current)

        cards: List[dict] = []
        for camp in camps:
            if not _eligible(camp, now):
                continue
            card = _public_card(camp, current, origin)
            if not card:
                continue

            # Bounds filter (viewport) — when set, skip radius so panning works
            if None not in (north, south, east, west):
                if not (south <= card["latitude"] <= north and west <= card["longitude"] <= east):
                    continue
            elif radius is not None and origin and card.get("distance_km") is not None:
                if card["distance_km"] > float(radius):
                    continue

            # Budget filter (skip hidden unless no filter)
            bv = card.get("budget")
            if min_budget is not None or max_budget is not None:
                if bv is None:
                    continue
                if min_budget is not None and bv < float(min_budget):
                    continue
                if max_budget is not None and bv > float(max_budget):
                    continue

            if category:
                cat = category.lower()
                blob = " ".join([card.get("category") or "", " ".join(card.get("niches") or [])]).lower()
                if cat not in blob:
                    continue

            if platform:
                plats = {str(p).lower() for p in (card.get("platforms") or [])}
                if platform.lower() not in plats and not any(platform.lower() in p for p in plats):
                    continue

            if campaign_type:
                ct = (card.get("campaign_type") or card.get("payment_type") or "").lower()
                if campaign_type.lower() not in ct:
                    continue

            if creator_type:
                if creator_type.lower() not in str(card.get("creator_type") or "").lower():
                    continue

            if min_followers is not None:
                camp_min = _num(camp.get("min_followers") or camp.get("minimum_followers"))
                if camp_min is not None and camp_min < float(min_followers):
                    continue

            if search:
                q = search.lower().strip()
                hay = " ".join([
                    card.get("name") or "",
                    card.get("brand") or "",
                    card.get("category") or "",
                    card.get("location") or "",
                    " ".join(card.get("niches") or []),
                ]).lower()
                if q not in hay:
                    continue

            if deadline:
                dl = _parse_date(card.get("deadline"))
                if dl:
                    days = (dl.date() - now.date()).days
                    key = deadline.lower()
                    if key in ("today", "ending_today") and days != 0:
                        continue
                    if key in ("3d", "next_3_days") and not (0 <= days <= 3):
                        continue
                    if key in ("7d", "next_7_days") and not (0 <= days <= 7):
                        continue
                    if key in ("30d", "next_30_days") and not (0 <= days <= 30):
                        continue

            cards.append(card)

        key = (sort or "recommended").lower()
        if key in ("highest_budget", "budget_desc"):
            cards.sort(key=lambda c: c.get("budget") or -1, reverse=True)
        elif key in ("nearest",):
            cards.sort(key=lambda c: c.get("distance_km") if c.get("distance_km") is not None else 1e9)
        elif key in ("ending_soon", "deadline"):
            cards.sort(key=lambda c: str(c.get("deadline") or "9999"))
        elif key in ("newest",):
            cards.sort(key=lambda c: str(c.get("id") or ""), reverse=True)
        elif key in ("highest_match", "match"):
            cards.sort(key=lambda c: c.get("match_score") or 0, reverse=True)
        else:
            # recommended: match then nearer
            cards.sort(
                key=lambda c: (
                    -(c.get("match_score") or 0),
                    c.get("distance_km") if c.get("distance_km") is not None else 1e9,
                )
            )

        total = len(cards)
        start = (page - 1) * limit
        page_items = cards[start:start + limit]
        return {
            "campaigns": page_items,
            "total": total,
            "page": page,
            "limit": limit,
            "origin": {"latitude": origin[0], "longitude": origin[1]} if origin else None,
        }

    @api_router.post("/creator/campaigns/map")
    async def creator_campaigns_map_post(body: CampaignMapQuery, current: dict = Depends(get_current_user)):
        return await creator_campaigns_map(
            latitude=body.latitude,
            longitude=body.longitude,
            radius=body.radius,
            min_budget=body.min_budget,
            max_budget=body.max_budget,
            category=body.category,
            platform=body.platform,
            campaign_type=body.campaign_type,
            creator_type=body.creator_type,
            min_followers=body.min_followers,
            max_followers=body.max_followers,
            min_engagement=body.min_engagement,
            deadline=body.deadline,
            search=body.search,
            sort=body.sort,
            north=body.north,
            south=body.south,
            east=body.east,
            west=body.west,
            page=body.page,
            limit=body.limit,
            current=current,
        )

    return True
