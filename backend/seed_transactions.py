import asyncio
import os
import uuid
import random
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["cr8_db"]

    owners = await db.users.find({"role": "owner"}).to_list(100)
    influencers = await db.users.find({"role": "influencer"}).to_list(100)

    if not owners or not influencers:
        print("Need at least one owner and one influencer")
        return

    campaigns_to_insert = []
    transactions_to_insert = []

    titles = ["Summer Collection Launch", "Skincare Editorial", "Urban Streetwear Promo", "Tech Gadget Review", "Premium Fragrance Campaign"]

    for _ in range(20):
        owner = random.choice(owners)
        influencer = random.choice(influencers)
        budget = random.randint(50000, 1500000) # INR
        
        cid = str(uuid.uuid4())
        dt = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 120))
        
        camp = {
            "id": cid,
            "owner_id": owner["id"],
            "title": random.choice(titles),
            "brand": owner.get("company", "Brand"),
            "description": "Mock campaign for revenue generation",
            "budget": budget,
            "niches": ["Fashion", "Lifestyle"],
            "platforms": ["instagram"],
            "deliverables": "1 Reel, 2 Stories",
            "status": "completed",
            "accepted_creator_id": influencer["id"],
            "created_at": dt.isoformat(),
        }
        campaigns_to_insert.append(camp)

        # Creator wallet
        tx_id = str(uuid.uuid4())
        tx = {
            "id": tx_id,
            "user_id": influencer["id"],
            "amount": budget,
            "kind": "campaign_payout",
            "note": f"Payout for {camp['title']}",
            "created_at": (dt + timedelta(days=14)).isoformat()
        }
        transactions_to_insert.append(tx)
        
        # Update influencer wallet balance
        await db.users.update_one({"id": influencer["id"]}, {"$inc": {"wallet": budget}})

    if campaigns_to_insert:
        await db.campaigns.insert_many(campaigns_to_insert)
    if transactions_to_insert:
        await db.transactions.insert_many(transactions_to_insert)

    print(f"Seeded {len(campaigns_to_insert)} completed campaigns.")
    print("Run `node_modules/next/dist/docs/` check? Not applicable here.")

asyncio.run(run())
