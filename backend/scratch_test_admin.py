import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # 1. Login as admin
        r = await client.post("http://localhost:8000/api/auth/login", json={
            "identifier": "admin@cr8.studio",
            "password": "admin123"
        })
        if r.status_code != 200:
            print("Login failed:", r.text)
            return
        token = r.json()["token"]
        print("Logged in!")

        # 2. Fetch stats
        headers = {"Authorization": f"Bearer {token}"}
        r2 = await client.get("http://localhost:8000/api/admin/dashboard-stats", headers=headers)
        print("Stats Status:", r2.status_code)
        print("Stats Body:", r2.text)

asyncio.run(main())
