from dotenv import load_dotenv
from pathlib import Path
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
load_dotenv(ROOT_DIR.parent / 'frontend' / '.env')
load_dotenv(ROOT_DIR.parent / '.env')

import os
from cryptography.fernet import Fernet
import random
import uuid
import json
import asyncio
import logging
import mimetypes
import secrets
import re
import io
from pathlib import Path as PathLib
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Any

from otp_utils import parse_otp_datetime, otp_expired

import bcrypt
import jwt
import httpx
import aiofiles
try:
    import aiosmtplib
except ImportError:
    aiosmtplib = None
from email.message import EmailMessage
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator


# ---------- Setup ----------
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'cr8_social')]
# GridFS must not be built at import time: Motor calls get_event_loop() in
# AsyncIOMotorGridFSBucket.__init__, which raises on Python 3.14+ before uvicorn
# has started the loop. Lazily create once a loop exists (startup / first use).
upload_fs: Optional[AsyncIOMotorGridFSBucket] = None


def get_upload_fs() -> AsyncIOMotorGridFSBucket:
    global upload_fs
    if upload_fs is None:
        upload_fs = AsyncIOMotorGridFSBucket(db, bucket_name="file_uploads")
    return upload_fs

JWT_SECRET = os.environ.get('JWT_SECRET', 'cr8_super_secret_jwt_key_2026')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 7
EMERGENT_LLM_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")
EMERGENT_EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "CR8 Studio")
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
UPLOAD_DIR = PathLib(os.environ.get("UPLOAD_DIR", ROOT_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="CR8 API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cr8")

# in-memory pub/sub queues for SSE, keyed by conversation_id
_sse_channels: Dict[str, List[asyncio.Queue]] = {}


async def store_upload_bytes(fid: str, data: bytes, content_type: Optional[str] = None) -> None:
    """Persist upload to disk cache + Mongo GridFS (survives Render ephemeral disk)."""
    safe = PathLib(fid).name
    dest = UPLOAD_DIR / safe
    try:
        async with aiofiles.open(dest, "wb") as f:
            await f.write(data)
    except Exception as e:
        logger.warning("Disk write failed for %s: %s", safe, e)
    try:
        fs = get_upload_fs()
        cursor = fs.find({"filename": safe})
        async for doc in cursor:
            await fs.delete(doc["_id"])
        await fs.upload_from_stream(
            safe,
            io.BytesIO(data),
            metadata={"content_type": content_type or "application/octet-stream"},
        )
    except Exception as e:
        logger.warning("GridFS persist failed for %s: %s", safe, e)


async def load_upload_bytes(fid: str):
    """Load upload from disk, falling back to GridFS and warming the disk cache."""
    safe = PathLib(fid).name
    dest = UPLOAD_DIR / safe
    if dest.exists():
        try:
            async with aiofiles.open(dest, "rb") as f:
                data = await f.read()
            ct = mimetypes.guess_type(str(dest))[0] or "application/octet-stream"
            return data, ct
        except Exception as e:
            logger.warning("Disk read failed for %s: %s", safe, e)
    try:
        stream = await get_upload_fs().open_download_stream_by_name(safe)
        data = await stream.read()
        meta = stream.metadata or {}
        ct = meta.get("content_type") or mimetypes.guess_type(safe)[0] or "application/octet-stream"
        try:
            async with aiofiles.open(dest, "wb") as f:
                await f.write(data)
        except Exception:
            pass
        return data, ct
    except Exception:
        return None, None

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


async def write_audit_log(
    *,
    action: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    user: Optional[str] = None,
    details: str = "",
    status: str = "Completed",
    meta: Optional[Dict[str, Any]] = None,
) -> None:
    """Append a live audit trail entry for Admin Console → Audit Logs."""
    try:
        uname = (username or "").strip().lstrip("@").rstrip(".,")
        display = user
        if not display and uname:
            display = uname
        elif not display:
            display = "System"
        if isinstance(display, str):
            display = display.strip().lstrip("@").rstrip(".,") or display
        now = now_iso()
        doc = {
            "id": f"audit_{uuid.uuid4().hex[:10]}",
            "action": action,
            "type": action,
            "user_id": user_id,
            "username": uname,
            "user": display,
            "details": details,
            "status": status,
            "time": now,
            "created_at": now,
            "meta": meta or {},
        }
        await db.audit_logs.insert_one(doc)
    except Exception as e:
        logger.warning("Failed to write audit log (%s): %s", action, e)


ROLE_AUDIT_LABELS = {
    "influencer": "Creator",
    "owner": "Brand",
    "agent": "Agency",
    "admin": "Admin",
    "support": "Support Agent",
    "support_agent": "Support Agent",
    "support_lead": "Support Lead",
    "support_admin": "Support Admin",
}

_brevo_account_email: Optional[str] = None

async def get_brevo_verified_sender(api_key: str) -> str:
    """Resolve a Brevo-safe sender. Prefer explicit BREVO_SENDER_EMAIL, then Brevo account email.
    Do NOT use GMAIL_USER as Brevo sender — Gmail addresses are usually unverified in Brevo.
    """
    global _brevo_account_email
    if _brevo_account_email:
        return _brevo_account_email

    # Only use a sender that was explicitly configured for Brevo
    configured = (os.environ.get("BREVO_SENDER_EMAIL") or "").strip()
    if configured and "@" in configured:
        return configured

    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get("https://api.brevo.com/v3/account", headers={"api-key": api_key, "Accept": "application/json"})
            if r.status_code == 200:
                data = r.json()
                acc_email = data.get("email")
                if acc_email:
                    _brevo_account_email = acc_email
                    logger.info("Brevo account email auto-detected: %s", acc_email)
                    return acc_email
            else:
                logger.warning("Brevo account lookup status %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Brevo account info lookup failed: %s", e)

    # Last resort — Brevo free accounts can often send from their login email only
    return configured or "noreply@cr8.studio"


async def send_email(to: str, subject: str, html: str) -> bool:
    """Delivers email via Brevo → Resend → Gmail SMTP → Emergent.
    Returns True only when a provider confirms delivery; never silently succeeds.
    """
    errors = []

    # 1. Brevo (Sendinblue) HTTP API
    brevo_api_key = (os.environ.get("BREVO_API_KEY") or os.environ.get("SENDINBLUE_API_KEY") or "").strip()
    if brevo_api_key:
        try:
            sender_email = await get_brevo_verified_sender(brevo_api_key)
            sender_name = os.environ.get("EMAIL_FROM_NAME", "CR8 Studio")
            async with httpx.AsyncClient(timeout=12) as c:
                res = await c.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={
                        "api-key": brevo_api_key,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    json={
                        "sender": {"name": sender_name, "email": sender_email},
                        "to": [{"email": to}],
                        "subject": subject,
                        "htmlContent": html
                    }
                )
                if res.status_code in (200, 201):
                    logger.info("Email sent successfully via Brevo HTTP API (Sender: %s) to %s", sender_email, to)
                    return True
                err = f"Brevo {res.status_code}: {res.text[:300]}"
                errors.append(err)
                logger.warning("Brevo HTTP API error: %s", err)
        except Exception as e:
            errors.append(f"Brevo exception: {e}")
            logger.warning("Brevo HTTP API exception: %s", e)

    # 2. Resend HTTP API
    resend_api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if resend_api_key:
        try:
            from_email = os.environ.get("EMAIL_FROM", "CR8 Studio <onboarding@resend.dev>")
            async with httpx.AsyncClient(timeout=10) as c:
                res = await c.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": from_email,
                        "to": [to],
                        "subject": subject,
                        "html": html
                    }
                )
                if res.status_code in (200, 201):
                    logger.info("Email sent successfully via Resend HTTP API to %s", to)
                    return True
                err = f"Resend {res.status_code}: {res.text[:300]}"
                errors.append(err)
                logger.warning("Resend HTTP API error: %s", err)
        except Exception as e:
            errors.append(f"Resend exception: {e}")
            logger.warning("Resend HTTP API exception: %s", e)

    # 3. Gmail SMTP Fallback (often blocked on Render free tier)
    gmail_user = (os.environ.get("GMAIL_USER") or os.environ.get("EMAIL_USER") or "").strip()
    gmail_pass = (os.environ.get("GMAIL_APP_PASSWORD") or os.environ.get("EMAIL_PASS") or "").strip()
    if gmail_user and gmail_pass:
        gmail_pass_clean = gmail_pass.replace(" ", "").strip()
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            from_header = os.environ.get("EMAIL_FROM", f"CR8 Studio <{gmail_user}>")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_header
            msg["To"] = to
            msg.attach(MIMEText(html, "html"))

            def _send():
                try:
                    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as s:
                        s.login(gmail_user, gmail_pass_clean)
                        s.sendmail(gmail_user, [to], msg.as_string())
                except Exception as ssl_err:
                    logger.warning("Gmail SSL port 465 failed (%s). Retrying via TLS port 587...", ssl_err)
                    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as s:
                        s.starttls()
                        s.login(gmail_user, gmail_pass_clean)
                        s.sendmail(gmail_user, [to], msg.as_string())

            await asyncio.to_thread(_send)
            logger.info("Email sent via Gmail SMTP to %s", to)
            return True
        except Exception as e:
            errors.append(f"Gmail SMTP failed: {e}")
            logger.warning("Gmail SMTP delivery failed for %s: %s", to, e)

    if EMERGENT_EMAIL_KEY:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    f"{EMAIL_BASE_URL}/api/v1/email/send",
                    headers={"X-Email-Key": EMERGENT_EMAIL_KEY},
                    json={"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
                )
                if r.status_code < 400:
                    logger.info("Email sent via Emergent proxy to %s", to)
                    return True
                err = f"Emergent {r.status_code}: {r.text[:200]}"
                errors.append(err)
                logger.warning("Email send failed: %s", err)
        except Exception as e:
            errors.append(f"Emergent exception: {e}")
            logger.warning("Emergent email exception: %s", e)

    if not errors and not brevo_api_key and not gmail_user:
        logger.error("Email delivery failed: no BREVO_API_KEY / GMAIL credentials configured")
        return False

    logger.error("Email delivery failed for %s. Attempts: %s", to, " | ".join(errors) or "no providers")
    return False


async def send_email_or_raise(to: str, subject: str, html: str) -> None:
    ok = await send_email(to, subject, html)
    if not ok:
        raise HTTPException(
            status_code=502,
            detail=(
                "Could not deliver email OTP. Check Brevo: verify a sender email in Brevo dashboard "
                "and set BREVO_SENDER_EMAIL to that address. Gmail SMTP is often blocked on Render — "
                "prefer Brevo HTTP API."
            ),
        )


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
    c = dict(doc)
    c.pop("_id", None)
    c.pop("password_hash", None)
    return c


def normalize_mobile(raw: Optional[str]) -> str:
    """Normalize Indian mobile to 10 digits when possible."""
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) >= 10:
        # Prefer last 10 digits (handles 91XXXXXXXXXX / +91…)
        return digits[-10:]
    return digits


async def find_user_by_mobile(raw_mobile: Optional[str]) -> Optional[dict]:
    """Locate a user by mobile across legacy storage formats."""
    mobile = normalize_mobile(raw_mobile)
    if not mobile or len(mobile) != 10:
        return None

    user = await db.users.find_one({"$or": [
        {"mobile": mobile},
        {"mobile": f"+91{mobile}"},
        {"mobile": f"+91 {mobile}"},
        {"mobile": f"91{mobile}"},
        {"phone": mobile},
        {"phone": f"+91{mobile}"},
        {"phone": f"+91 {mobile}"},
    ]})
    if user:
        return user

    cursor = db.users.find({"$or": [
        {"mobile": {"$regex": f"{re.escape(mobile)}$"}},
        {"phone": {"$regex": f"{re.escape(mobile)}$"}},
    ]})
    async for row in cursor:
        digits = normalize_mobile(row.get("mobile") or row.get("phone"))
        if digits == mobile:
            return row
    return None


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

    sub = payload.get("sub")
    email = payload.get("email")

    user = None
    if sub:
        user = await db.users.find_one({"id": sub}, {"password_hash": 0})
        if not user and len(str(sub)) == 24:
            try:
                from bson import ObjectId
                user = await db.users.find_one({"_id": ObjectId(sub)}, {"password_hash": 0})
            except Exception:
                pass
    if not user and email:
        user = await db.users.find_one({"email": email.lower().strip()}, {"password_hash": 0})

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    user["id"] = user.get("id") or str(user.get("_id", ""))
    user.pop("_id", None)
    return user


async def require_role(current: dict, roles: list) -> dict:
    if current.get("role") == "admin":
        return current
    if current.get("role") not in roles:
        raise HTTPException(status_code=403, detail=f"Requires role: {','.join(roles)}")
    return current


# ---------- Models ----------
UserRole = Literal[
    "owner", "influencer", "admin", "agent",
    "support", "support_agent", "support_lead", "support_admin",
]
PublicRegisterRole = Literal["owner", "influencer", "agent"]


class RegisterInput(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=80)
    role: PublicRegisterRole
    otp: str = Field(min_length=6, max_length=6)
    handle: Optional[str] = None
    platform: Optional[str] = None
    company: Optional[str] = None
    mobile: Optional[str] = None
    pincode: Optional[str] = None

class CheckInput(BaseModel):
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    username: Optional[str] = None

class SendOTPInput(BaseModel):
    email: EmailStr
    mobile: Optional[str] = None


class LoginInput(BaseModel):
    identifier: str
    password: str
    remember_me: bool = False
    device_name: Optional[str] = None
    totp_code: Optional[str] = None

class GoogleLoginInput(BaseModel):
    credential: str  # Google OAuth ID token from client; email alone is not accepted


class ContentReviewInput(BaseModel):
    text: Optional[str] = None
    media_url: Optional[str] = None

class AdminAIPitchInput(BaseModel):
    influencer_id: str
    target_role: str = "owner"

class SendPitchInput(BaseModel):
    influencer_id: str
    target_email: EmailStr
    subject: str
    body: str
    avatar: Optional[str] = None
    handle: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    cover_photo: Optional[str] = None
    handle: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    linkedin: Optional[str] = None
    company_size: Optional[str] = None
    employees: Optional[str] = None
    # UI niches multi-select: production historically typed this as str; accept either.
    category: Optional[Any] = None
    followers: Optional[int] = None
    platforms: Optional[List[str]] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    portfolio: Optional[List[str]] = None
    social_accounts: Optional[List[Dict[str, Any]]] = None
    onboarding_status: Optional[str] = None
    agent_approved: Optional[bool] = None
    niches: Optional[List[str]] = None
    roster_size: Optional[str] = None
    oauth_connections: Optional[List[Dict[str, Any]]] = None
    languages: Optional[List[str]] = None
    platform_metrics: Optional[Dict[str, Any]] = None

    @field_validator("category", mode="before")
    @classmethod
    def coerce_category(cls, v):
        """Niches UI sends a list; older clients/API expect a comma-separated string."""
        if v is None:
            return None
        if isinstance(v, list):
            parts = [str(x).strip() for x in v if x is not None and str(x).strip()]
            return ", ".join(parts) if parts else None
        if isinstance(v, str):
            return v.strip() or None
        return str(v)
    
    # New Comprehensive Profile Fields
    availability: Optional[str] = None
    languages: Optional[List[str]] = None
    base_rate: Optional[int] = None
    past_campaigns: Optional[List[Dict[str, Any]]] = None
    experience: Optional[str] = None
    content_types: Optional[List[str]] = None
    response_time: Optional[str] = None
    platform_metrics: Optional[Dict[str, Dict[str, Any]]] = None
    agent_type: Optional[str] = None
    associated_brands: Optional[List[Dict[str, Any]]] = None
    monthly_analytics: Optional[List[Dict[str, Any]]] = None  # For historical charts
    decline_reason: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    is_private: Optional[bool] = None
    show_online_status: Optional[bool] = None
    show_last_seen: Optional[bool] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    high_contrast: Optional[bool] = None
    font_scale: Optional[float] = None
    notification_prefs: Optional[Dict[str, Any]] = None
    privacy: Optional[Dict[str, Any]] = None


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
    location: Optional[str] = None
    timeline: Optional[str] = None
    min_followers: Optional[int] = None
    influencer_location: Optional[str] = None
    influencer_experience: Optional[str] = None
    influencer_type: Optional[str] = None
    min_reach: Optional[str] = None
    min_engagement: Optional[str] = None


