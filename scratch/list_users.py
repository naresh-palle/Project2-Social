import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def main():
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    print(f"Total Users: {len(users)}\n" + "="*80)
    for u in users:
        print(f"ID: {u.get('id')}")
        print(f"Role: {u.get('role')} | Name: {u.get('name')} | Email: {u.get('email')}")
        print(f"Company: {u.get('company')} | Handle: {u.get('handle')}")
        print(f"Avatar: {u.get('avatar')}")
        print(f"Bio: {u.get('bio')}")
        print("-" * 80)

if __name__ == "__main__":
    asyncio.run(main())
