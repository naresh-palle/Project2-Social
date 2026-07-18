"""CR8 backend end-to-end pytest suite.

Covers: auth, creators, campaigns, applications, invitations, messaging,
deliverables, reviews, wallet/escrow, admin, AI (LLM), and RBAC negatives.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "studio@cr8.studio"
CREATOR_EMAIL = "lena@cr8.studio"
CREATOR2_EMAIL = "kai@cr8.studio"
ADMIN_EMAIL = "admin@cr8.studio"
DEMO_PW = "demo1234"
ADMIN_PW = "admin123"


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def owner():
    return _login(OWNER_EMAIL, DEMO_PW)


@pytest.fixture(scope="session")
def creator():
    return _login(CREATOR_EMAIL, DEMO_PW)


@pytest.fixture(scope="session")
def creator2():
    return _login(CREATOR2_EMAIL, DEMO_PW)


@pytest.fixture(scope="session")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="session")
def state():
    return {}


# ---------------- AUTH ----------------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_register_and_login(self, state):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "abc12345", "name": "TEST User", "role": "influencer",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["email"] == email
        assert data["user"]["role"] == "influencer"
        assert "password_hash" not in data["user"]
        state["tmp_email"] = email
        state["tmp_token"] = data["token"]

        # login same
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "abc12345"})
        assert r2.status_code == 200
        assert r2.json()["user"]["id"] == data["user"]["id"]

    def test_register_admin_forbidden(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"x_{uuid.uuid4().hex[:6]}@example.com", "password": "abc12345",
            "name": "x", "role": "admin",
        })
        assert r.status_code in (400, 422)

    def test_login_owner_and_me(self, owner):
        token = owner["token"]
        assert owner["user"]["role"] == "owner"
        r = requests.get(f"{API}/auth/me", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_patch_me(self, creator):
        r = requests.patch(f"{API}/auth/me",
                           headers=_auth(creator["token"]),
                           json={"bio": "TEST bio update", "niches": ["fashion", "beauty"],
                                 "portfolio": ["https://x.test/1"], "rate_card": {"reel": 3000}})
        assert r.status_code == 200
        data = r.json()
        assert data["bio"] == "TEST bio update"
        assert "fashion" in data["niches"]
        assert data["rate_card"]["reel"] == 3000


# ---------------- CREATORS ----------------
class TestCreators:
    def test_list_creators(self, state):
        r = requests.get(f"{API}/creators")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 3
        for c in items:
            assert c["role"] == "influencer"
            assert "password_hash" not in c
        state["creator_id"] = next(c["id"] for c in items if c["email"] == CREATOR_EMAIL)

    def test_filter_by_niche(self):
        r = requests.get(f"{API}/creators", params={"niche": "fashion"})
        assert r.status_code == 200
        for c in r.json():
            assert "fashion" in (c.get("niches") or [])

    def test_filter_by_platform_and_q(self):
        r = requests.get(f"{API}/creators", params={"platform": "instagram", "q": "lena"})
        assert r.status_code == 200
        emails = [c["email"] for c in r.json()]
        assert CREATOR_EMAIL in emails

    def test_get_creator_details(self, state):
        cid = state["creator_id"]
        r = requests.get(f"{API}/creators/{cid}")
        assert r.status_code == 200
        d = r.json()
        assert "rating" in d and "reviews_count" in d

    def test_get_creator_not_found(self):
        r = requests.get(f"{API}/creators/does-not-exist")
        assert r.status_code == 404


# ---------------- CAMPAIGNS ----------------
class TestCampaigns:
    def test_create_campaign_owner(self, owner, state):
        r = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST Campaign", "brand": "TESTBrand",
            "description": "TEST desc for editorial fit.",
            "budget": 1000, "niches": ["fashion"], "platforms": ["instagram"],
            "deliverables": "1 Reel + 1 Post",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "open" and d["owner_id"] == owner["user"]["id"]
        state["campaign_id"] = d["id"]

    def test_create_campaign_forbidden_for_creator(self, creator):
        r = requests.post(f"{API}/campaigns", headers=_auth(creator["token"]), json={
            "title": "x", "brand": "x", "description": "x", "budget": 100,
            "niches": [], "platforms": [], "deliverables": "x",
        })
        assert r.status_code == 403

    def test_list_campaigns(self, state):
        r = requests.get(f"{API}/campaigns")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert state["campaign_id"] in ids

    def test_list_mine(self, owner, state):
        r = requests.get(f"{API}/campaigns", headers=_auth(owner["token"]), params={"mine": "true"})
        assert r.status_code == 200
        for c in r.json():
            assert c["owner_id"] == owner["user"]["id"]

    def test_get_campaign(self, state):
        r = requests.get(f"{API}/campaigns/{state['campaign_id']}")
        assert r.status_code == 200
        assert r.json()["id"] == state["campaign_id"]


# ---------------- APPLICATIONS ----------------
class TestApplications:
    def test_apply_owner_forbidden(self, owner, state):
        r = requests.post(f"{API}/campaigns/{state['campaign_id']}/apply",
                          headers=_auth(owner["token"]),
                          json={"pitch": "x", "rate": 1})
        assert r.status_code == 403

    def test_apply_creator1(self, creator, state):
        r = requests.post(f"{API}/campaigns/{state['campaign_id']}/apply",
                          headers=_auth(creator["token"]),
                          json={"pitch": "TEST pitch A", "rate": 900})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "pending"
        state["app_lena_id"] = d["id"]

    def test_apply_duplicate_blocked(self, creator, state):
        r = requests.post(f"{API}/campaigns/{state['campaign_id']}/apply",
                          headers=_auth(creator["token"]),
                          json={"pitch": "again", "rate": 900})
        assert r.status_code == 400

    def test_apply_creator2(self, creator2, state):
        r = requests.post(f"{API}/campaigns/{state['campaign_id']}/apply",
                          headers=_auth(creator2["token"]),
                          json={"pitch": "TEST pitch B", "rate": 950})
        assert r.status_code == 200
        state["app_kai_id"] = r.json()["id"]

    def test_list_applications_owner_only(self, owner, creator, state):
        r_creator = requests.get(f"{API}/campaigns/{state['campaign_id']}/applications",
                                 headers=_auth(creator["token"]))
        assert r_creator.status_code == 403
        r = requests.get(f"{API}/campaigns/{state['campaign_id']}/applications",
                         headers=_auth(owner["token"]))
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_accept_flips_campaign(self, owner, creator, state):
        r = requests.post(f"{API}/applications/{state['app_lena_id']}/accept",
                          headers=_auth(owner["token"]))
        assert r.status_code == 200
        # Campaign should be in_progress with accepted_creator_id = lena
        c = requests.get(f"{API}/campaigns/{state['campaign_id']}").json()
        assert c["status"] == "in_progress"
        assert c["accepted_creator_id"] == creator["user"]["id"]
        # Other pending should be declined
        apps = requests.get(f"{API}/campaigns/{state['campaign_id']}/applications",
                            headers=_auth(owner["token"])).json()
        for a in apps:
            if a["id"] == state["app_lena_id"]:
                assert a["status"] == "accepted"
            elif a["id"] == state["app_kai_id"]:
                assert a["status"] == "declined"


# ---------------- INVITATIONS ----------------
class TestInvitations:
    def test_create_invitation(self, owner, state):
        # Create separate campaign so we don't collide
        c = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST Invite Camp", "brand": "TESTBrand", "description": "d",
            "budget": 500, "niches": [], "platforms": [], "deliverables": "1 post",
        }).json()
        state["invite_campaign_id"] = c["id"]
        # get creator id
        creators = requests.get(f"{API}/creators").json()
        kai = next(c for c in creators if c["email"] == CREATOR2_EMAIL)
        state["kai_id"] = kai["id"]
        r = requests.post(f"{API}/invitations", headers=_auth(owner["token"]), json={
            "creator_id": kai["id"], "campaign_id": c["id"],
            "offer": 800, "message": "TEST invite",
        })
        assert r.status_code == 200, r.text
        state["invite_id"] = r.json()["id"]

    def test_duplicate_invite_blocked(self, owner, state):
        r = requests.post(f"{API}/invitations", headers=_auth(owner["token"]), json={
            "creator_id": state["kai_id"], "campaign_id": state["invite_campaign_id"],
            "offer": 800, "message": "again",
        })
        assert r.status_code == 400

    def test_my_invitations_enriched(self, creator2, state):
        r = requests.get(f"{API}/invitations/mine", headers=_auth(creator2["token"]))
        assert r.status_code == 200
        arr = r.json()
        found = next((i for i in arr if i["id"] == state["invite_id"]), None)
        assert found is not None
        assert "campaign_title" in found and "creator_name" in found

    def test_invite_action_counter_then_accept(self, creator2, state, owner):
        # counter
        r = requests.post(f"{API}/invitations/{state['invite_id']}/action/counter",
                          headers=_auth(creator2["token"]),
                          json={"counter_offer": 900, "note": "TEST counter"})
        assert r.status_code == 200
        # non-creator forbidden
        r2 = requests.post(f"{API}/invitations/{state['invite_id']}/action/accept",
                           headers=_auth(owner["token"]), json={})
        assert r2.status_code == 403
        # accept
        r3 = requests.post(f"{API}/invitations/{state['invite_id']}/action/accept",
                           headers=_auth(creator2["token"]), json={})
        assert r3.status_code == 200


# ---------------- MESSAGING ----------------
class TestMessaging:
    def test_open_conversation(self, owner, creator, state):
        r = requests.post(f"{API}/conversations/open",
                          headers=_auth(owner["token"]),
                          params={"campaign_id": state["campaign_id"],
                                  "creator_id": creator["user"]["id"]})
        assert r.status_code == 200
        state["convo_id"] = r.json()["id"]

    def test_open_conversation_idempotent(self, owner, creator, state):
        r = requests.post(f"{API}/conversations/open",
                          headers=_auth(owner["token"]),
                          params={"campaign_id": state["campaign_id"],
                                  "creator_id": creator["user"]["id"]})
        assert r.json()["id"] == state["convo_id"]

    def test_post_and_list_messages(self, owner, creator, state):
        r = requests.post(f"{API}/conversations/{state['convo_id']}/messages",
                          headers=_auth(owner["token"]), json={"content": "TEST hello"})
        assert r.status_code == 200
        r2 = requests.post(f"{API}/conversations/{state['convo_id']}/messages",
                           headers=_auth(creator["token"]), json={"content": "TEST hi back"})
        assert r2.status_code == 200
        r3 = requests.get(f"{API}/conversations/{state['convo_id']}/messages",
                          headers=_auth(creator["token"]))
        assert r3.status_code == 200
        contents = [m["content"] for m in r3.json()]
        assert "TEST hello" in contents and "TEST hi back" in contents

    def test_conversations_list_enriched(self, owner, state):
        r = requests.get(f"{API}/conversations", headers=_auth(owner["token"]))
        assert r.status_code == 200
        got = next((c for c in r.json() if c["id"] == state["convo_id"]), None)
        assert got and "campaign_title" in got and "other_name" in got


# ---------------- DELIVERABLES ----------------
class TestDeliverables:
    def test_non_accepted_creator_cannot_submit(self, creator2, state):
        r = requests.post(f"{API}/deliverables", headers=_auth(creator2["token"]), json={
            "campaign_id": state["campaign_id"], "kind": "post",
            "url": "https://x.test/1", "caption": "no",
        })
        assert r.status_code == 403

    def test_submit_and_review(self, creator, owner, state):
        r = requests.post(f"{API}/deliverables", headers=_auth(creator["token"]), json={
            "campaign_id": state["campaign_id"], "kind": "post",
            "url": "https://x.test/deliverable", "caption": "TEST del",
        })
        assert r.status_code == 200, r.text
        state["del_id"] = r.json()["id"]
        # non-owner review forbidden
        r_c = requests.post(f"{API}/deliverables/{state['del_id']}/review",
                            headers=_auth(creator["token"]),
                            json={"status": "approved"})
        assert r_c.status_code == 403
        # approve as owner
        r_a = requests.post(f"{API}/deliverables/{state['del_id']}/review",
                            headers=_auth(owner["token"]),
                            json={"status": "approved", "notes": "ok"})
        assert r_a.status_code == 200

    def test_campaign_completes(self, state):
        c = requests.get(f"{API}/campaigns/{state['campaign_id']}").json()
        assert c["status"] == "completed"

    def test_list_deliverables_permission(self, owner, creator, creator2, state):
        r_ok = requests.get(f"{API}/campaigns/{state['campaign_id']}/deliverables",
                            headers=_auth(owner["token"]))
        assert r_ok.status_code == 200 and len(r_ok.json()) >= 1
        r_fb = requests.get(f"{API}/campaigns/{state['campaign_id']}/deliverables",
                            headers=_auth(creator2["token"]))
        assert r_fb.status_code == 403


# ---------------- REVIEWS ----------------
class TestReviews:
    def test_create_and_list_review(self, owner, creator, state):
        r = requests.post(f"{API}/reviews", headers=_auth(owner["token"]), json={
            "target_id": creator["user"]["id"], "campaign_id": state["campaign_id"],
            "rating": 5, "text": "TEST great work",
        })
        assert r.status_code == 200
        r2 = requests.get(f"{API}/reviews", params={"target_id": creator["user"]["id"]})
        assert r2.status_code == 200
        assert any(rv["rating"] == 5 for rv in r2.json())

    def test_review_rejected_from_outsider(self, creator2, creator, state):
        r = requests.post(f"{API}/reviews", headers=_auth(creator2["token"]), json={
            "target_id": creator["user"]["id"], "campaign_id": state["campaign_id"],
            "rating": 4, "text": "no",
        })
        assert r.status_code == 403


# ---------------- WALLET & ESCROW ----------------
class TestWallet:
    def test_owner_wallet(self, owner):
        r = requests.get(f"{API}/wallet", headers=_auth(owner["token"]))
        assert r.status_code == 200
        assert r.json()["balance"] >= 0

    def test_deposit_owner_and_creator_forbidden(self, owner, creator):
        r = requests.post(f"{API}/wallet/deposit", headers=_auth(owner["token"]),
                          json={"amount": 5000, "note": "TEST deposit"})
        assert r.status_code == 200
        r2 = requests.post(f"{API}/wallet/deposit", headers=_auth(creator["token"]),
                           json={"amount": 1})
        assert r2.status_code == 403

    def test_fund_and_release_flow(self, owner, creator, state):
        # ensure owner has enough
        w = requests.get(f"{API}/wallet", headers=_auth(owner["token"])).json()
        camp = requests.get(f"{API}/campaigns/{state['campaign_id']}").json()
        if w["balance"] < camp["budget"]:
            requests.post(f"{API}/wallet/deposit", headers=_auth(owner["token"]),
                          json={"amount": camp["budget"]}).raise_for_status()

        r_fund = requests.post(f"{API}/campaigns/{state['campaign_id']}/fund",
                               headers=_auth(owner["token"]))
        assert r_fund.status_code == 200, r_fund.text
        # release (campaign is completed)
        creator_before = requests.get(f"{API}/wallet", headers=_auth(creator["token"])).json()["balance"]
        r_rel = requests.post(f"{API}/campaigns/{state['campaign_id']}/release",
                              headers=_auth(owner["token"]))
        assert r_rel.status_code == 200, r_rel.text
        creator_after = requests.get(f"{API}/wallet", headers=_auth(creator["token"])).json()["balance"]
        assert creator_after - creator_before == camp["budget"]

    def test_creator_withdraw(self, creator):
        bal = requests.get(f"{API}/wallet", headers=_auth(creator["token"])).json()["balance"]
        if bal <= 0:
            pytest.skip("no balance to withdraw")
        r = requests.post(f"{API}/wallet/withdraw", headers=_auth(creator["token"]),
                          json={"amount": 100, "note": "TEST withdraw"})
        assert r.status_code == 200
        assert r.json()["balance"] == bal - 100

    def test_release_requires_completed(self, owner):
        # Make new campaign, fund but do not complete → release should fail
        c = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST NoRelease", "brand": "b", "description": "d",
            "budget": 200, "niches": [], "platforms": [], "deliverables": "x",
        }).json()
        requests.post(f"{API}/wallet/deposit", headers=_auth(owner["token"]),
                      json={"amount": 500})
        requests.post(f"{API}/campaigns/{c['id']}/fund", headers=_auth(owner["token"]))
        r = requests.post(f"{API}/campaigns/{c['id']}/release", headers=_auth(owner["token"]))
        assert r.status_code == 400

    def test_fund_forbidden_non_owner(self, creator, state):
        r = requests.post(f"{API}/campaigns/{state['campaign_id']}/fund",
                          headers=_auth(creator["token"]))
        assert r.status_code == 403


# ---------------- ADMIN ----------------
class TestAdmin:
    def test_admin_users_requires_admin(self, owner, admin):
        r = requests.get(f"{API}/admin/users", headers=_auth(owner["token"]))
        assert r.status_code == 403
        r2 = requests.get(f"{API}/admin/users", headers=_auth(admin["token"]))
        assert r2.status_code == 200
        assert len(r2.json()) > 0

    def test_admin_campaigns(self, admin):
        r = requests.get(f"{API}/admin/campaigns", headers=_auth(admin["token"]))
        assert r.status_code == 200

    def test_admin_verify_user(self, admin, state):
        r = requests.post(f"{API}/admin/users/{state['creator_id']}/verify",
                          headers=_auth(admin["token"]))
        assert r.status_code == 200
        # confirm
        c = requests.get(f"{API}/creators/{state['creator_id']}").json()
        assert c.get("verified") is True

    def test_admin_delete_campaign(self, owner, admin):
        c = requests.post(f"{API}/campaigns", headers=_auth(owner["token"]), json={
            "title": "TEST toDelete", "brand": "x", "description": "x",
            "budget": 100, "niches": [], "platforms": [], "deliverables": "x",
        }).json()
        r = requests.delete(f"{API}/admin/campaigns/{c['id']}", headers=_auth(admin["token"]))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/campaigns/{c['id']}")
        assert r2.status_code == 404


# ---------------- AI ----------------
class TestAI:
    def _call_with_retry(self, url, headers, json_body):
        for i in range(2):
            r = requests.post(url, headers=headers, json=json_body, timeout=120)
            if r.status_code == 200:
                return r
            time.sleep(2)
        return r

    def test_campaign_builder(self, owner):
        r = self._call_with_retry(f"{API}/ai/campaign-builder",
                                  _auth(owner["token"]),
                                  {"goal": "Launch a fall fragrance for a minimalist luxury house"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d, dict)
        # If parse succeeded (not raw), verify keys
        if "raw" not in d:
            for k in ["title", "description", "deliverables", "budget", "niches", "platforms"]:
                assert k in d, f"missing key {k}: {d}"

    def test_campaign_builder_forbidden_creator(self, creator):
        r = requests.post(f"{API}/ai/campaign-builder", headers=_auth(creator["token"]),
                          json={"goal": "no"})
        assert r.status_code == 403

    def test_match_score(self, owner, state):
        r = self._call_with_retry(f"{API}/ai/match-score", _auth(owner["token"]),
                                  {"campaign_id": state["campaign_id"],
                                   "creator_id": state["creator_id"]})
        assert r.status_code == 200, r.text
        d = r.json()
        if "raw" not in d:
            for k in ["score", "verdict", "strengths", "risks", "estimated_reach"]:
                assert k in d, f"missing key {k}: {d}"
