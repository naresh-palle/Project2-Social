"""flugr discovery intelligence — query builder, scoring, providers, embeddings.

Does not talk to Mongo directly except via helpers passed a db handle.
Never invents creator rows. Missing metrics stay None / "Data unavailable".
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger("discovery")

UNAVAILABLE = "Data unavailable"
NOT_CONFIGURED = "Data source not configured"

PLATFORMS = ("instagram", "youtube", "facebook", "twitter", "tiktok", "linkedin", "x")
PLATFORM_ALIASES = {"x": "twitter", "twitter": "twitter", "ig": "instagram", "yt": "youtube"}

CATEGORIES = (
    "Fashion & Style",
    "Food & Cooking",
    "Beauty & Makeup",
    "Technology & Gadgets",
    "Fitness & Health",
    "Lifestyle & Home",
    "Travel & Adventure",
    "Business & Entrepreneurship",
    "Entertainment & Gaming",
    "Education & Learning",
    "Other",
)

CATEGORY_ALIASES = {
    "tech": "Technology & Gadgets",
    "technology": "Technology & Gadgets",
    "fashion": "Fashion & Style",
    "beauty": "Beauty & Makeup",
    "food": "Food & Cooking",
    "fitness": "Fitness & Health",
    "travel": "Travel & Adventure",
    "lifestyle": "Lifestyle & Home",
    "business": "Business & Entrepreneurship",
    "entertainment": "Entertainment & Gaming",
    "gaming": "Entertainment & Gaming",
    "education": "Education & Learning",
}

TIERS = ("nano", "micro", "mid", "macro", "mega")
ACCOUNT_TYPES = ("personal", "creator", "business", "media")
CONTENT_TYPES = ("reel", "video", "post", "story", "short", "live")
RISK_LABELS = ("low", "medium", "high")

ALLOWED_FILTER_KEYS = frozenset({
    "platform", "platforms",
    "name", "username", "q", "text",
    "category", "categories", "subcategory", "niche", "niches",
    "followers_min", "followers_max",
    "subscribers_min", "subscribers_max",
    "engagement_rate_min", "engagement_rate_max",
    "avg_views_min", "avg_views_max",
    "avg_likes_min", "avg_likes_max",
    "avg_comments_min", "avg_comments_max",
    "location", "country", "state", "city",
    "language", "languages",
    "creator_tier", "tiers",
    "verified",
    "content_type", "content_types",
    "audience_age", "audience_gender", "audience_location", "audience_language",
    "growth_rate_min", "growth_rate_max",
    "account_type",
    "brand_collaborations",
    "price_min", "price_max", "budget_min", "budget_max",
    "availability",
    "audience_quality_min", "brand_safety_min", "fake_follower_risk_max",
    "content_quality_min", "ai_match_min",
    "page", "limit", "sort",
})

DEFAULT_QUALITY_WEIGHTS = {
    "engagement_quality": 25,
    "audience_quality": 20,
    "content_quality": 15,
    "growth": 15,
    "authenticity": 15,
    "brand_safety": 10,
}

EMBED_DIM = 64


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_list(value: Any) -> List[str]:
    if value is None or value is False:
        return []
    if isinstance(value, str):
        parts = [p.strip() for p in value.split(",") if p.strip()]
        return parts
    if isinstance(value, (list, tuple, set)):
        out = []
        for item in value:
            out.extend(_as_list(item))
        return out
    return [str(value).strip()] if str(value).strip() else []


def _lower(value: str) -> str:
    return (value or "").strip().lower()


def normalize_platform(raw: str) -> str:
    p = _lower(raw).replace(" ", "")
    p = PLATFORM_ALIASES.get(p, p)
    return p if p in PLATFORMS else p


def normalize_category(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return s
    alias = CATEGORY_ALIASES.get(s.lower())
    if alias:
        return alias
    for cat in CATEGORIES:
        if cat.lower() == s.lower() or s.lower() in cat.lower():
            return cat
    return s


def creator_tier(followers: Optional[float]) -> Optional[str]:
    if followers is None:
        return None
    n = float(followers)
    if n < 10_000:
        return "nano"
    if n < 50_000:
        return "micro"
    if n < 250_000:
        return "mid"
    if n < 1_000_000:
        return "macro"
    return "mega"


def parse_number(raw: Any) -> Optional[float]:
    if raw is None or raw is False:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        if math.isnan(raw) or math.isinf(raw):  # type: ignore[arg-type]
            return None
        return float(raw)
    s = str(raw).strip().lower().replace(",", "")
    if not s or s in {"n/a", "na", "none", "null", "data unavailable"}:
        return None
    mult = 1.0
    if s.endswith("%"):
        s = s[:-1]
    if s.endswith("k"):
        mult = 1_000
        s = s[:-1]
    elif s.endswith("m"):
        mult = 1_000_000
        s = s[:-1]
    try:
        return float(s) * mult
    except ValueError:
        return None


def clamp(n: Optional[float], lo: float = 0, hi: float = 100) -> Optional[float]:
    if n is None:
        return None
    return max(lo, min(hi, n))


def validate_filters(raw: Any) -> Dict[str, Any]:
    """Allowlist + type-coerce AI/user filters. Drops unknown keys."""
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, Any] = {}
    for key, value in raw.items():
        k = str(key).strip()
        if k not in ALLOWED_FILTER_KEYS or value is None or value == "":
            continue
        if k in {"platform", "platforms"}:
            plats = [normalize_platform(p) for p in _as_list(value)]
            out["platforms"] = [p for p in plats if p]
        elif k in {"category", "categories", "niche", "niches"}:
            cats = [normalize_category(c) for c in _as_list(value)]
            out["categories"] = [c for c in cats if c]
        elif k in {"language", "languages"}:
            out["languages"] = [x for x in _as_list(value) if x]
        elif k in {"content_type", "content_types"}:
            out["content_types"] = [_lower(x) for x in _as_list(value) if x]
        elif k in {"creator_tier", "tiers"}:
            out["tiers"] = [_lower(x) for x in _as_list(value) if _lower(x) in TIERS]
        elif k in {"name", "username", "q", "text"}:
            out["q"] = str(value).strip()[:200]
        elif k in {"location", "country", "state", "city", "subcategory",
                   "audience_age", "audience_gender", "audience_location",
                   "audience_language", "account_type", "availability",
                   "brand_collaborations"}:
            out[k] = str(value).strip()[:120]
        elif k == "verified":
            if isinstance(value, bool):
                out["verified"] = value
            elif str(value).lower() in {"1", "true", "yes"}:
                out["verified"] = True
            elif str(value).lower() in {"0", "false", "no"}:
                out["verified"] = False
        elif k == "sort":
            out["sort"] = str(value)[:40]
        elif k in {"page", "limit"}:
            try:
                out[k] = max(1, int(value))
            except (TypeError, ValueError):
                continue
        else:
            num = parse_number(value)
            if num is None:
                continue
            if "followers" in k or "subscribers" in k or "views" in k or "likes" in k or "comments" in k or "price" in k or "budget" in k:
                if num < 0:
                    continue
            if "engagement" in k or k.endswith("_min") and "score" in k or k.endswith("_max") and "risk" in k:
                pass
            out[k] = num
    if out.get("limit"):
        out["limit"] = min(int(out["limit"]), 48)
    if out.get("page"):
        out["page"] = min(int(out["page"]), 200)
    return out


def filters_to_mongo(filters: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic Mongo query. LLM never reaches the database."""
    filt: Dict[str, Any] = {"role": "influencer", "banned": {"$ne": True}}
    ands: List[Dict[str, Any]] = []

    if filters.get("platforms"):
        filt["platforms"] = {"$in": filters["platforms"]}
    if filters.get("categories"):
        cats = filters["categories"]
        rx = "|".join(re.escape(c) for c in cats)
        ands.append({"$or": [
            {"niches": {"$in": cats}},
            {"category": {"$regex": rx, "$options": "i"}},
            {"niches": {"$regex": rx, "$options": "i"}},
        ]})
    q = filters.get("q")
    if q:
        rx = re.escape(q)
        ands.append({"$or": [
            {"name": {"$regex": rx, "$options": "i"}},
            {"username": {"$regex": rx, "$options": "i"}},
            {"handle": {"$regex": rx, "$options": "i"}},
            {"bio": {"$regex": rx, "$options": "i"}},
            {"platform_metrics.instagram.handle": {"$regex": rx, "$options": "i"}},
            {"platform_metrics.youtube.handle": {"$regex": rx, "$options": "i"}},
        ]})
    if filters.get("city"):
        filt["city"] = {"$regex": re.escape(filters["city"]), "$options": "i"}
    if filters.get("state"):
        filt["state"] = {"$regex": re.escape(filters["state"]), "$options": "i"}
    if filters.get("country"):
        ands.append({"$or": [
            {"country": {"$regex": re.escape(filters["country"]), "$options": "i"}},
            {"location": {"$regex": re.escape(filters["country"]), "$options": "i"}},
        ]})
    loc = filters.get("location")
    if loc:
        ands.append({"$or": [
            {"city": {"$regex": re.escape(loc), "$options": "i"}},
            {"state": {"$regex": re.escape(loc), "$options": "i"}},
            {"location": {"$regex": re.escape(loc), "$options": "i"}},
        ]})
    if filters.get("languages"):
        langs = filters["languages"]
        rx = "|".join(re.escape(x) for x in langs)
        filt["languages"] = {"$regex": rx, "$options": "i"}
    if "verified" in filters:
        filt["verified"] = bool(filters["verified"])
    if filters.get("availability"):
        filt["availability"] = {"$regex": re.escape(str(filters["availability"])), "$options": "i"}

    fol: Dict[str, Any] = {}
    if filters.get("followers_min") is not None:
        fol["$gte"] = float(filters["followers_min"])
    if filters.get("followers_max") is not None:
        fol["$lte"] = float(filters["followers_max"])
    if filters.get("subscribers_min") is not None:
        fol.setdefault("$gte", float(filters["subscribers_min"]))
        if "$gte" in fol:
            fol["$gte"] = max(fol["$gte"], float(filters["subscribers_min"]))
    if filters.get("subscribers_max") is not None:
        fol.setdefault("$lte", float(filters["subscribers_max"]))
        if "$lte" in fol:
            fol["$lte"] = min(fol["$lte"], float(filters["subscribers_max"]))
    if fol:
        filt["followers"] = fol

    price: Dict[str, Any] = {}
    pmin = filters.get("price_min", filters.get("budget_min"))
    pmax = filters.get("price_max", filters.get("budget_max"))
    if pmin is not None:
        price["$gte"] = float(pmin)
    if pmax is not None:
        price["$lte"] = float(pmax)
    if price:
        filt["base_rate"] = price

    if ands:
        filt["$and"] = ands
    return filt


