import asyncio
import os
import random
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

# Fallback URI just in case, but prefer env
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

# Mock Data
CITIES = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "London", "New York", "Dubai", "Paris", "Tokyo", "Sydney"]
EXPERIENCES = ["< 1 year", "1-2 years", "3-5 years", "5+ years", "10+ years"]
MESSAGES = [
    "Hey! We love your recent posts and would love to collaborate.",
    "Are you available for a campaign next month?",
    "Could you share your updated rate card?",
    "The client loved the draft! Please proceed with publishing.",
    "Let's jump on a quick call to discuss the deliverables.",
    "Payment has been processed, please check your wallet.",
    "Would you be open to a long-term ambassadorship?"
]
PORTFOLIOS = [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80",
    "https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?w=800&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80"
]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def seed_data():
    print("Fetching users...")
    creators = await db.users.find({"role": "influencer"}).to_list(None)
    brands = await db.users.find({"role": "owner"}).to_list(None)
    
    if not creators or not brands:
        print("Need at least 1 creator and 1 brand to seed complex data.")
        return

    print(f"Found {len(creators)} creators and {len(brands)} brands. Seeding started...")

    # 1. Update Creators with Profile Data & Wallets
    for c in creators:
        wallet_balance = random.randint(5000, 150000)
        updates = {
            "wallet": wallet_balance,
            "city": random.choice(CITIES) if not c.get("city") else c.get("city"),
            "experience": random.choice(EXPERIENCES) if not c.get("experience") else c.get("experience"),
            "portfolio": random.sample(PORTFOLIOS, k=4) if not c.get("portfolio") else c.get("portfolio")
        }
        if not c.get("bio"):
            updates["bio"] = f"Creating exceptional content for {random.choice(['lifestyle', 'tech', 'fashion', 'food'])} enthusiasts globally."
            
        await db.users.update_one({"id": c["id"]}, {"$set": updates})

    # 2. Update Brands with Wallets
    for b in brands:
        await db.users.update_one({"id": b["id"]}, {"$set": {"wallet": random.randint(500000, 2000000)}})

    # 3. Generate Messages
    print("Generating Messages...")
    # Clear old mock messages
    await db.messages.delete_many({"mock": True})
    for _ in range(30):
        brand = random.choice(brands)
        creator = random.choice(creators)
        for i in range(random.randint(2, 6)):
            sender = brand["id"] if i % 2 == 0 else creator["id"]
            receiver = creator["id"] if i % 2 == 0 else brand["id"]
            await db.messages.insert_one({
                "id": f"msg_{random.randint(100000, 999999)}",
                "sender_id": sender,
                "receiver_id": receiver,
                "content": random.choice(MESSAGES),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 10), hours=random.randint(0, 24))).isoformat(),
                "read": True,
                "mock": True
            })

    # 4. Generate Invitations
    print("Generating Invitations...")
    await db.invitations.delete_many({"mock": True})
    campaigns = await db.campaigns.find().to_list(None)
    if campaigns:
        for _ in range(20):
            camp = random.choice(campaigns)
            creator = random.choice(creators)
            try:
                await db.invitations.insert_one({
                    "id": f"inv_{random.randint(10000,99999)}",
                    "campaign_id": camp["id"],
                    "campaign_title": camp["title"],
                    "creator_id": creator["id"],
                    "creator_name": creator["name"],
                    "brand_id": camp.get("brand_id", camp.get("owner_id", brand["id"])),
                    "brand_name": camp.get("brand_name", camp.get("owner_name", brand["name"])),
                    "status": random.choice(["pending", "accepted", "declined"]),
                    "message": "We think you'd be a perfect fit for this campaign!",
                    "created_at": now_iso(),
                    "mock": True
                })
            except Exception:
                pass

    # 5. Generate Payments / Transactions
    print("Generating Payments...")
    await db.payments.delete_many({"mock": True})
    for _ in range(15):
        creator = random.choice(creators)
        brand = random.choice(brands)
        amount = random.randint(10000, 100000)
        await db.payments.insert_one({
            "id": f"pay_{random.randint(10000,99999)}",
            "creator_id": creator["id"],
            "creator": creator["name"],
            "brand_id": brand["id"],
            "brand": brand["name"],
            "amount": amount,
            "status": "completed",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
            "mock": True
        })
        
    print("✅ Successfully seeded mock profiles, wallets, messages, invitations, and payments!")

if __name__ == "__main__":
    asyncio.run(seed_data())
