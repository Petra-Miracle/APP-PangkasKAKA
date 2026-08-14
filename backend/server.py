"""
PangkasKAKA Backend — FastAPI + MongoDB
On-demand barbershop booking platform for Kupang City, Indonesia
"""
import os
import math
import uuid
import json
import hmac
import hashlib
import base64
import logging
import asyncio
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone, date, time as dtime
from typing import List, Optional, Any, Literal

import bcrypt
import httpx
import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Body, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# Cryptography (Durianpay webhook RSA-2048 verification)
try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding as _crypto_padding
    from cryptography.exceptions import InvalidSignature
    _HAS_CRYPTO = True
except Exception:  # pragma: no cover
    _HAS_CRYPTO = False

# Gemini (AI Face Scan reasoning text — text-only, official Google GenAI SDK)
try:
    from google import genai as _genai
except Exception:  # pragma: no cover
    _genai = None

# Resend (transactional email — forgot-password OTP)
try:
    import resend as _resend
except Exception:  # pragma: no cover
    _resend = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", 168))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
_gemini_client = _genai.Client(api_key=GEMINI_API_KEY) if (_genai and GEMINI_API_KEY) else None

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "PangkasKAKA <onboarding@resend.dev>")
if _resend and RESEND_API_KEY:
    _resend.api_key = RESEND_API_KEY

# "development" (default) | "production" — gerbang untuk fitur yang tidak boleh
# aktif di production (auto-seed demo data, dsb).
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").lower()

# Comma-separated origin list untuk CORS, mis. "https://app.pangkaskaka.id,https://admin.pangkaskaka.id"
# Default "*" (semua origin) — cukup aman untuk mobile-only (native app tidak kirim header Origin),
# tapi WAJIB diisi eksplisit begitu ada web client yang butuh cookie/credential.
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

# ---------- Durianpay Configuration ----------
# PAYMENT_MODE:
#   - "simulation"  → gunakan endpoint /simulate/{booking_id} (mock lokal, TIDAK panggil Durianpay)
#   - "sandbox"     → panggil Durianpay sandbox API (dp_test_ key)
#   - "production"  → panggil Durianpay production API (dp_live_ key) → GANTI SAAT GO-LIVE
PAYMENT_MODE = os.environ.get("PAYMENT_MODE", "simulation").lower()
DURIANPAY_API_KEY = os.environ.get("DURIANPAY_API_KEY", "")
DURIANPAY_API_BASE = os.environ.get("DURIANPAY_API_BASE", "https://api.durianpay.id/v1")
DURIANPAY_PAYMENT_LINK_BASE = os.environ.get("DURIANPAY_PAYMENT_LINK_BASE", "https://links.durianpay.id/payment")
# Public key PEM dari Durianpay Dashboard → Settings → Webhook (RSA-2048)
DURIANPAY_PUBLIC_KEY_PEM = os.environ.get("DURIANPAY_PUBLIC_KEY_PEM", "").replace("\\n", "\n")
# Opsional: HMAC secret untuk verifikasi tambahan (legacy webhook / signature payment fallback)
DURIANPAY_WEBHOOK_SECRET = os.environ.get("DURIANPAY_WEBHOOK_SECRET", "")

if ENVIRONMENT == "production" and PAYMENT_MODE == "simulation":
    raise RuntimeError(
        "PAYMENT_MODE=simulation tidak boleh dipakai saat ENVIRONMENT=production "
        "(pembayaran akan dianggap sukses tanpa transaksi asli). "
        "Set PAYMENT_MODE=sandbox atau production di environment variables."
    )

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


# ---------- Rate limiting (in-memory, per-instance) ----------
# Cukup untuk 1 instance backend. Kalau nanti scale ke multi-instance,
# ganti ke penyimpanan bersama (mis. Redis) supaya limit konsisten antar instance.
_rate_buckets: dict[str, list] = {}


def rate_limit(key: str, max_requests: int, window_seconds: int):
    now = asyncio.get_event_loop().time()
    bucket = _rate_buckets.setdefault(key, [])
    while bucket and bucket[0] <= now - window_seconds:
        bucket.pop(0)
    if len(bucket) >= max_requests:
        raise HTTPException(429, "Terlalu banyak percobaan, coba lagi beberapa saat lagi")
    bucket.append(now)


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


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str


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
    doc_toko: Optional[str] = None


class DocReviewIn(BaseModel):
    status: Literal["valid", "invalid", "needs_revision"]
    note: Optional[str] = None


class DocReplaceIn(BaseModel):
    doc_key: Literal["ktp", "nib", "npwp", "surat_usaha", "toko"]
    file_base64: str


class ChatSendIn(BaseModel):
    text: Optional[str] = None
    attachment: Optional[str] = None  # base64 image/pdf
    doc_ref: Optional[str] = None  # e.g. "ktp", "nib"


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


class ShopOpenStatusIn(BaseModel):
    is_open: bool


class ScheduleOverrideIn(BaseModel):
    date: str  # YYYY-MM-DD
    is_closed: bool = False
    open_time: str = "09:00"
    close_time: str = "21:00"
    note: Optional[str] = None


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
    # WAJIB: KTP + Ijazah + Pengalaman kerja
    ktp_photo: str  # base64 atau URL
    diploma_photo: str  # ijazah, base64 atau URL
    work_experience: str  # deskripsi teks pengalaman
    # OPSIONAL tapi dianjurkan: portofolio (foto hasil cukur)
    portfolio_url: Optional[str] = None
    tools_photo: Optional[str] = None
    bnsp_cert: Optional[str] = None
    certificates: Optional[str] = None
    # WAJIB: konfirmasi memenuhi kriteria
    criteria_agreed: bool = False


class EvaluateKaryawanIn(BaseModel):
    portfolio_weight: int  # 0-20
    experience_weight: int
    tools_weight: int
    bnsp_weight: int
    cert_weight: int
    diploma_weight: int


class AIFaceScanIn(BaseModel):
    face_shape: str
    confidence: int
    measurements: Optional[dict] = None


class KaryawanLocationIn(BaseModel):
    lat: float
    lng: float
    is_online: bool


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


