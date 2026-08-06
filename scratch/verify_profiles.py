import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def verify():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    print(f"Verified Total Users: {len(users)}")
    missing_avatars = 0
    missing_bios = 0

    for u in users:
        role = u.get("role")
        name = u.get("name")
        avatar = u.get("avatar")
        bio = u.get("bio")
        company = u.get("company")
        industry = u.get("industry")

        if not avatar:
            missing_avatars += 1
            print(f"MISSING AVATAR: {role} - {name}")
        if not bio:
            missing_bios += 1
            print(f"MISSING BIO: {role} - {name}")
            
        if role in ["admin", "owner", "agent"]:
            print(f"[{role.upper()}] Name: {name} | Company: {company} | Industry: {industry}")
            print(f"  Avatar: {avatar[:50]}...")
            print(f"  Bio: {bio}")
            print("-" * 60)

    print(f"\nVerification Complete: {missing_avatars} missing avatars, {missing_bios} missing bios.")

if __name__ == "__main__":
    asyncio.run(verify())