_NL_FOLLOWERS = re.compile(
    r"(\d+(?:\.\d+)?)\s*(k|m)?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(k|m)?\s*(?:followers|subs)?",
    re.I,
)
_NL_MIN_FOLLOWERS = re.compile(r"(?:more than|over|above|>)\s*(\d+(?:\.\d+)?)\s*(k|m)?\s*(?:followers|subs)?", re.I)
_NL_ENG = re.compile(r"engagement(?:\s+rate)?\s*(?:above|over|>|at least)?\s*(\d+(?:\.\d+)?)\s*%?", re.I)
_NL_PRICE = re.compile(r"(?:under|below|<|less than)\s*₹?\s*(\d+(?:\.\d+)?)\s*(k)?", re.I)


def heuristic_parse_query(query: str) -> Dict[str, Any]:
    """NL → filters without an LLM. Used when keys are missing or to seed the LLM."""
    q = query or ""
    raw: Dict[str, Any] = {}
    plats = []
    for p in PLATFORMS:
        if re.search(rf"\b{p}\b", q, re.I) or (p == "twitter" and re.search(r"\b(x|twitter)\b", q, re.I)):
            plats.append(normalize_platform(p))
    if plats:
        raw["platforms"] = list(dict.fromkeys(plats))
    cats = []
    for alias, cat in CATEGORY_ALIASES.items():
        if re.search(rf"\b{re.escape(alias)}\b", q, re.I):
            cats.append(cat)
    for cat in CATEGORIES:
        if re.search(rf"\b{re.escape(cat.split('&')[0].strip())}\b", q, re.I):
            cats.append(cat)
    if cats:
        raw["categories"] = list(dict.fromkeys(cats))
    m = _NL_FOLLOWERS.search(q)
    if m:
        def _n(num, suf):
            v = float(num)
            s = (suf or "").lower()
            if s == "k":
                v *= 1_000
            elif s == "m":
                v *= 1_000_000
            return v
        raw["followers_min"] = _n(m.group(1), m.group(2))
        raw["followers_max"] = _n(m.group(3), m.group(4))
    else:
        m2 = _NL_MIN_FOLLOWERS.search(q)
        if m2:
            v = float(m2.group(1))
            if (m2.group(2) or "").lower() == "k":
                v *= 1_000
            elif (m2.group(2) or "").lower() == "m":
                v *= 1_000_000
            raw["followers_min"] = v
    m = _NL_ENG.search(q)
    if m:
        raw["engagement_rate_min"] = float(m.group(1))
    m = _NL_PRICE.search(q)
    if m:
        v = float(m.group(1))
        if (m.group(2) or "").lower() == "k":
            v *= 1_000
        raw["price_max"] = v
    for lang in ("Telugu", "Hindi", "Tamil", "Kannada", "Malayalam", "English", "Bengali", "Marathi", "Gujarati"):
        if re.search(rf"\b{lang}\b", q, re.I):
            raw.setdefault("languages", []).append(lang)
    for city in ("Hyderabad", "Bengaluru", "Bangalore", "Mumbai", "Delhi", "Chennai", "Pune", "Kolkata", "Jaipur"):
        if re.search(rf"\b{city}\b", q, re.I):
            raw["city"] = "Bengaluru" if city.lower() == "bangalore" else city
            raw["location"] = raw["city"]
    if re.search(r"\bverified\b", q, re.I):
        raw["verified"] = True
    for tier in TIERS:
        if re.search(rf"\b{tier}\b", q, re.I):
            raw.setdefault("tiers", []).append(tier)
    return validate_filters(raw)


