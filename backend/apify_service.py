"""Apify social scraper service — sync analytics + async job polling."""
from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

from apify_client import ApifyClientAsync

logger = logging.getLogger("apify_service")
logger.setLevel(logging.INFO)

ACTOR_INSTAGRAM = os.environ.get("APIFY_ACTOR_INSTAGRAM", "apify~instagram-scraper")
# streamhut/youtube-scraper does not exist on Apify (404). Use Streamers channel scraper.
ACTOR_YOUTUBE = os.environ.get("APIFY_ACTOR_YOUTUBE", "streamers~youtube-channel-scraper")
ACTOR_FACEBOOK = os.environ.get("APIFY_ACTOR_FACEBOOK", "apify~facebook-pages-scraper")

PLATFORM_HOSTS = {
    "instagram": ("instagram.com", "instagr.am"),
    "youtube": ("youtube.com", "youtu.be", "m.youtube.com"),
    "facebook": ("facebook.com", "fb.com", "fb.watch", "m.facebook.com"),
}

HANDLE_RE = re.compile(r"^[A-Za-z0-9._@/-]{1,80}$")
MAX_ACTOR_RETRIES = 3
STALE_JOB_MINUTES = 30


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def strip_handle(raw: str) -> str:
    """Normalize @handle / URL / bare username to a bare handle."""
    value = (raw or "").strip()
    if not value:
        return ""
    if "://" in value or value.lower().startswith(("instagram.com", "www.", "youtube.", "facebook.", "fb.com", "youtu.be")):
        url = value if "://" in value else f"https://{value}"
        platform, handle = parse_social_url(url)
        if handle:
            return handle
        # fall through: last path segment
        path = urlparse(url).path.strip("/")
        if path:
            return path.split("/")[-1].lstrip("@")
    return value.lstrip("@").strip().split("?")[0].split("/")[0]


