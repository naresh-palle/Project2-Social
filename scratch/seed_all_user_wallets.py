import asyncio
import os
import random
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def seed_wallets_and_audit():
    users = await db.users.find({}).to_list(None)
    campaigns = await db.campaigns.find({}).to_list(None)
    
    summary_report = []

    # 1. Update wallet balance & transaction history for every user
    for u in users:
        role = u.get("role", "influencer")
        user_name = u.get("name", "User")
        user_email = u.get("email", "")
        company_name = u.get("company") or user_name

        if role == "admin":
            balance = 5000000
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 450000, "kind": "Platform Commission", "note": "5% Escrow commission on Q3 Brand briefs", "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": 750000, "kind": "Enterprise Settlement", "note": "Audit Clearance for boAt & Studio Noir briefs", "created_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -120000, "kind": "Server Maintenance", "note": "Cloud infrastructure & Anthropic AI hosting payout", "created_at": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()}
            ]
        elif role == "owner":
            balance = random.randint(1200000, 3500000)
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": random.randint(500000, 1000000), "kind": "Vault Deposit", "note": f"Direct Deposit to {company_name} Campaign Wallet", "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -random.randint(100000, 300000), "kind": "Escrow Funding", "note": "Escrow locked for Summer Influencer Launch campaign", "created_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -random.randint(45000, 95000), "kind": "Creator Payout", "note": "Milestone release for approved video reel deliverable", "created_at": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
            ]
        elif role == "agent":
            balance = random.randint(450000, 1200000)
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": random.randint(150000, 450000), "kind": "Agency Commission", "note": f"15% Management Dividend for {company_name} roster deals", "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": random.randint(80000, 200000), "kind": "Brand Settlement", "note": "Escrow payment release for talent deliverables", "created_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -random.randint(30000, 75000), "kind": "Bank Payout", "note": "Withdrawal transfer to corporate bank account", "created_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()}
            ]
        else: # influencer
            balance = random.randint(35000, 185000)
            txs = [
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": random.randint(25000, 65000), "kind": "Campaign Earnings", "note": "Approved deliverable payment for Instagram Reel", "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": random.randint(15000, 40000), "kind": "Brand Incentive", "note": "Bonus payout for high engagement metric benchmark", "created_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()},
                {"id": f"tx_{uuid.uuid4().hex[:8]}", "amount": -random.randint(10000, 30000), "kind": "Bank Withdrawal", "note": "Payout transfer to verified UPI account", "created_at": (datetime.now(timezone.utc) - timedelta(days=9)).isoformat()}
            ]

        await db.users.update_one({"id": u["id"]}, {"$set": {"wallet": balance, "transactions": txs}})
        summary_report.append({
            "name": user_name,
            "role": role,
            "company": company_name if role in ("owner", "agent") else None,
            "email": user_email,
            "balance": f"INR {balance:,}",
            "tx_count": len(txs),
            "sample_tx": txs[0]["note"]
        })

    # 2. Seed mock payments for admin panel
    await db.payments.delete_many({"mock": True})
    payments_docs = []
    brands_sample = ["Studio Noir", "boAt Lifestyle", "Zomato", "Nykaa", "TechTribe India"]
    creators_sample = [u["name"] for u in users if u.get("role") == "influencer"][:8]

    for i in range(15):
        b = random.choice(brands_sample)
        c = random.choice(creators_sample) if creators_sample else "Arjun Creator"
        amt = random.choice([35000, 45000, 65000, 85000, 120000, 150000])
        dt = (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 14), hours=random.randint(1, 20))).isoformat()
        
        payments_docs.append({
            "id": f"PAY-{random.randint(10000, 99999)}",
            "creator": c,
            "brand": b,
            "campaign": f"{b} Summer Launch 2025",
            "amount": amt,
            "status": "Completed",
            "date": dt,
            "created_at": dt,
            "mock": True
        })

    if payments_docs:
        await db.payments.insert_many(payments_docs)

    # 3. Seed Audit Logs for Admin Panel
    await db.audit_logs.delete_many({})
    audit_docs = []
    actions = [
        ("User Signup", "Registered new studio account", "success"),
        ("Profile Update", "Updated bio & portfolio metrics", "info"),
        ("Brief Created", "Published new brand campaign brief", "success"),
        ("Escrow Funded", "Deposited campaign funds to escrow", "success"),
        ("Deliverable Submitted", "Uploaded draft reel link", "info"),
        ("Payment Released", "Released escrow funds to creator", "success"),
        ("Verification Approved", "Verified agency credentials", "success")
    ]

    for i in range(20):
        u = random.choice(users)
        act_name, desc, status = random.choice(actions)
        dt = (datetime.now(timezone.utc) - timedelta(hours=i * 2 + random.randint(1, 10))).isoformat()
        
        audit_docs.append({
            "id": f"audit_{uuid.uuid4().hex[:8]}",
            "action": act_name,
            "type": act_name,
            "user": u.get("name") or u.get("email"),
            "user_id": u["id"],
            "details": desc,
            "status": status,
            "time": dt,
            "created_at": dt
        })

    if audit_docs:
        await db.audit_logs.insert_many(audit_docs)

    # Print clean summary report
    print("\n=======================================================")
    print("MOCK DATA SEEDING REPORT (ALL 30 USERS UPDATED IN MONGODB)")
    print("=======================================================")
    for item in summary_report:
        role_label = item['role'].upper()
        comp_str = f" ({item['company']})" if item['company'] and item['company'] != item['name'] else ""
        print(f"• [{role_label}] {item['name']}{comp_str} | Balance: {item['balance']} | Txs: {item['tx_count']} | Latest: {item['sample_tx']}")

    print(f"\nTotal Payments Seeded for Admin Panel: {len(payments_docs)}")
    print(f"Total Live Audit Trail Logs Seeded: {len(audit_docs)}")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(seed_wallets_and_audit())