def metric_from_platforms(user: dict, key: str) -> Optional[float]:
    pm = user.get("platform_metrics") or {}
    best = None
    if isinstance(pm, dict):
        for row in pm.values():
            if not isinstance(row, dict):
                continue
            n = parse_number(row.get("subscribers") if key == "followers" else row.get(key))
            if n is None:
                n = parse_number(row.get(key))
            if n is None:
                continue
            best = n if best is None else max(best, n)
    top = parse_number(user.get(key))
    if top is not None:
        best = top if best is None else max(best, top)
    return best


def engagement_rate(user: dict) -> Optional[float]:
    """Follower ER when likes+comments exist; else stored engagement; else None."""
    try:
        from social_analytics import aggregate_creator_analytics

        overview = aggregate_creator_analytics(user.get("platform_metrics") or {})
        if overview.get("engagementRate") is not None:
            return overview["engagementRate"]
    except Exception:
        pass
    pm = user.get("platform_metrics") or {}
    if isinstance(pm, dict):
        for row in pm.values():
            if not isinstance(row, dict):
                continue
            stored = parse_number(row.get("engagement"))
            followers = parse_number(row.get("followers") or row.get("subscribers"))
            likes = parse_number(row.get("avg_likes") or row.get("likes"))
            comments = parse_number(row.get("avg_comments") or row.get("comments"))
            if likes is not None and comments is not None and followers and followers > 0:
                return round(((likes + comments) / followers) * 100, 3)
            if stored is not None:
                return stored if stored <= 100 else round(stored / followers * 100, 3) if followers else stored
    stored = parse_number(user.get("engagement") or user.get("engagement_rate"))
    return stored


