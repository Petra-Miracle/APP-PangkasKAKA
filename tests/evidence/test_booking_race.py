"""
EVIDENCE TEST 3.1 — Anti-bentrok booking (race condition).

Mencoba memesan slot waktu yang sama pada pemangkas yang sama sebanyak 20 kali:
sekali secara berurutan (baseline), sekali lagi secara bersamaan lewat asyncio.gather
(uji kondisi balapan / race condition).

WAJIB dijalankan terhadap server lokal yang menunjuk ke database TERPISAH dari data
produksi (lihat README di bagian atas file ini bila dijalankan ulang) — jangan pernah
menjalankan ini terhadap database yang dipakai akun demo/investor.

Cara menjalankan (lihat juga tests/evidence/README.md):
    1. Jalankan server lokal dengan DB_NAME terpisah, contoh (dari folder backend/):
       DB_NAME=pangkaskaka_evidence_test venv/Scripts/python.exe -m uvicorn server:app --port 8001
    2. Dari root repo: backend/venv/Scripts/python.exe tests/evidence/test_booking_race.py
"""
import asyncio
import json
import os
import time
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / "backend" / ".env")

BASE = os.environ.get("EVIDENCE_BASE_URL", "http://127.0.0.1:8001/api")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "pangkaskaka_evidence_test")
N = 20
RUN_ID = uuid.uuid4().hex[:8]

DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


async def register_and_login(client: httpx.AsyncClient, role: str, idx: int, extra: dict | None = None, label: str | None = None):
    label = label or role
    email = f"evidence.{RUN_ID}.{label}{idx}@example.com"
    password = "Evidence123!"
    body = {"email": email, "password": password, "name": f"Evidence {label} {idx}", "phone": f"08{idx:09d}", "role": role}
    if extra:
        body.update(extra)
    r = await client.post(f"{BASE}/auth/register", json=body)
    if r.status_code != 200:
        raise RuntimeError(f"register failed for {email}: {r.status_code} {r.text}")
    token = r.json()["token"]
    return token


async def setup_shop(client: httpx.AsyncClient):
    owner_token = await register_and_login(client, "owner", 0)
    h = {"Authorization": f"Bearer {owner_token}"}
    r = await client.post(f"{BASE}/owner/shop", json={
        "name": f"Evidence Barbershop {RUN_ID}", "address": "Jl. Evidence No. 1",
        "latitude": -10.1789, "longitude": 123.607,
    }, headers=h)
    r.raise_for_status()

    # Buka semua hari 08:00-22:00 supaya tanggal target pasti buka, apa pun harinya.
    schedules = [{"day_name": d, "open_time": "08:00", "close_time": "22:00", "is_closed": False} for d in DAY_NAMES]
    r = await client.post(f"{BASE}/owner/schedules", json={"schedules": schedules}, headers=h)
    r.raise_for_status()

    r = await client.post(f"{BASE}/owner/barbers", json={"name": f"Barber Evidence {RUN_ID}", "skill_level": "Standar"}, headers=h)
    r.raise_for_status()
    barber_id = r.json()["barber"]["id"]

    r = await client.post(f"{BASE}/owner/services", json={"name": "Potong Evidence", "duration": 30, "price": 20000}, headers=h)
    r.raise_for_status()
    service_id = r.json()["service"]["id"]

    r = await client.get(f"{BASE}/owner/shop", headers=h)
    r.raise_for_status()
    shop_id = r.json()["shop"]["id"]

    return shop_id, barber_id, service_id


async def make_customer_tokens(client: httpx.AsyncClient, n: int, batch: str):
    tasks = [register_and_login(client, "customer", i, label=f"customer{batch}") for i in range(n)]
    return await asyncio.gather(*tasks)


async def attempt_booking(client: httpx.AsyncClient, token: str, shop_id: str, barber_id: str, service_id: str, date_str: str, time_str: str):
    h = {"Authorization": f"Bearer {token}"}
    try:
        r = await client.post(f"{BASE}/bookings", json={
            "shop_id": shop_id, "barber_id": barber_id, "service_id": service_id,
            "booking_date": date_str, "booking_time": time_str, "delivery_mode": "toko",
        }, headers=h)
        return {"status_code": r.status_code, "ok": r.status_code == 200, "body": r.json() if r.headers.get("content-type", "").startswith("application/json") else None}
    except Exception as e:
        return {"status_code": None, "ok": False, "error": str(e)}


def count_real_bookings_in_db(barber_id: str, date_str: str, time_str: str) -> int:
    mc = MongoClient(MONGO_URL)
    db = mc[DB_NAME]
    n = db.bookings.count_documents({
        "barber_id": barber_id, "booking_date": date_str, "booking_time": time_str,
        "status": {"$ne": "cancelled"},
    })
    mc.close()
    return n


async def run_batch(client: httpx.AsyncClient, tokens, shop_id, barber_id, service_id, date_str, time_str, mode: str):
    if mode == "sequential":
        results = []
        for t in tokens:
            results.append(await attempt_booking(client, t, shop_id, barber_id, service_id, date_str, time_str))
        return results
    else:
        tasks = [attempt_booking(client, t, shop_id, barber_id, service_id, date_str, time_str) for t in tokens]
        return await asyncio.gather(*tasks)


async def main():
    if not MONGO_URL:
        raise SystemExit("MONGO_URL tidak ditemukan di backend/.env — tidak bisa verifikasi ground-truth DB.")
    if "evidence_test" not in DB_NAME and "test" not in DB_NAME.lower():
        raise SystemExit(f"DB_NAME='{DB_NAME}' tidak terlihat seperti database test. "
                          f"Batalkan demi keamanan data produksi — set DB_NAME eksplisit ke DB test sebelum menjalankan ini.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        shop_id, barber_id, service_id = await setup_shop(client)
        tokens_seq = await make_customer_tokens(client, N, "seq")
        tokens_conc = await make_customer_tokens(client, N, "conc")

        target_date = time.strftime("%Y-%m-%d", time.localtime(time.time() + 7 * 86400))

        seq_results = await run_batch(client, tokens_seq, shop_id, barber_id, service_id, target_date, "10:00", "sequential")
        seq_accepted = sum(1 for r in seq_results if r["ok"])
        seq_rejected = N - seq_accepted
        seq_db_count = count_real_bookings_in_db(barber_id, target_date, "10:00")

        conc_results = await run_batch(client, tokens_conc, shop_id, barber_id, service_id, target_date, "11:00", "concurrent")
        conc_accepted = sum(1 for r in conc_results if r["ok"])
        conc_rejected = N - conc_accepted
        conc_db_count = count_real_bookings_in_db(barber_id, target_date, "11:00")

    out = {
        "run_id": RUN_ID,
        "n_attempts_per_mode": N,
        "target_date": target_date,
        "sequential": {
            "time_slot": "10:00", "accepted": seq_accepted, "rejected": seq_rejected,
            "db_ground_truth_count": seq_db_count, "double_booking": seq_db_count > 1,
            "status_codes": [r["status_code"] for r in seq_results],
        },
        "concurrent": {
            "time_slot": "11:00", "accepted": conc_accepted, "rejected": conc_rejected,
            "db_ground_truth_count": conc_db_count, "double_booking": conc_db_count > 1,
            "status_codes": [r["status_code"] for r in conc_results],
        },
    }
    out_path = Path(__file__).parent / "booking_race_results.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
