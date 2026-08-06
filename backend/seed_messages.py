import asyncio
import os
import sys
from datetime import datetime, timedelta
import random
import uuid

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "cr8_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

def now_iso():
    return datetime.utcnow().isoformat() + "Z"

async def seed_messages():
    print("Fetching users and campaigns...")
    creators = await db.users.find({"role": "influencer"}).to_list(100)
    brands = await db.users.find({"role": "owner"}).to_list(100)
    campaigns = await db.campaigns.find({}).to_list(100)
    
    if not creators or not brands or not campaigns:
        print("Not enough data to seed messages. Seed users and campaigns first.")
        return

    print("Seeding mock conversations and messages...")
    
    mock_messages = [
        "Hey! We loved your recent post and think you'd be a perfect fit for this campaign.",
        "Thank you! The brief looks amazing. I have a few ideas for the visuals.",
        "Great, let's get on a quick call this week to align.",
        "Sounds perfect. Is Thursday at 2 PM EST good for you?",
        "Yes, Thursday works. I'll send over a calendar invite.",
        "Got it. I'll also send a moodboard beforehand so we can brainstorm.",
        "Looking forward to it! Let me know if you need any brand assets.",
        "Will do. Could you share the high-res logos?",
        "Just sent them over via email.",
        "Received! Thanks. I'll start drafting the concepts tonight."
    ]

    # Create some conversations for random campaigns
    for camp in campaigns[:15]:  # Just take the first 15 campaigns
        # Pick 2 random creators to have conversations with this brand
        selected_creators = random.sample(creators, min(2, len(creators)))
        brand = next((b for b in brands if b["id"] == camp["owner_id"]), None)
        
        if not brand:
            brand = random.choice(brands) # fallback
            
        for creator in selected_creators:
            # Ensure conversation exists
            convo = await db.conversations.find_one({
                "campaign_id": camp["id"],
                "owner_id": brand["id"],
                "creator_id": creator["id"]
            })
            
            if not convo:
                cid = str(uuid.uuid4())
                convo = {
                    "id": cid, 
                    "campaign_id": camp["id"], 
                    "owner_id": brand["id"], 
                    "creator_id": creator["id"],
                    "created_at": now_iso(), 
                    "last_at": now_iso()
                }
                await db.conversations.insert_one(convo)
            else:
                cid = convo["id"]
                
            # Insert 3-5 random messages in this conversation
            num_messages = random.randint(3, 8)
            msg_docs = []
            
            # Start from a few days ago
            base_time = datetime.utcnow() - timedelta(days=random.randint(1, 10))
            
            for i in range(num_messages):
                is_brand = i % 2 == 0
                sender = brand if is_brand else creator
                
                msg_time = base_time + timedelta(hours=i * random.uniform(1, 5))
                
                msg_doc = {
                    "id": str(uuid.uuid4()),
                    "conversation_id": cid,
                    "sender_id": sender["id"],
                    "sender_name": sender["name"],
                    "sender_role": sender["role"],
                    "content": mock_messages[i % len(mock_messages)],
                    "created_at": msg_time.isoformat() + "Z"
                }
                msg_docs.append(msg_doc)
            
            if msg_docs:
                await db.messages.insert_many(msg_docs)
                await db.conversations.update_one(
                    {"id": cid}, 
                    {"$set": {"last_at": msg_docs[-1]["created_at"]}}
                )

    print("Successfully seeded mock messages!")

if __name__ == "__main__":
    asyncio.run(seed_messages())
