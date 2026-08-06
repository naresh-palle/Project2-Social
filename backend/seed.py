import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def seed():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = client[os.environ.get("DB_NAME", "cr8_social")]

    users = [
        # ADMIN
        {
            "id": str(uuid.uuid4()), "email": "admin@cr8.studio", "password_hash": hash_password("admin123"),
            "name": "Super Admin", "role": "admin", "handle": None, "company": None, "avatar": None,
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        # INFLUENCERS
        {
            "id": str(uuid.uuid4()), "email": "arjun@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Arjun Sharma", "role": "influencer", "handle": "arjun.tech", "company": None,
            "mobile": "9876543210", "pincode": "400001", "city": "Mumbai", "state": "Maharashtra",
            "avatar": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["tech", "design"], "followers": 150000, "platforms": ["Instagram", "YouTube"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "priya@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Priya Kapoor", "role": "influencer", "handle": "priyastyles", "company": None,
            "mobile": "9876543211", "pincode": "110001", "city": "New Delhi", "state": "Delhi",
            "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["fashion", "luxury", "beauty"], "followers": 850000, "platforms": ["Instagram"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "rohan@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Rohan Desai", "role": "influencer", "handle": "rohan.fit", "company": None,
            "mobile": "9876543212", "pincode": "560001", "city": "Bangalore", "state": "Karnataka",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["wellness"], "followers": 320000, "platforms": ["YouTube", "Instagram"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "sneha@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Sneha Reddy", "role": "influencer", "handle": "sneha.travels", "company": None,
            "mobile": "9876543213", "pincode": "500001", "city": "Hyderabad", "state": "Telangana",
            "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["luxury"], "followers": 120000, "platforms": ["Instagram"],
            "onboarding_status": "completed", "agent_approved": False, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "karthik@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Karthik Iyer", "role": "influencer", "handle": "karthik.code", "company": None,
            "mobile": "9876543214", "pincode": "600001", "city": "Chennai", "state": "Tamil Nadu",
            "avatar": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["tech"], "followers": 95000, "platforms": ["YouTube", "LinkedIn"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "anya@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Anya Singh", "role": "influencer", "handle": "anya.arts", "company": None,
            "mobile": "9876543215", "pincode": "700001", "city": "Kolkata", "state": "West Bengal",
            "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["design", "fashion"], "followers": 210000, "platforms": ["Instagram"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "vikram@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Vikram Patel", "role": "influencer", "handle": "vikram.food", "company": None,
            "mobile": "9876543216", "pincode": "380001", "city": "Ahmedabad", "state": "Gujarat",
            "avatar": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["wellness"], "followers": 450000, "platforms": ["YouTube"],
            "onboarding_status": "completed", "agent_approved": False, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "neha@cr8.studio", "password_hash": hash_password("creator123"),
            "name": "Neha Joshi", "role": "influencer", "handle": "neha.vibes", "company": None,
            "mobile": "9876543217", "pincode": "411001", "city": "Pune", "state": "Maharashtra",
            "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=256&h=256",
            "niches": ["beauty", "fashion"], "followers": 600000, "platforms": ["Instagram"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },

        # BRANDS / OWNERS
        {
            "id": str(uuid.uuid4()), "email": "zomato@cr8.studio", "password_hash": hash_password("company123"),
            "name": "Deepinder G.", "role": "owner", "handle": None, "company": "Zomato",
            "mobile": "9876543301", "pincode": "110001", "city": "New Delhi", "state": "Delhi",
            "avatar": "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&q=80&w=256&h=256",
            "industry": "Food Tech", "niches": ["wellness"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "boat@cr8.studio", "password_hash": hash_password("company123"),
            "name": "Aman Gupta", "role": "owner", "handle": None, "company": "boAt Lifestyle",
            "mobile": "9876543302", "pincode": "400001", "city": "Mumbai", "state": "Maharashtra",
            "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256&h=256",
            "industry": "Electronics", "niches": ["tech", "fashion"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "nykaa@cr8.studio", "password_hash": hash_password("company123"),
            "name": "Falguni N.", "role": "owner", "handle": None, "company": "Nykaa",
            "mobile": "9876543303", "pincode": "400001", "city": "Mumbai", "state": "Maharashtra",
            "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256&h=256",
            "industry": "Beauty", "niches": ["beauty", "luxury"],
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },

        # AGENTS
        {
            "id": str(uuid.uuid4()), "email": "agent.karan@cr8.studio", "password_hash": hash_password("agent123"),
            "name": "Karan Johar", "role": "agent", "handle": None, "company": "Dharma Talent",
            "mobile": "9876543401", "pincode": "400050", "city": "Mumbai", "state": "Maharashtra",
            "avatar": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256&h=256",
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        },
        {
            "id": str(uuid.uuid4()), "email": "agent.shruti@cr8.studio", "password_hash": hash_password("agent123"),
            "name": "Shruti Hassan", "role": "agent", "handle": None, "company": "South Stars Media",
            "mobile": "9876543402", "pincode": "600001", "city": "Chennai", "state": "Tamil Nadu",
            "avatar": "https://images.unsplash.com/photo-1598550874175-4d0ef43ee90d?auto=format&fit=crop&q=80&w=256&h=256",
            "onboarding_status": "completed", "agent_approved": True, "created_at": now_iso()
        }
    ]

    for u in users:
        await db.users.delete_many({"email": u["email"]})
        await db.users.insert_one(u)
        print(f"Created user: {u['email']} | Role: {u['role']} | Name: {u['name']}")

if __name__ == "__main__":
    asyncio.run(seed())
