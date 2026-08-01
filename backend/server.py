from dotenv import load_dotenv
from pathlib import Path
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
load_dotenv(ROOT_DIR.parent / 'frontend' / '.env')
load_dotenv(ROOT_DIR.parent / '.env')

import os
import uuid
import json
import asyncio
import logging
import mimetypes
import secrets
from pathlib import Path as PathLib
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Any

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
from fastapi.responses import StreamingResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- Setup ----------
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'cr8_social')]

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
UserRole = Literal["owner", "influencer", "admin", "agent"]


class RegisterInput(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=80)
    role: UserRole
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
    handle: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    category: Optional[str] = None
    followers: Optional[int] = None
    platforms: Optional[List[str]] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    portfolio: Optional[List[str]] = None
    social_accounts: Optional[List[Dict[str, Any]]] = None
    onboarding_status: Optional[str] = None
    agent_approved: Optional[bool] = None
    
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
        if await db.users.find_one({"mobile": inp.mobile.strip()}):
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
# Practice mode: skip real email delivery and return OTP in API response (for local/demo learning)
OTP_PRACTICE_MODE = (os.environ.get("OTP_PRACTICE_MODE") or "").strip().lower() in ("1", "true", "yes", "on")


def practice_otp_payload(otp_code: str) -> dict:
    if not OTP_PRACTICE_MODE:
        return {}
    return {
        "practice_mode": True,
        "practice_otp": otp_code,
        "message_practice": f"Practice mode: your OTP is {otp_code}",
    }

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
            return

        api_key = os.environ.get("FAST2SMS_API_KEY")
        if api_key:
            try:
                async with httpx.AsyncClient(timeout=10) as c:
                    res = await c.post(
                        "https://www.fast2sms.com/dev/bulkV2",
                        headers={"authorization": api_key, "Content-Type": "application/json"},
                        json={
                            "variables_values": otp,
                            "route": os.environ.get("FAST2SMS_ROUTE", "otp"),
                            "numbers": clean_mobile
                        }
                    )
                    if res.status_code == 200:
                        logger.info("Fast2SMS OTP dispatched to +91 %s", clean_mobile)
                    else:
                        logger.warning("Fast2SMS error %s: %s", res.status_code, res.text)
            except Exception as e:
                logger.warning("Fast2SMS exception: %s", e)
        else:
            logger.info("cr8 studio: Your verification code is %s. Valid for %s minutes. Do not share this OTP with anyone.", otp, OTP_EXPIRY_MINUTES)

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
            created_at = datetime.fromisoformat(existing["created_at"])
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

    if OTP_PRACTICE_MODE:
        logger.info("OTP practice mode — code for %s: %s", email, otp_code)
    else:
        await email_provider.send_email_otp(email, email.split("@")[0], otp_code)

    await db.otps.update_one({"email": email}, {"$set": doc}, upsert=True)
    _otp_store[email] = {"code": otp_code, "expires_at": expires_at, "hashed_otp": hashed, "attempts": 0}

    resp = {
        "ok": True,
        "message": (
            f"Practice mode: use OTP {otp_code}"
            if OTP_PRACTICE_MODE
            else f"Verification code sent to {email}. Valid for {OTP_EXPIRY_MINUTES} minutes."
        ),
    }
    resp.update(practice_otp_payload(otp_code))
    return resp


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

    expires_at_raw = doc.get("expires_at")
    expires_at = datetime.fromisoformat(expires_at_raw) if isinstance(expires_at_raw, str) else expires_at_raw

    if expires_at and datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new verification code.")

    attempts = doc.get("attempts", 0) + 1
    if attempts > OTP_MAX_ATTEMPTS:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")

    target_hash = hash_otp(target_code)
    stored_hash = doc.get("hashed_otp") or hash_otp(doc.get("code", ""))

    if target_hash != stored_hash and target_code != doc.get("code"):
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
    
    mobile = inp.mobile.strip().replace(" ", "").replace("+91", "")
    if len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number")

    existing = await db.otps.find_one({"mobile": mobile})
    if existing and existing.get("created_at"):
        try:
            created_at = datetime.fromisoformat(existing["created_at"])
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
        "mobile": mobile,
        "hashed_otp": hashed,
        "code": otp_code,
        "attempts": 0,
        "created_at": now_utc.isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    await db.otps.update_one({"mobile": mobile}, {"$set": doc}, upsert=True)
    _otp_store[mobile] = {"code": otp_code, "expires_at": expires_at, "hashed_otp": hashed, "attempts": 0}

    await sms_provider.send_sms_otp(mobile, otp_code)
    return {"ok": True, "message": f"Verification code sent to +91 {mobile}. Valid for {OTP_EXPIRY_MINUTES} minutes."}


