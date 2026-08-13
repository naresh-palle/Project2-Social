import os
import uuid
import logging
from datetime import datetime
from apify_client import ApifyClientAsync
from typing import Dict, Any, Optional

logger = logging.getLogger("apify_service")
logger.setLevel(logging.INFO)

# Define known actors
ACTOR_INSTAGRAM = os.environ.get("APIFY_ACTOR_INSTAGRAM", "apify~instagram-scraper")
ACTOR_YOUTUBE = os.environ.get("APIFY_ACTOR_YOUTUBE", "streamhut~youtube-scraper")
ACTOR_FACEBOOK = os.environ.get("APIFY_ACTOR_FACEBOOK", "apify~facebook-pages-scraper")

class ApifyService:
    def __init__(self):
        self.token = os.environ.get("APIFY_TOKEN")
        if self.token:
            self.client = ApifyClientAsync(self.token)
        else:
            self.client = None

    def _get_now_iso(self):
        return datetime.utcnow().isoformat()

    def is_configured(self) -> bool:
        return bool(self.token and self.client)

    async def health_check(self) -> Dict[str, Any]:
        """Verify Apify connectivity."""
        if not self.is_configured():
            return {"success": False, "service": "apify", "status": "not_configured"}
        try:
            # Minimal API call to verify token
            user_info = await self.client.user().get()
            return {"success": True, "service": "apify", "status": "connected"}
        except Exception as e:
            logger.error(f"[APIFY] Health check failed: {e}")
            return {"success": False, "service": "apify", "status": "error", "message": str(e)}

    def determine_actor_and_payload(self, url: str) -> tuple[Optional[str], Optional[dict]]:
        """Maps a URL to the correct Apify actor and payload."""
        url = url.lower()
        if "instagram.com" in url:
            return ACTOR_INSTAGRAM, {"addParentData": False, "directUrls": [url], "resultsLimit": 1}
        elif "youtube.com" in url or "youtu.be" in url:
            return ACTOR_YOUTUBE, {"startUrls": [{"url": url}], "maxResults": 1}
        elif "facebook.com" in url or "fb.com" in url:
            return ACTOR_FACEBOOK, {"startUrls": [{"url": url}], "resultsLimit": 1}
        return None, None

    async def fetch_sync(self, platform: str, handle: str) -> Optional[Dict[str, Any]]:
        """
        Synchronous-style fetch (waits for dataset) used primarily for quick syncs.
        """
        if not self.is_configured():
            logger.warning(f"[APIFY] Token missing. Cannot sync {platform} handle {handle}")
            return None
            
        actor_id = None
        payload = {}
        if platform == "instagram":
            actor_id = ACTOR_INSTAGRAM
            payload = {"addParentData": False, "directUrls": [f"https://instagram.com/{handle}"], "resultsLimit": 1, "resultsType": "details"}
        elif platform == "youtube":
            actor_id = ACTOR_YOUTUBE
            payload = {"startUrls": [{"url": f"https://youtube.com/@{handle}"}], "maxResults": 1}
        elif platform == "facebook":
            actor_id = ACTOR_FACEBOOK
            payload = {"startUrls": [{"url": f"https://facebook.com/{handle}"}], "resultsLimit": 1}
        else:
            return None
            
        logger.info(f"[APIFY] ACTOR_STARTED: Running sync fetch for {platform} via {actor_id}")
        try:
            run = await self.client.actor(actor_id).call(run_input=payload)
            logger.info(f"[APIFY] ACTOR_COMPLETED: {run.id}")
            
            dataset_id = run.default_dataset_id
            if not dataset_id:
                logger.error("[APIFY] DATASET_UNAVAILABLE: No dataset returned.")
                return None
                
            list_page = await self.client.dataset(dataset_id).list_items()
            items = list_page.items
            
            if not items:
                logger.warning("[APIFY] SCRAPER_EMPTY: Dataset is empty.")
                return None
                
            item = items[0]
            logger.info(f"[APIFY] DATASET_RETRIEVED: Found {len(items)} items.")
            
            # Normalize response based on platform
            if platform == "instagram":
                return {
                    "followers": item.get("followersCount", 0),
                    "posts": item.get("postsCount", 0),
                    "views": 0, "engagement": 0
                }
            elif platform == "youtube":
                sub_count = item.get("numberOfSubscribers", item.get("subscribersCount", item.get("followersCount", 0)))
                return {
                    "subscribers": sub_count,
                    "followers": sub_count,
                    "posts": item.get("numberOfVideos", item.get("videosCount", 0)),
                    "views": item.get("totalViews", item.get("viewsCount", 0)),
                    "engagement": 0
                }
            elif platform == "facebook":
                return {
                    "followers": item.get("likes", item.get("followers", 0)),
                    "posts": 0, "views": 0, "engagement": 0
                }
            return item
        except Exception as e:
            logger.error(f"[APIFY] SCRAPER_FAILED: Sync fetch failed for {platform} {handle}. Error: {str(e)}")
            return None

    async def create_scraper_job(self, db, user_id: str, url: str) -> Dict[str, Any]:
        """
        Creates a new scraper job in the database.
        Returns the job dictionary with a unique jobId.
        """
        actor_id, payload = self.determine_actor_and_payload(url)
        if not actor_id:
            raise ValueError("Unsupported platform URL")
            
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        
        job_doc = {
            "id": job_id,
            "user_id": user_id,
            "url": url,
            "actor_id": actor_id,
            "payload": payload,
            "status": "pending",
            "created_at": self._get_now_iso(),
            "updated_at": self._get_now_iso(),
            "result_data": None,
            "error_message": None
        }
        
        await db.scraper_jobs.insert_one(job_doc)
        logger.info(f"[APIFY] SCRAPER_REQUEST: Job {job_id} created for URL {url}")
        return job_doc

    async def run_scraper_job(self, db, job_id: str):
        """
        Executes the long-running scraper job and updates the DB.
        Should be called via asyncio.create_task().
        """
        job = await db.scraper_jobs.find_one({"id": job_id})
        if not job:
            logger.error(f"[APIFY] SCRAPER_FAILED: Job {job_id} not found.")
            return

        if not self.is_configured():
            await self._update_job_status(db, job_id, "failed", "APIFY_TOKEN not configured")
            return

        actor_id = job["actor_id"]
        payload = job["payload"]
        
        await self._update_job_status(db, job_id, "running")
        logger.info(f"[APIFY] ACTOR_STARTED: Job {job_id} starting actor {actor_id}")
        
        start_time = datetime.utcnow()
        
        try:
            # call() waits for the run to finish
            run = await self.client.actor(actor_id).call(run_input=payload)
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"[APIFY] ACTOR_COMPLETED: Job {job_id}, run_id {run.id}, duration {duration}s")
            
            dataset_id = run.default_dataset_id
            if dataset_id:
                list_page = await self.client.dataset(dataset_id).list_items()
                items = list_page.items
                logger.info(f"[APIFY] DATASET_RETRIEVED: Job {job_id} found {len(items)} items.")
                
                # Normalize response for onboarding (similar to legacy /social/scrape)
                normalized_data = None
                platform_label = actor_id.split("~")[1] if "~" in actor_id else "unknown"
                
                if items and len(items) > 0:
                    normalized_data = items[0]
                else:
                    normalized_data = items
                    
                result_payload = {
                    "ok": True,
                    "data": normalized_data,
                    "platform": platform_label
                }
                await self._update_job_status(db, job_id, "completed", result_data=result_payload)
            else:
                logger.error(f"[APIFY] DATASET_UNAVAILABLE: Job {job_id} missing defaultDatasetId")
                await self._update_job_status(db, job_id, "failed", "Dataset unavailable")
                
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.error(f"[APIFY] SCRAPER_FAILED: Job {job_id} failed after {duration}s. Error: {str(e)}")
            await self._update_job_status(db, job_id, "failed", f"Actor failed: {str(e)}")

    async def _update_job_status(self, db, job_id: str, status: str, error_message: str = None, result_data: dict = None):
        update = {
            "status": status,
            "updated_at": self._get_now_iso()
        }
        if error_message is not None:
            update["error_message"] = error_message
        if result_data is not None:
            update["result_data"] = result_data
            
        await db.scraper_jobs.update_one(
            {"id": job_id},
            {"$set": update}
        )

# Create singleton instance
apify_service = ApifyService()
