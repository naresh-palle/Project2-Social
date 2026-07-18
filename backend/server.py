from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import json
import asyncio
import logging
import mimetypes
from pathlib import Path as PathLib
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Any

import bcrypt
import jwt
import httpx
import aiofiles
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 7
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
EMERGENT_EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "CR8 Studio")
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
UPLOAD_DIR = PathLib(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CR8 API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cr8")

# in-memory pub/sub queues for SSE, keyed by conversation_id
_sse_channels: Dict[str, List[asyncio.Queue]] = {}

async def sse_publish(conversation_id: str, event: dict):
    for q in list(_sse_channels.get(conversation_id, [])):
        try:
            q.put_nowait(event)
        except Exception:
            pass


# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def send_email(to: str, subject: str, html: str) -> None:
    """Fire-and-forget email via Emergent-managed Resend proxy. Failures are logged, never raised."""
    if not EMERGENT_EMAIL_KEY:
        logger.info("Skipping email (no key): %s -> %s", subject, to)
        return
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMERGENT_EMAIL_KEY},
                json={"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
            if r.status_code >= 400:
                logger.warning("Email send failed %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Email exception: %s", e)


def email_template(headline: str, body_html: str, cta_url: Optional[str] = None, cta_label: Optional[str] = None) -> str:
    cta = ""
    if cta_url and cta_label:
        cta = (
            f'<p style="margin:32px 0"><a href="{cta_url}" '
            f'style="display:inline-block;padding:14px 22px;background:#FF3B30;color:#F4F4F0;'
            f'text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:11px;'
            f'letter-spacing:0.24em;text-transform:uppercase">{cta_label}</a></p>'
        )
    return (
        '<div style="background:#0A0A0A;padding:48px 24px;font-family:Georgia,serif;color:#F4F4F0">'
        '<table style="max-width:560px;margin:0 auto" cellpadding="0" cellspacing="0" width="560">'
        '<tr><td>'
        '<p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.3em;'
        'text-transform:uppercase;color:#F4F4F0;opacity:0.6;margin:0 0 16px">§ CR8 STUDIO</p>'
        f'<h1 style="font-family:Georgia,serif;font-size:42px;line-height:1.05;margin:0 0 12px;'
        f'font-weight:400;letter-spacing:-0.02em;color:#F4F4F0">{headline}</h1>'
        f'<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;'
        f'color:#F4F4F0;opacity:0.9">{body_html}</div>'
        f'{cta}'
        '<p style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.24em;'
        'text-transform:uppercase;color:#F4F4F0;opacity:0.4;margin-top:48px">— CR8 Editorial</p>'
        '</td></tr></table></div>'
    )


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def clean(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_role(current: dict, roles: list) -> dict:
    if current.get("role") not in roles:
        raise HTTPException(status_code=403, detail=f"Requires role: {','.join(roles)}")
    return current


# ---------- Models ----------
UserRole = Literal["owner", "influencer", "admin"]


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    role: UserRole
    handle: Optional[str] = None
    company: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    handle: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    niches: Optional[List[str]] = None
    followers: Optional[int] = None
    platforms: Optional[List[str]] = None
    location: Optional[str] = None
    portfolio: Optional[List[str]] = None
    rate_card: Optional[Dict[str, int]] = None


class CampaignCreate(BaseModel):
    title: str
    brand: str
    description: str
    budget: int
    niches: List[str] = []
    platforms: List[str] = []
    deliverables: str
    deadline: Optional[str] = None
    cover: Optional[str] = None


class ApplicationCreate(BaseModel):
    pitch: str
    rate: int


class InvitationCreate(BaseModel):
    creator_id: str
    campaign_id: str
    offer: int
    message: str


class InvitationAction(BaseModel):
    counter_offer: Optional[int] = None
    note: Optional[str] = None


class MessageCreate(BaseModel):
    content: str


class DeliverableCreate(BaseModel):
    campaign_id: str
    kind: Literal["reel", "story", "post", "video", "other"] = "post"
    url: str
    caption: Optional[str] = None


class DeliverableReview(BaseModel):
    status: Literal["approved", "revision", "rejected"]
    notes: Optional[str] = None


class ReviewCreate(BaseModel):
    target_id: str  # user id being reviewed
    campaign_id: str
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = None


class WalletTx(BaseModel):
    amount: int
    note: Optional[str] = None


class AIBuilderInput(BaseModel):
    goal: str


class AIMatchInput(BaseModel):
    campaign_id: str
    creator_id: str


# ---------- Auth Endpoints ----------
@api_router.post("/auth/register")
async def register(inp: RegisterInput):
    email = inp.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if inp.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot self-register as admin")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id, "email": email, "password_hash": hash_password(inp.password),
        "name": inp.name, "role": inp.role, "handle": inp.handle, "company": inp.company,
        "bio": None, "avatar": None, "niches": [], "followers": None, "platforms": [],
        "location": None, "industry": None, "website": None,
        "portfolio": [], "rate_card": {}, "verified": False, "wallet": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, inp.role)
    return {"token": token, "user": clean(dict(doc))}


@api_router.post("/auth/login")
async def login(inp: LoginInput):
    email = inp.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": clean(dict(user))}


@api_router.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return current


@api_router.patch("/auth/me")
async def update_me(patch: UserUpdate, current: dict = Depends(get_current_user)):
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if update:
        await db.users.update_one({"id": current["id"]}, {"$set": update})
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return user


# ---------- Creators ----------
@api_router.get("/creators")
async def list_creators(niche: Optional[str] = None, platform: Optional[str] = None,
                        q: Optional[str] = None, limit: int = Query(default=60, le=100)):
    filt: Dict[str, Any] = {"role": "influencer"}
    if niche:
        filt["niches"] = niche
    if platform:
        filt["platforms"] = platform
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"handle": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.users.find(filt, {"_id": 0, "password_hash": 0}).limit(limit)
    return await cursor.to_list(length=limit)


@api_router.get("/creators/{creator_id}")
async def get_creator(creator_id: str):
    creator = await db.users.find_one({"id": creator_id, "role": "influencer"},
                                      {"_id": 0, "password_hash": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    # avg rating
    revs = await db.reviews.find({"target_id": creator_id}, {"_id": 0}).to_list(length=200)
    if revs:
        creator["rating"] = round(sum(r["rating"] for r in revs) / len(revs), 1)
        creator["reviews_count"] = len(revs)
    else:
        creator["rating"] = None
        creator["reviews_count"] = 0
    return creator


# ---------- Campaigns ----------
@api_router.post("/campaigns")
async def create_campaign(inp: CampaignCreate, current: dict = Depends(get_current_user)):
    await require_role(current, ["owner"])
    cid = str(uuid.uuid4())
    doc = {
        "id": cid, "owner_id": current["id"], "title": inp.title, "brand": inp.brand,
        "description": inp.description, "budget": inp.budget, "niches": inp.niches,
        "platforms": inp.platforms, "deliverables": inp.deliverables, "deadline": inp.deadline,
        "cover": inp.cover, "status": "open", "escrow_funded": 0, "escrow_released": 0,
        "accepted_creator_id": None, "created_at": now_iso(), "applications_count": 0,
    }
    await db.campaigns.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/campaigns")
async def list_campaigns(niche: Optional[str] = None, platform: Optional[str] = None,
                         q: Optional[str] = None, mine: bool = False, request: Request = None):
    filt: Dict[str, Any] = {}
    if niche:
        filt["niches"] = niche
    if platform:
        filt["platforms"] = platform
    if q:
        filt["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                       {"brand": {"$regex": q, "$options": "i"}},
                       {"description": {"$regex": q, "$options": "i"}}]
    if mine:
        current = await get_current_user(request)
        filt["owner_id"] = current["id"]
    cursor = db.campaigns.find(filt, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(length=100)


@api_router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return camp


# ---------- Applications ----------
@api_router.post("/campaigns/{campaign_id}/apply")
async def apply(campaign_id: str, inp: ApplicationCreate, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    if not await db.campaigns.find_one({"id": campaign_id}):
        raise HTTPException(status_code=404, detail="Campaign not found")
    if await db.applications.find_one({"campaign_id": campaign_id, "influencer_id": current["id"]}):
        raise HTTPException(status_code=400, detail="Already applied")
    doc = {
        "id": str(uuid.uuid4()), "campaign_id": campaign_id, "influencer_id": current["id"],
        "influencer_name": current["name"], "influencer_handle": current.get("handle"),
        "influencer_avatar": current.get("avatar"), "pitch": inp.pitch, "rate": inp.rate,
        "status": "pending", "created_at": now_iso(),
    }
    await db.applications.insert_one(doc)
    await db.campaigns.update_one({"id": campaign_id}, {"$inc": {"applications_count": 1}})
    # Notify owner
    camp = await db.campaigns.find_one({"id": campaign_id})
    if camp:
        owner = await db.users.find_one({"id": camp["owner_id"]}, {"email": 1, "name": 1})
        if owner and owner.get("email"):
            asyncio.create_task(send_email(
                owner["email"],
                f"New pitch on {camp['title']}",
                email_template(
                    "A new pitch has landed.",
                    f"<p><em>{current['name']}</em> ({current.get('handle','')}) has pitched <strong>{camp['title']}</strong>.</p>"
                    f'<p style="font-style:italic;opacity:0.8;border-left:2px solid #FF3B30;padding-left:14px">"{inp.pitch}"</p>'
                    f"<p><strong>Rate:</strong> ${inp.rate}</p>",
                    cta_label="Review pitch",
                ),
            ))
    doc.pop("_id", None)
    return doc


@api_router.get("/campaigns/{campaign_id}/applications")
async def list_apps(campaign_id: str, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if camp["owner_id"] != current["id"] and current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return await db.applications.find({"campaign_id": campaign_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.get("/applications/mine")
async def my_apps(current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    apps = await db.applications.find({"influencer_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for a in apps:
        camp = await db.campaigns.find_one({"id": a["campaign_id"]}, {"_id": 0, "title": 1, "brand": 1})
        a["campaign_title"] = camp.get("title") if camp else None
        a["campaign_brand"] = camp.get("brand") if camp else None
    return apps


@api_router.post("/applications/{application_id}/accept")
async def accept_application(application_id: str, current: dict = Depends(get_current_user)):
    app_doc = await db.applications.find_one({"id": application_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    camp = await db.campaigns.find_one({"id": app_doc["campaign_id"]})
    if not camp or camp["owner_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.applications.update_one({"id": application_id}, {"$set": {"status": "accepted"}})
    await db.applications.update_many(
        {"campaign_id": camp["id"], "id": {"$ne": application_id}, "status": "pending"},
        {"$set": {"status": "declined"}},
    )
    await db.campaigns.update_one(
        {"id": camp["id"]},
        {"$set": {"status": "in_progress", "accepted_creator_id": app_doc["influencer_id"]}},
    )
    # Notify creator
    creator = await db.users.find_one({"id": app_doc["influencer_id"]}, {"email": 1, "name": 1})
    if creator and creator.get("email"):
        asyncio.create_task(send_email(
            creator["email"],
            f"You're in — {camp['title']}",
            email_template(
                "You've been chosen.",
                f"<p>{camp['brand']} accepted your pitch for <strong>{camp['title']}</strong>.</p>"
                f"<p>Head over to the studio to open a conversation and get started.</p>",
                cta_label="Open the brief",
            ),
        ))
    return {"ok": True}


# ---------- Invitations ----------
@api_router.post("/invitations")
async def create_invitation(inp: InvitationCreate, current: dict = Depends(get_current_user)):
    await require_role(current, ["owner"])
    camp = await db.campaigns.find_one({"id": inp.campaign_id})
    if not camp or camp["owner_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Not your campaign")
    if not await db.users.find_one({"id": inp.creator_id, "role": "influencer"}):
        raise HTTPException(status_code=404, detail="Creator not found")
    if await db.invitations.find_one({"campaign_id": inp.campaign_id, "creator_id": inp.creator_id}):
        raise HTTPException(status_code=400, detail="Already invited")
    doc = {
        "id": str(uuid.uuid4()), "campaign_id": inp.campaign_id, "creator_id": inp.creator_id,
        "owner_id": current["id"], "offer": inp.offer, "message": inp.message,
        "status": "pending", "counter_offer": None, "note": None, "created_at": now_iso(),
    }
    await db.invitations.insert_one(doc)
    # Notify creator
    creator = await db.users.find_one({"id": inp.creator_id}, {"email": 1, "name": 1})
    if creator and creator.get("email"):
        asyncio.create_task(send_email(
            creator["email"],
            f"You've been invited — {camp['title']}",
            email_template(
                "An invitation, extended.",
                f"<p>{camp['brand']} would like you on <strong>{camp['title']}</strong>.</p>"
                f'<p style="font-style:italic;opacity:0.8;border-left:2px solid #FF3B30;padding-left:14px">"{inp.message}"</p>'
                f"<p><strong>Offer:</strong> ${inp.offer}</p>",
                cta_label="Review invitation",
            ),
        ))
    doc.pop("_id", None)
    return doc


@api_router.get("/invitations/mine")
async def my_invitations(current: dict = Depends(get_current_user)):
    if current["role"] == "influencer":
        invs = await db.invitations.find({"creator_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    elif current["role"] == "owner":
        invs = await db.invitations.find({"owner_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        invs = []
    # enrich
    for i in invs:
        camp = await db.campaigns.find_one({"id": i["campaign_id"]}, {"_id": 0, "title": 1, "brand": 1})
        if camp:
            i["campaign_title"] = camp["title"]
            i["campaign_brand"] = camp["brand"]
        creator = await db.users.find_one({"id": i["creator_id"]}, {"_id": 0, "name": 1, "handle": 1, "avatar": 1})
        if creator:
            i["creator_name"] = creator["name"]
            i["creator_handle"] = creator.get("handle")
            i["creator_avatar"] = creator.get("avatar")
    return invs


@api_router.post("/invitations/{invitation_id}/action/{action}")
async def act_on_invitation(invitation_id: str, action: str, inp: InvitationAction,
                            current: dict = Depends(get_current_user)):
    inv = await db.invitations.find_one({"id": invitation_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv["creator_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if action not in {"accept", "reject", "counter"}:
        raise HTTPException(status_code=400, detail="Invalid action")
    update: Dict[str, Any] = {"status": action + ("ed" if action != "counter" else "ed")}
    if action == "counter":
        if inp.counter_offer is None:
            raise HTTPException(status_code=400, detail="counter_offer required")
        update["counter_offer"] = inp.counter_offer
        update["note"] = inp.note
    await db.invitations.update_one({"id": invitation_id}, {"$set": update})
    # Notify owner of the response
    owner = await db.users.find_one({"id": inv["owner_id"]}, {"email": 1, "name": 1})
    camp = await db.campaigns.find_one({"id": inv["campaign_id"]}, {"title": 1, "brand": 1})
    if owner and owner.get("email") and camp:
        headline = {"accept": "Invitation accepted.", "reject": "Invitation declined.", "counter": "A counter offer, extended."}[action]
        body = f"<p><strong>{current['name']}</strong> {action}ed your invitation to <strong>{camp['title']}</strong>.</p>"
        if action == "counter":
            body += f"<p><strong>Counter offer:</strong> ${inp.counter_offer}</p>"
            if inp.note:
                body += f'<p style="font-style:italic;opacity:0.8;border-left:2px solid #FF3B30;padding-left:14px">"{inp.note}"</p>'
        asyncio.create_task(send_email(owner["email"], f"{camp['title']} — {action}", email_template(headline, body, cta_label="Open the studio")))
    return {"ok": True}


# ---------- Messaging ----------
async def ensure_conversation(campaign_id: str, owner_id: str, creator_id: str) -> str:
    convo = await db.conversations.find_one({"campaign_id": campaign_id, "owner_id": owner_id, "creator_id": creator_id})
    if convo:
        return convo["id"]
    cid = str(uuid.uuid4())
    await db.conversations.insert_one({
        "id": cid, "campaign_id": campaign_id, "owner_id": owner_id, "creator_id": creator_id,
        "created_at": now_iso(), "last_at": now_iso(),
    })
    return cid


@api_router.post("/conversations/open")
async def open_conversation(campaign_id: str, creator_id: str, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    # owner opening or the invited/applied creator
    if current["role"] == "owner":
        if camp["owner_id"] != current["id"]:
            raise HTTPException(status_code=403, detail="Not your campaign")
        cid = await ensure_conversation(campaign_id, current["id"], creator_id)
    elif current["role"] == "influencer":
        if current["id"] != creator_id:
            raise HTTPException(status_code=403, detail="Only your conversations")
        cid = await ensure_conversation(campaign_id, camp["owner_id"], current["id"])
    else:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"id": cid}


@api_router.get("/conversations")
async def list_conversations(current: dict = Depends(get_current_user)):
    if current["role"] == "owner":
        q = {"owner_id": current["id"]}
    elif current["role"] == "influencer":
        q = {"creator_id": current["id"]}
    else:
        q = {}
    convos = await db.conversations.find(q, {"_id": 0}).sort("last_at", -1).to_list(200)
    for c in convos:
        camp = await db.campaigns.find_one({"id": c["campaign_id"]}, {"_id": 0, "title": 1, "brand": 1})
        if camp:
            c["campaign_title"] = camp["title"]
            c["campaign_brand"] = camp["brand"]
        other_id = c["creator_id"] if current["role"] == "owner" else c["owner_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "handle": 1, "avatar": 1, "company": 1})
        if other:
            c["other_name"] = other.get("name")
            c["other_handle"] = other.get("handle") or other.get("company")
            c["other_avatar"] = other.get("avatar")
        last = await db.messages.find({"conversation_id": c["id"]}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        c["last_message"] = last[0]["content"] if last else None
    return convos


@api_router.get("/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: str, current: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current["id"] not in (convo["owner_id"], convo["creator_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, inp: MessageCreate, current: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current["id"] not in (convo["owner_id"], convo["creator_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = {
        "id": str(uuid.uuid4()), "conversation_id": conversation_id, "sender_id": current["id"],
        "sender_name": current["name"], "sender_role": current["role"],
        "content": inp.content, "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_at": now_iso()}})
    doc.pop("_id", None)
    await sse_publish(conversation_id, {"type": "message", "data": doc})
    return doc


@api_router.get("/conversations/{conversation_id}/stream")
async def stream_conversation(conversation_id: str, request: Request, token: Optional[str] = None):
    # Allow query-string token because EventSource can't send Authorization headers.
    if token:
        request = Request(scope={**request.scope, "headers": [(b"authorization", f"Bearer {token}".encode())]})
    current = await get_current_user(request)
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current["id"] not in (convo["owner_id"], convo["creator_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    queue: asyncio.Queue = asyncio.Queue()
    _sse_channels.setdefault(conversation_id, []).append(queue)

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25)
                    yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # keep-alive
        finally:
            try:
                _sse_channels.get(conversation_id, []).remove(queue)
            except ValueError:
                pass

    return StreamingResponse(gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    })


# ---------- Deliverables ----------
@api_router.post("/deliverables")
async def submit_deliverable(inp: DeliverableCreate, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    camp = await db.campaigns.find_one({"id": inp.campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if camp.get("accepted_creator_id") != current["id"]:
        raise HTTPException(status_code=403, detail="You are not the accepted creator")
    doc = {
        "id": str(uuid.uuid4()), "campaign_id": inp.campaign_id, "creator_id": current["id"],
        "creator_name": current["name"], "kind": inp.kind, "url": inp.url, "caption": inp.caption,
        "status": "pending", "notes": None, "revisions": 0, "created_at": now_iso(),
    }
    await db.deliverables.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/campaigns/{campaign_id}/deliverables")
async def list_deliverables(campaign_id: str, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    allowed = (camp["owner_id"] == current["id"] or camp.get("accepted_creator_id") == current["id"]
               or current["role"] == "admin")
    if not allowed:
        raise HTTPException(status_code=403, detail="Forbidden")
    return await db.deliverables.find({"campaign_id": campaign_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/deliverables/{deliverable_id}/review")
async def review_deliverable(deliverable_id: str, inp: DeliverableReview,
                             current: dict = Depends(get_current_user)):
    d = await db.deliverables.find_one({"id": deliverable_id})
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    camp = await db.campaigns.find_one({"id": d["campaign_id"]})
    if not camp or camp["owner_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    update = {"status": inp.status, "notes": inp.notes}
    if inp.status == "revision":
        update["revisions"] = d.get("revisions", 0) + 1
    await db.deliverables.update_one({"id": deliverable_id}, {"$set": update})
    if inp.status == "approved":
        # mark campaign complete if all pending deliverables approved
        pending = await db.deliverables.count_documents({"campaign_id": camp["id"], "status": {"$in": ["pending", "revision"]}})
        if pending == 0:
            await db.campaigns.update_one({"id": camp["id"]}, {"$set": {"status": "completed"}})
    return {"ok": True}


# ---------- Reviews ----------
@api_router.post("/reviews")
async def create_review(inp: ReviewCreate, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": inp.campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if current["id"] not in (camp["owner_id"], camp.get("accepted_creator_id")):
        raise HTTPException(status_code=403, detail="Only campaign parties may review")
    doc = {
        "id": str(uuid.uuid4()), "author_id": current["id"], "author_name": current["name"],
        "author_role": current["role"], "target_id": inp.target_id,
        "campaign_id": inp.campaign_id, "rating": inp.rating, "text": inp.text,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/reviews")
async def list_reviews(target_id: str):
    return await db.reviews.find({"target_id": target_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ---------- Wallet (mocked) ----------
@api_router.get("/wallet")
async def get_wallet(current: dict = Depends(get_current_user)):
    txs = await db.wallet_tx.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"balance": current.get("wallet", 0), "transactions": txs}


async def add_tx(user_id: str, kind: str, amount: int, note: str):
    await db.wallet_tx.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "kind": kind, "amount": amount,
        "note": note, "created_at": now_iso(),
    })


@api_router.post("/wallet/deposit")
async def deposit(inp: WalletTx, current: dict = Depends(get_current_user)):
    await require_role(current, ["owner"])
    await db.users.update_one({"id": current["id"]}, {"$inc": {"wallet": inp.amount}})
    await add_tx(current["id"], "deposit", inp.amount, inp.note or "Deposit (mock)")
    u = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return {"balance": u["wallet"]}


@api_router.post("/wallet/withdraw")
async def withdraw(inp: WalletTx, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    if current.get("wallet", 0) < inp.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    await db.users.update_one({"id": current["id"]}, {"$inc": {"wallet": -inp.amount}})
    await add_tx(current["id"], "withdraw", -inp.amount, inp.note or "Withdrawal (mock)")
    u = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return {"balance": u["wallet"]}


@api_router.post("/campaigns/{campaign_id}/fund")
async def fund_escrow(campaign_id: str, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id})
    if not camp or camp["owner_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if camp.get("escrow_funded", 0) >= camp["budget"]:
        raise HTTPException(status_code=400, detail="Already funded")
    if current.get("wallet", 0) < camp["budget"]:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    await db.users.update_one({"id": current["id"]}, {"$inc": {"wallet": -camp["budget"]}})
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"escrow_funded": camp["budget"]}})
    await add_tx(current["id"], "escrow_fund", -camp["budget"], f"Escrow · {camp['title']}")
    return {"ok": True, "funded": camp["budget"]}


@api_router.post("/campaigns/{campaign_id}/release")
async def release_escrow(campaign_id: str, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id})
    if not camp or camp["owner_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if camp.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Campaign not completed")
    if camp.get("escrow_released", 0) >= camp.get("escrow_funded", 0):
        raise HTTPException(status_code=400, detail="Already released")
    creator_id = camp.get("accepted_creator_id")
    if not creator_id:
        raise HTTPException(status_code=400, detail="No accepted creator")
    amt = camp["escrow_funded"]
    await db.users.update_one({"id": creator_id}, {"$inc": {"wallet": amt}})
    await db.campaigns.update_one({"id": campaign_id}, {"$set": {"escrow_released": amt}})
    await add_tx(creator_id, "payout", amt, f"Payout · {camp['title']}")
    return {"ok": True, "released": amt}


# ---------- Admin ----------
@api_router.get("/admin/users")
async def admin_users(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/campaigns")
async def admin_campaigns(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    return await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/users/{user_id}/verify")
async def admin_verify(user_id: str, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    await db.users.update_one({"id": user_id}, {"$set": {"verified": True}})
    return {"ok": True}


@api_router.delete("/admin/campaigns/{campaign_id}")
async def admin_delete_campaign(campaign_id: str, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    await db.campaigns.delete_one({"id": campaign_id})
    return {"ok": True}


# ---------- Stats ----------
@api_router.get("/stats")
async def stats():
    return {
        "creators": await db.users.count_documents({"role": "influencer"}),
        "owners": await db.users.count_documents({"role": "owner"}),
        "campaigns": await db.campaigns.count_documents({}),
    }


@api_router.get("/")
async def root():
    return {"name": "CR8 API", "status": "ok"}


# ---------- AI ----------
async def call_llm(system: str, prompt: str) -> str:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key missing")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(status_code=500, detail="LLM library missing")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


def parse_json(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for p in parts:
            p = p.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("{"):
                text = p
                break
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}


@api_router.post("/ai/campaign-builder")
async def ai_campaign_builder(inp: AIBuilderInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["owner", "admin"])
    system = (
        "You are the CR8 AI Brand Copilot — an editorial, high-taste creative director for a "
        "curated influencer studio. You draft brand briefs in a restrained, editorial voice. "
        "Always return VALID JSON matching the schema requested, and nothing else."
    )
    prompt = (
        f"Draft a campaign brief for: \"{inp.goal}\".\n"
        "Return ONLY JSON with these exact keys:\n"
        "{\"title\": string (max 8 words, editorial),"
        " \"description\": string (2-3 sentences, editorial tone),"
        " \"deliverables\": string (a concise list separated by ' + '),"
        " \"budget\": integer (USD, whole number),"
        " \"niches\": string[] (2-4 from: fashion, luxury, beauty, tech, design, wellness),"
        " \"platforms\": string[] (2-3 from: instagram, tiktok, youtube, twitter)}"
    )
    text = await call_llm(system, prompt)
    data = parse_json(text)
    return data


@api_router.post("/ai/match-score")
async def ai_match_score(inp: AIMatchInput, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": inp.campaign_id}, {"_id": 0})
    creator = await db.users.find_one({"id": inp.creator_id, "role": "influencer"}, {"_id": 0, "password_hash": 0})
    if not camp or not creator:
        raise HTTPException(status_code=404, detail="Campaign or creator not found")
    system = (
        "You are the CR8 AI Match Engine. You evaluate the fit between a brand's campaign brief "
        "and a creator's profile. You are candid, concise, and editorial. Always return VALID JSON."
    )
    prompt = (
        "CAMPAIGN:\n"
        f"- Brand: {camp['brand']}\n- Title: {camp['title']}\n- Description: {camp['description']}\n"
        f"- Budget: ${camp['budget']}\n- Niches: {camp.get('niches')}\n- Platforms: {camp.get('platforms')}\n"
        f"- Deliverables: {camp.get('deliverables')}\n\n"
        "CREATOR:\n"
        f"- Name: {creator['name']} ({creator.get('handle')})\n- Bio: {creator.get('bio')}\n"
        f"- Niches: {creator.get('niches')}\n- Platforms: {creator.get('platforms')}\n"
        f"- Followers: {creator.get('followers')}\n- Location: {creator.get('location')}\n\n"
        "Return ONLY JSON:\n"
        "{\"score\": integer 0-100,"
        " \"verdict\": string (one line, editorial),"
        " \"strengths\": string[] (2-3 short bullets),"
        " \"risks\": string[] (1-2 short bullets),"
        " \"estimated_reach\": string (e.g. '250K')}"
    )
    text = await call_llm(system, prompt)
    return parse_json(text)



# ---------- Uploads ----------
ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB


@api_router.post("/uploads")
async def upload_file(file: UploadFile = File(...), current: dict = Depends(get_current_user)):
    if file.content_type not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail="Only jpeg/png/webp/gif allowed")
    ext = mimetypes.guess_extension(file.content_type) or ".bin"
    fid = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / fid
    size = 0
    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 64):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                await f.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large (max 8MB)")
            await f.write(chunk)
    return {"id": fid, "url": f"/api/uploads/{fid}"}


@api_router.get("/uploads/{file_id}")
async def get_upload(file_id: str):
    safe = PathLib(file_id).name  # prevent traversal
    p = UPLOAD_DIR / safe
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(p, media_type=mimetypes.guess_type(str(p))[0] or "application/octet-stream")


# ---------- Analytics ----------
@api_router.get("/analytics/owner")
async def analytics_owner(current: dict = Depends(get_current_user)):
    await require_role(current, ["owner"])
    total_campaigns = await db.campaigns.count_documents({"owner_id": current["id"]})
    open_campaigns = await db.campaigns.count_documents({"owner_id": current["id"], "status": "open"})
    in_progress = await db.campaigns.count_documents({"owner_id": current["id"], "status": "in_progress"})
    completed = await db.campaigns.count_documents({"owner_id": current["id"], "status": "completed"})
    my_camps = await db.campaigns.find({"owner_id": current["id"]}, {"_id": 0, "id": 1, "budget": 1,
                                                                     "escrow_funded": 1, "escrow_released": 1,
                                                                     "applications_count": 1}).to_list(500)
    ids = [c["id"] for c in my_camps]
    apps_total = await db.applications.count_documents({"campaign_id": {"$in": ids}}) if ids else 0
    escrow_held = sum((c.get("escrow_funded") or 0) - (c.get("escrow_released") or 0) for c in my_camps)
    paid = sum(c.get("escrow_released") or 0 for c in my_camps)
    total_budget = sum(c.get("budget") or 0 for c in my_camps)
    unread_convos = await db.conversations.count_documents({"owner_id": current["id"]})
    return {
        "total_campaigns": total_campaigns,
        "open_campaigns": open_campaigns,
        "in_progress": in_progress,
        "completed": completed,
        "applications_total": apps_total,
        "escrow_held": escrow_held,
        "paid_to_creators": paid,
        "total_budget": total_budget,
        "conversations": unread_convos,
    }


@api_router.get("/analytics/creator")
async def analytics_creator(current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    applied = await db.applications.count_documents({"influencer_id": current["id"]})
    accepted = await db.applications.count_documents({"influencer_id": current["id"], "status": "accepted"})
    invited = await db.invitations.count_documents({"creator_id": current["id"]})
    delivs = await db.deliverables.count_documents({"creator_id": current["id"]})
    approved = await db.deliverables.count_documents({"creator_id": current["id"], "status": "approved"})
    my_apps = await db.applications.find({"influencer_id": current["id"], "status": "accepted"},
                                         {"_id": 0, "rate": 1}).to_list(200)
    reviews = await db.reviews.find({"target_id": current["id"]}, {"_id": 0, "rating": 1}).to_list(500)
    avg_rating = (sum(r["rating"] for r in reviews) / len(reviews)) if reviews else 0
    earned = current.get("wallet", 0)
    contracted = sum(a.get("rate") or 0 for a in my_apps)
    return {
        "applications": applied,
        "acceptances": accepted,
        "invitations": invited,
        "deliverables": delivs,
        "approved": approved,
        "avg_rating": round(avg_rating, 1),
        "reviews_count": len(reviews),
        "earned": earned,
        "contracted": contracted,
    }


# ---------- Top-N AI Match ----------
async def _score_one(camp: dict, creator: dict) -> Optional[dict]:
    system = ("You are the CR8 AI Match Engine — candid, editorial, concise. "
              "Always return VALID JSON with keys: score (0-100), verdict (one line), "
              "estimated_reach (string).")
    prompt = (
        f"CAMPAIGN: {camp.get('brand')} — {camp.get('title')}. Niches: {camp.get('niches')}. "
        f"Platforms: {camp.get('platforms')}. Budget: ${camp.get('budget')}.\n"
        f"CREATOR: {creator.get('name')} ({creator.get('handle')}). "
        f"Niches: {creator.get('niches')}. Platforms: {creator.get('platforms')}. "
        f"Followers: {creator.get('followers')}. Bio: {creator.get('bio')}\n"
        'Return ONLY JSON: {"score": int, "verdict": string, "estimated_reach": string}'
    )
    try:
        text = await call_llm(system, prompt)
        d = parse_json(text)
        if isinstance(d, dict) and isinstance(d.get("score"), int):
            return d
    except Exception as e:
        logger.warning("match score failure for %s: %s", creator.get("id"), e)
    return None


@api_router.get("/campaigns/{campaign_id}/top-matches")
async def top_matches(campaign_id: str, limit: int = 5, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    # Only the owner or an admin can request AI ranking
    if camp["owner_id"] != current["id"] and current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    # Pre-filter creators by any niche/platform overlap; fall back to a broader pool if none.
    niches = camp.get("niches") or []
    platforms = camp.get("platforms") or []
    filt: Dict[str, Any] = {"role": "influencer"}
    if niches:
        filt["niches"] = {"$in": niches}
    creators = await db.users.find(filt, {"_id": 0, "password_hash": 0}).limit(20).to_list(20)
    if len(creators) < 3:  # broaden
        creators = await db.users.find({"role": "influencer"}, {"_id": 0, "password_hash": 0}).limit(20).to_list(20)

    # Score in parallel (cap at 12 to control latency/cost)
    creators = creators[:12]
    tasks = [_score_one(camp, c) for c in creators]
    scores = await asyncio.gather(*tasks, return_exceptions=False)
    results = []
    for c, s in zip(creators, scores):
        if not s:
            continue
        results.append({
            "id": c["id"], "name": c["name"], "handle": c.get("handle"),
            "avatar": c.get("avatar"), "followers": c.get("followers"),
            "niches": c.get("niches", []), "platforms": c.get("platforms", []),
            "score": s.get("score"), "verdict": s.get("verdict"),
            "estimated_reach": s.get("estimated_reach"),
        })
    results.sort(key=lambda r: r.get("score") or 0, reverse=True)
    return results[:limit]



# ---------- Startup ----------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@cr8.studio").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email,
            "password_hash": hash_password(admin_password), "name": "CR8 Admin",
            "role": "admin", "handle": None, "company": None, "bio": None,
            "avatar": None, "niches": [], "followers": None, "platforms": [],
            "location": None, "industry": None, "website": None,
            "portfolio": [], "rate_card": {}, "verified": True, "wallet": 0,
            "created_at": now_iso(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})


async def seed_demo():
    if await db.users.count_documents({"role": "influencer"}) > 0:
        return
    demos = [
        {"email": "lena@cr8.studio", "name": "Lena Ivory", "handle": "@lena.ivory",
         "bio": "Editorial fashion + luxury lifestyle creator.",
         "avatar": "https://images.pexels.com/photos/11264890/pexels-photo-11264890.jpeg",
         "niches": ["fashion", "luxury", "beauty"], "platforms": ["instagram", "tiktok"],
         "followers": 214000, "location": "Milan, IT",
         "portfolio": ["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd",
                       "https://images.pexels.com/photos/35458193/pexels-photo-35458193.jpeg"],
         "rate_card": {"reel": 2500, "story": 400, "post": 1800}},
        {"email": "kai@cr8.studio", "name": "Kai Monroe", "handle": "@kai.monroe",
         "bio": "Minimalist tech + design storytelling.",
         "avatar": "https://images.unsplash.com/photo-1700748910941-44f7577b0ba2",
         "niches": ["tech", "design"], "platforms": ["youtube", "instagram"],
         "followers": 512000, "location": "Berlin, DE",
         "portfolio": ["https://images.unsplash.com/photo-1739950839930-ef45c078f316"],
         "rate_card": {"video": 6500, "post": 2400}},
        {"email": "nova@cr8.studio", "name": "Nova Reyes", "handle": "@nova.reyes",
         "bio": "Beauty rituals & fragrance director.",
         "avatar": "https://images.unsplash.com/photo-1700748909753-3d4f58eb8273",
         "niches": ["beauty", "wellness"], "platforms": ["instagram", "tiktok"],
         "followers": 128000, "location": "New York, US",
         "portfolio": ["https://images.unsplash.com/photo-1655657874630-2da5679ef515"],
         "rate_card": {"reel": 1800, "story": 300}},
    ]
    for c in demos:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": c["email"],
            "password_hash": hash_password("demo1234"), "name": c["name"],
            "role": "influencer", "handle": c["handle"], "company": None, "bio": c["bio"],
            "avatar": c["avatar"], "niches": c["niches"], "followers": c["followers"],
            "platforms": c["platforms"], "location": c["location"],
            "industry": None, "website": None,
            "portfolio": c["portfolio"], "rate_card": c["rate_card"],
            "verified": True, "wallet": 0, "created_at": now_iso(),
        })

    owner_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": owner_id, "email": "studio@cr8.studio",
        "password_hash": hash_password("demo1234"), "name": "Studio Noir",
        "role": "owner", "handle": None, "company": "Studio Noir",
        "bio": "House of quiet luxury.", "avatar": None, "niches": [], "followers": None,
        "platforms": [], "location": "Paris", "industry": "Fashion",
        "website": "https://studionoir.example", "portfolio": [], "rate_card": {},
        "verified": True, "wallet": 25000, "created_at": now_iso(),
    })
    await db.campaigns.insert_one({
        "id": str(uuid.uuid4()), "owner_id": owner_id,
        "title": "Fall Edit — Silhouettes", "brand": "Studio Noir",
        "description": "Long-form editorial content for our Fall silhouettes collection. Looking for creators with an editorial eye and a taste for restraint.",
        "budget": 8500, "niches": ["fashion", "luxury"], "platforms": ["instagram", "tiktok"],
        "deliverables": "1 Reel + 3 Stories + 1 grid post.", "deadline": None,
        "cover": "https://images.pexels.com/photos/11264890/pexels-photo-11264890.jpeg",
        "status": "open", "escrow_funded": 0, "escrow_released": 0,
        "accepted_creator_id": None,
        "created_at": now_iso(), "applications_count": 0,
    })


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.campaigns.create_index("id", unique=True)
    await db.applications.create_index("id", unique=True)
    await db.applications.create_index([("campaign_id", 1), ("influencer_id", 1)], unique=True)
    await db.invitations.create_index("id", unique=True)
    await db.invitations.create_index([("campaign_id", 1), ("creator_id", 1)], unique=True)
    await db.conversations.create_index("id", unique=True)
    await db.messages.create_index("id", unique=True)
    await db.messages.create_index("conversation_id")
    await db.deliverables.create_index("id", unique=True)
    await db.reviews.create_index("id", unique=True)
    await db.wallet_tx.create_index("id", unique=True)
    await seed_admin()
    await seed_demo()
    logger.info("CR8 API ready.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
