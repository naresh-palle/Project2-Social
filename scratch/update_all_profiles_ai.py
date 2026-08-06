import asyncio
import os
import random
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

# Curated High Quality Profile Pics / Avatars
ADMIN_AVATARS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400"
]

COMPANY_AVATARS = {
    "Studio Noir": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=400&h=400",
    "boAt Lifestyle": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400&h=400",
    "Zomato": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400&h=400",
    "Nykaa": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=400&h=400",
    "TechTribe India": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=400&h=400"
}

AGENT_AVATARS = [
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400"
]

CREATOR_AVATARS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400&h=400",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=400&h=400"
]

# AI Detailed Profiles for Companies/Owners
COMPANY_AI_PROFILES = {
    "Studio Noir": {
        "bio": "Premier European luxury fashion house crafting quiet luxury narratives. We collaborate exclusively with high-end editorial creators to produce timeless cinematic visual campaigns.",
        "industry": "Luxury Fashion & Couture",
        "location": "Paris, France",
        "website": "https://studionoir.paris",
        "niches": ["Fashion", "Luxury", "Editorial Photography", "High Aesthetics"]
    },
    "boAt Lifestyle": {
        "bio": "India's #1 audio & wearables brand. Fueling the passion of music lovers, fitness creators, and tech enthusiasts with high-octane bass, smart wearables, and youth lifestyle culture.",
        "industry": "Consumer Electronics & Audio Technology",
        "location": "Mumbai, Maharashtra",
        "website": "https://boat-lifestyle.com",
        "niches": ["Audio Tech", "Youth Lifestyle", "Fitness & Gaming", "Gadgets"]
    },
    "Zomato": {
        "bio": "India's premier culinary discovery & food delivery network. Connecting millions with iconic eateries and partnering with foodies, chefs, and regional creators to tell delicious stories.",
        "industry": "Food Tech & Hospitality",
        "location": "Gurugram, Haryana",
        "website": "https://zomato.com",
        "niches": ["Food & Dining", "Culinary Arts", "Travel & Lifestyle", "Regional Vlogs"]
    },
    "Nykaa": {
        "bio": "The ultimate destination for beauty, wellness, and personal care. Empowering creators to showcase authentic makeup art, skincare routines, and body positivity across India.",
        "industry": "Beauty, Cosmetics & Personal Care",
        "location": "Mumbai, Maharashtra",
        "website": "https://nykaa.com",
        "niches": ["Beauty & Cosmetics", "Skincare", "Wellness", "Fashion Trends"]
    },
    "TechTribe India": {
        "bio": "Next-gen consumer tech and gaming accessories ecosystem. Building high-performance hardware for creators, streamers, and tech reviewers shaping the future of digital media.",
        "industry": "Consumer Electronics & Gaming Hardware",
        "location": "Bengaluru, Karnataka",
        "website": "https://techtribe.in",
        "niches": ["Tech Reviews", "Gaming", "PC Builds", "Smart Home"]
    }
}

# AI Detailed Profiles for Agents
AGENT_AI_PROFILES = {
    "Karan Agent": {
        "company": "Karan Talent Agency",
        "bio": "Head Talent Director representing 45+ premier lifestyle, fashion, and tech creators across India & UAE. Negotiating high-value brand deals and long-term ambassadorships.",
        "industry": "Talent Management & Executive Representation",
        "location": "New Delhi, Delhi",
        "website": "https://karantalent.com",
        "niches": ["Celebrity Endorsements", "Creator Management", "Brand Contracts"]
    },
    "Rahul Agent": {
        "company": "Rahul Talent Management",
        "bio": "Senior Representative specializing in tech reviewers, gaming streamers, and digital innovators. Streamlining brand deals, legal contracts, and multi-channel growth strategies.",
        "industry": "Digital Talent Strategy & Creator Relations",
        "location": "Bengaluru, Karnataka",
        "website": "https://rahultalent.in",
        "niches": ["Tech Creators", "Gaming Management", "Esports Sponsorships"]
    },
    "Karan Johar": {
        "company": "Dharma Talent Management",
        "bio": "Executive Creative Director leading luxury brand integrations and celebrity creator collaborations. Bridging mainstream entertainment with digital influence.",
        "industry": "Entertainment & Celebrity Talent Management",
        "location": "Mumbai, Maharashtra",
        "website": "https://dharmatalent.com",
        "niches": ["Luxury Brand Deals", "Celebrity Management", "Film & Digital"]
    },
    "Shruti Hassan": {
        "company": "South Stars Media",
        "bio": "Founder & Principal Talent Scout representing top South Asian lifestyle, music, and cinematic creators. Driving regional campaigns with pan-India reach.",
        "industry": "Regional & Pan-India Talent Representation",
        "location": "Hyderabad, Telangana",
        "website": "https://southstarsmedia.com",
        "niches": ["Regional Creators", "Cinema & Music", "Brand Partnerships"]
    }
}

