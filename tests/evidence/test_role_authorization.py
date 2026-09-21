"""
EVIDENCE TEST 3.2 — Otorisasi antar peran.

Menguji 6 skenario minimal yang diminta REQUIREMENTS_EVIDENCE.md §3.2: memastikan satu
peran/pemilik tidak bisa mengakses atau memodifikasi data milik peran/pemilik lain.

WAJIB dijalankan terhadap server lokal yang menunjuk ke database TERPISAH dari data
produksi — lihat tests/evidence/README.md.

Cara menjalankan (dari root repo):
    backend/venv/Scripts/python.exe tests/evidence/test_role_authorization.py
"""
import asyncio
import json
import os
import time
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / "backend" / ".env")

BASE = os.environ.get("EVIDENCE_BASE_URL", "http://127.0.0.1:8001/api")
RUN_ID = uuid.uuid4().hex[:8]
DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


async def register(client, role: str, label: str, idx: int, extra: dict | None = None):
    email = f"evidence.{RUN_ID}.{label}{idx}@example.com"
    body = {"email": email, "password": "Evidence123!", "name": f"Evidence {label} {idx}",
            "phone": f"08{idx:09d}", "role": role}
    if extra:
        body.update(extra)
    r = await client.post(f"{BASE}/auth/register", json=body)
    if r.status_code != 200:
        raise RuntimeError(f"register failed for {email}: {r.status_code} {r.text}")
    d = r.json()
    return d["token"], d["user"]["id"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def setup_shop(client, label: str):
    token, _ = await register(client, "owner", label, 0)
    h = auth(token)
    r = await client.post(f"{BASE}/owner/shop", json={
        "name": f"Evidence Shop {label} {RUN_ID}", "address": "Jl. Evidence",
        "latitude": -10.1789, "longitude": 123.607,
    }, headers=h)
    r.raise_for_status()
    schedules = [{"day_name": d, "open_time": "08:00", "close_time": "22:00", "is_closed": False} for d in DAY_NAMES]
    await client.post(f"{BASE}/owner/schedules", json={"schedules": schedules}, headers=h)
    r = await client.post(f"{BASE}/owner/services", json={"name": f"Layanan {label}", "duration": 30, "price": 20000}, headers=h)
    r.raise_for_status()
    service_id = r.json()["service"]["id"]
    r = await client.get(f"{BASE}/owner/shop", headers=h)
    shop_id = r.json()["shop"]["id"]
    return token, shop_id, service_id


async def make_active_karyawan(client, owner_token, shop_id, label: str, idx: int):
    """Daftar sbg karyawan, ajukan lamaran ke shop_id, owner meluluskan berkas + tes
    (skor total 90/120) sehingga status jadi 'active' dan tercipta db.barbers (StreetBarber)."""
    k_token, k_profile_id = await register(client, "karyawan", label, idx)
    kh = auth(k_token)
    r = await client.post(f"{BASE}/karyawan/apply", json={
        "shop_id": shop_id, "ktp_photo": "x" * 25,
        "work_experience": "Pengalaman evidence test lebih dari 20 karakter panjangnya.",
        "criteria_agreed": True,
    }, headers=kh)
    r.raise_for_status()
    kid = r.json()["application"]["id"]

    oh = auth(owner_token)
    r = await client.post(f"{BASE}/owner/karyawan/{kid}/berkas-decision", json={"decision": "lolos"}, headers=oh)
    r.raise_for_status()
    r = await client.post(f"{BASE}/owner/karyawan/{kid}/evaluate", json={
        "portfolio_weight": 15, "experience_weight": 15, "tools_weight": 15,
        "bnsp_weight": 15, "cert_weight": 15, "diploma_weight": 15,
    }, headers=oh)
    r.raise_for_status()
    assert r.json()["status"] == "active", f"karyawan {label}{idx} gagal jadi active: {r.json()}"

    r = await client.get(f"{BASE}/karyawan/my", headers=kh)
    barbers = await client.get(f"{BASE}/shops/{shop_id}", headers=kh)
    barber = next(b for b in barbers.json()["barbers"] if b.get("karyawan_id") == kid)
    barber_id = barber["id"]

    await client.post(f"{BASE}/karyawan/location", json={"lat": -10.1789, "lng": 123.607, "is_online": True}, headers=kh)
    # Pre-warm wallet SEBELUM transaksi apa pun menyentuhnya — lihat catatan bug di
    # EVIDENCE_PACK.md: get_or_create_wallet() dipanggil TANPA session Mongo di dalam
    # _release_booking_funds/_hold_booking_funds, sehingga kalau wallet baru pertama kali
    # dibuat SAAT SUDAH di dalam transaksi, insert itu tidak terlihat oleh baca berikutnya
    # dalam transaksi yang sama (snapshot isolation) -> _adjust_wallet mengembalikan None
    # -> crash 500. Memanggil /wallets/me dulu (di luar transaksi) menghindari repro itu.
    await client.get(f"{BASE}/wallets/me", headers=kh)
    return k_token, k_profile_id, kid, barber_id


async def book_and_confirm(client, owner_token, shop_id, service_id, barber_id, cust_label: str, idx: int):
    c_token, c_id = await register(client, "customer", cust_label, idx)
    ch = auth(c_token)
    target_date = time.strftime("%Y-%m-%d", time.localtime(time.time() + 7 * 86400))
    r = await client.post(f"{BASE}/bookings", json={
        "shop_id": shop_id, "barber_id": barber_id, "service_id": service_id,
        "booking_date": target_date, "booking_time": f"{9 + idx:02d}:00", "delivery_mode": "rumah",
        "customer_address": "Jl. Rumah Evidence", "customer_lat": -10.1789, "customer_lng": 123.607,
    }, headers=ch)
    r.raise_for_status()
    bid = r.json()["booking"]["id"]
    # _mark_booking_paid sudah otomatis mengubah status pending -> confirmed saat bayar
    # (server.py:3368), jadi tidak perlu lagi memanggil /owner/orders/{bid}/status di sini.
    r = await client.post(f"{BASE}/payments/simulate/{bid}", headers=ch)
    r.raise_for_status()
    return c_token, c_id, bid


async def main():
    scenarios = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        owner_x_token, shop_x, service_x = await setup_shop(client, "ox2")
        owner_y_token, shop_y, service_y = await setup_shop(client, "oy2")

        karyawan_a_token, karyawan_a_profile, kid_a, barber_a = await make_active_karyawan(client, owner_x_token, shop_x, "karA", 0)
        karyawan_b_token, karyawan_b_profile, kid_b, barber_b = await make_active_karyawan(client, owner_x_token, shop_x, "karB", 0)

        cust1_token, cust1_id, booking_1 = await book_and_confirm(client, owner_x_token, shop_x, service_x, barber_a, "cust1", 0)
        cust2_token, cust2_id, booking_2 = await book_and_confirm(client, owner_x_token, shop_x, service_x, barber_b, "cust2", 0)

        # ---------- Skenario 1: karyawan A menyelesaikan booking milik karyawan B ----------
        r = await client.post(f"{BASE}/karyawan/bookings/{booking_2}/complete", headers=auth(karyawan_a_token))
        scenarios.append({
            "no": 1, "desc": "Pemangkas A menyelesaikan booking milik pemangkas B",
            "status_code": r.status_code, "blocked": r.status_code in (401, 403, 404),
        })

        # karyawan B & A menyelesaikan booking milik sendiri (legit) supaya earnings ada isinya
        rA = await client.post(f"{BASE}/karyawan/bookings/{booking_1}/complete", headers=auth(karyawan_a_token))
        rB = await client.post(f"{BASE}/karyawan/bookings/{booking_2}/complete", headers=auth(karyawan_b_token))

        # ---------- Skenario 2: isolasi rekap penghasilan antar pemangkas ----------
        earn_a = await client.get(f"{BASE}/karyawan/earnings", headers=auth(karyawan_a_token))
        earn_b = await client.get(f"{BASE}/karyawan/earnings", headers=auth(karyawan_b_token))
        a_count = earn_a.json().get("completed_count")
        b_count = earn_b.json().get("completed_count")
        isolated = (a_count == 1 and b_count == 1)  # masing2 hanya lihat booking miliknya sendiri, bukan gabungan berdua (2)
        scenarios.append({
            "no": 2, "desc": "Pemangkas A membuka rekap penghasilan — verifikasi isolasi dari data pemangkas B",
            "status_code": earn_a.status_code,
            "karyawan_a_completed_count": a_count, "karyawan_b_completed_count": b_count,
            "blocked": isolated,
            "note": "'blocked' di sini berarti data A tidak tercampur dengan data B (masing-masing hanya 1, bukan 2)",
        })

        # ---------- Skenario 3: owner X mengedit layanan milik toko Y ----------
        r = await client.put(f"{BASE}/owner/services/{service_y}", json={"name": "Diretas", "duration": 10, "price": 1}, headers=auth(owner_x_token))
        scenarios.append({
            "no": 3, "desc": "Owner toko X mengedit layanan toko Y",
            "status_code": r.status_code, "blocked": r.status_code in (401, 403, 404),
        })

        # ---------- Skenario 4: customer mengakses endpoint khusus owner ----------
        r = await client.get(f"{BASE}/owner/orders", headers=auth(cust1_token))
        scenarios.append({
            "no": 4, "desc": "Customer mengakses endpoint khusus owner (/owner/orders)",
            "status_code": r.status_code, "blocked": r.status_code in (401, 403),
        })

        # ---------- Skenario 5: customer membatalkan booking milik customer lain ----------
        r = await client.post(f"{BASE}/bookings/{booking_1}/cancel", headers=auth(cust2_token))
        scenarios.append({
            "no": 5, "desc": "Customer 2 membatalkan/menyelesaikan booking milik Customer 1",
            "status_code": r.status_code, "blocked": r.status_code in (401, 403, 404),
        })

        # ---------- Skenario 6: request tanpa token ----------
        r = await client.get(f"{BASE}/wallets/me")
        scenarios.append({
            "no": 6, "desc": "Request tanpa token ke endpoint yang butuh autentikasi (/wallets/me)",
            "status_code": r.status_code, "blocked": r.status_code in (401, 403),
        })

    blocked_count = sum(1 for s in scenarios if s["blocked"])
    out = {"run_id": RUN_ID, "scenarios": scenarios, "summary": f"{blocked_count} dari {len(scenarios)} skenario diblokir dengan benar"}
    out_path = Path(__file__).parent / "role_authorization_results.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