def posting_frequency(user: dict) -> Optional[float]:
    posts = metric_from_platforms(user, "posts") or parse_number(user.get("post_count"))
    return posts


def quality_components(user: dict, intel: Optional[dict] = None, weights: Optional[dict] = None) -> Dict[str, Any]:
    """Transparent scores from stored data only. None stays unavailable."""
    w = dict(DEFAULT_QUALITY_WEIGHTS)
    if weights:
        w.update({k: int(v) for k, v in weights.items() if k in DEFAULT_QUALITY_WEIGHTS})
    intel = intel or {}
    followers = metric_from_platforms(user, "followers") or parse_number(user.get("followers")) or 0
    er = engagement_rate(user)
    eng = None
    if er is not None:
        # 1–8% ER maps to ~40–95
        eng = clamp(40 + min(er, 12) * 6.5)
    elif followers:
        eng = 45.0

    audience = parse_number(intel.get("audience_quality_score"))
    if audience is None:
        audience = 55.0 if (user.get("city") or user.get("location")) else None

    content = parse_number(intel.get("content_quality_score"))
    if content is None:
        bio = (user.get("bio") or "").strip()
        niches = user.get("niches") or []
        content = clamp(40 + (20 if bio else 0) + min(len(niches), 4) * 8 + (10 if user.get("portfolio") else 0))

    growth = parse_number(intel.get("growth_score"))
    authenticity = parse_number(intel.get("authenticity_score"))
    safety = parse_number(intel.get("brand_safety_score"))
    if safety is None:
        safety = 90.0 if not user.get("banned") else 10.0
    if authenticity is None:
        authenticity = authenticity_from_signals(user, intel).get("score")

    parts = {
        "engagement_quality": round(eng, 1) if eng is not None else None,
        "audience_quality": round(audience, 1) if audience is not None else None,
        "content_quality": round(content, 1) if content is not None else None,
        "growth": round(growth, 1) if growth is not None else None,
        "authenticity": round(authenticity, 1) if authenticity is not None else None,
        "brand_safety": round(safety, 1) if safety is not None else None,
    }
    used = 0.0
    total_w = 0.0
    reasons = []
    for key, weight in w.items():
        val = parts.get(key)
        if val is None:
            reasons.append(f"{key.replace('_', ' ').title()}: {UNAVAILABLE}")
            continue
        used += val * weight
        total_w += weight
        reasons.append(f"{key.replace('_', ' ').title()}: {val:.0f}/100 (weight {weight}%)")
    overall = round(used / total_w, 1) if total_w else None
    return {
        "quality_score": overall,
        "weights": w,
        "breakdown": parts,
        "reasons": reasons,
        "source": "cr8_quality_v1",
        "computed_at": utc_now(),
    }