def parse_social_url(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (platform, handle_or_path) for supported social URLs."""
    raw = (url or "").strip()
    if not raw:
        return None, None
    if "://" not in raw:
        raw = f"https://{raw.lstrip('/')}"
    try:
        parsed = urlparse(raw)
    except Exception:
        return None, None
    host = (parsed.netloc or "").lower().removeprefix("www.")
    path = (parsed.path or "").strip("/")
    handle = path.split("/")[0].lstrip("@") if path else None
    if handle and handle.lower() in {"reel", "reels", "p", "tv", "watch", "channel", "c", "user", "pages", "profile.php"}:
        parts = path.split("/")
        handle = parts[1].lstrip("@") if len(parts) > 1 else handle

    for platform, hosts in PLATFORM_HOSTS.items():
        if any(host == h or host.endswith("." + h) for h in hosts):
            return platform, handle or None
    return None, None


def validate_scrape_url(url: str) -> str:
    """Validate and normalize a scrape URL. Raises ValueError on bad input."""
    raw = (url or "").strip()
    if not raw:
        raise ValueError("URL is required")
    if len(raw) > 500:
        raise ValueError("URL is too long")

    # Bare handle → assume Instagram for ProfileEdit autofill convenience
    if "://" not in raw and "." not in raw.split("/")[0] and HANDLE_RE.match(raw.lstrip("@")):
        handle = strip_handle(raw)
        if not handle:
            raise ValueError("Invalid handle")
        return f"https://www.instagram.com/{handle}/"

    if "://" not in raw:
        raw = f"https://{raw.lstrip('/')}"

    platform, handle = parse_social_url(raw)
    if not platform:
        raise ValueError("Unsupported platform. Use Instagram, YouTube, or Facebook URLs.")
    if not handle:
        raise ValueError("Could not extract a profile handle from the URL.")
    # Rebuild canonical URL
    if platform == "instagram":
        return f"https://www.instagram.com/{handle}/"
    if platform == "youtube":
        return f"https://www.youtube.com/@{handle}"
    return f"https://www.facebook.com/{handle}"


def platform_from_actor(actor_id: str) -> str:
    aid = (actor_id or "").lower()
    if "instagram" in aid:
        return "instagram"
    if "youtube" in aid:
        return "youtube"
    if "facebook" in aid:
        return "facebook"
    if "~" in (actor_id or ""):
        return actor_id.split("~", 1)[1]
    return "unknown"


def _flatten_youtube_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Merge Streamers channel-scraper nested aboutChannelInfo into a flat profile dict."""
    item = dict(item or {})
    about = item.get("aboutChannelInfo") if isinstance(item.get("aboutChannelInfo"), dict) else {}
    if about:
        # Prefer channel totals from aboutChannelInfo over per-video fields
        for src, dest in (
            ("numberOfSubscribers", "numberOfSubscribers"),
            ("channelTotalViews", "totalViews"),
            ("channelTotalVideos", "numberOfVideos"),
            ("channelName", "channelName"),
            ("channelUsername", "username"),
            ("channelDescription", "description"),
            ("channelAvatarUrl", "avatarUrl"),
            ("channelUrl", "channelUrl"),
        ):
            if about.get(src) is not None and not item.get(dest):
                item[dest] = about.get(src)
        if about.get("channelUsername") and not item.get("handle"):
            item["handle"] = str(about.get("channelUsername")).lstrip("@")
        if about.get("channelName") and not item.get("channelName"):
            item["channelName"] = about.get("channelName")
    # Alternate flat shapes some YouTube actors return
    if item.get("channelTotalViews") is not None and item.get("totalViews") is None:
        item["totalViews"] = item.get("channelTotalViews")
    if item.get("channelTotalVideos") is not None and item.get("numberOfVideos") is None:
        item["numberOfVideos"] = item.get("channelTotalVideos")
    if item.get("subscriberCount") is not None and item.get("numberOfSubscribers") is None:
        item["numberOfSubscribers"] = item.get("subscriberCount")
    return item


def normalize_profile_item(platform: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """Unified profile shape for sync-analytics and scrape jobs.

    Actor payloads / IDs are unchanged — only response field mapping is richer.
    Missing views/reach stay None (not fabricated zeros).
    """
    from social_analytics import compact_metrics_for_storage, enrich_from_raw_profile

    item = item or {}
    if platform == "instagram":
        base = {
            "platform": "instagram",
            "handle": item.get("username") or item.get("handle") or "",
            "display_name": item.get("fullName") or item.get("name") or "",
            "bio": item.get("biography") or item.get("bio") or "",
            "avatar": item.get("profilePicUrl") or item.get("profilePicUrlHD") or "",
            "raw": item,
        }
    elif platform == "youtube":
        item = _flatten_youtube_item(item)
        base = {
            "platform": "youtube",
            "handle": (
                item.get("channelUsername")
                or item.get("username")
                or item.get("channelName")
                or item.get("handle")
                or ""
            ).lstrip("@"),
            "display_name": item.get("channelName") or item.get("title") or item.get("name") or "",
            "bio": item.get("description") or item.get("channelDescription") or item.get("bio") or "",
            "avatar": item.get("avatarUrl") or item.get("channelAvatarUrl") or item.get("thumbnailUrl") or "",
            "raw": item,
        }
    else:
        base = {
            "platform": "facebook",
            "handle": item.get("pageName") or item.get("username") or item.get("handle") or "",
            "display_name": item.get("title") or item.get("pageName") or item.get("name") or "",
            "bio": item.get("intro") or item.get("about") or item.get("bio") or "",
            "avatar": item.get("profilePictureUrl") or item.get("avatar") or "",
            "raw": item,
        }

    enriched = enrich_from_raw_profile(platform, {**base, **item, "raw": item})
    stored = compact_metrics_for_storage(enriched)
    return {
        **base,
        **stored,
        "followers": stored.get("followers") or 0,
        "posts": stored.get("posts") or 0,
        "views": stored.get("views"),
        "engagement": stored.get("engagement") if stored.get("engagement") is not None else 0,
        "raw": item,
    }


class ApifyService:
    def __init__(self):
        self.token = os.environ.get("APIFY_TOKEN")
        self.client = ApifyClientAsync(self.token) if self.token else None

    def is_configured(self) -> bool:
        return bool(self.token and self.client)

    async def health_check(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {"success": False, "service": "apify", "status": "not_configured"}
        try:
            await self.client.user().get()
            return {"success": True, "service": "apify", "status": "connected"}
        except Exception as e:
            logger.error("[APIFY] Health check failed: %s", e)
            return {"success": False, "service": "apify", "status": "error", "message": str(e)}

    def determine_actor_and_payload(self, url: str) -> Tuple[str, dict, str]:
        """Maps a validated URL to actor, payload, and platform label."""
        platform, handle = parse_social_url(url)
        if not platform or not handle:
            raise ValueError("Unsupported platform URL")
        if platform == "instagram":
            return (
                ACTOR_INSTAGRAM,
                {
                    "addParentData": False,
                    "directUrls": [url],
                    "resultsLimit": 1,
                    "resultsType": "details",
                },
                "instagram",
            )
        if platform == "youtube":
            # Prefer channel totals from aboutChannelInfo (1 video row is enough to attach channel meta)
            return (
                ACTOR_YOUTUBE,
                {
                    "startUrls": [{"url": url}],
                    "maxResults": 1,
                    "maxResultsShorts": 0,
                    "maxResultStreams": 0,
                },
                "youtube",
            )
        if platform == "facebook":
            return (
                ACTOR_FACEBOOK,
                {"startUrls": [{"url": url}], "resultsLimit": 1},
                "facebook",
            )
        raise ValueError("Unsupported platform URL")

    async def _call_actor_with_retries(self, actor_id: str, payload: dict):
        last_err: Optional[Exception] = None
        for attempt in range(1, MAX_ACTOR_RETRIES + 1):
            try:
                logger.info("[APIFY] ACTOR_STARTED attempt=%s actor=%s", attempt, actor_id)
                run = await self.client.actor(actor_id).call(run_input=payload)
                logger.info("[APIFY] ACTOR_COMPLETED run_id=%s", getattr(run, "id", None))
                return run
            except Exception as e:
                last_err = e
                logger.warning("[APIFY] ACTOR_RETRY attempt=%s error=%s", attempt, e)
                if attempt < MAX_ACTOR_RETRIES:
                    await asyncio.sleep(min(2 ** attempt, 8))
        raise last_err or RuntimeError("Apify actor call failed")

    async def _dataset_items(self, run) -> list:
        dataset_id = getattr(run, "default_dataset_id", None)
        if not dataset_id:
            return []
        list_page = await self.client.dataset(dataset_id).list_items()
        return list(list_page.items or [])

    async def fetch_sync(self, platform: str, handle: str) -> Optional[Dict[str, Any]]:
        """Blocking fetch used by sync-analytics. Returns metrics-shaped dict."""
        if not self.is_configured():
            logger.warning("[APIFY] Token missing. Cannot sync %s handle %s", platform, handle)
            return None

        clean = strip_handle(handle)
        if not clean:
            return None
        if platform == "instagram":
            url = f"https://www.instagram.com/{clean}/"
        elif platform == "youtube":
            url = f"https://www.youtube.com/@{clean}"
        elif platform == "facebook":
            url = f"https://www.facebook.com/{clean}"
        else:
            return None

        try:
            actor_id, payload, plat = self.determine_actor_and_payload(url)
            run = await self._call_actor_with_retries(actor_id, payload)
            items = await self._dataset_items(run)
            if not items:
                logger.warning("[APIFY] SCRAPER_EMPTY platform=%s handle=%s", platform, clean)
                return None
            normalized = normalize_profile_item(plat, items[0] if isinstance(items[0], dict) else {})
            # sync-analytics expects compact metrics (+ preserve handle); keep nulls for missing views/reach
            out = {
                "followers": normalized.get("followers") or 0,
                "posts": normalized.get("posts") or 0,
                "views": normalized.get("views"),
                "engagement": normalized.get("engagement") if normalized.get("engagement") is not None else 0,
                "handle": clean,
                "likes": normalized.get("likes"),
                "comments": normalized.get("comments"),
                "shares": normalized.get("shares"),
                "saves": normalized.get("saves"),
                "reach": normalized.get("reach"),
                "impressions": normalized.get("impressions"),
                "videoViews": normalized.get("videoViews"),
                "engagement_absolute": normalized.get("engagement_absolute"),
                "engagementRateBasis": normalized.get("engagementRateBasis"),
            }
            if plat == "youtube":
                out["subscribers"] = normalized.get("subscribers") or out["followers"]
            return out
        except Exception as e:
            logger.error("[APIFY] SCRAPER_FAILED sync %s %s: %s", platform, clean, e)
            return None

    async def create_scraper_job(self, db, user_id: str, url: str) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("APIFY_TOKEN not configured")

        normalized_url = validate_scrape_url(url)
        actor_id, payload, platform = self.determine_actor_and_payload(normalized_url)

        # Prevent duplicate in-flight jobs for same user+url
        existing = await db.scraper_jobs.find_one(
            {
                "user_id": user_id,
                "url": normalized_url,
                "status": {"$in": ["pending", "running"]},
            }
        )
        if existing:
            logger.info("[APIFY] SCRAPER_DEDUP returning existing job %s", existing["id"])
            return existing

        job_id = f"job_{uuid.uuid4().hex[:12]}"
        job_doc = {
            "id": job_id,
            "user_id": user_id,
            "url": normalized_url,
            "platform": platform,
            "actor_id": actor_id,
            "payload": payload,
            "status": "pending",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "result_data": None,
            "error_message": None,
        }
        await db.scraper_jobs.insert_one(job_doc)
        logger.info("[APIFY] SCRAPER_REQUEST job=%s url=%s", job_id, normalized_url)
        return job_doc

    async def run_scraper_job(self, db, job_id: str):
        job = await db.scraper_jobs.find_one({"id": job_id})
        if not job:
            logger.error("[APIFY] Job %s not found", job_id)
            return

        if not self.is_configured():
            await self._update_job_status(db, job_id, "failed", "APIFY_TOKEN not configured")
            return

        actor_id = job["actor_id"]
        payload = job["payload"]
        platform = job.get("platform") or platform_from_actor(actor_id)

        await self._update_job_status(db, job_id, "running")
        start_time = datetime.utcnow()

        try:
            run = await self._call_actor_with_retries(actor_id, payload)
            items = await self._dataset_items(run)
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info("[APIFY] DATASET_RETRIEVED job=%s items=%s duration=%.1fs", job_id, len(items), duration)

            if not items:
                await self._update_job_status(db, job_id, "failed", "No profile data found for this URL")
                return

            raw_item = items[0] if isinstance(items[0], dict) else {}
            normalized = normalize_profile_item(platform, raw_item)
            result_payload = {
                "ok": True,
                "platform": platform,
                "data": normalized,
                # Keep legacy raw fields for older frontends
                "legacy": {
                    "biography": normalized.get("bio"),
                    "fullName": normalized.get("display_name"),
                    "followersCount": normalized.get("followers"),
                    "username": normalized.get("handle"),
                },
            }
            await self._update_job_status(db, job_id, "completed", result_data=result_payload)
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.error("[APIFY] SCRAPER_FAILED job=%s after %.1fs: %s", job_id, duration, e)
            await self._update_job_status(db, job_id, "failed", f"Actor failed: {e}")

    async def fail_stale_jobs(self, db, older_than_minutes: int = STALE_JOB_MINUTES) -> int:
        cutoff = (datetime.utcnow() - timedelta(minutes=older_than_minutes)).isoformat()
        result = await db.scraper_jobs.update_many(
            {"status": {"$in": ["pending", "running"]}, "updated_at": {"$lt": cutoff}},
            {
                "$set": {
                    "status": "failed",
                    "error_message": f"Timed out after {older_than_minutes} minutes",
                    "updated_at": _now_iso(),
                }
            },
        )
        count = getattr(result, "modified_count", 0) or 0
        if count:
            logger.warning("[APIFY] Marked %s stale scraper jobs as failed", count)
        return count

    async def ensure_indexes(self, db):
        await db.scraper_jobs.create_index("id", unique=True)
        await db.scraper_jobs.create_index([("user_id", 1), ("created_at", -1)])
        await db.scraper_jobs.create_index([("status", 1), ("updated_at", 1)])
        await db.scraper_jobs.create_index([("user_id", 1), ("url", 1), ("status", 1)])

    async def _update_job_status(
        self,
        db,
        job_id: str,
        status: str,
        error_message: str = None,
        result_data: dict = None,
    ):
        update: Dict[str, Any] = {"status": status, "updated_at": _now_iso()}
        if error_message is not None:
            update["error_message"] = error_message
        if result_data is not None:
            update["result_data"] = result_data
        await db.scraper_jobs.update_one({"id": job_id}, {"$set": update})


apify_service = ApifyService()