@api_router.post("/auth/mobile/verify-otp")
async def mobile_verify_otp(inp: OTPVerify):
    if not inp.mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")

    mobile = inp.mobile.strip().replace(" ", "").replace("+91", "")
    target_code = (inp.code or inp.otp or "").strip()
    await consume_mobile_otp(mobile, target_code)

    user = await db.users.find_one({"$or": [{"mobile": mobile}, {"mobile": f"+91{mobile}"}]})
    if user:
        user_id = user.get("id") or str(user["_id"])
        token = create_access_token(user_id, user["email"], user.get("role", "influencer"))
        return {"ok": True, "verified": True, "token": token, "user": clean(dict(user)), "message": "Mobile number verified successfully!"}

    return {"ok": True, "verified": True, "message": "Mobile number verified successfully!"}


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
        "practice_mode": OTP_PRACTICE_MODE,
        "hint": (
            "Practice: set OTP_PRACTICE_MODE=true to show OTP on screen. "
            "Production: set BREVO_SENDER_EMAIL to a verified Brevo sender (custom domain preferred)."
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
    platform: Optional[str] = None
    handle: Optional[str] = None


from google.oauth2 import id_token
from google.auth.transport import requests

class FirebaseLoginInput(BaseModel):
    firebase_token: str


async def consume_mobile_otp(mobile: str, target_code: str) -> None:
    """Validate and consume a mobile OTP. Raises HTTPException on failure."""
    mobile = (mobile or "").strip().replace(" ", "").replace("+91", "")
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

    expires_at_raw = doc.get("expires_at")
    expires_at = datetime.fromisoformat(expires_at_raw) if isinstance(expires_at_raw, str) else expires_at_raw
    if expires_at and datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_one({"mobile": mobile})
        _otp_store.pop(mobile, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new verification code.")

    attempts = doc.get("attempts", 0) + 1
    if attempts > OTP_MAX_ATTEMPTS:
        await db.otps.delete_one({"mobile": mobile})
        _otp_store.pop(mobile, None)
        raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")

    target_hash = hash_otp(target_code)
    stored_hash = doc.get("hashed_otp") or hash_otp(doc.get("code", ""))
    if target_hash != stored_hash and target_code != doc.get("code"):
        await db.otps.update_one({"mobile": mobile}, {"$set": {"attempts": attempts}})
        remaining = OTP_MAX_ATTEMPTS - attempts
        if remaining <= 0:
            await db.otps.delete_one({"mobile": mobile})
            _otp_store.pop(mobile, None)
            raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")
        raise HTTPException(status_code=400, detail=f"Incorrect OTP code. {remaining} attempt(s) remaining.")

    await db.otps.delete_one({"mobile": mobile})
    _otp_store.pop(mobile, None)


async def consume_email_otp(email: str, target_code: str) -> None:
    """Validate and consume an email OTP. Raises HTTPException on failure."""
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

    expires_at_raw = doc.get("expires_at")
    expires_at = datetime.fromisoformat(expires_at_raw) if isinstance(expires_at_raw, str) else expires_at_raw
    if expires_at and datetime.now(timezone.utc) > expires_at:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new verification code.")

    attempts = doc.get("attempts", 0) + 1
    if attempts > OTP_MAX_ATTEMPTS:
        await db.otps.delete_one({"email": email})
        _otp_store.pop(email, None)
        raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")

    target_hash = hash_otp(target_code)
    stored_hash = doc.get("hashed_otp") or hash_otp(doc.get("code", ""))
    if target_hash != stored_hash and target_code != doc.get("code"):
        await db.otps.update_one({"email": email}, {"$set": {"attempts": attempts}})
        remaining = OTP_MAX_ATTEMPTS - attempts
        if remaining <= 0:
            await db.otps.delete_one({"email": email})
            _otp_store.pop(email, None)
            raise HTTPException(status_code=429, detail=f"Maximum {OTP_MAX_ATTEMPTS} attempts reached. Please request a new OTP.")
        raise HTTPException(status_code=400, detail=f"Incorrect OTP code. {remaining} attempt(s) remaining.")

    await db.otps.delete_one({"email": email})
    _otp_store.pop(email, None)


@api_router.post("/auth/register/send-otp")
@api_router.post("/auth/register/resend-otp")
async def register_send_otp(inp: OTPRequest):
    """Send one OTP for signup via email (Brevo/Gmail) and optionally SMS if Fast2SMS is configured."""
    if not inp.email:
        raise HTTPException(status_code=400, detail="Email address is required")
    if not inp.mobile:
        raise HTTPException(status_code=400, detail="Mobile number is required")

    email = inp.email.lower().strip()
    mobile = inp.mobile.strip().replace(" ", "").replace("+91", "")
    if len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(status_code=400, detail="Please enter a valid 10-digit Indian mobile number")

    # Shared cooldown across email/mobile keys for this signup attempt
    for key, query in ((email, {"email": email}), (mobile, {"mobile": mobile})):
        existing = await db.otps.find_one(query)
        if existing and existing.get("created_at"):
            try:
                created_at = datetime.fromisoformat(existing["created_at"])
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

    # Deliver (or practice-mode skip) — then persist OTP
    if OTP_PRACTICE_MODE:
        logger.info("OTP practice mode — code for %s / %s: %s", email, mobile, otp_code)
        channels = ["practice mode (shown on screen)"]
    else:
        await email_provider.send_email_otp(email, email.split("@")[0], otp_code)
        channels = [f"email ({email})"]
        if os.environ.get("FAST2SMS_API_KEY"):
            await sms_provider.send_sms_otp(mobile, otp_code)
            channels.append(f"SMS (+91 {mobile})")

    await db.otps.update_one({"email": email}, {"$set": {**shared, "email": email}}, upsert=True)
    await db.otps.update_one({"mobile": mobile}, {"$set": {**shared, "mobile": mobile}}, upsert=True)
    _otp_store[email] = {**shared, "expires_at": expires_at}
    _otp_store[mobile] = {**shared, "expires_at": expires_at}

    resp = {
        "ok": True,
        "message": (
            f"Practice mode: your OTP is {otp_code}"
            if OTP_PRACTICE_MODE
            else f"Verification code sent to {' and '.join(channels)}. Valid for {OTP_EXPIRY_MINUTES} minutes."
        ),
        "channels": channels,
    }
    resp.update(practice_otp_payload(otp_code))
    return resp


@api_router.post("/auth/firebase-login")
async def firebase_login(inp: FirebaseLoginInput):
    try:
        decoded_token = id_token.verify_firebase_token(inp.firebase_token, requests.Request(), "cr8studio-b91fe")
        mobile = decoded_token.get('phone_number')
        if not mobile:
            raise HTTPException(status_code=400, detail="Firebase token does not contain a phone number")
        
        # Look up user by mobile number (either with or without +91)
        clean_mobile = mobile.replace("+91", "")
        user = await db.users.find_one({"$or": [{"mobile": clean_mobile}, {"mobile": f"+91{clean_mobile}"}]})
        
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this mobile number")
            
        user_id = user.get("id") or str(user["_id"])
        token = create_access_token(user_id, user.get("email"), user.get("role", "influencer"))
        
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
    platform: Optional[str] = None,
    handle: Optional[str] = None,
    verified: bool = True,
) -> dict:
    email = email.lower().strip()
    username = username.lower().strip()
    clean_mobile = (mobile or "").replace("+91", "").replace(" ", "").strip()

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
    city, state = None, None
    if pincode:
        loc = await fetch_pincode_details(pincode)
        city = loc.get("city") if loc.get("city") != "Unknown" else None
        state = loc.get("state") if loc.get("state") != "Unknown" else None

    social_accounts = []
    platforms = []
    if role == "influencer" and platform and handle:
        social_accounts.append({"platform": platform, "handle": handle, "followers": 0, "engagement_rate": 0.0})
        platforms.append(platform)

    doc = {
        "id": user_id,
        "email": email,
        "username": username,
        "password_hash": hash_password(password),
        "name": name, "role": role, "handle": handle, "company": company,
        "mobile": clean_mobile, "pincode": pincode,
        "bio": None, "avatar": None, "niches": [], "followers": None, "platforms": platforms,
        "location": None, "city": city, "state": state, "industry": None, "website": None,
        "portfolio": [], "rate_card": {}, "verified": verified, "email_verified": False, "wallet": 0,
        "onboarding_status": "pending", "agent_approved": False,
        "created_at": now_iso(),
        "social_accounts": social_accounts,
        "agent_type": agent_type,
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, role)
    return {"ok": True, "token": token, "user": clean(doc)}


@api_router.post("/auth/mobile-register")
async def mobile_register(inp: MobileRegisterInput):
    """Sign up using email/SMS OTP from our backend — does not require Firebase billing."""
    # Accept the same OTP from either channel (register/send-otp stores both)
    try:
        await consume_email_otp(inp.email, inp.otp)
    except HTTPException as email_err:
        try:
            await consume_mobile_otp(inp.mobile, inp.otp)
        except HTTPException:
            raise email_err

    # Clear the sibling OTP key if still present
    clean_mobile = (inp.mobile or "").replace("+91", "").replace(" ", "").strip()
    email = inp.email.lower().strip()
    await db.otps.delete_one({"mobile": clean_mobile})
    await db.otps.delete_one({"email": email})
    _otp_store.pop(clean_mobile, None)
    _otp_store.pop(email, None)

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
        platform=inp.platform,
        handle=inp.handle,
        verified=True,
    )
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

    # Verify OTP
    otp_record = await db.otps.find_one({"email": email})
    if not otp_record or otp_record["otp"] != inp.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    if otp_record["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code expired")
    
    if await db.users.find_one({"$or": [{"email": email}, {"username": username}, {"mobile": mobile}]}):
        raise HTTPException(status_code=400, detail="User with this email, username, or mobile already exists")
    if inp.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot self-register as admin")
    
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
    await db.otps.delete_one({"email": email})
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
    return {"token": token, "user": clean(dict(user))}


