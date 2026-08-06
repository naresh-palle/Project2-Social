import asyncio
import os
import random
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def seed_all_messages():
    print("Fetching all users & campaigns from database...")
    users = await db.users.find({}).to_list(None)
    campaigns = await db.campaigns.find({}).to_list(None)

    if not users:
        print("No users found in database!")
        return

    creators = [u for u in users if u.get("role") == "influencer"]
    owners = [u for u in users if u.get("role") == "owner"]
    agents = [u for u in users if u.get("role") == "agent"]
    admins = [u for u in users if u.get("role") == "admin"]

    print(f"Users found: {len(users)} total ({len(creators)} Creators, {len(owners)} Brands, {len(agents)} Agents, {len(admins)} Admin)")

    # Sample dialogue templates for realistic collaboration
    dialogues = [
        [
            ("owner", "Hi there! Loved your recent portfolio work. Would you be open to collaborating on our upcoming launch campaign?"),
            ("influencer", "Thank you so much! Yes, absolutely. I checked the campaign brief and it aligns perfectly with my audience."),
            ("owner", "Awesome! We are offering ₹45,000 for 1 Instagram Reel and 2 Stories. Does that rate work for you?"),
            ("influencer", "That sounds great! Could we lock in a 10-day turnaround time post-sample arrival?"),
            ("owner", "Perfect. Escrow has been funded. Looking forward to receiving the draft script!")
        ],
        [
            ("influencer", "Hello! I just submitted my pitch for the flagship launch brief. Let me know if you need any extra moodboards."),
            ("owner", "Thanks for the swift application! Your creative concepts look fantastic."),
            ("owner", "We'd like to extend an invitation for a 2-reel package at ₹75,000."),
            ("influencer", "Accepted! I'll start production on the video draft right away.")
        ],
        [
            ("agent", "Greetings from Dharma Talent! Our roster creator is available for your tech showcase campaign next month."),
            ("owner", "Hi Karan! Great to hear. What is their availability and base rate for a dedicated YouTube integration?"),
            ("agent", "Base rate is ₹1,200,000 with guaranteed 250k+ organic views and full licensing rights for 90 days."),
            ("owner", "Approved. We've initiated the escrow payment with the admin desk.")
        ],
        [
            ("admin", "Notice: Platform verification review complete. Your creator studio account has been verified."),
            ("influencer", "Thank you Super Admin! Excited to pitch on premier brand briefs."),
            ("admin", "Glad to have you onboard! Let us know if you need support with escrow withdrawals.")
        ]
    ]

    convo_count = 0
    message_count = 0

    # Ensure EVERY user participates in at least 3 conversations
    for u in users:
        user_id = u["id"]
        role = u.get("role", "influencer")
        user_name = u.get("name", "User")

        # Pick 3 partner users of complementary roles
        if role == "influencer":
            partners = random.sample(owners + agents + admins, min(3, len(owners + agents + admins)))
        elif role == "owner":
            partners = random.sample(creators + agents, min(3, len(creators + agents)))
        elif role == "agent":
            partners = random.sample(owners + creators, min(3, len(owners + creators)))
        else: # admin
            partners = random.sample(owners + creators + agents, min(4, len(owners + creators + agents)))

        for partner in partners:
            partner_id = partner["id"]
            partner_role = partner.get("role", "influencer")
            partner_name = partner.get("name", "Partner")

            # Check if conversation already exists between this pair
            existing = await db.conversations.find_one({
                "$or": [
                    {"owner_id": user_id, "creator_id": partner_id},
                    {"owner_id": partner_id, "creator_id": user_id},
                    {"participant_ids": {"$all": [user_id, partner_id]}}
                ]
            })

            if existing:
                convo_id = existing["id"]
            else:
                convo_id = f"convo_{uuid.uuid4().hex[:12]}"
                camp = random.choice(campaigns) if campaigns else {"id": "camp_demo", "title": "Brand Ambassadorship 2025", "brand": "Studio Noir"}
                
                convo_doc = {
                    "id": convo_id,
                    "campaign_id": camp.get("id"),
                    "campaign_title": camp.get("title", "Luxury Campaign"),
                    "campaign_brand": camp.get("brand", partner_name),
                    "owner_id": user_id if role in ("owner", "admin", "agent") else partner_id,
                    "creator_id": partner_id if role in ("owner", "admin", "agent") else user_id,
                    "brand_id": user_id if role == "owner" else partner_id,
                    "agent_id": user_id if role == "agent" else partner_id,
                    "participant_ids": [user_id, partner_id],
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 10))).isoformat(),
                    "last_at": datetime.now(timezone.utc).isoformat()
                }
                await db.conversations.insert_one(convo_doc)
                convo_count += 1

            # Seed 3-5 message records inside this conversation
            dialogue_script = random.choice(dialogues)
            base_time = datetime.now(timezone.utc) - timedelta(hours=random.randint(2, 48))

            for idx, (speaker_role, msg_text) in enumerate(dialogue_script):
                # Determine sender
                if speaker_role == role:
                    sender = u
                else:
                    sender = partner

                msg_doc = {
                    "id": f"msg_{uuid.uuid4().hex[:12]}",
                    "conversation_id": convo_id,
                    "sender_id": sender["id"],
                    "sender_name": sender.get("name", "User"),
                    "sender_role": sender.get("role", "influencer"),
                    "content": msg_text,
                    "created_at": (base_time + timedelta(minutes=idx * 15)).isoformat()
                }
                
                # Check if message exists to avoid duplicating identical strings
                existing_msg = await db.messages.find_one({"conversation_id": convo_id, "content": msg_text})
                if not existing_msg:
                    await db.messages.insert_one(msg_doc)
                    message_count += 1

    print(f"SUCCESS: Seeded {convo_count} new conversations and {message_count} messages across all 30 users in MongoDB!")

if __name__ == "__main__":
    asyncio.run(seed_all_messages())
