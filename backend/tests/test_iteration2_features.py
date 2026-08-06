"""CR8 iteration-2 feature tests: uploads, analytics, SSE, top-matches, email side-effects."""
import os
import io
import time
import json
import threading
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()).rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "studio@cr8.studio"
CREATOR_EMAIL = "lena@cr8.studio"
CREATOR2_EMAIL = "kai@cr8.studio"
ADMIN_EMAIL = "admin@cr8.studio"
DEMO_PW = "demo1234"
ADMIN_PW = "admin123"


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def owner(): return _login(OWNER_EMAIL, DEMO_PW)


@pytest.fixture(scope="module")
def creator(): return _login(CREATOR_EMAIL, DEMO_PW)


@pytest.fixture(scope="module")
def creator2(): return _login(CREATOR2_EMAIL, DEMO_PW)


@pytest.fixture(scope="module")
def admin(): return _login(ADMIN_EMAIL, ADMIN_PW)


# 1x1 png (67 bytes)
PNG_1x1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d49444154789c63f8cf00000003000180ff05fe020000000049454e44ae426082"
)


# ---------------- UPLOADS ----------------
class TestUploads:
    def test_upload_png(self, owner, request):
        files = {"file": ("test.png", io.BytesIO(PNG_1x1), "image/png")}
        r = requests.post(f"{API}/uploads", headers=_auth(owner["token"]), files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and "url" in d
        assert d["url"].startswith("/api/uploads/")
        request.config.cache.set("upload_id", d["id"])

    def test_upload_requires_auth(self):
        files = {"file": ("a.png", io.BytesIO(PNG_1x1), "image/png")}
        r = requests.post(f"{API}/uploads", files=files, timeout=15)
        assert r.status_code in (401, 403)

    def test_upload_rejects_non_image(self, owner):
        files = {"file": ("bad.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(f"{API}/uploads", headers=_auth(owner["token"]), files=files, timeout=15)
        assert r.status_code == 400

    def test_get_uploaded_file(self, owner, request):
        fid = request.config.cache.get("upload_id", None)
        assert fid, "prior upload test must have populated cache"
        r = requests.get(f"{API}/uploads/{fid}", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) == len(PNG_1x1)

    def test_get_uploaded_missing(self):
        r = requests.get(f"{API}/uploads/does-not-exist.png", timeout=15)
        assert r.status_code == 404


# ---------------- ANALYTICS ----------------
class TestAnalytics:
    def test_owner_analytics(self, owner):
        r = requests.get(f"{API}/analytics/owner", headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_campaigns", "open_campaigns", "in_progress", "completed",
                  "applications_total", "escrow_held", "paid_to_creators",
                  "total_budget", "conversations"]:
            assert k in d, f"missing key {k}"
            assert isinstance(d[k], (int, float)), f"{k} not numeric: {d[k]!r}"

    def test_owner_analytics_forbidden_creator(self, creator):
        r = requests.get(f"{API}/analytics/owner", headers=_auth(creator["token"]), timeout=15)
        assert r.status_code == 403

    def test_owner_analytics_forbidden_admin(self, admin):
        # Analytics is owner-only per spec; admin should also be blocked
        r = requests.get(f"{API}/analytics/owner", headers=_auth(admin["token"]), timeout=15)
        assert r.status_code == 403

    def test_creator_analytics(self, creator):
        r = requests.get(f"{API}/analytics/creator", headers=_auth(creator["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["applications", "acceptances", "invitations", "deliverables",
                  "approved", "avg_rating", "reviews_count", "earned", "contracted"]:
            assert k in d, f"missing key {k}"
            assert isinstance(d[k], (int, float)), f"{k} not numeric: {d[k]!r}"

    def test_creator_analytics_forbidden_owner(self, owner):
        r = requests.get(f"{API}/analytics/creator", headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 403


# ---------------- SSE ----------------
class TestSSE:
    def _open_convo(self, owner, creator_user_id):
        # Need a campaign owned by owner and open conversation between owner+creator
        camp = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST SSE Camp", "brand": "TB", "description": "d",
            "budget": 100, "niches": [], "platforms": [], "deliverables": "1"
        }, timeout=15).json()
        conv = requests.post(f"{API}/conversations/open",
                             params={"campaign_id": camp["id"], "creator_id": creator_user_id},
                             headers=_auth(owner["token"]), timeout=15).json()
        return conv["id"]

    def test_stream_publishes_message(self, owner, creator):
        conv_id = self._open_convo(owner, creator["user"]["id"])
        url = f"{API}/conversations/{conv_id}/stream?token={creator['token']}"
        events = []
        # Open SSE with a streaming GET
        with requests.get(url, stream=True, timeout=15) as resp:
            assert resp.status_code == 200, resp.text
            ctype = resp.headers.get("content-type", "")
            assert "text/event-stream" in ctype, ctype

            # Publish a message from the owner side after a short delay from a thread
            def poster():
                time.sleep(1.2)
                requests.post(f"{API}/conversations/{conv_id}/messages",
                              headers=_auth(owner["token"]),
                              json={"content": "TEST-SSE-hello"}, timeout=10)

            t = threading.Thread(target=poster, daemon=True)
            t.start()

            # Read stream lines with a hard cutoff
            start = time.time()
            got_message = False
            buf_event = None
            for raw in resp.iter_lines(decode_unicode=True):
                if time.time() - start > 12:
                    break
                if raw is None:
                    continue
                if raw.startswith("event:"):
                    buf_event = raw.split(":", 1)[1].strip()
                elif raw.startswith("data:"):
                    data = raw.split(":", 1)[1].strip()
                    if buf_event == "message":
                        try:
                            j = json.loads(data)
                            if j.get("content") == "TEST-SSE-hello":
                                got_message = True
                                events.append(j)
                                break
                        except Exception:
                            pass
            t.join(timeout=2)
            assert got_message, f"never received SSE message event within 12s, events={events}"

    def test_stream_forbidden_for_outsider(self, owner, creator, creator2):
        conv_id = self._open_convo(owner, creator["user"]["id"])
        # creator2 is not part of this conversation
        r = requests.get(f"{API}/conversations/{conv_id}/stream",
                         params={"token": creator2["token"]}, timeout=10, stream=True)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"


# ---------------- TOP MATCHES (AI) ----------------
class TestTopMatches:
    @pytest.fixture(scope="class")
    def owned_campaign(self, owner):
        r = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST Top Matches", "brand": "AuraLux",
            "description": "Editorial fall drop with minimalist creators",
            "budget": 5000, "niches": ["fashion", "beauty"],
            "platforms": ["instagram", "tiktok"], "deliverables": "1 reel + 3 posts",
        }, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_top_matches_owner_only(self, creator, owned_campaign):
        r = requests.get(f"{API}/campaigns/{owned_campaign['id']}/top-matches",
                         headers=_auth(creator["token"]), timeout=15)
        assert r.status_code == 403

    def test_top_matches_returns_ranked_list(self, owner, owned_campaign):
        r = requests.get(f"{API}/campaigns/{owned_campaign['id']}/top-matches",
                         params={"limit": 5},
                         headers=_auth(owner["token"]), timeout=120)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) <= 5
        if not arr:
            pytest.skip("LLM returned no scored candidates this run")
        # Sorted by score desc
        scores = [c.get("score") for c in arr]
        assert scores == sorted(scores, reverse=True), f"not sorted: {scores}"
        for c in arr:
            for k in ["id", "name", "score", "verdict", "estimated_reach",
                      "niches", "platforms"]:
                assert k in c, f"missing {k} in {c}"
            assert isinstance(c["score"], int) and 0 <= c["score"] <= 100


# ---------------- EMAIL SIDE-EFFECTS (fire-and-forget) ----------------
class TestEmailSideEffects:
    """Endpoints that trigger send_email must still succeed regardless of email delivery."""

    def test_apply_and_invite_and_accept_do_not_error(self, owner, creator2):
        # Create a fresh campaign
        camp = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST Email SideFx", "brand": "TB", "description": "d",
            "budget": 200, "niches": [], "platforms": [], "deliverables": "1"
        }, timeout=15).json()

        # Application (creator applies -> email to owner)
        r = requests.post(f"{API}/campaigns/{camp['id']}/apply",
                          headers=_auth(creator2["token"]),
                          json={"pitch": "TEST-email", "rate": 100}, timeout=15)
        assert r.status_code == 200, r.text
        app_id = r.json()["id"]

        # Owner accepts -> email to creator
        r2 = requests.post(f"{API}/applications/{app_id}/accept",
                           headers=_auth(owner["token"]), timeout=15)
        assert r2.status_code == 200, r2.text

        # Invitation on a second campaign -> email to creator
        camp2 = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST Email SideFx 2", "brand": "TB", "description": "d",
            "budget": 200, "niches": [], "platforms": [], "deliverables": "1"
        }, timeout=15).json()
        inv = requests.post(f"{API}/invitations", headers=_auth(owner["token"]), json={
            "creator_id": creator2["user"]["id"], "campaign_id": camp2["id"],
            "message": "hi", "offer": 100
        }, timeout=15)
        assert inv.status_code == 200, inv.text

        # Creator acts on invitation -> email to owner
        act = requests.post(f"{API}/invitations/{inv.json()['id']}/action/reject",
                            headers=_auth(creator2["token"]),
                            json={}, timeout=15)
        assert act.status_code == 200, act.text
