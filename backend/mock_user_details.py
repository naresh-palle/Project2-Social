"""
Fill missing mock/profile details for users without overwriting real data.

Only sets a field when it is empty / null / blank. Used by seed_demo on startup
and by POST /admin/enrich-user-details.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

CITY_STATE = {
    "Mumbai": "Maharashtra",
    "Pune": "Maharashtra",
    "Nagpur": "Maharashtra",
    "New Delhi": "Delhi",
    "Delhi": "Delhi",
    "Bangalore": "Karnataka",
    "Bengaluru": "Karnataka",
    "Hyderabad": "Telangana",
    "Chennai": "Tamil Nadu",
    "Kolkata": "West Bengal",
    "Ahmedabad": "Gujarat",
    "Surat": "Gujarat",
    "Jaipur": "Rajasthan",
    "Goa": "Goa",
    "Panaji": "Goa",
    "Lucknow": "Uttar Pradesh",
    "Chandigarh": "Chandigarh",
    "Indore": "Madhya Pradesh",
    "Bhopal": "Madhya Pradesh",
    "Kochi": "Kerala",
    "Thiruvananthapuram": "Kerala",
    "Coimbatore": "Tamil Nadu",
    "Visakhapatnam": "Andhra Pradesh",
    "Vijayawada": "Andhra Pradesh",
}

DEMO_LOCATIONS: List[Tuple[str, str]] = [
    ("Hyderabad", "Telangana"),
    ("Mumbai", "Maharashtra"),
    ("Bengaluru", "Karnataka"),
    ("New Delhi", "Delhi"),
    ("Chennai", "Tamil Nadu"),
    ("Pune", "Maharashtra"),
    ("Kolkata", "West Bengal"),
    ("Jaipur", "Rajasthan"),
    ("Ahmedabad", "Gujarat"),
    ("Goa", "Goa"),
]

CREATOR_DEMO_ENRICH = {
    "name": "Creator Demo",
    "username": "creatordemo",
    "handle": "creator.demo1",
    "bio": (
        "Creator Demo is a tech & lifestyle influencer on flugr — product reviews, "
        "city lifestyle reels, and escrow-ready brand collaborations across India."
    ),
    "city": "Hyderabad",
    "state": "Telangana",
    "location": "Hyderabad, Telangana",
    "mobile": "9876500101",
    "pincode": "500081",
    "niches": ["tech", "lifestyle"],
    "category": "tech",
    "languages": ["English", "Hindi", "Telugu"],
    "content_types": ["Instagram Reels (Short Videos)", "Static Posts", "Stories", "YouTube Videos"],
    "availability": "Within 1 week",
    "base_rate": 25000,
    "platforms": ["instagram", "youtube", "twitter", "facebook"],
    "verified": True,
    "onboarding_status": "completed",
}

AGENT_DEMO_ENRICH = {
    "name": "Agent Demo",
    "username": "agentdemo",
    "company": "Talent Agency",
    "bio": (
        "Talent Agency represents creators across fashion, tech, and lifestyle verticals — "
        "brief matching, rate negotiation, and escrow-backed brand deals on flugr."
    ),
    "city": "Mumbai",
    "state": "Maharashtra",
    "location": "Mumbai, Maharashtra",
    "mobile": "9876500103",
    "pincode": "400001",
    "industry": "Talent Management",
    "website": "https://talentagency.example",
    "verified": True,
    "onboarding_status": "completed",
}


def _blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict, tuple)) and len(value) == 0:
        return True
    return False


def _is_demo_email(email: str) -> bool:
    e = (email or "").lower().strip()
    return e.endswith("@cr8.studio") or e.endswith("@example.com")


def _hash_pick(seed: str, items: List[Any]) -> Any:
    if not items:
        return None
    h = sum(ord(c) for c in str(seed or "x"))
    return items[h % len(items)]


def infer_state(city: Optional[str]) -> Optional[str]:
    if not city:
        return None
    c = str(city).strip()
    if c in CITY_STATE:
        return CITY_STATE[c]
    lower = c.lower()
    for key, state in CITY_STATE.items():
        if key.lower() in lower or lower in key.lower():
            return state
    # City field sometimes ends with the state name already
    for state in sorted(set(CITY_STATE.values()), key=len, reverse=True):
        if lower.endswith(state.lower()) and lower != state.lower():
            return state
    return None


def format_location(city: Optional[str], state: Optional[str], existing: Optional[str] = None) -> str:
    city = (city or "").strip()
    state = (state or "").strip()
    if city and state and city.lower() != state.lower():
        return f"{city}, {state}"
    if city:
        return city
    if state:
        return state
    return (existing or "").strip()


def missing_detail_patch(user: Dict[str, Any]) -> Dict[str, Any]:
    """Return $set fields for anything blank on this user."""
    role = (user.get("role") or "").lower()
    email = (user.get("email") or "").lower()
    seed = str(user.get("id") or email or user.get("username") or "user")
    updates: Dict[str, Any] = {}

    city = (user.get("city") or "").strip() if isinstance(user.get("city"), str) else (user.get("city") or "")
    state = (user.get("state") or "").strip() if isinstance(user.get("state"), str) else (user.get("state") or "")
    location = (user.get("location") or "").strip() if isinstance(user.get("location"), str) else (user.get("location") or "")
    city = str(city or "").strip()
    state = str(state or "").strip()
    location = str(location or "").strip()

    # Parse "City State" jammed into city field (e.g. "K.V.Rangareddy Telangana")
    if city and not state:
        inferred = infer_state(city)
        if inferred:
            state = inferred
            for st in sorted(set(CITY_STATE.values()), key=len, reverse=True):
                if city.lower().endswith(st.lower()) and city.lower() != st.lower():
                    trimmed = city[: -len(st)].strip(" ,|-")
                    if trimmed:
                        city = trimmed
                        updates["city"] = city
                    break
            updates["state"] = state

    if not city:
        picked = _hash_pick(seed, DEMO_LOCATIONS)
        city, state = picked[0], picked[1]
        updates["city"] = city
        updates["state"] = state
    elif not state:
        inferred = infer_state(city) or _hash_pick(seed, DEMO_LOCATIONS)[1]
        state = inferred
        updates["state"] = state

    desired_location = format_location(city or updates.get("city"), state or updates.get("state"), location)
    if not location or location.lower() in {"remote", "n/a", "na", "none"}:
        updates["location"] = desired_location
    elif location and "," not in location and (state or updates.get("state")):
        updates["location"] = desired_location

    if _blank(user.get("bio")) or str(user.get("bio") or "").strip().lower() in {"demo creator.", "demo creator", "talent agent.", "brand account."}:
        name = user.get("name") or user.get("username") or "flugr member"
        if role in {"influencer", "creator"}:
            niches = user.get("niches") or user.get("category") or ["lifestyle"]
            if isinstance(niches, str):
                niches = [n.strip() for n in niches.replace("|", ",").split(",") if n.strip()]
            niche_txt = ", ".join(niches[:3]).lower() if niches else "lifestyle"
            updates["bio"] = (
                f"{name} creates {niche_txt} content on flugr and collaborates with brands "
                f"on escrow-backed campaigns across {(updates.get('city') or city or 'India')}."
            )
        elif role in {"owner", "company"}:
            company = user.get("company") or name
            updates["bio"] = (
                f"{company} partners with creators on flugr for product storytelling, "
                "seasonal drops, and measurable metro reach."
            )
        elif role == "agent":
            company = user.get("company") or name
            updates["bio"] = (
                f"{company} represents creators on flugr — briefing, rates, and escrow-ready brand deals."
            )

    if role in {"influencer", "creator"}:
        if _blank(user.get("languages")):
            updates["languages"] = ["English", "Hindi"]
        if _blank(user.get("content_types")):
            updates["content_types"] = ["Instagram Reels (Short Videos)", "Static Posts", "Stories"]
        if _blank(user.get("availability")):
            updates["availability"] = "Within 1 week"
        if _blank(user.get("base_rate")) or user.get("base_rate") in (0, "0"):
            updates["base_rate"] = 15000 + (_hash_pick(seed, list(range(8))) or 0) * 5000
        if _blank(user.get("category")) and user.get("niches"):
            niches = user.get("niches")
            if isinstance(niches, list) and niches:
                updates["category"] = niches[0]
            elif isinstance(niches, str) and niches.strip():
                updates["category"] = niches.split(",")[0].strip()

    if role in {"owner", "company"}:
        if _blank(user.get("industry")):
            updates["industry"] = "Consumer Brand"
        if _blank(user.get("company")):
            updates["company"] = user.get("name") or "Brand"

    if role == "agent":
        if _blank(user.get("company")):
            updates["company"] = "Talent Agency"
        if _blank(user.get("industry")):
            updates["industry"] = "Talent Management"

    # Demo-only contact placeholders (never invent phones for real emails)
    if _is_demo_email(email):
        if _blank(user.get("mobile")):
            digit = 1000 + (sum(ord(c) for c in seed) % 8000)
            updates["mobile"] = f"98765{digit:05d}"[-10:]
        if _blank(user.get("pincode")):
            updates["pincode"] = _hash_pick(seed, ["400001", "110001", "560001", "500081", "600001", "411001"])

    return updates


async def enrich_missing_user_details(db, logger=None) -> Dict[str, Any]:
    """Backfill blank profile fields for every user. Never overwrites non-empty values."""
    updated = 0
    scanned = 0
    samples: List[Dict[str, Any]] = []

    # Force-complete demo desks — pin canonical mock location + fill other blanks
    for email, enrich in (
        ("creator@cr8.studio", CREATOR_DEMO_ENRICH),
        ("agent@cr8.studio", AGENT_DEMO_ENRICH),
    ):
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user:
            continue
        patch = {
            "city": enrich["city"],
            "state": enrich["state"],
            "location": enrich["location"],
        }
        for k, v in enrich.items():
            if k in patch:
                continue
            if k == "bio":
                bio = str(user.get("bio") or "").strip().lower()
                if _blank(user.get("bio")) or bio.startswith("demo creator") or bio == "talent agent.":
                    patch[k] = v
                continue
            if _blank(user.get(k)):
                patch[k] = v
        await db.users.update_one({"email": email}, {"$set": patch})
        updated += 1
        samples.append({"email": email, "fields": sorted(patch.keys())})

    cursor = db.users.find({}, {"_id": 0})
    async for user in cursor:
        scanned += 1
        email = (user.get("email") or "").lower()
        if email in {"creator@cr8.studio", "agent@cr8.studio"}:
            continue  # already handled
        patch = missing_detail_patch(user)
        if not patch:
            continue
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
        updated += 1
        if len(samples) < 12:
            samples.append({"email": email or user.get("id"), "fields": sorted(patch.keys())})

    if logger:
        logger.info("enrich_missing_user_details: scanned=%s updated=%s", scanned, updated)
    return {"scanned": scanned, "updated": updated, "samples": samples}
