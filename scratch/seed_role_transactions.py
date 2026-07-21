import asyncio
import os
import random
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://npallegoud_db_user:Password@cluster0.n5nwxxq.mongodb.net/?appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.cr8_studio

async def seed_role_data():
    print("Fetching Admin, Company (Owner), and Agent accounts...")
    admins = await db.users.find({"role": "admin"}).to_list(None)
    owners = await db.users.find({"role": "owner"}).to_list(None)
    agents = await db.users.find({"role": "agent"}).to_list(None)
    creators = await db.users.find({"role": "influencer"}).to_list(None)

    all_users = admins + owners + agents
    print(f"Found {len(admins)} Admin, {len(owners)} Owners, {len(agents)} Agents.")

    # 1. Update Admin Wallets & Transactions
    for u in admins:
        balance = 5000000
        txs = [
          {
            "id": f"tx_adm_{random.randint(10000, 99999)}",
            "amount": 250000,
            "kind": "Platform Commission Fee",
            "note": "5% Escrow commission collected on Q3 campaigns",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
          },
          {
            "id": f"tx_adm_{random.randint(10000, 99999)}",
            "amount": 500000,
            "kind": "Enterprise Escrow Settlement",
            "note": "GMV Audit Clearance for Studio Noir & boAt campaigns",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
          },
          {
            "id": f"tx_adm_{random.randint(10000, 99999)}",
            "amount": -50000,
            "kind": "Infrastructure Maintenance",
            "note": "AI Model hosting & server infrastructure payout",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
          }
        ]
        await db.users.update_one({"id": u["id"]}, {"$set": {"wallet": balance, "transactions": txs}})
        print(f"[ADMIN] Updated wallet for {u.get('name')}: INR {balance}")

    # 2. Update Company / Owner Wallets & Transactions
    for u in owners:
        company_name = u.get("company") or u.get("name") or "Brand Studio"
        balance = random.randint(800000, 2500000)
        txs = [
          {
            "id": f"tx_own_{random.randint(10000, 99999)}",
            "amount": random.randint(300000, 800000),
            "kind": "Vault Deposit",
            "note": f"Direct Deposit to {company_name} Campaign Wallet",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
          },
          {
            "id": f"tx_own_{random.randint(10000, 99999)}",
            "amount": -random.randint(50000, 150000),
            "kind": "Escrow Funding",
            "note": f"Escrow locked for Summer Influencer Launch campaign",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
          },
          {
            "id": f"tx_own_{random.randint(10000, 99999)}",
            "amount": -random.randint(25000, 80000),
            "kind": "Creator Payout",
            "note": "Milestone release for approved video deliverable",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
          }
        ]
        await db.users.update_one({"id": u["id"]}, {"$set": {"wallet": balance, "transactions": txs}})

        # Ensure payment entry in payments collection
        if creators:
            c = random.choice(creators)
            await db.payments.insert_one({
                "id": f"pay_{random.randint(10000, 99999)}",
                "creator_id": c["id"],
                "creator": c["name"],
                "brand_id": u["id"],
                "brand": company_name,
                "amount": random.randint(30000, 120000),
                "status": "completed",
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 15))).isoformat(),
                "mock": True
            })
        print(f"[OWNER] Updated wallet for {company_name}: INR {balance}")

    # 3. Update Agent Wallets & Transactions
    for u in agents:
        agency_name = u.get("company") or f"{u.get('name')} Agency"
        balance = random.randint(350000, 950000)
        txs = [
          {
            "id": f"tx_agt_{random.randint(10000, 99999)}",
            "amount": random.randint(120000, 350000),
            "kind": "Agency Commission Payout",
            "note": f"15% Management Dividend for {agency_name} Roster Deals",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
          },
          {
            "id": f"tx_agt_{random.randint(10000, 99999)}",
            "amount": random.randint(50000, 180000),
            "kind": "Brand Settlement",
            "note": "Campaign escrow release for talent deliverables",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
          },
          {
            "id": f"tx_agt_{random.randint(10000, 99999)}",
            "amount": -random.randint(20000, 60000),
            "kind": "Agency Withdrawal",
            "note": "Payout transfer to corporate bank account",
            "created_at": (datetime.now(timezone.utc) - timedelta(days=12)).isoformat()
          }
        ]
        await db.users.update_one({"id": u["id"]}, {"$set": {"wallet": balance, "transactions": txs}})
        print(f"[AGENT] Updated wallet for {agency_name}: INR {balance}")

    print("\n✅ Successfully updated wallets, payments, and transaction history for Admin, Companies, and Agents!")

if __name__ == "__main__":
    asyncio.run(seed_role_data())