async def send_email(to: str, subject: str, html: str) -> bool:
    """Kirim email transaksional via Resend. No-op (log only) kalau RESEND_API_KEY belum diset."""
    if not (_resend and RESEND_API_KEY):
        log.warning("RESEND_API_KEY belum diset, email ke %s tidak dikirim (subject: %s)", to, subject)
        return False
    try:
        await asyncio.to_thread(
            _resend.Emails.send,
            {"from": RESEND_FROM_EMAIL, "to": [to], "subject": subject, "html": html},
        )
        return True
    except Exception:
        log.exception("Gagal mengirim email via Resend ke %s", to)
        return False


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
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0, "is_open": 1})
    if shop and shop.get("is_open") is False:
        return []
    override = await db.shop_schedule_overrides.find_one({"shop_id": shop_id, "date": date_str}, {"_id": 0})
    if override:
        if override.get("is_closed"):
            return []
        open_time, close_time = override["open_time"], override["close_time"]
    else:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        wd = d.weekday()  # Mon=0..Sun=6
        day_name = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][wd]
        sched = await db.shop_schedules.find_one({"shop_id": shop_id, "day_name": day_name}, {"_id": 0})
        if not sched or sched.get("is_closed"):
            return []
        open_time, close_time = sched["open_time"], sched["close_time"]
    all_slots = gen_time_slots(open_time, close_time, 30)
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
async def register(body: RegisterIn, request: Request):
    rate_limit(f"register:{request.client.host}", max_requests=10, window_seconds=3600)
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
async def login(body: LoginIn, request: Request):
    rate_limit(f"login:{request.client.host}", max_requests=5, window_seconds=300)
    user = await db.profiles.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Email atau password salah")
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": clean(dict(user))}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordIn, request: Request):
    rate_limit(f"forgot_password:{request.client.host}", max_requests=5, window_seconds=900)
    generic_msg = {"ok": True, "message": "Jika email terdaftar, kode reset telah dikirim."}
    email = body.email.lower()
    user = await db.profiles.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1})
    if not user:
        return generic_msg
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.password_resets.insert_one({
        "id": new_id(), "email": email, "code": code, "used": False,
        "expires_at": (now_utc() + timedelta(minutes=15)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    await send_email(
        email, "Kode Reset Password PangkasKAKA",
        f"<p>Halo {user.get('name', '')},</p>"
        f"<p>Kode reset password kamu: <strong style='font-size:20px'>{code}</strong></p>"
        f"<p>Kode berlaku 15 menit. Abaikan email ini jika kamu tidak meminta reset password.</p>",
    )
    return generic_msg


@api.post("/auth/reset-password")
async def reset_password(body: ResetPasswordIn, request: Request):
    rate_limit(f"reset_password:{request.client.host}", max_requests=10, window_seconds=900)
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password minimal 8 karakter")
    email = body.email.lower()
    reset = await db.password_resets.find_one(
        {"email": email, "code": body.code, "used": False}, {"_id": 0}
    )
    if not reset or datetime.fromisoformat(reset["expires_at"]) < now_utc():
        raise HTTPException(400, "Kode tidak valid atau sudah kadaluarsa")
    user = await db.profiles.find_one({"email": email}, {"_id": 0, "id": 1})
    if not user:
        raise HTTPException(400, "Kode tidak valid atau sudah kadaluarsa")
    await db.profiles.update_one({"id": user["id"]}, {"$set": {"password": hash_pw(body.new_password)}})
    await db.password_resets.update_one({"id": reset["id"]}, {"$set": {"used": True}})
    return {"ok": True}


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


@api.get("/barbers/nearby")
async def nearby_barbers(lat: float, lng: float):
    fresh_cutoff = (now_utc() - timedelta(minutes=2)).isoformat()
    locations = await db.karyawan_locations.find(
        {"is_online": True, "updated_at": {"$gte": fresh_cutoff}}, {"_id": 0}
    ).to_list(500)
    if not locations:
        return {"barbers": []}
    loc_by_karyawan = {l["karyawan_id"]: l for l in locations}
    barbers = await db.barbers.find(
        {"karyawan_id": {"$in": list(loc_by_karyawan.keys())}, "status": "active"}, {"_id": 0}
    ).to_list(500)
    result = []
    for b in barbers:
        loc = loc_by_karyawan.get(b["karyawan_id"])
        if not loc:
            continue
        shop = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1, "address": 1})
        result.append({
            **b,
            "lat": loc["lat"], "lng": loc["lng"], "updated_at": loc["updated_at"],
            "distance_km": haversine_km(lat, lng, loc["lat"], loc["lng"]),
            "shop_name": shop["name"] if shop else "",
            "shop_address": shop["address"] if shop else "",
        })
    result.sort(key=lambda x: x["distance_km"])
    return {"barbers": result}


@api.get("/shops/{shop_id}")
async def shop_detail(shop_id: str):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Barbershop tidak ditemukan")
    services = await db.services.find({"shop_id": shop_id}, {"_id": 0}).to_list(100)
    barbers = await db.barbers.find({"shop_id": shop_id, "status": "active"}, {"_id": 0}).to_list(100)
    schedules = await db.shop_schedules.find({"shop_id": shop_id}, {"_id": 0}).to_list(20)
    today_str = datetime.now(WITA).date().isoformat()
    overrides = await db.shop_schedule_overrides.find(
        {"shop_id": shop_id, "date": {"$gte": today_str}}, {"_id": 0}
    ).sort("date", 1).to_list(60)
    reviews = await db.reviews.find({"shop_id": shop_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # enrich reviews with reviewer names
    for r in reviews:
        u = await db.profiles.find_one({"id": r["user_id"]}, {"_id": 0, "name": 1, "photo": 1})
        r["reviewer"] = u
    shop["services"] = services
    shop["barbers"] = barbers
    shop["schedules"] = schedules
    shop["schedule_overrides"] = overrides
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


@api.get("/bookings/{bid}/karyawan-location")
async def get_booking_karyawan_location(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Lokasi barber hanya tersedia saat pesanan sedang berjalan")
    barber = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0, "karyawan_id": 1})
    if not barber or not barber.get("karyawan_id"):
        raise HTTPException(404, "Barber ini belum membagikan lokasi")
    loc = await db.karyawan_locations.find_one({"karyawan_id": barber["karyawan_id"]}, {"_id": 0})
    if not loc or not loc.get("is_online"):
        raise HTTPException(404, "Barber sedang tidak membagikan lokasi")
    updated_at = datetime.fromisoformat(loc["updated_at"])
    if updated_at < now_utc() - timedelta(minutes=2):
        raise HTTPException(404, "Lokasi barber sudah tidak diperbarui")
    result = {"lat": loc["lat"], "lng": loc["lng"], "updated_at": loc["updated_at"]}
    if b.get("customer_lat") is not None and b.get("customer_lng") is not None:
        result["distance_km"] = haversine_km(b["customer_lat"], b["customer_lng"], loc["lat"], loc["lng"])
    return result


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
    # Build per-doc status sub-doc
    def _doc(url):
        return {"url": url or "", "status": "pending" if url else "missing", "note": "", "reviewed_at": None, "reviewed_by": None}
    docs = {
        "ktp": _doc(body.doc_ktp),
        "nib": _doc(body.doc_nib),
        "npwp": _doc(body.doc_npwp),
        "surat_usaha": _doc(body.doc_surat_usaha),
        "toko": _doc(body.doc_toko),
    }
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
        "is_open": existing.get("is_open", True) if existing else True,
        # legacy flat fields kept for backwards compat
        "doc_ktp": body.doc_ktp or "",
        "doc_nib": body.doc_nib or "",
        "doc_npwp": body.doc_npwp or "",
        "doc_surat_usaha": body.doc_surat_usaha or "",
        "doc_toko": body.doc_toko or "",
        # new per-doc validation
        "docs": docs,
        "revision_count": 0,
        "last_reviewed_by": None,
        "last_reviewed_at": None,
        "chat_closed": False,
        "docs_submitted_at": now_utc().isoformat(),
        "created_at": existing["created_at"] if existing else now_utc().isoformat(),
    }
    await db.barbershops.replace_one({"id": sid}, doc, upsert=True)
    admins = await db.profiles.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Pengajuan Toko Baru", f"{body.name} menunggu verifikasi.", "system")
    return {"shop": clean(doc)}


@api.put("/owner/shop/documents")
async def replace_document(body: DocReplaceIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    # size check: base64 length ~1.33x binary; 2MB = ~2.66M chars
    if body.file_base64 and len(body.file_base64) > 2_800_000:
        raise HTTPException(400, "Ukuran file melebihi 2MB")
    key = body.doc_key
    update_path = f"docs.{key}"
    docs = shop.get("docs", {})
    docs[key] = {"url": body.file_base64, "status": "pending", "note": "", "reviewed_at": None, "reviewed_by": None}
    revision_count = shop.get("revision_count", 0) + 1
    # if shop was rejected, move back to pending
    new_verification_status = "pending" if shop.get("verification_status") == "rejected" else shop.get("verification_status", "pending")
    await db.barbershops.update_one(
        {"id": shop["id"]},
        {"$set": {
            f"doc_{key}": body.file_base64,
            "docs": docs,
            "revision_count": revision_count,
            "verification_status": new_verification_status,
            "is_verified": False if new_verification_status != "approved" else shop.get("is_verified", False),
        }},
    )
    # notify admins
    admins = await db.profiles.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Revisi dokumen", f"{shop['name']} mengunggah ulang dokumen {key.upper()}.", "system")
    return {"ok": True, "revision_count": revision_count}


@api.post("/admin/shops/{shop_id}/documents/{doc_key}/review")
async def admin_review_doc(shop_id: str, doc_key: str, body: DocReviewIn, user=Depends(require_role("admin"))):
    if doc_key not in ("ktp", "nib", "npwp", "surat_usaha", "toko"):
        raise HTTPException(400, "Doc key tidak valid")
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    if body.status in ("invalid", "needs_revision") and not (body.note and body.note.strip()):
        raise HTTPException(400, "Catatan wajib diisi untuk status ini")
    docs = shop.get("docs", {})
    if doc_key not in docs:
        docs[doc_key] = {"url": "", "status": "pending", "note": "", "reviewed_at": None, "reviewed_by": None}
    docs[doc_key] = {
        **docs[doc_key],
        "status": body.status,
        "note": body.note or "",
        "reviewed_at": now_utc().isoformat(),
        "reviewed_by": user["id"],
    }
    # Auto-approve if all 5 required docs are valid
    required = ["ktp", "nib", "npwp", "surat_usaha", "toko"]
    all_valid = all(docs.get(k, {}).get("status") == "valid" for k in required)
    updates: dict = {
        "docs": docs,
        "last_reviewed_by": user["id"],
        "last_reviewed_at": now_utc().isoformat(),
    }
    if all_valid:
        updates.update({"is_verified": True, "verification_status": "approved", "verified_at": now_utc().isoformat(), "verification_note": ""})
        await send_notif(shop["owner_id"], "Toko disetujui!", "Semua dokumen valid. Toko Anda kini aktif.", "system")
    else:
        # keep verification_status pending; if any invalid, set rejected soft flag
        if any(docs.get(k, {}).get("status") == "invalid" for k in required):
            updates["verification_status"] = "rejected"
            updates["is_verified"] = False
        else:
            updates["verification_status"] = "pending"
        # Send per-doc notification
        label_map = {"ktp": "KTP", "nib": "NIB", "npwp": "NPWP", "surat_usaha": "Surat Izin Usaha", "toko": "Foto Toko"}
        if body.status == "invalid":
            await send_notif(shop["owner_id"], f"Dokumen {label_map[doc_key]} ditolak", body.note or "Silakan hubungi admin.", "system")
        elif body.status == "needs_revision":
            await send_notif(shop["owner_id"], f"Perlu revisi: {label_map[doc_key]}", body.note or "Silakan unggah ulang.", "system")
        elif body.status == "valid":
            await send_notif(shop["owner_id"], f"Dokumen {label_map[doc_key]} valid ✓", "Menunggu dokumen lainnya diverifikasi.", "system")
    await db.barbershops.update_one({"id": shop_id}, {"$set": updates})
    return {"ok": True, "docs": docs, "all_valid": all_valid}


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
        u = await db.profiles.find_one(
            {"id": o["user_id"]},
            {"_id": 0, "name": 1, "phone": 1, "email": 1, "photo": 1, "address": 1}
        )
        s = await db.services.find_one({"id": o["service_id"]}, {"_id": 0, "name": 1, "duration": 1})
        br = await db.barbers.find_one({"id": o["barber_id"]}, {"_id": 0, "name": 1, "photo": 1})
        o["customer"] = u
        o["service_name"] = s["name"] if s else ""
        o["service_duration"] = s.get("duration") if s else 0
        o["barber_name"] = br["name"] if br else ""
        o["barber_photo"] = (br or {}).get("photo", "")
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


@api.get("/owner/schedules")
async def get_own_schedules(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    schedules = await db.shop_schedules.find({"shop_id": shop["id"]}, {"_id": 0}).to_list(20)
    return {"schedules": schedules}


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


@api.put("/owner/shop/open-status")
async def set_shop_open_status(body: ShopOpenStatusIn, user=Depends(require_role("owner"))):
    """Manual real-time open/closed toggle — independent of the weekly schedule.
    A shop marked closed here is treated as closed regardless of what the
    weekly schedule or a date override says (checked first in
    compute_available_slots)."""
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    await db.barbershops.update_one({"id": shop["id"]}, {"$set": {"is_open": body.is_open}})
    return {"ok": True, "is_open": body.is_open}


@api.get("/owner/schedule-overrides")
async def list_schedule_overrides(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    overrides = await db.shop_schedule_overrides.find({"shop_id": shop["id"]}, {"_id": 0}).sort("date", 1).to_list(200)
    return {"overrides": overrides}


@api.post("/owner/schedule-overrides")
async def upsert_schedule_override(body: ScheduleOverrideIn, user=Depends(require_role("owner"))):
    """Upsert a date-specific exception (holiday closure, special hours) that
    overrides the recurring weekly schedule for that one date only."""
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    try:
        datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Format tanggal harus YYYY-MM-DD")
    await db.shop_schedule_overrides.update_one(
        {"shop_id": shop["id"], "date": body.date},
        {"$set": {
            "shop_id": shop["id"], "date": body.date, "is_closed": body.is_closed,
            "open_time": body.open_time, "close_time": body.close_time, "note": body.note or "",
        }},
        upsert=True,
    )
    return {"ok": True}


@api.delete("/owner/schedule-overrides/{date}")
async def delete_schedule_override(date: str, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    await db.shop_schedule_overrides.delete_one({"shop_id": shop["id"], "date": date})
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
    # Wajib sudah tahap menunggu_tes (setelah lolos berkas + koordinasi tes)
    if k["status"] not in ("menunggu_tes", "seleksi_berkas_lolos"):
        raise HTTPException(400, f"Pelamar harus lolos seleksi berkas dulu (status saat ini: {k['status']})")
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
        await send_notif(k["profile_id"], "Selamat! Anda diterima sebagai barber",
                         f"Skor tes: {total}/120. Level: {skill}. Profil barber Anda sudah aktif.", "system")
    else:
        await send_notif(k["profile_id"], "Lamaran ditolak setelah tes",
                         f"Skor tes: {total}/120 (di bawah nilai minimum 60).", "system")
    return {"ok": True, "total_score": total, "status": status}


# ============================================================
# KARYAWAN
# ============================================================
@api.post("/karyawan/apply")
async def karyawan_apply(body: KaryawanApplyIn, user=Depends(require_role("karyawan"))):
    # Validasi berkas WAJIB
    if not body.ktp_photo or len(body.ktp_photo) < 20:
        raise HTTPException(400, "Foto KTP wajib diunggah")
    if not body.diploma_photo or len(body.diploma_photo) < 20:
        raise HTTPException(400, "Foto/scan ijazah wajib diunggah")
    if not body.work_experience or len(body.work_experience.strip()) < 20:
        raise HTTPException(400, "Pengalaman kerja wajib diisi minimal 20 karakter")
    if not body.criteria_agreed:
        raise HTTPException(400, "Anda harus menyetujui kriteria platform")

    existing = await db.karyawan.find_one({"profile_id": user["id"], "shop_id": body.shop_id})
    if existing:
        raise HTTPException(400, "Anda sudah melamar ke toko ini")

    # Update juga profil karyawan dengan KTP (untuk akses admin)
    await db.profiles.update_one({"id": user["id"]}, {"$set": {"ktp_photo": body.ktp_photo}})

    doc = {
        "id": new_id(),
        "profile_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "shop_id": body.shop_id,
        # WAJIB
        "ktp_photo": body.ktp_photo,
        "diploma_photo": body.diploma_photo,
        "work_experience": body.work_experience,
        "criteria_agreed": True,
        # Opsional
        "portfolio_url": body.portfolio_url or "",
        "tools_photo": body.tools_photo or "",
        "bnsp_cert": body.bnsp_cert or "",
        "certificates": body.certificates or "",
        "total_score": 0, "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.karyawan.insert_one(doc)
    shop = await db.barbershops.find_one({"id": body.shop_id}, {"_id": 0, "owner_id": 1, "name": 1})
    if shop:
        await send_notif(shop["owner_id"], "Lamaran baru masuk",
                         f"{user['name']} melamar sebagai barber di toko Anda.", "system")
    return {"application": clean(doc)}


@api.get("/karyawan/my")
async def karyawan_my(user=Depends(require_role("karyawan"))):
    rows = await db.karyawan.find({"profile_id": user["id"]}, {"_id": 0}).to_list(50)
    for r in rows:
        s = await db.barbershops.find_one({"id": r["shop_id"]}, {"_id": 0, "name": 1, "image": 1})
        r["shop"] = s
    return {"applications": rows}


@api.post("/karyawan/location")
async def update_karyawan_location(body: KaryawanLocationIn, user=Depends(require_role("karyawan"))):
    rate_limit(f"karyawan_location:{user['id']}", max_requests=20, window_seconds=60)
    active = await db.karyawan.find_one({"profile_id": user["id"], "status": "active"}, {"_id": 0, "id": 1})
    if not active:
        raise HTTPException(400, "Anda belum menjadi barber aktif di toko manapun")
    await db.karyawan_locations.update_one(
        {"karyawan_id": active["id"]},
        {"$set": {"karyawan_id": active["id"], "lat": body.lat, "lng": body.lng,
                  "is_online": body.is_online, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api.get("/karyawan/bookings")
async def karyawan_bookings(user=Depends(require_role("karyawan"))):
    apps = await db.karyawan.find({"profile_id": user["id"], "status": "active"}, {"_id": 0, "id": 1}).to_list(20)
    if not apps:
        return {"bookings": []}
    barbers = await db.barbers.find({"karyawan_id": {"$in": [a["id"] for a in apps]}}, {"_id": 0, "id": 1}).to_list(20)
    barber_ids = [b["id"] for b in barbers]
    if not barber_ids:
        return {"bookings": []}
    bookings = await db.bookings.find(
        {"barber_id": {"$in": barber_ids}, "status": {"$in": ["pending", "confirmed"]}}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    for b in bookings:
        b["shop"] = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1})
        b["service"] = await db.services.find_one({"id": b["service_id"]}, {"_id": 0, "name": 1})
        b["customer"] = await db.profiles.find_one({"id": b["user_id"]}, {"_id": 0, "name": 1, "phone": 1})
    return {"bookings": bookings}


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


# Face shape itself is computed on-device (see frontend/src/lib/faceShape.ts) from
# live camera landmarks — nothing here ever touches an image. Fallback sentences
# used when GEMINI_API_KEY isn't set or the call fails, so a result is never blocked.
FACE_SHAPE_FALLBACK_REASONING = {
    "oval": "Wajah oval punya proporsi seimbang antara dahi, tulang pipi, dan rahang — cocok untuk hampir semua model rambut.",
    "round": "Wajah bulat punya lebar dan panjang yang mirip dengan garis rahang lembut — model rambut dengan volume di atas bisa menambah kesan memanjang.",
    "square": "Wajah kotak punya garis rahang tegas dengan lebar dahi dan rahang yang serupa — potongan rambut bertekstur bisa melunakkan sudutnya.",
    "oblong": "Wajah oblong lebih panjang dari lebarnya — model rambut dengan volume di samping bisa menyeimbangkan proporsi wajah.",
    "heart": "Wajah hati punya dahi lebih lebar dari rahang yang meruncing ke dagu — poni atau model berlapis bisa menonjolkan bentuk ini.",
}


@api.post("/ai/face-scan")
async def face_scan(body: AIFaceScanIn, user=Depends(get_current_user)):
    shape = body.face_shape.lower()
    if shape not in ("oval", "round", "square", "oblong", "heart"):
        raise HTTPException(400, "Bentuk wajah tidak valid")
    conf = max(0, min(100, body.confidence))

    reasoning = ""
    if _gemini_client:
        prompt = (
            f"Bentuk wajah seseorang terdeteksi sebagai '{shape}' (tingkat keyakinan {conf}%) "
            "berdasarkan pengukuran geometris real-time di perangkat (lebar dahi, tulang pipi, rahang, "
            "dan panjang wajah). Tulis 1 kalimat pendek dalam Bahasa Indonesia, gaya seorang stylist "
            f"profesional yang ramah, menjelaskan ciri khas bentuk wajah '{shape}'. Tanpa markdown, tanpa tanda kutip."
        )
        try:
            resp = await asyncio.wait_for(
                _gemini_client.aio.models.generate_content(model="gemini-flash-latest", contents=prompt),
                timeout=10.0,
            )
            reasoning = (getattr(resp, "text", "") or "").strip()
        except Exception:
            log.exception("Gemini reasoning call failed, falling back to template")
    if not reasoning:
        reasoning = FACE_SHAPE_FALLBACK_REASONING.get(shape, "")

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
    # Add pending shops with per-doc statuses for admin demo
    demo_docs_mixed = {
        "ktp": {"url": "seeded-ktp.jpg", "status": "valid", "note": "", "reviewed_at": now_utc().isoformat(), "reviewed_by": admin_id},
        "nib": {"url": "seeded-nib.pdf", "status": "valid", "note": "", "reviewed_at": now_utc().isoformat(), "reviewed_by": admin_id},
        "npwp": {"url": "seeded-npwp.pdf", "status": "needs_revision", "note": "Foto NPWP buram, mohon unggah ulang yang lebih jelas", "reviewed_at": now_utc().isoformat(), "reviewed_by": admin_id},
        "surat_usaha": {"url": "seeded-surat.pdf", "status": "pending", "note": "", "reviewed_at": None, "reviewed_by": None},
        "toko": {"url": "seeded-toko.jpg", "status": "pending", "note": "", "reviewed_at": None, "reviewed_by": None},
    }
    demo_docs_fresh = {k: {"url": f"seeded-{k}.jpg", "status": "pending", "note": "", "reviewed_at": None, "reviewed_by": None} for k in ["ktp", "nib", "npwp", "surat_usaha", "toko"]}

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
            "doc_toko": "seeded-toko.jpg",
            "docs": demo_docs_mixed,
            "revision_count": 1,
            "chat_closed": False,
            "docs_submitted_at": now_utc().isoformat(),
            "created_at": now_utc().isoformat(),
        })
        # Seed chat messages for demo
        msgs_seed = [
            (admin_id, "admin", "Halo, saya sudah cek dokumen Anda. Foto NPWP terlihat sedikit buram.", "npwp"),
            (owner_id, "owner", "Terima kasih infonya. Saya akan foto ulang dan upload segera.", "npwp"),
            (admin_id, "admin", "Baik, ditunggu. Sementara dokumen KTP dan NIB sudah saya validasi ✓", ""),
            (owner_id, "owner", "Siap admin, mohon dibantu prosesnya.", ""),
        ]
        base_time = now_utc()
        for i, (uid, role, text, ref) in enumerate(msgs_seed):
            await db.chat_messages.insert_one({
                "id": new_id(), "shop_id": sid, "sender_id": uid, "sender_role": role,
                "text": text, "attachment": "", "doc_ref": ref,
                "is_read": True, "created_at": (base_time + timedelta(minutes=i * 5)).isoformat(),
            })

    if not await db.barbershops.find_one({"name": "Barbershop Timor (Fresh)"}):
        sid = new_id()
        await db.barbershops.insert_one({
            "id": sid, "owner_id": owner_id, "name": "Barbershop Timor (Fresh)",
            "category": "Barbershop", "address": "Jl. Herewila No. 22, Kupang",
            "latitude": -10.1750, "longitude": 123.6150, "image": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800",
            "price_range": "Rp 30.000 - Rp 80.000", "rating": 0, "reviews_count": 0,
            "is_verified": False, "verification_status": "pending",
            "bank_name": "Mandiri", "account_number": "1122334455", "account_holder": "Bapak Yosua",
            "doc_ktp": "seeded-ktp.jpg", "doc_nib": "seeded-nib.pdf",
            "doc_npwp": "seeded-npwp.pdf", "doc_surat_usaha": "seeded-surat.pdf",
            "doc_toko": "seeded-toko.jpg",
            "docs": demo_docs_fresh,
            "revision_count": 0,
            "chat_closed": False,
            "docs_submitted_at": now_utc().isoformat(),
            "created_at": now_utc().isoformat(),
        })
    log.info("Seed complete.")


@api.post("/seed")
async def do_seed(user=Depends(require_role("admin"))):
    if ENVIRONMENT == "production":
        raise HTTPException(403, "Seeding dinonaktifkan di production")
    await seed_all()
    return {"ok": True}


# ============================================================
# CHAT (Owner ↔ Admin, per-shop thread)
# ============================================================
async def _shop_access(shop_id: str, user: dict):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    if user["role"] == "admin":
        return shop
    if user["role"] == "owner" and shop["owner_id"] == user["id"]:
        return shop
    raise HTTPException(403, "Akses ditolak")


@api.get("/chat/threads")
async def list_threads(user=Depends(get_current_user)):
    if user["role"] == "admin":
        shops = await db.barbershops.find({}, {"_id": 0}).to_list(500)
    elif user["role"] == "owner":
        shops = await db.barbershops.find({"owner_id": user["id"]}, {"_id": 0}).to_list(50)
    else:
        raise HTTPException(403, "Hanya owner & admin")
    result = []
    for s in shops:
        unread = await db.chat_messages.count_documents({"shop_id": s["id"], "sender_id": {"$ne": user["id"]}, "is_read": False})
        last = await db.chat_messages.find({"shop_id": s["id"]}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        result.append({
            "shop_id": s["id"], "shop_name": s["name"], "shop_image": s.get("image", ""),
            "owner_id": s["owner_id"], "verification_status": s.get("verification_status"),
            "closed": s.get("chat_closed", False),
            "unread": unread,
            "last_message": last[0] if last else None,
        })
    result.sort(key=lambda x: (x["last_message"] or {}).get("created_at", ""), reverse=True)
    return {"threads": result}


@api.get("/chat/threads/{shop_id}")
async def get_thread(shop_id: str, user=Depends(get_current_user)):
    shop = await _shop_access(shop_id, user)
    msgs = await db.chat_messages.find({"shop_id": shop_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # enrich sender name
    for m in msgs:
        p = await db.profiles.find_one({"id": m["sender_id"]}, {"_id": 0, "name": 1, "role": 1})
        m["sender_name"] = p["name"] if p else "?"
    return {"shop": {"id": shop["id"], "name": shop["name"], "image": shop.get("image", ""), "closed": shop.get("chat_closed", False)}, "messages": msgs}


@api.post("/chat/threads/{shop_id}/messages")
async def send_msg(shop_id: str, body: ChatSendIn, user=Depends(get_current_user)):
    shop = await _shop_access(shop_id, user)
    if shop.get("chat_closed"):
        raise HTTPException(400, "Percakapan telah ditutup")
    if not body.text and not body.attachment:
        raise HTTPException(400, "Pesan atau lampiran wajib diisi")
    if body.attachment and len(body.attachment) > 2_800_000:
        raise HTTPException(400, "Lampiran melebihi 2MB")
    msg = {
        "id": new_id(),
        "shop_id": shop_id,
        "sender_id": user["id"],
        "sender_role": user["role"],
        "text": body.text or "",
        "attachment": body.attachment or "",
        "doc_ref": body.doc_ref or "",
        "is_read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.chat_messages.insert_one(msg)
    # notify other side
    if user["role"] == "owner":
        admins = await db.profiles.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
        for a in admins:
            await send_notif(a["id"], "Pesan baru dari owner", f"{shop['name']}: {body.text or '📎 Lampiran'}", "system")
    else:
        await send_notif(shop["owner_id"], "Pesan baru dari admin", body.text or "📎 Lampiran", "system")
    m = dict(msg); m.pop("_id", None); m["sender_name"] = user["name"]
    return {"message": m}


@api.post("/chat/threads/{shop_id}/read")
async def mark_thread_read(shop_id: str, user=Depends(get_current_user)):
    await _shop_access(shop_id, user)
    await db.chat_messages.update_many({"shop_id": shop_id, "sender_id": {"$ne": user["id"]}}, {"$set": {"is_read": True}})
    return {"ok": True}


@api.post("/chat/threads/{shop_id}/close")
async def close_thread(shop_id: str, user=Depends(require_role("admin"))):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    await db.barbershops.update_one({"id": shop_id}, {"$set": {"chat_closed": True}})
    await send_notif(shop["owner_id"], "Percakapan ditutup", "Admin telah menutup percakapan verifikasi.", "system")
    return {"ok": True}


# ============================================================
# CHAT (Customer ↔ Karyawan, per-booking thread — owner can monitor)
# ============================================================
class ServiceChatSendIn(BaseModel):
    text: Optional[str] = None
    attachment: Optional[str] = None


async def _resolve_barber_profile_id(barber_id: str) -> Optional[str]:
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0, "karyawan_id": 1})
    if not barber or not barber.get("karyawan_id"):
        return None
    k = await db.karyawan.find_one({"id": barber["karyawan_id"]}, {"_id": 0, "profile_id": 1})
    return k["profile_id"] if k else None


async def _booking_chat_access(booking: dict, user: dict) -> str:
    """Returns the caller's role in the customer<->barber thread ('customer'/'karyawan').
    Owner has their own separate thread (see _owner_chat_access) so they're not
    included here — keeps the two conversations from bleeding into each other."""
    if user["role"] == "customer" and booking["user_id"] == user["id"]:
        return "customer"
    if user["role"] == "karyawan":
        barber_profile_id = await _resolve_barber_profile_id(booking["barber_id"])
        if barber_profile_id and barber_profile_id == user["id"]:
            return "karyawan"
    raise HTTPException(403, "Akses ditolak")


async def _owner_chat_access(booking: dict, user: dict) -> str:
    """Returns the caller's role in the customer<->owner thread ('customer'/'owner'). Raises 403 otherwise."""
    if user["role"] == "customer" and booking["user_id"] == user["id"]:
        return "customer"
    if user["role"] == "owner":
        shop = await db.barbershops.find_one({"id": booking["shop_id"]}, {"_id": 0, "owner_id": 1})
        if shop and shop["owner_id"] == user["id"]:
            return "owner"
    raise HTTPException(403, "Akses ditolak")


@api.get("/bookings/{bid}/messages")
async def get_booking_messages(bid: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    await _booking_chat_access(booking, user)
    msgs = await db.service_messages.find({"booking_id": bid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for m in msgs:
        p = await db.profiles.find_one({"id": m["sender_id"]}, {"_id": 0, "name": 1, "role": 1})
        m["sender_name"] = p["name"] if p else "?"
    barber = await db.barbers.find_one({"id": booking["barber_id"]}, {"_id": 0, "name": 1, "photo": 1})
    return {"booking_id": bid, "barber": barber, "messages": msgs}


@api.post("/bookings/{bid}/messages")
async def send_booking_message(bid: str, body: ServiceChatSendIn, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    role_in_thread = await _booking_chat_access(booking, user)
    if not body.text and not body.attachment:
        raise HTTPException(400, "Pesan atau lampiran wajib diisi")
    if body.attachment and len(body.attachment) > 2_800_000:
        raise HTTPException(400, "Lampiran melebihi 2MB")
    msg = {
        "id": new_id(), "booking_id": bid, "sender_id": user["id"], "sender_role": user["role"],
        "text": body.text or "", "attachment": body.attachment or "",
        "is_read": False, "created_at": now_utc().isoformat(),
    }
    await db.service_messages.insert_one(msg)
    if role_in_thread == "customer":
        barber_profile_id = await _resolve_barber_profile_id(booking["barber_id"])
        if barber_profile_id:
            await send_notif(barber_profile_id, "Pesan baru dari pelanggan", body.text or "📎 Lampiran", "system")
    elif role_in_thread == "karyawan":
        await send_notif(booking["user_id"], "Pesan baru dari barber", body.text or "📎 Lampiran", "system")
    m = dict(msg); m.pop("_id", None); m["sender_name"] = user["name"]
    return {"message": m}


@api.get("/bookings/{bid}/owner-messages")
async def get_owner_messages(bid: str, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    await _owner_chat_access(booking, user)
    msgs = await db.owner_messages.find({"booking_id": bid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for m in msgs:
        p = await db.profiles.find_one({"id": m["sender_id"]}, {"_id": 0, "name": 1, "role": 1})
        m["sender_name"] = p["name"] if p else "?"
    shop = await db.barbershops.find_one({"id": booking["shop_id"]}, {"_id": 0, "name": 1, "image": 1})
    return {"booking_id": bid, "shop": shop, "messages": msgs}


@api.post("/bookings/{bid}/owner-messages")
async def send_owner_message(bid: str, body: ServiceChatSendIn, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    role_in_thread = await _owner_chat_access(booking, user)
    if not body.text and not body.attachment:
        raise HTTPException(400, "Pesan atau lampiran wajib diisi")
    if body.attachment and len(body.attachment) > 2_800_000:
        raise HTTPException(400, "Lampiran melebihi 2MB")
    msg = {
        "id": new_id(), "booking_id": bid, "sender_id": user["id"], "sender_role": user["role"],
        "text": body.text or "", "attachment": body.attachment or "",
        "is_read": False, "created_at": now_utc().isoformat(),
    }
    await db.owner_messages.insert_one(msg)
    shop = await db.barbershops.find_one({"id": booking["shop_id"]}, {"_id": 0, "owner_id": 1})
    if role_in_thread == "customer" and shop:
        await send_notif(shop["owner_id"], "Pesan baru dari pelanggan", body.text or "📎 Lampiran", "system")
    elif role_in_thread == "owner":
        await send_notif(booking["user_id"], "Pesan baru dari toko", body.text or "📎 Lampiran", "system")
    m = dict(msg); m.pop("_id", None); m["sender_name"] = user["name"]
    return {"message": m}


@api.get("/")
async def root():
    return {"app": "PangkasKAKA", "status": "ok"}


# ============================================================
# ANALYTICS
# ============================================================
def _kec_from_addr(addr: str) -> str:
    a = (addr or "").lower()
    for k in ["oebobo", "kelapa lima", "maulafa", "kota raja", "oesapa"]:
        if k in a: return k.title()
    return "Lainnya"


@api.get("/analytics/owner")
async def analytics_owner(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not shop:
        return {"shop": None}
    sid = shop["id"]
    now = datetime.now(WITA)
    today = now.date().isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    prev_week = (now - timedelta(days=14)).isoformat()

    # total bookings this month + growth (7d vs prev 7d)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_month = await db.bookings.count_documents({"shop_id": sid, "created_at": {"$gte": month_start}})
    last_7 = await db.bookings.count_documents({"shop_id": sid, "created_at": {"$gte": week_ago}})
    prev_7 = await db.bookings.count_documents({"shop_id": sid, "created_at": {"$gte": prev_week, "$lt": week_ago}})
    growth = 0.0
    if prev_7 > 0: growth = round((last_7 - prev_7) / prev_7 * 100, 1)
    elif last_7 > 0: growth = 100.0

    # today's fill %
    today_bookings = await db.bookings.count_documents({"shop_id": sid, "booking_date": today, "status": {"$ne": "cancelled"}})
    active_barbers = await db.barbers.count_documents({"shop_id": sid, "status": "active"})
    wd = now.weekday()
    day_name = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][wd]
    sched = await db.shop_schedules.find_one({"shop_id": sid, "day_name": day_name})
    total_slots = 0
    if sched and not sched.get("is_closed"):
        slots = gen_time_slots(sched["open_time"], sched["close_time"], 30)
        total_slots = len(slots) * max(active_barbers, 1)
    fill_pct = round((today_bookings / total_slots) * 100) if total_slots else 0

    # retention (90 days)
    d90_ago = (now - timedelta(days=90)).isoformat()
    b90 = await db.bookings.find({"shop_id": sid, "created_at": {"$gte": d90_ago}, "status": {"$ne": "cancelled"}}, {"_id": 0, "user_id": 1}).to_list(5000)
    counts: dict = {}
    for b in b90:
        counts[b["user_id"]] = counts.get(b["user_id"], 0) + 1
    unique_customers = len(counts)
    returning = sum(1 for v in counts.values() if v > 1)
    retention = round((returning / unique_customers) * 100) if unique_customers else 0

    # productivity (90 days)
    scheds = await db.shop_schedules.find({"shop_id": sid}).to_list(20)
    total_daily_slots = 0
    for s in scheds:
        if s.get("is_closed"): continue
        total_daily_slots += len(gen_time_slots(s["open_time"], s["close_time"], 30))
    total_avail_90 = total_daily_slots * (90 / 7) * max(active_barbers, 1)
    prod = round((len(b90) / total_avail_90) * 100) if total_avail_90 else 0
    prod = min(100, prod)

    # popular services (donut)
    ball = await db.bookings.find({"shop_id": sid}, {"_id": 0, "service_id": 1}).to_list(5000)
    svc_counts: dict = {}
    for b in ball:
        svc_counts[b["service_id"]] = svc_counts.get(b["service_id"], 0) + 1
    services = await db.services.find({"shop_id": sid}, {"_id": 0}).to_list(200)
    svc_names = {s["id"]: s["name"] for s in services}
    total_all = sum(svc_counts.values()) or 1
    donut = sorted([{"name": svc_names.get(sid_, "Lainnya"), "count": c, "pct": round(c / total_all * 100)} for sid_, c in svc_counts.items()], key=lambda x: -x["count"])[:5]

    return {
        "shop": shop,
        "total_bookings_month": total_month,
        "growth_pct": growth,
        "today_appointments": today_bookings,
        "today_total_slots": total_slots,
        "today_fill_pct": fill_pct,
        "retention_pct": retention,
        "productivity_pct": prod,
        "popular_services": donut,
    }


@api.get("/analytics/owner/appointments")
async def owner_appointments(date: str, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop: return {"appointments": []}
    rows = await db.bookings.find({"shop_id": shop["id"], "booking_date": date}, {"_id": 0}).sort("booking_time", 1).to_list(500)
    for r in rows:
        u = await db.profiles.find_one({"id": r["user_id"]}, {"_id": 0, "name": 1, "phone": 1, "photo": 1})
        sv = await db.services.find_one({"id": r["service_id"]}, {"_id": 0, "name": 1, "duration": 1, "price": 1})
        br = await db.barbers.find_one({"id": r["barber_id"]}, {"_id": 0, "name": 1, "photo": 1})
        r["customer"] = u
        r["service"] = sv
        r["barber"] = br
    return {"appointments": rows}


@api.get("/analytics/admin")
async def analytics_admin(user=Depends(require_role("admin"))):
    now = datetime.now(WITA)
    total_shops = await db.barbershops.count_documents({})
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    new_shops = await db.barbershops.count_documents({"created_at": {"$gte": month_start}})
    pending = await db.barbershops.count_documents({"verification_status": "pending"})
    customers = await db.profiles.count_documents({"role": "customer"})
    week_ago = (now - timedelta(days=7)).isoformat()
    prev_week = (now - timedelta(days=14)).isoformat()
    new_cust_week = await db.profiles.count_documents({"role": "customer", "created_at": {"$gte": week_ago}})
    prev_cust_week = await db.profiles.count_documents({"role": "customer", "created_at": {"$gte": prev_week, "$lt": week_ago}})
    cust_growth = round(((new_cust_week - prev_cust_week) / prev_cust_week) * 100, 1) if prev_cust_week else (100.0 if new_cust_week else 0.0)

    today = now.date().isoformat()
    yesterday = (now - timedelta(days=1)).date().isoformat()
    today_paid = await db.bookings.find({"payment_status": "paid", "booking_date": today}, {"_id": 0, "total_price": 1}).to_list(5000)
    yst_paid = await db.bookings.find({"payment_status": "paid", "booking_date": yesterday}, {"_id": 0, "total_price": 1}).to_list(5000)
    today_rev = sum(b["total_price"] for b in today_paid)
    yst_rev = sum(b["total_price"] for b in yst_paid)
    rev_growth = round(((today_rev - yst_rev) / yst_rev) * 100, 1) if yst_rev else (100.0 if today_rev else 0.0)

    # avg rating + warning shops
    shops = await db.barbershops.find({"is_verified": True}, {"_id": 0}).to_list(1000)
    ratings = [s.get("rating", 0) for s in shops if s.get("reviews_count", 0) > 0]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    warning_shops: list = []
    for s in shops:
        cur = s.get("rating", 0)
        prev_field = s.get("rating_last_week", cur)
        if prev_field - cur > 0.5:
            warning_shops.append({"id": s["id"], "name": s["name"], "drop": round(prev_field - cur, 1), "current": cur})

    # distribution by kecamatan (donut)
    kec_counts: dict = {}
    for s in shops:
        k = _kec_from_addr(s.get("address", ""))
        kec_counts[k] = kec_counts.get(k, 0) + 1
    total = sum(kec_counts.values()) or 1
    donut = [{"name": k, "count": v, "pct": round(v / total * 100)} for k, v in kec_counts.items()]
    donut.sort(key=lambda x: -x["count"])

    return {
        "kpi": {
            "total_shops": total_shops, "new_shops_month": new_shops,
            "pending": pending,
            "total_customers": customers, "customer_growth_pct": cust_growth,
            "revenue_today": today_rev, "revenue_growth_pct": rev_growth,
        },
        "health": {"avg_rating": avg_rating, "warning_shops": warning_shops[:5]},
        "distribution": donut,
    }


@api.get("/analytics/customer")
async def analytics_customer(user=Depends(require_role("customer"))):
    now = datetime.now(WITA)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    bookings = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    completed = [b for b in bookings if b["status"] == "completed" and b["created_at"] >= year_start]
    total_cuts_year = len(completed)

    # active booking (next upcoming)
    upcoming = [b for b in bookings if b["status"] in ("pending", "confirmed") and b["booking_date"] >= now.date().isoformat()]
    upcoming.sort(key=lambda x: (x["booking_date"], x["booking_time"]))
    active = None
    if upcoming:
        b = upcoming[0]
        b["shop"] = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1, "image": 1, "address": 1})
        b["service"] = await db.services.find_one({"id": b["service_id"]}, {"_id": 0, "name": 1})
        # days until
        try:
            dt = datetime.strptime(f"{b['booking_date']} {b['booking_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=WITA)
            b["days_until"] = (dt - now).days
            b["hours_until"] = int((dt - now).total_seconds() / 3600)
        except: pass
        active = b

    # favorite shop
    shop_counts: dict = {}
    for b in completed:
        shop_counts[b["shop_id"]] = shop_counts.get(b["shop_id"], 0) + 1
    fav_shop = None
    if shop_counts:
        top = max(shop_counts, key=shop_counts.get)
        fav_shop = await db.barbershops.find_one({"id": top}, {"_id": 0, "name": 1, "image": 1})
        if fav_shop: fav_shop["visits"] = shop_counts[top]

    # favorite barber
    barber_counts: dict = {}
    for b in completed:
        barber_counts[b["barber_id"]] = barber_counts.get(b["barber_id"], 0) + 1
    fav_barber = None
    if barber_counts:
        top = max(barber_counts, key=barber_counts.get)
        fav_barber = await db.barbers.find_one({"id": top}, {"_id": 0, "name": 1, "photo": 1, "skill_level": 1})
        if fav_barber: fav_barber["visits"] = barber_counts[top]

    return {
        "active_booking": active,
        "total_cuts_year": total_cuts_year,
        "fav_shop": fav_shop,
        "fav_barber": fav_barber,
    }



# ==================== DURIANPAY PAYMENT GATEWAY ====================
# Integrasi Payment Link API Durianpay dengan mode:
#   • simulation → mock lokal untuk demo tanpa internet
#   • sandbox    → panggil API Durianpay sandbox (dp_test_)
#   • production → panggil API Durianpay production (dp_live_)  ← GANTI KEY SAAT GO-LIVE

DURIANPAY_ERR_GENERIC = "Gagal membuat link pembayaran, silakan coba lagi"


def _durianpay_basic_auth() -> str:
    """Build Basic Auth header for Durianpay API. Format: base64(API_KEY + ':')."""
    token = base64.b64encode(f"{DURIANPAY_API_KEY}:".encode()).decode()
    return f"Basic {token}"


def _expiry_rfc3339_wita(minutes: int = 15) -> str:
    """
    Return an RFC3339 UTC timestamp N minutes from now, matching Durianpay's
    documented expiry_date format exactly: milliseconds + trailing 'Z'
    (e.g. "2026-09-29T10:00:00.000Z"). A "+08:00"-offset ISO string (the
    previous implementation) is valid RFC3339 but not what their API accepts.
    """
    dt = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _verify_durianpay_webhook(raw_body: bytes, method: str, path: str,
                              signature_b64: Optional[str], timestamp: Optional[str]) -> bool:
    """
    Verify Durianpay webhook using RSA-2048 (X-SIGNATURE + X-TIMESTAMP).
    String to sign: {METHOD}:{PATH}:{sha256_hex(raw_body)}:{timestamp}
    Falls back to HMAC-SHA256 verification if PUBLIC_KEY not configured but WEBHOOK_SECRET is set.
    """
    if not signature_b64 or not timestamp:
        return False

    digest_hex = hashlib.sha256(raw_body).hexdigest()
    string_to_sign = f"{method}:{path}:{digest_hex}:{timestamp}"

    # Prefer RSA verification (official Durianpay method)
    if DURIANPAY_PUBLIC_KEY_PEM and _HAS_CRYPTO:
        try:
            pub_key = serialization.load_pem_public_key(DURIANPAY_PUBLIC_KEY_PEM.encode())
            pub_key.verify(
                base64.b64decode(signature_b64),
                string_to_sign.encode(),
                _crypto_padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
        except (InvalidSignature, ValueError, Exception) as e:
            log.warning("Durianpay RSA verify failed: %s", e)
            return False

    # Fallback: HMAC-SHA256 with shared secret (timing-safe compare)
    if DURIANPAY_WEBHOOK_SECRET:
        expected = hmac.new(
            DURIANPAY_WEBHOOK_SECRET.encode(),
            string_to_sign.encode(),
            hashlib.sha256,
        ).hexdigest()
        try:
            # signature may be hex or base64
            given = signature_b64.strip()
            return hmac.compare_digest(expected, given)
        except Exception:
            return False

    # No verification key configured → reject in production, accept only in dev
    log.error("Durianpay webhook verification skipped (no public key/HMAC secret configured)")
    return False


async def _durianpay_charge_qris(order_id: str, name: str, amount: str) -> Optional[dict]:
    """
    Charge a QRIS payment for an already-created order (POST /v1/payments/charge).
    Returns the response's "qr_string" (base64 PNG data URI) / "qr_code" (raw EMV
    string) / "expiration_time" so the QR can be rendered natively in-app instead
    of only linking out to Durianpay's hosted checkout page. Returns None on any
    failure - callers should fall back to the payment_link_url flow.
    """
    headers = {"Authorization": _durianpay_basic_auth(), "Content-Type": "application/json"}
    payload = {"type": "QRIS", "request": {"order_id": order_id, "name": name, "amount": amount}}
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(f"{DURIANPAY_API_BASE}/payments/charge", json=payload, headers=headers)
    except (httpx.TimeoutException, httpx.RequestError) as e:
        log.error("Durianpay QRIS charge request failed: %s", e)
        return None
    if r.status_code >= 400:
        log.error("Durianpay QRIS charge error %d: %s", r.status_code, r.text[:500])
        return None
    try:
        body = r.json()
        return body.get("data", body)
    except Exception:
        return None


async def _load_booking_for_payment(booking_id: str, user: dict) -> dict:
    """Validate ownership + status. Raises HTTPException on invalid state."""
    b = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b["status"] != "pending" or b["payment_status"] != "unpaid":
        raise HTTPException(400, "Pesanan ini tidak lagi menunggu pembayaran")
    # expiry guard
    try:
        created = datetime.fromisoformat(b["created_at"])
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
    except Exception:
        created = now_utc()
    if (now_utc() - created).total_seconds() > 15 * 60:
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {"status": "cancelled", "payment_status": "forfeited"}}
        )
        raise HTTPException(410, "Pembayaran kadaluarsa, silakan pesan ulang")
    return b


async def _mark_booking_paid(booking: dict, provider_ref: str, method: str = "durianpay"):
    """Idempotent: update booking + payment, send notifications. Skips if already paid."""
    bid = booking["id"]
    fresh = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if fresh and fresh.get("payment_status") == "paid":
        return False  # already processed

    await db.bookings.update_one(
        {"id": bid},
        {"$set": {"payment_status": "paid", "status": "confirmed",
                  "paid_at": now_utc().isoformat()}}
    )
    await db.payments.update_one(
        {"booking_id": bid},
        {"$set": {"status": "success", "method": method,
                  "provider_ref": provider_ref,
                  "paid_at": now_utc().isoformat()}}
    )
    # Notify customer + owner
    shop = await db.barbershops.find_one({"id": booking["shop_id"]}, {"_id": 0})
    customer = await db.profiles.find_one({"id": booking["user_id"]}, {"_id": 0, "name": 1})
    await send_notif(
        booking["user_id"],
        "Pembayaran berhasil",
        f"Booking di {shop['name'] if shop else 'toko'} telah dikonfirmasi.",
        "payment",
    )
    if shop:
        await send_notif(
            shop["owner_id"],
            "Pesanan baru masuk!",
            f"Pesanan baru masuk dari {customer['name'] if customer else 'customer'}.",
            "booking",
        )
    return True


# ---------- 1) CREATE PAYMENT LINK ----------
@api.post("/payments/create/{booking_id}")
async def create_payment_link(booking_id: str, user=Depends(get_current_user)):
    """
    Buat Durianpay payment link untuk booking.
    - Amount SELALU dari database (tidak menerima dari client)
    - Expiry 15 menit
    - Aktif hanya ketika PAYMENT_MODE ∈ {sandbox, production}
    """
    if PAYMENT_MODE == "simulation":
        raise HTTPException(400, "Payment gateway sedang mode simulasi. Gunakan endpoint /payments/simulate/")

    if not DURIANPAY_API_KEY:
        log.error("DURIANPAY_API_KEY tidak dikonfigurasi")
        raise HTTPException(500, DURIANPAY_ERR_GENERIC)

    b = await _load_booking_for_payment(booking_id, user)

    # Ambil customer info dari database
    profile = await db.profiles.find_one({"id": user["id"]}, {"_id": 0})
    given_name = (profile or {}).get("name") or "Customer"
    email = (profile or {}).get("email") or "noreply@pangkaskaka.id"
    mobile = (profile or {}).get("phone") or "0800000000"

    # Reuse payment link jika masih valid (idempotent bila user klik ulang)
    existing_pay = await db.payments.find_one({"booking_id": booking_id}, {"_id": 0})
    if existing_pay and existing_pay.get("payment_link_url") and existing_pay.get("status") == "pending":
        return {
            "payment_link_url": existing_pay["payment_link_url"],
            "qr_string": existing_pay.get("qr_string") or "",
            "qr_code": existing_pay.get("qr_code") or "",
            "transaction_id": existing_pay.get("transaction_id"),
            "reused": True,
        }

    payload = {
        "amount": str(int(b["total_price"])),
        "currency": "IDR",
        "payment_option": "full_payment",
        "is_payment_link": True,
        "order_ref_id": booking_id,
        "expiry_date": _expiry_rfc3339_wita(15),
        "customer": {
            "customer_ref_id": user["id"],
            "given_name": given_name,
            "email": email,
            "mobile": mobile,
        },
        "metadata": {
            "app": "pangkaskaka",
            "shop_id": b["shop_id"],
            "booking_date": b["booking_date"],
            "booking_time": b["booking_time"],
        },
    }

    headers = {
        "Authorization": _durianpay_basic_auth(),
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(f"{DURIANPAY_API_BASE}/orders", json=payload, headers=headers)
    except (httpx.TimeoutException, httpx.RequestError) as e:
        log.error("Durianpay request failed: %s", e)
        raise HTTPException(502, DURIANPAY_ERR_GENERIC)

    if r.status_code >= 400:
        log.error("Durianpay API error %d: %s", r.status_code, r.text[:500])
        # Sandbox: surface the real Durianpay error (+ a masked fingerprint of the
        # configured key) so credential mismatches can be diagnosed without Railway
        # log/dashboard access. Never do this in production (could leak provider detail).
        detail = DURIANPAY_ERR_GENERIC
        if PAYMENT_MODE == "sandbox":
            try:
                key = DURIANPAY_API_KEY or ""
                fingerprint = f"len={len(key)} starts={key[:8]!r} ends={key[-4:]!r}" if key else "EMPTY"
                detail = f"{DURIANPAY_ERR_GENERIC} [sandbox debug: {r.status_code} {r.text[:300]} | configured key: {fingerprint}]"
            except Exception:
                pass
        raise HTTPException(502, detail)

    try:
        data = r.json().get("data", {})
    except Exception:
        raise HTTPException(502, DURIANPAY_ERR_GENERIC)

    code = data.get("payment_link_url") or ""
    dp_order_id = data.get("id") or ""  # format: ord_xxxxx
    full_url = code if code.startswith("http") else f"{DURIANPAY_PAYMENT_LINK_BASE}/{code}"

    # Charge QRIS on top of the order so the QR can be rendered natively in-app
    # instead of only linking out to Durianpay's hosted page. Best-effort: the
    # payment link stays the fallback if this fails for any reason.
    qr_string, qr_code_raw = "", ""
    if dp_order_id:
        qr_data = await _durianpay_charge_qris(dp_order_id, "PangkasKAKA", payload["amount"])
        if qr_data:
            qr_string = qr_data.get("qr_string") or ""
            qr_code_raw = qr_data.get("qr_code") or ""

    # Simpan ke payments — transaction_id = Durianpay order id
    await db.payments.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "transaction_id": dp_order_id,
            "payment_link_code": code,
            "payment_link_url": full_url,
            "qr_string": qr_string,
            "qr_code": qr_code_raw,
            "method": "durianpay",
            "status": "pending",
            "amount": int(b["total_price"]),
            "expires_at": payload["expiry_date"],
            "updated_at": now_utc().isoformat(),
        }, "$setOnInsert": {
            "id": new_id(),
            "booking_id": booking_id,
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )

    return {
        "payment_link_url": full_url,
        "qr_string": qr_string,
        "qr_code": qr_code_raw,
        "transaction_id": dp_order_id,
        "expires_at": payload["expiry_date"],
    }


# ---------- 2) WEBHOOK (Durianpay → Backend) ----------
@app.post("/api/payments/webhook/durianpay")
async def durianpay_webhook(request: Request):
    """
    Terima notifikasi pembayaran dari Durianpay.
    - Verifikasi signature RSA-2048 (X-SIGNATURE + X-TIMESTAMP) — timing-safe
    - Idempotent: webhook duplikat langsung balas 200 OK
    - Selalu balas 200 OK bila payload valid, agar Durianpay tidak retry (2, 5, 10, 90, 210 menit)
    - Log setiap webhook ke koleksi `payment_webhooks`
    """
    raw = await request.body()
    sig = request.headers.get("x-signature") or request.headers.get("X-Signature")
    ts = request.headers.get("x-timestamp") or request.headers.get("X-Timestamp")

    # Log dulu sebelum verify (untuk debugging bila signature gagal)
    log_entry = {
        "id": new_id(),
        "raw_body": raw.decode(errors="replace")[:8000],
        "headers": {"x-signature": sig, "x-timestamp": ts},
        "received_at": now_utc().isoformat(),
        "status": "received",
    }

    if not _verify_durianpay_webhook(raw, "POST", "/api/payments/webhook/durianpay", sig, ts):
        log_entry["status"] = "invalid_signature"
        await db.payment_webhooks.insert_one(log_entry)
        raise HTTPException(401, "Invalid webhook signature")

    # Idempotency: dedupe berdasar hash payload
    dedupe_key = hashlib.sha256(raw).hexdigest()
    existing = await db.payment_webhooks.find_one({"dedupe_key": dedupe_key, "status": "processed"})
    if existing:
        return {"ok": True, "duplicate": True}

    try:
        body = json.loads(raw)
    except Exception:
        log_entry["status"] = "invalid_json"
        await db.payment_webhooks.insert_one(log_entry)
        raise HTTPException(400, "Invalid JSON")

    event = body.get("event") or body.get("type") or ""
    data = body.get("data", body)
    order_ref_id = data.get("order_ref_id") or data.get("orderRefId")
    order_id = data.get("order_id") or data.get("id")
    status = (data.get("status") or "").lower()

    log_entry["dedupe_key"] = dedupe_key
    log_entry["event"] = event
    log_entry["order_ref_id"] = order_ref_id

    # Success events per Durianpay docs
    is_success = event in (
        "payment.completed", "order.completed", "payment.success",
    ) or status in ("completed", "paid", "success", "settled")

    is_failed = event in ("payment.failed", "payment.expired", "payment.cancelled",
                          "order.failed", "order.expired") or status in ("failed", "expired", "cancelled")

    booking = None
    if order_ref_id:
        booking = await db.bookings.find_one({"id": order_ref_id}, {"_id": 0})
    if not booking and order_id:
        # fallback: cari via payments.transaction_id
        p = await db.payments.find_one({"transaction_id": order_id}, {"_id": 0})
        if p:
            booking = await db.bookings.find_one({"id": p["booking_id"]}, {"_id": 0})

    if not booking:
        log_entry["status"] = "booking_not_found"
        await db.payment_webhooks.insert_one(log_entry)
        # Tetap balas 200 agar tidak retry
        return {"ok": True, "warning": "booking not found"}

    if is_success:
        await _mark_booking_paid(booking, provider_ref=order_id or "", method="durianpay")
        log_entry["status"] = "processed"
    elif is_failed:
        await db.bookings.update_one(
            {"id": booking["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "cancelled", "payment_status": "forfeited"}}
        )
        await db.payments.update_one(
            {"booking_id": booking["id"]},
            {"$set": {"status": "failed", "last_event": event}}
        )
        log_entry["status"] = "processed"
    else:
        log_entry["status"] = "ignored"

    await db.payment_webhooks.insert_one(log_entry)
    return {"ok": True}


# ---------- 3) STATUS POLLING (Frontend → Backend, DB only) ----------
@api.get("/payments/status/{booking_id}")
async def payment_status(booking_id: str, user=Depends(get_current_user)):
    """Polling endpoint: return current booking + payment status from DB."""
    await expire_stale_bookings()
    b = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    p = await db.payments.find_one({"booking_id": booking_id}, {"_id": 0})
    shop = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1, "image": 1, "address": 1})
    service = await db.services.find_one({"id": b["service_id"]}, {"_id": 0, "name": 1, "duration": 1})
    barber = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0, "name": 1, "photo": 1})

    # Hitung sisa waktu (detik) sampai expiry
    try:
        created = datetime.fromisoformat(b["created_at"])
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
    except Exception:
        created = now_utc()
    expires_at = created + timedelta(minutes=15)
    remaining = max(0, int((expires_at - now_utc()).total_seconds()))

    return {
        "booking": b,
        "payment": p,
        "shop": shop,
        "service": service,
        "barber": barber,
        "remaining_seconds": remaining,
        "payment_status": b.get("payment_status"),
        "booking_status": b.get("status"),
        "payment_link_url": (p or {}).get("payment_link_url"),
    }


# ---------- 4) FALLBACK STATUS CHECK (Backend → Durianpay) ----------
@api.post("/payments/fallback-check/{booking_id}")
async def fallback_check(booking_id: str, user=Depends(get_current_user)):
    """
    Bila webhook belum diterima setelah user kembali dari halaman pembayaran,
    panggil Durianpay langsung untuk cek status pembayaran.
    Panggil setelah > 2 menit tanpa update webhook.
    """
    if PAYMENT_MODE == "simulation":
        raise HTTPException(400, "Payment mode adalah simulasi, tidak ada fallback ke Durianpay")

    b = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b.get("payment_status") == "paid":
        return {"ok": True, "already_paid": True}

    p = await db.payments.find_one({"booking_id": booking_id}, {"_id": 0})
    if not p or not p.get("transaction_id"):
        raise HTTPException(404, "Transaksi belum dibuat")

    order_id = p["transaction_id"]
    headers = {"Authorization": _durianpay_basic_auth()}
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.get(f"{DURIANPAY_API_BASE}/orders/{order_id}", headers=headers)
    except (httpx.TimeoutException, httpx.RequestError) as e:
        log.error("Fallback check request failed: %s", e)
        raise HTTPException(502, "Gagal memeriksa status ke Durianpay")

    if r.status_code >= 400:
        raise HTTPException(502, "Gagal memeriksa status ke Durianpay")

    try:
        data = r.json().get("data", {})
    except Exception:
        raise HTTPException(502, "Response tidak valid")

    status = (data.get("status") or "").lower()
    if status in ("completed", "paid", "success", "settled"):
        await _mark_booking_paid(b, provider_ref=order_id, method="durianpay")
        return {"ok": True, "paid": True}
    if status in ("failed", "expired", "cancelled"):
        await db.bookings.update_one(
            {"id": booking_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "cancelled", "payment_status": "forfeited"}}
        )
        return {"ok": True, "paid": False, "status": status}
    return {"ok": True, "paid": False, "status": status or "pending"}


# ---------- 5) SIMULATION MODE (demo only, offline) ----------
@api.post("/payments/simulate/{booking_id}")
async def simulate_payment(booking_id: str, user=Depends(get_current_user)):
    """
    Mode simulasi: langsung tandai pembayaran sukses TANPA panggil Durianpay.
    Endpoint ini OTOMATIS NONAKTIF ketika PAYMENT_MODE=sandbox / production.
    Berguna untuk demo presentasi bila akses sandbox belum ada.
    """
    if PAYMENT_MODE != "simulation":
        raise HTTPException(403, "Endpoint simulasi hanya aktif pada PAYMENT_MODE=simulation")

    b = await _load_booking_for_payment(booking_id, user)
    processed = await _mark_booking_paid(
        b, provider_ref=f"SIM-{int(now_utc().timestamp())}", method="simulation"
    )
    return {"ok": True, "simulated": True, "processed": processed}


# ---------- 6) PAYMENT MODE INFO (frontend detect mode) ----------
@api.get("/payments/mode")
async def payments_mode():
    """Return current payment mode so frontend knows which flow to use."""
    return {"mode": PAYMENT_MODE}


# ==================== END DURIANPAY ====================


# ==================== BULK SEED KUPANG BARBERSHOPS ====================
from kupang_seed_data import build_seed_records, DEFAULT_SERVICES, DEFAULT_SCHEDULE


@api.post("/seed/kupang-shops")
async def seed_kupang_shops(user=Depends(require_role("admin"))):
    """
    Bulk seed 120 barbershop akun dari data Kupang Excel.
    Idempotent: cek by email; skip yang sudah ada.
    Response: rekap seluruh akun (email + password + status verifikasi).
    """
    records = build_seed_records()
    created = []
    skipped = []
    for r in records:
        existing = await db.profiles.find_one({"email": r["email"]}, {"_id": 0, "id": 1})
        if existing:
            # ambil shop yang sudah ada
            shop_existing = await db.barbershops.find_one({"owner_id": existing["id"]}, {"_id": 0, "verification_status": 1})
            skipped.append({
                "shop_name": r["shop_name"], "owner_name": r["owner_name"],
                "email": r["email"], "password": r["password"],
                "verification_status": (shop_existing or {}).get("verification_status", "approved"),
                "status": "already_exists",
            })
            continue

        # 1. Create owner profile
        uid = new_id()
        await db.profiles.insert_one({
            "id": uid,
            "email": r["email"],
            "password": hash_pw(r["password"]),
            "name": r["owner_name"],
            "phone": r["phone"],
            "role": "owner",
            "photo": "",
            "address": r["addr"],
            "created_at": now_utc().isoformat(),
        })

        # 2. Create shop (auto-approved via seed)
        sid = new_id()
        await db.barbershops.insert_one({
            "id": sid,
            "owner_id": uid,
            "name": r["shop_name"],
            "category": r["cat"],
            "address": r["addr"],
            "latitude": r["lat"],
            "longitude": r["lng"],
            "price_range": "Rp 25.000 - Rp 100.000",
            "image": r["img"],
            "rating": r["rating"],
            "reviews_count": r["reviews"],
            "verification_status": "approved",
            "chat_closed": False,
            "created_at": now_utc().isoformat(),
        })

        # 3. Default services
        for s in DEFAULT_SERVICES:
            await db.services.insert_one({
                "id": new_id(), "shop_id": sid,
                **s, "created_at": now_utc().isoformat(),
            })

        # 4. Default schedule
        for sc in DEFAULT_SCHEDULE:
            await db.schedules.insert_one({
                "id": new_id(), "shop_id": sid, **sc,
                "created_at": now_utc().isoformat(),
            })

        created.append({
            "shop_name": r["shop_name"], "owner_name": r["owner_name"],
            "email": r["email"], "password": r["password"],
            "verification_status": "approved",
            "status": "created",
        })

    return {
        "ok": True,
        "total_records": len(records),
        "created": len(created),
        "skipped": len(skipped),
        "accounts": created + skipped,
    }


# ==================== RECRUITMENT SYSTEM (Multi-stage) ====================
# Status flow: pending → seleksi_berkas_lolos → menunggu_tes → active / rejected

RECRUITMENT_CRITERIA_SEED = [
    "Berusia minimal 17 tahun dan sehat jasmani",
    "Bersedia bekerja sesuai jadwal toko (shift/full-time)",
    "Memiliki pengalaman memangkas rambut minimal 6 bulan (perkiraan)",
    "Memiliki alat cukur pribadi atau bersedia menggunakan alat toko",
    "Bersedia mengikuti standar layanan dan higiene toko",
    "Berkomitmen menjaga kebersihan dan keramahan terhadap pelanggan",
]


class BerkasDecisionIn(BaseModel):
    decision: Literal["lolos", "tolak"]
    reason: Optional[str] = None


class RecruitmentMessageIn(BaseModel):
    text: Optional[str] = None
    attachment: Optional[str] = None


class UpdateCriteriaIn(BaseModel):
    items: List[str]


@api.get("/recruitment/criteria")
async def get_recruitment_criteria(user=Depends(get_current_user)):
    """Public criteria list (untuk ditampilkan saat karyawan apply)."""
    doc = await db.recruitment_criteria.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        doc = {"id": "global", "items": RECRUITMENT_CRITERIA_SEED,
               "updated_at": now_utc().isoformat()}
        await db.recruitment_criteria.insert_one(doc)
        doc.pop("_id", None)
    return {"items": doc.get("items", []), "updated_at": doc.get("updated_at")}


@api.put("/admin/recruitment/criteria")
async def update_recruitment_criteria(body: UpdateCriteriaIn, user=Depends(require_role("admin"))):
    if not body.items or len(body.items) < 1:
        raise HTTPException(400, "Minimal 1 kriteria")
    await db.recruitment_criteria.update_one(
        {"id": "global"},
        {"$set": {"items": body.items, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True, "count": len(body.items)}


@api.post("/owner/karyawan/{kid}/berkas-decision")
async def berkas_decision(kid: str, body: BerkasDecisionIn, user=Depends(require_role("owner"))):
    """
    Tahap 1: Owner memutuskan berkas pelamar lolos atau ditolak.
    - lolos → status seleksi_berkas_lolos (langsung siap koordinasi tes via chat)
    - tolak → status rejected dengan alasan
    """
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    k = await db.karyawan.find_one({"id": kid, "shop_id": shop["id"]}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    if k["status"] != "pending":
        raise HTTPException(400, f"Berkas pelamar sudah diproses (status: {k['status']})")

    if body.decision == "lolos":
        new_status = "seleksi_berkas_lolos"
        notif_title = "Berkas Anda LOLOS seleksi!"
        notif_msg = "Selamat! Berkas Anda diterima. Owner akan mengoordinasikan jadwal tes kemampuan via chat."
        # Otomatis pindah ke menunggu_tes (buka ruang chat)
        new_status = "menunggu_tes"
    else:
        new_status = "rejected"
        notif_title = "Lamaran Ditolak"
        notif_msg = body.reason or "Mohon maaf, berkas Anda belum memenuhi persyaratan."

    await db.karyawan.update_one(
        {"id": kid},
        {"$set": {
            "status": new_status,
            "berkas_reviewed_at": now_utc().isoformat(),
            "berkas_reason": body.reason or "",
        }}
    )
    await send_notif(k["profile_id"], notif_title, notif_msg, "system")

    # Kalau lolos → kirim pesan pembuka otomatis di chat rekrutmen
    if new_status == "menunggu_tes":
        await db.recruitment_messages.insert_one({
            "id": new_id(),
            "karyawan_id": kid,
            "sender_id": user["id"],
            "sender_role": "owner",
            "text": f"Selamat, berkas Anda lolos seleksi! Silakan koordinasi jadwal uji tes kemampuan memangkas di sini. Kapan Anda bisa datang?",
            "is_read": False,
            "created_at": now_utc().isoformat(),
        })
    return {"ok": True, "status": new_status}


@api.get("/recruitment/{kid}/messages")
async def get_recruitment_messages(kid: str, user=Depends(get_current_user)):
    """
    Chat rekrutmen antara owner & pelamar.
    Akses: pemilik toko atau pelamar itu sendiri.
    """
    k = await db.karyawan.find_one({"id": kid}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    # Akses check
    if user["role"] == "karyawan":
        if k["profile_id"] != user["id"]:
            raise HTTPException(403, "Akses ditolak")
    elif user["role"] == "owner":
        shop = await db.barbershops.find_one({"id": k["shop_id"]}, {"_id": 0, "owner_id": 1})
        if not shop or shop["owner_id"] != user["id"]:
            raise HTTPException(403, "Bukan toko Anda")
    elif user["role"] != "admin":
        raise HTTPException(403, "Akses ditolak")

    msgs = await db.recruitment_messages.find({"karyawan_id": kid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Mark others' messages as read
    await db.recruitment_messages.update_many(
        {"karyawan_id": kid, "sender_id": {"$ne": user["id"]}, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"messages": msgs, "karyawan": k}


@api.post("/recruitment/{kid}/messages")
async def send_recruitment_message(kid: str, body: RecruitmentMessageIn, user=Depends(get_current_user)):
    k = await db.karyawan.find_one({"id": kid}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    if k["status"] not in ("menunggu_tes", "seleksi_berkas_lolos", "active"):
        raise HTTPException(400, "Chat tidak tersedia pada tahap ini")

    # Access
    if user["role"] == "karyawan" and k["profile_id"] != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    if user["role"] == "owner":
        shop = await db.barbershops.find_one({"id": k["shop_id"]}, {"_id": 0, "owner_id": 1})
        if not shop or shop["owner_id"] != user["id"]:
            raise HTTPException(403, "Bukan toko Anda")

    text = (body.text or "").strip()
    if not text and not body.attachment:
        raise HTTPException(400, "Pesan kosong")
    if body.attachment and len(body.attachment) > 2_800_000:
        raise HTTPException(400, "Lampiran melebihi 2MB")
    msg = {
        "id": new_id(),
        "karyawan_id": kid,
        "sender_id": user["id"],
        "sender_role": user["role"],
        "text": text,
        "attachment": body.attachment or "",
        "is_read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.recruitment_messages.insert_one(msg)

    # Notifikasi lawan bicara
    recipient_id = k["profile_id"] if user["role"] == "owner" else None
    if not recipient_id:
        shop = await db.barbershops.find_one({"id": k["shop_id"]}, {"_id": 0, "owner_id": 1})
        recipient_id = (shop or {}).get("owner_id")
    if recipient_id:
        await send_notif(recipient_id, "Pesan Rekrutmen Baru",
                         f"{user['name']}: {body.text[:80]}", "system")
    msg.pop("_id", None)
    return {"message": msg}


@api.get("/karyawan/progress")
async def karyawan_progress(user=Depends(require_role("karyawan"))):
    """Timeline pemantauan progres rekrutmen untuk karyawan."""
    apps = await db.karyawan.find({"profile_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    result = []
    for a in apps:
        shop = await db.barbershops.find_one({"id": a["shop_id"]}, {"_id": 0, "name": 1, "image": 1, "address": 1})
        unread = await db.recruitment_messages.count_documents({
            "karyawan_id": a["id"], "sender_id": {"$ne": user["id"]}, "is_read": False
        })
        # Timeline stages
        stage_order = ["pending", "seleksi_berkas_lolos", "menunggu_tes", "active"]
        current_status = a["status"]
        # Timeline: berkas_dikirim (always done), seleksi_berkas, uji_tes, hasil_akhir
        timeline = [
            {"key": "berkas", "label": "Berkas Dikirim", "done": True, "active": False},
            {"key": "seleksi", "label": "Seleksi Berkas",
             "done": current_status in ("seleksi_berkas_lolos", "menunggu_tes", "active", "rejected"),
             "active": current_status == "pending"},
            {"key": "tes", "label": "Uji Tes Kemampuan",
             "done": current_status in ("active",),
             "active": current_status == "menunggu_tes",
             "rejected": current_status == "rejected" and (a.get("total_score") or 0) > 0},
            {"key": "hasil", "label": "Hasil Akhir",
             "done": current_status in ("active", "rejected"),
             "active": False,
             "final_status": current_status},
        ]
        result.append({
            "application": a,
            "shop": shop,
            "unread_messages": unread,
            "timeline": timeline,
        })
    return {"applications": result}


# ==================== END RECRUITMENT ====================


# Register router
app.include_router(api)

_cors_origins = (
    ["*"] if CORS_ORIGINS.strip() == "*"
    else [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    # allow_credentials + wildcard origin sekaligus itu kombinasi berbahaya
    # (browser akan meng-echo origin apa pun sebagai origin yang diizinkan).
    # App ini pakai Bearer token (bukan cookie), jadi credentials cuma
    # diaktifkan begitu origin sudah dipersempit lewat CORS_ORIGINS.
    allow_credentials=_cors_origins != ["*"],
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def ensure_indexes():
    await db.profiles.create_index("email", unique=True)
    await db.barbershops.create_index("owner_id")
    await db.barbers.create_index("shop_id")
    await db.barbers.create_index("karyawan_id")
    await db.karyawan.create_index("profile_id")
    await db.karyawan.create_index("shop_id")
    await db.karyawan_locations.create_index("karyawan_id", unique=True)
    await db.bookings.create_index("user_id")
    await db.bookings.create_index("shop_id")
    await db.bookings.create_index("barber_id")
    await db.bookings.create_index("status")
    await db.shop_schedules.create_index([("shop_id", 1), ("day_name", 1)])
    await db.shop_schedule_overrides.create_index([("shop_id", 1), ("date", 1)], unique=True)
    await db.owner_messages.create_index("booking_id")
    await db.payments.create_index("booking_id")
    await db.notifications.create_index("user_id")
    await db.chat_messages.create_index("shop_id")
    await db.recruitment_messages.create_index("karyawan_id")
    await db.service_messages.create_index("booking_id")
    await db.password_resets.create_index([("email", 1), ("code", 1)])


@app.on_event("startup")
async def startup_seed():
    try:
        await ensure_indexes()
    except Exception as e:
        log.exception("Index creation on startup failed: %s", e)
    if ENVIRONMENT == "production":
        log.info("ENVIRONMENT=production — auto-seed demo data dilewati.")
        return
    try:
        await seed_all()
    except Exception as e:
        log.exception("Seed on startup failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
