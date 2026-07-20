"""
PangkasKAKA Backend — FastAPI + MongoDB
On-demand barbershop booking platform for Kupang City, Indonesia
"""
import os
import math
import uuid
import base64
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, timezone, date, time as dtime
from typing import List, Optional, Any, Literal

import bcrypt
import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Body
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", 168))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="PangkasKAKA API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("pangkaskaka")

WITA = timezone(timedelta(hours=8))


# ---------- Utilities ----------
def now_utc():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(uid: str, role: str) -> str:
    payload = {
        "sub": uid,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token tidak valid")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(401, "Sesi kadaluarsa, silakan login ulang")
    user = await db.profiles.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "Pengguna tidak ditemukan")
    return user


def require_role(*roles):
    async def _dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Akses ditolak untuk role ini")
        return user
    return _dep


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    to_rad = math.radians
    dlat = to_rad(lat2 - lat1)
    dlng = to_rad(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(dlng / 2) ** 2
    return round(R * 2 * math.asin(math.sqrt(a)) * 100) / 100


def bayesian_rating(v: int, R: float, C: float, m: int = 10) -> float:
    if v + m == 0:
        return 0.0
    return round(((v / (v + m)) * R + (m / (v + m)) * C) * 100) / 100


def clean(d: dict) -> dict:
    """Strip _id and password."""
    if not d:
        return d
    d.pop("_id", None)
    d.pop("password", None)
    return d


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str
    role: Literal["customer", "owner", "admin", "karyawan"] = "customer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    photo: Optional[str] = None


class ShopRegisterIn(BaseModel):
    name: str
    category: str = "Barbershop"
    address: str
    latitude: float
    longitude: float
    price_range: str = "Rp 25.000 - Rp 75.000"
    image: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    doc_ktp: Optional[str] = None
    doc_nib: Optional[str] = None
    doc_npwp: Optional[str] = None
    doc_surat_usaha: Optional[str] = None


class VerifyShopIn(BaseModel):
    decision: Literal["approved", "rejected"]
    note: Optional[str] = None


class BarberIn(BaseModel):
    name: str
    photo: Optional[str] = None
    specialization: Optional[str] = None
    skill_level: Literal["Junior", "Standar", "Senior"] = "Standar"


class ServiceIn(BaseModel):
    name: str
    duration: int  # minutes
    price: int


class ScheduleRow(BaseModel):
    day_name: Literal["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    open_time: str = "09:00"
    close_time: str = "21:00"
    is_closed: bool = False


class SaveSchedulesIn(BaseModel):
    schedules: List[ScheduleRow]


class BookingIn(BaseModel):
    shop_id: str
    barber_id: str
    service_id: str
    booking_date: str  # YYYY-MM-DD
    booking_time: str  # HH:MM
    customer_lat: Optional[float] = None
    customer_lng: Optional[float] = None


class ReviewIn(BaseModel):
    rating: int
    comment: Optional[str] = None


class KaryawanApplyIn(BaseModel):
    shop_id: str
    portfolio_url: Optional[str] = None
    work_experience: Optional[str] = None
    tools_photo: Optional[str] = None
    bnsp_cert: Optional[str] = None
    certificates: Optional[str] = None
    diploma_photo: Optional[str] = None


class EvaluateKaryawanIn(BaseModel):
    portfolio_weight: int  # 0-20
    experience_weight: int
    tools_weight: int
    bnsp_weight: int
    cert_weight: int
    diploma_weight: int


class AIFaceScanIn(BaseModel):
    image_base64: str


class NotifyIn(BaseModel):
    user_id: str
    title: str
    message: str
    type: str = "info"


# ---------- Helper: Notifications ----------
async def send_notif(user_id: str, title: str, message: str, type: str = "info"):
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "is_read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.notifications.insert_one(doc)


# ---------- Helper: Slot Generator ----------
def gen_time_slots(open_t: str, close_t: str, interval: int = 30) -> List[str]:
    oh, om = map(int, open_t.split(":"))
    ch, cm = map(int, close_t.split(":"))
    start = oh * 60 + om
    end = ch * 60 + cm
    slots = []
    t = start
    while t + interval <= end:
        slots.append(f"{t // 60:02d}:{t % 60:02d}")
        t += interval
    return slots


def time_to_min(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]


async def compute_available_slots(shop_id: str, barber_id: str, date_str: str, service_duration: int):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_name = DAY_NAMES[d.weekday() + 1 if d.weekday() < 6 else 0] if False else DAY_NAMES[(d.weekday() + 1) % 7]
    # weekday: Mon=0..Sun=6 ; DAY_NAMES index 0=Minggu
    # Map: Sun(6)->0, Mon(0)->1 ...
    wd = d.weekday()
    day_name = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][wd]
    sched = await db.shop_schedules.find_one({"shop_id": shop_id, "day_name": day_name}, {"_id": 0})
    if not sched or sched.get("is_closed"):
        return []
    all_slots = gen_time_slots(sched["open_time"], sched["close_time"], 30)
    # existing bookings
    bookings = await db.bookings.find(
        {"barber_id": barber_id, "booking_date": date_str, "status": {"$ne": "cancelled"}},
        {"_id": 0, "booking_time": 1, "duration": 1},
    ).to_list(500)
    booked_ranges = []
    for b in bookings:
        bt = time_to_min(b["booking_time"])
        dur = b.get("duration", 30)
        booked_ranges.append((bt, bt + dur))
    result = []
    now_wita = datetime.now(WITA)
    is_today = (d == now_wita.date())
    for s in all_slots:
        s_min = time_to_min(s)
        s_end = s_min + service_duration
        # Overlap check
        overlap = any(not (s_end <= r[0] or s_min >= r[1]) for r in booked_ranges)
        # past today
        past = is_today and (s_min <= now_wita.hour * 60 + now_wita.minute)
        result.append({"time": s, "available": (not overlap) and (not past)})
    return result


async def expire_stale_bookings():
    """Lazy cleanup: cancel unpaid pending bookings older than 15 min."""
    cutoff = (now_utc() - timedelta(minutes=15)).isoformat()
    await db.bookings.update_many(
        {"payment_status": "unpaid", "status": "pending", "created_at": {"$lt": cutoff}},
        {"$set": {"status": "cancelled", "payment_status": "forfeited"}},
    )


async def recalc_shop_rating(shop_id: str):
    reviews = await db.reviews.find({"shop_id": shop_id}, {"_id": 0, "rating": 1}).to_list(1000)
    all_reviews = await db.reviews.find({}, {"_id": 0, "rating": 1}).to_list(50000)
    if not reviews:
        avg = 0.0
        v = 0
    else:
        v = len(reviews)
        avg = sum(r["rating"] for r in reviews) / v
    if all_reviews:
        C = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    else:
        C = 4.0
    wr = bayesian_rating(v, avg, C, m=10)
    await db.barbershops.update_one({"id": shop_id}, {"$set": {"rating": wr, "reviews_count": v}})
    return wr


# ============================================================
# AUTH ENDPOINTS
# ============================================================
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.profiles.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email sudah terdaftar")
    if len(body.password) < 8:
        raise HTTPException(400, "Password minimal 8 karakter")
    uid = new_id()
    profile = {
        "id": uid,
        "email": body.email.lower(),
        "password": hash_pw(body.password),
        "name": body.name,
        "phone": body.phone,
        "role": body.role,
        "address": "",
        "photo": "",
        "created_at": now_utc().isoformat(),
    }
    await db.profiles.insert_one(profile)
    if body.role == "owner":
        await db.owners.insert_one({
            "id": uid, "name": body.name, "phone": body.phone,
            "email": body.email.lower(), "address": ""
        })
    token = make_token(uid, body.role)
    return {"token": token, "user": clean(profile)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.profiles.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Email atau password salah")
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": clean(dict(user))}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}


@api.put("/auth/profile")
async def update_profile(body: UpdateProfileIn, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.profiles.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.profiles.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {"user": fresh}


# ============================================================
# BARBERSHOPS (CUSTOMER)
# ============================================================
@api.get("/shops")
async def list_shops(lat: Optional[float] = None, lng: Optional[float] = None, sort: str = "terdekat"):
    await expire_stale_bookings()
    shops = await db.barbershops.find(
        {"is_verified": True, "verification_status": "approved"}, {"_id": 0}
    ).to_list(500)
    for s in shops:
        if lat is not None and lng is not None:
            s["distance_km"] = haversine_km(lat, lng, s["latitude"], s["longitude"])
        else:
            s["distance_km"] = None
    if sort == "terdekat" and lat is not None:
        shops.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 9999))
    elif sort == "rating":
        shops.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort == "harga":
        shops.sort(key=lambda x: x.get("price_range", ""))
    return {"shops": shops}


@api.get("/shops/{shop_id}")
async def shop_detail(shop_id: str):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Barbershop tidak ditemukan")
    services = await db.services.find({"shop_id": shop_id}, {"_id": 0}).to_list(100)
    barbers = await db.barbers.find({"shop_id": shop_id, "status": "active"}, {"_id": 0}).to_list(100)
    schedules = await db.shop_schedules.find({"shop_id": shop_id}, {"_id": 0}).to_list(20)
    reviews = await db.reviews.find({"shop_id": shop_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # enrich reviews with reviewer names
    for r in reviews:
        u = await db.profiles.find_one({"id": r["user_id"]}, {"_id": 0, "name": 1, "photo": 1})
        r["reviewer"] = u
    shop["services"] = services
    shop["barbers"] = barbers
    shop["schedules"] = schedules
    shop["reviews"] = reviews
    return shop


@api.get("/shops/{shop_id}/slots")
async def get_slots(shop_id: str, barber_id: str, date: str, service_id: str):
    await expire_stale_bookings()
    svc = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Layanan tidak ditemukan")
    slots = await compute_available_slots(shop_id, barber_id, date, svc["duration"])
    return {"slots": slots}


# ============================================================
# BOOKINGS
# ============================================================
@api.post("/bookings")
async def create_booking(body: BookingIn, user=Depends(get_current_user)):
    await expire_stale_bookings()
    svc = await db.services.find_one({"id": body.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Layanan tidak ditemukan")
    # re-validate slot
    slots = await compute_available_slots(body.shop_id, body.barber_id, body.booking_date, svc["duration"])
    match = next((s for s in slots if s["time"] == body.booking_time), None)
    if not match or not match["available"]:
        raise HTTPException(409, "Slot baru saja dipesan orang lain, silakan pilih waktu lain")
    price = svc["price"]  # trust DB
    bid = new_id()
    booking = {
        "id": bid,
        "user_id": user["id"],
        "shop_id": body.shop_id,
        "barber_id": body.barber_id,
        "service_id": body.service_id,
        "duration": svc["duration"],
        "booking_date": body.booking_date,
        "booking_time": body.booking_time,
        "status": "pending",
        "payment_status": "unpaid",
        "total_price": price,
        "qris_code": f"QRIS-{new_id()[:12].upper()}",
        "payment_method": "qris",
        "customer_lat": body.customer_lat,
        "customer_lng": body.customer_lng,
        "arrival_status": "unknown",
        "created_at": now_utc().isoformat(),
    }
    await db.bookings.insert_one(booking)
    # race check
    dupes = await db.bookings.find({
        "barber_id": body.barber_id, "booking_date": body.booking_date,
        "booking_time": body.booking_time, "status": {"$ne": "cancelled"}
    }, {"_id": 0}).to_list(10)
    if len(dupes) > 1:
        latest = max(dupes, key=lambda x: x["created_at"])
        if latest["id"] == bid:
            await db.bookings.delete_one({"id": bid})
            raise HTTPException(409, "Slot baru saja dipesan orang lain, silakan pilih waktu lain")
    await db.payments.insert_one({
        "id": new_id(), "booking_id": bid,
        "transaction_id": f"TRX-{int(now_utc().timestamp())}-{new_id()[:8]}",
        "amount": price, "method": "qris", "status": "pending",
        "created_at": now_utc().isoformat(),
    })
    return {"booking": clean(booking)}


@api.post("/bookings/{bid}/pay")
async def pay_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b["payment_status"] == "paid":
        return {"ok": True, "already": True}
    # check expiry
    created = datetime.fromisoformat(b["created_at"])
    if (now_utc() - created).total_seconds() > 15 * 60:
        await db.bookings.update_one({"id": bid}, {"$set": {"status": "cancelled", "payment_status": "forfeited"}})
        raise HTTPException(410, "Pembayaran kadaluarsa, silakan pesan ulang")
    await db.bookings.update_one({"id": bid}, {"$set": {"payment_status": "paid", "status": "confirmed"}})
    await db.payments.update_one({"booking_id": bid}, {"$set": {"status": "success", "paid_at": now_utc().isoformat()}})
    shop = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0})
    await send_notif(user["id"], "Pembayaran berhasil", f"Booking di {shop['name']} telah dikonfirmasi.", "payment")
    if shop:
        await send_notif(shop["owner_id"], "Pesanan baru masuk!", f"{user['name']} memesan slot {b['booking_time']} pada {b['booking_date']}.", "booking")
    return {"ok": True}


@api.get("/bookings/{bid}")
async def get_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Tidak ditemukan")
    if b["user_id"] != user["id"] and user["role"] != "admin":
        # owner can view own shop bookings
        shop = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "owner_id": 1})
        if not (user["role"] == "owner" and shop and shop["owner_id"] == user["id"]):
            raise HTTPException(403, "Akses ditolak")
    b["shop"] = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1, "image": 1, "address": 1})
    b["service"] = await db.services.find_one({"id": b["service_id"]}, {"_id": 0})
    b["barber"] = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0})
    return b