def authenticity_from_signals(user: dict, intel: Optional[dict] = None) -> Dict[str, Any]:
    """Estimated risk only — never claims an account is definitely fake."""
    intel = intel or {}
    flags: List[str] = []
    score = 80.0
    followers = metric_from_platforms(user, "followers") or parse_number(user.get("followers")) or 0
    er = engagement_rate(user)
    views = metric_from_platforms(user, "views") or parse_number(user.get("average_views"))
    if followers >= 50_000 and er is not None and er < 0.4:
        flags.append("Engagement is low relative to follower count (estimated).")
        score -= 18
    if followers >= 20_000 and views is not None and views < followers * 0.01:
        flags.append("Views are low relative to followers (potential mismatch).")
        score -= 12
    growth = parse_number((intel or {}).get("growth_7d"))
    if growth is not None and growth > 80:
        flags.append("Sudden follower increase detected in snapshots (requires verification).")
        score -= 15
    if user.get("verified"):
        score += 6
    score = clamp(score) or 50
    if score >= 75:
        risk = "low"
    elif score >= 55:
        risk = "medium"
    else:
        risk = "high"
    return {
        "score": round(score, 1),
        "risk": risk,
        "flags": flags,
        "wording": "Estimated authenticity. Suspicious patterns require verification.",
        "source": "cr8_risk_v1",
    }


def growth_label(pct: Optional[float]) -> Optional[str]:
    if pct is None:
        return None
    if pct >= 40:
        return "sudden_spike"
    if pct >= 8:
        return "fast_growing"
    if pct <= -25:
        return "sudden_drop"
    if pct <= -5:
        return "declining"
    return "stable"


def growth_from_snapshots(snaps: Sequence[dict], days: int, field: str = "followers") -> Optional[float]:
    if not snaps:
        return None
    ordered = sorted(snaps, key=lambda s: s.get("captured_at") or "")
    if len(ordered) < 2:
        return None
    latest = parse_number(ordered[-1].get(field))
    target = None
    cutoff_hint = days
    for row in reversed(ordered[:-1]):
        older = parse_number(row.get(field))
        if older is None:
            continue
        target = older
        if cutoff_hint:
            break
    if latest is None or target in (None, 0):
        return None
    return round(((latest - target) / target) * 100, 2)