class ApplicationCreate(BaseModel):
    pitch: str = Field(min_length=1, max_length=5000)
    rate: int = Field(gt=0)

    @field_validator("pitch")
    @classmethod
    def pitch_not_blank(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError("This field is required.")
        return cleaned


class InvitationCreate(BaseModel):
    creator_id: str
    campaign_id: str
    offer: int
    message: str


class InvitationAction(BaseModel):
    counter_offer: Optional[int] = None
    note: Optional[str] = None


class MessageCreate(BaseModel):
    content: str = ""
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    reply_to_id: Optional[str] = None


class SocialUserRef(BaseModel):
    """Body for follow / unfollow / block / DM open — module-level so FastAPI treats it as JSON body."""
    user_id: str


class SocialReportIn(BaseModel):
    target_type: Literal["user", "post", "comment", "message", "content"] = "user"
    target_id: str
    reason: str
    details: Optional[str] = None


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


class AIPitchInput(BaseModel):
    campaign_id: str


class AIBioInput(BaseModel):
    tone: Optional[str] = "editorial"


class AIPricingInput(BaseModel):
    kind: Literal["reel", "story", "post", "video"] = "reel"


class AISearchInput(BaseModel):
    query: str


class ContractSign(BaseModel):
    signed_by: Literal["owner", "creator"]
    signature_name: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class EmailVerifyConfirm(BaseModel):
    token: str


class OTPRequest(BaseModel):
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    ntfy_topic: Optional[str] = None  # open-source live OTP via ntfy.sh


class OTPVerify(BaseModel):
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    code: Optional[str] = None
    otp: Optional[str] = None


_otp_store: Dict[str, dict] = {}


# ---------- Auth Endpoints ----------
@api_router.post("/auth/check")
async def check_availability(inp: CheckInput):
    if inp.email:
        if await db.users.find_one({"email": inp.email.lower().strip()}):
            return {"available": False, "field": "email"}
    if inp.mobile:
        if await find_user_by_mobile(inp.mobile):
            return {"available": False, "field": "mobile"}
    if inp.username:
        if await db.users.find_one({"username": inp.username.lower().strip()}):
            return {"available": False, "field": "username"}
    return {"available": True}


# --- PROVIDER ABSTRACTION & SECURITY CONFIGURATION ---
from abc import ABC, abstractmethod
import hashlib

OTP_LENGTH = int(os.environ.get("OTP_LENGTH", 6))
OTP_EXPIRY_MINUTES = int(os.environ.get("OTP_EXPIRY_MINUTES", 5))
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", 3))
OTP_RESEND_SECONDS = int(os.environ.get("OTP_RESEND_SECONDS", 60))
NTFY_BASE_URL = (os.environ.get("NTFY_BASE_URL") or "https://ntfy.sh").rstrip("/")


def sanitize_ntfy_topic(topic: str) -> str:
    topic = (topic or "").strip().lower()
    topic = re.sub(r"[^a-z0-9_-]", "-", topic)
    topic = re.sub(r"-+", "-", topic).strip("-_")
    if len(topic) < 8 or len(topic) > 64:
        raise HTTPException(
            status_code=400,
            detail="ntfy topic must be 8–64 characters (letters, numbers, _ or -).",
        )
    return topic


async def send_ntfy_otp(topic: str, otp: str, name: str = "there") -> str:
    """Live OTP via open-source ntfy (https://ntfy.sh). Works over HTTPS from Render."""
    topic = sanitize_ntfy_topic(topic)
    url = f"{NTFY_BASE_URL}/{topic}"
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            res = await c.post(
                url,
                content=f"Hello {name}, your CR8 Studio verification code is {otp}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
                headers={
                    "Title": "CR8 Studio OTP",
                    "Priority": "high",
                    "Tags": "key,cr8",
                    "Content-Type": "text/plain",
                },
            )
            if res.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"ntfy delivery failed ({res.status_code}). Open {url} in another tab, then retry.",
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("ntfy OTP exception: %s", e)
        raise HTTPException(status_code=502, detail=f"ntfy delivery failed: {e}")
    return url

def hash_otp(otp_code: str) -> str:
    """Hashes OTP using SHA-256 for secure storage."""
    return hashlib.sha256(otp_code.strip().encode("utf-8")).hexdigest()

class EmailProvider(ABC):
    @abstractmethod
    async def send_email_otp(self, to: str, name: str, otp: str) -> None:
        pass

class SmsProvider(ABC):
    @abstractmethod
    async def send_sms_otp(self, mobile: str, otp: str) -> None:
        pass

class GmailEmailProvider(EmailProvider):
    async def send_email_otp(self, to: str, name: str, otp: str) -> None:
        display_name = name or to.split("@")[0].title()
        html_content = f"""
        <div style="background-color:#0B0B0E;padding:40px 15px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#F4F4F0;">
          <div style="max-width:550px;margin:0 auto;background:#121212;border:1px solid rgba(255,255,255,0.15);border-radius:4px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
            <div style="height:3px;background:linear-gradient(to right, #FF3B30, #9333EA, #34C759);width:100%;"></div>
            <div style="padding:28px 24px;border-bottom:1px solid rgba(255,255,255,0.1);">
              <span style="font-family:monospace;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#FF3B30;font-weight:bold;">
                § CR8 STUDIO · VERIFICATION
              </span>
            </div>
            <div style="padding:36px 28px;background:#121212;">
              <h2 style="font-size:22px;color:#F4F4F0;margin-top:0;font-weight:400;font-family:Georgia,serif;">Hello {display_name},</h2>
              <p style="font-size:14px;color:rgba(244,244,240,0.8);margin:24px 0 10px 0;line-height:1.6;">
                Welcome to cr8 studio. Your verification code is:
              </p>
              <div style="margin:24px 0;padding:18px;background:rgba(255,59,48,0.08);border:1px solid rgba(255,59,48,0.3);border-radius:2px;text-align:center;">
                <span style="font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#FF3B30;">{otp}</span>
              </div>
              <p style="font-size:12px;color:rgba(244,244,240,0.5);margin-top:30px;line-height:1.6;font-family:monospace;text-transform:uppercase;">
                This OTP is valid for {OTP_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.
              </p>
              <p style="font-size:13px;color:rgba(244,244,240,0.8);margin-top:20px;">
                Team cr8 studio
              </p>
            </div>
            <div style="background-color:#0A0A0C;padding:20px;text-align:center;color:rgba(244,244,240,0.4);font-size:10px;font-family:monospace;letter-spacing:0.2em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.08);">
              CR8 STUDIO · ALL RIGHTS RESERVED
            </div>
          </div>
        </div>
        """
        await send_email_or_raise(to, "Verify your email address - CR8 Studio", html_content)

class Fast2SMSSmsProvider(SmsProvider):
    async def send_sms_otp(self, mobile: str, otp: str) -> None:
        clean_mobile = mobile.replace("+91", "").replace(" ", "").strip()
        if not (len(clean_mobile) == 10 and clean_mobile.isdigit()):
            raise HTTPException(status_code=400, detail="Invalid mobile number for SMS OTP")

        api_key = os.environ.get("FAST2SMS_API_KEY")
        if not api_key:
            raise HTTPException(status_code=502, detail="SMS provider is not configured (FAST2SMS_API_KEY missing)")

        # Transactional OTP route bypasses DND. Quick SMS (q) is promotional and fails for most Indian numbers.
        route = (os.environ.get("FAST2SMS_ROUTE") or "otp").strip().lower() or "otp"
        message = (
            f"CR8 Studio verification code is {otp}. "
            f"Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share this code."
        )

        def _otp_payload() -> dict:
            payload = {
                "route": "otp",
                "variables_values": str(otp),
                "numbers": clean_mobile,
            }
            # Optional DLT template id if account requires it
            msg_id = (os.environ.get("FAST2SMS_MESSAGE_ID") or os.environ.get("FAST2SMS_TEMPLATE_ID") or "").strip()
            if msg_id:
                payload["message"] = msg_id
            flash = (os.environ.get("FAST2SMS_FLASH") or "").strip()
            if flash in ("0", "1"):
                payload["flash"] = flash
            return payload

        def _quick_payload() -> dict:
            return {
                "route": "q",
                "numbers": clean_mobile,
                "language": "english",
                "message": message,
            }

        def _friendly_error(raw: str) -> str:
            low = (raw or "").lower()
            if "dnd" in low:
                return (
                    "SMS blocked by DND on promotional route. "
                    "Set FAST2SMS_ROUTE=otp on the API (transactional OTP) and redeploy."
                )
            if "kyc" in low:
                return "Fast2SMS KYC is required before OTP SMS can be sent. Complete KYC in the Fast2SMS dashboard."
            if "wallet" in low or "balance" in low:
                return "Fast2SMS wallet balance is insufficient. Top up the wallet and try again."
            if "website verification" in low or "dlt" in low:
                return (
                    "Fast2SMS OTP/DLT setup incomplete. Complete website/DLT verification, "
                    "or set FAST2SMS_MESSAGE_ID to your approved template id."
                )
            return raw[:220] if raw else "Unknown SMS provider error"

        async def _post(client: httpx.AsyncClient, payload: dict):
            res = await client.post(
                "https://www.fast2sms.com/dev/bulkV2",
                headers={"authorization": api_key, "Content-Type": "application/json"},
                json=payload,
            )
            data = {}
            try:
                data = res.json()
            except Exception:
                pass
            ok = res.status_code == 200 and data.get("return") is not False
            err = str(data.get("message") or res.text or "")
            return ok, res.status_code, err, data

        primary = _otp_payload() if route == "otp" else (_quick_payload() if route == "q" else {
            "route": route,
            "numbers": clean_mobile,
            "language": "english",
            "message": message,
        })
        # If custom DLT route (e.g. dlt), include sender/message id when present
        if route not in ("otp", "q"):
            sender = (os.environ.get("FAST2SMS_SENDER_ID") or "").strip()
            msg_id = (os.environ.get("FAST2SMS_MESSAGE_ID") or os.environ.get("FAST2SMS_TEMPLATE_ID") or "").strip()
            if sender:
                primary["sender_id"] = sender
            if msg_id:
                primary["message"] = msg_id
            primary["variables_values"] = str(otp)

        try:
            async with httpx.AsyncClient(timeout=15) as c:
                ok, status, err, _ = await _post(c, primary)
                if ok:
                    logger.info("Fast2SMS OTP dispatched via route=%s to +91 %s", primary.get("route"), clean_mobile)
                    return

                err_low = err.lower()
                # Promotional Quick SMS blocked by DND → retry transactional OTP route
                if primary.get("route") == "q" and "dnd" in err_low:
                    logger.warning("Fast2SMS Quick SMS DND-blocked for +91 %s; retrying OTP route", clean_mobile)
                    ok2, status2, err2, _ = await _post(c, _otp_payload())
                    if ok2:
                        logger.info("Fast2SMS OTP dispatched via route=otp (DND fallback) to +91 %s", clean_mobile)
                        return
                    raise HTTPException(status_code=502, detail=f"SMS provider error: {_friendly_error(err2)}")

                # OTP route needs website/DLT verification → last-resort Quick SMS (may still hit DND)
                if primary.get("route") == "otp" and (
                    "website verification" in err_low or "dlt" in err_low or "kyc" in err_low
                ):
                    logger.warning("Fast2SMS OTP route failed (%s). Retrying Quick SMS route=q", err[:200])
                    ok2, status2, err2, _ = await _post(c, _quick_payload())
                    if ok2:
                        logger.info("Fast2SMS OTP dispatched via Quick SMS to +91 %s", clean_mobile)
                        return
                    raise HTTPException(status_code=502, detail=f"SMS provider error: {_friendly_error(err2 or err)}")

                raise HTTPException(
                    status_code=502,
                    detail=f"SMS provider error {status}: {_friendly_error(err)}",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Fast2SMS exception: %s", e)
            raise HTTPException(status_code=502, detail=f"SMS delivery failed: {e}")

email_provider: EmailProvider = GmailEmailProvider()
sms_provider: SmsProvider = Fast2SMSSmsProvider()


# --- EMAIL OTP ENDPOINTS ---

@api_router.post("/auth/email/send-otp")
@api_router.post("/auth/email/resend-otp")
async def email_send_otp(inp: OTPRequest):
    if not inp.email:
        raise HTTPException(status_code=400, detail="Email address is required")
    
    email = inp.email.lower().strip()
    
    # Check 60s resend cooldown
    existing = await db.otps.find_one({"email": email})
    if existing and existing.get("created_at"):
        try:
            created_at = parse_otp_datetime(existing["created_at"])
            if created_at:
                secs_passed = (datetime.now(timezone.utc) - created_at).total_seconds()
                if secs_passed < OTP_RESEND_SECONDS:
                    wait_secs = int(OTP_RESEND_SECONDS - secs_passed)
                    raise HTTPException(status_code=429, detail=f"Please wait {wait_secs} seconds before requesting another OTP.")
        except HTTPException:
            raise
        except Exception:
            pass

    otp_code = "".join(str(random.randint(0, 9)) for _ in range(OTP_LENGTH))
    hashed = hash_otp(otp_code)
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=OTP_EXPIRY_MINUTES)

    doc = {
        "email": email,
        "hashed_otp": hashed,
        "code": otp_code,
        "attempts": 0,
        "created_at": now_utc.isoformat(),
        "expires_at": expires_at.isoformat()
    }

    await email_provider.send_email_otp(email, email.split("@")[0], otp_code)

    await db.otps.update_one({"email": email}, {"$set": doc}, upsert=True)
    _otp_store[email] = {"code": otp_code, "expires_at": expires_at, "hashed_otp": hashed, "attempts": 0}

    return {"ok": True, "message": f"Verification code sent to {email}. Valid for {OTP_EXPIRY_MINUTES} minutes."}


@api_router.post("/auth/email/verify-otp")
async def email_verify_otp(inp: OTPVerify):
    if not inp.email:
        raise HTTPException(status_code=400, detail="Email address is required")
    
    email = inp.email.lower().strip()
    target_code = (inp.code or inp.otp or "").strip()
    if not target_code or len(target_code) != OTP_LENGTH:
        raise HTTPException(status_code=400, detail=f"Please enter a valid {OTP_LENGTH}-digit OTP code")

    doc = await db.otps.find_one({"email": email})
    if not doc:
        doc = _otp_store.get(email)

    if not doc:
        raise HTTPException(status_code=400, detail="No OTP requested for this email address")

    if otp_expired(doc.get("expires_at")):
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new verification code.")

    attempts = doc.get("attempts", 0) + 1
    if attempts > OTP_MAX_ATTEMPTS:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")

    target_hash = hash_otp(target_code)
    stored_hash = doc.get("hashed_otp") or hash_otp(str(doc.get("code") or doc.get("otp") or ""))
    if target_hash != stored_hash and str(target_code) != str(doc.get("code") or doc.get("otp") or ""):
        await db.otps.update_one({"email": email}, {"$set": {"attempts": attempts}})
        remaining = OTP_MAX_ATTEMPTS - attempts
        if remaining <= 0:
            await db.otps.delete_one({"email": email})
            _otp_store.pop(email, None)
            raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")
        raise HTTPException(status_code=400, detail=f"Incorrect OTP code. {remaining} attempt(s) remaining.")

    await db.otps.delete_one({"email": email})
    _otp_store.pop(email, None)

    user = await db.users.find_one({"email": email})
    if user:
        await db.users.update_one({"email": email}, {"$set": {"email_verified": True, "verified": True}})

    return {"ok": True, "verified": True, "message": "Email address verified successfully!"}


# --- MOBILE OTP ENDPOINTS ---

@api_router.post("/auth/mobile/send-otp")
@api_router.post("/auth/mobile/resend-otp")
async def mobile_send_otp(inp: OTPRequest):
    if not inp.mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")
    
    mobile = normalize_mobile(inp.mobile)
    if len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number")

    existing = await db.otps.find_one({"mobile": mobile})
    if existing and existing.get("created_at"):
        try:
            created_at = parse_otp_datetime(existing["created_at"])
            if created_at:
                secs_passed = (datetime.now(timezone.utc) - created_at).total_seconds()
                if secs_passed < OTP_RESEND_SECONDS:
                    wait_secs = int(OTP_RESEND_SECONDS - secs_passed)
                    raise HTTPException(status_code=429, detail=f"Please wait {wait_secs} seconds before requesting another OTP.")
        except HTTPException:
            raise
        except Exception:
            pass

    otp_code = "".join(str(random.randint(0, 9)) for _ in range(OTP_LENGTH))
    hashed = hash_otp(otp_code)
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=OTP_EXPIRY_MINUTES)

    # Deliver SMS first — only persist OTP after provider accepts the send
    if not os.environ.get("FAST2SMS_API_KEY"):
        raise HTTPException(
            status_code=502,
            detail="SMS OTP is not configured. Set FAST2SMS_API_KEY on the server to enable live mobile verification.",
        )
    await sms_provider.send_sms_otp(mobile, otp_code)

    doc = {
        "mobile": mobile,
        "hashed_otp": hashed,
        "code": otp_code,
        "attempts": 0,
        "created_at": now_utc.isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    await db.otps.update_one({"mobile": mobile}, {"$set": doc}, upsert=True)
    _otp_store[mobile] = {"code": otp_code, "expires_at": expires_at, "hashed_otp": hashed, "attempts": 0}

    return {"ok": True, "message": f"Verification code sent to +91 {mobile}. Valid for {OTP_EXPIRY_MINUTES} minutes."}


@api_router.post("/auth/mobile/verify-otp")
async def mobile_verify_otp(inp: OTPVerify):
    if not inp.mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")

    mobile = normalize_mobile(inp.mobile)
    if len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number")
    target_code = (inp.code or inp.otp or "").strip()
    await consume_mobile_otp(mobile, target_code)

    user = await find_user_by_mobile(mobile)
    if user:
        user_id = user.get("id") or str(user["_id"])
        token = create_access_token(user_id, user["email"], user.get("role", "influencer"))
        return {"ok": True, "verified": True, "token": token, "user": clean(dict(user)), "message": "Mobile number verified successfully!"}

    raise HTTPException(
        status_code=404,
        detail="No account found for this mobile number. Please register first.",
    )


# Backward Compatible Unified Send & Verify Routes
@api_router.get("/auth/email/status")
async def email_provider_status():
    """Safe diagnostics — no secrets. Use to verify Render env + Brevo sender setup."""
    brevo_key = bool((os.environ.get("BREVO_API_KEY") or os.environ.get("SENDINBLUE_API_KEY") or "").strip())
    brevo_sender = (os.environ.get("BREVO_SENDER_EMAIL") or "").strip()
    gmail = bool((os.environ.get("GMAIL_USER") or "").strip() and (os.environ.get("GMAIL_APP_PASSWORD") or "").strip())
    detected = None
    if brevo_key:
        try:
            detected = await get_brevo_verified_sender(
                (os.environ.get("BREVO_API_KEY") or os.environ.get("SENDINBLUE_API_KEY") or "").strip()
            )
        except Exception as e:
            detected = f"error: {e}"
    return {
        "brevo_api_key": brevo_key,
        "brevo_sender_email_env": brevo_sender or None,
        "brevo_sender_resolved": detected,
        "gmail_smtp_configured": gmail,
        "fast2sms_configured": bool(os.environ.get("FAST2SMS_API_KEY")),
        "fast2sms_route": (os.environ.get("FAST2SMS_ROUTE") or "otp").strip() or "otp",
        "ntfy_base_url": NTFY_BASE_URL,
        "hint": (
            "Live mobile OTP uses Fast2SMS transactional route by default (FAST2SMS_ROUTE=otp). "
            "Avoid FAST2SMS_ROUTE=q — Quick SMS is blocked by DND for most Indian numbers."
        ),
    }


@api_router.post("/auth/send-otp")
async def send_otp(inp: OTPRequest):
    if inp.email:
        return await email_send_otp(inp)
    if inp.mobile:
        return await mobile_send_otp(inp)
    raise HTTPException(status_code=400, detail="Either email or mobile is required")

@api_router.post("/auth/verify-otp")
async def verify_otp(inp: OTPVerify):
    if inp.email:
        return await email_verify_otp(inp)
    if inp.mobile:
        return await mobile_verify_otp(inp)
    raise HTTPException(status_code=400, detail="Either email or mobile is required")

@api_router.post("/auth/logout")
async def logout_endpoint():
    return {"ok": True, "message": "Logged out successfully"}


class FirebaseRegisterInput(BaseModel):
    firebase_token: str
    email: str
    username: str
    password: str
    name: str
    role: str
    company: Optional[str] = None
    agent_type: Optional[str] = None
    pincode: Optional[str] = None
    platform: Optional[str] = None
    handle: Optional[str] = None
    mobile: Optional[str] = None


class MobileRegisterInput(BaseModel):
    """Register with backend-sent mobile OTP (no Firebase / billing required)."""
    otp: str = Field(min_length=6, max_length=6)
    email: EmailStr
    username: str
    password: str
    name: str
    role: str
    mobile: str
    company: Optional[str] = None
    agent_type: Optional[str] = None
    pincode: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    platform: Optional[str] = None
    handle: Optional[str] = None

    @field_validator("otp", mode="before")
    @classmethod
    def coerce_otp(cls, v):
        digits = "".join(ch for ch in str(v or "") if ch.isdigit())
        return digits

    @field_validator("mobile", mode="before")
    @classmethod
    def coerce_mobile(cls, v):
        return "".join(ch for ch in str(v or "") if ch.isdigit())[-10:] if v else v


from google.oauth2 import id_token
from google.auth.transport import requests

class FirebaseLoginInput(BaseModel):
    firebase_token: str


async def consume_mobile_otp(mobile: str, target_code: str, *, consume: bool = True) -> dict:
    """Validate a mobile OTP. Deletes it after a match unless consume=False."""
    mobile = normalize_mobile(mobile)
    target_code = (target_code or "").strip()
    if len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number")
    if not target_code or len(target_code) != OTP_LENGTH:
        raise HTTPException(status_code=400, detail=f"Please enter a valid {OTP_LENGTH}-digit OTP code")

    doc = await db.otps.find_one({"mobile": mobile})
    if not doc:
        doc = _otp_store.get(mobile)
    if not doc:
        raise HTTPException(status_code=400, detail="No OTP requested for this mobile number")

    if otp_expired(doc.get("expires_at")):
        await db.otps.delete_one({"mobile": mobile})
        _otp_store.pop(mobile, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new verification code.")

    attempts = doc.get("attempts", 0) + 1
    if attempts > OTP_MAX_ATTEMPTS:
        await db.otps.delete_one({"mobile": mobile})
        _otp_store.pop(mobile, None)
        raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")

    target_hash = hash_otp(target_code)
    stored_hash = doc.get("hashed_otp") or hash_otp(str(doc.get("code") or doc.get("otp") or ""))
    if target_hash != stored_hash and str(target_code) != str(doc.get("code") or doc.get("otp") or ""):
        await db.otps.update_one({"mobile": mobile}, {"$set": {"attempts": attempts}})
        remaining = OTP_MAX_ATTEMPTS - attempts
        if remaining <= 0:
            await db.otps.delete_one({"mobile": mobile})
            _otp_store.pop(mobile, None)
            raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")
        raise HTTPException(status_code=400, detail=f"Incorrect OTP code. {remaining} attempt(s) remaining.")

    if consume:
        await db.otps.delete_one({"mobile": mobile})
        _otp_store.pop(mobile, None)
    return doc


async def consume_email_otp(email: str, target_code: str, *, consume: bool = True) -> dict:
    """Validate an email OTP. Deletes it after a match unless consume=False."""
    email = (email or "").lower().strip()
    target_code = (target_code or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email address is required")
    if not target_code or len(target_code) != OTP_LENGTH:
        raise HTTPException(status_code=400, detail=f"Please enter a valid {OTP_LENGTH}-digit OTP code")

    doc = await db.otps.find_one({"email": email})
    if not doc:
        doc = _otp_store.get(email)
    if not doc:
        raise HTTPException(status_code=400, detail="No OTP requested for this email address")

    if otp_expired(doc.get("expires_at")):
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new verification code.")

    attempts = doc.get("attempts", 0) + 1
    if attempts > OTP_MAX_ATTEMPTS:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")

    target_hash = hash_otp(target_code)
    stored_hash = doc.get("hashed_otp") or hash_otp(str(doc.get("code") or doc.get("otp") or ""))
    if target_hash != stored_hash and str(target_code) != str(doc.get("code") or doc.get("otp") or ""):
        await db.otps.update_one({"email": email}, {"$set": {"attempts": attempts}})
        remaining = OTP_MAX_ATTEMPTS - attempts
        if remaining <= 0:
            await db.otps.delete_one({"email": email})
            _otp_store.pop(email, None)
            raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")
        raise HTTPException(status_code=400, detail=f"Incorrect OTP code. {remaining} attempt(s) remaining.")

    if consume:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
    return doc


async def _clear_signup_otps(email: Optional[str], mobile: Optional[str]) -> None:
    email = (email or "").lower().strip()
    mobile = normalize_mobile(mobile) if mobile else ""
    if email:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
    if mobile:
        await db.otps.delete_one({"mobile": mobile})
        _otp_store.pop(mobile, None)


@api_router.post("/auth/register/send-otp")
@api_router.post("/auth/register/resend-otp")
async def register_send_otp(inp: OTPRequest):
    """Live signup OTP via SMS (primary). Optional ntfy topic as extra channel."""
    if not inp.email:
        raise HTTPException(status_code=400, detail="Email address is required")
    if not inp.mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")

    email = inp.email.lower().strip()
    mobile = inp.mobile.strip().replace(" ", "").replace("+91", "")
    if len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number")

    for query in ({"email": email}, {"mobile": mobile}):
        existing = await db.otps.find_one(query)
        if existing and existing.get("created_at"):
            try:
                created_at = parse_otp_datetime(existing["created_at"])
                if created_at:
                    secs_passed = (datetime.now(timezone.utc) - created_at).total_seconds()
                    if secs_passed < OTP_RESEND_SECONDS:
                        wait_secs = int(OTP_RESEND_SECONDS - secs_passed)
                        raise HTTPException(status_code=429, detail=f"Please wait {wait_secs} seconds before requesting another OTP.")
            except HTTPException:
                raise
            except Exception:
                pass

    otp_code = "".join(str(random.randint(0, 9)) for _ in range(OTP_LENGTH))
    hashed = hash_otp(otp_code)
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(minutes=OTP_EXPIRY_MINUTES)
    shared = {
        "hashed_otp": hashed,
        "code": otp_code,
        "attempts": 0,
        "created_at": now_utc.isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    channels = []
    ntfy_url = None

    # 1) Real SMS to the user's phone (friend-friendly)
    if not os.environ.get("FAST2SMS_API_KEY"):
        raise HTTPException(
            status_code=502,
            detail="SMS OTP is not configured. Set FAST2SMS_API_KEY on the server to enable live mobile verification.",
        )
    await sms_provider.send_sms_otp(mobile, otp_code)
    channels.append(f"SMS (+91 {mobile})")

    # 2) Optional ntfy mirror if topic provided
    if inp.ntfy_topic:
        try:
            ntfy_url = await send_ntfy_otp(inp.ntfy_topic, otp_code, email.split("@")[0])
            channels.append(f"ntfy ({ntfy_url})")
        except HTTPException as e:
            logger.warning("Optional ntfy OTP failed (SMS already sent): %s", e.detail)

    await db.otps.update_one({"email": email}, {"$set": {**shared, "email": email}}, upsert=True)
    await db.otps.update_one({"mobile": mobile}, {"$set": {**shared, "mobile": mobile}}, upsert=True)
    _otp_store[email] = {**shared, "expires_at": expires_at}
    _otp_store[mobile] = {**shared, "expires_at": expires_at}

    resp = {
        "ok": True,
        "message": f"Verification code sent by SMS to +91 {mobile}. Valid for {OTP_EXPIRY_MINUTES} minutes.",
        "channels": channels,
    }
    if ntfy_url:
        resp["ntfy_url"] = ntfy_url
    return resp


@api_router.post("/auth/firebase-login")
async def firebase_login(inp: FirebaseLoginInput):
    try:
        decoded_token = id_token.verify_firebase_token(inp.firebase_token, requests.Request(), "cr8studio-b91fe")
        mobile = decoded_token.get('phone_number')
        if not mobile:
            raise HTTPException(status_code=400, detail="Firebase token does not contain a phone number")
        
        # Look up user by mobile number across legacy formats
        user = await find_user_by_mobile(mobile)
        
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this mobile number")
            
        user_id = user.get("id") or str(user["_id"])
        token = create_access_token(user_id, user.get("email"), user.get("role", "influencer"))
        await write_audit_log(
            action="User Login",
            user_id=user_id,
            username=user.get("username"),
            details="Signed in via mobile OTP",
            status="Completed",
            meta={"method": "firebase"},
        )
        return {"ok": True, "token": token, "user": clean(dict(user))}
        
    except ValueError as e:
        logger.error(f"Firebase token error during login: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase token")


async def _create_registered_user(
    *,
    email: str,
    username: str,
    password: str,
    name: str,
    role: str,
    mobile: str,
    company: Optional[str] = None,
    agent_type: Optional[str] = None,
    pincode: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    platform: Optional[str] = None,
    handle: Optional[str] = None,
    verified: bool = True,
) -> dict:
    email = email.lower().strip()
    username = username.lower().strip()
    clean_mobile = normalize_mobile(mobile)

    if await db.users.find_one({"$or": [
        {"email": email},
        {"username": username},
        {"mobile": clean_mobile},
        {"mobile": f"+91{clean_mobile}"},
    ]}):
        raise HTTPException(status_code=400, detail="User with this email, username, or mobile already exists")

    if role == "admin":
        raise HTTPException(status_code=400, detail="Cannot self-register as admin")

    if not (any(c.isalpha() for c in password) and any(c.isdigit() for c in password)):
        raise HTTPException(status_code=400, detail="Password must be alphanumeric")

    user_id = str(uuid.uuid4())
    # Prefer city/state captured at signup (pincode lookup on client); fall back to server lookup
    city_val = (city or "").strip() or None
    state_val = (state or "").strip() or None
    if pincode and (not city_val or not state_val):
        loc = await fetch_pincode_details(pincode)
        if not city_val:
            city_val = loc.get("city") if loc.get("city") != "Unknown" else None
        if not state_val:
            state_val = loc.get("state") if loc.get("state") != "Unknown" else None

    social_accounts = []
    platforms = []
    platform_metrics = {
        "facebook": {"handle": "", "followers": 0, "engagement": 0, "views": 0, "posts": 0},
        "instagram": {"handle": "", "followers": 0, "engagement": 0, "views": 0, "posts": 0},
        "twitter": {"handle": "", "followers": 0, "engagement": 0, "views": 0, "posts": 0},
        "youtube": {"handle": "", "followers": 0, "engagement": 0, "views": 0, "posts": 0},
    }
    if role == "influencer" and platform and handle:
        plat_key = str(platform).strip().lower()
        social_accounts.append({"platform": plat_key, "handle": handle, "followers": 0, "engagement_rate": 0.0})
        platforms.append(plat_key)
        if plat_key in platform_metrics:
            platform_metrics[plat_key]["handle"] = str(handle).strip()

    doc = {
        "id": user_id,
        "email": email,
        "username": username,
        "password_hash": hash_password(password),
        "name": name, "role": role, "handle": handle, "company": company,
        "mobile": clean_mobile, "pincode": pincode,
        "bio": None, "avatar": None, "niches": [], "followers": None, "platforms": platforms,
        "location": city_val, "city": city_val, "state": state_val, "industry": None, "website": None,
        "portfolio": [], "rate_card": {}, "verified": verified, "email_verified": False, "wallet": 0,
        "onboarding_status": "pending", "agent_approved": False,
        "created_at": now_iso(),
        "social_accounts": social_accounts,
        "platform_metrics": platform_metrics,
        "agent_type": agent_type,
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, role)
    role_label = ROLE_AUDIT_LABELS.get(role, (role or "user").title())
    await write_audit_log(
        action=f"{role_label} Signup",
        user_id=user_id,
        username=username,
        user=username,
        details=f"Registered new {role_label.lower()} account",
        status="Completed",
        meta={"role": role, "email": email},
    )
    return {"ok": True, "token": token, "user": clean(doc)}


@api_router.post("/auth/mobile-register")
async def mobile_register(inp: MobileRegisterInput):
    """Sign up using email/SMS OTP from our backend — does not require Firebase billing."""
    email = inp.email.lower().strip()
    otp_code = str(inp.otp or "").strip()
    # Verify first (do not burn the code) so a later create failure can retry.
    try:
        await consume_email_otp(email, otp_code, consume=False)
    except HTTPException as email_err:
        try:
            await consume_mobile_otp(inp.mobile, otp_code, consume=False)
        except HTTPException:
            raise email_err

    result = await _create_registered_user(
        email=inp.email,
        username=inp.username,
        password=inp.password,
        name=inp.name,
        role=inp.role,
        mobile=inp.mobile,
        company=inp.company,
        agent_type=inp.agent_type,
        pincode=inp.pincode,
        city=inp.city,
        state=inp.state,
        platform=inp.platform,
        handle=inp.handle,
        verified=True,
    )
    await _clear_signup_otps(email, inp.mobile)
    await db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
    if result.get("user"):
        result["user"]["email_verified"] = True
    return result


@api_router.post("/auth/firebase-register")
async def firebase_register(inp: FirebaseRegisterInput):
    try:
        decoded_token = id_token.verify_firebase_token(inp.firebase_token, requests.Request(), "cr8studio-b91fe")
        mobile = decoded_token.get('phone_number')
        if not mobile:
            raise HTTPException(status_code=400, detail="Firebase token does not contain a phone number")

        return await _create_registered_user(
            email=inp.email,
            username=inp.username,
            password=inp.password,
            name=inp.name,
            role=inp.role,
            mobile=mobile,
            company=inp.company,
            agent_type=inp.agent_type,
            pincode=inp.pincode,
            platform=inp.platform,
            handle=inp.handle,
            verified=True,
        )
    except ValueError as e:
        logger.error(f"Firebase token error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

@api_router.post("/auth/register")
async def register_old(inp: RegisterInput):
    email = inp.email.lower().strip()
    username = inp.username.lower().strip()
    mobile = inp.mobile.strip() if inp.mobile else None

    await consume_email_otp(email, inp.otp, consume=False)

    if await db.users.find_one({"$or": [{"email": email}, {"username": username}, {"mobile": mobile}]}):
        raise HTTPException(status_code=400, detail="User with this email, username, or mobile already exists")
    if inp.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot self-register as admin")
    if inp.role in ("support", "support_agent", "support_lead", "support_admin"):
        raise HTTPException(status_code=400, detail="Cannot self-register as Support Operations staff")
    
    if not (any(c.isalpha() for c in inp.password) and any(c.isdigit() for c in inp.password)):
        raise HTTPException(status_code=400, detail="Password must be alphanumeric")

    if inp.role in ["owner", "agent"] and not inp.company:
        raise HTTPException(status_code=400, detail=f"{'Owners' if inp.role == 'owner' else 'Agents'} must provide a {'brand or company' if inp.role == 'owner' else 'agency'} name")

    user_id = str(uuid.uuid4())
    city, state = None, None
    if inp.pincode:
        loc = await fetch_pincode_details(inp.pincode)
        city = loc.get("city") if loc.get("city") != "Unknown" else None
        state = loc.get("state") if loc.get("state") != "Unknown" else None

    social_accounts = []
    platforms = []
    if inp.role == "influencer" and inp.platform and inp.handle:
        social_accounts.append({"platform": inp.platform, "handle": inp.handle, "followers": 0, "engagement_rate": 0.0})
        platforms.append(inp.platform)

    doc = {
        "id": user_id,
        "email": email,
        "username": username,
        "password_hash": hash_password(inp.password),
        "name": inp.name, "role": inp.role, "handle": inp.handle, "company": inp.company,
        "mobile": inp.mobile, "pincode": inp.pincode,
        "bio": None, "avatar": None, "niches": [], "followers": None, "platforms": platforms,
        "location": None, "city": city, "state": state, "industry": None, "website": None,
        "portfolio": [], "rate_card": {}, "verified": False, "wallet": 0,
        "onboarding_status": "pending", "agent_approved": False,
        "created_at": now_iso(),
        "social_accounts": social_accounts,
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, inp.role)
    await _clear_signup_otps(email, mobile)
    role_label = ROLE_AUDIT_LABELS.get(inp.role, (inp.role or "user").title())
    await write_audit_log(
        action=f"{role_label} Signup",
        user_id=user_id,
        username=username,
        user=username,
        details=f"Registered new {role_label.lower()} account",
        status="Completed",
        meta={"role": inp.role, "email": email},
    )
    return {"token": token, "user": clean(doc)}

GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "858111971322-uf792cb63b4u97u1fu494kngaajuaibr.apps.googleusercontent.com",
)

@api_router.post("/auth/google-login")
async def google_login(inp: GoogleLoginInput):
    """Sign in only for already-registered users. Never creates accounts."""
    try:
        idinfo = id_token.verify_oauth2_token(
            inp.credential,
            requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.error(f"Google ID token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google sign-in token")

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")

    email = (idinfo.get("email") or "").lower().strip()
    if not email or not idinfo.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Google account email is missing or not verified")

    user = await db.users.find_one({"email": email})
    if not user:
        # Do not auto-register — user must complete signup first
        raise HTTPException(
            status_code=404,
            detail="Account not registered with this Google email. Please complete Registration first with your Mobile & Location details.",
        )

    # Enforce mandatory registration details (mobile & pincode)
    if not user.get("mobile") or not user.get("pincode"):
        raise HTTPException(
            status_code=400,
            detail="Account registration incomplete. Please complete Registration with your Mobile Number & Location details.",
        )

    user_id = user.get("id") or str(user["_id"])
    if not user.get("id"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"id": user_id}})
        user["id"] = user_id

    token = create_access_token(user_id, email, user.get("role", "influencer"))
    await write_audit_log(
        action="User Login",
        user_id=user_id,
        username=user.get("username"),
        details="Signed in with Google",
        status="Completed",
        meta={"method": "google", "email": email},
    )
    return {"token": token, "user": clean(dict(user))}


@api_router.post("/auth/login")
async def login(inp: LoginInput, request: Request):
    identifier = inp.identifier.lower().strip()
    user = await db.users.find_one({
        "$or": [{"email": identifier}, {"username": identifier}, {"mobile": identifier}]
    })
    if not user or not verify_password(inp.password, user["password_hash"]):
        await write_audit_log(
            action="Login Failed",
            username=identifier if "@" not in identifier or "." not in identifier else None,
            user=identifier,
            details="Invalid login credentials",
            status="Failed",
            meta={"identifier": identifier},
        )
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    if user.get("banned"):
        await write_audit_log(
            action="Login Failed",
            user_id=user.get("id"),
            username=user.get("username"),
            details="Banned account attempted login",
            status="Failed",
        )
        raise HTTPException(status_code=403, detail="Account suspended")

    # Optional 2FA gate (TOTP)
    if user.get("two_fa_enabled"):
        try:
            import pyotp
        except ImportError:
            pyotp = None
        if not inp.totp_code or not pyotp:
            return {"requires_2fa": True}
        if not pyotp.TOTP(user.get("two_fa_secret", "")).verify(inp.totp_code, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    user_id = user.get("id") or str(user["_id"])
    if not user.get("id"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"id": user_id}})
        user["id"] = user_id

    minutes = 60 * 24 * 30 if inp.remember_me else ACCESS_TOKEN_MINUTES
    payload = {
        "sub": user["id"], "email": user["email"], "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
        "type": "access", "remember": inp.remember_me,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Track session + login history
    ua = request.headers.get("user-agent", "")[:240]
    ip = request.client.host if request.client else ""
    session_id = str(uuid.uuid4())
    import hashlib as _hashlib
    await db.sessions.insert_one({
        "id": session_id, "user_id": user["id"],
        "token_hash": _hashlib.sha256(token.encode()).hexdigest(),
        "device_name": inp.device_name or ua[:80] or "Unknown device",
        "user_agent": ua, "ip": ip, "remember_me": inp.remember_me,
        "created_at": now_iso(), "last_active": now_iso(), "revoked": False,
    })
    await db.login_history.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "ip": ip,
        "user_agent": ua, "device_name": inp.device_name or ua[:80],
        "created_at": now_iso(), "success": True,
    })
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": now_iso(), "online": True}})
    await write_audit_log(
        action="User Login",
        user_id=user["id"],
        username=user.get("username"),
        details="Signed in with password",
        status="Completed",
        meta={"method": "password", "remember_me": bool(inp.remember_me), "ip": ip},
    )
    return {"token": token, "user": clean(dict(user)), "session_id": session_id, "remember_me": inp.remember_me}


@api_router.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return current


@api_router.patch("/auth/me")
async def update_me(inp: UserUpdate, current: dict = Depends(get_current_user)):
    """Update current user profile / onboarding fields."""
    data = inp.model_dump(exclude_unset=True) if hasattr(inp, "model_dump") else inp.dict(exclude_unset=True)
    # Drop nulls so we don't wipe existing fields unintentionally
    updates = {k: v for k, v in data.items() if v is not None}

    if not updates:
        return current

    # Keep location in sync when city is set during onboarding
    if "city" in updates and "location" not in updates:
        updates["location"] = updates["city"]

    # Niches UI sends category as a list; older schemas store it as a string.
    if "category" in updates and isinstance(updates["category"], list):
        cat_list = [str(x).strip() for x in updates["category"] if x and str(x).strip()]
        updates["category"] = ", ".join(cat_list) if cat_list else None
        if "niches" not in updates:
            updates["niches"] = cat_list
        if updates["category"] is None:
            updates.pop("category", None)

    # Social metrics are auto-fetched — clients may only change platform handles/IDs.
    if "platform_metrics" in updates and isinstance(updates["platform_metrics"], dict):
        existing_pm = current.get("platform_metrics") or {}
        incoming_pm = updates["platform_metrics"] or {}
        merged_pm: Dict[str, Any] = {}
        for plat in ["facebook", "instagram", "twitter", "youtube"]:
            old = existing_pm.get(plat) if isinstance(existing_pm.get(plat), dict) else {}
            inc = incoming_pm.get(plat) if isinstance(incoming_pm.get(plat), dict) else {}
            handle = str(inc.get("handle") or old.get("handle") or "").strip()
            if not handle and plat in incoming_pm and isinstance(inc, dict) and "handle" in inc:
                # Explicit clear of handle
                merged_pm[plat] = {"handle": "", "followers": 0, "engagement": 0, "views": 0, "posts": 0}
                continue
            if handle:
                merged_pm[plat] = {
                    **{k: v for k, v in (old or {}).items() if k != "handle"},
                    "handle": handle,
                }
                # Never trust client-sent metric fields
                for metric_key in ("followers", "engagement", "views", "posts", "growth", "subscribers"):
                    if metric_key in merged_pm[plat] and metric_key in inc:
                        # restore server value if present
                        if metric_key in old:
                            merged_pm[plat][metric_key] = old[metric_key]
            elif old:
                merged_pm[plat] = old
        updates["platform_metrics"] = merged_pm

    user_id = current.get("id")
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        # Fallback for older docs keyed only by email
        await db.users.update_one({"email": current.get("email")}, {"$set": updates})

    user = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    if not user:
        user = await db.users.find_one({"email": current.get("email")}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["id"] = user.get("id") or str(user.get("_id", ""))
    user.pop("_id", None)
    await write_audit_log(
        action="Profile Update",
        user_id=user.get("id"),
        username=user.get("username"),
        details=f"Updated profile fields: {', '.join(sorted(updates.keys())[:8])}",
        status="Completed",
        meta={"fields": list(updates.keys())},
    )
    return clean(dict(user))


@api_router.post("/auth/delete-account")
async def delete_account(current: dict = Depends(get_current_user)):
    res = await db.users.delete_one({"id": current["id"], "role": {"$ne": "admin"}})
    if res.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Cannot delete admin account or user not found")
    
    # Also delete associated data
    await db.campaigns.delete_many({"owner_id": current["id"]})
    await db.applications.delete_many({"influencer_id": current["id"]})
    await db.posts.delete_many({"author_id": current["id"]})
    
    await write_audit_log(
        action="Account Deleted",
        user_id=current["id"],
        username=current.get("username"),
        details="User voluntarily deleted their account",
        status="Completed"
    )

    await log_activity(
        user_id=current["id"],
        action="Account Deleted",
        target_type="user",
        target_id=current["id"],
        details="User voluntarily deleted their account"
    )
    return {"ok": True, "message": "Account deleted successfully"}

class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


@api_router.post("/auth/change-password")
async def change_password(inp: ChangePasswordInput, current: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(inp.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if not (any(c.isalpha() for c in inp.new_password) and any(c.isdigit() for c in inp.new_password)):
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long and contain both letters and numbers.")

    new_hash = hash_password(inp.new_password)
    await db.users.update_one({"id": current["id"]}, {"$set": {"password_hash": new_hash}})
    await write_audit_log(
        action="Password Changed",
        user_id=current.get("id"),
        username=current.get("username"),
        details="User changed account password",
        status="Completed",
    )
    return {"ok": True, "message": "Password updated successfully"}





async def fetch_pincode_details(pincode: str):
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"https://api.postalpincode.in/pincode/{pincode}")
            data = r.json()
            if data and data[0]["Status"] == "Success":
                return {"city": data[0]["PostOffice"][0]["District"], "state": data[0]["PostOffice"][0]["State"]}
        except Exception:
            pass
    return {"city": "Unknown", "state": "Unknown"}

@api_router.get("/location/pincode/{pincode}")
async def get_location(pincode: str):
    return await fetch_pincode_details(pincode)


class SocialFetchInput(BaseModel):
    platform: str
    handle: str

@api_router.post("/social/fetch")
async def fetch_social_stats(inp: SocialFetchInput):
    import random
    followers = random.randint(1000, 2000000)
    return {
        "followers": followers,
        "following": random.randint(100, 5000),
        "posts": random.randint(10, 2000),
        "engagement_rate": round(random.uniform(0.5, 10.0), 2),
        "verified": followers > 100000
    }


class AgentDeclineInput(BaseModel):
    reason: Optional[str] = "Agency credentials require further verification."

@api_router.post("/admin/approve-agent/{agent_id}")
async def approve_agent(agent_id: str, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    res = await db.users.update_one(
        {"id": agent_id, "role": "agent"}, 
        {"$set": {"agent_approved": True, "onboarding_status": "approved", "decline_reason": None}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await push_notification(
        agent_id, "agent_approval", 
        "🎉 Congratulations! Your Agent Application has been APPROVED by Super Admin. You now have full access to the CR8 Talent Agent Console.",
        {"status": "approved"}
    )
    await write_audit_log(
        action="Agency Approved",
        user_id=current.get("id"),
        username=current.get("username"),
        details=f"Approved agency application {agent_id}",
        status="Completed",
        meta={"agent_id": agent_id},
    )
    return {"ok": True, "message": "Agent approved successfully"}

@api_router.post("/admin/decline-agent/{agent_id}")
async def decline_agent(agent_id: str, inp: Optional[AgentDeclineInput] = None, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    reason = inp.reason if inp and inp.reason else "Agency credentials require further verification."
    res = await db.users.update_one(
        {"id": agent_id, "role": "agent"}, 
        {"$set": {"agent_approved": False, "onboarding_status": "declined", "decline_reason": reason}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await push_notification(
        agent_id, "agent_declined", 
        f"⚠️ Your Agent Application requires revision. Reason: {reason}",
        {"status": "declined", "reason": reason}
    )
    await write_audit_log(
        action="Agency Declined",
        user_id=current.get("id"),
        username=current.get("username"),
        details=f"Declined agency application {agent_id}: {reason}",
        status="Completed",
        meta={"agent_id": agent_id, "reason": reason},
    )
    return {"ok": True, "message": "Agent application declined"}


@api_router.get("/admin/dashboard-stats")
async def admin_dashboard_stats(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    
    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(days=1)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$budget"}}}]

    results = await asyncio.gather(
        db.users.count_documents({"role": "influencer"}),
        db.users.count_documents({"role": "owner"}),
        db.users.count_documents({"role": "agent"}),
        db.campaigns.count_documents({}),
        db.campaigns.count_documents({"status": "in_progress"}),
        db.campaigns.count_documents({"status": "completed"}),
        db.campaigns.aggregate(pipeline).to_list(1),
        db.applications.count_documents({}),
        db.users.count_documents({"role": "agent", "agent_approved": False}),
        db.login_history.distinct("user_id", {"created_at": {"$gte": day_ago}, "success": True}),
        db.login_history.distinct("user_id", {"created_at": {"$gte": month_ago}, "success": True}),
        db.users.count_documents({"created_at": {"$gte": day_ago}}),
    )

    total_creators = results[0]
    total_brands = results[1]
    total_agencies = results[2]
    total_campaigns = results[3]
    active_campaigns = results[4]
    completed_campaigns = results[5]
    res = results[6]
    total_requests = results[7]
    pending_verification = results[8]
    dau_ids = results[9]
    mau_ids = results[10]
    new_registrations = results[11]

    total_payments = res[0]["total"] if res else 0
    total_revenue = total_payments * 0.15 # 15% platform commission mock

    logins_today = len([x for x in dau_ids if x])
    
    return {
        "users": {
            "creators": total_creators,
            "brands": total_brands,
            "agencies": total_agencies
        },
        "campaigns": {
            "total": total_campaigns,
            "active": active_campaigns,
            "completed": completed_campaigns,
            "pending_approval": await db.posts.count_documents({"status": "pending_approval"}),
        },
        "financial": {
            "total_payments": total_payments,
            "pending_payments": 0,
            "completed_payments": total_payments,
            "revenue": total_revenue
        },
        "requests": {
            "creator_requests": total_requests,
            "brand_requests": 0,
            "verification_requests": pending_verification
        },
        "platform": {
            "logins_today": logins_today,
            "new_registrations": new_registrations,
            "active_users": logins_today,
            "dau": logins_today,
            "mau": len([x for x in mau_ids if x]),
            "open_reports": await db.reports.count_documents({"status": "open"}),
            "published_posts": await db.posts.count_documents({"status": "published"}),
        }
    }

@api_router.get("/admin/recent-activity")
async def admin_recent_activity(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    audit_logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    if audit_logs:
        # Prefer username for display when we can resolve it
        user_ids = [a.get("user_id") for a in audit_logs if a.get("user_id")]
        uname_by_id = {}
        if user_ids:
            docs = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1}).to_list(200)
            uname_by_id = {d["id"]: d.get("username") for d in docs if d.get("username")}
        status_map = {
            "success": "Completed",
            "info": "Info",
            "failed": "Failed",
            "error": "Failed",
            "warning": "Warning",
        }
        for a in audit_logs:
            uname = a.get("username") or uname_by_id.get(a.get("user_id"))
            if uname:
                clean_uname = str(uname).lstrip("@").rstrip(".,")
                a["username"] = clean_uname
                a["user"] = clean_uname
            a["type"] = a.get("type") or a.get("action") or "Activity"
            a["time"] = a.get("time") or a.get("created_at") or now_iso()
            raw_status = str(a.get("status") or "Completed")
            a["status"] = status_map.get(raw_status.lower(), raw_status)
        return audit_logs
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(5).to_list(5)
    camps = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    activity = []
    for u in users:
        uname = (u.get("username") or "").strip()
        role_label = ROLE_AUDIT_LABELS.get(u.get("role"), (u.get("role") or "user").title())
        activity.append({
            "type": f"{role_label} Signup",
            "user": uname.lstrip("@").rstrip(".,") if uname else (u.get("email") or "User"),
            "username": (uname.lstrip("@").rstrip(".,") if uname else None),
            "status": "Completed",
            "time": u.get("created_at", now_iso())
        })
    for c in camps:
        activity.append({
            "type": "Campaign Brief Created",
            "user": c.get("brand", "Brand"),
            "status": c.get("status", "active"),
            "time": c.get("created_at", now_iso())
        })
    activity.sort(key=lambda x: x["time"], reverse=True)
    return activity[:10]


@api_router.get("/admin/payments")
async def admin_payments(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    if payments:
        return payments

    camps = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    res = []
    for c in camps:
        res.append({
            "id": f"PAY-{uuid.uuid4().hex[:6].upper()}",
            "creator": "Kai Monroe",
            "brand": c.get("brand", "Studio Noir"),
            "campaign": c.get("title", "Luxury Launch"),
            "amount": c.get("budget", 45000),
            "status": "Completed",
            "date": c.get("created_at", now_iso())
        })
    return res

@api_router.get("/admin/requests")
async def admin_requests(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    apps = await db.applications.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return apps

@api_router.get("/admin/users")
async def admin_users(
    role: Optional[str] = None, 
    category: Optional[str] = None, 
    q: Optional[str] = None,
    status: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    language: Optional[str] = None,
    current: dict = Depends(get_current_user)
):
    await require_role(current, ["admin"])
    # Never expose admin accounts in User Management (cannot be banned/deleted via UI).
    filt: Dict[str, Any] = {"role": {"$ne": "admin"}}
    role_aliases = {
        "creator": "influencer",
        "brand": "owner",
        "agency": "agent",
        "influencer": "influencer",
        "owner": "owner",
        "agent": "agent",
    }
    if role:
        mapped = role_aliases.get(role.strip().lower())
        if not mapped or mapped == "admin":
            return []
        filt["role"] = mapped
    if category:
        filt["$or"] = [{"category": category}, {"industry": category}]
    if q:
        filt["$or"] = [
            {"username": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"handle": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
        ]
    if status == "pending":
        filt["$or"] = [{"agent_approved": False}, {"onboarding_status": "pending_approval"}, {"onboarding_status": "pending"}]
    
    if state:
        filt["state"] = state
    if city:
        filt["city"] = city
    if language:
        filt["languages"] = language
        
    users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    return users


@api_router.post("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    res = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"agent_approved": True, "onboarding_status": "completed", "decline_reason": None}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await push_notification(
        user_id, "Account Approved", "Your account has been verified and approved.",
        "admin", "https://i.pravatar.cc/150?u=admin"
    )
    return {"ok": True}

class CreatorLevelInput(BaseModel):
    level: str

@api_router.patch("/admin/users/{user_id}/level")
async def admin_set_level(user_id: str, inp: CreatorLevelInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    res = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"creator_level": inp.level}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}

class DeclineUserInput(BaseModel):
    reason: Optional[str] = "Account credentials require further verification."

@api_router.post("/admin/users/{user_id}/decline")
async def admin_decline_user(user_id: str, inp: DeclineUserInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    res = await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"agent_approved": False, "onboarding_status": "declined", "decline_reason": inp.reason}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await push_notification(
        user_id, "Account Declined", f"Your account approval was declined. Reason: {inp.reason}",
        "admin", "https://i.pravatar.cc/150?u=admin"
    )
    return {"ok": True}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admin users cannot be deleted")
    if target.get("id") == current.get("id"):
        raise HTTPException(status_code=403, detail="Cannot delete your own account")
    res = await db.users.delete_one({"id": user_id, "role": {"$ne": "admin"}})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    # Also delete associated campaigns, applications, reviews, etc.
    await db.campaigns.delete_many({"owner_id": user_id})
    await db.applications.delete_many({"influencer_id": user_id})
    await write_audit_log(
        action="User Deleted",
        user_id=current.get("id"),
        username=current.get("username"),
        details=f"Admin deleted user {user_id}",
        status="Completed",
        meta={"target_user_id": user_id, "target_role": target.get("role")},
    )
    return {"ok": True, "message": "User deleted successfully"}

# ---------- Creators ----------
class SyncAnalyticsInput(BaseModel):
    """Optional unsaved handles from Edit Profile — metrics are always server-generated."""
    platform_metrics: Optional[Dict[str, Dict[str, Any]]] = None


@api_router.post("/creators/sync-analytics")
async def sync_analytics(
    inp: Optional[SyncAnalyticsInput] = None,
    current: dict = Depends(get_current_user),
):
    await require_role(current, ["influencer"])
    
    import os
    import httpx
    import asyncio
    from datetime import datetime, timezone, timedelta
    
    # 1. Update Platform Metrics with real data from Apify
    pm = dict(current.get("platform_metrics") or {})

    # Merge latest handles from client (IDs only) before fetching metrics
    if inp and isinstance(inp.platform_metrics, dict):
        for plat, info in inp.platform_metrics.items():
            if not isinstance(info, dict):
                continue
            handle = str(info.get("handle") or "").strip()
            existing = pm.get(plat) if isinstance(pm.get(plat), dict) else {}
            if handle:
                pm[plat] = {**(existing or {}), "handle": handle}
            elif plat in ("instagram", "youtube", "twitter", "facebook"):
                pm[plat] = {**(existing or {}), "handle": ""}
    
    # Check if any platforms have handles connected
    has_handles = any(
        isinstance(info, dict) and str(info.get("handle") or "").strip()
        for info in pm.values()
    )
    if not has_handles:
        return {
            "ok": True, 
            "message": "No social media platforms connected. No changes made.",
            "metrics": pm,
            "monthly_analytics": current.get("monthly_analytics", [])
        }

    from apify_service import apify_service
    
    async def fetch_platform(plat, handle):
        return await apify_service.fetch_sync(plat, handle)

    tasks = []
    plats_to_fetch = []
    for plat in ["facebook", "instagram", "twitter", "youtube"]:
        info = pm.get(plat) if isinstance(pm.get(plat), dict) else {}
        handle = str(info.get("handle") or "").strip()
        if handle and plat in ["facebook", "instagram", "youtube"]:
            plats_to_fetch.append(plat)
            tasks.append(fetch_platform(plat, handle))
            
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    failed_plats = []
    for idx, plat in enumerate(plats_to_fetch):
        res = results[idx]
        if isinstance(res, dict):
            existing = pm.get(plat) if isinstance(pm.get(plat), dict) else {}
            pm[plat] = {**existing, **res, "last_synced": now_iso()}
        else:
            failed_plats.append(plat)
            print(f"Apify fetch failed for {plat}: {res}")
            
    # For unsupported platforms or missing handles:
    for plat in ["facebook", "instagram", "twitter", "youtube"]:
        info = pm.get(plat) if isinstance(pm.get(plat), dict) else {}
        handle = str(info.get("handle") or "").strip()
        if not handle:
            pm[plat] = {"handle": "", "followers": 0, "engagement": 0, "views": 0, "posts": 0}
    
    # 2. Update Historical Data (stop mocking fake growth)
    monthly_data = current.get("monthly_analytics") or []
    if not monthly_data or len(monthly_data) > 12:
        # Just keep the most recent if it exists, otherwise empty
        monthly_data = []
        
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {"platform_metrics": pm, "monthly_analytics": monthly_data, "analytics_last_synced": now_iso()}}
    )
    
    msg = "Analytics synchronized with external platforms."
    if failed_plats:
        msg = f"Saved handle, but Apify data fetch failed for: {', '.join(failed_plats)}. (Check Render logs or Apify token)"

    return {
        "ok": True if not failed_plats else False, 
        "message": msg,
        "metrics": pm,
        "monthly_analytics": monthly_data
    }

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
            {"username": {"$regex": q, "$options": "i"}},
            {"handle": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
            {"platform_metrics.instagram.handle": {"$regex": q, "$options": "i"}},
            {"platform_metrics.youtube.handle": {"$regex": q, "$options": "i"}},
            {"platform_metrics.twitter.handle": {"$regex": q, "$options": "i"}},
            {"platform_metrics.facebook.handle": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.users.find(filt, {"_id": 0, "password_hash": 0}).limit(limit)
    return await cursor.to_list(length=limit)


@api_router.get("/creators/match")
async def match_creators(current: dict = Depends(get_current_user)):
    await require_role(current, ["owner", "agent", "admin"])
    if current.get("role") == "agent" and not current.get("agent_approved"):
        raise HTTPException(status_code=403, detail="Agent not approved by Admin")
    
    creators = await db.users.find({"role": "influencer"}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    def score(c):
        s = 0
        if current.get("industry") and c.get("niches") and current.get("industry") in c.get("niches"):
            s += 10
        if current.get("city") and current.get("city") == c.get("city"):
            s += 5
        return s
    
    creators.sort(key=score, reverse=True)
    return creators


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
    await require_role(current, ["owner", "agent", "admin"])
    cid = str(uuid.uuid4())
    cover_url = inp.cover or "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=1200"
    doc = {
        "id": cid, "owner_id": current["id"], "title": inp.title, "brand": inp.brand or current.get("company") or "Brand Studio",
        "description": inp.description, "budget": inp.budget, "niches": inp.niches or ["General"],
        "platforms": inp.platforms or ["instagram"], "deliverables": inp.deliverables, "deadline": inp.deadline,
        "cover": cover_url, "status": "open", "escrow_funded": 0, "escrow_released": 0,
        "accepted_creator_id": None, "created_at": now_iso(), "applications_count": 0,
        "location": inp.location, "timeline": inp.timeline, "min_followers": inp.min_followers,
        "influencer_location": inp.influencer_location, "influencer_experience": inp.influencer_experience,
        "influencer_type": inp.influencer_type, "min_reach": inp.min_reach, "min_engagement": inp.min_engagement,
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


@api_router.get("/campaigns/match")
async def match_campaigns(current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer", "agent", "admin"])
    if current.get("role") == "agent" and not current.get("agent_approved"):
        raise HTTPException(status_code=403, detail="Agent not approved by Admin")
    
    campaigns = await db.campaigns.find({"status": "open"}, {"_id": 0}).to_list(100)
    
    def score(camp):
        s = 0
        if current.get("niches") and camp.get("niches"):
            common = set(current.get("niches")).intersection(set(camp.get("niches")))
            s += len(common) * 10
        return s
    
    campaigns.sort(key=score, reverse=True)
    return campaigns


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
        await push_notification(
            camp["owner_id"], "application",
            f"{current['name']} pitched your brief \"{camp['title']}\".",
            {"campaign_id": camp["id"], "application_id": doc["id"]},
        )
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
    if camp["owner_id"] != current["id"] and current.get("role") not in ("admin",):
        # Agent co-owners / brand teammates who own the campaign via owner_id already pass.
        # Influencers get their own application via /applications/mine — not a list of peers.
        raise HTTPException(status_code=403, detail="You don’t have permission to view applications for this brief.")
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
    # In-app notify creator
    await push_notification(
        app_doc["influencer_id"], "application_accepted",
        f"{camp['brand']} accepted your pitch for {camp['title']}.",
        {"campaign_id": camp["id"]},
    )
    # Auto-generate a draft contract
    await _create_contract(camp, app_doc["influencer_id"], app_doc["rate"])
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
    await push_notification(
        inp.creator_id, "invitation",
        f"{camp['brand']} invited you to \"{camp['title']}\" — offer ${inp.offer}.",
        {"campaign_id": camp["id"], "invitation_id": doc["id"]},
    )
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
    user_id = current["id"]
    if current["role"] == "influencer":
        invs = await db.invitations.find({"creator_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    elif current["role"] == "owner":
        invs = await db.invitations.find({"$or": [{"owner_id": user_id}, {"brand_id": user_id}]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        invs = []

    if not invs:
        try:
            from mock_comms import seed_mock_comms
            await seed_mock_comms(db, logger=logger)
        except Exception as e:
            logger.warning("mock invitation seed failed: %s", e)
        if current["role"] == "influencer":
            invs = await db.invitations.find({"creator_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
        elif current["role"] == "owner":
            invs = await db.invitations.find({"$or": [{"owner_id": user_id}, {"brand_id": user_id}]}, {"_id": 0}).sort("created_at", -1).to_list(200)
        
    if not invs:
        return []

    # Batch lookup campaigns & creators in 2 parallel queries instead of sequential loop queries
    camp_ids = list(set(i.get("campaign_id") for i in invs if i.get("campaign_id")))
    creator_ids = list(set(i.get("creator_id") for i in invs if i.get("creator_id")))

    camps_list, creators_list = await asyncio.gather(
        db.campaigns.find({"id": {"$in": camp_ids}}, {"_id": 0, "id": 1, "title": 1, "brand": 1, "budget": 1}).to_list(200),
        db.users.find({"id": {"$in": creator_ids}}, {"_id": 0, "id": 1, "name": 1, "handle": 1, "avatar": 1}).to_list(200)
    )

    camps_map = {c["id"]: c for c in camps_list}
    creators_map = {u["id"]: u for u in creators_list}

    for i in invs:
        camp = camps_map.get(i.get("campaign_id"))
        if camp:
            i["campaign_title"] = camp.get("title") or i.get("campaign_title") or "Untitled Brief"
            i["campaign_brand"] = camp.get("brand") or i.get("campaign_brand") or "Brand Studio"
            if not i.get("offer"):
                i["offer"] = camp.get("budget") or 15000
        
        if not i.get("offer"):
            i["offer"] = 15000

        creator = creators_map.get(i.get("creator_id"))
        if creator:
            i["creator_name"] = creator.get("name") or i.get("creator_name")
            i["creator_handle"] = creator.get("handle") or i.get("creator_handle")
            i["creator_avatar"] = creator.get("avatar") or i.get("creator_avatar")
            
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


# ---------- Social actions (module-level models → reliable JSON body on Render) ----------
@api_router.post("/follow")
async def follow_user_core(inp: SocialUserRef, current: dict = Depends(get_current_user)):
    if inp.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = await db.users.find_one({"id": inp.user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    status = "pending" if target.get("is_private") else "accepted"
    await db.follows.update_one(
        {"follower_id": current["id"], "following_id": inp.user_id},
        {"$set": {
            "id": str(uuid.uuid4()),
            "follower_id": current["id"],
            "following_id": inp.user_id,
            "status": status,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True, "status": status}


@api_router.post("/unfollow")
async def unfollow_user_core(inp: SocialUserRef, current: dict = Depends(get_current_user)):
    await db.follows.delete_one({"follower_id": current["id"], "following_id": inp.user_id})
    return {"ok": True}


@api_router.post("/conversations/dm")
async def open_dm_core(inp: SocialUserRef, current: dict = Depends(get_current_user)):
    if inp.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")
    existing = await db.conversations.find_one({
        "kind": "dm",
        "participant_ids": {"$all": [current["id"], inp.user_id]},
    })
    if existing:
        existing.pop("_id", None)
        return existing
    other = await db.users.find_one(
        {"id": inp.user_id},
        {"name": 1, "company": 1, "username": 1, "handle": 1},
    )
    label = (
        (other or {}).get("username")
        or (other or {}).get("handle")
        or (other or {}).get("company")
        or (other or {}).get("name")
        or "DM"
    )
    if isinstance(label, str):
        label = label.lstrip("@").rstrip(".,")
    cid = str(uuid.uuid4())
    doc = {
        "id": cid,
        "kind": "dm",
        "participant_ids": [current["id"], inp.user_id],
        "owner_id": current["id"],
        "creator_id": inp.user_id,
        "campaign_title": "Direct Message",
        "campaign_brand": label,
        "created_at": now_iso(),
        "last_at": now_iso(),
        "pinned": False,
        "archived_by": [],
    }
    await db.conversations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/privacy/block")
async def block_user_core(inp: SocialUserRef, current: dict = Depends(get_current_user)):
    if inp.user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    await db.blocks.update_one(
        {"blocker_id": current["id"], "blocked_id": inp.user_id},
        {"$set": {
            "id": str(uuid.uuid4()),
            "blocker_id": current["id"],
            "blocked_id": inp.user_id,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    await db.follows.delete_many({"$or": [
        {"follower_id": current["id"], "following_id": inp.user_id},
        {"follower_id": inp.user_id, "following_id": current["id"]},
    ]})
    return {"ok": True}


@api_router.post("/reports")
async def create_report_core(inp: SocialReportIn, current: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "reporter_id": current["id"],
        "target_type": inp.target_type,
        "target_id": inp.target_id,
        "reason": inp.reason,
        "details": inp.details,
        "status": "open",
        "created_at": now_iso(),
    }
    await db.reports.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/conversations")
async def list_conversations(current: dict = Depends(get_current_user)):
    user_id = current["id"]
    role = current["role"]

    if role == "admin":
        q = {}
    else:
        q = {
            "$or": [
                {"owner_id": user_id},
                {"creator_id": user_id},
                {"brand_id": user_id},
                {"agent_id": user_id},
                {"participant_ids": user_id}
            ]
        }
    convos = await db.conversations.find(q, {"_id": 0}).sort("last_at", -1).to_list(200)
    if not convos:
        try:
            from mock_comms import ensure_mock_comms_if_empty
            seeded = await ensure_mock_comms_if_empty(db, current, logger=logger)
            if seeded:
                convos = await db.conversations.find(q, {"_id": 0}).sort("last_at", -1).to_list(200)
        except Exception as e:
            logger.warning("mock conversation seed failed: %s", e)
    if not convos:
        return []

    # Batch gather ids
    camp_ids = list(set(c.get("campaign_id") for c in convos if c.get("campaign_id")))
    
    other_ids = set()
    for c in convos:
        participants = c.get("participant_ids") or [c.get("owner_id"), c.get("creator_id")]
        for pid in participants:
            if pid and pid != user_id:
                other_ids.add(pid)

    camps_list, users_list = await asyncio.gather(
        db.campaigns.find({"id": {"$in": camp_ids}}, {"_id": 0, "id": 1, "title": 1, "brand": 1}).to_list(200),
        db.users.find({"id": {"$in": list(other_ids)}}, {"_id": 0, "id": 1, "name": 1, "username": 1, "handle": 1, "avatar": 1, "company": 1, "role": 1}).to_list(200)
    )

    camps_map = {c["id"]: c for c in camps_list}
    users_map = {u["id"]: u for u in users_list}

    # Parallel lookup last messages for convos
    async def fetch_last_msg(cid):
        m = await db.messages.find({"conversation_id": cid}, {"_id": 0, "content": 1}).sort("created_at", -1).limit(1).to_list(1)
        return cid, m[0]["content"] if m else None

    last_msgs = await asyncio.gather(*[fetch_last_msg(c["id"]) for c in convos[:50]])
    last_msg_map = dict(last_msgs)

    for c in convos:
        camp = camps_map.get(c.get("campaign_id"))
        if camp:
            c["campaign_title"] = camp.get("title") or c.get("campaign_title") or "Brief Discussion"
            c["campaign_brand"] = camp.get("brand") or c.get("campaign_brand") or "Brand Studio"
        else:
            c["campaign_title"] = c.get("campaign_title") or "Brief Discussion"
            c["campaign_brand"] = c.get("campaign_brand") or "Brand Studio"

        participants = c.get("participant_ids") or [c.get("owner_id"), c.get("creator_id")]
        other_id = next((pid for pid in participants if pid and pid != user_id), None)
        other = users_map.get(other_id)
        if other:
            uname = (other.get("username") or other.get("handle") or "").lstrip("@").rstrip(".,")
            role = other.get("role")
            company = (other.get("company") or "").strip() or None
            if role in ("owner", "agent") and company:
                display = company
            else:
                display = uname or company or other.get("name") or "User"
            c["other_name"] = display
            c["other_handle"] = uname or company or "partner"
            c["other_company"] = company
            c["other_role"] = role
            c["other_avatar"] = other.get("avatar")
        else:
            c["other_name"] = c.get("campaign_brand") or "Platform Partner"
            
        c["last_message"] = last_msg_map.get(c["id"])

    return convos


@api_router.get("/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: str, current: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id = current["id"]
    if current["role"] != "admin" and user_id not in (convo.get("owner_id"), convo.get("creator_id"), convo.get("brand_id"), convo.get("agent_id")) and user_id not in convo.get("participant_ids", []):
        raise HTTPException(status_code=403, detail="Forbidden")
    return await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, inp: MessageCreate, current: dict = Depends(get_current_user)):
    convo = await db.conversations.find_one({"id": conversation_id})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id = current["id"]
    if current["role"] != "admin" and user_id not in (convo.get("owner_id"), convo.get("creator_id"), convo.get("brand_id"), convo.get("agent_id")) and user_id not in convo.get("participant_ids", []):
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = {
        "id": str(uuid.uuid4()), "conversation_id": conversation_id, "sender_id": current["id"],
        "sender_name": current["name"], "sender_role": current["role"],
        "content": inp.content or "", "media_url": inp.media_url, "media_type": inp.media_type,
        "reply_to_id": inp.reply_to_id, "created_at": now_iso(),
        "read_by": [current["id"]], "edited": False, "deleted": False,
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
    # Notify owner & schedule AI review
    await push_notification(
        camp["owner_id"], "deliverable_submitted",
        f"{current['name']} submitted a {inp.kind} for {camp['title']}.",
        {"campaign_id": camp["id"], "deliverable_id": doc["id"]},
    )
    asyncio.create_task(ai_review_deliverable(doc["id"], camp))
    return doc


@api_router.get("/campaigns/{campaign_id}/deliverables")
async def list_deliverables(campaign_id: str, current: dict = Depends(get_current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    is_party = (
        camp["owner_id"] == current["id"]
        or camp.get("accepted_creator_id") == current["id"]
        or current.get("role") == "admin"
    )
    # Influencers may open a brand offer to apply — return empty instead of Forbidden.
    if not is_party:
        if current.get("role") == "influencer":
            return []
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
    user_doc = await db.users.find_one({"id": current["id"]}, {"_id": 0, "wallet": 1, "transactions": 1, "role": 1, "company": 1, "name": 1})
    balance = user_doc.get("wallet", 0) if user_doc else current.get("wallet", 50000)
    txs = user_doc.get("transactions", []) if user_doc else []

    db_txs = await db.wallet_tx.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    if db_txs:
        existing_ids = set(t.get("id") for t in txs)
        for dt in db_txs:
            if dt.get("id") not in existing_ids:
                txs.append(dt)
        txs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    if not txs:
        role = current.get("role", "influencer")
        name = current.get("name", "User")
        company = current.get("company", name)
        
        if role == "admin":
            balance = 5000000
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 450000, "kind": "Platform Commission", "note": "5% Escrow commission on Q3 Brand briefs", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 750000, "kind": "Enterprise Settlement", "note": "Audit Clearance for boAt & Studio Noir briefs", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -120000, "kind": "Server Maintenance", "note": "Cloud infrastructure & Anthropic AI hosting payout", "created_at": now_iso()}
            ]
        elif role == "owner":
            balance = balance or 1800000
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 750000, "kind": "Vault Deposit", "note": f"Direct Deposit to {company} Campaign Wallet", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -150000, "kind": "Escrow Funding", "note": "Escrow locked for Summer Launch campaign", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -65000, "kind": "Creator Payout", "note": "Milestone release for approved video reel", "created_at": now_iso()}
            ]
        elif role == "agent":
            balance = balance or 650000
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 250000, "kind": "Agency Commission", "note": f"15% Management Dividend for {company} roster deals", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 120000, "kind": "Brand Settlement", "note": "Escrow payment release for talent deliverables", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -45000, "kind": "Bank Payout", "note": "Withdrawal transfer to corporate bank account", "created_at": now_iso()}
            ]
        else:
            balance = balance or 85000
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 45000, "kind": "Campaign Earnings", "note": "Approved deliverable payment for Instagram Reel", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 20000, "kind": "Brand Incentive", "note": "Bonus payout for high engagement metric benchmark", "created_at": now_iso()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -15000, "kind": "Bank Withdrawal", "note": "Payout transfer to verified UPI account", "created_at": now_iso()}
            ]
        
        await db.users.update_one({"id": current["id"]}, {"$set": {"wallet": balance, "transactions": txs}})

    return {"balance": balance, "transactions": txs}


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


@api_router.post("/admin/ai-pitch")
async def admin_generate_ai_pitch(inp: AdminAIPitchInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    creator = await db.users.find_one({"id": inp.influencer_id, "role": "influencer"})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    system = "You are an elite talent agent representing high-end influencers."
    prompt = f"""
Draft a compelling, visually-focused email pitch to send to a {inp.target_role} (a brand or agent) to represent this creator.
Keep it punchy, luxurious, and focused on their aesthetic portfolio and metrics.

Creator Info:
Name: {creator.get("name")}
Handle: {creator.get("handle")}
Bio: {creator.get("bio")}
Niches: {', '.join(creator.get("niches", []))}
Followers: {creator.get("followers")}

Return a JSON object with:
"subject": (The email subject line)
"body": (The body text of the pitch)
"""
    try:
        text = await call_llm(system, prompt)
        res = parse_json(text)
        return res
    except Exception as e:
        logger.error(f"Pitch generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate pitch")

@api_router.post("/admin/send-pitch")
async def admin_send_pitch(inp: SendPitchInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    # In a real app, integrate SendGrid or AWS SES here
    print(f"\n{'='*40}\n[MOCK EMAIL SENT TO {inp.target_email}]\nSubject: {inp.subject}\n\n{inp.body}\n{'='*40}\n")
    return {"ok": True}


# ---------- Stats ----------
@api_router.get("/stats")
async def stats():
    return {
        "creators": await db.users.count_documents({"role": "influencer"}),
        "owners": await db.users.count_documents({"role": "owner"}),
        "agents": await db.users.count_documents({"role": "agent"}),
        "campaigns": await db.campaigns.count_documents({}),
    }


@api_router.get("/agents/public")
async def public_agents():
    agents = await db.users.find(
        {"role": "agent"},
        {"_id": 0, "id": 1, "name": 1, "company": 1, "bio": 1, "avatar": 1, "industry": 1, "location": 1, "niches": 1, "city": 1, "state": 1, "website": 1, "agent_approved": 1}
    ).to_list(20)
    return agents


@api_router.get("/")
async def root():
    return {"name": "CR8 API", "status": "ok"}


# ---------- AI ----------
HARDCODED_BIO_MARKERS = (
    "curating high-end aesthetics",
    "focus on luxury and design",
    "luxury, design, and editorial storytelling",
)


def is_hardcoded_luxury_bio(bio: Optional[str]) -> bool:
    text = (bio or "").strip().lower()
    if not text:
        return False
    return any(m in text for m in HARDCODED_BIO_MARKERS)


def build_local_profile_bio(
    *,
    niches: Optional[List[str]] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    name: Optional[str] = None,
    username: Optional[str] = None,
    handle: Optional[str] = None,
) -> str:
    """Deterministic bio from category + location — never luxury fashion filler."""
    clean_niches = [str(n).strip() for n in (niches or []) if n and str(n).strip()]
    loc_parts = [p for p in [(city or "").strip(), (state or "").strip()] if p]
    loc = ", ".join(loc_parts) if loc_parts else "India"
    who = (name or "").strip() or (handle or "").strip().lstrip("@").rstrip(".,") or ((username or "").strip().lstrip("@").rstrip(".,") or "Creator")

    if not clean_niches:
        return f"{who} creates authentic content from {loc}."

    if len(clean_niches) == 1:
        focus = clean_niches[0]
        focus_phrase = focus
    elif len(clean_niches) == 2:
        focus = f"{clean_niches[0]} and {clean_niches[1]}"
        focus_phrase = focus
    else:
        focus = f"{', '.join(clean_niches[:-1])}, and {clean_niches[-1]}"
        focus_phrase = focus

    seed = sum(ord(c) for c in f"{who}|{focus}|{loc}".lower())
    variants = [
        f"{who} — specializing in {focus_phrase}, based in {loc}.",
        f"Based in {loc}, {who} creates content around {focus_phrase}.",
        f"{who} is a {focus_phrase} creator sharing work from {loc}.",
        f"From {loc}, {who} focuses on {focus_phrase} for brands and audiences.",
        f"{who} builds {focus_phrase} stories and collaborations out of {loc}.",
    ]
    return variants[seed % len(variants)]


async def call_llm(system: str, prompt: str) -> str:
    """Try Anthropic first, then Gemini (GEMINI_API_KEY / EMERGENT_LLM_KEY)."""
    import httpx

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        headers = {
            "x-api-key": anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        last_err = None
        for model_name in (
            "claude-haiku-4-5-20251001",
            "claude-haiku-4-5",
            "claude-3-5-haiku-latest",
            "claude-3-haiku-20240307",
        ):
            payload = {
                "model": model_name,
                "max_tokens": 1000,
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            }
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers=headers,
                        json=payload,
                        timeout=30.0,
                    )
                    response.raise_for_status()
                    data = response.json()
                    text = (data.get("content") or [{}])[0].get("text") or ""
                    if text.strip():
                        return text
            except Exception as e:
                last_err = e
                logger.warning("Anthropic model %s failed: %s", model_name, e)
        if last_err:
            logger.warning("Anthropic API error: %s", last_err)

    gemini_key = EMERGENT_LLM_KEY or os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=gemini_key)
            last_err = None
            for model_name in ("gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"):
                try:
                    model = genai.GenerativeModel(
                        model_name,
                        system_instruction=system,
                    )
                    result = await asyncio.to_thread(
                        model.generate_content,
                        prompt,
                    )
                    text = getattr(result, "text", None) or ""
                    if text.strip():
                        return text
                except Exception as e:
                    last_err = e
                    logger.warning("Gemini model %s failed: %s", model_name, e)
            if last_err:
                raise last_err
        except Exception as e:
            logger.warning("Gemini API error: %s", e)

    if "JSON" in prompt.upper() or "JSON" in system.upper() or "{" in prompt:
        return '{"pitch": "Mock pitch.", "bio": "Mock bio.", "summary": "Mock summary.", "platforms": ["instagram"], "estimated_reach": "100K", "score": 85, "reason": "Good match"}'
    
    return "This is a mock AI response because no LLM API keys (Anthropic/Gemini) are configured in the server environment. Please add ANTHROPIC_API_KEY or GEMINI_API_KEY in Render to enable real AI generation."

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
        " \"platforms\": string[] (2-3 from: instagram, facebook, youtube, twitter)}"
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
ALLOWED_VIDEO = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_DOC = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
}
ALLOWED_UPLOAD = ALLOWED_IMAGE | ALLOWED_VIDEO | ALLOWED_DOC
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB (images + short video + office docs)


@api_router.post("/uploads")
async def upload_file(file: UploadFile = File(...), current: dict = Depends(get_current_user)):
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    # Some browsers send empty/octet-stream for office docs — infer from filename
    name = (file.filename or "").lower()
    if ctype not in ALLOWED_UPLOAD:
        if name.endswith(".pdf"):
            ctype = "application/pdf"
        elif name.endswith(".doc"):
            ctype = "application/msword"
        elif name.endswith(".docx"):
            ctype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif name.endswith(".xls"):
            ctype = "application/vnd.ms-excel"
        elif name.endswith(".xlsx"):
            ctype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif name.endswith(".csv"):
            ctype = "text/csv"
        elif name.endswith(".txt"):
            ctype = "text/plain"
    if ctype not in ALLOWED_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail="Only images, video, PDF, Word, Excel, or CSV up to 50MB",
        )
    ext = mimetypes.guess_extension(ctype) or (
        ".pdf" if ctype == "application/pdf" else
        ".docx" if "wordprocessingml" in ctype else
        ".xlsx" if "spreadsheetml" in ctype else
        ".doc" if ctype == "application/msword" else
        ".xls" if ctype == "application/vnd.ms-excel" else
        ".bin"
    )
    fid = f"{uuid.uuid4().hex}{ext}"
    chunks = []
    size = 0
    while chunk := await file.read(1024 * 64):
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File too large (max 50MB)")
        chunks.append(chunk)
    raw = b"".join(chunks)
    await store_upload_bytes(fid, raw, ctype)
    if ctype in ALLOWED_VIDEO:
        media_type = "video"
    elif ctype in ALLOWED_IMAGE:
        media_type = "image"
    else:
        media_type = "document"
    return {"id": fid, "url": f"/api/uploads/{fid}", "media_type": media_type, "size": size, "content_type": ctype, "filename": file.filename}


@api_router.get("/uploads/{file_id}")
async def get_upload(file_id: str):
    data, content_type = await load_upload_bytes(file_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )


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
    user_id = current["id"]

    (
        applied,
        accepted,
        invited,
        delivs,
        approved,
        my_apps,
        reviews
    ) = await asyncio.gather(
        db.applications.count_documents({"influencer_id": user_id}),
        db.applications.count_documents({"influencer_id": user_id, "status": "accepted"}),
        db.invitations.count_documents({"creator_id": user_id}),
        db.deliverables.count_documents({"creator_id": user_id}),
        db.deliverables.count_documents({"creator_id": user_id, "status": "approved"}),
        db.applications.find({"influencer_id": user_id, "status": "accepted"}, {"_id": 0, "rate": 1}).to_list(200),
        db.reviews.find({"target_id": user_id}, {"_id": 0, "rating": 1}).to_list(500)
    )

    avg_rating = (sum(r["rating"] for r in reviews) / len(reviews)) if reviews else 0
    earned = current.get("wallet", 0)
    contracted = sum(a.get("rate") or 0 for a in my_apps)

    pm = current.get("platform_metrics") if isinstance(current.get("platform_metrics"), dict) else {}
    social_followers = 0
    social_views = 0
    social_posts = 0
    engagement_vals = []
    for row in pm.values():
        if not isinstance(row, dict) or not str(row.get("handle") or "").strip():
            continue
        try:
            social_followers += int(float(row.get("followers") or row.get("subscribers") or 0))
        except (TypeError, ValueError):
            pass
        try:
            social_views += int(float(row.get("views") or 0))
        except (TypeError, ValueError):
            pass
        try:
            social_posts += int(float(row.get("posts") or 0))
        except (TypeError, ValueError):
            pass
        try:
            er = float(row.get("engagement") if row.get("engagement") is not None else row.get("er") or 0)
        except (TypeError, ValueError):
            er = 0.0
        if er > 0:
            engagement_vals.append(er)

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
        "followers": social_followers,
        "views": social_views,
        "posts": social_posts,
        "avg_engagement": round(sum(engagement_vals) / len(engagement_vals), 2) if engagement_vals else 0,
        "platform_metrics": pm,
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




# ---------- Notifications ----------
async def push_notification(user_id: str, kind: str, text: str, meta: Optional[dict] = None) -> None:
    doc = {
        "id": str(uuid.uuid4()), "user_id": user_id, "kind": kind, "text": text,
        "meta": meta or {}, "read": False, "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)


@api_router.get("/notifications")
async def list_notifications(current: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    unread = await db.notifications.count_documents({"user_id": current["id"], "read": False})
    return {"items": items, "unread": unread}


@api_router.post("/notifications/read")
async def mark_read_all(current: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.post("/notifications/{notification_id}/read")
async def mark_read_one(notification_id: str, current: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id, "user_id": current["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Contracts ----------
async def _create_contract(camp: dict, creator_id: str, rate: int) -> dict:
    existing = await db.contracts.find_one({"campaign_id": camp["id"], "creator_id": creator_id})
    if existing:
        return {k: v for k, v in existing.items() if k != "_id"}
    creator = await db.users.find_one({"id": creator_id}, {"_id": 0, "name": 1, "handle": 1, "email": 1})
    owner = await db.users.find_one({"id": camp["owner_id"]}, {"_id": 0, "name": 1, "company": 1, "email": 1})
    body = (
        f"This agreement is entered between {owner.get('company') or owner.get('name')} (\"Brand\") "
        f"and {creator.get('name')} {creator.get('handle') or ''} (\"Creator\") on the CR8 Studio platform.\n\n"
        f"CAMPAIGN: {camp['title']} — {camp['brand']}\n"
        f"BRIEF: {camp['description']}\n\n"
        f"DELIVERABLES: {camp['deliverables']}\n\n"
        f"COMPENSATION: The Brand agrees to pay the Creator ${rate} USD upon acceptance of the "
        f"final deliverables, held in CR8 studio escrow until release.\n\n"
        f"TIMELINE: Deliverables due by {camp.get('deadline') or 'a mutually agreed date'}.\n\n"
        f"REVISIONS: Up to two rounds of revision requests may be issued. Further revisions "
        f"require additional compensation.\n\n"
        f"USAGE RIGHTS: The Brand receives a 12-month, non-exclusive license to use the "
        f"delivered assets across owned channels. Whitelisting or paid amplification requires "
        f"separate written consent.\n\n"
        f"CONFIDENTIALITY: Both parties agree to keep any non-public information exchanged "
        f"through this collaboration confidential.\n\n"
        f"DISCLOSURE: The Creator will comply with FTC disclosure requirements (#ad or "
        f"#sponsored) on all deliverables.\n\n"
        f"By signing below, both parties agree to the terms above."
    )
    doc = {
        "id": str(uuid.uuid4()), "campaign_id": camp["id"], "creator_id": creator_id,
        "owner_id": camp["owner_id"], "rate": rate, "body": body, "status": "draft",
        "signed_by_owner": None, "signed_by_creator": None,
        "signature_owner": None, "signature_creator": None,
        "created_at": now_iso(),
    }
    await db.contracts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/campaigns/{campaign_id}/contract")
async def get_contract(campaign_id: str, current: dict = Depends(get_current_user)):
    contract = await db.contracts.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="No contract yet")
    if current["id"] not in (contract["owner_id"], contract["creator_id"]) and current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return contract


@api_router.post("/contracts/{contract_id}/sign")
async def sign_contract(contract_id: str, inp: ContractSign, current: dict = Depends(get_current_user)):
    contract = await db.contracts.find_one({"id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if inp.signed_by == "owner" and current["id"] != contract["owner_id"]:
        raise HTTPException(status_code=403, detail="Only the brand can sign as owner")
    if inp.signed_by == "creator" and current["id"] != contract["creator_id"]:
        raise HTTPException(status_code=403, detail="Only the creator can sign as creator")
    update: Dict[str, Any] = {
        f"signed_by_{inp.signed_by}": now_iso(),
        f"signature_{inp.signed_by}": inp.signature_name,
    }
    fresh = {**contract, **update}
    if fresh.get("signed_by_owner") and fresh.get("signed_by_creator"):
        update["status"] = "executed"
    await db.contracts.update_one({"id": contract_id}, {"$set": update})
    # Notify the other side
    other_id = contract["creator_id"] if inp.signed_by == "owner" else contract["owner_id"]
    await push_notification(
        other_id, "contract_signed",
        f"{inp.signature_name} signed the contract for a campaign.",
        {"campaign_id": contract["campaign_id"], "contract_id": contract_id},
    )
    return {"ok": True, "status": update.get("status", contract["status"])}


# ---------- Password reset & email verification ----------
_reset_tokens: Dict[str, dict] = {}  # in-memory; token -> {user_id, expires_at}
_verify_tokens: Dict[str, dict] = {}


@api_router.post("/auth/forgot-password")
async def forgot_password(inp: PasswordResetRequest):
    user = await db.users.find_one({"email": inp.email.lower()})
    # Do not disclose whether email exists; always 200.
    if user:
        token = uuid.uuid4().hex
        _reset_tokens[token] = {"user_id": user["id"], "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()}
        base = os.environ.get("FRONTEND_URL", "https://naresh-palle.github.io/Project2-Social")
        link = f"{base}/#/reset-password?token={token}"
        asyncio.create_task(send_email(
            user["email"],
            "CR8 — reset your password",
            email_template(
                "Reset your password.",
                f'<p>Someone (hopefully you) requested a password reset. '
                f'This link expires in 2 hours. Ignore this email if it wasn\'t you.</p>'
                f'<p style="font-family:monospace;font-size:11px;opacity:0.7;word-break:break-all">{link}</p>',
                cta_url=link, cta_label="Reset password",
            ),
        ))
    return {"ok": True}


@api_router.post("/auth/reset-password")
async def reset_password(inp: PasswordResetConfirm):
    entry = _reset_tokens.get(inp.token)
    if not entry or entry["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"id": entry["user_id"]}, {"$set": {"password_hash": hash_password(inp.new_password)}})
    _reset_tokens.pop(inp.token, None)
    return {"ok": True}


@api_router.post("/auth/send-verify")
async def send_verify(current: dict = Depends(get_current_user)):
    if current.get("email_verified"):
        return {"ok": True, "already": True}
    token = uuid.uuid4().hex
    _verify_tokens[token] = {"user_id": current["id"], "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()}
    base = os.environ.get("FRONTEND_URL", "https://owner-creator.emergent.host")
    link = f"{base}/verify-email?token={token}"
    asyncio.create_task(send_email(
        current["email"],
        "CR8 — verify your email",
        email_template(
            "Confirm your address.",
            "<p>Tap the button below to confirm this is really you. The link expires in 24 hours.</p>",
            cta_url=link, cta_label="Verify email",
        ),
    ))
    return {"ok": True}


@api_router.post("/auth/verify-email")
async def verify_email(inp: EmailVerifyConfirm):
    entry = _verify_tokens.get(inp.token)
    if not entry or entry["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"id": entry["user_id"]}, {"$set": {"email_verified": True}})
    _verify_tokens.pop(inp.token, None)
    return {"ok": True}


# ---------- AI Creator Copilot ----------
@api_router.post("/ai/pitch")
async def ai_pitch(inp: AIPitchInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    camp = await db.campaigns.find_one({"id": inp.campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    system = ("You are the CR8 AI Creator Copilot — you write short, editorial, sharp "
              "pitches on behalf of the creator. Restraint over hype. First-person voice.")
    prompt = (
        f"Write a 3-4 sentence pitch from {current['name']} ({current.get('handle','')}) "
        f"to {camp['brand']} for campaign: \"{camp['title']}\". "
        f"Creator niches: {current.get('niches',[])}, platforms: {current.get('platforms',[])}, "
        f"followers: {current.get('followers')}, bio: {current.get('bio','')}. "
        f"Brand brief: {camp['description']}. Return ONLY the pitch text, no preamble."
    )
    text = await call_llm(system, prompt)
    return {"pitch": text.strip()}


@api_router.post("/ai/bio")
async def ai_bio(inp: AIBioInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    system = "You are the CR8 AI Creator Copilot. Write concise, editorial creator bios."
    prompt = (
        f"Draft a bio for {current['name']} ({current.get('handle','')}). "
        f"Niches: {current.get('niches',[])}. Platforms: {current.get('platforms',[])}. "
        f"Location: {current.get('location','')}. Followers: {current.get('followers')}. "
        f"Existing bio (may be empty): '{current.get('bio','')}'. "
        f"Tone: {inp.tone}. Maximum 220 characters, single line. Return ONLY the bio text."
    )
    text = await call_llm(system, prompt)
    return {"bio": text.strip().strip('"')}


@api_router.post("/ai/data-report")
async def ai_data_report(current: dict = Depends(get_current_user)):
    """Short narrative summary for the Your Data PDF export (any role)."""
    role = current.get("role") or "member"
    company = (current.get("company") or "").strip()
    name = current.get("name") or current.get("username") or current.get("handle") or "User"
    primary = company if role in ("owner", "agent") and company else name
    niches = current.get("niches") or current.get("category") or []
    if isinstance(niches, str):
        niches = [s.strip() for s in niches.split(",") if s.strip()]
    city = ", ".join([p for p in [current.get("city"), current.get("state")] if p]) or current.get("location") or "unspecified"
    industry = current.get("industry") or ""
    bio = (current.get("bio") or "")[:280]
    system = (
        "You write polished personal-data report executive summaries for CR8 Studio. "
        "2-3 sentences, professional, no JSON, no bullet lists, no invented metrics."
    )
    prompt = (
        f"Write an executive summary for a data-export PDF.\n"
        f"Primary label: {primary}\nRole: {role}\nCompany/Brand: {company or 'n/a'}\n"
        f"Niches/Category: {niches or 'n/a'}\nIndustry: {industry or 'n/a'}\n"
        f"Location: {city}\nExisting bio: {bio or 'n/a'}\n"
        "Return ONLY the summary paragraph."
    )
    try:
        text = await call_llm(system, prompt)
        return {"summary": (text or "").strip().strip('"')}
    except Exception:
        return {"summary": ""}


@api_router.post("/ai/pricing")
async def ai_pricing(inp: AIPricingInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    system = ("You are the CR8 AI Pricing Engine. Return VALID JSON with keys: "
              "recommended (int USD), min (int USD), max (int USD), market_average (int USD), "
              "confidence (int 0-100), rationale (short string).")
    prompt = (
        f"Suggest fair pricing for a single '{inp.kind}' deliverable from creator {current['name']}. "
        f"Followers: {current.get('followers')}. Platforms: {current.get('platforms',[])}. "
        f"Niches: {current.get('niches',[])}. Location: {current.get('location','')}. "
        f"Return ONLY JSON."
    )
    text = await call_llm(system, prompt)
    return parse_json(text)


# ---------- AI Natural Language Search ----------
@api_router.post("/ai/search-creators")
async def ai_search(inp: AISearchInput, current: dict = Depends(get_current_user)):
    system = ("You convert a natural-language creator search into strict JSON filters. "
              "Return ONLY JSON with keys: niches (string[]), platforms (string[]), "
              "min_followers (int|null), max_followers (int|null), location (string|null), "
              "text (string|null — free-text terms). Niches must be from: "
              "fashion, luxury, beauty, tech, design, wellness. Platforms from: "
              "instagram, facebook, youtube, twitter.")
    prompt = f"Query: \"{inp.query}\". Return JSON only."
    text = await call_llm(system, prompt)
    filters = parse_json(text)

    mongo: Dict[str, Any] = {"role": "influencer"}
    if isinstance(filters.get("niches"), list) and filters["niches"]:
        mongo["niches"] = {"$in": filters["niches"]}
    if isinstance(filters.get("platforms"), list) and filters["platforms"]:
        mongo["platforms"] = {"$in": filters["platforms"]}
    follower_range: Dict[str, int] = {}
    if isinstance(filters.get("min_followers"), int):
        follower_range["$gte"] = filters["min_followers"]
    if isinstance(filters.get("max_followers"), int):
        follower_range["$lte"] = filters["max_followers"]
    if follower_range:
        mongo["followers"] = follower_range
    if filters.get("location"):
        mongo["location"] = {"$regex": filters["location"], "$options": "i"}
    if filters.get("text"):
        mongo.setdefault("$or", []).extend([
            {"name": {"$regex": filters["text"], "$options": "i"}},
            {"handle": {"$regex": filters["text"], "$options": "i"}},
            {"bio": {"$regex": filters["text"], "$options": "i"}},
        ])

    creators = await db.users.find(mongo, {"_id": 0, "password_hash": 0}).limit(24).to_list(24)
    return {"filters": filters, "creators": creators}


# ---------- AI Content Review (auto-run on deliverable submit) ----------
async def ai_review_deliverable(deliverable_id: str, camp: dict) -> None:
    d = await db.deliverables.find_one({"id": deliverable_id})
    if not d:
        return
    system = ("You are the CR8 AI Content Review Officer. You judge whether a submitted "
              "creator deliverable is on-brief and FTC-compliant. Return VALID JSON with keys: "
              "on_brief (bool), disclosure_ok (bool), quality (int 0-100), "
              "issues (string[]), notes (string).")
    prompt = (
        f"CAMPAIGN: {camp['brand']} — {camp['title']}. Brief: {camp['description']}. "
        f"Deliverables required: {camp['deliverables']}.\n"
        f"SUBMISSION: kind={d['kind']}, url={d['url']}, caption='{d.get('caption','')}'.\n"
        f"Return ONLY JSON."
    )
    try:
        text = await call_llm(system, prompt)
        ai = parse_json(text)
        await db.deliverables.update_one({"id": deliverable_id}, {"$set": {"ai_review": ai}})
    except Exception as e:
        logger.warning("AI content review failed: %s", e)



class ProfileSuggestInput(BaseModel):
    niches: Optional[List[str]] = None
    handle: Optional[str] = None
    name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    languages: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    experience: Optional[str] = None
    content_types: Optional[List[str]] = None
    platform_metrics: Optional[dict] = None
    base_rate: Optional[int] = None
    response_time: Optional[str] = None
    availability: Optional[str] = None

@api_router.post("/ai/suggest-profile")
async def ai_suggest_profile(inp: ProfileSuggestInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])

    # Prefer request niches; fall back to saved account niches/category.
    # Keep real platform categories (incl. Lifestyle & Home). Only drop empty/vague placeholders.
    def _keep_niche(n) -> bool:
        t = str(n or "").strip().lower()
        return bool(t) and t not in ("general", "n/a", "na", "none", "null")

    niches = [str(n).strip() for n in (inp.niches or []) if _keep_niche(n)]
    if not niches:
        saved = current.get("category") or current.get("niches") or []
        if isinstance(saved, str):
            saved = [s.strip() for s in saved.split(",") if s.strip()]
        niches = [str(n).strip() for n in saved if _keep_niche(n)]

    city = (inp.city or current.get("city") or "").strip() or None
    state = (inp.state or current.get("state") or "").strip() or None
    if not niches and not city:
        raise HTTPException(
            status_code=400,
            detail="Select at least one Content Niche or ensure City is set from signup before using AI Curation.",
        )

    handle_str = inp.handle or (f"@{inp.username}" if inp.username else current.get("handle") or "the creator")
    name_str = inp.name or current.get("name") or handle_str
    lang_str = ", ".join(inp.languages or current.get("languages") or []) or "the languages they listed"
    loc_str = ", ".join([p for p in [city, state] if p]) or "their location"
    niches_str = ", ".join(niches) if niches else "their stated specialty"
    exp_str = inp.experience or current.get("experience") or "their experience level"
    types_str = ", ".join(inp.content_types or current.get("content_types") or []) or "the content formats they create"

    platforms = []
    pm = inp.platform_metrics or current.get("platform_metrics") or {}
    if isinstance(pm, dict):
        for p, d in pm.items():
            if d and isinstance(d, dict) and d.get("handle"):
                platforms.append(f"{p} ({d.get('handle')})")
    plat_str = ", ".join(platforms) if platforms else "their connected platforms"

    local_bio = build_local_profile_bio(
        niches=niches,
        city=city,
        state=state,
        name=name_str,
        username=inp.username or current.get("username"),
        handle=handle_str,
    )

    system = (
        "You write short creator bios from the user's niches and location only. "
        "Never invent Fashion, luxury, or high-end aesthetics unless those niches were provided."
    )
    prompt = (
        f"Generate a profile bio using ONLY this data.\n"
        f"Name: {name_str}\nHandle: {handle_str}\n"
        f"Niches/Categories: {niches_str}\nLocation: {loc_str}\nLanguages: {lang_str}\n"
        f"Experience: {exp_str}\nContent types: {types_str}\nPlatforms: {plat_str}\n\n"
        "Return ONLY JSON:\n"
        "{\n"
        '  "bio": "1-2 sentences that MUST mention the niches and the location",\n'
        '  "category": ["same niches as input"],\n'
        '  "languages": ["..."],\n'
        '  "experience": "...",\n'
        '  "content_types": ["..."],\n'
        '  "response_time": "Within 24 hours",\n'
        '  "availability": "Immediately"\n'
        "}\n"
        "Forbidden phrases: 'Curating high-end aesthetics', 'luxury and design', "
        "'editorial storytelling' unless luxury/fashion niches were listed."
    )

    data: dict = {}
    try:
        text = await call_llm(system, prompt)
        data = parse_json(text)
        if not isinstance(data, dict):
            data = {}
    except Exception as e:
        logger.warning("AI profile suggestion failed: %s", repr(e))
        data = {}

    bio = (data.get("bio") or "").strip() if isinstance(data, dict) else ""
    # Drop hard-coded / off-brief luxury filler and anything that ignores niches
    if is_hardcoded_luxury_bio(bio) or not bio or bio == data.get("raw"):
        bio = local_bio
    else:
        # Soft check: if niches provided, at least one niche keyword should appear
        if niches:
            lowered = bio.lower()
            if not any(str(n).split("&")[0].strip().lower()[:6] in lowered for n in niches):
                bio = local_bio

    out = {
        "bio": bio,
        "category": niches or data.get("category"),
        "languages": inp.languages or data.get("languages") or current.get("languages"),
        "experience": inp.experience or data.get("experience") or current.get("experience"),
        "content_types": inp.content_types or data.get("content_types") or current.get("content_types"),
        "response_time": inp.response_time or data.get("response_time") or "Within 24 hours",
        "availability": inp.availability or data.get("availability") or "Immediately",
        "portfolio": [],
        "source": "ai" if bio != local_bio else "local",
    }
    return out


# ---------- Social OAuth & Sync ----------
oauth_key = os.environ.get("OAUTH_ENCRYPTION_KEY")
cipher_suite = Fernet(oauth_key.encode()) if oauth_key else None

def encrypt_token(token: str) -> str:
    if not cipher_suite: return token
    return cipher_suite.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not cipher_suite: return encrypted_token
    return cipher_suite.decrypt(encrypted_token.encode()).decode()

# In a real application, you would implement the official OAuth routes here
# e.g., @api_router.get("/oauth/{platform}/login")
# e.g., @api_router.get("/oauth/{platform}/callback")




# ---------- Startup ----------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@cr8.studio").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"$or": [{"email": admin_email}, {"username": "admin"}]})
    if not existing:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": admin_email,
            "username": "admin",
            "password_hash": hash_password(admin_password),
            "name": "Super Admin",
            "role": "admin",
            "handle": "@admin",
            "company": "CR8 Studio",
            "bio": "Super Administrator Access",
            "avatar": None, "niches": [], "followers": None, "platforms": [],
            "location": None, "industry": None, "website": None,
            "portfolio": [], "rate_card": {}, "verified": True, "wallet": 100000,
            "onboarding_status": "completed",
            "agent_approved": True,
            "created_at": now_iso(),
        })
        logger.info("Created Super Admin user (%s / admin)", admin_email)
    else:
        user_id = existing.get("id") or str(existing["_id"])
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "id": user_id,
                "email": admin_email,
                "username": "admin",
                "role": "admin",
                "password_hash": hash_password(admin_password),
                "verified": True,
                "onboarding_status": "completed",
                "agent_approved": True
            }}
        )
        logger.info("Updated Super Admin user (%s / admin)", admin_email)

async def seed_demo():

    # Mock Reports
    if await db.reports.count_documents({}) == 0:
        reports = [
            {"id": "rep_1", "target_type": "user", "target_id": "test_creator", "reason": "Spam profile", "status": "open", "created_at": now_iso()},
            {"id": "rep_2", "target_type": "campaign", "target_id": "camp_1", "reason": "Fraudulent job posting", "status": "open", "created_at": now_iso()},
            {"id": "rep_3", "target_type": "user", "target_id": "test_agency", "reason": "Fake credentials", "status": "open", "created_at": now_iso()},
            {"id": "rep_4", "target_type": "campaign", "target_id": "camp_2", "reason": "Inappropriate content", "status": "resolved", "created_at": now_iso()}
        ]
        await db.reports.insert_many(reports)

    demo_password_hash = hash_password("demo1234")
    
    seed_emails = ["creator@cr8.studio", "company@cr8.studio", "agent@cr8.studio"]
    for em in seed_emails:
        await db.users.update_many({"email": em}, {"$set": {"password_hash": demo_password_hash}})

    if await db.users.count_documents({"email": "creator@cr8.studio"}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "creator@cr8.studio",
            "password_hash": demo_password_hash, "name": "Creator Demo", "username": "creatordemo",
            "role": "influencer", "handle": "creator.demo1", "company": None,
            "avatar": None, "niches": ["tech", "lifestyle"], "followers": 10000,
            "platforms": ["instagram", "youtube", "twitter", "facebook"],
            "city": "Hyderabad", "state": "Telangana", "location": "Hyderabad, Telangana",
            "mobile": "9876500101", "industry": None, "website": None, "portfolio": [], "rate_card": {},
            "verified": True, "wallet": 0, "created_at": now_iso(), "onboarding_status": "completed",
            "bio": (
                "Creator Demo is a tech & lifestyle influencer on CR8 Studio — product reviews, "
                "city lifestyle reels, and escrow-ready brand collaborations across India."
            ),
            "languages": ["English", "Hindi", "Telugu"],
            "content_types": ["Instagram Reels (Short Videos)", "Static Posts", "Stories", "YouTube Videos"],
            "availability": "Within 1 week",
            "base_rate": 25000,
            "category": "tech",
            "pincode": "500081",
        })
    
    company_enrich = {
        "company": "Acme Brand",
        "bio": (
            "Acme Brand is a fashion-forward apparel house building seasonal capsule collections "
            "for metro audiences across India. We partner with creators for product drops, lookbook "
            "reels, and city takeover stories — with escrow-backed briefs and clear brand guidelines."
        ),
        "industry": "Fashion",
        "website": "https://acmebrand.example",
        "linkedin": "https://www.linkedin.com/company/acme-brand",
        "company_size": "51–200 employees",
        "city": "Mumbai",
        "state": "Maharashtra",
        "location": "Mumbai, Maharashtra",
        "verified": True,
        "platform_metrics": {
            "facebook": {"handle": "acmebrand", "followers": 128000, "engagement": 3.4, "views": 920000, "posts": 214},
            "instagram": {"handle": "acme.brand", "followers": 412000, "engagement": 5.8, "views": 2800000, "posts": 486},
            "twitter": {"handle": "acmebrand", "followers": 64000, "engagement": 2.1, "views": 410000, "posts": 1203},
            "youtube": {"handle": "AcmeBrandOfficial", "followers": 88000, "engagement": 4.2, "views": 5600000, "posts": 96},
        },
        "past_campaigns": [
            {"brand": "Acme Brand", "title": "Summer Wearables City Drop", "date": "2025-04", "result": "+18% store traffic", "post_url": "https://instagram.com"},
            {"brand": "Acme Brand", "title": "Festive Edit Creator Series", "date": "2025-10", "result": "2.1M reach", "post_url": "https://instagram.com"},
            {"brand": "Acme Brand", "title": "Workwear Essentials Launch", "date": "2026-01", "result": "42K engagements", "post_url": "https://youtube.com"},
        ],
    }
    if await db.users.count_documents({"email": "company@cr8.studio"}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "company@cr8.studio",
            "password_hash": demo_password_hash, "name": "Company Demo", "username": "companydemo",
            "role": "owner", "handle": None, "company": "Acme Brand",
            "avatar": None, "niches": ["Fashion & Style"], "followers": None, "mobile": None,
            "platforms": ["instagram", "youtube", "facebook", "twitter"], "portfolio": [], "rate_card": {},
            "wallet": 50000, "created_at": now_iso(), "onboarding_status": "completed",
            **company_enrich,
        })
    else:
        await db.users.update_one({"email": "company@cr8.studio"}, {"$set": company_enrich})

    if await db.users.count_documents({"email": "agent@cr8.studio"}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "agent@cr8.studio",
            "password_hash": demo_password_hash, "name": "Agent Demo", "username": "agentdemo",
            "role": "agent", "handle": None, "company": "Talent Agency",
            "bio": (
                "Talent Agency represents creators across fashion, tech, and lifestyle verticals — "
                "brief matching, rate negotiation, and escrow-backed brand deals on CR8 Studio."
            ),
            "avatar": None, "niches": [], "followers": None, "mobile": "9876500103",
            "platforms": [], "city": "Mumbai", "state": "Maharashtra", "location": "Mumbai, Maharashtra",
            "industry": "Talent Management", "website": "https://talentagency.example",
            "portfolio": [], "rate_card": {}, "pincode": "400001",
            "verified": True, "wallet": 0, "created_at": now_iso(), "onboarding_status": "completed"
        })

    await seed_directory_roster(demo_password_hash)

    try:
        from mock_user_details import enrich_missing_user_details
        await enrich_missing_user_details(db, logger=logger)
    except Exception as e:
        logger.warning("enrich_missing_user_details failed: %s", e)
    
    # Leaderboard Mock Data
    await db.wallet_tx.delete_many({"note": {"$regex": "^Mock data"}})
    influencers = await db.users.find({"role": "influencer"}).to_list(10)
    brands = await db.users.find({"role": "owner"}).to_list(10)
    txs = []
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    amounts = [500000, 420000, 310000, 250000, 180000, 120000, 80000, 50000, 20000, 10000]
    for i, user in enumerate(influencers):
        amt = amounts[i % len(amounts)]
        txs.append({
            "id": str(uuid.uuid4()), "user_id": user["id"], "kind": "credit", "amount": amt,
            "note": "Mock data: Campaign Payment", "created_at": (now - timedelta(days=2)).isoformat()
        })
    for i, user in enumerate(brands):
        amt = amounts[i % len(amounts)] * 1.5
        txs.append({
            "id": str(uuid.uuid4()), "user_id": user["id"], "kind": "debit", "amount": int(amt),
            "note": "Mock data: Escrow Locked", "created_at": (now - timedelta(days=3)).isoformat()
        })
    if txs:
        await db.wallet_tx.insert_many(txs)
    if hasattr(api_router, "__phase2_recompute_leaderboard__"):
        await api_router.__phase2_recompute_leaderboard__("weekly")
        await api_router.__phase2_recompute_leaderboard__("monthly")



DIRECTORY_IMAGES = [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=800",
]

DIRECTORY_VIDEOS = [
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    "https://www.w3schools.com/html/mov_bbb.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
]

DIRECTORY_AVATARS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400&h=400",
]


def _directory_portfolio(i: int) -> list:
    imgs = DIRECTORY_IMAGES
    vids = DIRECTORY_VIDEOS
    return [
        vids[i % len(vids)],
        imgs[i % len(imgs)],
        imgs[(i + 3) % len(imgs)],
        vids[(i + 1) % len(vids)],
        imgs[(i + 5) % len(imgs)],
        imgs[(i + 7) % len(imgs)],
    ]


def _directory_platform_metrics(handle: str, followers: int, i: int) -> dict:
    """Per-platform handles + followers so Directory can show the top social account name."""
    base = max(1000, int(followers or 0))
    clean = (handle or "creator").lstrip("@").strip() or "creator"
    # Rotate which platform leads so cards show varied top accounts.
    primary = ("instagram", "youtube", "twitter", "facebook")[i % 4]
    rows = {
        "instagram": {
            "handle": clean,
            "followers": int(base * 0.82) + (i * 1200),
            "engagement": round(3.2 + (i % 5) * 0.25, 2),
            "views": int(base * 4.2),
            "posts": 80 + i * 7,
        },
        "youtube": {
            "handle": f"{clean.replace('.', '')}YT",
            "followers": int(base * 0.55) + (i * 900),
            "engagement": round(2.4 + (i % 4) * 0.2, 2),
            "views": int(base * 9.5),
            "posts": 40 + i * 3,
        },
        "twitter": {
            "handle": clean.replace(".", "_"),
            "followers": int(base * 0.38) + (i * 700),
            "engagement": round(1.8 + (i % 3) * 0.15, 2),
            "views": int(base * 2.1),
            "posts": 400 + i * 25,
        },
        "facebook": {
            "handle": clean.replace(".", ""),
            "followers": int(base * 0.44) + (i * 650),
            "engagement": round(2.0 + (i % 4) * 0.12, 2),
            "views": int(base * 3.0),
            "posts": 120 + i * 5,
        },
    }
    # Ensure the rotated primary platform has the highest follower count.
    peak = max(int(v["followers"]) for v in rows.values()) + 8000
    rows[primary]["followers"] = peak
    return rows


async def seed_directory_roster(demo_password_hash: str):
    """Ensure The Directory has a full row of creators with mock image + reel media."""
    roster = [
        ("arjun@cr8.studio", "arjunsharma", "Arjun Sharma", "arjun.tech", ["Tech & Gadgets", "Design"], 150000, "Mumbai", "Maharashtra"),
        ("priya@cr8.studio", "priyakapoor", "Priya Kapoor", "priyastyles", ["Fashion & Style", "Beauty"], 850000, "New Delhi", "Delhi"),
        ("rohan@cr8.studio", "rohandesai", "Rohan Desai", "rohan.fit", ["Fitness & Sports"], 320000, "Bangalore", "Karnataka"),
        ("sneha@cr8.studio", "snehareddy", "Sneha Reddy", "sneha.travels", ["Travel", "Lifestyle"], 120000, "Hyderabad", "Telangana"),
        ("karthik@cr8.studio", "karthikiyer", "Karthik Iyer", "karthik.code", ["Tech & Gadgets"], 95000, "Chennai", "Tamil Nadu"),
        ("anya@cr8.studio", "anyasingh", "Anya Singh", "anya.arts", ["Fashion & Style", "Art"], 210000, "Kolkata", "West Bengal"),
        ("vikram@cr8.studio", "vikrampatel", "Vikram Patel", "vikram.food", ["Food & Cooking"], 450000, "Ahmedabad", "Gujarat"),
        ("neha@cr8.studio", "nehajoshi", "Neha Joshi", "neha.vibes", ["Beauty", "Fashion & Style"], 600000, "Pune", "Maharashtra"),
        ("lena@cr8.studio", "lenaivory", "Lena Ivory", "lena.studio", ["Luxury", "Fashion & Style"], 410000, "Goa", "Goa"),
        ("kai@cr8.studio", "kaimonroe", "Kai Monroe", "kai.motion", ["Fitness & Sports", "Lifestyle"], 275000, "Pune", "Maharashtra"),
        ("nova@cr8.studio", "novareyes", "Nova Reyes", "nova.reels", ["Beauty", "Lifestyle"], 530000, "Mumbai", "Maharashtra"),
        ("mira@cr8.studio", "miradesai", "Mira Desai", "mira.frames", ["Travel", "Photography"], 188000, "Jaipur", "Rajasthan"),
    ]
    for i, (email, username, name, handle, niches, followers, city, state) in enumerate(roster):
        portfolio = _directory_portfolio(i)
        avatar = DIRECTORY_AVATARS[i % len(DIRECTORY_AVATARS)]
        platform_metrics = _directory_platform_metrics(handle, followers, i)
        top_followers = max(int(v.get("followers") or 0) for v in platform_metrics.values())
        existing = await db.users.find_one({"email": email})
        patch = {
            "username": username,
            "name": name,
            "role": "influencer",
            "handle": handle,
            "avatar": avatar,
            "niches": niches,
            "category": niches[0],
            "followers": top_followers,
            "platforms": ["instagram", "youtube", "twitter", "facebook"],
            "platform_metrics": platform_metrics,
            "city": city,
            "state": state,
            "location": f"{city}, {state}" if city.lower() != state.lower() else city,
            "portfolio": portfolio,
            "cover_photo": DIRECTORY_IMAGES[i % len(DIRECTORY_IMAGES)],
            "verified": True,
            "onboarding_status": "completed",
            "password_hash": demo_password_hash,
            "bio": f"{name} is a CR8 directory creator specializing in {', '.join(niches).lower()} with escrow-ready brand collaborations.",
            "content_types": ["Instagram Reels (Short Videos)", "Static Posts", "Stories"],
            "languages": ["English", "Hindi"],
            "availability": "Within 1 week",
            "base_rate": 25000 + (i * 7500),
            "mobile": f"98765{10000 + i:05d}"[-10:],
        }
        if existing:
            # Keep real uploaded avatar if present; always refresh empty portfolios.
            updates = {k: v for k, v in patch.items() if k != "avatar"}
            if not existing.get("avatar"):
                updates["avatar"] = avatar
            if not existing.get("portfolio"):
                updates["portfolio"] = portfolio
            elif len(existing.get("portfolio") or []) < 4:
                updates["portfolio"] = portfolio
            await db.users.update_one({"email": email}, {"$set": updates})
        else:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email,
                "company": None,
                "wallet": 0,
                "created_at": now_iso(),
                **patch,
            })

    # Backfill any other influencers missing portfolio/avatar/platform metrics/location
    cursor = db.users.find(
        {"role": "influencer"},
        {
            "_id": 0, "id": 1, "email": 1, "avatar": 1, "portfolio": 1, "handle": 1, "username": 1,
            "followers": 1, "platform_metrics": 1, "city": 1, "state": 1, "location": 1,
            "languages": 1, "content_types": 1, "availability": 1, "base_rate": 1, "bio": 1,
            "niches": 1, "category": 1, "role": 1,
        },
    )
    async for u in cursor:
        updates = {}
        if not u.get("avatar"):
            h = sum(ord(c) for c in str(u.get("id") or u.get("email") or "x"))
            updates["avatar"] = DIRECTORY_AVATARS[h % len(DIRECTORY_AVATARS)]
        port = u.get("portfolio") or []
        if len(port) < 4:
            h = sum(ord(c) for c in str(u.get("id") or u.get("email") or "x"))
            updates["portfolio"] = _directory_portfolio(h)
        pm = u.get("platform_metrics") or {}
        has_handle = any(
            isinstance(pm.get(p), dict) and str(pm[p].get("handle") or "").strip()
            for p in ("instagram", "youtube", "twitter", "facebook")
        )
        if not has_handle:
            h = sum(ord(c) for c in str(u.get("id") or u.get("email") or "x"))
            handle = (u.get("handle") or u.get("username") or "creator").lstrip("@")
            metrics = _directory_platform_metrics(handle, int(u.get("followers") or 12000), h)
            updates["platform_metrics"] = metrics
            updates["followers"] = max(int(u.get("followers") or 0), max(int(v.get("followers") or 0) for v in metrics.values()))
            updates["platforms"] = ["instagram", "youtube", "twitter", "facebook"]
        try:
            from mock_user_details import missing_detail_patch
            updates.update(missing_detail_patch({**u, **updates}))
        except Exception:
            pass
        if updates:
            await db.users.update_one({"id": u["id"]}, {"$set": updates})

@api_router.post("/admin/seed-mock-comms")
async def admin_seed_mock_comms(current: dict = Depends(get_current_user)):
    """Reseed mock DMs + invitations for creator / company / admin demo desks."""
    await require_role(current, ["admin"])
    from mock_comms import clear_mock_comms, seed_mock_comms
    cleared = await clear_mock_comms(db)
    result = await seed_mock_comms(db, logger=logger)
    return {"ok": True, "cleared": cleared, "seed": result}


@api_router.post("/admin/enrich-user-details")
async def admin_enrich_user_details(current: dict = Depends(get_current_user)):
    """Fill blank mock/profile fields (city, state, bio, languages, …) for all users."""
    await require_role(current, ["admin"])
    from mock_user_details import enrich_missing_user_details
    result = await enrich_missing_user_details(db, logger=logger)
    return {"ok": True, **result}


@api_router.post("/seed/mock-comms")
async def seed_mock_comms_me(current: dict = Depends(get_current_user)):
    """Any signed-in user can ensure demo conversations/invitations exist."""
    from mock_comms import seed_mock_comms
    result = await seed_mock_comms(db, logger=logger)
    return {"ok": True, "seed": result}


@api_router.get("/test-users")
async def get_test_users():
    users = await db.users.find({}, {"email": 1, "role": 1, "mobile": 1, "name": 1, "_id": 0}).to_list(None)
    return {"users": users}

@api_router.post("/admin/reset-demo-passwords")
async def reset_demo_passwords():
    """Force reset all demo account passwords to demo1234"""
    demo_password_hash = hash_password("demo1234")
    seed_emails = [
        "lena@cr8.studio", "kai@cr8.studio", "nova@cr8.studio",
        "creator@cr8.studio", "company@cr8.studio", "agent@cr8.studio",
        "support@cr8.studio", "support.lead@cr8.studio", "support.admin@cr8.studio",
        "pending_agent@cr8.studio", "studio@cr8.studio",
        "arjun@cr8.studio", "priya@cr8.studio", "rohan@cr8.studio",
        "sneha@cr8.studio", "karthik@cr8.studio", "anya@cr8.studio",
        "vikram@cr8.studio", "neha@cr8.studio",
        "zomato@cr8.studio", "boat@cr8.studio", "nykaa@cr8.studio",
        "agent.karan@cr8.studio", "agent.shruti@cr8.studio",
        "admin@cr8.studio",
    ]
    count = 0
    for em in seed_emails:
        result = await db.users.update_many({"email": em}, {"$set": {"password_hash": demo_password_hash}})
        count += result.modified_count
    return {"ok": True, "updated": count, "message": f"Reset passwords for {count} accounts to demo1234"}

@api_router.post("/admin/wipe-db")
async def wipe_db():
    res1 = await db.users.delete_many({"role": {"$ne": "admin"}})
    res2 = await db.campaigns.delete_many({})
    res3 = await db.applications.delete_many({})
    await seed_demo()
    return {
        "ok": True,
        "deleted_users": res1.deleted_count,
        "deleted_campaigns": res2.deleted_count,
        "deleted_apps": res3.deleted_count,
        "message": "DB wiped and re-seeded with 1 creator, 1 company, 1 agent."
    }

@api_router.post("/admin/fix-usernames")
async def fix_usernames():
    """Fix all demo accounts that have null usernames"""
    fixes = [
        ("creator@cr8.studio", "arjuncreator"),
        ("lena@cr8.studio", "lenaivorystudio"),
        ("kai@cr8.studio", "kaimonroe"),
        ("nova@cr8.studio", "novareyes"),
        ("studio@cr8.studio", "studionoir"),
        ("company@cr8.studio", "riyabrand"),
        ("agent@cr8.studio", "karanagent"),
        ("pending_agent@cr8.studio", "rahulagent"),
        ("zomato@cr8.studio", "deepinderg"),
        ("boat@cr8.studio", "amanboat"),
        ("nykaa@cr8.studio", "falguninykaa"),
        ("agent.karan@cr8.studio", "karanjohar"),
        ("agent.shruti@cr8.studio", "shrutiagent"),
        ("arjun@cr8.studio", "arjunsharma"),
        ("priya@cr8.studio", "priyakapoor"),
        ("rohan@cr8.studio", "rohandesai"),
        ("sneha@cr8.studio", "snehareddy"),
        ("karthik@cr8.studio", "karthikiyer"),
        ("anya@cr8.studio", "anyasingh"),
        ("vikram@cr8.studio", "vikrampatel"),
        ("neha@cr8.studio", "nehajoshi"),
    ]
    count = 0
    for email, username in fixes:
        result = await db.users.update_one(
            {"email": email, "$or": [{"username": None}, {"username": ""}]},
            {"$set": {"username": username}}
        )
        count += result.modified_count
    return {"ok": True, "updated": count}

@app.on_event("startup")
async def on_startup():
    get_upload_fs()  # bind GridFS to the running event loop
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
    await db.notifications.create_index("id", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.contracts.create_index("id", unique=True)
    await db.contracts.create_index([("campaign_id", 1), ("creator_id", 1)], unique=True)
    await seed_admin()
    await seed_demo()
    try:
        from mock_comms import seed_mock_comms
        await seed_mock_comms(db, logger=logger)
    except Exception as e:
        logger.warning("mock_comms seed on startup failed: %s", e)
    if _phase1_ensure_indexes:
        await _phase1_ensure_indexes()
    try:
        from apify_service import apify_service
        await apify_service.ensure_indexes(db)
        await apify_service.fail_stale_jobs(db)
    except Exception as e:
        logger.warning("apify indexes/stale cleanup failed: %s", e)
    try:
        await _support_ensure_indexes()
        await _support_seed_users()
    except Exception as e:
        logger.warning("support indexes/seed failed: %s", e)
    try:
        if _discovery_ensure_indexes:
            await _discovery_ensure_indexes()
    except Exception as e:
        logger.warning("discovery indexes failed: %s", e)
    try:
        if _invoice_ensure_indexes:
            await _invoice_ensure_indexes()
    except Exception as e:
        logger.warning("invoice indexes failed: %s", e)
    logger.info("CR8 API ready.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Phase 1 social / platform features (register BEFORE include_router) ----------
from phase1_features import setup_phase1  # noqa: E402

_phase1_ensure_indexes = setup_phase1(
    api_router,
    db=db,
    get_current_user=get_current_user,
    require_role=require_role,
    clean=clean,
    now_iso=now_iso,
    hash_password=hash_password,
    verify_password=verify_password,
    create_access_token=create_access_token,
    push_notification=push_notification,
    send_email=send_email,
    email_template=email_template,
    sse_publish=sse_publish,
    UPLOAD_DIR=UPLOAD_DIR,
    JWT_SECRET=JWT_SECRET,
    JWT_ALGORITHM=JWT_ALGORITHM,
    logger=logger,
    call_llm=call_llm,
    write_audit_log=write_audit_log,
    store_upload_bytes=store_upload_bytes,
)

# ── Phase 2: Categories, Matching, Levels, Badges, Leaderboard, Referrals ──
from phase2_features import setup_phase2  # noqa: E402

setup_phase2(
    api_router,
    db=db,
    get_current_user=get_current_user,
    require_role=require_role,
    clean=clean,
    now_iso=now_iso,
    send_email=send_email,
    email_template=email_template,
    push_notification=push_notification,
    write_audit_log=write_audit_log,
    logger=logger,
)

# ── Support & AI Ticket Management ──
from support_features import setup_support  # noqa: E402

_support_ensure_indexes, _support_seed_users = setup_support(
    api_router,
    db=db,
    get_current_user=get_current_user,
    require_role=require_role,
    clean=clean,
    now_iso=now_iso,
    hash_password=hash_password,
    push_notification=push_notification,
    send_email=send_email,
    email_template=email_template,
    write_audit_log=write_audit_log,
    call_llm=call_llm,
    logger=logger,
)

from discovery_features import setup_discovery  # noqa: E402

_discovery_ensure_indexes = setup_discovery(
    api_router,
    db=db,
    get_current_user=get_current_user,
    require_role=require_role,
    call_llm=call_llm,
    parse_json=parse_json,
    logger=logger,
)

from invoice_features import setup_invoices  # noqa: E402

_invoice_ensure_indexes = setup_invoices(
    api_router,
    db=db,
    get_current_user=get_current_user,
    require_role=require_role,
    call_llm=call_llm,
    parse_json=parse_json,
    send_email=send_email,
    email_template=email_template,
    write_audit_log=write_audit_log,
    store_upload_bytes=store_upload_bytes,
    load_upload_bytes=load_upload_bytes,
    logger=logger,
)

class ScrapeInput(BaseModel):
    url: str = Field(min_length=1, max_length=500)

@api_router.post("/social/scrape")
async def scrape_social(inp: ScrapeInput, current: dict = Depends(get_current_user)):
    from apify_service import apify_service
    if not apify_service.is_configured():
        raise HTTPException(status_code=503, detail="Apify scraper is not configured (missing APIFY_TOKEN)")
    try:
        job = await apify_service.create_scraper_job(db, current["id"], inp.url)
        import asyncio
        asyncio.create_task(apify_service.run_scraper_job(db, job["id"]))
        return {"ok": True, "jobId": job["id"], "status": job.get("status"), "url": job.get("url")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("scrape_social failed: %s", e)
        raise HTTPException(status_code=500, detail="Scraping service temporarily unavailable")

@api_router.get("/scrape/{job_id}")
async def get_scrape_job_status(job_id: str, current: dict = Depends(get_current_user)):
    job = await db.scraper_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("user_id") != current["id"] and current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "success": True,
        "status": job.get("status"),
        "data": job.get("result_data"),
        "error": job.get("error_message"),
        "platform": job.get("platform"),
        "url": job.get("url"),
    }

@api_router.get("/apify/health")
async def apify_health():
    from apify_service import apify_service
    return await apify_service.health_check()

@api_router.get("/feed")
async def get_feed(mode: str = "foryou", cursor: Optional[str] = None, limit: int = 20, current: dict = Depends(get_current_user)):
    # Basic mock endpoint so frontend Feed doesn't error out
    return {"items": [], "next_cursor": None, "suggested_people": []}

app.include_router(api_router)

# Serve the built SPA from backend/web when present (Render fallback while GitHub Pages is stuck).
WEB_DIR = ROOT_DIR / "web"
_SPA_SKIP_PREFIXES = ("api", "docs", "redoc", "openapi.json")


@app.get("/")
async def spa_root():
    index = WEB_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"name": "CR8 API", "status": "ok", "web": False}


@app.get("/{full_path:path}")
async def spa_or_static(full_path: str):
    first = (full_path or "").split("/", 1)[0]
    if first in _SPA_SKIP_PREFIXES or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    if not WEB_DIR.is_dir():
        raise HTTPException(status_code=404, detail="Not Found")
    candidate = (WEB_DIR / full_path).resolve()
    try:
        candidate.relative_to(WEB_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Not Found")
    if candidate.is_file():
        if "static" in candidate.parts:
            # Cache static assets with content hashes
            return FileResponse(candidate, headers={"Cache-Control": "public, max-age=31536000, immutable"})
        return FileResponse(candidate, headers={"Cache-Control": "no-cache"})
    index = WEB_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404, detail="Not Found")