@api.get("/bookings")
async def my_bookings(user=Depends(get_current_user)):
    await expire_stale_bookings()
    bookings = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for b in bookings:
        b["shop"] = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1, "image": 1, "address": 1})
        b["service"] = await db.services.find_one({"id": b["service_id"]}, {"_id": 0})
        b["barber"] = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0, "name": 1, "photo": 1})
        b["has_review"] = bool(await db.reviews.find_one({"booking_id": b["id"]}))
    return {"bookings": bookings}


@api.post("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b["status"] not in ("pending", "confirmed"):
        raise HTTPException(400, "Pesanan ini tidak bisa dibatalkan")
    # min 2 hours before
    dt = datetime.strptime(f"{b['booking_date']} {b['booking_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=WITA)
    if dt < datetime.now(WITA) + timedelta(hours=2):
        raise HTTPException(400, "Pembatalan hanya bisa maksimal H-2 jam")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


@api.post("/bookings/{bid}/review")
async def review_booking(bid: str, body: ReviewIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b["status"] != "completed":
        raise HTTPException(400, "Hanya pesanan selesai yang bisa diulas")
    existing = await db.reviews.find_one({"booking_id": bid})
    if existing:
        raise HTTPException(400, "Ulasan sudah pernah diberikan")
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(400, "Rating harus 1-5")
    await db.reviews.insert_one({
        "id": new_id(), "booking_id": bid, "user_id": user["id"],
        "shop_id": b["shop_id"], "rating": body.rating, "comment": body.comment or "",
        "created_at": now_utc().isoformat(),
    })
    await recalc_shop_rating(b["shop_id"])
    return {"ok": True}


# ============================================================
# OWNER
# ============================================================
@api.get("/owner/shop")
async def owner_shop(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0})
    return {"shop": shop}


@api.post("/owner/shop")
async def register_shop(body: ShopRegisterIn, user=Depends(require_role("owner"))):
    existing = await db.barbershops.find_one({"owner_id": user["id"]})
    sid = existing["id"] if existing else new_id()
    doc = {
        "id": sid,
        "owner_id": user["id"],
        "name": body.name,
        "category": body.category,
        "address": body.address,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "price_range": body.price_range,
        "image": body.image or "",
        "rating": existing["rating"] if existing else 0.0,
        "reviews_count": existing["reviews_count"] if existing else 0,
        "is_verified": False,
        "verification_status": "pending",
        "verification_note": "",
        "bank_name": body.bank_name or "",
        "account_number": body.account_number or "",
        "account_holder": body.account_holder or "",
        "doc_ktp": body.doc_ktp or "",
        "doc_nib": body.doc_nib or "",
        "doc_npwp": body.doc_npwp or "",
        "doc_surat_usaha": body.doc_surat_usaha or "",
        "docs_submitted_at": now_utc().isoformat(),
        "created_at": existing["created_at"] if existing else now_utc().isoformat(),
    }
    await db.barbershops.replace_one({"id": sid}, doc, upsert=True)
    # notify admins
    admins = await db.profiles.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Pengajuan Toko Baru", f"{body.name} menunggu verifikasi.", "system")
    return {"shop": clean(doc)}


@api.get("/owner/dashboard")
async def owner_dashboard(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not shop:
        return {"shop": None}
    today = datetime.now(WITA).date().isoformat()
    month_start = datetime.now(WITA).replace(day=1, hour=0, minute=0, second=0).isoformat()
    today_count = await db.bookings.count_documents({"shop_id": shop["id"], "booking_date": today})
    paid_this_month = await db.bookings.find({
        "shop_id": shop["id"], "payment_status": "paid",
        "created_at": {"$gte": month_start}
    }, {"_id": 0, "total_price": 1}).to_list(2000)
    revenue = sum(b["total_price"] for b in paid_this_month)
    barbers_active = await db.barbers.count_documents({"shop_id": shop["id"], "status": "active"})
    latest = await db.bookings.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    for b in latest:
        u = await db.profiles.find_one({"id": b["user_id"]}, {"_id": 0, "name": 1})
        s = await db.services.find_one({"id": b["service_id"]}, {"_id": 0, "name": 1})
        b["customer_name"] = u["name"] if u else ""
        b["service_name"] = s["name"] if s else ""
    return {
        "shop": shop,
        "stats": {
            "today_orders": today_count,
            "monthly_revenue": revenue,
            "active_barbers": barbers_active,
            "rating": shop.get("rating", 0),
        },
        "latest_orders": latest,
    }


@api.get("/owner/orders")
async def owner_orders(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        return {"orders": []}
    orders = await db.bookings.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for o in orders:
        u = await db.profiles.find_one({"id": o["user_id"]}, {"_id": 0, "name": 1, "phone": 1})
        s = await db.services.find_one({"id": o["service_id"]}, {"_id": 0, "name": 1})
        br = await db.barbers.find_one({"id": o["barber_id"]}, {"_id": 0, "name": 1})
        o["customer"] = u
        o["service_name"] = s["name"] if s else ""
        o["barber_name"] = br["name"] if br else ""
    return {"orders": orders}


@api.post("/owner/orders/{bid}/status")
async def update_order_status(bid: str, payload: dict = Body(...), user=Depends(require_role("owner"))):
    new_status = payload.get("status")
    valid = {"pending": ["confirmed", "cancelled"], "confirmed": ["completed", "cancelled"]}
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    shop = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "owner_id": 1})
    if shop["owner_id"] != user["id"]:
        raise HTTPException(403, "Bukan milik Anda")
    if new_status not in valid.get(b["status"], []):
        raise HTTPException(400, "Transisi status tidak valid")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": new_status}})
    await send_notif(b["user_id"], "Status pesanan berubah", f"Pesanan Anda kini: {new_status}", "booking")
    return {"ok": True}


@api.post("/owner/barbers")
async def add_barber(body: BarberIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    doc = {"id": new_id(), "shop_id": shop["id"], "karyawan_id": None,
           "name": body.name, "photo": body.photo or "", "specialization": body.specialization or "",
           "skill_level": body.skill_level, "rating": 0.0, "status": "active",
           "created_at": now_utc().isoformat()}
    await db.barbers.insert_one(doc)
    return {"barber": clean(doc)}


@api.delete("/owner/barbers/{bid}")
async def deactivate_barber(bid: str, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    await db.barbers.update_one({"id": bid, "shop_id": shop["id"]}, {"$set": {"status": "inactive"}})
    return {"ok": True}


@api.post("/owner/services")
async def add_service(body: ServiceIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    doc = {"id": new_id(), "shop_id": shop["id"], "name": body.name,
           "duration": body.duration, "price": body.price,
           "created_at": now_utc().isoformat()}
    await db.services.insert_one(doc)
    return {"service": clean(doc)}


@api.delete("/owner/services/{sid}")
async def delete_service(sid: str, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    await db.services.delete_one({"id": sid, "shop_id": shop["id"]})
    return {"ok": True}


@api.post("/owner/schedules")
async def save_schedules(body: SaveSchedulesIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    for row in body.schedules:
        await db.shop_schedules.update_one(
            {"shop_id": shop["id"], "day_name": row.day_name},
            {"$set": {"open_time": row.open_time, "close_time": row.close_time, "is_closed": row.is_closed,
                      "shop_id": shop["id"], "day_name": row.day_name, "id": new_id()}},
            upsert=True,
        )
    return {"ok": True}


@api.get("/owner/karyawan")
async def owner_list_karyawan(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        return {"karyawan": []}
    rows = await db.karyawan.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"karyawan": rows}


@api.post("/owner/karyawan/{kid}/evaluate")
async def evaluate_karyawan(kid: str, body: EvaluateKaryawanIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    k = await db.karyawan.find_one({"id": kid, "shop_id": shop["id"]}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    weights = body.dict()
    total = sum(weights.values())
    status = "active" if total >= 60 else "rejected"
    updates = {**weights, "total_score": total, "status": status,
               "evaluated_at": now_utc().isoformat()}
    await db.karyawan.update_one({"id": kid}, {"$set": updates})
    if status == "active":
        skill = "Senior" if total >= 85 else ("Standar" if total >= 70 else "Junior")
        await db.barbers.insert_one({
            "id": new_id(), "shop_id": shop["id"], "karyawan_id": kid,
            "name": k["name"], "photo": k.get("diploma_photo", ""),
            "specialization": "", "skill_level": skill, "rating": 0.0,
            "status": "active", "created_at": now_utc().isoformat(),
        })
        await send_notif(k["profile_id"], "Selamat! Anda diterima", f"Skor: {total}. Level: {skill}", "system")
    else:
        await send_notif(k["profile_id"], "Lamaran ditolak", f"Skor Anda: {total}", "system")
    return {"ok": True, "total_score": total, "status": status}


# ============================================================
# KARYAWAN
# ============================================================
@api.post("/karyawan/apply")
async def karyawan_apply(body: KaryawanApplyIn, user=Depends(require_role("karyawan"))):
    existing = await db.karyawan.find_one({"profile_id": user["id"], "shop_id": body.shop_id})
    if existing:
        raise HTTPException(400, "Anda sudah melamar ke toko ini")
    doc = {
        "id": new_id(),
        "profile_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "shop_id": body.shop_id,
        "portfolio_url": body.portfolio_url or "",
        "work_experience": body.work_experience or "",
        "tools_photo": body.tools_photo or "",
        "bnsp_cert": body.bnsp_cert or "",
        "certificates": body.certificates or "",
        "diploma_photo": body.diploma_photo or "",
        "total_score": 0, "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.karyawan.insert_one(doc)
    shop = await db.barbershops.find_one({"id": body.shop_id}, {"_id": 0, "owner_id": 1, "name": 1})
    if shop:
        await send_notif(shop["owner_id"], "Lamaran baru", f"{user['name']} melamar sebagai barber.", "system")
    return {"application": clean(doc)}


@api.get("/karyawan/my")
async def karyawan_my(user=Depends(require_role("karyawan"))):
    rows = await db.karyawan.find({"profile_id": user["id"]}, {"_id": 0}).to_list(50)
    for r in rows:
        s = await db.barbershops.find_one({"id": r["shop_id"]}, {"_id": 0, "name": 1, "image": 1})
        r["shop"] = s
    return {"applications": rows}


# ============================================================
# ADMIN
# ============================================================
@api.get("/admin/dashboard")
async def admin_dashboard(user=Depends(require_role("admin"))):
    total_shops = await db.barbershops.count_documents({})
    pending = await db.barbershops.count_documents({"verification_status": "pending"})
    customers = await db.profiles.count_documents({"role": "customer"})
    today = datetime.now(WITA).date().isoformat()
    paid_today = await db.bookings.find({"payment_status": "paid", "booking_date": today}, {"_id": 0, "total_price": 1}).to_list(2000)
    revenue_today = sum(b["total_price"] for b in paid_today)
    return {
        "stats": {
            "total_shops": total_shops,
            "pending_verifications": pending,
            "total_customers": customers,
            "revenue_today": revenue_today,
        }
    }


@api.get("/admin/pending-shops")
async def admin_pending(user=Depends(require_role("admin"))):
    shops = await db.barbershops.find({"verification_status": "pending"}, {"_id": 0}).sort("docs_submitted_at", -1).to_list(200)
    for s in shops:
        o = await db.profiles.find_one({"id": s["owner_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        s["owner"] = o
    return {"shops": shops}


@api.post("/admin/shops/{shop_id}/verify")
async def admin_verify(shop_id: str, body: VerifyShopIn, user=Depends(require_role("admin"))):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    if body.decision == "approved":
        await db.barbershops.update_one({"id": shop_id}, {"$set": {
            "is_verified": True, "verification_status": "approved",
            "verified_at": now_utc().isoformat(), "verification_note": ""
        }})
        await send_notif(shop["owner_id"], "Toko disetujui!", "Selamat, toko Anda telah lolos verifikasi.", "system")
    else:
        if not body.note:
            raise HTTPException(400, "Alasan penolakan wajib diisi")
        await db.barbershops.update_one({"id": shop_id}, {"$set": {
            "is_verified": False, "verification_status": "rejected",
            "verification_note": body.note
        }})
        await send_notif(shop["owner_id"], "Toko ditolak", body.note, "system")
    return {"ok": True}


@api.post("/admin/shops/{shop_id}/suspend")
async def admin_suspend(shop_id: str, payload: dict = Body(...), user=Depends(require_role("admin"))):
    reason = payload.get("reason", "Pelanggaran kebijakan")
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    await db.barbershops.update_one({"id": shop_id}, {"$set": {
        "is_verified": False, "verification_status": "rejected", "verification_note": reason
    }})
    affected = await db.bookings.find({"shop_id": shop_id, "status": {"$in": ["pending", "confirmed"]}}, {"_id": 0}).to_list(500)
    for b in affected:
        await db.bookings.update_one({"id": b["id"]}, {"$set": {"status": "cancelled"}})
        await send_notif(b["user_id"], "Booking dibatalkan", f"Toko telah ditangguhkan: {reason}", "system")
    return {"ok": True, "cancelled_bookings": len(affected)}


@api.get("/admin/users")
async def admin_users(role: str = "customer", search: str = "", page: int = 1, size: int = 20, user=Depends(require_role("admin"))):
    q = {"role": role}
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    skip = (page - 1) * size
    total = await db.profiles.count_documents(q)
    rows = await db.profiles.find(q, {"_id": 0, "password": 0}).skip(skip).limit(size).to_list(size)
    return {"total": total, "users": rows}


# ============================================================
# NOTIFICATIONS
# ============================================================
@api.get("/notifications")
async def list_notif(user=Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"notifications": rows, "unread": unread}


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"ok": True}


# ============================================================
# AI FACE SHAPE ANALYSIS (Gemini Vision)
# ============================================================
@api.get("/hairstyles")
async def list_hairstyles(shape: Optional[str] = None):
    q = {}
    if shape:
        q["suitable_shapes"] = shape
    rows = await db.hairstyles.find(q, {"_id": 0}).to_list(200)
    if shape:
        rows.sort(key=lambda x: x.get("match_score_map", {}).get(shape, 0), reverse=True)
    return {"hairstyles": rows}


@api.post("/ai/face-scan")
async def face_scan(body: AIFaceScanIn, user=Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI service belum dikonfigurasi")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(500, f"AI module tidak tersedia")
    # strip data uri prefix if present
    img_b64 = body.image_base64
    if "," in img_b64 and img_b64.startswith("data:"):
        img_b64 = img_b64.split(",", 1)[1]
    system_msg = (
        "You are a professional stylist analyzing facial geometry from a portrait photo. "
        "Return ONLY a strict JSON object, no markdown, no prose. Keys: "
        "faceShape (one of: oval, round, square, oblong, heart), "
        "confidence (integer 0-100), reasoning (short Bahasa Indonesia sentence explaining detected features)."
    )
    prompt = "Analyze the person's face shape in this photo. Return JSON only."
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"face-{new_id()}",
                       system_message=system_msg).with_model("gemini", "gemini-2.5-flash")
        msg = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=img_b64)])
        result = await asyncio.wait_for(chat.send_message(msg), timeout=25.0)
    except asyncio.TimeoutError:
        raise HTTPException(504, "Analisis wajah timeout, coba lagi")
    except Exception as e:
        log.exception("Gemini face scan failed")
        raise HTTPException(502, "Analisis gagal, coba lagi")
    # parse JSON from result
    import json, re
    text = result if isinstance(result, str) else str(result)
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise HTTPException(502, "Analisis gagal, coba lagi")
    try:
        parsed = json.loads(m.group(0))
    except Exception:
        raise HTTPException(502, "Analisis gagal, coba lagi")
    shape = str(parsed.get("faceShape", "oval")).lower()
    if shape not in ("oval", "round", "square", "oblong", "heart"):
        shape = "oval"
    conf = int(parsed.get("confidence", 75))
    reasoning = parsed.get("reasoning", "")
    # recommendations
    rec_docs = await db.hairstyles.find({"suitable_shapes": shape}, {"_id": 0}).to_list(30)
    rec_docs.sort(key=lambda x: x.get("match_score_map", {}).get(shape, 0), reverse=True)
    top3 = rec_docs[:3]
    # store analysis
    analysis_id = new_id()
    await db.ai_analysis.insert_one({
        "id": analysis_id,
        "user_id": user["id"],
        "face_shape": shape,
        "confidence": conf,
        "reasoning": reasoning,
        "recommended_styles": [t["id"] for t in top3],
        "created_at": now_utc().isoformat(),
    })
    return {
        "id": analysis_id,
        "faceShape": shape,
        "confidence": conf,
        "reasoning": reasoning,
        "recommendations": top3,
    }


@api.get("/ai/history")
async def ai_history(user=Depends(get_current_user)):
    rows = await db.ai_analysis.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"history": rows}


# ============================================================
# SEED DATA
# ============================================================
KUPANG_LAT, KUPANG_LNG = -10.1789, 123.6070

HAIRSTYLES_SEED = [
    ("Pompadour Modern", "oval", {"oval": 98, "square": 80},
     "Volume atas dan sisi pendek — cocok untuk wajah oval yang seimbang.",
     "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600"),
    ("Textured Undercut", "oval", {"oval": 95, "square": 82, "heart": 78},
     "Tekstur atas kontras dengan sisi cukur — mempertegas rahang.",
     "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600"),
    ("Classic Side Part", "oval", {"oval": 90, "square": 75},
     "Belahan samping klasik untuk tampilan rapi profesional.",
     "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600"),
    ("Faux Hawk", "round", {"round": 95, "oblong": 70},
     "Tinggi di tengah menyamarkan wajah bulat.",
     "https://images.unsplash.com/photo-1622286346003-c8b7dbb1c9d5?w=600"),
    ("High Fade + Volume", "round", {"round": 92},
     "Fade tinggi memberi ilusi wajah lebih memanjang.",
     "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600"),
    ("Angular Fringe", "round", {"round": 88, "heart": 80},
     "Poni miring memberi sudut pada wajah bulat.",
     "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600"),
    ("Buzz Cut", "square", {"square": 95, "oval": 78},
     "Pendek tegas menonjolkan rahang persegi.",
     "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=600"),
    ("Crew Cut", "square", {"square": 93, "oval": 80},
     "Klasik militer, low-maintenance, cocok wajah kotak.",
     "https://images.unsplash.com/photo-1521123845560-14093637aa7d?w=600"),
    ("Side Part Rapi", "square", {"square": 90},
     "Belahan samping melunakkan garis rahang kotak.",
     "https://images.unsplash.com/photo-1590086782957-93c06ef21604?w=600"),
    ("Fringe / Bangs", "oblong", {"oblong": 94},
     "Poni memangkas panjang dahi wajah oblong.",
     "https://images.unsplash.com/photo-1512257242790-88ba9bd44e60?w=600"),
    ("Medium Length Textured", "oblong", {"oblong": 90, "oval": 75},
     "Panjang menengah menambah lebar wajah oblong.",
     "https://images.unsplash.com/photo-1596435205846-2e39dcb98acb?w=600"),
    ("Medium Swept Back", "heart", {"heart": 93},
     "Rambut disisir belakang menyeimbangkan dahi lebar.",
     "https://images.unsplash.com/photo-1548536732-c7a5cebe1cdc?w=600"),
    ("Textured Crop", "heart", {"heart": 89, "oval": 82},
     "Crop bertekstur mengurangi tampilan dahi lebar.",
     "https://images.unsplash.com/photo-1614859275178-24a3b4d68000?w=600"),
]

BARBERSHOPS_SEED = [
    ("Kupang Cuts Barber", "Jl. Timor Raya No. 45, Kota Kupang", -10.1650, 123.6100, "Rp 25.000 - Rp 60.000",
     "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800"),
    ("Sasando Barbershop", "Jl. Frans Seda No. 12, Kelapa Lima", -10.1590, 123.6280, "Rp 35.000 - Rp 85.000",
     "https://images.unsplash.com/photo-1521490878406-b3b9066fd932?w=800"),
    ("Barber Bung Karno", "Jl. Soekarno No. 8, Oebufu", -10.1800, 123.6200, "Rp 30.000 - Rp 75.000",
     "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800"),
    ("Fahrenheit Barber Lounge", "Jl. El Tari No. 22, Oebobo", -10.1720, 123.6050, "Rp 50.000 - Rp 120.000",
     "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800"),
]

DEFAULT_SCHEDULES = [
    ("Senin", "09:00", "21:00", False), ("Selasa", "09:00", "21:00", False),
    ("Rabu", "09:00", "21:00", False), ("Kamis", "09:00", "21:00", False),
    ("Jumat", "09:00", "22:00", False), ("Sabtu", "09:00", "22:00", False),
    ("Minggu", "10:00", "20:00", False),
]


async def seed_all():
    # hairstyles
    if await db.hairstyles.count_documents({}) == 0:
        for name, shape, scores, desc, url in HAIRSTYLES_SEED:
            await db.hairstyles.insert_one({
                "id": new_id(), "name": name, "image_url": url, "description": desc,
                "suitable_shapes": list(set([shape] + list(scores.keys()))),
                "match_score_map": scores,
            })
    # users
    async def upsert_user(email, name, phone, role, pw):
        if await db.profiles.find_one({"email": email}):
            return (await db.profiles.find_one({"email": email}))["id"]
        uid = new_id()
        await db.profiles.insert_one({
            "id": uid, "email": email, "password": hash_pw(pw),
            "name": name, "phone": phone, "role": role, "address": "", "photo": "",
            "created_at": now_utc().isoformat()
        })
        return uid

    admin_id = await upsert_user("admin@pangkaskaka.id", "Admin PangkasKAKA", "081234567890", "admin", "Admin123!")
    owner_id = await upsert_user("owner@pangkaskaka.id", "Bapak Yosua", "081234567891", "owner", "Owner123!")
    customer_id = await upsert_user("customer@pangkaskaka.id", "Andi Cust", "081234567892", "customer", "Customer123!")
    karyawan_id = await upsert_user("karyawan@pangkaskaka.id", "Marchel Tuka", "081234567893", "karyawan", "Karyawan123!")

    if not await db.owners.find_one({"id": owner_id}):
        await db.owners.insert_one({"id": owner_id, "name": "Bapak Yosua", "phone": "081234567891",
                                    "email": "owner@pangkaskaka.id", "address": "Kupang"})

    # shops
    for i, (name, addr, lat, lng, pr, img) in enumerate(BARBERSHOPS_SEED):
        if await db.barbershops.find_one({"name": name}):
            continue
        sid = new_id()
        # first shop owned by our seed owner, others by fresh owners (not real accounts)
        oid = owner_id if i == 0 else new_id()
        await db.barbershops.insert_one({
            "id": sid, "owner_id": oid, "name": name, "category": "Barbershop",
            "address": addr, "latitude": lat, "longitude": lng, "image": img,
            "price_range": pr, "rating": 4.5 - i * 0.1, "reviews_count": 25 + i * 8,
            "is_verified": True, "verification_status": "approved",
            "verified_at": now_utc().isoformat(),
            "bank_name": "BNI", "account_number": "1234567890", "account_holder": name,
            "doc_ktp": "", "doc_nib": "", "doc_npwp": "", "doc_surat_usaha": "",
            "created_at": now_utc().isoformat(),
        })
        # schedules
        for dn, ot, ct, cl in DEFAULT_SCHEDULES:
            await db.shop_schedules.insert_one({
                "id": new_id(), "shop_id": sid, "day_name": dn,
                "open_time": ot, "close_time": ct, "is_closed": cl
            })
        # services
        for svc in [("Potong Rambut Klasik", 30, 35000), ("Potong + Cuci", 45, 50000),
                    ("Potong + Cukur + Pijat", 60, 85000), ("Cukur Jenggot", 20, 25000)]:
            await db.services.insert_one({"id": new_id(), "shop_id": sid,
                                          "name": svc[0], "duration": svc[1], "price": svc[2],
                                          "created_at": now_utc().isoformat()})
        # barbers
        for br in [("Kevin", "Senior", "Fade & Undercut", "https://i.pravatar.cc/150?img=12"),
                   ("Alfons", "Standar", "Klasik & Rapi", "https://i.pravatar.cc/150?img=15"),
                   ("Rian", "Junior", "Modern Style", "https://i.pravatar.cc/150?img=33")]:
            await db.barbers.insert_one({
                "id": new_id(), "shop_id": sid, "karyawan_id": None,
                "name": br[0], "skill_level": br[1], "specialization": br[2], "photo": br[3],
                "rating": 4.6, "status": "active",
                "created_at": now_utc().isoformat()
            })
    # Add a pending shop for admin verification demo
    if not await db.barbershops.find_one({"name": "Barber Nusa Tenggara (Pending)"}):
        sid = new_id()
        await db.barbershops.insert_one({
            "id": sid, "owner_id": owner_id, "name": "Barber Nusa Tenggara (Pending)",
            "category": "Barbershop", "address": "Jl. Piet A. Tallo No. 5, Kupang",
            "latitude": -10.1700, "longitude": 123.6180, "image": "https://images.unsplash.com/photo-1521490878406-b3b9066fd932?w=800",
            "price_range": "Rp 25.000 - Rp 60.000", "rating": 0, "reviews_count": 0,
            "is_verified": False, "verification_status": "pending",
            "bank_name": "BRI", "account_number": "9876543210", "account_holder": "Bapak Yosua",
            "doc_ktp": "seeded-ktp.jpg", "doc_nib": "seeded-nib.pdf",
            "doc_npwp": "seeded-npwp.pdf", "doc_surat_usaha": "seeded-surat.pdf",
            "docs_submitted_at": now_utc().isoformat(),
            "created_at": now_utc().isoformat(),
        })
    log.info("Seed complete.")


@api.post("/seed")
async def do_seed():
    await seed_all()
    return {"ok": True}


@api.get("/")
async def root():
    return {"app": "PangkasKAKA", "status": "ok"}


# Register router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_seed():
    try:
        await seed_all()
    except Exception as e:
        log.exception("Seed on startup failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