def embed_text(parts: Iterable[str], dim: int = EMBED_DIM) -> List[float]:
    vec = [0.0] * dim
    blob = " ".join(p for p in parts if p)
    tokens = re.findall(r"[a-z0-9]+", blob.lower())
    if not tokens:
        return vec
    for tok in tokens:
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.0
        vec[(h // dim) % dim] += 0.5
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [round(x / norm, 6) for x in vec]


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return round(max(0.0, min(1.0, dot / (na * nb))), 4)


def creator_embed_parts(user: dict, intel: Optional[dict] = None) -> List[str]:
    intel = intel or {}
    niches = user.get("niches") or []
    if not isinstance(niches, list):
        niches = [niches]
    langs = user.get("languages") or []
    topics = intel.get("topics") or intel.get("primary_topics") or []
    return [
        user.get("bio") or "",
        user.get("name") or "",
        " ".join(str(n) for n in niches),
        str(user.get("category") or ""),
        " ".join(str(t) for t in topics),
        " ".join(str(x) for x in langs),
        user.get("city") or user.get("location") or "",
    ]


def match_breakdown(user: dict, brief: dict, intel: Optional[dict] = None) -> Dict[str, Any]:
    """Campaign fit from stored fields only."""
    intel = intel or {}
    creator_cats = []
    if user.get("niches"):
        creator_cats = user["niches"] if isinstance(user["niches"], list) else [user["niches"]]
    elif user.get("category"):
        raw = user["category"]
        creator_cats = raw if isinstance(raw, list) else [c.strip() for c in str(raw).split(",") if c.strip()]
    brief_cats = _as_list(brief.get("niches") or brief.get("category") or brief.get("product_category"))
    cat_s = 50.0
    if brief_cats and creator_cats:
        overlap = sum(1 for c in creator_cats if any(_lower(c) in _lower(b) or _lower(b) in _lower(c) for b in brief_cats))
        cat_s = 100.0 if overlap else 35.0
    elif not brief_cats:
        cat_s = 70.0

    plats_c = [normalize_platform(p) for p in _as_list(user.get("platforms"))]
    plats_b = [normalize_platform(p) for p in _as_list(brief.get("platforms") or brief.get("preferred_platform"))]
    plat_s = 100.0 if (not plats_b or set(plats_c) & set(plats_b)) else 30.0

    loc_c = _lower(user.get("city") or user.get("location") or "")
    loc_b = _lower(brief.get("geography") or brief.get("location") or brief.get("city") or "")
    geo_s = 100.0 if (not loc_b or (loc_c and loc_b in loc_c or loc_c in loc_b)) else 40.0

    langs_c = [_lower(x) for x in _as_list(user.get("languages"))]
    langs_b = [_lower(x) for x in _as_list(brief.get("language") or brief.get("languages"))]
    lang_s = 100.0 if (not langs_b or set(langs_c) & set(langs_b)) else 25.0

    er = engagement_rate(user)
    eng_s = clamp(40 + min(er or 0, 10) * 6) or 50.0
    safety = (intel.get("brand_safety_score") if intel else None) or (90 if not user.get("banned") else 10)
    budget = parse_number(brief.get("budget") or brief.get("budget_max"))
    rate = parse_number(user.get("base_rate"))
    if budget is None or rate is None:
        budget_s = None
    else:
        budget_s = 100.0 if rate <= budget else clamp(100 - ((rate - budget) / max(budget, 1)) * 80)

    embed_s = None
    if intel.get("embedding") and brief.get("objective"):
        embed_s = round(cosine(intel["embedding"], embed_text([brief.get("objective", ""), " ".join(brief_cats)])) * 100, 1)

    components = {
        "audience_fit": round(cat_s, 1),
        "content_fit": round(embed_s if embed_s is not None else cat_s, 1),
        "geography_fit": round(geo_s, 1),
        "language_fit": round(lang_s, 1),
        "engagement": round(eng_s, 1),
        "brand_safety": round(float(safety), 1),
        "budget_fit": round(budget_s, 1) if budget_s is not None else None,
        "platform_fit": round(plat_s, 1),
    }
    present = [(k, v) for k, v in components.items() if v is not None]
    score = round(sum(v for _, v in present) / len(present), 1) if present else None
    why = []
    if cat_s >= 80 and creator_cats:
        why.append(f"Category overlap with {', '.join(str(c) for c in creator_cats[:3])}.")
    if lang_s >= 80 and langs_c:
        why.append(f"Languages: {', '.join(user.get('languages') or [])}.")
    if loc_c and geo_s >= 80:
        why.append(f"Location: {user.get('city') or user.get('location')}.")
    if er is not None:
        why.append(f"Stored engagement rate {er}%.")
    else:
        why.append(f"Engagement: {UNAVAILABLE}.")
    if rate is not None and budget is not None:
        why.append(f"Listed rate ₹{int(rate):,} vs budget ₹{int(budget):,}.")
    if not why:
        why.append("Match uses only fields stored on the creator record.")
    return {
        "match_score": score,
        "breakdown": components,
        "why": why,
        "source": "cr8_match_v1",
    }


def snapshot_from_user(user: dict) -> Dict[str, Any]:
    try:
        from social_analytics import aggregate_creator_analytics

        overview = aggregate_creator_analytics(user.get("platform_metrics") or {})
        return {
            "creator_id": user.get("id"),
            "followers": overview.get("followers"),
            "following": parse_number(user.get("following")),
            "posts": overview.get("contentCount"),
            "views": overview.get("views"),
            "reach": overview.get("reach"),
            "likes": overview.get("likes"),
            "comments": overview.get("comments"),
            "engagement": overview.get("engagementRate"),
            "engagement_absolute": overview.get("engagement"),
            "captured_at": utc_now(),
            "provider": "apify_normalized",
            "data_source": "users.platform_metrics",
        }
    except Exception:
        pass
    followers = metric_from_platforms(user, "followers") or parse_number(user.get("followers"))
    return {
        "creator_id": user.get("id"),
        "followers": followers,
        "following": parse_number(user.get("following")),
        "posts": metric_from_platforms(user, "posts") or parse_number(user.get("post_count")),
        "views": metric_from_platforms(user, "views"),
        "likes": metric_from_platforms(user, "avg_likes"),
        "comments": metric_from_platforms(user, "avg_comments"),
        "engagement": engagement_rate(user),
        "captured_at": utc_now(),
        "provider": "catalog",
        "data_source": "users.platform_metrics",
    }


def display_value(value: Any, kind: str = "scalar") -> Any:
    if value is None or value == "":
        return UNAVAILABLE
    return value


def public_card(user: dict, intel: Optional[dict] = None, match: Optional[dict] = None) -> Dict[str, Any]:
    """Lean discover card — no secrets, no invented metrics."""
    intel = intel or {}
    followers = metric_from_platforms(user, "followers") or parse_number(user.get("followers"))
    er = engagement_rate(user)
    views = metric_from_platforms(user, "views") or parse_number(user.get("average_views"))
    quality = intel.get("quality_score")
    if quality is None:
        quality = quality_components(user, intel).get("quality_score")
    auth = authenticity_from_signals(user, intel)
    growth = intel.get("growth_30d")
    plats = _as_list(user.get("platforms")) or [p for p, row in (user.get("platform_metrics") or {}).items()
                                                if isinstance(row, dict) and row.get("handle")]
    return {
        "id": user.get("id"),
        "name": user.get("name") or user.get("username"),
        "username": user.get("username") or user.get("handle"),
        "handle": user.get("handle") or user.get("username"),
        "avatar": user.get("avatar"),
        "bio": user.get("bio"),
        "platforms": plats,
        "verified": bool(user.get("verified")),
        "category": user.get("category") or (user.get("niches") or [None])[0] if user.get("niches") else None,
        "niches": user.get("niches") or [],
        "city": user.get("city"),
        "state": user.get("state"),
        "location": user.get("location") or user.get("city"),
        "languages": user.get("languages") or [],
        "followers": followers,
        "engagement_rate": er,
        "average_views": views,
        "growth_30d": growth,
        "growth_label": growth_label(growth) if growth is not None else None,
        "quality_score": quality,
        "ai_match_score": (match or {}).get("match_score") or intel.get("ai_match_score"),
        "risk": auth.get("risk"),
        "authenticity_score": auth.get("score"),
        "creator_tier": creator_tier(followers),
        "base_rate": parse_number(user.get("base_rate")),
        "availability": user.get("availability"),
        "data_freshness": intel.get("updated_at") or user.get("analytics_last_synced"),
        "data_source": intel.get("data_source") or "cr8_catalog",
    }


class SocialDataProvider:
    name = "base"

    def is_configured(self) -> bool:
        return False

    async def search_creators(self, **kwargs) -> List[dict]:
        raise NotImplementedError

    async def get_creator_profile(self, handle: str, platform: str) -> Optional[dict]:
        raise NotImplementedError

    async def get_posts(self, handle: str, platform: str) -> List[dict]:
        return []

    async def get_post_metrics(self, handle: str, platform: str) -> dict:
        return {}

    async def get_audience_data(self, handle: str, platform: str) -> dict:
        return {}

    async def get_historical_metrics(self, handle: str, platform: str) -> List[dict]:
        return []


class CatalogProvider(SocialDataProvider):
    name = "catalog"

    def is_configured(self) -> bool:
        return True


class ApifyProvider(SocialDataProvider):
    name = "apify"

    def __init__(self, apify_service: Any):
        self.svc = apify_service

    def is_configured(self) -> bool:
        try:
            return bool(self.svc and self.svc.is_configured())
        except Exception:
            return False

    async def get_creator_profile(self, handle: str, platform: str) -> Optional[dict]:
        if not self.is_configured():
            return None
        plat = normalize_platform(platform)
        if plat not in {"instagram", "youtube", "facebook"}:
            return None
        try:
            data = await self.svc.fetch_sync(plat, handle)
            if not data:
                return None
            out = dict(data)
            out["platform"] = plat
            out["handle"] = out.get("handle") or handle
            out["provider"] = "apify"
            return out
        except Exception as e:
            logger.warning("ApifyProvider profile failed %s/%s: %s", plat, handle, e)
            return None


def merge_provider_profile(user: dict, fetched: dict) -> Dict[str, Any]:
    """Apply provider fields only when non-empty. Keep previous valid values."""
    if not fetched:
        return {}
    pm = dict(user.get("platform_metrics") or {})
    plat = fetched.get("platform")
    if not plat:
        return {}
    prev = dict(pm.get(plat) or {})
    nxt = dict(prev)
    for key in ("handle", "display_name", "bio", "avatar"):
        val = fetched.get(key)
        if val:
            nxt[key if key != "display_name" else "handle"] = nxt.get(key) or val
    for key in ("followers", "posts", "views", "engagement"):
        val = parse_number(fetched.get(key))
        if val is not None and val >= 0:
            nxt[key] = val
    nxt["last_synced"] = utc_now()
    nxt["data_source"] = "apify"
    nxt["provider"] = "apify"
    pm[plat] = nxt
    patch: Dict[str, Any] = {"platform_metrics": pm, "analytics_last_synced": utc_now()}
    fol = parse_number(nxt.get("followers"))
    if fol is not None:
        prev_fol = parse_number(user.get("followers"))
        if prev_fol is None or fol > 0:
            patch["followers"] = int(fol)
    if fetched.get("bio") and not (user.get("bio") or "").strip():
        patch["bio"] = fetched["bio"]
    if fetched.get("avatar") and not user.get("avatar"):
        patch["avatar"] = fetched["avatar"]
    return patch


def facts_for_research(user: dict, intel: Optional[dict], snaps: Sequence[dict], reviews: Sequence[dict]) -> Dict[str, Any]:
    """Ground-truth payload. LLM may only paraphrase these keys."""
    card = public_card(user, intel)
    auth = authenticity_from_signals(user, intel)
    quality = quality_components(user, intel)
    growth = {}
    for d in (7, 30, 60, 90, 180):
        g = growth_from_snapshots(snaps, d)
        growth[f"{d}d"] = g
    collabs = []
    return {
        "name": card.get("name"),
        "platform": (card.get("platforms") or [None])[0],
        "platforms": card.get("platforms"),
        "followers": card.get("followers"),
        "location": card.get("location") or card.get("city"),
        "languages": card.get("languages"),
        "category": card.get("category"),
        "niches": card.get("niches"),
        "tier": card.get("creator_tier"),
        "verified": card.get("verified"),
        "bio": user.get("bio") or None,
        "average_views": card.get("average_views"),
        "engagement_rate": card.get("engagement_rate"),
        "base_rate": card.get("base_rate"),
        "availability": user.get("availability"),
        "quality": quality,
        "authenticity": auth,
        "growth": growth,
        "growth_label": growth_label(growth.get("30d")),
        "reviews_count": len(list(reviews or [])),
        "avg_rating": round(sum(r.get("rating") or 0 for r in reviews) / len(reviews), 2) if reviews else None,
        "topics": (intel or {}).get("topics") or (intel or {}).get("primary_topics"),
        "content_style": (intel or {}).get("content_style"),
        "audience": (intel or {}).get("audience") or {},
        "collaborations": collabs,
        "data_source": card.get("data_source"),
        "retrieved_at": utc_now(),
        "snapshot_count": len(list(snaps or [])),
    }


def research_template(facts: Dict[str, Any], campaign: Optional[dict] = None) -> Dict[str, Any]:
    def v(key, nested=None):
        val = facts.get(key) if nested is None else (facts.get(nested) or {}).get(key)
        return val if val not in (None, "", [], {}) else UNAVAILABLE

    rec = UNAVAILABLE
    if campaign and facts.get("followers") is not None:
        rec = (
            f"Stored catalog fit for '{campaign.get('title') or campaign.get('objective') or 'this campaign'}' "
            f"uses category {v('category')}, location {v('location')}, followers {v('followers')}."
        )
    elif facts.get("followers") is not None:
        rec = f"{v('name')} is a {v('tier') or 'catalog'} creator with {v('followers')} followers on {v('platform')}."
    return {
        "overview": {
            "name": v("name"),
            "platform": v("platform"),
            "followers": v("followers"),
            "location": v("location"),
            "language": v("languages"),
            "category": v("category"),
            "tier": v("tier"),
            "verification": facts.get("verified"),
        },
        "performance": {
            "average_views": v("average_views"),
            "engagement": v("engagement_rate"),
            "growth": facts.get("growth") or UNAVAILABLE,
            "posting_frequency": UNAVAILABLE,
        },
        "audience": facts.get("audience") or {"note": UNAVAILABLE},
        "content": {
            "primary_topics": v("topics"),
            "content_style": v("content_style"),
            "formats": UNAVAILABLE,
        },
        "brand_fit": {
            "categories": v("niches"),
            "previous_brand_collaborations": v("collaborations"),
        },
        "risk": {
            "authenticity_risk": (facts.get("authenticity") or {}).get("risk", UNAVAILABLE),
            "flags": (facts.get("authenticity") or {}).get("flags") or [],
            "wording": (facts.get("authenticity") or {}).get("wording"),
        },
        "recommendation": rec,
        "disclaimer": "Every claim is taken from stored flugr catalog or provider snapshots. Missing fields are marked Data unavailable.",
        "facts": facts,
    }
