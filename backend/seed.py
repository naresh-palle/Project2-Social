import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def seed():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["cr8_social"]

    users = [
        {
            "id": str(uuid.uuid4()), "email": "admin@cr8.studio", "password_hash": hash_password("admin123"),
            "name": "Super Admin", "role": "admin", "handle": None, "company": None,
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "creator@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Arjun Creator", "role": "influencer", "handle": "arjun.creates", "company": None,
            "mobile": "9876543210", "pincode": "400001", "city": "Mumbai", "state": "Maharashtra",
            "niches": ["Technology", "Gadgets", "AI & Tech"], "followers": 150000, 
            "platforms": ["Instagram", "YouTube", "Moj"],
            "onboarding_status": "completed", "agent_approved": False, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "company@cr8.studio", "password_hash": hash_password("company123"),
            "name": "Riya Brand Manager", "role": "owner", "handle": None, "company": "TechTribe India",
            "mobile": "9876543211", "pincode": "400001", "city": "Mumbai", "state": "Maharashtra",
            "industry": "Technology", "niches": ["Technology"],
            "onboarding_status": "completed", "agent_approved": False, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "agent@cr8.studio", "password_hash": hash_password("agent123"),
            "name": "Karan Agent", "role": "agent", "handle": None, "company": "Karan Talent Agency",
            "mobile": "9876543212", "pincode": "110001", "city": "New Delhi", "state": "Delhi",
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "pending_agent@cr8.studio", "password_hash": hash_password("agent123"),
            "name": "Rahul Agent", "role": "agent", "handle": None, "company": "Rahul Talent",
            "mobile": "9876543213", "pincode": "110001", "city": "New Delhi", "state": "Delhi",
            "onboarding_status": "completed", "agent_approved": False, "created_at": now_iso()
        }
    ]

    for u in users:
        await db.users.delete_many({"email": u["email"]})
        await db.users.insert_one(u)
        print(f"Created user: {u['email']} | Role: {u['role']}")

if __name__ == "__main__":
    asyncio.run(seed())
