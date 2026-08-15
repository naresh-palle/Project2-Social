"""Influencer discovery APIs — additive collections and routes only."""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from discovery_engine import (
    NOT_CONFIGURED,
    UNAVAILABLE,
    ApifyProvider,
    authenticity_from_signals,
    creator_embed_parts,
    DEFAULT_QUALITY_WEIGHTS,
    embed_text,
    facts_for_research,
    filters_to_mongo,
    cosine,
    growth_from_snapshots,
    growth_label,
    heuristic_parse_query,
    match_breakdown,
    merge_provider_profile,
    public_card,
    quality_components,
    research_template,
    snapshot_from_user,
    utc_now,
    validate_filters,
)

logger = logging.getLogger("discovery")


class SearchBody(BaseModel):
    filters: Dict[str, Any] = Field(default_factory=dict)
    campaign_id: Optional[str] = None
    brief: Optional[Dict[str, Any]] = None
    page: int = 1
    limit: int = 24
    sort: str = "quality"


class AISearchBody(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    campaign_id: Optional[str] = None
    page: int = 1
    limit: int = 24


class CompareBody(BaseModel):
    ids: List[str] = Field(min_length=2, max_length=8)
    campaign_id: Optional[str] = None


class MatchBody(BaseModel):
    campaign_id: Optional[str] = None
    brief: Optional[Dict[str, Any]] = None
    creator_ids: Optional[List[str]] = None
    limit: int = 12


class RefreshBody(BaseModel):
    platforms: Optional[List[str]] = None


class DeepResearchBody(BaseModel):
    campaign_id: Optional[str] = None
    objective: Optional[str] = None


class SavedSearchBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    filters: Dict[str, Any] = Field(default_factory=dict)
    query: Optional[str] = None


class ShortlistBody(BaseModel):
    creator_id: str
    action: str = "add"  # add | remove | selected | rejected


class AssistantBody(BaseModel):
    message: str = Field(min_length=1, max_length=800)
    filters: Dict[str, Any] = Field(default_factory=dict)
    selected_ids: List[str] = Field(default_factory=list)
    history: List[Dict[str, str]] = Field(default_factory=list)


def _strip_secrets(user: dict) -> dict:
    out = dict(user or {})
    out.pop("_id", None)
    out.pop("password_hash", None)
    out.pop("oauth_connections", None)
    return out


def setup_discovery(
    api_router,
    *,
    db,
    get_current_user: Callable,
    require_role: Callable,
    call_llm: Callable,
    parse_json: Callable,
    logger=logger,
):
    async def _brand(current: dict) -> dict:
        await require_role(current, ["owner", "agent", "admin"])
        if current.get("role") == "agent" and not current.get("agent_approved"):
            raise HTTPException(status_code=403, detail="Agent not approved by Admin")
        return current

    async def ensure_indexes():
        await db.users.create_index("role")
        await db.users.create_index("niches")
        await db.users.create_index("platforms")
        await db.users.create_index("followers")
        await db.users.create_index("city")
        await db.users.create_index("state")
        await db.creator_intelligence.create_index("creator_id", unique=True)
        await db.creator_metric_snapshots.create_index([("creator_id", 1), ("captured_at", -1)])
        await db.saved_searches.create_index([("user_id", 1), ("created_at", -1)])
        await db.creator_shortlists.create_index([("user_id", 1), ("creator_id", 1)], unique=True)
        await db.discovery_jobs.create_index("id", unique=True)
        await db.discovery_jobs.create_index([("status", 1), ("created_at", -1)])
        await db.match_feedback.create_index([("user_id", 1), ("created_at", -1)])
        existing = await db.score_model_config.find_one({"id": "quality_v1"})
        if not existing:
            await db.score_model_config.insert_one({
                "id": "quality_v1",
                "weights": dict(DEFAULT_QUALITY_WEIGHTS),
                "version": 1,
                "updated_at": utc_now(),
            })

    async def _weights() -> dict:
        doc = await db.score_model_config.find_one({"id": "quality_v1"}, {"_id": 0})
        return (doc or {}).get("weights") or dict(DEFAULT_QUALITY_WEIGHTS)

    async def _intel(creator_id: str) -> dict:
        return await db.creator_intelligence.find_one({"creator_id": creator_id}, {"_id": 0}) or {}

    async def _snaps(creator_id: str, limit: int = 180) -> list:
        return await db.creator_metric_snapshots.find(
            {"creator_id": creator_id}, {"_id": 0}
        ).sort("captured_at", -1).to_list(limit)

    async def _maybe_snapshot(user: dict) -> None:
        cid = user.get("id")
        if not cid:
            return
        latest = await db.creator_metric_snapshots.find_one(
            {"creator_id": cid}, {"_id": 0, "captured_at": 1}, sort=[("captured_at", -1)]
        )
        if latest and latest.get("captured_at"):
            try:
                ts = datetime.fromisoformat(str(latest["captured_at"]).replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - ts < timedelta(hours=20):
                    return
            except Exception:
                pass
        snap = snapshot_from_user(user)
        snap["id"] = str(uuid.uuid4())
        await db.creator_metric_snapshots.insert_one(snap)

    async def _upsert_intel(user: dict, extra: Optional[dict] = None) -> dict:
        cid = user["id"]
        weights = await _weights()
        prev = await _intel(cid)
        snaps = await _snaps(cid, 40)
        growth = {}
        for d in (7, 30, 60, 90, 180):
            growth[f"growth_{d}d"] = growth_from_snapshots(snaps, d)
        quality = quality_components(user, {**prev, **growth}, weights)
        auth = authenticity_from_signals(user, {**prev, **growth})
        embedding = embed_text(creator_embed_parts(user, prev))
        doc = {
            "creator_id": cid,
            "quality_score": quality.get("quality_score"),
            "quality_breakdown": quality.get("breakdown"),
            "quality_reasons": quality.get("reasons"),
            "authenticity_score": auth.get("score"),
            "risk": auth.get("risk"),
            "risk_flags": auth.get("flags"),
            "brand_safety_score": (quality.get("breakdown") or {}).get("brand_safety"),
            "audience_quality_score": (quality.get("breakdown") or {}).get("audience_quality"),
            "content_quality_score": (quality.get("breakdown") or {}).get("content_quality"),
            "growth_score": (quality.get("breakdown") or {}).get("growth"),
            **growth,
            "growth_label": growth_label(growth.get("growth_30d")),
            "embedding": embedding,
            "data_source": prev.get("data_source") or "cr8_catalog",
            "provider": prev.get("provider") or "catalog",
            "updated_at": utc_now(),
        }
        if extra:
            for k, v in extra.items():
                if v not in (None, "", [], {}):
                    doc[k] = v
        await db.creator_intelligence.update_one(
            {"creator_id": cid}, {"$set": doc}, upsert=True
        )
        return doc

    async def _load_creators(mongo: dict, limit: int, skip: int) -> List[dict]:
        cur = db.users.find(mongo, {"_id": 0, "password_hash": 0, "oauth_connections": 0}).skip(skip).limit(limit)
        return await cur.to_list(length=limit)

    async def _enrich(users: List[dict], brief: Optional[dict] = None) -> List[dict]:
        cards = []
        for u in users:
            intel = await _intel(u["id"])
            if not intel.get("quality_score"):
                intel = await _upsert_intel(u)
            await _maybe_snapshot(u)
            match = match_breakdown(u, brief, intel) if brief else None
            card = public_card(u, intel, match)
            if brief:
                card["match"] = match
            cards.append(card)
        return cards

    def _sort_cards(cards: List[dict], sort: str) -> List[dict]:
        key = (sort or "quality").lower()
        def num(c, k):
            v = c.get(k)
            return float(v) if isinstance(v, (int, float)) else -1
        if key in {"followers", "engagement", "engagement_rate", "quality", "quality_score", "match", "ai_match_score", "growth"}:
            field = {
                "followers": "followers",
                "engagement": "engagement_rate",
                "engagement_rate": "engagement_rate",
                "quality": "quality_score",
                "quality_score": "quality_score",
                "match": "ai_match_score",
                "ai_match_score": "ai_match_score",
                "growth": "growth_30d",
            }[key]
            cards.sort(key=lambda c: num(c, field), reverse=True)
        return cards

    async def _post_filter(cards: List[dict], filters: dict) -> List[dict]:
        out = []
        for c in cards:
            er = c.get("engagement_rate")
            if filters.get("engagement_rate_min") is not None:
                if er is None or er < float(filters["engagement_rate_min"]):
                    continue
            if filters.get("engagement_rate_max") is not None:
                if er is None or er > float(filters["engagement_rate_max"]):
                    continue
            if filters.get("avg_views_min") is not None:
                av = c.get("average_views")
                if av is None or av < float(filters["avg_views_min"]):
                    continue
            if filters.get("tiers") and c.get("creator_tier") not in filters["tiers"]:
                continue
            if filters.get("audience_quality_min") is not None:
                continue  # applied after intel if present
            if filters.get("ai_match_min") is not None:
                m = c.get("ai_match_score")
                if m is None or m < float(filters["ai_match_min"]):
                    continue
            if filters.get("fake_follower_risk_max") is not None:
                risk_rank = {"low": 1, "medium": 2, "high": 3}
                cap = {"low": 1, "medium": 2, "high": 3}.get(str(filters["fake_follower_risk_max"]).lower(), 3)
                if risk_rank.get(c.get("risk") or "low", 1) > cap:
                    continue
            out.append(c)
        return out

    async def _job(kind: str, creator_id: Optional[str], provider: str, fn):
        job = {
            "id": str(uuid.uuid4()),
            "kind": kind,
            "creator_id": creator_id,
            "provider": provider,
            "status": "running",
            "started_at": utc_now(),
            "completed_at": None,
            "retry_count": 0,
            "error_message": None,
            "created_at": utc_now(),
        }
        await db.discovery_jobs.insert_one(dict(job))
        try:
            result = await fn()
            await db.discovery_jobs.update_one(
                {"id": job["id"]},
                {"$set": {"status": "completed", "completed_at": utc_now()}},
            )
            return result
        except Exception as e:
            logger.warning("discovery job %s failed: %s", kind, e)
            await db.discovery_jobs.update_one(
                {"id": job["id"]},
                {"$set": {"status": "failed", "completed_at": utc_now(), "error_message": str(e)[:400]}},
            )
            raise

    def _apify():
        try:
            from apify_service import apify_service
            return ApifyProvider(apify_service)
        except Exception:
            return ApifyProvider(None)

    @api_router.post("/creators/search")
    async def creators_search(body: SearchBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        filters = validate_filters({**body.filters, "page": body.page, "limit": body.limit, "sort": body.sort})
        mongo = filters_to_mongo(filters)
        page = int(filters.get("page") or body.page or 1)
        limit = int(filters.get("limit") or body.limit or 24)
        skip = (page - 1) * limit
        total = await db.users.count_documents(mongo)
        users = await _load_creators(mongo, min(limit * 3, 80), skip)
        brief = body.brief
        if body.campaign_id:
            camp = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
            brief = brief or camp
        cards = await _enrich(users, brief)
        cards = await _post_filter(cards, filters)
        cards = _sort_cards(cards, filters.get("sort") or body.sort)
        cards = cards[:limit]
        return {
            "filters": filters,
            "page": page,
            "limit": limit,
            "total": total,
            "creators": cards,
        }

    @api_router.post("/creators/ai-search")
    async def creators_ai_search(body: AISearchBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        heuristic = heuristic_parse_query(body.query)
        llm_filters: Dict[str, Any] = {}
        llm_note = None
        system = (
            "Convert a natural-language influencer search into JSON filters. "
            "Return ONLY JSON with any of: platforms (string[]), categories (string[]), "
            "languages (string[]), location, city, state, country, "
            "followers_min, followers_max, engagement_rate_min, price_max, verified (bool), "
            "tiers (nano|micro|mid|macro|mega[]), q (string). "
            "Do not invent creators. Niches should map to CR8 categories like "
            "Technology & Gadgets, Fashion & Style, Beauty & Makeup, Food & Cooking."
        )
        try:
            text = await call_llm(system, f"Query: {body.query}\nReturn JSON only.")
            parsed = parse_json(text or "")
            if isinstance(parsed, dict) and "raw" not in parsed:
                llm_filters = validate_filters(parsed)
            else:
                llm_note = "AI returned unstructured text; using heuristic filters."
        except Exception as e:
            llm_note = f"AI unavailable ({e}); using heuristic filters."
        merged = {**heuristic, **{k: v for k, v in llm_filters.items() if v not in (None, "", [])}}
        merged["page"] = body.page
        merged["limit"] = body.limit
        filters = validate_filters(merged)
        mongo = filters_to_mongo(filters)
        total = await db.users.count_documents(mongo)
        users = await _load_creators(mongo, min(int(filters.get("limit") or 24) * 3, 80),
                                     (int(filters.get("page") or 1) - 1) * int(filters.get("limit") or 24))
        brief = None
        if body.campaign_id:
            brief = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
        cards = await _enrich(users, brief)
        cards = await _post_filter(cards, filters)
        obj_embed = embed_text([body.query])
        for c in cards:
            intel = await _intel(c["id"])
            if intel.get("embedding"):
                c["ai_match_score"] = round(cosine(intel["embedding"], obj_embed) * 100, 1)
        cards = _sort_cards(cards, "match" if any(c.get("ai_match_score") is not None for c in cards) else "quality")
        limit = int(filters.get("limit") or 24)
        return {
            "query": body.query,
            "filters": filters,
            "llm_note": llm_note,
            "total": total,
            "creators": cards[:limit],
        }

    @api_router.post("/creators/compare")
    async def creators_compare(body: CompareBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        users = await db.users.find(
            {"id": {"$in": body.ids}, "role": "influencer"},
            {"_id": 0, "password_hash": 0, "oauth_connections": 0},
        ).to_list(8)
        brief = None
        if body.campaign_id:
            brief = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
        cards = await _enrich(users, brief)
        order = {cid: i for i, cid in enumerate(body.ids)}
        cards.sort(key=lambda c: order.get(c["id"], 99))
        metrics = ["followers", "engagement_rate", "average_views", "growth_30d",
                   "quality_score", "ai_match_score", "authenticity_score", "base_rate"]
        winners = {}
        for m in metrics:
            best = None
            best_id = None
            invert = m == "base_rate"
            for c in cards:
                v = c.get(m)
                if not isinstance(v, (int, float)):
                    continue
                if best is None or (v < best if invert else v > best):
                    best, best_id = v, c["id"]
            winners[m] = best_id
        return {"creators": cards, "winners": winners}

    @api_router.post("/creators/campaign-match")
    async def creators_campaign_match(body: MatchBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        brief = body.brief
        if body.campaign_id:
            camp = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
            if not camp:
                raise HTTPException(status_code=404, detail="Campaign not found")
            if camp.get("owner_id") != current["id"] and current.get("role") != "admin":
                raise HTTPException(status_code=403, detail="Forbidden")
            brief = {**camp, **(brief or {})}
        if not brief:
            raise HTTPException(status_code=400, detail="campaign_id or brief required")
        q = {"role": "influencer", "banned": {"$ne": True}}
        if body.creator_ids:
            q["id"] = {"$in": body.creator_ids}
        users = await _load_creators(q, min(body.limit * 4, 80), 0)
        cards = await _enrich(users, brief)
        cards = _sort_cards(cards, "match")
        return {"brief": {"title": brief.get("title"), "niches": brief.get("niches")}, "creators": cards[: body.limit]}

    @api_router.get("/creators/{creator_id}/intelligence")
    async def creator_intelligence(creator_id: str, current: dict = Depends(get_current_user)):
        await _brand(current)
        user = await db.users.find_one({"id": creator_id, "role": "influencer"}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Creator not found")
        intel = await _upsert_intel(user)
        snaps = await _snaps(creator_id)
        quality = quality_components(user, intel, await _weights())
        auth = authenticity_from_signals(user, intel)
        return {
            "creator": public_card(user, intel),
            "quality": quality,
            "authenticity": auth,
            "audience": intel.get("audience") or {"note": UNAVAILABLE},
            "content": {
                "topics": intel.get("topics") or intel.get("primary_topics") or UNAVAILABLE,
                "content_style": intel.get("content_style") or UNAVAILABLE,
                "language": user.get("languages") or UNAVAILABLE,
            },
            "history": {
                "snapshots": snaps[:90],
                "growth": {k: intel.get(k) for k in ("growth_7d", "growth_30d", "growth_60d", "growth_90d", "growth_180d")},
                "growth_label": intel.get("growth_label"),
            },
            "freshness": intel.get("updated_at"),
            "data_source": intel.get("data_source") or "cr8_catalog",
            "provider": intel.get("provider") or "catalog",
        }

    @api_router.get("/creators/{creator_id}/history")
    async def creator_history(creator_id: str, current: dict = Depends(get_current_user)):
        await _brand(current)
        snaps = await _snaps(creator_id)
        if not snaps:
            return {"snapshots": [], "note": UNAVAILABLE}
        return {"snapshots": list(reversed(snaps[:90]))}

    @api_router.get("/creators/{creator_id}/deep-research")
    async def get_deep_research(creator_id: str, current: dict = Depends(get_current_user)):
        await _brand(current)
        doc = await db.creator_intelligence.find_one({"creator_id": creator_id}, {"_id": 0, "deep_research": 1})
        report = (doc or {}).get("deep_research")
        if not report:
            return {"report": None, "note": UNAVAILABLE}
        return {"report": report}

    @api_router.post("/creators/{creator_id}/deep-research")
    async def run_deep_research(creator_id: str, body: DeepResearchBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        user = await db.users.find_one({"id": creator_id, "role": "influencer"}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Creator not found")

        async def _run():
            intel = await _upsert_intel(user)
            snaps = await _snaps(creator_id)
            reviews = await db.reviews.find({"target_id": creator_id}, {"_id": 0}).to_list(50)
            camp = None
            if body.campaign_id:
                camp = await db.campaigns.find_one({"id": body.campaign_id}, {"_id": 0})
            if body.objective:
                camp = {**(camp or {}), "objective": body.objective}
            facts = facts_for_research(user, intel, snaps, reviews)
            report = research_template(facts, camp)
            try:
                text = await call_llm(
                    "You write evidence-based creator intelligence. Use ONLY the JSON facts. "
                    "If a field is missing, write 'Data unavailable'. Never invent numbers. "
                    "Return JSON with keys: summary (string), recommendation (string), risks (string[]).",
                    f"FACTS:\n{facts}\nCAMPAIGN:{camp or {}}",
                )
                parsed = parse_json(text or "")
                if isinstance(parsed, dict) and "raw" not in parsed:
                    if parsed.get("summary"):
                        report["ai_summary"] = parsed["summary"]
                    if parsed.get("recommendation"):
                        report["recommendation"] = parsed["recommendation"]
                    if parsed.get("risks"):
                        report["ai_risks"] = parsed["risks"]
            except Exception as e:
                report["ai_summary"] = f"LLM unavailable; template used. ({e})"
            report["generated_at"] = utc_now()
            report["generated_by"] = current.get("id")
            await db.creator_intelligence.update_one(
                {"creator_id": creator_id},
                {"$set": {"deep_research": report, "updated_at": utc_now()}},
                upsert=True,
            )
            return report

        report = await _job("creator_deep_research", creator_id, "catalog", _run)
        return {"report": report}

    @api_router.post("/creators/{creator_id}/refresh")
    async def refresh_creator(creator_id: str, body: RefreshBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        user = await db.users.find_one({"id": creator_id, "role": "influencer"})
        if not user:
            raise HTTPException(status_code=404, detail="Creator not found")
        provider = _apify()
        if not provider.is_configured():
            return {
                "ok": False,
                "message": NOT_CONFIGURED,
                "provider": "apify",
            }

        async def _run():
            pm = user.get("platform_metrics") or {}
            plats = body.platforms or [p for p, row in pm.items() if isinstance(row, dict) and row.get("handle")]
            patch: Dict[str, Any] = {}
            errors = []
            merged_user = dict(user)
            for plat in plats:
                row = (pm.get(plat) or {})
                handle = row.get("handle")
                if not handle:
                    continue
                fetched = await provider.get_creator_profile(handle, plat)
                if not fetched:
                    errors.append(f"{plat}: {UNAVAILABLE}")
                    continue
                piece = merge_provider_profile(merged_user, fetched)
                merged_user.update(piece)
                patch.update(piece)
            if patch:
                patch["analytics_last_synced"] = utc_now()
                await db.users.update_one({"id": creator_id}, {"$set": patch})
            fresh = await db.users.find_one({"id": creator_id}, {"_id": 0, "password_hash": 0})
            await _maybe_snapshot(fresh)
            intel = await _upsert_intel(fresh, {"data_source": "apify", "provider": "apify"})
            return {"patch_keys": list(patch.keys()), "errors": errors, "intelligence": intel}

        result = await _job("creator_profile_sync", creator_id, "apify", _run)
        return {"ok": True, **result}

    @api_router.get("/discover/saved-searches")
    async def list_saved_searches(current: dict = Depends(get_current_user)):
        await _brand(current)
        rows = await db.saved_searches.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(40)
        return {"items": rows}

    @api_router.post("/discover/saved-searches")
    async def save_search(body: SavedSearchBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": current["id"],
            "name": body.name.strip(),
            "filters": validate_filters(body.filters),
            "query": body.query,
            "created_at": utc_now(),
        }
        await db.saved_searches.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api_router.delete("/discover/saved-searches/{search_id}")
    async def delete_saved_search(search_id: str, current: dict = Depends(get_current_user)):
        await _brand(current)
        await db.saved_searches.delete_one({"id": search_id, "user_id": current["id"]})
        return {"ok": True}

    @api_router.get("/discover/shortlist")
    async def get_shortlist(current: dict = Depends(get_current_user)):
        await _brand(current)
        rows = await db.creator_shortlists.find({"user_id": current["id"]}, {"_id": 0}).to_list(200)
        ids = [r["creator_id"] for r in rows]
        users = await _load_creators({"id": {"$in": ids}, "role": "influencer"}, 200, 0) if ids else []
        cards = await _enrich(users)
        return {"items": cards}

    @api_router.post("/discover/shortlist")
    async def mutate_shortlist(body: ShortlistBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        if body.action == "remove":
            await db.creator_shortlists.delete_one({"user_id": current["id"], "creator_id": body.creator_id})
        else:
            await db.creator_shortlists.update_one(
                {"user_id": current["id"], "creator_id": body.creator_id},
                {"$set": {
                    "user_id": current["id"],
                    "creator_id": body.creator_id,
                    "status": body.action,
                    "updated_at": utc_now(),
                }},
                upsert=True,
            )
        await db.match_feedback.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current["id"],
            "creator_id": body.creator_id,
            "signal": body.action,
            "created_at": utc_now(),
        })
        return {"ok": True}

    @api_router.post("/discover/assistant")
    async def discover_assistant(body: AssistantBody, current: dict = Depends(get_current_user)):
        await _brand(current)
        msg = body.message.strip()
        filters = validate_filters(body.filters)
        action = "search"
        creator_index = None
        if re.search(r"compare(?: the)? top\s*(\d+)?", msg, re.I):
            action = "compare"
        elif re.search(r"deep research(?: creator)?(?: number)?\s*(\d+)", msg, re.I):
            action = "deep_research"
            m = re.search(r"(\d+)", msg)
            creator_index = int(m.group(1)) if m else 1
        elif re.search(r"shortlist", msg, re.I):
            action = "shortlist"
        extra = heuristic_parse_query(msg)
        merged = validate_filters({**filters, **extra})
        try:
            text = await call_llm(
                "You are the CR8 Discover assistant. Return JSON with keys: "
                "reply (string), action (search|compare|deep_research|shortlist|none), "
                "filters (object, optional), creator_index (int, optional). "
                "Do not invent creator names or metrics.",
                f"User: {msg}\nCurrent filters: {filters}",
            )
            parsed = parse_json(text or "")
            if isinstance(parsed, dict) and "raw" not in parsed:
                action = parsed.get("action") or action
                if isinstance(parsed.get("filters"), dict):
                    merged = validate_filters({**merged, **parsed["filters"]})
                if parsed.get("creator_index"):
                    creator_index = int(parsed["creator_index"])
                reply = parsed.get("reply")
            else:
                reply = None
        except Exception:
            reply = None
        mongo = filters_to_mongo(merged)
        total = await db.users.count_documents(mongo)
        users = await _load_creators(mongo, 24, 0)
        cards = await _enrich(users)
        cards = await _post_filter(cards, merged)
        cards = _sort_cards(cards, "quality")
        if not reply:
            reply = f"I found {total} matching creators in the CR8 catalog. Showing the top {min(len(cards), 10)} by quality score."
        return {
            "reply": reply,
            "action": action,
            "filters": merged,
            "creator_index": creator_index,
            "total": total,
            "creators": cards[:10],
        }

    @api_router.get("/admin/discovery-stats")
    async def discovery_stats(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(hours=24)).isoformat()
        total = await db.users.count_documents({"role": "influencer"})
        synced_today = await db.users.count_documents({
            "role": "influencer",
            "analytics_last_synced": {"$gte": day_ago},
        })
        jobs_ok = await db.discovery_jobs.count_documents({"status": "completed", "completed_at": {"$gte": day_ago}})
        jobs_fail = await db.discovery_jobs.count_documents({"status": "failed", "completed_at": {"$gte": day_ago}})
        stale = await db.users.count_documents({
            "role": "influencer",
            "$or": [
                {"analytics_last_synced": {"$exists": False}},
                {"analytics_last_synced": {"$lt": (now - timedelta(days=7)).isoformat()}},
            ],
        })
        pending_research = await db.discovery_jobs.count_documents({"kind": "creator_deep_research", "status": {"$in": ["pending", "running"]}})
        provider = _apify()
        failed = await db.discovery_jobs.find(
            {"status": "failed"}, {"_id": 0}
        ).sort("completed_at", -1).to_list(20)
        return {
            "total_creators": total,
            "synced_today": synced_today,
            "successful_syncs": jobs_ok,
            "failed_syncs": jobs_fail,
            "stale_creators": stale,
            "pending_research_jobs": pending_research,
            "apify_configured": provider.is_configured(),
            "failed_jobs": failed,
        }

    @api_router.get("/admin/discovery-jobs")
    async def discovery_jobs(status: Optional[str] = None, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        q: Dict[str, Any] = {}
        if status:
            q["status"] = status
        rows = await db.discovery_jobs.find(q, {"_id": 0}).sort("created_at", -1).to_list(80)
        return {"items": rows}

    return ensure_indexes
