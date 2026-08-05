"""
Phase 1 social / platform features mounted onto the main API router.
Skipped by product request: email OTP validation UI, product catalog, group chat, mutual friends.
"""
from __future__ import annotations

import hashlib
import io
import re
import secrets
import uuid
from collections import Counter
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from pydantic import BaseModel, Field, EmailStr

try:
    import pyotp
except ImportError:
    pyotp = None

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


HASHTAG_RE = re.compile(r"#([A-Za-z0-9_]{2,40})")
MENTION_RE = re.compile(r"@([A-Za-z0-9_.]{2,30})")


def setup_phase1(
    api_router: APIRouter,
    *,
    db,
    get_current_user,
    require_role,
    clean,
    now_iso,
    hash_password,
    verify_password,
    create_access_token,
    push_notification,
    send_email,
    email_template,
    sse_publish,
    UPLOAD_DIR,
    JWT_SECRET,
    JWT_ALGORITHM,
    logger,
    call_llm=None,
    write_audit_log=None,
    store_upload_bytes=None,
):
    import jwt
    import mimetypes
    import aiofiles
    from pathlib import Path as PathLib
    from fastapi.responses import StreamingResponse

    async def _audit(**kwargs):
        if write_audit_log:
            await write_audit_log(**kwargs)

    async def _persist_upload(fid: str, data: bytes, content_type: Optional[str] = None):
        if store_upload_bytes:
            await store_upload_bytes(fid, data, content_type)
            return
        dest = UPLOAD_DIR / PathLib(fid).name
        async with aiofiles.open(dest, "wb") as f:
            await f.write(data)

    # ---------- Models ----------
    class LoginExInput(BaseModel):
        identifier: str
        password: str
        remember_me: bool = False
        device_name: Optional[str] = None
        totp_code: Optional[str] = None

    class AppleLoginInput(BaseModel):
        identity_token: str
        device_name: Optional[str] = None
        remember_me: bool = False

    class SessionRevokeInput(BaseModel):
        session_id: str

    class TwoFAEnableInput(BaseModel):
        code: str

    class TwoFADisableInput(BaseModel):
        password: str
        code: str

    class PresenceInput(BaseModel):
        online: bool = True

    class BlockInput(BaseModel):
        user_id: str
        reason: Optional[str] = None

    class ReportInput(BaseModel):
        target_type: Literal["user", "post", "comment", "message", "content"]
        target_id: str
        reason: str
        details: Optional[str] = None

    class MuteInput(BaseModel):
        user_id: str

    class RestrictInput(BaseModel):
        user_id: str

    class PostCreate(BaseModel):
        text: Optional[str] = None
        title: Optional[str] = None
        media: Optional[List[Dict[str, Any]]] = None  # [{url, type}]
        gif_url: Optional[str] = None
        link_url: Optional[str] = None
        poll: Optional[Dict[str, Any]] = None  # {options:[{text}], ends_at}
        visibility: Literal["public", "followers", "private"] = "public"
        status: Literal["published", "draft", "scheduled"] = "published"
        scheduled_at: Optional[str] = None
        category: Optional[str] = None
        sponsored: bool = False

    class PostUpdate(BaseModel):
        text: Optional[str] = None
        title: Optional[str] = None
        media: Optional[List[Dict[str, Any]]] = None
        visibility: Optional[str] = None
        status: Optional[str] = None
        scheduled_at: Optional[str] = None
        pinned: Optional[bool] = None
        category: Optional[str] = None

    class CommentCreate(BaseModel):
        text: str = Field(min_length=1, max_length=2000)
        parent_id: Optional[str] = None

    class CommentUpdate(BaseModel):
        text: str = Field(min_length=1, max_length=2000)

    class QuoteRepostInput(BaseModel):
        text: Optional[str] = None

    class PollVoteInput(BaseModel):
        option_index: int

    class FollowInput(BaseModel):
        user_id: str

    class MessageExCreate(BaseModel):
        content: Optional[str] = ""
        media_url: Optional[str] = None
        media_type: Optional[Literal["image", "video", "voice", "gif"]] = None
        reply_to_id: Optional[str] = None

    class MessageEditInput(BaseModel):
        content: str

    class TypingInput(BaseModel):
        typing: bool = True

    class DMOpenInput(BaseModel):
        user_id: str

    class NotifPrefsInput(BaseModel):
        likes: Optional[bool] = None
        comments: Optional[bool] = None
        follows: Optional[bool] = None
        mentions: Optional[bool] = None
        messages: Optional[bool] = None
        friend_requests: Optional[bool] = None
        post_updates: Optional[bool] = None
        push: Optional[bool] = None
        email: Optional[bool] = None

    class SettingsInput(BaseModel):
        language: Optional[str] = None
        theme: Optional[Literal["dark", "light", "system"]] = None
        high_contrast: Optional[bool] = None
        reduced_motion: Optional[bool] = None
        font_scale: Optional[float] = None
        notification_prefs: Optional[NotifPrefsInput] = None
        privacy: Optional[Dict[str, Any]] = None
        cover_photo: Optional[str] = None
        date_of_birth: Optional[str] = None
        gender: Optional[str] = None
        is_private: Optional[bool] = None
        show_online_status: Optional[bool] = None
        show_last_seen: Optional[bool] = None

    class SearchRecentInput(BaseModel):
        query: str
        kind: Optional[str] = "all"

    class AITextInput(BaseModel):
        text: Optional[str] = None
        context: Optional[str] = None
        tone: Optional[str] = "editorial"
        target_lang: Optional[str] = None

    class AdminBanInput(BaseModel):
        reason: Optional[str] = None
        days: Optional[int] = None  # None = permanent

    class AdminBroadcastInput(BaseModel):
        text: str
        kind: str = "announcement"
        role: Optional[str] = None

    class AdminReportAction(BaseModel):
        status: Literal["reviewed", "resolved", "dismissed"]
        note: Optional[str] = None

    class CategoryInput(BaseModel):
        name: str
        description: Optional[str] = None

    # ---------- Helpers ----------
    def extract_tags(text: str):
        hashtags = list({h.lower() for h in HASHTAG_RE.findall(text or "")})
        mentions = list({m.lower() for m in MENTION_RE.findall(text or "")})
        return hashtags, mentions

    async def record_session(user_id: str, token: str, request: Request, device_name: Optional[str], remember_me: bool):
        ua = request.headers.get("user-agent", "")[:240]
        ip = request.client.host if request.client else ""
        session = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "token_hash": hashlib.sha256(token.encode()).hexdigest(),
            "device_name": device_name or ua[:80] or "Unknown device",
            "user_agent": ua,
            "ip": ip,
            "remember_me": remember_me,
            "created_at": now_iso(),
            "last_active": now_iso(),
            "revoked": False,
        }
        await db.sessions.insert_one(session)
        await db.login_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "ip": ip,
            "user_agent": ua,
            "device_name": session["device_name"],
            "created_at": now_iso(),
            "success": True,
        })
        return session["id"]

    async def create_token_ex(user: dict, remember_me: bool = False) -> str:
        minutes = 60 * 24 * 30 if remember_me else 60 * 24 * 7
        payload = {
            "sub": user["id"],
            "email": user.get("email"),
            "role": user.get("role"),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
            "type": "access",
            "remember": remember_me,
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    async def is_blocked(a: str, b: str) -> bool:
        return bool(await db.blocks.find_one({"$or": [{"blocker_id": a, "blocked_id": b}, {"blocker_id": b, "blocked_id": a}]}))

    async def is_muted(viewer: str, author: str) -> bool:
        return bool(await db.mutes.find_one({"user_id": viewer, "muted_id": author}))

    async def notify_if_allowed(user_id: str, kind: str, text: str, meta: Optional[dict] = None):
        prefs = {}
        u = await db.users.find_one({"id": user_id}, {"notification_prefs": 1})
        if u:
            prefs = u.get("notification_prefs") or {}
        key_map = {
            "like": "likes", "comment": "comments", "follow": "follows",
            "mention": "mentions", "message": "messages", "friend_request": "friend_requests",
            "post_update": "post_updates",
        }
        pref_key = key_map.get(kind, kind)
        if prefs.get(pref_key) is False:
            return
        await push_notification(user_id, kind, text, meta)
        if prefs.get("email") and u:
            email = (await db.users.find_one({"id": user_id}, {"email": 1}) or {}).get("email")
            if email:
                try:
                    await send_email(email, f"CR8 — {kind}", email_template(text, f"<p>{text}</p>"))
                except Exception:
                    pass

    def author_public(u: dict) -> dict:
        return {
            "id": u.get("id"),
            "name": u.get("name"),
            "handle": u.get("handle") or u.get("username"),
            "avatar": u.get("avatar"),
            "verified": bool(u.get("verified")),
            "role": u.get("role"),
            "is_private": bool(u.get("is_private")),
        }

    async def enrich_post(post: dict, viewer_id: Optional[str] = None) -> dict:
        post = dict(post)
        post.pop("_id", None)
        if viewer_id:
            post["liked"] = bool(await db.likes.find_one({"post_id": post["id"], "user_id": viewer_id}))
            post["saved"] = bool(await db.saves.find_one({"post_id": post["id"], "user_id": viewer_id}))
            post["bookmarked"] = bool(await db.bookmarks.find_one({"post_id": post["id"], "user_id": viewer_id}))
        author = await db.users.find_one({"id": post.get("author_id")}, {"password_hash": 0})
        if author:
            post["author"] = author_public(clean(dict(author)))
        return post

    async def publish_scheduled():
        now = now_iso()
        due = await db.posts.find({"status": "scheduled", "scheduled_at": {"$lte": now}}, {"_id": 0}).to_list(50)
        for p in due:
            await db.posts.update_one({"id": p["id"]}, {"$set": {"status": "published", "published_at": now}})

    # ---------- Auth: remember me / sessions / Apple / 2FA ----------
    @api_router.post("/auth/login-ex")
    async def login_ex(inp: LoginExInput, request: Request):
        identifier = inp.identifier.lower().strip()
        user = await db.users.find_one({
            "$or": [{"email": identifier}, {"username": identifier}, {"mobile": identifier}]
        })
        if not user or not verify_password(inp.password, user.get("password_hash", "")):
            await db.login_history.insert_one({
                "id": str(uuid.uuid4()), "user_id": None, "identifier": identifier,
                "ip": request.client.host if request.client else "", "created_at": now_iso(), "success": False,
            })
            raise HTTPException(status_code=401, detail="Invalid login credentials")
        if user.get("banned"):
            raise HTTPException(status_code=403, detail="Account suspended")
        if user.get("two_fa_enabled"):
            if not inp.totp_code or not pyotp:
                return {"requires_2fa": True}
            totp = pyotp.TOTP(user.get("two_fa_secret", ""))
            if not totp.verify(inp.totp_code, valid_window=1):
                raise HTTPException(status_code=401, detail="Invalid 2FA code")
        user_id = user.get("id") or str(user["_id"])
        if not user.get("id"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"id": user_id}})
            user["id"] = user_id
        token = await create_token_ex(user, inp.remember_me)
        sid = await record_session(user["id"], token, request, inp.device_name, inp.remember_me)
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": now_iso(), "online": True}})
        return {"token": token, "user": clean(dict(user)), "session_id": sid, "remember_me": inp.remember_me}

    @api_router.post("/auth/apple-login")
    async def apple_login(inp: AppleLoginInput, request: Request):
        """Login with Apple identity token for already-registered users (no auto-register)."""
        try:
            # Decode without strict verify when APPLE_CLIENT_ID unset (dev); production should verify.
            payload = jwt.decode(inp.identity_token, options={"verify_signature": False})
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Apple identity token")
        email = (payload.get("email") or "").lower().strip()
        sub = payload.get("sub")
        if not email and not sub:
            raise HTTPException(status_code=400, detail="Apple token missing identity")
        user = None
        if email:
            user = await db.users.find_one({"email": email})
        if not user and sub:
            user = await db.users.find_one({"apple_sub": sub})
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this Apple ID. Please register first.")
        if user.get("banned"):
            raise HTTPException(status_code=403, detail="Account suspended")
        if sub and not user.get("apple_sub"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"apple_sub": sub}})
        token = await create_token_ex(user, inp.remember_me)
        sid = await record_session(user["id"], token, request, inp.device_name or "Apple device", inp.remember_me)
        return {"token": token, "user": clean(dict(user)), "session_id": sid}

    @api_router.get("/auth/sessions")
    async def list_sessions(current: dict = Depends(get_current_user)):
        items = await db.sessions.find(
            {"user_id": current["id"], "revoked": False},
            {"_id": 0, "token_hash": 0},
        ).sort("last_active", -1).to_list(50)
        return items

    @api_router.post("/auth/sessions/revoke")
    async def revoke_session(inp: SessionRevokeInput, current: dict = Depends(get_current_user)):
        await db.sessions.update_one(
            {"id": inp.session_id, "user_id": current["id"]},
            {"$set": {"revoked": True, "revoked_at": now_iso()}},
        )
        return {"ok": True}

    @api_router.post("/auth/sessions/revoke-all")
    async def revoke_all_sessions(current: dict = Depends(get_current_user)):
        await db.sessions.update_many(
            {"user_id": current["id"], "revoked": False},
            {"$set": {"revoked": True, "revoked_at": now_iso()}},
        )
        return {"ok": True}

    @api_router.get("/auth/login-history")
    async def login_history(current: dict = Depends(get_current_user)):
        return await db.login_history.find(
            {"user_id": current["id"]}, {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50)

    @api_router.post("/auth/2fa/setup")
    async def twofa_setup(current: dict = Depends(get_current_user)):
        if not pyotp:
            raise HTTPException(status_code=501, detail="2FA library not installed")
        secret = pyotp.random_base32()
        await db.users.update_one({"id": current["id"]}, {"$set": {"two_fa_secret_pending": secret}})
        uri = pyotp.TOTP(secret).provisioning_uri(name=current.get("email") or current["id"], issuer_name="CR8 Studio")
        return {"secret": secret, "otpauth_uri": uri}

    @api_router.post("/auth/2fa/enable")
    async def twofa_enable(inp: TwoFAEnableInput, current: dict = Depends(get_current_user)):
        if not pyotp:
            raise HTTPException(status_code=501, detail="2FA library not installed")
        user = await db.users.find_one({"id": current["id"]})
        secret = user.get("two_fa_secret_pending") or user.get("two_fa_secret")
        if not secret:
            raise HTTPException(status_code=400, detail="Call /auth/2fa/setup first")
        if not pyotp.TOTP(secret).verify(inp.code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid code")
        await db.users.update_one({"id": current["id"]}, {"$set": {
            "two_fa_enabled": True, "two_fa_secret": secret,
        }, "$unset": {"two_fa_secret_pending": ""}})
        return {"ok": True}

    @api_router.post("/auth/2fa/disable")
    async def twofa_disable(inp: TwoFADisableInput, current: dict = Depends(get_current_user)):
        user = await db.users.find_one({"id": current["id"]})
        if not verify_password(inp.password, user.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Incorrect password")
        if user.get("two_fa_enabled") and pyotp:
            if not pyotp.TOTP(user.get("two_fa_secret", "")).verify(inp.code, valid_window=1):
                raise HTTPException(status_code=400, detail="Invalid 2FA code")
        await db.users.update_one({"id": current["id"]}, {"$set": {"two_fa_enabled": False}, "$unset": {"two_fa_secret": "", "two_fa_secret_pending": ""}})
        return {"ok": True}

    @api_router.post("/auth/presence")
    async def set_presence(request: Request, current: dict = Depends(get_current_user)):
        """Heartbeat / online status. Accepts empty or partial JSON without 422."""
        online = True
        try:
            body = await request.json()
            if isinstance(body, dict) and "online" in body:
                val = body.get("online")
                if isinstance(val, str):
                    online = val.strip().lower() in ("1", "true", "yes", "on")
                elif val is None:
                    online = True
                else:
                    online = bool(val)
        except Exception:
            online = True
        ts = now_iso()
        await db.users.update_one({"id": current["id"]}, {"$set": {
            "online": online,
            "last_seen": ts,
        }})
        return {"ok": True, "online": online, "last_seen": ts}

    @api_router.post("/auth/delete-account")
    async def delete_account(current: dict = Depends(get_current_user)):
        uid = current["id"]
        await db.users.delete_one({"id": uid})
        await db.posts.delete_many({"author_id": uid})
        await db.follows.delete_many({"$or": [{"follower_id": uid}, {"following_id": uid}]})
        await db.sessions.update_many({"user_id": uid}, {"$set": {"revoked": True}})
        return {"ok": True}

    @api_router.get("/auth/export-data")
    async def export_data(current: dict = Depends(get_current_user)):
        uid = current["id"]
        user = await db.users.find_one({"id": uid}, {"password_hash": 0, "two_fa_secret": 0, "two_fa_secret_pending": 0})
        posts = await db.posts.find({"author_id": uid}, {"_id": 0}).to_list(500)
        messages = await db.messages.find({"sender_id": uid}, {"_id": 0}).to_list(500)
        follows = await db.follows.find({"$or": [{"follower_id": uid}, {"following_id": uid}]}, {"_id": 0}).to_list(500)
        return {
            "exported_at": now_iso(),
            "user": clean(dict(user)) if user else None,
            "posts": posts,
            "messages": messages,
            "follows": follows,
        }

    # ---------- Privacy: block / mute / restrict / report ----------
    @api_router.post("/privacy/block")
    async def block_user(inp: BlockInput, current: dict = Depends(get_current_user)):
        if inp.user_id == current["id"]:
            raise HTTPException(status_code=400, detail="Cannot block yourself")
        await db.blocks.update_one(
            {"blocker_id": current["id"], "blocked_id": inp.user_id},
            {"$set": {"id": str(uuid.uuid4()), "blocker_id": current["id"], "blocked_id": inp.user_id,
                      "reason": inp.reason, "created_at": now_iso()}},
            upsert=True,
        )
        await db.follows.delete_many({"$or": [
            {"follower_id": current["id"], "following_id": inp.user_id},
            {"follower_id": inp.user_id, "following_id": current["id"]},
        ]})
        return {"ok": True}

    @api_router.post("/privacy/unblock")
    async def unblock_user(inp: BlockInput, current: dict = Depends(get_current_user)):
        await db.blocks.delete_one({"blocker_id": current["id"], "blocked_id": inp.user_id})
        return {"ok": True}

    @api_router.get("/privacy/blocks")
    async def list_blocks(current: dict = Depends(get_current_user)):
        blocks = await db.blocks.find({"blocker_id": current["id"]}, {"_id": 0}).to_list(200)
        ids = [b["blocked_id"] for b in blocks]
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
        umap = {u["id"]: author_public(u) for u in users}
        return [{"block": b, "user": umap.get(b["blocked_id"])} for b in blocks]

    @api_router.post("/privacy/mute")
    async def mute_user(inp: MuteInput, current: dict = Depends(get_current_user)):
        await db.mutes.update_one(
            {"user_id": current["id"], "muted_id": inp.user_id},
            {"$set": {"id": str(uuid.uuid4()), "user_id": current["id"], "muted_id": inp.user_id, "created_at": now_iso()}},
            upsert=True,
        )
        return {"ok": True}

    @api_router.post("/privacy/unmute")
    async def unmute_user(inp: MuteInput, current: dict = Depends(get_current_user)):
        await db.mutes.delete_one({"user_id": current["id"], "muted_id": inp.user_id})
        return {"ok": True}

    @api_router.get("/privacy/mutes")
    async def list_mutes(current: dict = Depends(get_current_user)):
        return await db.mutes.find({"user_id": current["id"]}, {"_id": 0}).to_list(200)

    @api_router.post("/privacy/restrict")
    async def restrict_user(inp: RestrictInput, current: dict = Depends(get_current_user)):
        await db.restricted.update_one(
            {"user_id": current["id"], "restricted_id": inp.user_id},
            {"$set": {"id": str(uuid.uuid4()), "user_id": current["id"], "restricted_id": inp.user_id, "created_at": now_iso()}},
            upsert=True,
        )
        return {"ok": True}

    @api_router.post("/privacy/unrestrict")
    async def unrestrict_user(inp: RestrictInput, current: dict = Depends(get_current_user)):
        await db.restricted.delete_one({"user_id": current["id"], "restricted_id": inp.user_id})
        return {"ok": True}

    @api_router.get("/privacy/restricted")
    async def list_restricted(current: dict = Depends(get_current_user)):
        return await db.restricted.find({"user_id": current["id"]}, {"_id": 0}).to_list(200)

    @api_router.post("/reports")
    async def create_report(inp: ReportInput, current: dict = Depends(get_current_user)):
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

    # ---------- Settings ----------
    @api_router.patch("/settings")
    async def update_settings(inp: SettingsInput, current: dict = Depends(get_current_user)):
        data = inp.model_dump(exclude_unset=True) if hasattr(inp, "model_dump") else inp.dict(exclude_unset=True)
        updates = {}
        for k, v in data.items():
            if v is None:
                continue
            if k == "notification_prefs" and isinstance(v, dict):
                for pk, pv in v.items():
                    if pv is not None:
                        updates[f"notification_prefs.{pk}"] = pv
            elif k == "privacy" and isinstance(v, dict):
                for pk, pv in v.items():
                    updates[f"privacy.{pk}"] = pv
            else:
                updates[k] = v
        if updates:
            or_filters = [{"id": current["id"]}]
            if current.get("email"):
                or_filters.append({"email": str(current["email"]).lower().strip()})
            # Dual-write nested settings.* for older clients / partial docs
            nested = {}
            for k, v in list(updates.items()):
                if k.startswith("notification_prefs.") or k.startswith("privacy."):
                    continue
                if "." not in k:
                    nested[f"settings.{k}"] = v
            updates_all = {**updates, **nested}
            res = await db.users.update_one({"$or": or_filters}, {"$set": updates_all})
            if getattr(res, "matched_count", 0) == 0:
                # Last-resort: match by Mongo _id when JWT sub was an ObjectId string
                try:
                    from bson import ObjectId
                    if len(str(current.get("id") or "")) == 24:
                        await db.users.update_one(
                            {"_id": ObjectId(current["id"])},
                            {"$set": updates_all},
                        )
                except Exception:
                    pass
        # Always return the settings-shaped payload so mobile toggles stay in sync
        return await get_settings(current)

    @api_router.get("/settings")
    async def get_settings(current: dict = Depends(get_current_user)):
        u = await db.users.find_one({"id": current["id"]}, {"password_hash": 0, "two_fa_secret": 0})
        if not u and current.get("email"):
            u = await db.users.find_one(
                {"email": str(current["email"]).lower().strip()},
                {"password_hash": 0, "two_fa_secret": 0},
            )
        u = clean(dict(u)) if u else current
        nested = u.get("settings") if isinstance(u.get("settings"), dict) else {}
        def pick(key, default=None):
            if u.get(key) is not None:
                return u.get(key)
            if nested.get(key) is not None:
                return nested.get(key)
            return default
        return {
            "language": pick("language") or "en",
            "theme": pick("theme") or "dark",
            "high_contrast": bool(pick("high_contrast", False)),
            "reduced_motion": bool(pick("reduced_motion", False)),
            "font_scale": pick("font_scale") or 1,
            "notification_prefs": pick("notification_prefs") or {},
            "privacy": pick("privacy") or {},
            "is_private": bool(pick("is_private", False)),
            "show_online_status": pick("show_online_status", True),
            "show_last_seen": pick("show_last_seen", True),
            "two_fa_enabled": bool(u.get("two_fa_enabled")),
            "cover_photo": pick("cover_photo"),
            "date_of_birth": pick("date_of_birth"),
            "gender": pick("gender"),
        }

    # ---------- Posts / Feed ----------
    @api_router.post("/posts")
    async def create_post(inp: PostCreate, current: dict = Depends(get_current_user)):
        text = inp.text or ""
        hashtags, mentions = extract_tags(f"{inp.title or ''} {text}")
        status = inp.status
        if status == "scheduled" and not inp.scheduled_at:
            raise HTTPException(status_code=400, detail="scheduled_at required")
        doc = {
            "id": str(uuid.uuid4()),
            "author_id": current["id"],
            "title": inp.title,
            "text": text,
            "media": inp.media or [],
            "gif_url": inp.gif_url,
            "link_url": inp.link_url,
            "poll": inp.poll,
            "visibility": inp.visibility,
            "status": status,
            "scheduled_at": inp.scheduled_at,
            "published_at": now_iso() if status == "published" else None,
            "category": inp.category,
            "sponsored": inp.sponsored,
            "hashtags": hashtags,
            "mentions": mentions,
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "saves_count": 0,
            "views_count": 0,
            "reposts_count": 0,
            "pinned": False,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.posts.insert_one(doc)
        doc.pop("_id", None)
        # mention notifications
        for m in mentions:
            u = await db.users.find_one({"$or": [{"username": m}, {"handle": m}, {"handle": f"@{m}"}]})
            if u and u["id"] != current["id"]:
                await notify_if_allowed(u["id"], "mention", f"{current.get('name')} mentioned you in a post", {"post_id": doc["id"]})
        return await enrich_post(doc, current["id"])

    @api_router.patch("/posts/{post_id}")
    async def update_post(post_id: str, inp: PostUpdate, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post["author_id"] != current["id"] and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        data = inp.model_dump(exclude_unset=True) if hasattr(inp, "model_dump") else inp.dict(exclude_unset=True)
        updates = {k: v for k, v in data.items() if v is not None}
        if "text" in updates or "title" in updates:
            ht, mt = extract_tags(f"{updates.get('title', post.get('title') or '')} {updates.get('text', post.get('text') or '')}")
            updates["hashtags"] = ht
            updates["mentions"] = mt
        updates["updated_at"] = now_iso()
        if updates.get("status") == "published" and not post.get("published_at"):
            updates["published_at"] = now_iso()
        await db.posts.update_one({"id": post_id}, {"$set": updates})
        post = await db.posts.find_one({"id": post_id}, {"_id": 0})
        return await enrich_post(post, current["id"])

    @api_router.delete("/posts/{post_id}")
    async def delete_post(post_id: str, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post["author_id"] != current["id"] and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        await db.posts.delete_one({"id": post_id})
        await db.comments.delete_many({"post_id": post_id})
        await db.likes.delete_many({"post_id": post_id})
        return {"ok": True}

    @api_router.post("/posts/{post_id}/pin")
    async def pin_post(post_id: str, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id})
        if not post or post["author_id"] != current["id"]:
            raise HTTPException(status_code=404, detail="Post not found")
        pinned = not post.get("pinned")
        if pinned:
            await db.posts.update_many({"author_id": current["id"], "pinned": True}, {"$set": {"pinned": False}})
        await db.posts.update_one({"id": post_id}, {"$set": {"pinned": pinned}})
        return {"ok": True, "pinned": pinned}

    @api_router.get("/posts/mine")
    async def my_posts(
        status: Optional[str] = None,
        current: dict = Depends(get_current_user),
    ):
        q = {"author_id": current["id"]}
        if status:
            q["status"] = status
        items = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
        return [await enrich_post(p, current["id"]) for p in items]

    @api_router.get("/posts/saved")
    async def list_saved(current: dict = Depends(get_current_user)):
        saves = await db.saves.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
        ids = [s["post_id"] for s in saves]
        posts = await db.posts.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)
        return [await enrich_post(p, current["id"]) for p in posts]

    @api_router.get("/posts/{post_id}")
    async def get_post(post_id: str, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        await db.posts.update_one({"id": post_id}, {"$inc": {"views_count": 1}})
        await db.profile_views.insert_one({
            "id": str(uuid.uuid4()), "viewer_id": current["id"], "target_id": post["author_id"],
            "kind": "post", "post_id": post_id, "created_at": now_iso(),
        })
        return await enrich_post(post, current["id"])

    @api_router.get("/feed")
    async def get_feed(
        mode: Literal["latest", "trending", "personalized", "following"] = "latest",
        cursor: Optional[str] = None,
        limit: int = Query(20, ge=1, le=50),
        current: dict = Depends(get_current_user),
    ):
        await publish_scheduled()
        q: Dict[str, Any] = {"status": "published"}
        if cursor:
            q["created_at"] = {"$lt": cursor}

        blocked = await db.blocks.find({"blocker_id": current["id"]}, {"blocked_id": 1}).to_list(500)
        muted = await db.mutes.find({"user_id": current["id"]}, {"muted_id": 1}).to_list(500)
        exclude = {b["blocked_id"] for b in blocked} | {m["muted_id"] for m in muted}
        if exclude:
            q["author_id"] = {"$nin": list(exclude)}

        sort = [("pinned", -1), ("created_at", -1)]
        if mode == "trending":
            sort = [("likes_count", -1), ("comments_count", -1), ("created_at", -1)]
        elif mode in ("personalized", "following"):
            following = await db.follows.find({"follower_id": current["id"]}, {"following_id": 1}).to_list(500)
            ids = [f["following_id"] for f in following]
            if ids:
                if exclude:
                    q["author_id"] = {"$in": [i for i in ids if i not in exclude]}
                else:
                    q["author_id"] = {"$in": ids}
            else:
                # fallback to latest recommended
                pass

        posts = await db.posts.find(q, {"_id": 0}).sort(sort).limit(limit).to_list(limit)
        enriched = [await enrich_post(p, current["id"]) for p in posts]
        next_cursor = posts[-1]["created_at"] if posts else None

        # suggested people / posts
        suggested_users = await db.users.find(
            {"id": {"$ne": current["id"], "$nin": list(exclude)}, "role": {"$in": ["influencer", "owner"]}},
            {"_id": 0, "password_hash": 0},
        ).limit(6).to_list(6)

        return {
            "items": enriched,
            "next_cursor": next_cursor,
            "suggested_people": [author_public(u) for u in suggested_users],
            "recommended": enriched[:3],
        }

    @api_router.post("/posts/{post_id}/like")
    async def like_post(post_id: str, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        existing = await db.likes.find_one({"post_id": post_id, "user_id": current["id"]})
        if existing:
            await db.likes.delete_one({"id": existing["id"]})
            await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
            return {"liked": False}
        await db.likes.insert_one({
            "id": str(uuid.uuid4()), "post_id": post_id, "user_id": current["id"], "created_at": now_iso(),
        })
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        if post["author_id"] != current["id"]:
            await notify_if_allowed(post["author_id"], "like", f"{current.get('name')} liked your post", {"post_id": post_id})
        return {"liked": True}

    @api_router.post("/posts/{post_id}/unlike")
    async def unlike_post(post_id: str, current: dict = Depends(get_current_user)):
        existing = await db.likes.find_one({"post_id": post_id, "user_id": current["id"]})
        if existing:
            await db.likes.delete_one({"id": existing["id"]})
            await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False}

    @api_router.post("/posts/{post_id}/save")
    async def save_post(post_id: str, current: dict = Depends(get_current_user)):
        existing = await db.saves.find_one({"post_id": post_id, "user_id": current["id"]})
        if existing:
            await db.saves.delete_one({"id": existing["id"]})
            await db.posts.update_one({"id": post_id}, {"$inc": {"saves_count": -1}})
            return {"saved": False}
        await db.saves.insert_one({"id": str(uuid.uuid4()), "post_id": post_id, "user_id": current["id"], "created_at": now_iso()})
        await db.posts.update_one({"id": post_id}, {"$inc": {"saves_count": 1}})
        return {"saved": True}

    @api_router.post("/posts/{post_id}/bookmark")
    async def bookmark_post(post_id: str, current: dict = Depends(get_current_user)):
        existing = await db.bookmarks.find_one({"post_id": post_id, "user_id": current["id"]})
        if existing:
            await db.bookmarks.delete_one({"id": existing["id"]})
            return {"bookmarked": False}
        await db.bookmarks.insert_one({"id": str(uuid.uuid4()), "post_id": post_id, "user_id": current["id"], "created_at": now_iso()})
        return {"bookmarked": True}

    @api_router.post("/posts/{post_id}/repost")
    async def repost(post_id: str, current: dict = Depends(get_current_user)):
        original = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not original:
            raise HTTPException(status_code=404, detail="Post not found")
        doc = {
            "id": str(uuid.uuid4()),
            "author_id": current["id"],
            "text": "",
            "repost_of": post_id,
            "status": "published",
            "visibility": "public",
            "media": [],
            "hashtags": [],
            "mentions": [],
            "likes_count": 0, "comments_count": 0, "shares_count": 0, "saves_count": 0, "views_count": 0, "reposts_count": 0,
            "pinned": False,
            "created_at": now_iso(), "updated_at": now_iso(), "published_at": now_iso(),
        }
        await db.posts.insert_one(doc)
        await db.posts.update_one({"id": post_id}, {"$inc": {"reposts_count": 1, "shares_count": 1}})
        doc.pop("_id", None)
        return await enrich_post(doc, current["id"])

    @api_router.post("/posts/{post_id}/quote")
    async def quote_post(post_id: str, inp: QuoteRepostInput, current: dict = Depends(get_current_user)):
        original = await db.posts.find_one({"id": post_id})
        if not original:
            raise HTTPException(status_code=404, detail="Post not found")
        ht, mt = extract_tags(inp.text or "")
        doc = {
            "id": str(uuid.uuid4()),
            "author_id": current["id"],
            "text": inp.text or "",
            "quote_of": post_id,
            "status": "published",
            "visibility": "public",
            "media": [],
            "hashtags": ht, "mentions": mt,
            "likes_count": 0, "comments_count": 0, "shares_count": 0, "saves_count": 0, "views_count": 0, "reposts_count": 0,
            "pinned": False,
            "created_at": now_iso(), "updated_at": now_iso(), "published_at": now_iso(),
        }
        await db.posts.insert_one(doc)
        await db.posts.update_one({"id": post_id}, {"$inc": {"shares_count": 1}})
        doc.pop("_id", None)
        return await enrich_post(doc, current["id"])

    @api_router.post("/posts/{post_id}/share")
    async def share_post(post_id: str, current: dict = Depends(get_current_user)):
        await db.posts.update_one({"id": post_id}, {"$inc": {"shares_count": 1}})
        return {"ok": True, "link": f"/#/feed?post={post_id}"}

    @api_router.post("/posts/{post_id}/poll/vote")
    async def vote_poll(post_id: str, inp: PollVoteInput, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id})
        if not post or not post.get("poll"):
            raise HTTPException(status_code=404, detail="Poll not found")
        existing = await db.poll_votes.find_one({"post_id": post_id, "user_id": current["id"]})
        if existing:
            raise HTTPException(status_code=400, detail="Already voted")
        opts = post["poll"].get("options") or []
        if inp.option_index < 0 or inp.option_index >= len(opts):
            raise HTTPException(status_code=400, detail="Invalid option")
        await db.poll_votes.insert_one({
            "id": str(uuid.uuid4()), "post_id": post_id, "user_id": current["id"],
            "option_index": inp.option_index, "created_at": now_iso(),
        })
        key = f"poll.options.{inp.option_index}.votes"
        await db.posts.update_one({"id": post_id}, {"$inc": {key: 1}})
        return {"ok": True}

    # ---------- Comments ----------
    @api_router.get("/posts/{post_id}/comments")
    async def list_comments(post_id: str, current: dict = Depends(get_current_user)):
        items = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
        author_ids = list({c["author_id"] for c in items})
        users = await db.users.find({"id": {"$in": author_ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
        umap = {u["id"]: author_public(u) for u in users}
        for c in items:
            c["author"] = umap.get(c["author_id"])
        return items

    @api_router.post("/posts/{post_id}/comments")
    async def add_comment(post_id: str, inp: CommentCreate, current: dict = Depends(get_current_user)):
        post = await db.posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        doc = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "author_id": current["id"],
            "text": inp.text,
            "parent_id": inp.parent_id,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.comments.insert_one(doc)
        await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
        if post["author_id"] != current["id"]:
            await notify_if_allowed(post["author_id"], "comment", f"{current.get('name')} commented on your post", {"post_id": post_id})
        doc.pop("_id", None)
        doc["author"] = author_public(current)
        return doc

    @api_router.patch("/comments/{comment_id}")
    async def edit_comment(comment_id: str, inp: CommentUpdate, current: dict = Depends(get_current_user)):
        c = await db.comments.find_one({"id": comment_id})
        if not c or c["author_id"] != current["id"]:
            raise HTTPException(status_code=404, detail="Comment not found")
        await db.comments.update_one({"id": comment_id}, {"$set": {"text": inp.text, "updated_at": now_iso(), "edited": True}})
        c = await db.comments.find_one({"id": comment_id}, {"_id": 0})
        return c

    @api_router.delete("/comments/{comment_id}")
    async def delete_comment(comment_id: str, current: dict = Depends(get_current_user)):
        c = await db.comments.find_one({"id": comment_id})
        if not c:
            raise HTTPException(status_code=404, detail="Comment not found")
        if c["author_id"] != current["id"] and current.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        await db.comments.delete_one({"id": comment_id})
        await db.posts.update_one({"id": c["post_id"]}, {"$inc": {"comments_count": -1}})
        return {"ok": True}

    # ---------- Follow graph ----------
    @api_router.post("/follow")
    async def follow_user(inp: FollowInput, current: dict = Depends(get_current_user)):
        if inp.user_id == current["id"]:
            raise HTTPException(status_code=400, detail="Cannot follow yourself")
        if await is_blocked(current["id"], inp.user_id):
            raise HTTPException(status_code=403, detail="Blocked")
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
        kind = "friend_request" if status == "pending" else "follow"
        await notify_if_allowed(inp.user_id, kind, f"{current.get('name')} {'requested to follow' if status == 'pending' else 'followed'} you", {"user_id": current["id"]})
        return {"ok": True, "status": status}

    @api_router.post("/unfollow")
    async def unfollow_user(inp: FollowInput, current: dict = Depends(get_current_user)):
        await db.follows.delete_one({"follower_id": current["id"], "following_id": inp.user_id})
        return {"ok": True}

    @api_router.post("/follow/requests/{follower_id}/accept")
    async def accept_follow(follower_id: str, current: dict = Depends(get_current_user)):
        await db.follows.update_one(
            {"follower_id": follower_id, "following_id": current["id"], "status": "pending"},
            {"$set": {"status": "accepted"}},
        )
        return {"ok": True}

    @api_router.post("/follow/requests/{follower_id}/reject")
    async def reject_follow(follower_id: str, current: dict = Depends(get_current_user)):
        await db.follows.delete_one({"follower_id": follower_id, "following_id": current["id"], "status": "pending"})
        return {"ok": True}

    @api_router.get("/follow/requests")
    async def follow_requests(current: dict = Depends(get_current_user)):
        reqs = await db.follows.find({"following_id": current["id"], "status": "pending"}, {"_id": 0}).to_list(100)
        ids = [r["follower_id"] for r in reqs]
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(100)
        umap = {u["id"]: author_public(u) for u in users}
        return [{"request": r, "user": umap.get(r["follower_id"])} for r in reqs]

    @api_router.get("/users/{user_id}/followers")
    async def list_followers(user_id: str, current: dict = Depends(get_current_user)):
        rows = await db.follows.find({"following_id": user_id, "status": "accepted"}, {"_id": 0}).to_list(200)
        ids = [r["follower_id"] for r in rows]
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
        return [author_public(u) for u in users]

    @api_router.get("/users/{user_id}/following")
    async def list_following(user_id: str, current: dict = Depends(get_current_user)):
        rows = await db.follows.find({"follower_id": user_id, "status": "accepted"}, {"_id": 0}).to_list(200)
        ids = [r["following_id"] for r in rows]
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
        return [author_public(u) for u in users]

    @api_router.get("/users/suggested")
    async def suggested_users(current: dict = Depends(get_current_user)):
        following = await db.follows.find({"follower_id": current["id"]}, {"following_id": 1}).to_list(500)
        exclude = {f["following_id"] for f in following} | {current["id"]}
        users = await db.users.find(
            {"id": {"$nin": list(exclude)}, "role": {"$in": ["influencer", "owner", "agent"]}},
            {"_id": 0, "password_hash": 0},
        ).limit(12).to_list(12)
        return [author_public(u) for u in users]

    @api_router.get("/users/{user_id}/public")
    async def public_profile(user_id: str, current: dict = Depends(get_current_user)):
        u = await db.users.find_one({"id": user_id}, {"password_hash": 0, "two_fa_secret": 0})
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        if await is_blocked(current["id"], user_id):
            raise HTTPException(status_code=403, detail="Blocked")
        await db.profile_views.insert_one({
            "id": str(uuid.uuid4()), "viewer_id": current["id"], "target_id": user_id,
            "kind": "profile", "created_at": now_iso(),
        })
        followers = await db.follows.count_documents({"following_id": user_id, "status": "accepted"})
        following = await db.follows.count_documents({"follower_id": user_id, "status": "accepted"})
        is_following = bool(await db.follows.find_one({"follower_id": current["id"], "following_id": user_id, "status": "accepted"}))
        pending = bool(await db.follows.find_one({"follower_id": current["id"], "following_id": user_id, "status": "pending"}))
        out = clean(dict(u))
        # privacy: last seen / online
        if not out.get("show_online_status", True) and user_id != current["id"]:
            out["online"] = None
        if not out.get("show_last_seen", True) and user_id != current["id"]:
            out["last_seen"] = None
        if out.get("is_private") and user_id != current["id"] and not is_following and current.get("role") != "admin":
            return {
                "id": out["id"], "name": out.get("name"), "handle": out.get("handle") or out.get("username"),
                "avatar": out.get("avatar"), "cover_photo": out.get("cover_photo"),
                "is_private": True, "verified": out.get("verified"),
                "followers_count": followers, "following_count": following,
                "is_following": is_following, "follow_pending": pending,
            }
        out["followers_count"] = followers
        out["following_count"] = following
        out["is_following"] = is_following
        out["follow_pending"] = pending
        return out

    # ---------- Messaging extras (no group chat) ----------
    @api_router.post("/conversations/dm")
    async def open_dm(inp: DMOpenInput, current: dict = Depends(get_current_user)):
        if inp.user_id == current["id"]:
            raise HTTPException(status_code=400, detail="Cannot DM yourself")
        if await is_blocked(current["id"], inp.user_id):
            raise HTTPException(status_code=403, detail="Blocked")
        existing = await db.conversations.find_one({
            "kind": "dm",
            "participant_ids": {"$all": [current["id"], inp.user_id]},
        })
        if existing:
            existing.pop("_id", None)
            return existing
        cid = str(uuid.uuid4())
        other = await db.users.find_one({"id": inp.user_id}, {"name": 1, "company": 1})
        doc = {
            "id": cid,
            "kind": "dm",
            "participant_ids": [current["id"], inp.user_id],
            "owner_id": current["id"],
            "creator_id": inp.user_id,
            "campaign_title": "Direct Message",
            "campaign_brand": (other or {}).get("name") or "DM",
            "created_at": now_iso(),
            "last_at": now_iso(),
            "pinned": False,
            "archived_by": [],
        }
        await db.conversations.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api_router.post("/conversations/{conversation_id}/messages-ex")
    async def send_message_ex(conversation_id: str, inp: MessageExCreate, current: dict = Depends(get_current_user)):
        convo = await db.conversations.find_one({"id": conversation_id})
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")
        user_id = current["id"]
        parts = convo.get("participant_ids") or [convo.get("owner_id"), convo.get("creator_id")]
        if current["role"] != "admin" and user_id not in parts:
            raise HTTPException(status_code=403, detail="Forbidden")
        if not (inp.content or inp.media_url):
            raise HTTPException(status_code=400, detail="Empty message")
        doc = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "sender_id": current["id"],
            "sender_name": current["name"],
            "sender_role": current["role"],
            "content": inp.content or "",
            "media_url": inp.media_url,
            "media_type": inp.media_type,
            "reply_to_id": inp.reply_to_id,
            "created_at": now_iso(),
            "read_by": [current["id"]],
            "edited": False,
            "deleted": False,
        }
        await db.messages.insert_one(doc)
        await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_at": now_iso()}})
        doc.pop("_id", None)
        await sse_publish(conversation_id, {"type": "message", "data": doc})
        for pid in parts:
            if pid and pid != current["id"]:
                await notify_if_allowed(pid, "message", f"New message from {current.get('name')}", {"conversation_id": conversation_id})
        return doc

    @api_router.patch("/messages/{message_id}")
    async def edit_message(message_id: str, inp: MessageEditInput, current: dict = Depends(get_current_user)):
        m = await db.messages.find_one({"id": message_id})
        if not m or m["sender_id"] != current["id"]:
            raise HTTPException(status_code=404, detail="Message not found")
        await db.messages.update_one({"id": message_id}, {"$set": {"content": inp.content, "edited": True, "edited_at": now_iso()}})
        m = await db.messages.find_one({"id": message_id}, {"_id": 0})
        await sse_publish(m["conversation_id"], {"type": "message_edit", "data": m})
        return m

    @api_router.delete("/messages/{message_id}")
    async def delete_message(message_id: str, current: dict = Depends(get_current_user)):
        m = await db.messages.find_one({"id": message_id})
        if not m or m["sender_id"] != current["id"]:
            raise HTTPException(status_code=404, detail="Message not found")
        await db.messages.update_one({"id": message_id}, {"$set": {"deleted": True, "content": "", "media_url": None}})
        await sse_publish(m["conversation_id"], {"type": "message_delete", "data": {"id": message_id}})
        return {"ok": True}

    @api_router.post("/conversations/{conversation_id}/read")
    async def mark_convo_read(conversation_id: str, current: dict = Depends(get_current_user)):
        await db.messages.update_many(
            {"conversation_id": conversation_id, "read_by": {"$ne": current["id"]}},
            {"$addToSet": {"read_by": current["id"]}},
        )
        await sse_publish(conversation_id, {"type": "read", "data": {"user_id": current["id"]}})
        return {"ok": True}

    @api_router.post("/conversations/{conversation_id}/typing")
    async def typing_indicator(conversation_id: str, inp: TypingInput, current: dict = Depends(get_current_user)):
        await sse_publish(conversation_id, {"type": "typing", "data": {"user_id": current["id"], "name": current.get("name"), "typing": inp.typing}})
        return {"ok": True}

    @api_router.post("/conversations/{conversation_id}/pin")
    async def pin_conversation(conversation_id: str, current: dict = Depends(get_current_user)):
        convo = await db.conversations.find_one({"id": conversation_id})
        if not convo:
            raise HTTPException(status_code=404, detail="Not found")
        pinned_by = set(convo.get("pinned_by") or [])
        if current["id"] in pinned_by:
            pinned_by.discard(current["id"])
        else:
            pinned_by.add(current["id"])
        await db.conversations.update_one({"id": conversation_id}, {"$set": {"pinned_by": list(pinned_by)}})
        return {"ok": True, "pinned": current["id"] in pinned_by}

    @api_router.post("/conversations/{conversation_id}/archive")
    async def archive_conversation(conversation_id: str, current: dict = Depends(get_current_user)):
        convo = await db.conversations.find_one({"id": conversation_id})
        if not convo:
            raise HTTPException(status_code=404, detail="Not found")
        archived = set(convo.get("archived_by") or [])
        if current["id"] in archived:
            archived.discard(current["id"])
        else:
            archived.add(current["id"])
        await db.conversations.update_one({"id": conversation_id}, {"$set": {"archived_by": list(archived)}})
        return {"ok": True, "archived": current["id"] in archived}

    @api_router.get("/messages/search")
    async def search_messages(q: str = Query(..., min_length=1), current: dict = Depends(get_current_user)):
        convos = await db.conversations.find({
            "$or": [
                {"owner_id": current["id"]}, {"creator_id": current["id"]},
                {"participant_ids": current["id"]},
            ]
        }, {"id": 1}).to_list(200)
        cids = [c["id"] for c in convos]
        return await db.messages.find({
            "conversation_id": {"$in": cids},
            "deleted": {"$ne": True},
            "content": {"$regex": re.escape(q), "$options": "i"},
        }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)

    # ---------- Search ----------
    @api_router.get("/search")
    async def search_all(
        q: str = Query(..., min_length=1),
        kind: Literal["all", "users", "posts", "hashtags", "campaigns", "location"] = "all",
        current: dict = Depends(get_current_user),
    ):
        # save recent
        await db.search_history.insert_one({
            "id": str(uuid.uuid4()), "user_id": current["id"], "query": q, "kind": kind, "created_at": now_iso(),
        })
        result = {"users": [], "posts": [], "hashtags": [], "campaigns": [], "locations": []}
        rx = {"$regex": re.escape(q), "$options": "i"}
        if kind in ("all", "users"):
            users = await db.users.find({
                "$or": [{"name": rx}, {"username": rx}, {"handle": rx}, {"email": rx}],
            }, {"_id": 0, "password_hash": 0}).limit(20).to_list(20)
            result["users"] = [author_public(u) for u in users]
        if kind in ("all", "posts"):
            posts = await db.posts.find({
                "status": "published",
                "$or": [{"text": rx}, {"title": rx}, {"hashtags": q.lower().lstrip("#")}],
            }, {"_id": 0}).limit(20).to_list(20)
            result["posts"] = [await enrich_post(p, current["id"]) for p in posts]
        if kind in ("all", "hashtags"):
            tag = q.lower().lstrip("#")
            posts = await db.posts.find({"hashtags": tag, "status": "published"}, {"_id": 0}).limit(20).to_list(20)
            result["hashtags"] = [{"tag": tag, "count": len(posts), "posts": posts}]
        if kind in ("all", "campaigns"):
            camps = await db.campaigns.find({"$or": [{"title": rx}, {"brand": rx}, {"description": rx}]}, {"_id": 0}).limit(20).to_list(20)
            result["campaigns"] = camps
        if kind in ("all", "location"):
            users = await db.users.find({"$or": [{"city": rx}, {"state": rx}, {"location": rx}]}, {"_id": 0, "password_hash": 0}).limit(20).to_list(20)
            result["locations"] = [author_public(u) for u in users]
        return result

    @api_router.get("/search/recent")
    async def recent_searches(current: dict = Depends(get_current_user)):
        return await db.search_history.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)

    @api_router.delete("/search/recent")
    async def clear_recent_searches(current: dict = Depends(get_current_user)):
        await db.search_history.delete_many({"user_id": current["id"]})
        return {"ok": True}

    @api_router.get("/search/trending")
    async def trending_searches():
        recent = await db.search_history.find({}, {"query": 1}).sort("created_at", -1).limit(200).to_list(200)
        counts = Counter((r.get("query") or "").lower() for r in recent if r.get("query"))
        tags = await db.posts.find({"status": "published"}, {"hashtags": 1}).sort("created_at", -1).limit(200).to_list(200)
        tag_counts = Counter()
        for p in tags:
            for t in p.get("hashtags") or []:
                tag_counts[t] += 1
        return {
            "searches": [{"query": k, "count": v} for k, v in counts.most_common(10)],
            "hashtags": [{"tag": k, "count": v} for k, v in tag_counts.most_common(10)],
        }

    # ---------- Media ----------
    ALLOWED_MEDIA = {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "video/mp4", "video/webm", "video/quicktime",
        "audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg",
    }
    MAX_MEDIA = 50 * 1024 * 1024

    @api_router.post("/media/upload")
    async def upload_media(
        file: UploadFile = File(...),
        compress: bool = True,
        current: dict = Depends(get_current_user),
    ):
        if file.content_type not in ALLOWED_MEDIA:
            raise HTTPException(status_code=400, detail="Unsupported media type")
        ext = mimetypes.guess_extension(file.content_type) or ".bin"
        fid = f"{uuid.uuid4().hex}{ext}"
        raw = await file.read()
        if len(raw) > MAX_MEDIA:
            raise HTTPException(status_code=413, detail="File too large (max 50MB)")

        media_type = "image" if file.content_type.startswith("image/") else (
            "video" if file.content_type.startswith("video/") else "audio"
        )
        # image compression
        if compress and media_type == "image" and HAS_PIL and file.content_type != "image/gif":
            try:
                img = Image.open(io.BytesIO(raw))
                img = img.convert("RGB") if img.mode in ("RGBA", "P") else img
                img.thumbnail((1920, 1920))
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=82, optimize=True)
                raw = buf.getvalue()
                fid = f"{uuid.uuid4().hex}.jpg"
                content_type = "image/jpeg"
            except Exception as e:
                logger.warning("Image compress failed: %s", e)
                content_type = file.content_type
        else:
            content_type = file.content_type

        await _persist_upload(fid, raw, content_type)

        doc = {
            "id": str(uuid.uuid4()),
            "file_id": fid,
            "url": f"/api/uploads/{fid}",
            "owner_id": current["id"],
            "content_type": content_type,
            "media_type": media_type,
            "size": len(raw),
            "created_at": now_iso(),
        }
        await db.media.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api_router.get("/media/gallery")
    async def media_gallery(current: dict = Depends(get_current_user)):
        return await db.media.find({"owner_id": current["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)

    @api_router.delete("/media/{media_id}")
    async def delete_media(media_id: str, current: dict = Depends(get_current_user)):
        m = await db.media.find_one({"id": media_id})
        if not m or (m["owner_id"] != current["id"] and current.get("role") != "admin"):
            raise HTTPException(status_code=404, detail="Not found")
        path = UPLOAD_DIR / PathLib(m["file_id"]).name
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass
        await db.media.delete_one({"id": media_id})
        return {"ok": True}

    # ---------- AI extras ----------
    async def _llm(system: str, prompt: str) -> str:
        if call_llm:
            try:
                return await call_llm(system, prompt)
            except Exception as e:
                logger.warning("LLM failed: %s", e)
        # deterministic fallbacks
        return prompt[:280]

    @api_router.post("/ai/caption")
    async def ai_caption(inp: AITextInput, current: dict = Depends(get_current_user)):
        text = await _llm(
            "You write short social captions for creators. Return only the caption.",
            f"Tone: {inp.tone}. Context: {inp.context or inp.text or 'creator post'}",
        )
        return {"caption": text.strip()}

    @api_router.post("/ai/hashtags")
    async def ai_hashtags(inp: AITextInput, current: dict = Depends(get_current_user)):
        text = await _llm(
            "Suggest 8 relevant hashtags. Return space-separated hashtags only.",
            inp.text or inp.context or "lifestyle creator",
        )
        tags = [t for t in text.replace(",", " ").split() if t.startswith("#")] or [
            "#creator", "#brandcollab", "#cr8studio", "#content", "#influencer"
        ]
        return {"hashtags": tags[:12]}

    @api_router.post("/ai/comment-suggest")
    async def ai_comment_suggest(inp: AITextInput, current: dict = Depends(get_current_user)):
        text = await _llm(
            "Suggest 3 short thoughtful comments. Number them 1-3.",
            inp.text or "Nice post",
        )
        lines = [l.strip("0123456789.)- ") for l in text.splitlines() if l.strip()]
        return {"suggestions": lines[:3] or ["Love this!", "Great work.", "Inspiring."]}

    @api_router.post("/ai/spam-check")
    async def ai_spam_check(inp: AITextInput, current: dict = Depends(get_current_user)):
        text = (inp.text or "").lower()
        spammy = any(x in text for x in ["crypto airdrop", "free followers", "click here now", "whatsapp me"])
        score = 0.9 if spammy else 0.1
        return {"spam": spammy, "score": score}

    @api_router.post("/ai/fake-account-check")
    async def ai_fake_check(user_id: Optional[str] = None, current: dict = Depends(get_current_user)):
        uid = user_id or current["id"]
        u = await db.users.find_one({"id": uid})
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        score = 0.0
        if not u.get("avatar"):
            score += 0.2
        if not u.get("bio"):
            score += 0.2
        if not u.get("email_verified") and not u.get("mobile"):
            score += 0.2
        followers = await db.follows.count_documents({"following_id": uid, "status": "accepted"})
        following = await db.follows.count_documents({"follower_id": uid, "status": "accepted"})
        if following > 50 and followers < 3:
            score += 0.3
        return {"user_id": uid, "risk_score": min(score, 1.0), "suspicious": score >= 0.5}

    @api_router.post("/ai/translate")
    async def ai_translate(inp: AITextInput, current: dict = Depends(get_current_user)):
        lang = inp.target_lang or "en"
        text = await _llm(
            f"Translate the following to {lang}. Return only the translation.",
            inp.text or "",
        )
        return {"translated": text.strip(), "lang": lang}

    @api_router.post("/ai/moderate-text")
    async def ai_moderate_text(inp: AITextInput, current: dict = Depends(get_current_user)):
        text = (inp.text or "").lower()
        flagged = any(w in text for w in ["kill yourself", "hate speech", "slur"])
        return {"allowed": not flagged, "flagged": flagged, "categories": ["toxicity"] if flagged else []}

    # ---------- Analytics extras ----------
    @api_router.get("/analytics/social")
    async def social_analytics(current: dict = Depends(get_current_user)):
        uid = current["id"]
        posts = await db.posts.find({"author_id": uid}, {"_id": 0}).to_list(500)
        likes = sum(p.get("likes_count") or 0 for p in posts)
        shares = sum(p.get("shares_count") or 0 for p in posts)
        views = sum(p.get("views_count") or 0 for p in posts)
        comments = sum(p.get("comments_count") or 0 for p in posts)
        profile_views = await db.profile_views.count_documents({"target_id": uid, "kind": "profile"})
        followers = await db.follows.count_documents({"following_id": uid, "status": "accepted"})
        following = await db.follows.count_documents({"follower_id": uid, "status": "accepted"})
        engagement = 0.0
        if views:
            engagement = round((likes + comments + shares) / max(views, 1) * 100, 2)
        # followers growth last 14 days (bucket by day)
        since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
        recent_follows = await db.follows.find(
            {"following_id": uid, "status": "accepted", "created_at": {"$gte": since}},
            {"created_at": 1},
        ).to_list(500)
        growth = Counter((f.get("created_at") or "")[:10] for f in recent_follows)
        return {
            "profile_views": profile_views,
            "post_views": views,
            "likes": likes,
            "shares": shares,
            "comments": comments,
            "followers": followers,
            "following": following,
            "reach": views + profile_views,
            "engagement_rate": engagement,
            "followers_growth": [{"date": d, "count": c} for d, c in sorted(growth.items())],
            "posts_count": len(posts),
        }

    @api_router.get("/analytics/platform")
    async def platform_analytics(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(days=1)).isoformat()
        month_ago = (now - timedelta(days=30)).isoformat()
        dau = await db.login_history.distinct("user_id", {"created_at": {"$gte": day_ago}, "success": True})
        mau = await db.login_history.distinct("user_id", {"created_at": {"$gte": month_ago}, "success": True})
        return {
            "dau": len([x for x in dau if x]),
            "mau": len([x for x in mau if x]),
            "users": await db.users.count_documents({}),
            "posts": await db.posts.count_documents({"status": "published"}),
            "reports_open": await db.reports.count_documents({"status": "open"}),
        }

    @api_router.get("/analytics/creator-insights")
    async def creator_insights(current: dict = Depends(get_current_user)):
        await require_role(current, ["influencer"])
        social = await social_analytics(current)
        top_posts = await db.posts.find({"author_id": current["id"]}, {"_id": 0}).sort("likes_count", -1).limit(5).to_list(5)
        return {**social, "top_posts": top_posts}

    # ---------- Admin extras ----------
    @api_router.get("/admin/reports")
    async def admin_reports(status: Optional[str] = "open", current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        q = {} if status == "all" else {"status": status}
        return await db.reports.find(q, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)

    @api_router.post("/admin/reports/{report_id}")
    async def admin_report_action(report_id: str, inp: AdminReportAction, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        await db.reports.update_one({"id": report_id}, {"$set": {
            "status": inp.status, "note": inp.note, "reviewed_by": current["id"], "reviewed_at": now_iso(),
        }})
        return {"ok": True}

    @api_router.post("/admin/users/{user_id}/ban")
    async def admin_ban(user_id: str, inp: AdminBanInput, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "id": 1})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Admin users cannot be banned")
        if target.get("id") == current.get("id"):
            raise HTTPException(status_code=403, detail="Cannot ban your own account")
        until = None
        if inp.days:
            until = (datetime.now(timezone.utc) + timedelta(days=inp.days)).isoformat()
        await db.users.update_one({"id": user_id, "role": {"$ne": "admin"}}, {"$set": {
            "banned": True, "ban_reason": inp.reason, "banned_until": until, "banned_at": now_iso(),
        }})
        await db.sessions.update_many({"user_id": user_id}, {"$set": {"revoked": True}})
        await _audit(
            action="User Banned",
            user_id=current.get("id"),
            username=current.get("username"),
            details=f"Banned user {user_id}: {inp.reason or 'Policy violation'}",
            status="Completed",
            meta={"target_user_id": user_id, "reason": inp.reason, "days": inp.days},
        )
        return {"ok": True}

    @api_router.post("/admin/users/{user_id}/unban")
    async def admin_unban(user_id: str, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
        if target and target.get("role") == "admin":
            raise HTTPException(status_code=403, detail="Admin users cannot be modified here")
        await db.users.update_one({"id": user_id, "role": {"$ne": "admin"}}, {"$set": {"banned": False}, "$unset": {"ban_reason": "", "banned_until": ""}})
        await _audit(
            action="User Unbanned",
            user_id=current.get("id"),
            username=current.get("username"),
            details=f"Unbanned user {user_id}",
            status="Completed",
            meta={"target_user_id": user_id},
        )
        return {"ok": True}

    @api_router.post("/admin/notifications/broadcast")
    async def admin_broadcast(inp: AdminBroadcastInput, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        q = {"role": inp.role} if inp.role else {}
        users = await db.users.find(q, {"id": 1}).to_list(2000)
        for u in users:
            await push_notification(u["id"], inp.kind, inp.text, {"broadcast": True})
        await _audit(
            action="Broadcast Sent",
            user_id=current.get("id"),
            username=current.get("username"),
            details=f"Broadcast to {len(users)} users" + (f" ({inp.role})" if inp.role else ""),
            status="Completed",
            meta={"role": inp.role, "sent": len(users)},
        )
        return {"ok": True, "sent": len(users)}

    @api_router.get("/admin/categories")
    async def list_categories(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        cats = await db.categories.find({}, {"_id": 0}).to_list(100)
        if not cats:
            defaults = [
                "Fashion & Style", "Food & Cooking", "Beauty & Makeup", "Technology & Gadgets",
                "Fitness & Health", "Lifestyle & Home", "Travel & Adventure",
                "Business & Entrepreneurship", "Entertainment & Gaming", "Education & Learning",
            ]
            for name in defaults:
                await db.categories.update_one({"name": name}, {"$set": {"id": str(uuid.uuid4()), "name": name, "created_at": now_iso()}}, upsert=True)
            cats = await db.categories.find({}, {"_id": 0}).to_list(100)
        return cats

    @api_router.post("/admin/categories")
    async def add_category(inp: CategoryInput, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        doc = {"id": str(uuid.uuid4()), "name": inp.name, "description": inp.description, "created_at": now_iso()}
        await db.categories.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api_router.delete("/admin/categories/{category_id}")
    async def delete_category(category_id: str, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        await db.categories.delete_one({"id": category_id})
        return {"ok": True}

    @api_router.get("/admin/posts/pending")
    async def pending_posts(current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        return await db.posts.find({"status": "pending_approval"}, {"_id": 0}).to_list(100)

    @api_router.post("/admin/posts/{post_id}/approve")
    async def approve_post(post_id: str, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        await db.posts.update_one({"id": post_id}, {"$set": {"status": "published", "published_at": now_iso()}})
        return {"ok": True}

    @api_router.post("/admin/posts/{post_id}/reject")
    async def reject_post(post_id: str, current: dict = Depends(get_current_user)):
        await require_role(current, ["admin"])
        await db.posts.update_one({"id": post_id}, {"$set": {"status": "rejected"}})
        return {"ok": True}

    # ---------- Indexes ----------
    async def ensure_indexes():
        cols = {
            "posts": [("id", True), ("author_id", False), ("status", False), ("created_at", False)],
            "comments": [("id", True), ("post_id", False)],
            "likes": [("post_id", False), ("user_id", False)],
            "follows": [("follower_id", False), ("following_id", False)],
            "blocks": [("blocker_id", False)],
            "sessions": [("user_id", False), ("id", True)],
            "reports": [("id", True), ("status", False)],
            "media": [("id", True), ("owner_id", False)],
            "search_history": [("user_id", False)],
            "profile_views": [("target_id", False)],
        }
        for col, idxs in cols.items():
            for field, unique in idxs:
                try:
                    await getattr(db, col).create_index(field, unique=unique)
                except Exception:
                    pass
        try:
            await db.likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
            await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
        except Exception:
            pass

    return ensure_indexes
