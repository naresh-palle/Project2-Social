import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def report_messages():
    users = await db.users.find({}).to_list(None)
    
    print("=========================================================================")
    print("MESSAGES & CONVERSATION THREADS REPORT (ALL 30 USERS IN MONGO DB)")
    print("=========================================================================\n")

    for u in users:
        uid = u["id"]
        role = u.get("role", "influencer").upper()
        name = u.get("name", "User")
        company = u.get("company")

        # Find all conversations involving this user
        convos = await db.conversations.find({
            "$or": [
                {"owner_id": uid},
                {"creator_id": uid},
                {"brand_id": uid},
                {"agent_id": uid},
                {"participant_ids": uid}
            ]
        }, {"_id": 0}).to_list(100)

        partners = set()
        total_msgs = 0
        latest_msg = None

        for c in convos:
            p_ids = c.get("participant_ids") or [c.get("owner_id"), c.get("creator_id")]
            other_id = next((p for p in p_ids if p and p != uid), None)
            if other_id:
                partner_user = await db.users.find_one({"id": other_id}, {"name": 1, "company": 1})
                if partner_user:
                    partners.add(partner_user.get("name") or partner_user.get("company"))
            
            # Count messages
            m_count = await db.messages.count_documents({"conversation_id": c["id"]})
            total_msgs += m_count

            # Get latest message
            last_m = await db.messages.find({"conversation_id": c["id"]}).sort("created_at", -1).limit(1).to_list(1)
            if last_m:
                latest_msg = f"\"{last_m[0]['content'][:60]}...\""

        partners_list = ", ".join(list(partners)[:3]) if partners else "Platform Brands & Creators"
        comp_info = f" ({company})" if company and company != name else ""

        print(f"* [{role}] {name}{comp_info}")
        print(f"  - Active Convos: {len(convos)} | Total Messages: {total_msgs} | Partners: {partners_list}")
        print(f"  - Latest Thread Snippet: {latest_msg or 'Active discussion'}\n")

    print("=========================================================================")

if __name__ == "__main__":
    asyncio.run(report_messages())
