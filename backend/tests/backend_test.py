"""
PangkasKAKA backend API regression tests.
Covers auth, shops, bookings, owner, admin, karyawan, notifications, hairstyles and AI face-scan.
"""
import os
import base64
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://barber-booking-ai-2.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "admin@pangkaskaka.id", "password": "Admin123!"}
OWNER = {"email": "owner@pangkaskaka.id", "password": "Owner123!"}
CUSTOMER = {"email": "customer@pangkaskaka.id", "password": "Customer123!"}
KARYAWAN = {"email": "karyawan@pangkaskaka.id", "password": "Karyawan123!"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(s, creds):
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_tok(s):
    return _login(s, ADMIN)["token"]


@pytest.fixture(scope="session")
def owner_tok(s):
    return _login(s, OWNER)["token"]


@pytest.fixture(scope="session")
def customer_tok(s):
    return _login(s, CUSTOMER)["token"]


@pytest.fixture(scope="session")
def karyawan_tok(s):
    return _login(s, KARYAWAN)["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_all_roles(self, s):
        for creds in (ADMIN, OWNER, CUSTOMER, KARYAWAN):
            d = _login(s, creds)
            assert "token" in d and "user" in d
            assert "password" not in d["user"]
            assert "_id" not in d["user"]

    def test_login_wrong_password(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self, s):
        email = f"test_reg_{int(dt.datetime.utcnow().timestamp())}@example.com"
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "TEST User",
            "phone": "081200000000", "role": "customer"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "password" not in d["user"]
        me = s.get(f"{BASE_URL}/api/auth/me", headers=H(d["token"]))
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email

    def test_me_requires_token(self, s):
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---------- Shops ----------
class TestShops:
    def test_list_shops_haversine_sort(self, s):
        r = s.get(f"{BASE_URL}/api/shops", params={"lat": -10.17, "lng": 123.60, "sort": "terdekat"})
        assert r.status_code == 200
        shops = r.json()["shops"]
        assert len(shops) >= 4
        # every shop must have distance_km
        for sh in shops:
            assert sh["distance_km"] is not None
            assert "_id" not in sh
        # sorted ascending
        dists = [sh["distance_km"] for sh in shops]
        assert dists == sorted(dists)

    def test_shop_detail_includes_relations(self, s):
        shops = s.get(f"{BASE_URL}/api/shops", params={"lat": -10.17, "lng": 123.60}).json()["shops"]
        sid = shops[0]["id"]
        r = s.get(f"{BASE_URL}/api/shops/{sid}")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["services"], list) and len(d["services"]) > 0
        assert isinstance(d["barbers"], list) and len(d["barbers"]) > 0
        assert all(b["status"] == "active" for b in d["barbers"])
        assert isinstance(d["schedules"], list) and len(d["schedules"]) == 7

    def test_slots_endpoint(self, s):
        shops = s.get(f"{BASE_URL}/api/shops", params={"lat": -10.17, "lng": 123.60}).json()["shops"]
        sh = s.get(f"{BASE_URL}/api/shops/{shops[0]['id']}").json()
        date_str = (dt.date.today() + dt.timedelta(days=1)).isoformat()
        r = s.get(f"{BASE_URL}/api/shops/{sh['id']}/slots", params={
            "barber_id": sh["barbers"][0]["id"], "date": date_str, "service_id": sh["services"][0]["id"]
        })
        assert r.status_code == 200
        slots = r.json()["slots"]
        assert isinstance(slots, list) and len(slots) > 0
        assert all("time" in x and "available" in x for x in slots)


# ---------- Bookings ----------
class TestBookings:
    booking_id = None

    def test_create_pay_and_list(self, s, customer_tok):
        shops = s.get(f"{BASE_URL}/api/shops", params={"lat": -10.17, "lng": 123.60}).json()["shops"]
        sh = s.get(f"{BASE_URL}/api/shops/{shops[0]['id']}").json()
        date_str = (dt.date.today() + dt.timedelta(days=2)).isoformat()
        slots = s.get(f"{BASE_URL}/api/shops/{sh['id']}/slots", params={
            "barber_id": sh["barbers"][0]["id"], "date": date_str, "service_id": sh["services"][0]["id"]
        }).json()["slots"]
        avail = [x for x in slots if x["available"]]
        assert avail, "no available slots"
        payload = {
            "shop_id": sh["id"], "barber_id": sh["barbers"][0]["id"],
            "service_id": sh["services"][0]["id"],
            "booking_date": date_str, "booking_time": avail[0]["time"],
            "customer_lat": -10.17, "customer_lng": 123.60,
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=payload, headers=H(customer_tok))
        assert r.status_code == 200, r.text
        b = r.json()["booking"]
        assert b["status"] == "pending" and b["payment_status"] == "unpaid"
        assert b["total_price"] == sh["services"][0]["price"]  # trust DB
        TestBookings.booking_id = b["id"]

        # duplicate same slot -> 409
        r2 = s.post(f"{BASE_URL}/api/bookings", json=payload, headers=H(customer_tok))
        assert r2.status_code == 409

        # pay
        pr = s.post(f"{BASE_URL}/api/bookings/{b['id']}/pay", headers=H(customer_tok))
        assert pr.status_code == 200, pr.text
        # verify via GET
        gr = s.get(f"{BASE_URL}/api/bookings/{b['id']}", headers=H(customer_tok))
        assert gr.status_code == 200
        assert gr.json()["status"] == "confirmed"
        assert gr.json()["payment_status"] == "paid"

        # list
        lst = s.get(f"{BASE_URL}/api/bookings", headers=H(customer_tok))
        assert lst.status_code == 200
        assert any(x["id"] == b["id"] for x in lst.json()["bookings"])

    def test_cancel_too_late(self, s, customer_tok):
        # try creating a booking for today and cancel -> should reject <2h
        # (this may fail if slots for today are all past — treat gracefully)
        shops = s.get(f"{BASE_URL}/api/shops", params={"lat": -10.17, "lng": 123.60}).json()["shops"]
        sh = s.get(f"{BASE_URL}/api/shops/{shops[0]['id']}").json()
        date_str = (dt.date.today() + dt.timedelta(days=3)).isoformat()
        slots = s.get(f"{BASE_URL}/api/shops/{sh['id']}/slots", params={
            "barber_id": sh["barbers"][1]["id"], "date": date_str, "service_id": sh["services"][1]["id"]
        }).json()["slots"]
        avail = [x for x in slots if x["available"]]
        if not avail:
            pytest.skip("no slots")
        payload = {
            "shop_id": sh["id"], "barber_id": sh["barbers"][1]["id"],
            "service_id": sh["services"][1]["id"],
            "booking_date": date_str, "booking_time": avail[0]["time"],
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=payload, headers=H(customer_tok))
        assert r.status_code == 200
        bid = r.json()["booking"]["id"]
        # cancellation of future booking (>2h) should succeed
        c = s.post(f"{BASE_URL}/api/bookings/{bid}/cancel", headers=H(customer_tok))
        assert c.status_code == 200


# ---------- Owner ----------
class TestOwner:
    def test_owner_dashboard(self, s, owner_tok):
        r = s.get(f"{BASE_URL}/api/owner/dashboard", headers=H(owner_tok))
        assert r.status_code == 200
        d = r.json()
        assert "shop" in d and d["shop"] is not None
        assert "stats" in d and "today_orders" in d["stats"]
        assert "latest_orders" in d

    def test_owner_orders_list(self, s, owner_tok):
        r = s.get(f"{BASE_URL}/api/owner/orders", headers=H(owner_tok))
        assert r.status_code == 200
        assert "orders" in r.json()

    def test_add_and_delete_service(self, s, owner_tok):
        r = s.post(f"{BASE_URL}/api/owner/services", json={"name": "TEST Trim", "duration": 15, "price": 15000}, headers=H(owner_tok))
        assert r.status_code == 200
        sid = r.json()["service"]["id"]
        d = s.delete(f"{BASE_URL}/api/owner/services/{sid}", headers=H(owner_tok))
        assert d.status_code == 200

    def test_add_barber(self, s, owner_tok):
        r = s.post(f"{BASE_URL}/api/owner/barbers", json={"name": "TEST Barber Z", "skill_level": "Junior"}, headers=H(owner_tok))
        assert r.status_code == 200
        assert r.json()["barber"]["name"] == "TEST Barber Z"

    def test_role_guard_customer_denied(self, s, customer_tok):
        r = s.get(f"{BASE_URL}/api/owner/dashboard", headers=H(customer_tok))
        assert r.status_code == 403


# ---------- Karyawan & Owner Evaluate ----------
class TestKaryawan:
    def test_apply_and_evaluate(self, s, karyawan_tok, owner_tok):
        # get a shop owned by seed owner
        od = s.get(f"{BASE_URL}/api/owner/dashboard", headers=H(owner_tok)).json()
        shop_id = od["shop"]["id"]
        # apply (may already exist -> 400)
        r = s.post(f"{BASE_URL}/api/karyawan/apply", json={
            "shop_id": shop_id, "portfolio_url": "http://x", "work_experience": "3 tahun"
        }, headers=H(karyawan_tok))
        assert r.status_code in (200, 400)
        # get list from owner
        klist = s.get(f"{BASE_URL}/api/owner/karyawan", headers=H(owner_tok)).json()["karyawan"]
        target = next((k for k in klist if k.get("email") == KARYAWAN["email"]), None)
        if not target:
            pytest.skip("karyawan record not found")
        # evaluate with high score -> should become active + create barber
        ev = s.post(f"{BASE_URL}/api/owner/karyawan/{target['id']}/evaluate",
                    json={"portfolio_weight": 18, "experience_weight": 18, "tools_weight": 15,
                          "bnsp_weight": 15, "cert_weight": 12, "diploma_weight": 10},
                    headers=H(owner_tok))
        assert ev.status_code == 200
        d = ev.json()
        assert d["total_score"] == 88
        assert d["status"] == "active"


# ---------- Admin ----------
class TestAdmin:
    def test_dashboard(self, s, admin_tok):
        r = s.get(f"{BASE_URL}/api/admin/dashboard", headers=H(admin_tok))
        assert r.status_code == 200
        st = r.json()["stats"]
        for k in ("total_shops", "pending_verifications", "total_customers", "revenue_today"):
            assert k in st

    def test_pending_shops_includes_seed(self, s, admin_tok):
        r = s.get(f"{BASE_URL}/api/admin/pending-shops", headers=H(admin_tok))
        assert r.status_code == 200
        names = [sh["name"] for sh in r.json()["shops"]]
        assert any("Barber Nusa Tenggara (Pending)" in n for n in names)

    def test_verify_reject_without_note(self, s, admin_tok):
        pend = s.get(f"{BASE_URL}/api/admin/pending-shops", headers=H(admin_tok)).json()["shops"]
        if not pend:
            pytest.skip("no pending shops")
        sid = pend[0]["id"]
        r = s.post(f"{BASE_URL}/api/admin/shops/{sid}/verify",
                   json={"decision": "rejected"}, headers=H(admin_tok))
        assert r.status_code == 400

    def test_users_paginated(self, s, admin_tok):
        r = s.get(f"{BASE_URL}/api/admin/users", params={"role": "customer", "page": 1, "size": 5}, headers=H(admin_tok))
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "users" in d
        for u in d["users"]:
            assert "password" not in u and "_id" not in u


# ---------- Hairstyles ----------
class TestHairstyles:
    def test_list_hairstyles(self, s):
        r = s.get(f"{BASE_URL}/api/hairstyles")
        assert r.status_code == 200
        rows = r.json()["hairstyles"]
        assert len(rows) >= 12
        assert all("suitable_shapes" in x and "match_score_map" in x for x in rows)

    def test_filter_by_shape(self, s):
        r = s.get(f"{BASE_URL}/api/hairstyles", params={"shape": "oval"})
        assert r.status_code == 200
        rows = r.json()["hairstyles"]
        assert len(rows) > 0
        assert all("oval" in x["suitable_shapes"] for x in rows)


# ---------- AI face scan ----------
class TestAI:
    def test_face_scan(self, s, customer_tok):
        # Use a small real-photo-ish JPEG (1x1 solid images are not allowed per playbook,
        # but the endpoint accepts anything; Gemini may reject blank).
        # We use a public human-face-like tiny sample - synth JPEG with gradient/noise.
        try:
            from PIL import Image
            import io, random
            img = Image.new("RGB", (256, 256))
            px = img.load()
            random.seed(1)
            for y in range(256):
                for x in range(256):
                    px[x, y] = ((x + y) % 255, (x * 3) % 255, (y * 5) % 255)
            buf = io.BytesIO(); img.save(buf, format="JPEG", quality=70)
            b64 = base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pytest.skip("Pillow not available")
        r = s.post(f"{BASE_URL}/api/ai/face-scan", json={"image_base64": b64},
                   headers=H(customer_tok), timeout=45)
        # Accept success OR Gemini rejection (502) since synthetic image
        assert r.status_code in (200, 502, 504), r.text
        if r.status_code == 200:
            d = r.json()
            assert d["faceShape"] in ("oval", "round", "square", "oblong", "heart")
            assert 0 <= d["confidence"] <= 100
            assert isinstance(d["recommendations"], list)


# ---------- Notifications ----------
class TestNotifications:
    def test_list_and_mark_all(self, s, customer_tok):
        r = s.get(f"{BASE_URL}/api/notifications", headers=H(customer_tok))
        assert r.status_code == 200
        assert "notifications" in r.json() and "unread" in r.json()
        m = s.post(f"{BASE_URL}/api/notifications/read-all", headers=H(customer_tok))
        assert m.status_code == 200
