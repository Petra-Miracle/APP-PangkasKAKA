"""
PangkasKAKA Backend — FastAPI + MongoDB
On-demand barbershop booking platform for Kupang City, Indonesia
"""
import os
import re
import math
import uuid
import json
import hmac
import hashlib
import base64
import logging
import asyncio
import secrets
import mimetypes
from pathlib import Path
from datetime import datetime, timedelta, timezone, date, time as dtime
from typing import List, Optional, Any, Literal, Dict

import bcrypt
import httpx
import jwt as pyjwt
import boto3
from botocore.config import Config as BotoConfig
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Body, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel, Field, EmailStr, field_validator

# Cryptography (Durianpay webhook RSA-2048 verification)
try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding as _crypto_padding
    from cryptography.exceptions import InvalidSignature
    _HAS_CRYPTO = True
except Exception:  # pragma: no cover
    _HAS_CRYPTO = False

# Gemini (AI Face Scan reasoning text, admin document-review assist — official
# Google GenAI SDK). _genai_types is needed separately for the image Part
# helper used by document review.
try:
    from google import genai as _genai
    from google.genai import types as _genai_types
except Exception:  # pragma: no cover
    _genai = None
    _genai_types = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXP_HOURS = int(os.environ.get("JWT_EXP_HOURS", 168))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
_gemini_client = _genai.Client(api_key=GEMINI_API_KEY) if (_genai and GEMINI_API_KEY) else None

BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL", "pangkaskaka26@gmail.com")
BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "PangkasKAKA")

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
# Sandbox and production are separate hosts (confirmed with Durianpay support after
# api.durianpay.id kept rejecting an otherwise-valid sandbox key with 401
# DPAY_UNAUTHORIZED_ACCESS) — derive from PAYMENT_MODE so this can't be misconfigured
# again, but still allow an explicit override via DURIANPAY_API_BASE if ever needed.
_DURIANPAY_API_BASE_DEFAULT = (
    "https://api-sandbox.durianpay.id/v1" if PAYMENT_MODE == "sandbox"
    else "https://api.durianpay.id/v1"
)
DURIANPAY_API_BASE = os.environ.get("DURIANPAY_API_BASE", _DURIANPAY_API_BASE_DEFAULT)
# Same sandbox/production host split as the API base above — the hosted payment
# link page also lives on a separate sandbox domain.
_DURIANPAY_PAYMENT_LINK_BASE_DEFAULT = (
    "https://links-sandbox.durianpay.id/payment" if PAYMENT_MODE == "sandbox"
    else "https://links.durianpay.id/payment"
)
DURIANPAY_PAYMENT_LINK_BASE = os.environ.get("DURIANPAY_PAYMENT_LINK_BASE", _DURIANPAY_PAYMENT_LINK_BASE_DEFAULT)
# Public key PEM dari Durianpay Dashboard → Settings → Webhook (RSA-2048)
DURIANPAY_PUBLIC_KEY_PEM = os.environ.get("DURIANPAY_PUBLIC_KEY_PEM", "").replace("\\n", "\n")
# Opsional: HMAC secret untuk verifikasi tambahan (legacy webhook / signature payment fallback)
DURIANPAY_WEBHOOK_SECRET = os.environ.get("DURIANPAY_WEBHOOK_SECRET", "")

# ---------- Cloudflare R2 (object storage untuk foto/dokumen) ----------
# Kalau belum diisi, upload_to_r2() fallback: simpan base64 apa adanya (perilaku lama)
# supaya backend tetap jalan di lingkungan yang belum diset up R2 (mis. lokal/dev).
R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "").strip()
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "pangkaskaka-uploads").strip()
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").strip().rstrip("/")

# ---------- Alur transaksi (wallet/ledger) — lihat Noted/2026-09-05/README_ALUR_TRANSAKSI.md ----------
PLATFORM_COMMISSION_RATE = float(os.environ.get("PLATFORM_COMMISSION_RATE", "0.10"))
ADMIN_FEE_BORNE_BY = os.environ.get("ADMIN_FEE_BORNE_BY", "customer")  # "customer" | "platform" (belum dipakai — Model 1 selalu ke customer untuk sekarang)
# ASUMSI — ganti setelah tarif Durianpay per metode pembayaran dikonfirmasi (README §2.6)
PAYMENT_FEE_RATE_QRIS = float(os.environ.get("PAYMENT_FEE_RATE_QRIS", "0.007"))
PAYMENT_FEE_FLAT = int(os.environ.get("PAYMENT_FEE_FLAT", "0"))
MAX_ETA_MINUTES = int(os.environ.get("MAX_ETA_MINUTES", "30"))
AVG_SPEED_KMH = float(os.environ.get("AVG_SPEED_KMH", "25"))  # kecepatan rata-rata sepeda motor dalam kota Kupang
ROAD_FACTOR = float(os.environ.get("ROAD_FACTOR", "1.3"))  # koreksi jarak lurus (haversine) -> jarak jalan sebenarnya
MAX_RADIUS_KM = (MAX_ETA_MINUTES / 60) * AVG_SPEED_KMH / ROAD_FACTOR  # diturunkan dari 3 konstanta di atas, jangan hardcode terpisah
MIN_PAYOUT_AMOUNT = int(os.environ.get("MIN_PAYOUT_AMOUNT", "50000"))
AUTO_RELEASE_HOURS = int(os.environ.get("AUTO_RELEASE_HOURS", "48"))  # jaga-jaga kalau pemangkas lupa menekan "Selesai" (README §4)

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


# ---------- Object storage (Cloudflare R2) ----------
# Foto/dokumen sebelumnya disimpan sebagai base64 langsung di dokumen MongoDB — cepat
# menghabiskan kuota Atlas tier gratis dan bikin query jadi berat begitu jumlah toko/user
# bertambah. upload_to_r2() memindahkan file ke R2 dan hanya menyimpan URL publiknya.
_r2_client = None
if R2_ENDPOINT and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY:
    try:
        _r2_client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=BotoConfig(signature_version="s3v4"),
            region_name="auto",
        )
    except Exception:
        # Konfigurasi R2 salah tidak boleh menjatuhkan seluruh aplikasi saat startup —
        # upload_to_r2() fallback ke base64 selama _r2_client None, sama seperti kalau
        # R2 memang belum dikonfigurasi sama sekali.
        log.exception("Gagal membuat R2 client, upload foto/dokumen fallback ke base64")
        _r2_client = None

_DATA_URL_RE = re.compile(r"^data:([\w/\-+.]+);base64,(.*)$", re.DOTALL)


def _decode_data_url(value: str):
    m = _DATA_URL_RE.match(value)
    content_type = m.group(1) if m else "application/octet-stream"
    b64data = m.group(2) if m else value
    raw = base64.b64decode(b64data)
    ext = mimetypes.guess_extension(content_type) or ""
    return raw, content_type, ext


async def upload_to_r2(value: Optional[str], folder: str) -> str:
    """Upload data-URL base64 (data:<mime>;base64,<data>) ke R2, kembalikan URL publik.
    Kalau value kosong, sudah berupa URL http(s), atau R2 belum dikonfigurasi (mis. dev
    lokal tanpa kredensial R2), kembalikan value apa adanya — aman dipanggil di semua
    endpoint upload tanpa perlu cek kondisi itu di tiap caller."""
    if not value or not value.startswith("data:") or not _r2_client:
        return value or ""
    try:
        raw, content_type, ext = _decode_data_url(value)
        key = f"{folder}/{new_id()}{ext}"
        await asyncio.to_thread(
            _r2_client.put_object, Bucket=R2_BUCKET_NAME, Key=key, Body=raw, ContentType=content_type
        )
        return f"{R2_PUBLIC_URL}/{key}"
    except Exception:
        # Upload ke R2 gagal (kredensial salah, bucket tidak ada, dsb) tidak boleh
        # menggagalkan seluruh alur (booking/registrasi toko/lamaran karyawan) —
        # fallback simpan base64 apa adanya, sama seperti sebelum migrasi R2 ada.
        log.exception("Upload ke R2 gagal (folder=%s), fallback simpan base64", folder)
        return value


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def _gen_password() -> str:
    """Password acak untuk akun yang dibuatkan sistem (Owner via approval toko, Admin via
    superadmin) — ditampilkan plaintext SEKALI ke pembuatnya, tidak pernah disimpan mentah."""
    return secrets.token_urlsafe(9)


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


def eta_minutes(distance_km: float) -> int:
    return math.ceil(distance_km * ROAD_FACTOR / AVG_SPEED_KMH * 60)


# ---------- Wallet / Ledger — lihat Noted/2026-09-05/README_ALUR_TRANSAKSI.md §1 ----------
# Dana user tidak pernah masuk langsung ke pemangkas: selalu lewat wallet "platform" dulu
# (held/pending), baru dilepas ke wallet pemangkas (shop atau karyawan, tergantung
# delivery_mode) saat pemangkas menekan "Selesai". Setiap perpindahan dicatat di
# ledger_entries supaya bisa direkonsiliasi (SUM(credit) - SUM(debit) per wallet harus sama
# dengan total saldo tersimpan, balance_pending + balance_available).
async def get_or_create_wallet(owner_type: str, owner_id: Optional[str]) -> dict:
    existing = await db.wallets.find_one({"owner_type": owner_type, "owner_id": owner_id})
    if existing:
        return existing
    doc = {
        "id": new_id(), "owner_type": owner_type, "owner_id": owner_id,
        "balance_pending": 0, "balance_available": 0, "currency": "IDR",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }
    try:
        await db.wallets.insert_one(doc)
    except Exception:
        # race: wallet ini sempat dibuat proses lain di antara find_one dan insert_one
        existing = await db.wallets.find_one({"owner_type": owner_type, "owner_id": owner_id})
        if existing:
            return existing
        raise
    return doc


async def _adjust_wallet(wallet_id: str, delta_pending: int, delta_available: int, session) -> dict:
    return await db.wallets.find_one_and_update(
        {"id": wallet_id},
        {"$inc": {"balance_pending": delta_pending, "balance_available": delta_available},
         "$set": {"updated_at": now_utc().isoformat()}},
        session=session, return_document=ReturnDocument.AFTER,
    )


async def _ledger(session, wallet_id: str, txn_id: str, order_id: str, direction: str,
                   amount: int, entry_type: str, balance_after: int, memo: str = ""):
    await db.ledger_entries.insert_one({
        "id": new_id(), "transaction_id": txn_id, "order_id": order_id,
        "wallet_id": wallet_id, "direction": direction, "amount": amount,
        "entry_type": entry_type, "balance_after": balance_after,
        # deterministic (bukan random) supaya retry pada peristiwa yang sama benar-benar
        # ditolak oleh unique index, bukan cuma diandalkan dari pengecekan fund_state di caller
        "idempotency_key": f"{entry_type}:{direction}:{order_id}:{wallet_id}",
        "memo": memo, "created_at": now_utc().isoformat(),
    }, session=session)


async def _hold_booking_funds(booking: dict, session):
    """Trigger 1 — pembayaran terkonfirmasi. Tahan dana di wallet platform (fund_state: held)."""
    platform_wallet = await get_or_create_wallet("platform", None)
    amount_service = booking["amount_service"]
    updated = await _adjust_wallet(platform_wallet["id"], amount_service, 0, session)
    txn_id = new_id()
    await _ledger(session, platform_wallet["id"], txn_id, booking["id"], "credit", amount_service,
                  "payment_in", updated["balance_pending"] + updated["balance_available"],
                  "Dana ditahan menunggu layanan selesai")
    await db.bookings.update_one({"id": booking["id"]}, {"$set": {"fund_state": "held"}}, session=session)


async def _release_booking_funds(booking: dict, session) -> bool:
    """Trigger 2 — pemangkas menekan 'Selesai'. Idempoten: no-op kalau fund_state bukan 'held'."""
    fresh = await db.bookings.find_one({"id": booking["id"]}, {"_id": 0}, session=session)
    if not fresh or fresh.get("fund_state") != "held":
        return False
    platform_wallet = await get_or_create_wallet("platform", None)
    payee_wallet = await get_or_create_wallet(fresh["payout_wallet_type"], fresh["payout_wallet_owner_id"])
    commission = fresh["amount_platform_commission"]
    barber_net = fresh["amount_barber_net"]
    txn_id = new_id()

    # Platform: pending turun sebesar amount_service (dana keluar dari bucket), available naik
    # sebesar komisi saja — efek bersih -barber_net, itu yang dicatat di ledger.
    platform_after = await _adjust_wallet(platform_wallet["id"], -fresh["amount_service"], commission, session)
    await _ledger(session, platform_wallet["id"], txn_id, fresh["id"], "debit", barber_net,
                  "barber_payout", platform_after["balance_pending"] + platform_after["balance_available"],
                  "Dana dilepas dari bucket platform")
    await _ledger(session, platform_wallet["id"], txn_id, fresh["id"], "credit", commission,
                  "platform_commission", platform_after["balance_pending"] + platform_after["balance_available"],
                  "Komisi platform")

    payee_after = await _adjust_wallet(payee_wallet["id"], 0, barber_net, session)
    await _ledger(session, payee_wallet["id"], txn_id, fresh["id"], "credit", barber_net,
                  "barber_payout", payee_after["balance_pending"] + payee_after["balance_available"],
                  "Pendapatan pemangkas")

    await db.bookings.update_one(
        {"id": fresh["id"]},
        {"$set": {"fund_state": "released", "released_at": now_utc().isoformat()}},
        session=session,
    )
    return True


async def _refund_booking_if_held(booking: dict, session) -> bool:
    """Pembatalan sebelum selesai — kembalikan dana ke user tanpa menyentuh wallet pemangkas
    sama sekali (README §1.7: ini keuntungan utama skema bucket)."""
    fresh = await db.bookings.find_one({"id": booking["id"]}, {"_id": 0}, session=session)
    if not fresh or fresh.get("fund_state") != "held":
        return False
    platform_wallet = await get_or_create_wallet("platform", None)
    amount_service = fresh["amount_service"]
    txn_id = new_id()
    platform_after = await _adjust_wallet(platform_wallet["id"], -amount_service, 0, session)
    await _ledger(session, platform_wallet["id"], txn_id, fresh["id"], "debit", amount_service,
                  "refund", platform_after["balance_pending"] + platform_after["balance_available"],
                  "Dikembalikan ke user")
    await db.bookings.update_one(
        {"id": fresh["id"]},
        {"$set": {"fund_state": "refunded", "refunded_at": now_utc().isoformat(), "payment_status": "refunded"}},
        session=session,
    )
    return True


async def _hold_product_order_funds(order: dict, session):
    """Mirror _hold_booking_funds untuk pembelian produk. Trigger: pembayaran terkonfirmasi."""
    platform_wallet = await get_or_create_wallet("platform", None)
    amount_product = order["amount_product"]
    updated = await _adjust_wallet(platform_wallet["id"], amount_product, 0, session)
    txn_id = new_id()
    await _ledger(session, platform_wallet["id"], txn_id, order["id"], "credit", amount_product,
                  "payment_in", updated["balance_pending"] + updated["balance_available"],
                  "Dana ditahan menunggu produk diambil/diantar")
    await db.product_orders.update_one({"id": order["id"]}, {"$set": {"fund_state": "held"}}, session=session)


async def _release_product_order_funds(order: dict, session) -> bool:
    """Mirror _release_booking_funds — dipanggil owner saat pesanan produk ditandai selesai."""
    fresh = await db.product_orders.find_one({"id": order["id"]}, {"_id": 0}, session=session)
    if not fresh or fresh.get("fund_state") != "held":
        return False
    platform_wallet = await get_or_create_wallet("platform", None)
    payee_wallet = await get_or_create_wallet(fresh["payout_wallet_type"], fresh["payout_wallet_owner_id"])
    commission = fresh["amount_platform_commission"]
    shop_net = fresh["amount_shop_net"]
    txn_id = new_id()

    platform_after = await _adjust_wallet(platform_wallet["id"], -fresh["amount_product"], commission, session)
    await _ledger(session, platform_wallet["id"], txn_id, fresh["id"], "debit", shop_net,
                  "product_payout", platform_after["balance_pending"] + platform_after["balance_available"],
                  "Dana dilepas dari bucket platform")
    await _ledger(session, platform_wallet["id"], txn_id, fresh["id"], "credit", commission,
                  "platform_commission", platform_after["balance_pending"] + platform_after["balance_available"],
                  "Komisi platform")

    payee_after = await _adjust_wallet(payee_wallet["id"], 0, shop_net, session)
    await _ledger(session, payee_wallet["id"], txn_id, fresh["id"], "credit", shop_net,
                  "product_payout", payee_after["balance_pending"] + payee_after["balance_available"],
                  "Pendapatan penjualan produk")

    await db.product_orders.update_one(
        {"id": fresh["id"]},
        {"$set": {"fund_state": "released", "released_at": now_utc().isoformat()}},
        session=session,
    )
    return True


async def _refund_product_order_if_held(order: dict, session) -> bool:
    """Mirror _refund_booking_if_held — dipanggil owner saat membatalkan pesanan produk."""
    fresh = await db.product_orders.find_one({"id": order["id"]}, {"_id": 0}, session=session)
    if not fresh or fresh.get("fund_state") != "held":
        return False
    platform_wallet = await get_or_create_wallet("platform", None)
    amount_product = fresh["amount_product"]
    txn_id = new_id()
    platform_after = await _adjust_wallet(platform_wallet["id"], -amount_product, 0, session)
    await _ledger(session, platform_wallet["id"], txn_id, fresh["id"], "debit", amount_product,
                  "refund", platform_after["balance_pending"] + platform_after["balance_available"],
                  "Dikembalikan ke user")
    await db.product_orders.update_one(
        {"id": fresh["id"]},
        {"$set": {"fund_state": "refunded", "refunded_at": now_utc().isoformat(), "payment_status": "refunded"}},
        session=session,
    )
    return True


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
    # owner/admin/superadmin TIDAK boleh self-register — owner hanya lahir dari approval
    # pengajuan toko (lihat submit_shop_application/admin_verify), admin/superadmin dibuat
    # manual oleh superadmin (lihat create_admin).
    role: Literal["customer", "streetbarber"] = "customer"
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


class UpdateProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
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


class ShopApplicationIn(ShopRegisterIn):
    """Pengajuan toko publik — TANPA akun. Akun Owner baru dibuat otomatis oleh sistem
    saat pengajuan ini disetujui (lihat _provision_owner_account)."""
    applicant_name: str
    applicant_email: EmailStr
    applicant_phone: str


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


class SuspendUserIn(BaseModel):
    reason: Optional[str] = None


class UpdateUserRoleIn(BaseModel):
    role: Literal["customer", "owner", "streetbarber", "admin", "superadmin"]


class SetUserPasswordIn(BaseModel):
    new_password: str


class CreateAdminIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    managed_shop_ids: List[str] = []


