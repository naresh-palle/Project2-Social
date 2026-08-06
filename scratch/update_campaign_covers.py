import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

COVER_POOL = [
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&q=80&w=1200",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200"
]

async def update_covers():
    campaigns = await db.campaigns.find({}).to_list(None)
    print(f"Checking {len(campaigns)} campaigns in database...")

    updated = 0
    for idx, c in enumerate(campaigns):
        old_cover = c.get("cover")
        if not old_cover or "photo-1611930022073-b7a4ba5fcccd" in old_cover:
            new_cover = COVER_POOL[idx % len(COVER_POOL)]
            await db.campaigns.update_one({"id": c["id"]}, {"$set": {"cover": new_cover}})
            print(f"Updated cover for '{c.get('title')}': {new_cover}")
            updated += 1

    print(f"Updated {updated} campaign cover images in MongoDB Atlas!")

if __name__ == "__main__":
    asyncio.run(update_covers())
