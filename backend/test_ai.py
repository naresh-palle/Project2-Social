import urllib.request
import urllib.parse
import json

URL = "https://project2-social.onrender.com/api"

print("Logging in...")
req = urllib.request.Request(f"{URL}/auth/login", data=json.dumps({"email": "lena@cr8.studio", "password": "demo1234"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read())
        token = res.get("token")
        print("Got token.")
        
        print("Calling AI suggest-profile...")
        req2 = urllib.request.Request(f"{URL}/ai/suggest-profile", data=json.dumps({"niches": ["fashion"], "handle": "@lena.ivory"}).encode('utf-8'), headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
        try:
            with urllib.request.urlopen(req2) as response2:
                print("Status:", response2.status)
                print("Response:", response2.read().decode())
        except urllib.error.HTTPError as e:
            print("Error:", e.code, e.read().decode())
except urllib.error.HTTPError as e:
    print("Login Error:", e.code, e.read().decode())