class UpdateAdminScopeIn(BaseModel):
    managed_shop_ids: List[str]


class BarberIn(BaseModel):
    name: str
    photo: Optional[str] = None
    specialization: Optional[str] = None
    skill_level: Literal["Junior", "Standar", "Senior"] = "Standar"


class ServiceIn(BaseModel):
    name: str
    duration: int  # minutes
    price: int


class ProductIn(BaseModel):
    name: str
    price: int
    description: str = ""
    photo: str = ""  # data-URL base64 dari ImagePicker, atau "" kalau tidak ganti foto


class ProductOrderIn(BaseModel):
    product_id: str
    quantity: int = 1
    fulfillment: str  # "pickup" | "delivery"
    address: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None


class ShopAdminProductIn(BaseModel):
    name: str
    price: int
    description: str = ""
    category: str = ""
    image_url: str = ""  # base64 data-URL atau URL gambar
    stock: int = 0
    is_active: bool = True
    shop_id: str


class ShopAdminServiceIn(BaseModel):
    name: str
    price: int
    description: str = ""
    duration_minutes: int = 30
    is_active: bool = True
    shop_id: str


FACE_SHAPES = ("oval", "round", "square", "oblong", "heart")


class HairstyleIn(BaseModel):
    name: str
    image_url: str
    description: str
    match_score_map: Dict[str, int]  # e.g. {"oval": 90, "square": 78} — keys must be valid face shapes, values 0-100

    @field_validator("match_score_map")
    @classmethod
    def validate_scores(cls, v):
        if not v:
            raise ValueError("match_score_map tidak boleh kosong")
        for shape, score in v.items():
            if shape not in FACE_SHAPES:
                raise ValueError(f"bentuk wajah tidak valid: {shape} (harus salah satu dari {FACE_SHAPES})")
            if not (0 <= score <= 100):
                raise ValueError(f"skor untuk {shape} harus 0-100")
        return v


class FaceReferenceIn(BaseModel):
    reference_code: str  # e.g. "OV-01" — label pemilik data, bebas format
    shape: str
    face_width: float
    face_height: float
    forehead_width: float
    cheekbone_width: float
    jaw_width: float
    confidence_level: float  # 0-1, tingkat keyakinan sumber data
    recommended_hairstyles: str = ""

    @field_validator("shape")
    @classmethod
    def validate_shape(cls, v):
        if v not in FACE_SHAPES:
            raise ValueError(f"bentuk wajah tidak valid: {v} (harus salah satu dari {FACE_SHAPES})")
        return v

    @field_validator("confidence_level")
    @classmethod
    def validate_confidence(cls, v):
        if not (0 <= v <= 1):
            raise ValueError("confidence_level harus 0-1")
        return v


class ScheduleRow(BaseModel):
    day_name: Literal["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    open_time: str = "09:00"
    close_time: str = "21:00"
    is_closed: bool = False


class SaveSchedulesIn(BaseModel):
    schedules: List[ScheduleRow]


class ShopOpenStatusIn(BaseModel):
    is_open: bool


class HomeServiceFeeIn(BaseModel):
    fee: int = Field(ge=0)


class BankAccountIn(BaseModel):
    bank_name: str
    account_number: str
    account_holder: str


class ShopImageIn(BaseModel):
    image: str


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
    delivery_mode: Literal["toko", "rumah"] = "toko"
    customer_address: Optional[str] = None


class ReviewIn(BaseModel):
    rating: int
    comment: Optional[str] = None


class KaryawanApplyIn(BaseModel):
    shop_id: str
    # WAJIB: KTP + Pengalaman kerja
    ktp_photo: str  # base64 atau URL
    work_experience: str  # deskripsi teks pengalaman
    # OPSIONAL tapi dianjurkan: portofolio (foto hasil cukur)
    portfolio_url: Optional[str] = None
    tools_photo: Optional[str] = None
    diploma_photo: Optional[str] = None  # ijazah, base64 atau URL
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


class PushTokenIn(BaseModel):
    token: str = Field(min_length=1)
    platform: Literal["android", "ios", "web"] = "android"
    device_id: Optional[str] = None


# ---------- Helper: Notifications ----------
async def _send_expo_push(user_id: str, title: str, message: str, type: str, data: Optional[dict] = None):
    tokens = await db.device_push_tokens.find(
        {"user_id": user_id, "is_active": True}, {"_id": 0, "token": 1}
    ).to_list(100)
    if not tokens:
        return

    payloads = [
        {
            "to": row["token"],
            "title": title,
            "body": message,
            "sound": "default",
            "data": {"type": type, **(data or {})},
        }
        for row in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            response = await http.post(
                "https://exp.host/--/api/v2/push/send",
                headers={"content-type": "application/json"},
                json=payloads,
            )
            response.raise_for_status()
            receipts = response.json().get("data", [])
        for row, receipt in zip(tokens, receipts):
            if receipt.get("status") == "error":
                error_code = receipt.get("details", {}).get("error")
                if error_code == "DeviceNotRegistered":
                    await db.device_push_tokens.update_one(
                        {"user_id": user_id, "token": row["token"]}, {"$set": {"is_active": False}}
                    )
                else:
                    log.warning(
                        "Expo push ditolak untuk user %s (error=%s): %s",
                        user_id, error_code, receipt.get("message"),
                    )
    except Exception:
        log.exception("Gagal mengirim push notification ke user %s", user_id)


async def send_notif(user_id: str, title: str, message: str, type: str = "info", data: Optional[dict] = None):
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "data": data or {},
        "is_read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.notifications.insert_one(doc)
    asyncio.create_task(_send_expo_push(user_id, title, message, type, data))


async def send_email(to: str, subject: str, html: str) -> bool:
    """Kirim email transaksional via Brevo HTTP API, dengan sender terverifikasi
    pangkaskaka26@gmail.com. Pakai HTTP API (bukan SMTP mentah) karena Railway
    memblokir koneksi SMTP keluar (port 465/587) di level jaringan.
    No-op (log only) kalau BREVO_API_KEY belum diset."""
    if not BREVO_API_KEY:
        log.warning("BREVO_API_KEY belum diset, email ke %s tidak dikirim (subject: %s)", to, subject)
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": BREVO_API_KEY, "content-type": "application/json"},
                json={
                    "sender": {"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
                    "to": [{"email": to}],
                    "subject": subject,
                    "htmlContent": html,
                },
            )
            r.raise_for_status()
        return True
    except Exception:
        log.exception("Gagal mengirim email via Brevo ke %s", to)
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


async def compute_available_slots_barber(barber_id: str, karyawan_id: str, date_str: str, service_duration: int):
    """Sama seperti compute_available_slots, tapi untuk StreetBarber mandiri —
    jadwal dibaca dari karyawan_schedules/karyawan_schedule_overrides milik
    barber itu sendiri, bukan jam buka toko manapun."""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    override = await db.karyawan_schedule_overrides.find_one({"karyawan_id": karyawan_id, "date": date_str}, {"_id": 0})
    if override:
        if override.get("is_closed"):
            return []
        open_time, close_time = override["open_time"], override["close_time"]
    else:
        wd = d.weekday()  # Mon=0..Sun=6
        day_name = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][wd]
        sched = await db.karyawan_schedules.find_one({"karyawan_id": karyawan_id, "day_name": day_name}, {"_id": 0})
        if not sched or sched.get("is_closed"):
            return []
        open_time, close_time = sched["open_time"], sched["close_time"]
    all_slots = gen_time_slots(open_time, close_time, 30)
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
        overlap = any(not (s_end <= r[0] or s_min >= r[1]) for r in booked_ranges)
        past = is_today and (s_min <= now_wita.hour * 60 + now_wita.minute)
        result.append({"time": s, "available": (not overlap) and (not past)})
    return result


async def expire_stale_bookings():
    """Lazy cleanup: cancel unpaid pending bookings older than 15 min."""
    cutoff = (now_utc() - timedelta(minutes=15)).isoformat()
    query = {"payment_status": "unpaid", "status": "pending", "created_at": {"$lt": cutoff}}
    stale = await db.bookings.find(query, {"_id": 0, "id": 1, "user_id": 1}).to_list(200)
    if not stale:
        return
    await db.bookings.update_many(query, {"$set": {"status": "cancelled", "payment_status": "forfeited"}})
    for b in stale:
        await send_notif(
            b["user_id"],
            "Pembayaran kadaluarsa",
            "Booking Anda dibatalkan karena tidak dibayar dalam 15 menit. Silakan pesan ulang bila masih diperlukan.",
            "payment",
            {"booking_id": b["id"]},
        )


async def expire_stale_product_orders():
    """Mirror expire_stale_bookings untuk pesanan produk."""
    cutoff = (now_utc() - timedelta(minutes=15)).isoformat()
    query = {"payment_status": "unpaid", "status": "pending", "created_at": {"$lt": cutoff}}
    stale = await db.product_orders.find(query, {"_id": 0, "id": 1, "user_id": 1}).to_list(200)
    if not stale:
        return
    await db.product_orders.update_many(query, {"$set": {"status": "cancelled", "payment_status": "forfeited"}})
    for o in stale:
        await send_notif(
            o["user_id"],
            "Pembayaran kadaluarsa",
            "Pesanan produk Anda dibatalkan karena tidak dibayar dalam 15 menit. Silakan pesan ulang bila masih diperlukan.",
            "payment",
            {"product_order_id": o["id"]},
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
        "address": body.address or "",
        "lat": body.lat,
        "lng": body.lng,
        "photo": "",
        "created_at": now_utc().isoformat(),
    }
    await db.profiles.insert_one(profile)
    token = make_token(uid, body.role)
    return {"token": token, "user": clean(profile)}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    rate_limit(f"login:{request.client.host}", max_requests=5, window_seconds=300)
    user = await db.profiles.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Email atau password salah")
    if user.get("is_suspended"):
        raise HTTPException(403, "Akun Anda telah ditangguhkan. Hubungi admin PangkasKAKA untuk info lebih lanjut.")
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
    if "photo" in updates and updates["photo"]:
        updates["photo"] = await upload_to_r2(updates["photo"], f"users/{user['id']}/avatar")
    if updates:
        await db.profiles.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.profiles.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {"user": fresh}


@api.put("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(get_current_user)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password baru minimal 8 karakter")
    fresh = await db.profiles.find_one({"id": user["id"]}, {"_id": 0, "password": 1})
    if not fresh or not verify_pw(body.old_password, fresh["password"]):
        raise HTTPException(400, "Password lama salah")
    await db.profiles.update_one({"id": user["id"]}, {"$set": {"password": hash_pw(body.new_password)}})
    return {"ok": True}


# ============================================================
# PRODUCT CATALOG (CUSTOMER — publik)
# ============================================================
@api.get("/products/catalog")
async def products_catalog():
    products = await db.products.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
    shop_ids = list({p["shop_id"] for p in products if p.get("shop_id")})
    shops = await db.barbershops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(shop_ids)) if shop_ids else []
    shop_names = {s["id"]: s["name"] for s in shops}
    for p in products:
        p["shop_name"] = shop_names.get(p.get("shop_id"))
    return {"products": products}


@api.get("/products/{product_id}")
async def product_detail(product_id: str):
    product = await db.products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")
    shop = await db.barbershops.find_one({"id": product.get("shop_id")}, {"_id": 0, "name": 1, "address": 1})
    product["shop_name"] = (shop or {}).get("name", "")
    product["shop_address"] = (shop or {}).get("address", "")
    return product


@api.post("/product-orders")
async def create_product_order(body: ProductOrderIn, user=Depends(get_current_user)):
    if body.quantity < 1:
        raise HTTPException(400, "Kuantitas minimal 1")
    if body.fulfillment not in ("pickup", "delivery"):
        raise HTTPException(400, "Fulfillment tidak valid")
    if body.fulfillment == "delivery" and not body.address.strip():
        raise HTTPException(400, "Alamat pengantaran wajib diisi")

    product = await db.products.find_one({"id": body.product_id, "is_active": True}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produk tidak ditemukan")

    unit_price = product["price"]
    amount_product = unit_price * body.quantity
    amount_admin_fee = round(amount_product * PAYMENT_FEE_RATE_QRIS) + PAYMENT_FEE_FLAT
    amount_total_charged = amount_product + amount_admin_fee
    amount_platform_commission = round(amount_product * PLATFORM_COMMISSION_RATE)
    amount_shop_net = amount_product - amount_platform_commission

    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "product_id": product["id"],
        "shop_id": product.get("shop_id", ""),
        "product_name": product["name"],
        "product_image": product.get("image", ""),
        "unit_price": unit_price,
        "quantity": body.quantity,
        "amount_product": amount_product,
        "amount_admin_fee": amount_admin_fee,
        "amount_total_charged": amount_total_charged,
        "amount_platform_commission": amount_platform_commission,
        "amount_shop_net": amount_shop_net,
        "payout_wallet_type": "shop",
        "payout_wallet_owner_id": product.get("shop_id", ""),
        "fulfillment": body.fulfillment,
        "address": body.address if body.fulfillment == "delivery" else "",
        "lat": body.lat if body.fulfillment == "delivery" else None,
        "lng": body.lng if body.fulfillment == "delivery" else None,
        "status": "pending",
        "payment_status": "unpaid",
        "fund_state": "unpaid",
        "created_at": now_utc().isoformat(),
    }
    await db.product_orders.insert_one(doc)
    return {"order": clean(doc)}


@api.get("/product-orders")
async def list_my_product_orders(user=Depends(get_current_user)):
    orders = await db.product_orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"orders": orders}


@api.get("/product-orders/{order_id}")
async def get_my_product_order(order_id: str, user=Depends(get_current_user)):
    order = await db.product_orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    return order


# ============================================================
# BARBERSHOPS (CUSTOMER)
# ============================================================
@api.get("/shops")
async def list_shops(
    lat: Optional[float] = None, lng: Optional[float] = None, sort: str = "terdekat",
    min_rating: Optional[float] = None, max_price: Optional[float] = None,
    max_distance_km: Optional[float] = None, q: Optional[str] = None,
):
    await expire_stale_bookings()
    shops = await db.barbershops.find(
        {"is_verified": True, "verification_status": "approved"}, {"_id": 0}
    ).to_list(500)
    shop_ids = [s["id"] for s in shops]

    # Cheapest service price per shop (for numeric price sort/filter - price_range is
    # a free-text label like "Rp 25.000 - Rp 75.000" and can't be sorted/filtered on).
    min_price_by_shop: dict = {}
    if shop_ids:
        cursor = db.services.find({"shop_id": {"$in": shop_ids}}, {"_id": 0, "shop_id": 1, "price": 1})
        async for svc in cursor:
            cur = min_price_by_shop.get(svc["shop_id"])
            if cur is None or svc["price"] < cur:
                min_price_by_shop[svc["shop_id"]] = svc["price"]

    # Booking count per shop (for "terpopuler" sort).
    booking_count_by_shop: dict = {}
    if shop_ids:
        cursor = db.bookings.find(
            {"shop_id": {"$in": shop_ids}, "status": {"$in": ["confirmed", "completed"]}},
            {"_id": 0, "shop_id": 1},
        )
        async for bk in cursor:
            booking_count_by_shop[bk["shop_id"]] = booking_count_by_shop.get(bk["shop_id"], 0) + 1

    for s in shops:
        s["distance_km"] = haversine_km(lat, lng, s["latitude"], s["longitude"]) if (lat is not None and lng is not None) else None
        s["min_price"] = min_price_by_shop.get(s["id"])
        s["booking_count"] = booking_count_by_shop.get(s["id"], 0)

    if min_rating is not None:
        shops = [s for s in shops if s.get("rating", 0) >= min_rating]
    if max_price is not None:
        shops = [s for s in shops if s["min_price"] is None or s["min_price"] <= max_price]
    if max_distance_km is not None and lat is not None:
        shops = [s for s in shops if s["distance_km"] is not None and s["distance_km"] <= max_distance_km]
    if q:
        ql = q.lower()
        shops = [s for s in shops if ql in s["name"].lower() or ql in s.get("address", "").lower()]

    if sort == "terdekat" and lat is not None:
        shops.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 9999))
    elif sort == "rating":
        shops.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort == "harga":
        shops.sort(key=lambda x: (x["min_price"] if x["min_price"] is not None else 9_999_999))
    elif sort == "terpopuler":
        shops.sort(key=lambda x: x["booking_count"], reverse=True)
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
        distance_km = haversine_km(lat, lng, loc["lat"], loc["lng"])
        eta = eta_minutes(distance_km)
        # Batas layanan 30 menit perjalanan (README §3.3) — difilter di server, bukan di klien.
        if eta > MAX_ETA_MINUTES:
            continue
        shop = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1, "address": 1})
        result.append({
            **b,
            "lat": loc["lat"], "lng": loc["lng"], "updated_at": loc["updated_at"],
            "distance_km": distance_km,
            "eta_minutes": eta,
            "shop_name": shop["name"] if shop else "",
            "shop_address": shop["address"] if shop else "",
        })
    result.sort(key=lambda x: x["distance_km"])
    return {"barbers": result}


@api.get("/barbers/{barber_id}")
async def barber_profile(barber_id: str):
    """Profil booking mandiri StreetBarber — layanan & biaya ke rumah miliknya
    sendiri (bukan katalog toko validator). Dipakai app/(customer)/barber/[id].tsx."""
    barber = await db.barbers.find_one({"id": barber_id, "status": "active"}, {"_id": 0})
    if not barber or not barber.get("karyawan_id"):
        raise HTTPException(404, "StreetBarber tidak ditemukan")
    karyawan = await db.karyawan.find_one({"id": barber["karyawan_id"]}, {"_id": 0})
    shop = await db.barbershops.find_one({"id": barber["shop_id"]}, {"_id": 0, "name": 1})
    services = await db.streetbarber_services.find({"karyawan_id": barber["karyawan_id"]}, {"_id": 0}).to_list(200)
    barber["services"] = services
    barber["home_service_fee"] = (karyawan or {}).get("home_service_fee", 0)
    barber["shop_name"] = shop["name"] if shop else ""
    return barber


