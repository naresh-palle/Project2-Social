import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def create_indexes():
    print("Creating indexes to speed up dashboard queries...")
    
    # Dashboard queries rely heavily on these fields
    await db.applications.create_index([("influencer_id", 1)])
    await db.applications.create_index([("influencer_id", 1), ("status", 1)])
    
    await db.invitations.create_index([("creator_id", 1)])
    
    await db.deliverables.create_index([("creator_id", 1)])
    await db.deliverables.create_index([("creator_id", 1), ("status", 1)])
    
    await db.reviews.create_index([("target_id", 1)])
    
    await db.campaigns.create_index([("status", 1)])
    
    await db.users.create_index([("role", 1)])
    await db.users.create_index([("category", 1)])

    print("✅ Indexes created successfully! Creator Dashboard will now load instantly.")

if __name__ == "__main__":
    asyncio.run(create_indexes())