@api_router.post("/auth/login")
async def login(inp: LoginInput):
    identifier = inp.identifier.lower().strip()
    user = await db.users.find_one({
        "$or": [{"email": identifier}, {"username": identifier}, {"mobile": identifier}]
    })
    if not user or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    
    user_id = user.get("id") or str(user["_id"])
    if not user.get("id"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"id": user_id}})
        user["id"] = user_id

    token = create_access_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": clean(dict(user))}


@api_router.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return current


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
    return {"ok": True, "message": "Agent application declined"}


@api_router.get("/admin/dashboard-stats")
async def admin_dashboard_stats(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    total_creators = await db.users.count_documents({"role": "influencer"})
    total_brands = await db.users.count_documents({"role": "owner"})
    total_agencies = await db.users.count_documents({"role": "agent"})
    
    total_campaigns = await db.campaigns.count_documents({})
    active_campaigns = await db.campaigns.count_documents({"status": "in_progress"})
    completed_campaigns = await db.campaigns.count_documents({"status": "completed"})
    
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$budget"}}}]
    res = await db.campaigns.aggregate(pipeline).to_list(1)
    total_payments = res[0]["total"] if res else 0
    total_revenue = total_payments * 0.15 # 15% platform commission mock

    total_requests = await db.applications.count_documents({})
    pending_verification = await db.users.count_documents({"role": "agent", "agent_approved": False})
    
    # Mock some data for Logins, Registrations, etc.
    import random
    
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
            "pending_approval": 0
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
            "logins_today": random.randint(100, 500),
            "new_registrations": random.randint(5, 50),
            "active_users": random.randint(50, 300)
        }
    }