async def update_profiles():
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    print(f"Updating profiles for {len(users)} users...")

    avatar_idx = 0

    for u in users:
        role = u.get("role")
        user_id = u["id"]
        name = u.get("name") or "User"
        company_name = u.get("company") or name
        
        updates = {}

        # 1. Super Admin AI Profile Update
        if role == "admin":
            updates["name"] = name if name != "User" else "Super Admin"
            updates["company"] = "CR8 Executive Platform Desk"
            updates["bio"] = "Platform Director & AI Curator at CR8 Studio. Overseeing global creator-brand ecosystems, automated escrow verification, and enterprise matching algorithms."
            updates["industry"] = "Creator Economy Platform & AI Systems"
            updates["location"] = "San Francisco / Global"
            updates["website"] = "https://cr8.studio"
            updates["handle"] = "@admin.cr8"
            updates["niches"] = ["Platform Oversight", "Creator Monetization", "Enterprise Escrow", "AI Algorithms"]
            updates["avatar"] = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400&h=400"

        # 2. Company / Brand Owner AI Profile Update
        elif role == "owner":
            profile_data = COMPANY_AI_PROFILES.get(company_name, COMPANY_AI_PROFILES.get(name, {}))
            updates["avatar"] = COMPANY_AVATARS.get(company_name, COMPANY_AVATARS.get(name, CREATOR_AVATARS[avatar_idx % len(CREATOR_AVATARS)]))
            updates["bio"] = profile_data.get("bio", f"Innovative brand focusing on high-quality product experiences and impactful creator partnerships.")
            updates["industry"] = profile_data.get("industry", "Consumer Brand & Digital Media")
            updates["location"] = profile_data.get("location", u.get("location") or "Mumbai, India")
            updates["website"] = profile_data.get("website", f"https://{company_name.lower().replace(' ', '')}.com")
            updates["niches"] = profile_data.get("niches", ["Brand Marketing", "Digital Campaigns"])
            updates["company"] = company_name

        # 3. Agent AI Profile Update
        elif role == "agent":
            agent_data = AGENT_AI_PROFILES.get(name, AGENT_AI_PROFILES.get(company_name, {}))
            updates["avatar"] = AGENT_AVATARS[avatar_idx % len(AGENT_AVATARS)]
            updates["company"] = agent_data.get("company", company_name or f"{name} Talent Agency")
            updates["bio"] = agent_data.get("bio", f"Managing top-tier digital creators, negotiating brand partnerships, and accelerating creator revenue growth.")
            updates["industry"] = agent_data.get("industry", "Talent Management & Creator Strategy")
            updates["location"] = agent_data.get("location", f"{u.get('city') or 'Mumbai'}, {u.get('state') or 'India'}")
            updates["website"] = agent_data.get("website", f"https://{name.lower().replace(' ', '')}talent.com")
            updates["niches"] = agent_data.get("niches", ["Talent Strategy", "Brand Deal Negotiations"])
            updates["city"] = u.get("city") or "Mumbai"
            updates["state"] = u.get("state") or "Maharashtra"

        # 4. Influencer / Creator Profile Update
        elif role == "influencer":
            if not u.get("avatar") or u.get("avatar") == "" or u.get("avatar") is None:
                updates["avatar"] = CREATOR_AVATARS[avatar_idx % len(CREATOR_AVATARS)]
            if not u.get("bio") or "Curating high-end" in u.get("bio") or "Creating exceptional" in u.get("bio"):
                n_str = ", ".join(u.get("niches") or ["fashion", "lifestyle"])
                updates["bio"] = f"Digital creator & storyteller focused on {n_str}. Crafting authentic visual content and engaging experiences."
            if not u.get("handle"):
                updates["handle"] = f"@{name.lower().replace(' ', '')}"
            if not u.get("city") or u.get("city") == "":
                updates["city"] = u.get("location") or "Mumbai"

        # Ensure every single user has a non-empty avatar
        if "avatar" not in updates and (not u.get("avatar") or u.get("avatar") == ""):
            updates["avatar"] = CREATOR_AVATARS[avatar_idx % len(CREATOR_AVATARS)]

        avatar_idx += 1

        await db.users.update_one({"id": user_id}, {"$set": updates})
        print(f"[{role.upper()}] Updated: {name} (Avatar: {updates.get('avatar', u.get('avatar'))[:30]}...)")

    print("\n✅ Successfully updated profile pictures for all users and applied AI profiles for Super Admin, Companies, and Agents!")

if __name__ == "__main__":
    asyncio.run(update_profiles())