@api.get("/barbers/{barber_id}/slots")
async def get_barber_slots(barber_id: str, date: str, service_id: str):
    await expire_stale_bookings()
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0, "karyawan_id": 1})
    if not barber or not barber.get("karyawan_id"):
        raise HTTPException(404, "StreetBarber tidak ditemukan")
    svc = await db.streetbarber_services.find_one({"id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Layanan tidak ditemukan")
    slots = await compute_available_slots_barber(barber_id, barber["karyawan_id"], date, svc["duration"])
    return {"slots": slots}


@api.get("/shops/{shop_id}")
async def shop_detail(shop_id: str):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Barbershop tidak ditemukan")
    services = await db.services.find({"shop_id": shop_id}, {"_id": 0}).to_list(100)
    barbers = await db.barbers.find({"shop_id": shop_id, "status": "active"}, {"_id": 0}).to_list(100)
    for b in barbers:
        # StreetBarber = lulus jalur validasi (karyawan_id terisi); barber toko biasa ditambah langsung oleh owner
        b["is_street_barber"] = bool(b.get("karyawan_id"))
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
    barber = await db.barbers.find_one({"id": body.barber_id}, {"_id": 0})
    if not barber:
        raise HTTPException(404, "Barber tidak ditemukan")
    is_street_barber = bool(barber.get("karyawan_id"))
    if body.delivery_mode == "rumah" and not is_street_barber:
        raise HTTPException(400, "Barber ini hanya melayani di toko, bukan panggilan ke rumah")
    if body.delivery_mode == "toko" and is_street_barber:
        raise HTTPException(400, "StreetBarber ini hanya melayani panggilan ke rumah, bukan di toko")
    # StreetBarber punya katalog layanan & jadwal sendiri (mandiri dari toko validator);
    # barber toko biasa tetap pakai katalog & jadwal milik shop_id-nya.
    if is_street_barber:
        svc = await db.streetbarber_services.find_one({"id": body.service_id}, {"_id": 0})
    else:
        svc = await db.services.find_one({"id": body.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Layanan tidak ditemukan")
    if body.delivery_mode == "rumah" and (body.customer_lat is None or body.customer_lng is None):
        raise HTTPException(400, "Lokasi rumah wajib diisi untuk booking ke rumah")
    if body.delivery_mode == "rumah" and user.get("home_delivery_blocked"):
        raise HTTPException(403, "Kamu tidak bisa memesan jasa panggil ke rumah lagi karena pernah membatalkan booking kurang dari H-2 jam sebelum jadwal.")
    # re-validate slot
    if is_street_barber:
        slots = await compute_available_slots_barber(body.barber_id, barber["karyawan_id"], body.booking_date, svc["duration"])
    else:
        slots = await compute_available_slots(body.shop_id, body.barber_id, body.booking_date, svc["duration"])
    match = next((s for s in slots if s["time"] == body.booking_time), None)
    if not match or not match["available"]:
        raise HTTPException(409, "Slot baru saja dipesan orang lain, silakan pilih waktu lain")
    price = svc["price"]  # trust DB
    home_service_fee = 0
    eta_minutes_at_booking = None
    if body.delivery_mode == "rumah":
        karyawan = await db.karyawan.find_one({"id": barber["karyawan_id"]}, {"_id": 0, "home_service_fee": 1})
        home_service_fee = (karyawan or {}).get("home_service_fee", 0)
        price += home_service_fee
        # Batas layanan 30 menit perjalanan (README §3) — dicek juga di saat booking dibuat,
        # bukan cuma di pencarian /barbers/nearby, karena barber sudah dipilih spesifik di sini.
        loc = await db.karyawan_locations.find_one({"karyawan_id": barber["karyawan_id"]}, {"_id": 0})
        if not loc or not loc.get("is_online"):
            raise HTTPException(400, "StreetBarber ini sedang tidak online, tidak bisa menerima panggilan ke rumah")
        distance_km = haversine_km(body.customer_lat, body.customer_lng, loc["lat"], loc["lng"])
        eta_minutes_at_booking = eta_minutes(distance_km)
        if eta_minutes_at_booking > MAX_ETA_MINUTES:
            raise HTTPException(400, f"Lokasi Anda di luar jangkauan {MAX_ETA_MINUTES} menit perjalanan StreetBarber ini (perkiraan {eta_minutes_at_booking} menit)")
    # Rincian biaya — README §2.2: komisi dihitung dari harga layanan, BUKAN dari total yang
    # dibayar user (kalau dihitung dari total, platform ikut ambil komisi dari biaya admin).
    amount_service = price
    amount_admin_fee = round(amount_service * PAYMENT_FEE_RATE_QRIS) + PAYMENT_FEE_FLAT
    amount_total_charged = amount_service + amount_admin_fee
    amount_platform_commission = round(amount_service * PLATFORM_COMMISSION_RATE)
    amount_barber_net = amount_service - amount_platform_commission
    if body.delivery_mode == "rumah":
        payout_wallet_type, payout_wallet_owner_id = "karyawan", barber["karyawan_id"]
    else:
        payout_wallet_type, payout_wallet_owner_id = "shop", body.shop_id
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
        "delivery_mode": body.delivery_mode,
        "customer_address": body.customer_address,
        "home_service_fee": home_service_fee,
        "customer_lat": body.customer_lat,
        "customer_lng": body.customer_lng,
        "arrival_status": "unknown",
        "created_at": now_utc().isoformat(),
        # Alur transaksi (README_ALUR_TRANSAKSI.md)
        "fund_state": "unpaid",
        "amount_service": amount_service,
        "amount_admin_fee": amount_admin_fee,
        "amount_total_charged": amount_total_charged,
        "amount_platform_commission": amount_platform_commission,
        "amount_barber_net": amount_barber_net,
        "payout_wallet_type": payout_wallet_type,
        "payout_wallet_owner_id": payout_wallet_owner_id,
        "eta_minutes_at_booking": eta_minutes_at_booking,
        "released_at": None,
        "refunded_at": None,
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
        "amount": amount_total_charged, "method": "qris", "status": "pending",
        "created_at": now_utc().isoformat(),
    })
    return {"booking": clean(booking)}


@api.post("/bookings/{bid}/pay")
async def pay_booking(bid: str, user=Depends(get_current_user)):
    """Jalur manual/legacy (fallback simulasi di frontend) — dilewatkan lewat
    _mark_booking_paid yang sama dengan webhook/simulate, supaya Trigger 1 (dana ditahan)
    tetap jalan di jalur ini juga, bukan cuma di webhook Durianpay."""
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
    await _mark_booking_paid(b, provider_ref=f"MANUAL-{int(now_utc().timestamp())}", method="manual")
    return {"ok": True}


@api.get("/bookings/{bid}")
async def get_booking(bid: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Tidak ditemukan")
    if b["user_id"] != user["id"] and user["role"] != "superadmin":
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
    # Batal H-2 jam atau lebih: bebas, tanpa penalti. Batal kurang dari H-2 jam:
    # tetap boleh dibatalkan, tapi akun kena penalti — tidak bisa lagi order
    # jasa panggilan pangkas ke rumah (delivery_mode "rumah").
    dt = datetime.strptime(f"{b['booking_date']} {b['booking_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=WITA)
    late_cancel = dt < datetime.now(WITA) + timedelta(hours=2)
    if late_cancel:
        await db.profiles.update_one({"id": user["id"]}, {"$set": {"home_delivery_blocked": True}})

    async def _txn(session):
        await db.bookings.update_one({"id": bid}, {"$set": {"status": "cancelled"}}, session=session)
        # Dana ditahan sampai selesai (README §1.7) — pembatalan sebelum selesai selalu
        # refund 100%, tidak pernah menyentuh wallet pemangkas.
        await _refund_booking_if_held(b, session)

    async with await client.start_session() as session:
        await session.with_transaction(_txn)
    return {"ok": True, "penalty_applied": late_cancel}


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
    # Foto/dokumen datang sebagai base64 dari app — upload ke R2, simpan URL-nya saja.
    doc_ktp = await upload_to_r2(body.doc_ktp, f"shops/{sid}/docs")
    doc_nib = await upload_to_r2(body.doc_nib, f"shops/{sid}/docs")
    doc_npwp = await upload_to_r2(body.doc_npwp, f"shops/{sid}/docs")
    doc_surat_usaha = await upload_to_r2(body.doc_surat_usaha, f"shops/{sid}/docs")
    doc_toko = await upload_to_r2(body.doc_toko, f"shops/{sid}/docs")
    shop_image = await upload_to_r2(body.image, f"shops/{sid}")
    # Build per-doc status sub-doc
    def _doc(url):
        return {"url": url or "", "status": "pending" if url else "missing", "note": "", "reviewed_at": None, "reviewed_by": None}
    docs = {
        "ktp": _doc(doc_ktp),
        "nib": _doc(doc_nib),
        "npwp": _doc(doc_npwp),
        "surat_usaha": _doc(doc_surat_usaha),
        "toko": _doc(doc_toko),
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
        "image": shop_image,
        "rating": existing["rating"] if existing else 0.0,
        "reviews_count": existing["reviews_count"] if existing else 0,
        "is_verified": False,
        "verification_status": "pending",
        "verification_note": "",
        "bank_name": body.bank_name or "",
        "account_number": body.account_number or "",
        "account_holder": body.account_holder or "",
        "is_open": existing.get("is_open", True) if existing else True,
        "home_service_fee": existing.get("home_service_fee", 0) if existing else 0,
        # legacy flat fields kept for backwards compat
        "doc_ktp": doc_ktp,
        "doc_nib": doc_nib,
        "doc_npwp": doc_npwp,
        "doc_surat_usaha": doc_surat_usaha,
        "doc_toko": doc_toko,
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
    admins = await db.profiles.find({"role": "superadmin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Pengajuan Toko Baru", f"{body.name} menunggu verifikasi.", "system")
    return {"shop": clean(doc)}


async def _provision_owner_account(shop: dict) -> Optional[str]:
    """Kalau `shop` ini hasil pengajuan publik (belum punya owner_id — lihat
    submit_shop_application), buat akun Owner baru sekarang dan kembalikan password
    plaintext-nya (SEKALI pakai, tidak pernah disimpan mentah di mana pun). Kalau shop
    sudah punya owner (mis. edit/resubmit dokumen toko lama), tidak melakukan apa-apa
    dan mengembalikan None."""
    if shop.get("owner_id"):
        return None
    uid = new_id()
    password = _gen_password()
    profile = {
        "id": uid,
        "email": shop["applicant_email"],
        "password": hash_pw(password),
        "name": shop["applicant_name"],
        "phone": shop["applicant_phone"],
        "role": "owner",
        "address": "", "lat": None, "lng": None, "photo": "",
        "created_at": now_utc().isoformat(),
    }
    await db.profiles.insert_one(profile)
    await db.owners.insert_one({
        "id": uid, "name": shop["applicant_name"], "phone": shop["applicant_phone"],
        "email": shop["applicant_email"], "address": "",
    })
    await db.barbershops.update_one({"id": shop["id"]}, {"$set": {"owner_id": uid}})
    return password


@api.post("/shop-applications")
async def submit_shop_application(body: ShopApplicationIn, request: Request):
    """Pengajuan toko PUBLIK — tanpa autentikasi, tanpa akun. Akun Owner baru dibuat
    otomatis oleh sistem hanya saat pengajuan ini disetujui SuperAdmin (lihat
    _provision_owner_account, dipanggil dari admin_verify & admin_review_doc)."""
    rate_limit(f"shop-apply:{request.client.host}", max_requests=5, window_seconds=3600)
    if await db.profiles.find_one({"email": body.applicant_email.lower()}):
        raise HTTPException(400, "Email sudah terdaftar sebagai akun lain")
    sid = new_id()
    doc_ktp = await upload_to_r2(body.doc_ktp, f"shops/{sid}/docs")
    doc_nib = await upload_to_r2(body.doc_nib, f"shops/{sid}/docs")
    doc_npwp = await upload_to_r2(body.doc_npwp, f"shops/{sid}/docs")
    doc_surat_usaha = await upload_to_r2(body.doc_surat_usaha, f"shops/{sid}/docs")
    doc_toko = await upload_to_r2(body.doc_toko, f"shops/{sid}/docs")
    shop_image = await upload_to_r2(body.image, f"shops/{sid}")

    def _doc(url):
        return {"url": url or "", "status": "pending" if url else "missing", "note": "", "reviewed_at": None, "reviewed_by": None}
    docs = {
        "ktp": _doc(doc_ktp), "nib": _doc(doc_nib), "npwp": _doc(doc_npwp),
        "surat_usaha": _doc(doc_surat_usaha), "toko": _doc(doc_toko),
    }
    doc = {
        "id": sid,
        "owner_id": None,  # belum ada akun — diisi _provision_owner_account saat approve
        "applicant_name": body.applicant_name,
        "applicant_email": body.applicant_email.lower(),
        "applicant_phone": body.applicant_phone,
        "name": body.name,
        "category": body.category,
        "address": body.address,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "price_range": body.price_range,
        "image": shop_image,
        "rating": 0.0,
        "reviews_count": 0,
        "is_verified": False,
        "verification_status": "pending",
        "verification_note": "",
        "bank_name": body.bank_name or "",
        "account_number": body.account_number or "",
        "account_holder": body.account_holder or "",
        "is_open": True,
        "home_service_fee": 0,
        "doc_ktp": doc_ktp, "doc_nib": doc_nib, "doc_npwp": doc_npwp,
        "doc_surat_usaha": doc_surat_usaha, "doc_toko": doc_toko,
        "docs": docs,
        "revision_count": 0,
        "last_reviewed_by": None,
        "last_reviewed_at": None,
        "chat_closed": False,
        "docs_submitted_at": now_utc().isoformat(),
        "created_at": now_utc().isoformat(),
    }
    await db.barbershops.insert_one(doc)
    admins = await db.profiles.find({"role": "superadmin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Pengajuan Toko Baru", f"{body.name} (pengajuan baru) menunggu verifikasi.", "system")
    return {"ok": True, "shop_id": sid}


@api.put("/owner/shop/documents")
async def replace_document(body: DocReplaceIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    # size check: base64 length ~1.33x binary; 8MB = ~10.6M chars
    if body.file_base64 and len(body.file_base64) > 10_600_000:
        raise HTTPException(400, "Ukuran file melebihi 8MB")
    key = body.doc_key
    update_path = f"docs.{key}"
    file_url = await upload_to_r2(body.file_base64, f"shops/{shop['id']}/docs")
    docs = shop.get("docs", {})
    docs[key] = {"url": file_url, "status": "pending", "note": "", "reviewed_at": None, "reviewed_by": None}
    revision_count = shop.get("revision_count", 0) + 1
    # if shop was rejected, move back to pending
    new_verification_status = "pending" if shop.get("verification_status") == "rejected" else shop.get("verification_status", "pending")
    await db.barbershops.update_one(
        {"id": shop["id"]},
        {"$set": {
            f"doc_{key}": file_url,
            "docs": docs,
            "revision_count": revision_count,
            "verification_status": new_verification_status,
            "is_verified": False if new_verification_status != "approved" else shop.get("is_verified", False),
        }},
    )
    # notify admins
    admins = await db.profiles.find({"role": "superadmin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Revisi dokumen", f"{shop['name']} mengunggah ulang dokumen {key.upper()}.", "system")
    return {"ok": True, "revision_count": revision_count}


@api.post("/admin/shops/{shop_id}/documents/{doc_key}/review")
async def admin_review_doc(shop_id: str, doc_key: str, body: DocReviewIn, user=Depends(require_role("superadmin"))):
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
    owner_password = None
    if all_valid:
        updates.update({"is_verified": True, "verification_status": "approved", "verified_at": now_utc().isoformat(), "verification_note": ""})
        await db.barbershops.update_one({"id": shop_id}, {"$set": updates})
        # Pengajuan publik (belum punya akun) -> buat akun Owner sekarang. Toko lama yang
        # cuma resubmit dokumen sudah punya owner_id, jadi ini no-op untuk mereka.
        owner_password = await _provision_owner_account(shop)
        if shop.get("owner_id"):
            await send_notif(shop["owner_id"], "Toko disetujui!", "Semua dokumen valid. Toko Anda kini aktif.", "system")
    else:
        # keep verification_status pending; if any invalid, set rejected soft flag
        if any(docs.get(k, {}).get("status") == "invalid" for k in required):
            updates["verification_status"] = "rejected"
            updates["is_verified"] = False
        else:
            updates["verification_status"] = "pending"
        # Send per-doc notification — pengajuan publik belum punya akun untuk dinotifikasi
        if shop.get("owner_id"):
            if body.status == "invalid":
                await send_notif(shop["owner_id"], f"Dokumen {DOC_LABELS[doc_key]} ditolak", body.note or "Silakan hubungi admin.", "system")
            elif body.status == "needs_revision":
                await send_notif(shop["owner_id"], f"Perlu revisi: {DOC_LABELS[doc_key]}", body.note or "Silakan unggah ulang.", "system")
            elif body.status == "valid":
                await send_notif(shop["owner_id"], f"Dokumen {DOC_LABELS[doc_key]} valid ✓", "Menunggu dokumen lainnya diverifikasi.", "system")
        await db.barbershops.update_one({"id": shop_id}, {"$set": updates})
    resp = {"ok": True, "docs": docs, "all_valid": all_valid}
    if owner_password:
        resp["owner_password"] = owner_password
    return resp


def _parse_document_data_uri(value: str):
    """('data:image/jpeg;base64,...') -> (mime_type, raw_bytes), or None if not
    a usable image (missing, not a data URI, or a non-image MIME type — every
    document upload in this app is picker-restricted to images, never PDF)."""
    if not value or not value.startswith("data:"):
        return None
    try:
        header, b64data = value.split(",", 1)
        mime = header[len("data:"):].split(";")[0]
        if not mime.startswith("image/"):
            return None
        return mime, base64.b64decode(b64data)
    except Exception:
        return None


DOC_LABELS = {"ktp": "KTP", "nib": "NIB", "npwp": "NPWP", "surat_usaha": "Surat Izin Usaha", "toko": "Foto Toko"}

# Plain-language description of what a genuine version of each document type
# actually contains, so Gemini has something concrete to compare the upload
# against instead of guessing. This is prompt guidance, not training data —
# no document images are stored anywhere for this feature (see the endpoint
# below: the Gemini call result is returned straight to the admin and never
# written to the database).
DOC_AI_GUIDANCE = {
    "ktp": (
        "KTP (Kartu Tanda Penduduk) Indonesia asli punya: lambang Garuda di kiri atas, "
        "kop 'PROVINSI ...' dan 'KABUPATEN/KOTA ...', foto wajah pemegang di kanan, NIK "
        "16 digit angka, kolom Nama, Tempat/Tgl Lahir, Jenis Kelamin, Alamat, Agama, "
        "Status Perkawinan, Pekerjaan, Kewarganegaraan (WNI), Berlaku Hingga, dan tanda "
        "tangan/nama pejabat penerbit di kanan bawah."
    ),
    "nib": (
        "NIB (Nomor Induk Berusaha) asli adalah sertifikat elektronik dari sistem OSS "
        "(Online Single Submission) pemerintah — punya nomor NIB 13 digit, QR code, nama "
        "pelaku usaha, nama & alamat usaha, kode KBLI, dan kop resmi 'Lembaga OSS'."
    ),
    "npwp": (
        "NPWP (Nomor Pokok Wajib Pajak) asli — kartu atau surat dari Direktorat Jenderal "
        "Pajak, berisi nomor NPWP (format 15 atau 16 digit), nama Wajib Pajak, alamat "
        "terdaftar, dan nama Kantor Pelayanan Pajak (KPP) penerbit."
    ),
    "surat_usaha": (
        "Surat Izin Usaha asli biasanya surat resmi dengan kop instansi (kelurahan/"
        "kecamatan/dinas terkait), nomor surat, tanggal terbit, nama & alamat usaha, "
        "serta tanda tangan dan cap basah/stempel pejabat berwenang."
    ),
    "toko": (
        "Ini seharusnya foto asli tampak depan sebuah barbershop/pangkas rambut fisik — "
        "papan nama/signage, etalase atau pintu masuk toko yang nyata, bukan foto stok, "
        "gambar dari internet, atau lokasi yang tidak relevan (mis. rumah tanpa identitas "
        "usaha)."
    ),
}


@api.post("/admin/shops/{shop_id}/documents/{doc_key}/ai-review")
async def admin_ai_review_doc(shop_id: str, doc_key: str, user=Depends(require_role("superadmin"))):
    """Advisory-only: asks Gemini Vision to describe what it reads in the
    document and flag anything inconsistent with a genuine one, to help the
    admin's own review. Never decides valid/invalid itself, and never writes
    anything to the database — the result is returned once and forgotten,
    same as this call not happening if GEMINI_API_KEY isn't configured."""
    if doc_key not in DOC_LABELS:
        raise HTTPException(400, "Doc key tidak valid")
    if not _gemini_client:
        return {"available": False, "reason": "Fitur AI belum dikonfigurasi di server"}

    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")

    doc = shop.get("docs", {}).get(doc_key) or {}
    parsed = _parse_document_data_uri(doc.get("url", ""))
    if not parsed:
        return {"available": False, "reason": "Dokumen belum diunggah atau bukan format gambar yang bisa dianalisis"}
    mime_type, image_bytes = parsed

    owner = await db.profiles.find_one({"id": shop.get("owner_id")}, {"_id": 0, "name": 1})
    owner_name = (owner or {}).get("name") or "(tidak diketahui)"

    prompt = (
        f"Kamu membantu admin sebuah platform barbershop meninjau dokumen "
        f"'{DOC_LABELS[doc_key]}' yang diunggah pemilik toko bernama '{owner_name}' saat "
        f"mendaftarkan tokonya '{shop.get('name', '')}'.\n\n"
        f"Ciri dokumen {DOC_LABELS[doc_key]} asli: {DOC_AI_GUIDANCE[doc_key]}\n\n"
        "Lihat gambar terlampir dan berikan catatan singkat (maksimal 4 kalimat, Bahasa "
        "Indonesia, tanpa markdown) mencakup: apa yang terbaca di dokumen ini, apakah "
        "tampilannya konsisten dengan dokumen asli sejenis atau ada kejanggalan (buram, "
        "terpotong, jenis dokumen tidak cocok, tanda-tanda hasil edit/tempel), dan apakah "
        "nama/data yang terbaca cocok dengan nama pemilik toko di atas. Ini HANYA catatan "
        "bantuan untuk admin manusia — jangan menyatakan keputusan akhir valid atau "
        "tidak valid, admin yang memutuskan."
    )

    try:
        resp = await asyncio.wait_for(
            _gemini_client.aio.models.generate_content(
                model="gemini-flash-latest",
                contents=[prompt, _genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)],
            ),
            timeout=20.0,
        )
        notes = (getattr(resp, "text", "") or "").strip()
    except Exception:
        log.exception("Gemini document review call failed")
        return {"available": False, "reason": "Analisis AI gagal — lanjutkan review manual"}

    if not notes:
        return {"available": False, "reason": "AI tidak menghasilkan catatan — lanjutkan review manual"}

    return {"available": True, "doc_key": doc_key, "notes": notes}


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
        "fund_state": {"$ne": "refunded"},  # booking yang dibatalkan+refund tidak lagi dihitung pendapatan
        "delivery_mode": {"$ne": "rumah"},  # revenue StreetBarber (panggilan rumah) mandiri, bukan milik toko
        "created_at": {"$gte": month_start}
    }, {"_id": 0, "total_price": 1, "amount_barber_net": 1}).to_list(2000)
    revenue = sum(b.get("amount_barber_net", b["total_price"]) for b in paid_this_month)
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
    if new_status == "completed" and b.get("delivery_mode") == "rumah":
        raise HTTPException(400, "Booking panggilan ke rumah diselesaikan oleh StreetBarber sendiri, bukan owner")

    async def _txn(session):
        await db.bookings.update_one({"id": bid}, {"$set": {"status": new_status}}, session=session)
        if new_status == "completed":
            await _release_booking_funds(b, session)
        elif new_status == "cancelled":
            await _refund_booking_if_held(b, session)

    async with await client.start_session() as session:
        await session.with_transaction(_txn)
    await send_notif(b["user_id"], "Status pesanan berubah", f"Pesanan Anda kini: {new_status}", "booking")
    return {"ok": True}


@api.get("/owner/product-orders")
async def owner_product_orders(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        return {"orders": []}
    orders = await db.product_orders.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for o in orders:
        u = await db.profiles.find_one(
            {"id": o["user_id"]},
            {"_id": 0, "name": 1, "phone": 1, "email": 1, "photo": 1}
        )
        o["customer"] = u
    return {"orders": orders}


@api.post("/owner/product-orders/{oid}/status")
async def update_product_order_status(oid: str, payload: dict = Body(...), user=Depends(require_role("owner"))):
    new_status = payload.get("status")
    valid = {"confirmed": ["completed", "cancelled"]}
    o = await db.product_orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    shop = await db.barbershops.find_one({"id": o["shop_id"]}, {"_id": 0, "owner_id": 1})
    if not shop or shop["owner_id"] != user["id"]:
        raise HTTPException(403, "Bukan milik Anda")
    if new_status not in valid.get(o["status"], []):
        raise HTTPException(400, "Transisi status tidak valid")

    async def _txn(session):
        await db.product_orders.update_one({"id": oid}, {"$set": {"status": new_status}}, session=session)
        if new_status == "completed":
            await _release_product_order_funds(o, session)
        elif new_status == "cancelled":
            await _refund_product_order_if_held(o, session)

    async with await client.start_session() as session:
        await session.with_transaction(_txn)
    await send_notif(o["user_id"], "Status pesanan produk berubah", f"Pesanan produk Anda kini: {new_status}", "product_order")
    return {"ok": True}


@api.post("/owner/barbers")
async def add_barber(body: BarberIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    photo_url = await upload_to_r2(body.photo, f"shops/{shop['id']}/barbers")
    doc = {"id": new_id(), "shop_id": shop["id"], "karyawan_id": None,
           "name": body.name, "photo": photo_url, "specialization": body.specialization or "",
           "skill_level": body.skill_level, "rating": 0.0, "status": "active",
           "created_at": now_utc().isoformat()}
    await db.barbers.insert_one(doc)
    return {"barber": clean(doc)}


@api.put("/owner/barbers/{bid}")
async def update_barber(bid: str, body: BarberIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    photo_url = await upload_to_r2(body.photo, f"shops/{shop['id']}/barbers")
    r = await db.barbers.update_one(
        {"id": bid, "shop_id": shop["id"]},
        {"$set": {"name": body.name, "photo": photo_url, "specialization": body.specialization or "", "skill_level": body.skill_level}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Barber tidak ditemukan")
    return {"ok": True}


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


@api.put("/owner/services/{sid}")
async def update_service(sid: str, body: ServiceIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    r = await db.services.update_one(
        {"id": sid, "shop_id": shop["id"]},
        {"$set": {"name": body.name, "duration": body.duration, "price": body.price}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Layanan tidak ditemukan")
    return {"ok": True}


@api.delete("/owner/services/{sid}")
async def delete_service(sid: str, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    await db.services.delete_one({"id": sid, "shop_id": shop["id"]})
    return {"ok": True}


@api.get("/owner/products")
async def list_own_products(user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    products = await db.products.find({"shop_id": shop["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"products": products}


@api.post("/owner/products")
async def add_product(body: ProductIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    image = await upload_to_r2(body.photo, f"shops/{shop['id']}/products")
    doc = {
        "id": new_id(), "shop_id": shop["id"], "name": body.name, "price": body.price,
        "description": body.description, "image": image, "created_by": "owner",
        "is_active": True, "created_at": now_utc().isoformat(),
    }
    await db.products.insert_one(doc)
    return {"product": clean(doc)}


@api.put("/owner/products/{pid}")
async def update_product(pid: str, body: ProductIn, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    update = {"name": body.name, "price": body.price, "description": body.description}
    if body.photo:
        update["image"] = await upload_to_r2(body.photo, f"shops/{shop['id']}/products")
    r = await db.products.update_one({"id": pid, "shop_id": shop["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Produk tidak ditemukan")
    return {"ok": True}


@api.delete("/owner/products/{pid}")
async def delete_product(pid: str, user=Depends(require_role("owner"))):
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    await db.products.delete_one({"id": pid, "shop_id": shop["id"]})
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


@api.put("/owner/shop/home-service-fee")
async def set_home_service_fee(body: HomeServiceFeeIn, user=Depends(require_role("owner"))):
    """Biaya tambahan flat untuk booking mode 'barber ke rumah' — ditambahkan
    ke total_price saat booking dibuat dengan delivery_mode='rumah'."""
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    await db.barbershops.update_one({"id": shop["id"]}, {"$set": {"home_service_fee": body.fee}})
    return {"ok": True, "home_service_fee": body.fee}


@api.put("/owner/shop/image")
async def set_shop_image(body: ShopImageIn, user=Depends(require_role("owner"))):
    """Ganti foto banner toko tanpa memicu ulang proses verifikasi dokumen
    (berbeda dari re-submit lewat POST /owner/shop yang mereset verification_status)."""
    if not body.image:
        raise HTTPException(400, "Foto wajib diisi")
    if len(body.image) > 10_600_000:
        raise HTTPException(400, "Ukuran file melebihi 8MB")
    shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(400, "Daftarkan toko terlebih dulu")
    image_url = await upload_to_r2(body.image, f"shops/{shop['id']}")
    await db.barbershops.update_one({"id": shop["id"]}, {"$set": {"image": image_url}})
    return {"ok": True, "image": image_url}


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


@api.get("/shop-admin/karyawan")
async def admin_list_karyawan(user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    if not shop_ids:
        return {"karyawan": []}
    rows = await db.karyawan.find({"shop_id": {"$in": shop_ids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"karyawan": rows}


@api.post("/shop-admin/karyawan/{kid}/evaluate")
async def evaluate_karyawan(kid: str, body: EvaluateKaryawanIn, user=Depends(require_role("admin"))):
    k = await db.karyawan.find_one({"id": kid}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    if k["shop_id"] not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
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
            "id": new_id(), "shop_id": k["shop_id"], "karyawan_id": kid,
            "name": k["name"], "photo": k.get("diploma_photo") or k.get("tools_photo") or "",
            "specialization": "", "skill_level": skill, "rating": 0.0,
            "status": "active", "created_at": now_utc().isoformat(),
        })
        await send_notif(k["profile_id"], "Selamat! Anda resmi menjadi StreetBarber",
                         f"Skor tes: {total}/120. Level: {skill}. Anda sekarang bisa melayani panggilan pangkas rambut ke rumah secara mandiri.", "system")
    else:
        await send_notif(k["profile_id"], "Lamaran ditolak setelah tes",
                         f"Skor tes: {total}/120 (di bawah nilai minimum 60).", "system")
    return {"ok": True, "total_score": total, "status": status}


# ============================================================
# KARYAWAN
# ============================================================
@api.post("/karyawan/apply")
async def karyawan_apply(body: KaryawanApplyIn, user=Depends(require_role("streetbarber"))):
    # Validasi berkas WAJIB
    if not body.ktp_photo or len(body.ktp_photo) < 20:
        raise HTTPException(400, "Foto KTP wajib diunggah")
    if not body.work_experience or len(body.work_experience.strip()) < 20:
        raise HTTPException(400, "Pengalaman kerja wajib diisi minimal 20 karakter")
    if not body.criteria_agreed:
        raise HTTPException(400, "Anda harus menyetujui kriteria platform")

    existing = await db.karyawan.find_one({"profile_id": user["id"], "shop_id": body.shop_id})
    if existing:
        raise HTTPException(400, "Anda sudah melamar ke toko ini")

    folder = f"karyawan/{user['id']}"
    ktp_photo = await upload_to_r2(body.ktp_photo, folder)
    diploma_photo = await upload_to_r2(body.diploma_photo, folder)
    tools_photo = await upload_to_r2(body.tools_photo, folder)
    bnsp_cert = await upload_to_r2(body.bnsp_cert, folder)
    certificates = await upload_to_r2(body.certificates, folder)

    # Update juga profil karyawan dengan KTP (untuk akses admin)
    await db.profiles.update_one({"id": user["id"]}, {"$set": {"ktp_photo": ktp_photo}})

    doc = {
        "id": new_id(),
        "profile_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "shop_id": body.shop_id,
        # WAJIB
        "ktp_photo": ktp_photo,
        "diploma_photo": diploma_photo,
        "work_experience": body.work_experience,
        "criteria_agreed": True,
        # Opsional
        "portfolio_url": body.portfolio_url or "",
        "tools_photo": tools_photo,
        "bnsp_cert": bnsp_cert,
        "certificates": certificates,
        "total_score": 0, "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.karyawan.insert_one(doc)
    admins = await db.profiles.find({"role": "admin", "managed_shop_ids": body.shop_id}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await send_notif(a["id"], "Lamaran StreetBarber baru masuk",
                         f"{user['name']} melamar sebagai StreetBarber dan memilih toko yang Anda kelola sebagai validator dokumen & tes keterampilan.", "system")
    return {"application": clean(doc)}


@api.get("/karyawan/my")
async def karyawan_my(user=Depends(require_role("streetbarber"))):
    rows = await db.karyawan.find({"profile_id": user["id"]}, {"_id": 0}).to_list(50)
    for r in rows:
        s = await db.barbershops.find_one({"id": r["shop_id"]}, {"_id": 0, "name": 1, "image": 1})
        r["shop"] = s
    return {"applications": rows}


@api.get("/karyawan/earnings")
async def karyawan_earnings(user=Depends(require_role("streetbarber"))):
    """Pendapatan bulan ini dari booking yang sudah dibayar, untuk barber yang statusnya active."""
    apps = await db.karyawan.find({"profile_id": user["id"], "status": "active"}, {"_id": 0, "id": 1}).to_list(20)
    if not apps:
        return {"monthly_revenue": 0, "completed_count": 0}
    barbers = await db.barbers.find({"karyawan_id": {"$in": [a["id"] for a in apps]}}, {"_id": 0, "id": 1}).to_list(20)
    barber_ids = [b["id"] for b in barbers]
    if not barber_ids:
        return {"monthly_revenue": 0, "completed_count": 0}
    month_start = datetime.now(WITA).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    paid = await db.bookings.find(
        {"barber_id": {"$in": barber_ids}, "payment_status": "paid",
         "fund_state": {"$ne": "refunded"}, "created_at": {"$gte": month_start}},
        {"_id": 0, "total_price": 1, "amount_barber_net": 1},
    ).to_list(2000)
    return {"monthly_revenue": sum(b.get("amount_barber_net", b["total_price"]) for b in paid), "completed_count": len(paid)}


@api.post("/karyawan/location")
async def update_karyawan_location(body: KaryawanLocationIn, user=Depends(require_role("streetbarber"))):
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
async def karyawan_bookings(user=Depends(require_role("streetbarber"))):
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


@api.post("/karyawan/bookings/{bid}/complete")
async def karyawan_complete_booking(bid: str, user=Depends(require_role("streetbarber"))):
    """Trigger 2 untuk booking panggilan ke rumah — StreetBarber sendiri yang menekan
    'Selesai' (bukan owner), dana dilepas ke wallet karyawan itu sendiri, bukan wallet toko
    (README_ALUR_TRANSAKSI.md, keputusan pembagian trigger)."""
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if b.get("delivery_mode") != "rumah":
        raise HTTPException(400, "Booking di toko diselesaikan oleh owner, bukan di sini")
    barber = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0, "karyawan_id": 1})
    app_ = await db.karyawan.find_one({"id": (barber or {}).get("karyawan_id"), "profile_id": user["id"], "status": "active"}, {"_id": 0, "id": 1})
    if not app_:
        raise HTTPException(403, "Bukan booking Anda")
    if b["status"] != "confirmed":
        raise HTTPException(400, "Pesanan harus berstatus 'confirmed' sebelum bisa diselesaikan")

    async def _txn(session):
        await db.bookings.update_one({"id": bid}, {"$set": {"status": "completed"}}, session=session)
        await _release_booking_funds(b, session)

    async with await client.start_session() as session:
        await session.with_transaction(_txn)
    await send_notif(b["user_id"], "Layanan selesai", "Terima kasih! Booking Anda telah diselesaikan.", "booking")
    return {"ok": True}


async def _active_karyawan(user) -> dict:
    active = await db.karyawan.find_one({"profile_id": user["id"], "status": "active"}, {"_id": 0})
    if not active:
        raise HTTPException(400, "Anda belum menjadi StreetBarber aktif")
    return active


# ============================================================
# STREETBARBER — layanan, jadwal & rekening milik sendiri (mandiri dari toko validator)
# ============================================================
@api.get("/streetbarber/services")
async def list_own_streetbarber_services(user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    services = await db.streetbarber_services.find({"karyawan_id": active["id"]}, {"_id": 0}).to_list(200)
    return {"services": services}


@api.post("/streetbarber/services")
async def add_streetbarber_service(body: ServiceIn, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    doc = {"id": new_id(), "karyawan_id": active["id"], "name": body.name,
           "duration": body.duration, "price": body.price,
           "created_at": now_utc().isoformat()}
    await db.streetbarber_services.insert_one(doc)
    return {"service": clean(doc)}


@api.put("/streetbarber/services/{sid}")
async def update_streetbarber_service(sid: str, body: ServiceIn, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    r = await db.streetbarber_services.update_one(
        {"id": sid, "karyawan_id": active["id"]},
        {"$set": {"name": body.name, "duration": body.duration, "price": body.price}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Layanan tidak ditemukan")
    return {"ok": True}


@api.delete("/streetbarber/services/{sid}")
async def delete_streetbarber_service(sid: str, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    await db.streetbarber_services.delete_one({"id": sid, "karyawan_id": active["id"]})
    return {"ok": True}


@api.get("/streetbarber/schedules")
async def get_streetbarber_schedules(user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    schedules = await db.karyawan_schedules.find({"karyawan_id": active["id"]}, {"_id": 0}).to_list(20)
    return {"schedules": schedules}


@api.post("/streetbarber/schedules")
async def save_streetbarber_schedules(body: SaveSchedulesIn, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    for row in body.schedules:
        await db.karyawan_schedules.update_one(
            {"karyawan_id": active["id"], "day_name": row.day_name},
            {"$set": {"open_time": row.open_time, "close_time": row.close_time, "is_closed": row.is_closed,
                      "karyawan_id": active["id"], "day_name": row.day_name, "id": new_id()}},
            upsert=True,
        )
    return {"ok": True}


@api.get("/streetbarber/schedule-overrides")
async def list_streetbarber_schedule_overrides(user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    overrides = await db.karyawan_schedule_overrides.find({"karyawan_id": active["id"]}, {"_id": 0}).sort("date", 1).to_list(200)
    return {"overrides": overrides}


@api.post("/streetbarber/schedule-overrides")
async def upsert_streetbarber_schedule_override(body: ScheduleOverrideIn, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    try:
        datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Format tanggal harus YYYY-MM-DD")
    await db.karyawan_schedule_overrides.update_one(
        {"karyawan_id": active["id"], "date": body.date},
        {"$set": {
            "karyawan_id": active["id"], "date": body.date, "is_closed": body.is_closed,
            "open_time": body.open_time, "close_time": body.close_time, "note": body.note or "",
        }},
        upsert=True,
    )
    return {"ok": True}


@api.delete("/streetbarber/schedule-overrides/{date}")
async def delete_streetbarber_schedule_override(date: str, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    await db.karyawan_schedule_overrides.delete_one({"karyawan_id": active["id"], "date": date})
    return {"ok": True}


@api.put("/streetbarber/bank-account")
async def set_streetbarber_bank_account(body: BankAccountIn, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    await db.karyawan.update_one({"id": active["id"]}, {"$set": {
        "bank_name": body.bank_name, "bank_account_number": body.account_number,
        "bank_account_holder": body.account_holder,
    }})
    return {"ok": True}


@api.put("/streetbarber/home-service-fee")
async def set_streetbarber_home_service_fee(body: HomeServiceFeeIn, user=Depends(require_role("streetbarber"))):
    active = await _active_karyawan(user)
    await db.karyawan.update_one({"id": active["id"]}, {"$set": {"home_service_fee": body.fee}})
    return {"ok": True, "home_service_fee": body.fee}


# ============================================================
# WALLET / LEDGER — README_ALUR_TRANSAKSI.md §1.5
# ============================================================
async def _resolve_own_wallet(user: dict) -> dict:
    if user["role"] == "owner":
        shop = await db.barbershops.find_one({"owner_id": user["id"]}, {"_id": 0, "id": 1})
        if not shop:
            raise HTTPException(400, "Daftarkan toko terlebih dulu")
        return await get_or_create_wallet("shop", shop["id"])
    if user["role"] == "streetbarber":
        app_ = await db.karyawan.find_one({"profile_id": user["id"], "status": "active"}, {"_id": 0, "id": 1})
        if not app_:
            raise HTTPException(400, "Anda belum menjadi StreetBarber aktif di toko manapun")
        return await get_or_create_wallet("karyawan", app_["id"])
    raise HTTPException(403, "Hanya owner atau streetbarber yang punya wallet")


@api.get("/wallets/me")
async def wallet_me(user=Depends(require_role("owner", "streetbarber"))):
    w = await _resolve_own_wallet(user)
    return {"wallet": clean(w)}


@api.get("/wallets/me/ledger")
async def wallet_me_ledger(page: int = 1, size: int = 20, user=Depends(require_role("owner", "streetbarber"))):
    w = await _resolve_own_wallet(user)
    skip = max(0, (page - 1) * size)
    rows = await db.ledger_entries.find({"wallet_id": w["id"]}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(size).to_list(size)
    total = await db.ledger_entries.count_documents({"wallet_id": w["id"]})
    return {"entries": rows, "total": total, "page": page, "size": size}


@api.post("/payouts")
async def request_payout(user=Depends(require_role("owner", "streetbarber"))):
    """Prototipe: tidak ada transfer bank sungguhan (README — 'jangan pernah memproses uang
    nyata dengan kode ini'), cuma catatan pengajuan + saldo tersedia langsung dipotong."""
    w = await _resolve_own_wallet(user)
    if w["balance_available"] < MIN_PAYOUT_AMOUNT:
        formatted_min = f"{MIN_PAYOUT_AMOUNT:,}".replace(",", ".")
        formatted_bal = f"{w['balance_available']:,}".replace(",", ".")
        raise HTTPException(400, f"Saldo tersedia (Rp{formatted_bal}) di bawah minimum penarikan (Rp{formatted_min})")
    amount = w["balance_available"]
    payout_id = new_id()

    async def _txn(session):
        after = await _adjust_wallet(w["id"], 0, -amount, session)
        await db.payouts.insert_one({
            "id": payout_id, "wallet_id": w["id"], "amount": amount,
            "status": "requested",
            "created_at": now_utc().isoformat(),
        }, session=session)
        txn_id = new_id()
        await _ledger(session, w["id"], txn_id, payout_id, "debit", amount, "withdrawal",
                      after["balance_pending"] + after["balance_available"], "Pengajuan penarikan saldo")

    async with await client.start_session() as session:
        await session.with_transaction(_txn)
    return {"ok": True, "amount": amount, "payout_id": payout_id}


# ============================================================
# ADMIN
# ============================================================
@api.get("/admin/dashboard")
async def admin_dashboard(user=Depends(require_role("superadmin"))):
    total_shops = await db.barbershops.count_documents({})
    pending = await db.barbershops.count_documents({"verification_status": "pending"})
    customers = await db.profiles.count_documents({"role": "customer"})
    today = datetime.now(WITA).date().isoformat()
    paid_today = await db.bookings.find(
        {"payment_status": "paid", "fund_state": {"$ne": "refunded"}, "booking_date": today},
        {"_id": 0, "total_price": 1, "amount_platform_commission": 1},
    ).to_list(2000)
    revenue_today = sum(b["total_price"] for b in paid_today)
    # GMV (revenue_today di atas) != pendapatan platform sesungguhnya — itu total nilai
    # transaksi yang lewat, bukan yang jadi milik platform. Booking lama sebelum alur
    # wallet/ledger tidak punya field ini, fallback ke 0 (bukan ke total_price — beda arti).
    platform_revenue_today = sum(b.get("amount_platform_commission", 0) for b in paid_today)
    return {
        "stats": {
            "total_shops": total_shops,
            "pending_verifications": pending,
            "total_customers": customers,
            "revenue_today": revenue_today,
            "platform_revenue_today": platform_revenue_today,
        }
    }


@api.get("/admin/pending-shops")
async def admin_pending(user=Depends(require_role("superadmin"))):
    shops = await db.barbershops.find({"verification_status": "pending"}, {"_id": 0}).sort("docs_submitted_at", -1).to_list(200)
    for s in shops:
        if s.get("owner_id"):
            s["owner"] = await db.profiles.find_one({"id": s["owner_id"]}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        else:
            # Pengajuan publik belum punya akun — pakai data pemohon apa adanya.
            s["owner"] = {"name": s.get("applicant_name"), "email": s.get("applicant_email"), "phone": s.get("applicant_phone")}
    return {"shops": shops}


@api.post("/admin/shops/{shop_id}/verify")
async def admin_verify(shop_id: str, body: VerifyShopIn, user=Depends(require_role("superadmin"))):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    if body.decision == "approved":
        await db.barbershops.update_one({"id": shop_id}, {"$set": {
            "is_verified": True, "verification_status": "approved",
            "verified_at": now_utc().isoformat(), "verification_note": ""
        }})
        # Pengajuan publik (belum punya akun) -> buat akun Owner sekarang.
        owner_password = await _provision_owner_account(shop)
        if shop.get("owner_id"):
            await send_notif(shop["owner_id"], "Toko disetujui!", "Selamat, toko Anda telah lolos verifikasi.", "system")
        resp = {"ok": True}
        if owner_password:
            resp["owner_password"] = owner_password
        return resp
    else:
        if not body.note:
            raise HTTPException(400, "Alasan penolakan wajib diisi")
        await db.barbershops.update_one({"id": shop_id}, {"$set": {
            "is_verified": False, "verification_status": "rejected",
            "verification_note": body.note
        }})
        if shop.get("owner_id"):
            await send_notif(shop["owner_id"], "Toko ditolak", body.note, "system")
        return {"ok": True}


@api.post("/admin/shops/{shop_id}/suspend")
async def admin_suspend(shop_id: str, payload: dict = Body(...), user=Depends(require_role("superadmin"))):
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
async def admin_users(role: str = "customer", search: str = "", page: int = 1, size: int = 20, user=Depends(require_role("superadmin"))):
    q = {"role": role}
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    skip = (page - 1) * size
    total = await db.profiles.count_documents(q)
    rows = await db.profiles.find(q, {"_id": 0, "password": 0}).skip(skip).limit(size).to_list(size)
    return {"total": total, "users": rows}


@api.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, body: SuspendUserIn, user=Depends(require_role("superadmin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Tidak bisa menangguhkan akun sendiri")
    target = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if target["role"] == "superadmin":
        raise HTTPException(400, "Tidak bisa menangguhkan akun admin")
    await db.profiles.update_one({"id": user_id}, {"$set": {
        "is_suspended": True,
        "suspended_reason": body.reason or "",
        "suspended_at": now_utc().isoformat(),
        "suspended_by": user["id"],
    }})
    await send_notif(user_id, "Akun ditangguhkan", body.reason or "Akun Anda telah ditangguhkan oleh admin.", "system")
    return {"ok": True}


@api.post("/admin/users/{user_id}/activate")
async def admin_activate_user(user_id: str, user=Depends(require_role("superadmin"))):
    target = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    await db.profiles.update_one({"id": user_id}, {"$set": {
        "is_suspended": False, "suspended_reason": "", "suspended_at": None, "suspended_by": None,
    }})
    await send_notif(user_id, "Akun diaktifkan kembali", "Akun Anda telah diaktifkan kembali oleh admin.", "system")
    return {"ok": True}


@api.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, body: UpdateUserRoleIn, user=Depends(require_role("superadmin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Tidak bisa mengubah role akun sendiri")
    target = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    await db.profiles.update_one({"id": user_id}, {"$set": {"role": body.role}})
    await send_notif(user_id, "Role akun diperbarui", f"Role akun Anda diubah menjadi {body.role} oleh admin.", "system")
    return {"ok": True, "role": body.role}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user=Depends(require_role("superadmin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    target = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if target["role"] == "superadmin":
        raise HTTPException(400, "Tidak bisa menghapus akun admin")
    if target["role"] == "owner" and await db.barbershops.find_one({"owner_id": user_id}):
        raise HTTPException(400, "Pemilik ini masih punya toko terdaftar — hapus atau alihkan tokonya dulu sebelum menghapus akun")
    await db.profiles.delete_one({"id": user_id})
    if target["role"] == "streetbarber":
        karyawan_rows = await db.karyawan.find({"profile_id": user_id}, {"_id": 0, "id": 1}).to_list(50)
        karyawan_ids = [k["id"] for k in karyawan_rows]
        await db.karyawan.delete_many({"profile_id": user_id})
        if karyawan_ids:
            await db.karyawan_locations.delete_many({"karyawan_id": {"$in": karyawan_ids}})
    return {"ok": True}


@api.put("/admin/users/{user_id}/set-password")
async def admin_set_user_password(user_id: str, body: SetUserPasswordIn, user=Depends(require_role("superadmin"))):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password minimal 8 karakter")
    target = await db.profiles.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    await db.profiles.update_one({"id": user_id}, {"$set": {"password": hash_pw(body.new_password)}})
    await send_notif(user_id, "Password diubah admin", "Password akun Anda telah diatur ulang oleh admin.", "system")
    return {"ok": True}


# ============================================================
# SUPERADMIN — kelola akun Admin (mengelola sekumpulan StreetBarber per toko)
# ============================================================
@api.post("/superadmin/admins")
async def create_admin(body: CreateAdminIn, user=Depends(require_role("superadmin"))):
    if await db.profiles.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email sudah terdaftar")
    if body.managed_shop_ids:
        valid = await db.barbershops.count_documents({"id": {"$in": body.managed_shop_ids}})
        if valid != len(set(body.managed_shop_ids)):
            raise HTTPException(400, "Ada shop_id yang tidak valid")
    uid = new_id()
    password = _gen_password()
    profile = {
        "id": uid,
        "email": body.email.lower(),
        "password": hash_pw(password),
        "name": body.name,
        "phone": body.phone,
        "role": "admin",
        "managed_shop_ids": body.managed_shop_ids,
        "address": "", "lat": None, "lng": None, "photo": "",
        "created_at": now_utc().isoformat(),
        "created_by": user["id"],
    }
    await db.profiles.insert_one(profile)
    return {"admin": clean(profile), "password": password}


@api.get("/superadmin/admins")
async def list_admins(user=Depends(require_role("superadmin"))):
    rows = await db.profiles.find({"role": "admin"}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(200)
    shop_ids = {sid for r in rows for sid in r.get("managed_shop_ids", [])}
    shops = await db.barbershops.find({"id": {"$in": list(shop_ids)}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    shop_name = {s["id"]: s["name"] for s in shops}
    for r in rows:
        r["managed_shops"] = [{"id": sid, "name": shop_name.get(sid, "?")} for sid in r.get("managed_shop_ids", [])]
    return {"admins": rows}


@api.put("/superadmin/admins/{admin_id}")
async def update_admin_scope(admin_id: str, body: UpdateAdminScopeIn, user=Depends(require_role("superadmin"))):
    target = await db.profiles.find_one({"id": admin_id, "role": "admin"}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Admin tidak ditemukan")
    if body.managed_shop_ids:
        valid = await db.barbershops.count_documents({"id": {"$in": body.managed_shop_ids}})
        if valid != len(set(body.managed_shop_ids)):
            raise HTTPException(400, "Ada shop_id yang tidak valid")
    await db.profiles.update_one({"id": admin_id}, {"$set": {"managed_shop_ids": body.managed_shop_ids}})
    await send_notif(admin_id, "Cakupan toko diperbarui", "SuperAdmin memperbarui daftar toko yang Anda kelola.", "system")
    return {"ok": True}


@api.post("/superadmin/admins/{admin_id}/reset-password")
async def reset_admin_password(admin_id: str, user=Depends(require_role("superadmin"))):
    target = await db.profiles.find_one({"id": admin_id, "role": "admin"}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Admin tidak ditemukan")
    password = _gen_password()
    await db.profiles.update_one({"id": admin_id}, {"$set": {"password": hash_pw(password)}})
    return {"ok": True, "password": password}


@api.get("/admin/products")
async def list_admin_products(user=Depends(require_role("superadmin"))):
    products = await db.products.find({"created_by": "superadmin"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"products": products}


@api.post("/admin/products")
async def add_admin_product(body: ProductIn, user=Depends(require_role("superadmin"))):
    image = await upload_to_r2(body.photo, "admin/products")
    doc = {
        "id": new_id(), "shop_id": None, "name": body.name, "price": body.price,
        "description": body.description, "image": image, "created_by": "superadmin",
        "is_active": True, "created_at": now_utc().isoformat(),
    }
    await db.products.insert_one(doc)
    return {"product": clean(doc)}


@api.put("/admin/products/{pid}")
async def update_admin_product(pid: str, body: ProductIn, user=Depends(require_role("superadmin"))):
    update = {"name": body.name, "price": body.price, "description": body.description}
    if body.photo:
        update["image"] = await upload_to_r2(body.photo, "admin/products")
    r = await db.products.update_one({"id": pid, "created_by": "superadmin"}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Produk tidak ditemukan")
    return {"ok": True}


@api.delete("/admin/products/{pid}")
async def delete_admin_product(pid: str, user=Depends(require_role("superadmin"))):
    await db.products.delete_one({"id": pid, "created_by": "superadmin"})
    return {"ok": True}


@api.post("/admin/wallets/reconcile")
async def admin_reconcile_wallets(user=Depends(require_role("superadmin"))):
    """README §1.6 — jalankan sebelum demo: SUM(credit) - SUM(debit) per wallet harus sama
    dengan total saldo tersimpan (balance_pending + balance_available). Kalau tidak cocok,
    ada bug yang harus diselesaikan sebelum apa pun ditampilkan ke juri."""
    wallets = await db.wallets.find({}, {"_id": 0}).to_list(1000)
    mismatches = []
    for w in wallets:
        entries = await db.ledger_entries.find({"wallet_id": w["id"]}, {"_id": 0, "direction": 1, "amount": 1}).to_list(10000)
        ledger_sum = sum(e["amount"] if e["direction"] == "credit" else -e["amount"] for e in entries)
        stored_total = w["balance_pending"] + w["balance_available"]
        if ledger_sum != stored_total:
            mismatches.append({
                "wallet_id": w["id"], "owner_type": w["owner_type"], "owner_id": w["owner_id"],
                "ledger_sum": ledger_sum, "stored_total": stored_total, "diff": stored_total - ledger_sum,
            })
    return {"ok": len(mismatches) == 0, "checked": len(wallets), "mismatches": mismatches}


@api.post("/admin/bookings/{bid}/force-release")
async def admin_force_release(bid: str, user=Depends(require_role("superadmin"))):
    """Intervensi manual (README §4) — dipakai kalau auto-release belum sempat jalan atau
    ada sengketa yang perlu superadmin selesaikan segera."""
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Pesanan tidak ditemukan")

    async def _txn(session):
        await db.bookings.update_one({"id": bid}, {"$set": {"status": "completed"}}, session=session)
        released = await _release_booking_funds(b, session)
        return released

    async with await client.start_session() as session:
        released = await session.with_transaction(_txn)
    if not released:
        raise HTTPException(400, f"Tidak bisa dilepas — fund_state saat ini: {b.get('fund_state', 'unpaid')}")
    return {"ok": True}


@api.get("/admin/bookings/held")
async def admin_held_bookings(user=Depends(require_role("superadmin"))):
    """Daftar booking yang dananya masih tertahan di wallet platform (fund_state 'held'),
    paling lama dulu — tanpa ini admin tidak punya cara tahu booking mana yang perlu
    di-force-release (auto-release macet/sengketa, README §4)."""
    bookings = await db.bookings.find({"fund_state": "held"}, {"_id": 0}).sort(
        [("booking_date", 1), ("booking_time", 1)]
    ).to_list(500)
    now = datetime.now(WITA)
    for b in bookings:
        b["shop"] = await db.barbershops.find_one({"id": b["shop_id"]}, {"_id": 0, "name": 1})
        b["barber"] = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0, "name": 1})
        b["customer"] = await db.profiles.find_one({"id": b["user_id"]}, {"_id": 0, "name": 1})
        try:
            dt = datetime.strptime(f"{b['booking_date']} {b['booking_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=WITA)
            b["held_hours"] = round((now - dt).total_seconds() / 3600, 1)
        except Exception:
            b["held_hours"] = None
    return {"bookings": bookings}


async def _resolve_wallet_owner_name(wallet: dict) -> Optional[str]:
    if wallet["owner_type"] == "shop":
        shop = await db.barbershops.find_one({"id": wallet["owner_id"]}, {"_id": 0, "name": 1})
        return shop["name"] if shop else None
    if wallet["owner_type"] == "karyawan":
        app_ = await db.karyawan.find_one({"id": wallet["owner_id"]}, {"_id": 0, "profile_id": 1})
        if not app_:
            return None
        prof = await db.profiles.find_one({"id": app_["profile_id"]}, {"_id": 0, "name": 1})
        return prof["name"] if prof else None
    return None


@api.get("/admin/payouts")
async def admin_list_payouts(status: str = "requested", user=Depends(require_role("superadmin"))):
    """Antrian permintaan tarik saldo (README §1.5) — request_payout() cuma menyimpan status
    'requested' dan tidak pernah ada proses lanjutan otomatis, jadi ini satu-satunya cara admin
    tahu ada permintaan yang perlu ditransfer manual di luar sistem."""
    payouts = await db.payouts.find({"status": status}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for p in payouts:
        wallet = await db.wallets.find_one({"id": p["wallet_id"]}, {"_id": 0, "owner_type": 1, "owner_id": 1})
        p["owner_type"] = wallet["owner_type"] if wallet else None
        p["owner_id"] = wallet["owner_id"] if wallet else None
        p["owner_name"] = await _resolve_wallet_owner_name(wallet) if wallet else None
    return {"payouts": payouts}


@api.post("/admin/payouts/{payout_id}/mark-paid")
async def admin_mark_payout_paid(payout_id: str, user=Depends(require_role("superadmin"))):
    """BUKAN transfer bank sungguhan — cuma pencatatan bahwa admin sudah mentransfer dana ini
    secara manual di luar sistem. Saldo sudah dipotong dari wallet saat request_payout()
    dipanggil; endpoint ini cuma mengubah status jadi 'paid' untuk pembukuan."""
    p = await db.payouts.find_one({"id": payout_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Permintaan penarikan tidak ditemukan")
    if p["status"] != "requested":
        raise HTTPException(400, f"Status permintaan ini sudah '{p['status']}', bukan 'requested'")
    await db.payouts.update_one({"id": payout_id}, {"$set": {"status": "paid", "paid_at": now_utc().isoformat()}})
    return {"ok": True}


# ============================================================
# NOTIFICATIONS
# ============================================================
@api.post("/devices/push-token")
async def register_push_token(body: PushTokenIn, user=Depends(get_current_user)):
    await db.device_push_tokens.update_one(
        {"token": body.token},
        {"$set": {
            "user_id": user["id"],
            "platform": body.platform,
            "device_id": body.device_id,
            "is_active": True,
            "updated_at": now_utc().isoformat(),
        }, "$setOnInsert": {
            "id": new_id(),
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


@api.post("/devices/push-token/remove")
async def remove_push_token(body: PushTokenIn, user=Depends(get_current_user)):
    await db.device_push_tokens.update_one(
        {"token": body.token, "user_id": user["id"]},
        {"$set": {"is_active": False, "updated_at": now_utc().isoformat()}},
    )
    return {"ok": True}


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


# ---- Admin CRUD for the hairstyle catalog (used by the superadmin dashboard
# to expand AI Face Scan's recommendation data without redeploying a seed script) ----
@api.get("/admin/hairstyles")
async def admin_list_hairstyles(user=Depends(require_role("superadmin"))):
    rows = await db.hairstyles.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return {"hairstyles": rows}


@api.post("/admin/hairstyles")
async def admin_add_hairstyle(body: HairstyleIn, user=Depends(require_role("superadmin"))):
    doc = {
        "id": new_id(), "name": body.name, "image_url": body.image_url, "description": body.description,
        "suitable_shapes": list(body.match_score_map.keys()), "match_score_map": body.match_score_map,
        "created_at": now_utc().isoformat(),
    }
    await db.hairstyles.insert_one(doc)
    return {"hairstyle": clean(doc)}


@api.put("/admin/hairstyles/{hid}")
async def admin_update_hairstyle(hid: str, body: HairstyleIn, user=Depends(require_role("superadmin"))):
    r = await db.hairstyles.update_one(
        {"id": hid},
        {"$set": {
            "name": body.name, "image_url": body.image_url, "description": body.description,
            "suitable_shapes": list(body.match_score_map.keys()), "match_score_map": body.match_score_map,
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Gaya rambut tidak ditemukan")
    return {"ok": True}


@api.delete("/admin/hairstyles/{hid}")
async def admin_delete_hairstyle(hid: str, user=Depends(require_role("superadmin"))):
    await db.hairstyles.delete_one({"id": hid})
    return {"ok": True}


# ---- Admin CRUD for the face-shape reference dataset (measured jaw/cheekbone/
# forehead widths per shape, used to calibrate the on-device geometric classifier
# in frontend/src/lib/faceShape.ts). This is a reference/audit table, not a live
# lookup — editing it here does NOT change classification behavior by itself;
# recalibrating the client thresholds from an updated dataset is a separate
# manual step, exactly like it was done for the initial 30-row import. ----
@api.get("/admin/face-references")
async def admin_list_face_references(user=Depends(require_role("superadmin"))):
    rows = await db.face_references.find({}, {"_id": 0}).sort("reference_code", 1).to_list(1000)
    return {"references": rows}


@api.post("/admin/face-references")
async def admin_add_face_reference(body: FaceReferenceIn, user=Depends(require_role("superadmin"))):
    doc = {"id": new_id(), **body.dict(), "created_at": now_utc().isoformat()}
    await db.face_references.insert_one(doc)
    return {"reference": clean(doc)}


@api.put("/admin/face-references/{rid}")
async def admin_update_face_reference(rid: str, body: FaceReferenceIn, user=Depends(require_role("superadmin"))):
    r = await db.face_references.update_one({"id": rid}, {"$set": body.dict()})
    if r.matched_count == 0:
        raise HTTPException(404, "Data referensi tidak ditemukan")
    return {"ok": True}


@api.delete("/admin/face-references/{rid}")
async def admin_delete_face_reference(rid: str, user=Depends(require_role("superadmin"))):
    await db.face_references.delete_one({"id": rid})
    return {"ok": True}


# Face shape itself is computed on-device (see frontend/src/lib/faceShape.ts) from
# live camera landmarks — nothing here ever touches an image. Fallback sentences
# used when GEMINI_API_KEY isn't set or the call fails, so a result is never blocked.
FACE_SHAPE_FALLBACK_REASONING = {
    "oval": "Sepertinya wajahmu oval — proporsinya seimbang, cocok buat hampir semua model rambut.",
    "round": "Sepertinya wajahmu bulat — garis rahangnya lembut, cocok model dengan volume di atas.",
    "square": "Sepertinya wajahmu kotak — garis rahangnya tegas, potongan bertekstur bisa melunakkannya.",
    "oblong": "Sepertinya wajahmu oblong, lebih panjang dari lebar — cocok model dengan volume di samping.",
    "heart": "Sepertinya wajahmu hati — dahi lebih lebar dari dagu, cocok pakai poni atau model berlapis.",
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
            f"Sebuah algoritma geometris di perangkat memperkirakan bentuk wajah seseorang sebagai "
            f"'{shape}' (tingkat keyakinan {conf}%). Perkiraan ini TIDAK pasti akurat. Tulis SATU "
            "kalimat PENDEK dan SEDERHANA dalam Bahasa Indonesia (maksimal 15 kata, bahasa sehari-hari, "
            f"bukan bahasa formal panjang) yang menyebut 1 ciri khas bentuk wajah '{shape}' plus 1 saran "
            "singkat model rambut. Wajib mulai dengan 'Sepertinya wajahmu...' — JANGAN pakai frasa mutlak "
            "seperti 'wajah Anda adalah' atau 'terdeteksi sebagai', dan JANGAN bertele-tele. "
            "Tanpa markdown, tanpa tanda kutip."
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

    admin_id = await upsert_user("admin@pangkaskaka.id", "Admin PangkasKAKA", "081234567890", "superadmin", "Admin123!")
    owner_id = await upsert_user("owner@pangkaskaka.id", "Bapak Yosua", "081234567891", "owner", "Owner123!")
    customer_id = await upsert_user("customer@pangkaskaka.id", "Andi Cust", "081234567892", "customer", "Customer123!")
    karyawan_id = await upsert_user("karyawan@pangkaskaka.id", "Marchel Tuka", "081234567893", "streetbarber", "Karyawan123!")

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
            (admin_id, "superadmin", "Halo, saya sudah cek dokumen Anda. Foto NPWP terlihat sedikit buram.", "npwp"),
            (owner_id, "owner", "Terima kasih infonya. Saya akan foto ulang dan upload segera.", "npwp"),
            (admin_id, "superadmin", "Baik, ditunggu. Sementara dokumen KTP dan NIB sudah saya validasi ✓", ""),
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
async def do_seed(user=Depends(require_role("superadmin"))):
    if ENVIRONMENT == "production":
        raise HTTPException(403, "Seeding dinonaktifkan di production")
    await seed_all()
    return {"ok": True}


# ============================================================
# CHAT (Owner ↔ Admin, per-shop thread)
# ============================================================
async def _enrich_sender_names(msgs: list) -> None:
    """Isi m['sender_name'] untuk setiap pesan pakai satu query batch, bukan
    satu query find_one per pesan (N+1) — sebelumnya bikin polling chat makin
    lambat seiring makin panjang percakapan."""
    sender_ids = list({m["sender_id"] for m in msgs})
    if not sender_ids:
        return
    profiles = await db.profiles.find({"id": {"$in": sender_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(sender_ids))
    names = {p["id"]: p["name"] for p in profiles}
    for m in msgs:
        m["sender_name"] = names.get(m["sender_id"], "?")


async def _shop_access(shop_id: str, user: dict):
    shop = await db.barbershops.find_one({"id": shop_id}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Toko tidak ditemukan")
    if user["role"] == "superadmin":
        return shop
    if user["role"] == "owner" and shop["owner_id"] == user["id"]:
        return shop
    raise HTTPException(403, "Akses ditolak")


@api.get("/chat/threads")
async def list_threads(user=Depends(get_current_user)):
    if user["role"] == "superadmin":
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
    await _enrich_sender_names(msgs)
    return {"shop": {"id": shop["id"], "name": shop["name"], "image": shop.get("image", ""), "closed": shop.get("chat_closed", False)}, "messages": msgs}


@api.post("/chat/threads/{shop_id}/messages")
async def send_msg(shop_id: str, body: ChatSendIn, user=Depends(get_current_user)):
    shop = await _shop_access(shop_id, user)
    if shop.get("chat_closed"):
        raise HTTPException(400, "Percakapan telah ditutup")
    if not body.text and not body.attachment:
        raise HTTPException(400, "Pesan atau lampiran wajib diisi")
    if body.attachment and len(body.attachment) > 10_600_000:
        raise HTTPException(400, "Lampiran melebihi 8MB")
    attachment_url = await upload_to_r2(body.attachment, f"chat/shops/{shop_id}")
    msg = {
        "id": new_id(),
        "shop_id": shop_id,
        "sender_id": user["id"],
        "sender_role": user["role"],
        "text": body.text or "",
        "attachment": attachment_url,
        "doc_ref": body.doc_ref or "",
        "is_read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.chat_messages.insert_one(msg)
    # notify other side
    if user["role"] == "owner":
        admins = await db.profiles.find({"role": "superadmin"}, {"_id": 0, "id": 1}).to_list(50)
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
async def close_thread(shop_id: str, user=Depends(require_role("superadmin"))):
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
    """Returns the caller's role in the customer<->barber thread ('customer'/'streetbarber').
    Owner has their own separate thread (see _owner_chat_access) so they're not
    included here — keeps the two conversations from bleeding into each other."""
    if user["role"] == "customer" and booking["user_id"] == user["id"]:
        return "customer"
    if user["role"] == "streetbarber":
        barber_profile_id = await _resolve_barber_profile_id(booking["barber_id"])
        if barber_profile_id and barber_profile_id == user["id"]:
            return "streetbarber"
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
    await _enrich_sender_names(msgs)
    barber = await db.barbers.find_one({"id": booking["barber_id"]}, {"_id": 0, "name": 1, "photo": 1})
    customer = await db.profiles.find_one({"id": booking["user_id"]}, {"_id": 0, "name": 1, "photo": 1})
    return {"booking_id": bid, "barber": barber, "customer": customer, "messages": msgs}


@api.post("/bookings/{bid}/messages")
async def send_booking_message(bid: str, body: ServiceChatSendIn, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    role_in_thread = await _booking_chat_access(booking, user)
    if not body.text and not body.attachment:
        raise HTTPException(400, "Pesan atau lampiran wajib diisi")
    if body.attachment and len(body.attachment) > 10_600_000:
        raise HTTPException(400, "Lampiran melebihi 8MB")
    attachment_url = await upload_to_r2(body.attachment, f"chat/bookings/{bid}")
    msg = {
        "id": new_id(), "booking_id": bid, "sender_id": user["id"], "sender_role": user["role"],
        "text": body.text or "", "attachment": attachment_url,
        "is_read": False, "created_at": now_utc().isoformat(),
    }
    await db.service_messages.insert_one(msg)
    if role_in_thread == "customer":
        barber_profile_id = await _resolve_barber_profile_id(booking["barber_id"])
        if barber_profile_id:
            await send_notif(barber_profile_id, "Pesan baru dari pelanggan", body.text or "📎 Lampiran", "system")
    elif role_in_thread == "streetbarber":
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
    await _enrich_sender_names(msgs)
    shop = await db.barbershops.find_one({"id": booking["shop_id"]}, {"_id": 0, "name": 1, "image": 1})
    customer = await db.profiles.find_one({"id": booking["user_id"]}, {"_id": 0, "name": 1, "photo": 1})
    return {"booking_id": bid, "shop": shop, "customer": customer, "messages": msgs}


@api.post("/bookings/{bid}/owner-messages")
async def send_owner_message(bid: str, body: ServiceChatSendIn, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    role_in_thread = await _owner_chat_access(booking, user)
    if not body.text and not body.attachment:
        raise HTTPException(400, "Pesan atau lampiran wajib diisi")
    if body.attachment and len(body.attachment) > 10_600_000:
        raise HTTPException(400, "Lampiran melebihi 8MB")
    attachment_url = await upload_to_r2(body.attachment, f"chat/bookings/{bid}")
    msg = {
        "id": new_id(), "booking_id": bid, "sender_id": user["id"], "sender_role": user["role"],
        "text": body.text or "", "attachment": attachment_url,
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


# ============================================================
# UNIFIED MESSAGE LIST (Customer — "Messages" entry point on home screen)
# ============================================================
@api.get("/messages/threads")
async def list_message_threads(user=Depends(require_role("customer"))):
    bookings = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    shop_ids = list({b["shop_id"] for b in bookings})
    shops = (
        await db.barbershops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1, "image": 1}).to_list(len(shop_ids))
        if shop_ids else []
    )
    shop_map = {s["id"]: s for s in shops}
    barber_ids = list({b["barber_id"] for b in bookings if b.get("barber_id")})
    barbers = (
        await db.barbers.find({"id": {"$in": barber_ids}}, {"_id": 0, "id": 1, "name": 1, "photo": 1}).to_list(len(barber_ids))
        if barber_ids else []
    )
    barber_map = {b["id"]: b for b in barbers}

    threads = []
    total_unread = 0
    for b in bookings:
        shop = shop_map.get(b["shop_id"], {})
        barber = barber_map.get(b.get("barber_id"), {})

        last_b = await db.service_messages.find({"booking_id": b["id"]}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        unread_b = await db.service_messages.count_documents({"booking_id": b["id"], "sender_id": {"$ne": user["id"]}, "is_read": False})
        total_unread += unread_b
        threads.append({
            "type": "barber",
            "booking_id": b["id"],
            "title": barber.get("name") or "Barber",
            "subtitle": shop.get("name") or "",
            "image": barber.get("photo") or shop.get("image"),
            "booking_status": b["status"],
            "last_message": last_b[0] if last_b else None,
            "unread": unread_b,
            "updated_at": last_b[0]["created_at"] if last_b else b["created_at"],
        })

        last_o = await db.owner_messages.find({"booking_id": b["id"]}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        unread_o = await db.owner_messages.count_documents({"booking_id": b["id"], "sender_id": {"$ne": user["id"]}, "is_read": False})
        total_unread += unread_o
        threads.append({
            "type": "owner",
            "booking_id": b["id"],
            "title": shop.get("name") or "Toko",
            "subtitle": barber.get("name") or "",
            "image": shop.get("image"),
            "booking_status": b["status"],
            "last_message": last_o[0] if last_o else None,
            "unread": unread_o,
            "updated_at": last_o[0]["created_at"] if last_o else b["created_at"],
        })

    threads.sort(key=lambda t: t["updated_at"], reverse=True)
    return {"threads": threads, "total_unread": total_unread}


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
    paid_this_month = await db.bookings.find(
        {"shop_id": sid, "payment_status": "paid", "fund_state": {"$ne": "refunded"},
         "delivery_mode": {"$ne": "rumah"}, "created_at": {"$gte": month_start}},
        {"_id": 0, "total_price": 1, "amount_barber_net": 1},
    ).to_list(5000)
    monthly_revenue = sum(b.get("amount_barber_net", b["total_price"]) for b in paid_this_month)
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
        "monthly_revenue": monthly_revenue,
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
async def analytics_admin(user=Depends(require_role("superadmin"))):
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
    today_paid = await db.bookings.find(
        {"payment_status": "paid", "fund_state": {"$ne": "refunded"}, "booking_date": today},
        {"_id": 0, "total_price": 1, "amount_platform_commission": 1},
    ).to_list(5000)
    yst_paid = await db.bookings.find(
        {"payment_status": "paid", "fund_state": {"$ne": "refunded"}, "booking_date": yesterday},
        {"_id": 0, "total_price": 1, "amount_platform_commission": 1},
    ).to_list(5000)
    today_rev = sum(b["total_price"] for b in today_paid)
    yst_rev = sum(b["total_price"] for b in yst_paid)
    rev_growth = round(((today_rev - yst_rev) / yst_rev) * 100, 1) if yst_rev else (100.0 if today_rev else 0.0)
    # Pendapatan platform sesungguhnya (komisi) — beda dari GMV di atas. Booking lama tanpa
    # field ini fallback ke 0, bukan ke total_price (0 = "belum tercatat", bukan "GMV penuh").
    today_platform_rev = sum(b.get("amount_platform_commission", 0) for b in today_paid)
    yst_platform_rev = sum(b.get("amount_platform_commission", 0) for b in yst_paid)
    platform_rev_growth = (
        round(((today_platform_rev - yst_platform_rev) / yst_platform_rev) * 100, 1)
        if yst_platform_rev else (100.0 if today_platform_rev else 0.0)
    )

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
            "platform_revenue_today": today_platform_rev, "platform_revenue_growth_pct": platform_rev_growth,
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
        barber = await db.barbers.find_one({"id": b["barber_id"]}, {"_id": 0, "name": 1, "photo": 1, "karyawan_id": 1})
        b["barber"] = barber
        b["is_street_barber"] = bool(barber and barber.get("karyawan_id"))
        if b["is_street_barber"]:
            b["service"] = await db.streetbarber_services.find_one({"id": b["service_id"]}, {"_id": 0, "name": 1})
        else:
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

    # most recent completed booking, for a one-tap "pesan ulang" shortcut
    last_booking = None
    if completed:
        lb = sorted(completed, key=lambda x: x["created_at"], reverse=True)[0]
        shop = await db.barbershops.find_one({"id": lb["shop_id"]}, {"_id": 0, "name": 1, "image": 1})
        barber = await db.barbers.find_one({"id": lb["barber_id"]}, {"_id": 0, "name": 1, "photo": 1, "karyawan_id": 1})
        is_sb = bool(barber and barber.get("karyawan_id"))
        if is_sb:
            service = await db.streetbarber_services.find_one({"id": lb["service_id"]}, {"_id": 0, "name": 1})
        else:
            service = await db.services.find_one({"id": lb["service_id"]}, {"_id": 0, "name": 1})
        if shop and service:
            last_booking = {
                "shop_id": lb["shop_id"], "shop_name": shop["name"], "shop_image": shop["image"],
                "service_id": lb["service_id"], "service_name": service["name"],
                "barber_id": lb["barber_id"], "barber_name": (barber or {}).get("name"),
                "is_street_barber": is_sb,
            }

    return {
        "active_booking": active,
        "total_cuts_year": total_cuts_year,
        "fav_shop": fav_shop,
        "fav_barber": fav_barber,
        "last_booking": last_booking,
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


async def _durianpay_charge_qris(order_id: str, name: str, amount: str) -> tuple[Optional[dict], str]:
    """
    Charge a QRIS payment for an already-created order (POST /v1/payments/charge).
    Returns (data, debug_detail) - data has "qr_string" (base64 PNG data URI) /
    "qr_code" (raw EMV string) / "expiration_time" so the QR can be rendered
    natively in-app instead of only linking out to Durianpay's hosted checkout
    page. data is None on any failure - callers should fall back to the
    payment_link_url flow; debug_detail carries the reason for sandbox debugging.
    """
    headers = {"Authorization": _durianpay_basic_auth(), "Content-Type": "application/json"}
    payload = {"type": "QRIS", "request": {"order_id": order_id, "name": name, "amount": amount}}
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(f"{DURIANPAY_API_BASE}/payments/charge", json=payload, headers=headers)
    except (httpx.TimeoutException, httpx.RequestError) as e:
        log.error("Durianpay QRIS charge request failed: %s", e)
        return None, f"request failed: {e}"
    if r.status_code >= 400:
        log.error("Durianpay QRIS charge error %d: %s", r.status_code, r.text[:500])
        return None, f"{r.status_code} {r.text[:300]}"
    try:
        body = r.json()
        return body.get("data", body), ""
    except Exception as e:
        return None, f"bad response JSON: {e}"


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


async def _load_product_order_for_payment(order_id: str, user: dict) -> dict:
    """Mirror _load_booking_for_payment untuk pesanan produk."""
    o = await db.product_orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] != "pending" or o["payment_status"] != "unpaid":
        raise HTTPException(400, "Pesanan ini tidak lagi menunggu pembayaran")
    try:
        created = datetime.fromisoformat(o["created_at"])
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
    except Exception:
        created = now_utc()
    if (now_utc() - created).total_seconds() > 15 * 60:
        await db.product_orders.update_one(
            {"id": order_id},
            {"$set": {"status": "cancelled", "payment_status": "forfeited"}}
        )
        raise HTTPException(410, "Pembayaran kadaluarsa, silakan pesan ulang")
    return o


def _payment_fail_label(*hints: str) -> str:
    combined = " ".join(hints).lower()
    if "expired" in combined:
        return "kadaluarsa"
    if "cancel" in combined:
        return "dibatalkan"
    return "gagal"


async def _notify_payment_failed(user_id: str, booking_id: str, label: str):
    await send_notif(
        user_id,
        f"Pembayaran {label}",
        "Booking Anda dibatalkan karena pembayaran tidak berhasil. Silakan pesan ulang bila masih diperlukan.",
        "payment",
        {"booking_id": booking_id},
    )


async def _mark_booking_paid(booking: dict, provider_ref: str, method: str = "durianpay"):
    """Idempotent: update booking + payment, tahan dana ke wallet platform (Trigger 1 —
    README_ALUR_TRANSAKSI.md §1.5), kirim notifikasi. Skips if already paid."""
    bid = booking["id"]
    fresh = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if fresh and fresh.get("payment_status") == "paid":
        return False  # already processed

    async def _txn(session):
        await db.bookings.update_one(
            {"id": bid},
            {"$set": {"payment_status": "paid", "status": "confirmed",
                      "paid_at": now_utc().isoformat()}},
            session=session,
        )
        await db.payments.update_one(
            {"booking_id": bid},
            {"$set": {"status": "success", "method": method,
                      "provider_ref": provider_ref,
                      "paid_at": now_utc().isoformat()}},
            session=session,
        )
        # Booking lama (dari sebelum migrasi alur transaksi ini) tidak punya amount_service
        # dkk — biarkan saja, tidak ada dana yang perlu/bisa ditahan untuk booking semacam itu.
        if fresh and "amount_service" in fresh:
            await _hold_booking_funds(fresh, session)

    async with await client.start_session() as session:
        await session.with_transaction(_txn)

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


async def _mark_product_order_paid(order: dict, provider_ref: str, method: str = "durianpay"):
    """Mirror _mark_booking_paid untuk pesanan produk. Idempotent: skip bila sudah paid."""
    oid = order["id"]
    fresh = await db.product_orders.find_one({"id": oid}, {"_id": 0})
    if fresh and fresh.get("payment_status") == "paid":
        return False

    async def _txn(session):
        await db.product_orders.update_one(
            {"id": oid},
            {"$set": {"payment_status": "paid", "status": "confirmed",
                      "paid_at": now_utc().isoformat()}},
            session=session,
        )
        await db.payments.update_one(
            {"product_order_id": oid},
            {"$set": {"status": "success", "method": method,
                      "provider_ref": provider_ref,
                      "paid_at": now_utc().isoformat()}},
            session=session,
        )
        if fresh:
            await _hold_product_order_funds(fresh, session)

    async with await client.start_session() as session:
        await session.with_transaction(_txn)

    shop = await db.barbershops.find_one({"id": order["shop_id"]}, {"_id": 0})
    customer = await db.profiles.find_one({"id": order["user_id"]}, {"_id": 0, "name": 1})
    await send_notif(
        order["user_id"],
        "Pembayaran berhasil",
        f"Pembelian {order.get('product_name', 'produk')} telah dikonfirmasi.",
        "payment",
    )
    if shop:
        await send_notif(
            shop["owner_id"],
            "Pesanan produk baru masuk!",
            f"Pesanan produk baru masuk dari {customer['name'] if customer else 'customer'}.",
            "product_order",
        )
    return True


async def _durianpay_create_order(order_ref_id: str, customer_ref_id: str, amount: int,
                                   given_name: str, email: str, mobile: str, metadata: dict) -> dict:
    """Shared Durianpay order+QRIS creation, used by both booking payment (create_payment_link)
    and product-order payment (create_product_payment_link). Raises HTTPException on failure.
    Returns dict: payment_link_code, payment_link_url, transaction_id, qr_string, qr_code,
    qr_debug, expiry_date."""
    expiry_date = _expiry_rfc3339_wita(15)
    payload = {
        "amount": str(int(amount)),
        "currency": "IDR",
        "payment_option": "full_payment",
        "is_payment_link": True,
        "order_ref_id": order_ref_id,
        "expiry_date": expiry_date,
        "customer": {
            "customer_ref_id": customer_ref_id,
            "given_name": given_name,
            "email": email,
            "mobile": mobile,
        },
        "metadata": metadata,
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
    # Durianpay's sandbox API returns payment_link_url as an already-full URL, but
    # hardcoded to the production links.durianpay.id host regardless of which API
    # host was called - rewrite it to the sandbox link host so it doesn't 404.
    if PAYMENT_MODE == "sandbox" and full_url.startswith("https://links.durianpay.id/"):
        full_url = full_url.replace("https://links.durianpay.id/", "https://links-sandbox.durianpay.id/", 1)

    # Charge QRIS on top of the order so the QR can be rendered natively in-app
    # instead of only linking out to Durianpay's hosted page. Best-effort: the
    # payment link stays the fallback if this fails for any reason.
    qr_string, qr_code_raw, qr_debug = "", "", ""
    if dp_order_id:
        qr_data, qr_debug = await _durianpay_charge_qris(dp_order_id, "PangkasKAKA", payload["amount"])
        if qr_data:
            qr_string = qr_data.get("qr_string") or ""
            qr_code_raw = qr_data.get("qr_code") or ""

    return {
        "payment_link_code": code,
        "payment_link_url": full_url,
        "transaction_id": dp_order_id,
        "qr_string": qr_string,
        "qr_code": qr_code_raw,
        "qr_debug": qr_debug,
        "expiry_date": expiry_date,
    }


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

    # Reuse payment link jika masih valid (idempotent bila user klik ulang). Skip reuse
    # if it was generated against a different DURIANPAY_PAYMENT_LINK_BASE (e.g. host
    # config changed since) - a stale cached link would otherwise be served forever.
    existing_pay = await db.payments.find_one({"booking_id": booking_id}, {"_id": 0})
    if (existing_pay and existing_pay.get("payment_link_url")
            and existing_pay.get("status") == "pending"
            and existing_pay["payment_link_url"].startswith(DURIANPAY_PAYMENT_LINK_BASE)):
        return {
            "payment_link_url": existing_pay["payment_link_url"],
            "qr_string": existing_pay.get("qr_string") or "",
            "qr_code": existing_pay.get("qr_code") or "",
            "transaction_id": existing_pay.get("transaction_id"),
            "reused": True,
        }

    dp = await _durianpay_create_order(
        booking_id, user["id"], int(b.get("amount_total_charged", b["total_price"])),
        given_name, email, mobile,
        {
            "app": "pangkaskaka",
            "shop_id": b["shop_id"],
            "booking_date": b["booking_date"],
            "booking_time": b["booking_time"],
        },
    )

    # Simpan ke payments — transaction_id = Durianpay order id
    await db.payments.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "transaction_id": dp["transaction_id"],
            "payment_link_code": dp["payment_link_code"],
            "payment_link_url": dp["payment_link_url"],
            "qr_string": dp["qr_string"],
            "qr_code": dp["qr_code"],
            "qr_debug": dp["qr_debug"] if (PAYMENT_MODE == "sandbox" and not dp["qr_string"]) else "",
            "method": "durianpay",
            "status": "pending",
            "amount": int(b.get("amount_total_charged", b["total_price"])),
            "expires_at": dp["expiry_date"],
            "updated_at": now_utc().isoformat(),
        }, "$setOnInsert": {
            "id": new_id(),
            "booking_id": booking_id,
            "order_type": "booking",
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )

    resp = {
        "payment_link_url": dp["payment_link_url"],
        "qr_string": dp["qr_string"],
        "qr_code": dp["qr_code"],
        "transaction_id": dp["transaction_id"],
        "expires_at": dp["expiry_date"],
    }
    if PAYMENT_MODE == "sandbox" and not dp["qr_string"] and dp["qr_debug"]:
        resp["qr_sandbox_debug"] = dp["qr_debug"]
    return resp


@api.post("/payments/create-product/{order_id}")
async def create_product_payment_link(order_id: str, user=Depends(get_current_user)):
    """Mirror create_payment_link untuk pesanan produk."""
    if PAYMENT_MODE == "simulation":
        raise HTTPException(400, "Payment gateway sedang mode simulasi. Gunakan endpoint /payments/simulate-product/")
    if not DURIANPAY_API_KEY:
        log.error("DURIANPAY_API_KEY tidak dikonfigurasi")
        raise HTTPException(500, DURIANPAY_ERR_GENERIC)

    o = await _load_product_order_for_payment(order_id, user)

    profile = await db.profiles.find_one({"id": user["id"]}, {"_id": 0})
    given_name = (profile or {}).get("name") or "Customer"
    email = (profile or {}).get("email") or "noreply@pangkaskaka.id"
    mobile = (profile or {}).get("phone") or "0800000000"

    existing_pay = await db.payments.find_one({"product_order_id": order_id}, {"_id": 0})
    if (existing_pay and existing_pay.get("payment_link_url")
            and existing_pay.get("status") == "pending"
            and existing_pay["payment_link_url"].startswith(DURIANPAY_PAYMENT_LINK_BASE)):
        return {
            "payment_link_url": existing_pay["payment_link_url"],
            "qr_string": existing_pay.get("qr_string") or "",
            "qr_code": existing_pay.get("qr_code") or "",
            "transaction_id": existing_pay.get("transaction_id"),
            "reused": True,
        }

    dp = await _durianpay_create_order(
        order_id, user["id"], int(o["amount_total_charged"]),
        given_name, email, mobile,
        {
            "app": "pangkaskaka",
            "shop_id": o["shop_id"],
            "product_id": o["product_id"],
            "quantity": o["quantity"],
        },
    )

    await db.payments.update_one(
        {"product_order_id": order_id},
        {"$set": {
            "transaction_id": dp["transaction_id"],
            "payment_link_code": dp["payment_link_code"],
            "payment_link_url": dp["payment_link_url"],
            "qr_string": dp["qr_string"],
            "qr_code": dp["qr_code"],
            "qr_debug": dp["qr_debug"] if (PAYMENT_MODE == "sandbox" and not dp["qr_string"]) else "",
            "method": "durianpay",
            "status": "pending",
            "amount": int(o["amount_total_charged"]),
            "expires_at": dp["expiry_date"],
            "updated_at": now_utc().isoformat(),
        }, "$setOnInsert": {
            "id": new_id(),
            "product_order_id": order_id,
            "order_type": "product",
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )

    resp = {
        "payment_link_url": dp["payment_link_url"],
        "qr_string": dp["qr_string"],
        "qr_code": dp["qr_code"],
        "transaction_id": dp["transaction_id"],
        "expires_at": dp["expiry_date"],
    }
    if PAYMENT_MODE == "sandbox" and not dp["qr_string"] and dp["qr_debug"]:
        resp["qr_sandbox_debug"] = dp["qr_debug"]
    return resp


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
    product_order = None
    if order_ref_id:
        booking = await db.bookings.find_one({"id": order_ref_id}, {"_id": 0})
        if not booking:
            product_order = await db.product_orders.find_one({"id": order_ref_id}, {"_id": 0})
    if not booking and not product_order and order_id:
        # fallback: cari via payments.transaction_id
        p = await db.payments.find_one({"transaction_id": order_id}, {"_id": 0})
        if p and p.get("booking_id"):
            booking = await db.bookings.find_one({"id": p["booking_id"]}, {"_id": 0})
        elif p and p.get("product_order_id"):
            product_order = await db.product_orders.find_one({"id": p["product_order_id"]}, {"_id": 0})

    if not booking and not product_order:
        log_entry["status"] = "booking_not_found"
        await db.payment_webhooks.insert_one(log_entry)
        # Tetap balas 200 agar tidak retry
        return {"ok": True, "warning": "booking not found"}

    if booking:
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
            await _notify_payment_failed(booking["user_id"], booking["id"], _payment_fail_label(event, status))
        else:
            log_entry["status"] = "ignored"
    else:
        if is_success:
            await _mark_product_order_paid(product_order, provider_ref=order_id or "", method="durianpay")
            log_entry["status"] = "processed"
        elif is_failed:
            await db.product_orders.update_one(
                {"id": product_order["id"], "payment_status": {"$ne": "paid"}},
                {"$set": {"status": "cancelled", "payment_status": "forfeited"}}
            )
            await db.payments.update_one(
                {"product_order_id": product_order["id"]},
                {"$set": {"status": "failed", "last_event": event}}
            )
            log_entry["status"] = "processed"
            await _notify_payment_failed(product_order["user_id"], product_order["id"], _payment_fail_label(event, status))
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


@api.get("/payments/status-product/{order_id}")
async def product_payment_status(order_id: str, user=Depends(get_current_user)):
    """Mirror payment_status untuk pesanan produk."""
    await expire_stale_product_orders()
    o = await db.product_orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    p = await db.payments.find_one({"product_order_id": order_id}, {"_id": 0})
    shop = await db.barbershops.find_one({"id": o["shop_id"]}, {"_id": 0, "name": 1, "image": 1, "address": 1})

    try:
        created = datetime.fromisoformat(o["created_at"])
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
    except Exception:
        created = now_utc()
    expires_at = created + timedelta(minutes=15)
    remaining = max(0, int((expires_at - now_utc()).total_seconds()))

    return {
        "order": o,
        "payment": p,
        "shop": shop,
        "remaining_seconds": remaining,
        "payment_status": o.get("payment_status"),
        "order_status": o.get("status"),
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
        await _notify_payment_failed(user["id"], booking_id, _payment_fail_label(status))
        return {"ok": True, "paid": False, "status": status}
    return {"ok": True, "paid": False, "status": status or "pending"}


@api.post("/payments/fallback-check-product/{order_id}")
async def product_fallback_check(order_id: str, user=Depends(get_current_user)):
    """Mirror fallback_check untuk pesanan produk."""
    if PAYMENT_MODE == "simulation":
        raise HTTPException(400, "Payment mode adalah simulasi, tidak ada fallback ke Durianpay")

    o = await db.product_orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o.get("payment_status") == "paid":
        return {"ok": True, "already_paid": True}

    p = await db.payments.find_one({"product_order_id": order_id}, {"_id": 0})
    if not p or not p.get("transaction_id"):
        raise HTTPException(404, "Transaksi belum dibuat")

    dp_order_id = p["transaction_id"]
    headers = {"Authorization": _durianpay_basic_auth()}
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.get(f"{DURIANPAY_API_BASE}/orders/{dp_order_id}", headers=headers)
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
        await _mark_product_order_paid(o, provider_ref=dp_order_id, method="durianpay")
        return {"ok": True, "paid": True}
    if status in ("failed", "expired", "cancelled"):
        await db.product_orders.update_one(
            {"id": order_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "cancelled", "payment_status": "forfeited"}}
        )
        await _notify_payment_failed(user["id"], order_id, _payment_fail_label(status))
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


@api.post("/payments/simulate-product/{order_id}")
async def simulate_product_payment(order_id: str, user=Depends(get_current_user)):
    """Mirror simulate_payment untuk pesanan produk."""
    if PAYMENT_MODE != "simulation":
        raise HTTPException(403, "Endpoint simulasi hanya aktif pada PAYMENT_MODE=simulation")

    o = await _load_product_order_for_payment(order_id, user)
    processed = await _mark_product_order_paid(
        o, provider_ref=f"SIM-{int(now_utc().timestamp())}", method="simulation"
    )
    return {"ok": True, "simulated": True, "processed": processed}


# ---------- 6) PAYMENT HISTORY (customer) ----------
@api.get("/payments/history")
async def payment_history(user=Depends(get_current_user)):
    bookings = await db.bookings.find(
        {"user_id": user["id"], "payment_status": {"$in": ["paid", "forfeited"]}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    shop_ids = list({b["shop_id"] for b in bookings})
    shops = (
        await db.barbershops.find({"id": {"$in": shop_ids}}, {"_id": 0, "id": 1, "name": 1, "image": 1}).to_list(len(shop_ids))
        if shop_ids else []
    )
    shop_map = {s["id"]: s for s in shops}
    booking_ids = [b["id"] for b in bookings]
    payments = (
        await db.payments.find({"booking_id": {"$in": booking_ids}}, {"_id": 0}).to_list(len(booking_ids))
        if booking_ids else []
    )
    pay_map = {p["booking_id"]: p for p in payments}

    rows = []
    for b in bookings:
        p = pay_map.get(b["id"], {})
        shop = shop_map.get(b["shop_id"], {})
        rows.append({
            "booking_id": b["id"],
            "shop_name": shop.get("name", "Toko"),
            "shop_image": shop.get("image"),
            "amount": b.get("amount_total_charged", b.get("total_price", 0)),
            "status": "paid" if b["payment_status"] == "paid" else "failed",
            "method": p.get("method"),
            "paid_at": b.get("paid_at") or p.get("paid_at"),
            "booking_date": b.get("booking_date"),
            "created_at": b.get("created_at"),
        })
    return {"payments": rows}


# ---------- 7) PAYMENT MODE INFO (frontend detect mode) ----------
@api.get("/payments/mode")
async def payments_mode():
    """Return current payment mode so frontend knows which flow to use."""
    return {"mode": PAYMENT_MODE}


# ==================== END DURIANPAY ====================


# ==================== BULK SEED KUPANG BARBERSHOPS ====================
from kupang_seed_data import build_seed_records, DEFAULT_SERVICES, DEFAULT_SCHEDULE


@api.post("/seed/kupang-shops")
async def seed_kupang_shops(user=Depends(require_role("superadmin"))):
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
async def update_recruitment_criteria(body: UpdateCriteriaIn, user=Depends(require_role("superadmin"))):
    if not body.items or len(body.items) < 1:
        raise HTTPException(400, "Minimal 1 kriteria")
    await db.recruitment_criteria.update_one(
        {"id": "global"},
        {"$set": {"items": body.items, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True, "count": len(body.items)}


@api.post("/shop-admin/karyawan/{kid}/berkas-decision")
async def berkas_decision(kid: str, body: BerkasDecisionIn, user=Depends(require_role("admin"))):
    """
    Tahap 1: Admin (validator toko) memutuskan berkas pelamar lolos atau ditolak.
    - lolos → status seleksi_berkas_lolos (langsung siap koordinasi tes via chat)
    - tolak → status rejected dengan alasan
    """
    k = await db.karyawan.find_one({"id": kid}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    if k["shop_id"] not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    if k["status"] != "pending":
        raise HTTPException(400, f"Berkas pelamar sudah diproses (status: {k['status']})")

    if body.decision == "lolos":
        new_status = "seleksi_berkas_lolos"
        notif_title = "Berkas Anda LOLOS seleksi!"
        notif_msg = "Selamat! Berkas Anda diterima. Validator akan mengoordinasikan jadwal tes keterampilan via chat."
        # Otomatis pindah ke menunggu_tes (buka ruang chat)
        new_status = "menunggu_tes"
    else:
        new_status = "rejected"
        notif_title = "Lamaran Ditolak"
        notif_msg = (body.reason or "Mohon maaf, berkas Anda belum memenuhi persyaratan.") + " Anda bisa mengajukan lamaran StreetBarber baru kapan saja."

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
            "sender_role": "admin",
            "text": f"Selamat, berkas Anda lolos seleksi! Sebagai validator, kami akan menjadwalkan tes keterampilan StreetBarber Anda di sini. Kapan Anda bisa datang?",
            "is_read": False,
            "created_at": now_utc().isoformat(),
        })
    return {"ok": True, "status": new_status}


# ============================================================
# SHOP-ADMIN: PRODUK
# ============================================================

@api.get("/shop-admin/products")
async def admin_list_products(user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    if not shop_ids:
        return {"products": []}
    products = await db.products.find(
        {"shop_id": {"$in": shop_ids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    for p in products:
        p["image_url"] = p.pop("image", "")
    return {"products": products}


@api.post("/shop-admin/products")
async def admin_add_product(body: ShopAdminProductIn, user=Depends(require_role("admin"))):
    if body.shop_id not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    image = await upload_to_r2(body.image_url, f"shops/{body.shop_id}/products") if body.image_url else ""
    doc = {
        "id": new_id(), "shop_id": body.shop_id, "name": body.name,
        "price": body.price, "description": body.description,
        "category": body.category, "image": image, "stock": body.stock,
        "is_active": body.is_active, "created_by": "admin",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }
    await db.products.insert_one(doc)
    doc["image_url"] = doc.pop("image", "")
    return {"product": clean(doc)}


@api.put("/shop-admin/products/{pid}")
async def admin_update_product(pid: str, body: ShopAdminProductIn, user=Depends(require_role("admin"))):
    if body.shop_id not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    update = {
        "name": body.name, "price": body.price, "description": body.description,
        "category": body.category, "stock": body.stock, "is_active": body.is_active,
        "updated_at": now_utc().isoformat(),
    }
    if body.image_url:
        update["image"] = await upload_to_r2(body.image_url, f"shops/{body.shop_id}/products")
    r = await db.products.update_one({"id": pid, "shop_id": body.shop_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Produk tidak ditemukan")
    return {"ok": True}


@api.delete("/shop-admin/products/{pid}")
async def admin_delete_product(pid: str, user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    r = await db.products.delete_one({"id": pid, "shop_id": {"$in": shop_ids}})
    if r.deleted_count == 0:
        raise HTTPException(404, "Produk tidak ditemukan")
    return {"ok": True}


# ============================================================
# SHOP-ADMIN: LAYANAN
# ============================================================

@api.get("/shop-admin/services")
async def admin_list_services(user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    if not shop_ids:
        return {"services": []}
    services = await db.services.find(
        {"shop_id": {"$in": shop_ids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    for s in services:
        s["duration_minutes"] = s.pop("duration", 30)
        s.setdefault("is_active", True)
        s.setdefault("description", "")
        s.setdefault("updated_at", s.get("created_at", ""))
    return {"services": services}


@api.post("/shop-admin/services")
async def admin_add_service(body: ShopAdminServiceIn, user=Depends(require_role("admin"))):
    if body.shop_id not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    doc = {
        "id": new_id(), "shop_id": body.shop_id, "name": body.name,
        "price": body.price, "description": body.description,
        "duration": body.duration_minutes, "is_active": body.is_active,
        "created_by": "admin",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }
    await db.services.insert_one(doc)
    doc["duration_minutes"] = doc.pop("duration", 30)
    doc.setdefault("is_active", True)
    doc.setdefault("description", "")
    doc.setdefault("updated_at", doc.get("created_at", ""))
    return {"service": clean(doc)}


@api.put("/shop-admin/services/{sid}")
async def admin_update_service(sid: str, body: ShopAdminServiceIn, user=Depends(require_role("admin"))):
    if body.shop_id not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    update = {
        "name": body.name, "price": body.price, "description": body.description,
        "duration": body.duration_minutes, "is_active": body.is_active,
        "updated_at": now_utc().isoformat(),
    }
    r = await db.services.update_one({"id": sid, "shop_id": body.shop_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Layanan tidak ditemukan")
    return {"ok": True}


@api.delete("/shop-admin/services/{sid}")
async def admin_delete_service(sid: str, user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    r = await db.services.delete_one({"id": sid, "shop_id": {"$in": shop_ids}})
    if r.deleted_count == 0:
        raise HTTPException(404, "Layanan tidak ditemukan")
    return {"ok": True}


# ============================================================
# SHOP-ADMIN: KARYAWAN / BARBER
# ============================================================

class ShopAdminBarberIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    photo_url: str = ""
    specialization: str = ""
    is_active: bool = True
    shop_id: str


@api.get("/shop-admin/barbers")
async def admin_list_barbers(user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    if not shop_ids:
        return {"barbers": []}
    barbers = await db.barbers.find(
        {"shop_id": {"$in": shop_ids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    for b in barbers:
        b["is_active"] = b.get("status") == "active"
    return {"barbers": barbers}


@api.post("/shop-admin/barbers")
async def admin_add_barber(body: ShopAdminBarberIn, user=Depends(require_role("admin"))):
    if body.shop_id not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    photo = await upload_to_r2(body.photo_url, f"shops/{body.shop_id}/barbers") if body.photo_url else ""
    doc = {
        "id": new_id(), "shop_id": body.shop_id, "name": body.name,
        "phone": body.phone, "email": body.email, "photo": photo,
        "specialization": body.specialization,
        "status": "active" if body.is_active else "inactive",
        "skill_level": "Standar",
        "created_by": "admin",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }
    await db.barbers.insert_one(doc)
    doc["is_active"] = doc["status"] == "active"
    doc["photo_url"] = doc.pop("photo", "")
    return {"barber": clean(doc)}


@api.put("/shop-admin/barbers/{bid}")
async def admin_update_barber(bid: str, body: ShopAdminBarberIn, user=Depends(require_role("admin"))):
    if body.shop_id not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")
    photo = await upload_to_r2(body.photo_url, f"shops/{body.shop_id}/barbers") if body.photo_url else ""
    update = {
        "name": body.name, "phone": body.phone, "email": body.email,
        "specialization": body.specialization,
        "status": "active" if body.is_active else "inactive",
        "updated_at": now_utc().isoformat(),
    }
    if photo:
        update["photo"] = photo
    r = await db.barbers.update_one({"id": bid, "shop_id": body.shop_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    return {"ok": True}


@api.delete("/shop-admin/barbers/{bid}")
async def admin_delete_barber(bid: str, user=Depends(require_role("admin"))):
    shop_ids = user.get("managed_shop_ids", [])
    r = await db.barbers.delete_one({"id": bid, "shop_id": {"$in": shop_ids}})
    if r.deleted_count == 0:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    return {"ok": True}


# ============================================================
# SHOP-ADMIN: REVENUE / KEUANGAN (read-only)
# ============================================================

@api.get("/shop-admin/revenue")
async def admin_list_revenue(
    shop_id: str = "",
    type: str = "",
    start_date: str = "",
    end_date: str = "",
    user=Depends(require_role("admin")),
):
    shop_ids = user.get("managed_shop_ids", [])
    if not shop_ids:
        return {"transactions": []}

    query: dict = {"shop_id": {"$in": shop_ids}, "payment_status": "paid"}
    if shop_id:
        if shop_id not in shop_ids:
            raise HTTPException(403, "Bukan toko yang Anda kelola")
        query["shop_id"] = shop_id
    if start_date:
        query.setdefault("created_at", {})["$gte"] = start_date
    if end_date:
        query.setdefault("created_at", {})["$lte"] = end_date + "T23:59:59"

    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)

    transactions = []
    for b in bookings:
        tx_type = "income"
        amount = b.get("amount_barber_net", b.get("total_price", 0))
        service = await db.services.find_one({"id": b.get("service_id", "")}, {"_id": 0, "name": 1})
        transactions.append({
            "id": b["id"],
            "shop_id": b["shop_id"],
            "type": tx_type,
            "amount": amount,
            "description": f"Pemesanan {service['name'] if service else 'Layanan'}",
            "category": "Layanan",
            "recorded_by": b.get("barber_id", ""),
            "recorded_by_role": "streetbarber",
            "created_at": b.get("created_at", ""),
        })
    return {"transactions": transactions}


@api.get("/shop-admin/revenue/summary")
async def admin_revenue_summary(
    shop_id: str = "",
    start_date: str = "",
    end_date: str = "",
    user=Depends(require_role("admin")),
):
    shop_ids = user.get("managed_shop_ids", [])
    if not shop_ids:
        return {
            "shop_id": shop_id or "", "total_income": 0, "total_expense": 0,
            "net_profit": 0, "transaction_count": 0,
            "period_start": start_date or "", "period_end": end_date or "",
        }

    target_shop_ids = [shop_id] if shop_id and shop_id in shop_ids else shop_ids
    query: dict = {"shop_id": {"$in": target_shop_ids}, "payment_status": "paid"}
    if start_date:
        query.setdefault("created_at", {})["$gte"] = start_date
    if end_date:
        query.setdefault("created_at", {})["$lte"] = end_date + "T23:59:59"

    paid = await db.bookings.find(query, {"_id": 0, "total_price": 1, "amount_barber_net": 1}).to_list(5000)
    total_income = sum(b.get("amount_barber_net", b.get("total_price", 0)) for b in paid)

    return {
        "shop_id": shop_id or "",
        "total_income": total_income,
        "total_expense": 0,
        "net_profit": total_income,
        "transaction_count": len(paid),
        "period_start": start_date or "",
        "period_end": end_date or "",
    }


@api.get("/recruitment/{kid}/messages")
async def get_recruitment_messages(kid: str, user=Depends(get_current_user)):
    """
    Chat rekrutmen antara Admin (validator) & pelamar StreetBarber.
    Akses: Admin yang toko-nya tercantum di managed_shop_ids, atau pelamar itu sendiri.
    """
    k = await db.karyawan.find_one({"id": kid}, {"_id": 0})
    if not k:
        raise HTTPException(404, "Pelamar tidak ditemukan")
    # Akses check
    if user["role"] == "streetbarber":
        if k["profile_id"] != user["id"]:
            raise HTTPException(403, "Akses ditolak")
    elif user["role"] == "admin":
        if k["shop_id"] not in user.get("managed_shop_ids", []):
            raise HTTPException(403, "Bukan toko yang Anda kelola")
    elif user["role"] != "superadmin":
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
    if user["role"] == "streetbarber" and k["profile_id"] != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    if user["role"] == "admin" and k["shop_id"] not in user.get("managed_shop_ids", []):
        raise HTTPException(403, "Bukan toko yang Anda kelola")

    text = (body.text or "").strip()
    if not text and not body.attachment:
        raise HTTPException(400, "Pesan kosong")
    if body.attachment and len(body.attachment) > 10_600_000:
        raise HTTPException(400, "Lampiran melebihi 8MB")
    attachment_url = await upload_to_r2(body.attachment, f"chat/recruitment/{kid}")
    msg = {
        "id": new_id(),
        "karyawan_id": kid,
        "sender_id": user["id"],
        "sender_role": user["role"],
        "text": text,
        "attachment": attachment_url,
        "is_read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.recruitment_messages.insert_one(msg)

    # Notifikasi lawan bicara
    if user["role"] == "streetbarber":
        admin_acct = await db.profiles.find_one({"role": "admin", "managed_shop_ids": k["shop_id"]}, {"_id": 0, "id": 1})
        recipient_id = admin_acct["id"] if admin_acct else None
    else:
        recipient_id = k["profile_id"]
    if recipient_id:
        await send_notif(recipient_id, "Pesan Rekrutmen Baru",
                         f"{user['name']}: {body.text[:80]}", "system")
    msg.pop("_id", None)
    return {"message": msg}


@api.get("/karyawan/progress")
async def karyawan_progress(user=Depends(require_role("streetbarber"))):
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
    await db.streetbarber_services.create_index("karyawan_id")
    await db.karyawan_schedules.create_index([("karyawan_id", 1), ("day_name", 1)])
    await db.karyawan_schedule_overrides.create_index([("karyawan_id", 1), ("date", 1)], unique=True)
    await db.owner_messages.create_index("booking_id")
    await db.payments.create_index("booking_id")
    await db.notifications.create_index("user_id")
    await db.chat_messages.create_index("shop_id")
    await db.recruitment_messages.create_index("karyawan_id")
    await db.service_messages.create_index("booking_id")
    await db.password_resets.create_index([("email", 1), ("code", 1)])
    await db.device_push_tokens.create_index("token", unique=True)
    await db.device_push_tokens.create_index("user_id")
    await db.wallets.create_index([("owner_type", 1), ("owner_id", 1)], unique=True)
    await db.ledger_entries.create_index("idempotency_key", unique=True)
    await db.ledger_entries.create_index([("order_id", 1), ("created_at", 1)])
    await db.ledger_entries.create_index([("wallet_id", 1), ("created_at", -1)])
    await db.bookings.create_index("fund_state")
    await db.products.create_index([("is_active", 1), ("created_at", -1)])
    await db.products.create_index("shop_id")
    await db.services.create_index("shop_id")
    await db.product_orders.create_index("user_id")
    await db.product_orders.create_index("shop_id")
    await db.product_orders.create_index("payment_status")


async def _auto_release_loop():
    """Jaga-jaga kalau pemangkas lupa menekan 'Selesai' (README §4, open-question #4) —
    dana yang masih held lebih dari AUTO_RELEASE_HOURS sejak jadwal booking dilepas otomatis,
    supaya tidak tertahan selamanya di bucket platform."""
    while True:
        try:
            cutoff_utc = now_utc() - timedelta(hours=AUTO_RELEASE_HOURS)
            stuck = await db.bookings.find(
                {"fund_state": "held", "status": "confirmed"}, {"_id": 0}
            ).to_list(500)
            for b in stuck:
                try:
                    dt_wita = datetime.strptime(f"{b['booking_date']} {b['booking_time']}", "%Y-%m-%d %H:%M").replace(tzinfo=WITA)
                except Exception:
                    continue
                if dt_wita.astimezone(timezone.utc) >= cutoff_utc:
                    continue

                async def _txn(session, booking=b):
                    await db.bookings.update_one({"id": booking["id"]}, {"$set": {"status": "completed"}}, session=session)
                    await _release_booking_funds(booking, session)

                async with await client.start_session() as session:
                    await session.with_transaction(_txn)
                log.info("Auto-release dana untuk booking %s (held terlalu lama, jadwal sudah lewat)", b["id"])
        except Exception:
            log.exception("Auto-release loop gagal, coba lagi di siklus berikutnya")
        await asyncio.sleep(15 * 60)


@app.on_event("startup")
async def startup_seed():
    try:
        await ensure_indexes()
    except Exception as e:
        log.exception("Index creation on startup failed: %s", e)
    asyncio.create_task(_auto_release_loop())
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