@api_router.get("/admin/recent-activity")
async def admin_recent_activity(current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    audit_logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    if audit_logs:
        return audit_logs
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(5).to_list(5)
    camps = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    activity = []
    for u in users:
        activity.append({
            "type": f"{u.get('role', 'user').title()} Signup",
            "user": u.get("name", "User"),
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
    current: dict = Depends(get_current_user)
):
    await require_role(current, ["admin"])
    filt: Dict[str, Any] = {}
    if role:
        filt["role"] = role
    if category:
        filt["$or"] = [{"category": category}, {"industry": category}]
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"handle": {"$regex": q, "$options": "i"}}
        ]
    if status == "pending":
        filt["role"] = "agent"
        filt["agent_approved"] = False
    
    users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    return users

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current: dict = Depends(get_current_user)):
    await require_role(current, ["admin"])
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    # Also delete associated campaigns, applications, reviews, etc.
    await db.campaigns.delete_many({"owner_id": user_id})
    await db.applications.delete_many({"influencer_id": user_id})
    return {"ok": True, "message": "User deleted successfully"}

# ---------- Creators ----------
@api_router.post("/creators/sync-analytics")
async def sync_analytics(current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    
    import random
    from datetime import datetime, timedelta
    
    # 1. Update Platform Metrics with deep data
    pm = current.get("platform_metrics") or {}
    
    # Check if any platforms have handles connected
    has_handles = any(info.get("handle") for info in pm.values() if isinstance(info, dict))
    if not has_handles:
        return {
            "ok": True, 
            "message": "No social media platforms connected. No changes made.",
            "metrics": pm,
            "monthly_analytics": current.get("monthly_analytics", [])
        }

    for plat in ["instagram", "youtube", "twitter", "facebook"]:
        if plat in pm and pm[plat].get("handle"):
            base_foll = pm[plat].get("followers", random.randint(10000, 500000))
            pm[plat] = {
                "handle": pm[plat]["handle"],
                "followers": base_foll,
                "engagement": round(random.uniform(1.0, 10.0), 1),
                "views": int(base_foll * random.uniform(2, 5)),
                "posts": random.randint(100, 2000),
                "growth": round(random.uniform(-2.0, 15.0), 1),
                "last_synced": now_iso()
            }
            if plat == "instagram":
                pm[plat].update({
                    "story_reach": int(base_foll * 0.15),
                    "reel_reach": int(base_foll * 1.2),
                    "profile_visits": int(base_foll * 0.05)
                })
    
    # 2. Generate 12 Months of Historical Data
    monthly_data = []
    base_followers = pm.get("instagram", {}).get("followers", 100000)
    for i in range(11, -1, -1):
        dt = datetime.now(timezone.utc) - timedelta(days=30*i)
        growth_factor = 1.0 - (i * 0.02) # Simulate upward trend over time
        monthly_data.append({
            "month": dt.strftime("%b %Y"),
            "followers": int(base_followers * growth_factor),
            "engagement": round(random.uniform(3.0, 6.0), 1),
            "views": int(base_followers * growth_factor * random.uniform(2.5, 4.0))
        })
        
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {"platform_metrics": pm, "monthly_analytics": monthly_data, "analytics_last_synced": now_iso()}}
    )
    
    return {
        "ok": True, 
        "message": "Analytics synchronized with external platforms.",
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
            {"handle": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
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
        db.users.find({"id": {"$in": list(other_ids)}}, {"_id": 0, "id": 1, "name": 1, "handle": 1, "avatar": 1, "company": 1}).to_list(200)
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
            c["other_name"] = other.get("name") or other.get("company") or "User"
            c["other_handle"] = other.get("handle") or other.get("company") or "@partner"
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
async def call_llm(system: str, prompt: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY missing")
        
    import httpx
    
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": "claude-3-haiku-20240307",
        "max_tokens": 1000,
        "system": system,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
        except Exception as e:
            logger.warning(f"Anthropic API error: {e}")
            raise HTTPException(status_code=500, detail=f"AI generation failed: {repr(e)}")


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
        base = os.environ.get("FRONTEND_URL", "https://owner-creator.emergent.host")
        link = f"{base}/reset-password?token={token}"
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
    niches: List[str]
    handle: Optional[str] = None
    name: Optional[str] = None
    bio: Optional[str] = None
    languages: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    experience: Optional[str] = None
    content_types: Optional[List[str]] = None
    platform_metrics: Optional[dict] = None

@api_router.post("/ai/suggest-profile")
async def ai_suggest_profile(inp: ProfileSuggestInput, current: dict = Depends(get_current_user)):
    await require_role(current, ["influencer"])
    system = "You are a creative director for high-end influencers."
    
    niches_str = ", ".join(inp.niches) if inp.niches else "General"
    handle_str = inp.handle or "an upcoming creator"
    name_str = inp.name or "the creator"
    lang_str = ", ".join(inp.languages) if inp.languages else "English"
    loc_str = f"{inp.city or ''}, {inp.state or ''}".strip(", ") or "Global"
    exp_str = inp.experience or "upcoming"
    
    platforms = []
    if inp.platform_metrics:
        for p, d in inp.platform_metrics.items():
            if d and d.get("handle"):
                platforms.append(p)
    plat_str = ", ".join(platforms) if platforms else "various platforms"
    
    prompt = f"The influencer's name is {name_str}. The niches are: {niches_str}.\n"
    prompt += f"They are based in {loc_str} and speak {lang_str}.\n"
    prompt += f"They have {exp_str} experience and are active on {plat_str}.\n\n"
    prompt += "Suggest a punchy, luxurious bio (1-2 sentences max) that takes all this context into account.\n"
    prompt += "Also, suggest exactly 4 high-quality image URLs for their portfolio that perfectly match their niches.\n"
    prompt += "(Use actual real unsplash source URLs like https://images.unsplash.com/photo-...)\n\n"
    prompt += "Return ONLY JSON with this structure:\n"
    prompt += "{\n  \"bio\": \"...\",\n  \"portfolio\": [\"url1\", \"url2\", \"url3\", \"url4\"]\n}\n"

    try:
        text = await call_llm(system, prompt)
        return parse_json(text)
    except Exception as e:
        logger.warning("AI profile suggestion failed: %s", repr(e))
        name_str = inp.name or inp.handle or "creator"
        # Return a static clean fallback to avoid infinite append loops
        fallback_bio = f"Curating high-end aesthetics with a focus on luxury and design. Specialized in {niches_str}."
        # Fallback to mock data if their API key is invalid or missing
        return {
            "bio": fallback_bio,
            "category": "Fashion & Style",
            "languages": ["English", "Hindi"],
            "experience": "1-2 years",
            "content_types": ["Instagram Posts (Photos)", "Instagram Reels (Short Videos)"],
            "portfolio": [
                "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
                "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
                "https://images.unsplash.com/photo-1550614000-4b95d4ed7982?w=800&q=80",
                "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80"
            ]
        }

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
    demo_password_hash = hash_password("demo1234")
    
    seed_emails = ["creator@cr8.studio", "company@cr8.studio", "agent@cr8.studio"]
    for em in seed_emails:
        await db.users.update_many({"email": em}, {"$set": {"password_hash": demo_password_hash}})

    if await db.users.count_documents({"email": "creator@cr8.studio"}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "creator@cr8.studio",
            "password_hash": demo_password_hash, "name": "Creator Demo", "username": "creatordemo",
            "role": "influencer", "handle": "@creator.demo", "company": None, "bio": "Demo creator.",
            "avatar": None, "niches": ["tech", "lifestyle"], "followers": 10000,
            "platforms": ["instagram"], "location": "Remote", "mobile": None,
            "industry": None, "website": None, "portfolio": [], "rate_card": {},
            "verified": True, "wallet": 0, "created_at": now_iso(), "onboarding_status": "completed"
        })
    
    if await db.users.count_documents({"email": "company@cr8.studio"}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "company@cr8.studio",
            "password_hash": demo_password_hash, "name": "Company Demo", "username": "companydemo",
            "role": "owner", "handle": None, "company": "Acme Brand", "bio": "Brand account.",
            "avatar": None, "niches": [], "followers": None, "mobile": None,
            "platforms": [], "location": "Remote", "industry": "Fashion",
            "website": None, "portfolio": [], "rate_card": {},
            "verified": True, "wallet": 50000, "created_at": now_iso(), "onboarding_status": "completed"
        })

    if await db.users.count_documents({"email": "agent@cr8.studio"}) == 0:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "agent@cr8.studio",
            "password_hash": demo_password_hash, "name": "Agent Demo", "username": "agentdemo",
            "role": "agent", "handle": None, "company": "Talent Agency", "bio": "Talent agent.",
            "avatar": None, "niches": [], "followers": None, "mobile": None,
            "platforms": [], "location": "Remote", "industry": None,
            "website": None, "portfolio": [], "rate_card": {},
            "verified": True, "wallet": 0, "created_at": now_iso(), "onboarding_status": "completed"
        })

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

app.include_router(api_router)
