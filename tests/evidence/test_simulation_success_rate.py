"""
EVIDENCE TEST 3.4 (tambahan) — Tingkat keberhasilan transaksi mode simulasi dari 20 percobaan.

Membuat 20 booking berbeda (slot waktu berbeda-beda supaya tidak bentrok — itu sudah
diuji terpisah di test_booking_race.py) lalu memanggil POST /payments/simulate/{id}
untuk masing-masing, mencatat berapa yang sukses (payment_status jadi "paid").

Cara menjalankan (dari root repo):
    backend/venv/Scripts/python.exe tests/evidence/test_simulation_success_rate.py
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
N = 20


async def register(client, role, label, idx):
    email = f"evidence.{RUN_ID}.{label}{idx}@example.com"
    r = await client.post(f"{BASE}/auth/register", json={
        "email": email, "password": "Evidence123!", "name": f"Evidence {label} {idx}",
        "phone": f"08{idx:09d}", "role": role,
    })
    r.raise_for_status()
    return r.json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        owner_token = await register(client, "owner", "simowner", 0)
        oh = auth(owner_token)
        r = await client.post(f"{BASE}/owner/shop", json={
            "name": f"Evidence Sim Shop {RUN_ID}", "address": "Jl. Evidence Sim",
            "latitude": -10.1789, "longitude": 123.607,
        }, headers=oh)
        r.raise_for_status()
        schedules = [{"day_name": d, "open_time": "06:00", "close_time": "23:00", "is_closed": False} for d in DAY_NAMES]
        await client.post(f"{BASE}/owner/schedules", json={"schedules": schedules}, headers=oh)
        r = await client.post(f"{BASE}/owner/barbers", json={"name": f"Barber Sim {RUN_ID}", "skill_level": "Standar"}, headers=oh)
        barber_id = r.json()["barber"]["id"]
        r = await client.post(f"{BASE}/owner/services", json={"name": "Potong Sim", "duration": 30, "price": 20000}, headers=oh)
        service_id = r.json()["service"]["id"]
        r = await client.get(f"{BASE}/owner/shop", headers=oh)
        shop_id = r.json()["shop"]["id"]

        target_date = time.strftime("%Y-%m-%d", time.localtime(time.time() + 8 * 86400))
        results = []
        for i in range(N):
            token = await register(client, "customer", "simcust", i)
            ch = auth(token)
            hour = 6 + i  # 06:00..25:00 -> tetap dalam 06:00-23:00 untuk i<17; i>=17 pakai menit :30
            time_str = f"{hour:02d}:00" if hour < 23 else f"{6 + (i - 17):02d}:30"
            r = await client.post(f"{BASE}/bookings", json={
                "shop_id": shop_id, "barber_id": barber_id, "service_id": service_id,
                "booking_date": target_date, "booking_time": time_str, "delivery_mode": "toko",
            }, headers=ch)
            if r.status_code != 200:
                results.append({"i": i, "step": "create_booking", "status_code": r.status_code, "ok": False})
                continue
            bid = r.json()["booking"]["id"]
            r = await client.post(f"{BASE}/payments/simulate/{bid}", headers=ch)
            results.append({"i": i, "step": "simulate_payment", "status_code": r.status_code, "ok": r.status_code == 200})

    success = sum(1 for x in results if x["ok"])
    out = {"run_id": RUN_ID, "n_attempts": N, "success": success, "failed": N - success, "details": results}
    out_path = Path(__file__).parent / "simulation_success_results.json"
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
