# 💳 Integrasi Pembayaran Durianpay — PangkasKAKA

Dokumentasi lengkap alur pembayaran booking menggunakan **Durianpay Payment Link API** untuk aplikasi **PangkasKAKA**.

---

## 🎯 Ringkasan Arsitektur

```
┌──────────────┐   1. POST /payments/create/{booking_id}   ┌──────────────┐
│ Expo Client  │ ─────────────────────────────────────────▶│  FastAPI     │
│ (Mobile/Web) │                                            │  Backend     │
└──────────────┘ ◀─────────────────────────────────────────└──────┬───────┘
       │            2. { payment_link_url }                        │
       │                                                            │
       │ 3. Buka payment_link_url via Linking.openURL              │
       ▼                                                            │
┌─────────────────────────┐                                         │
│ links.durianpay.id/...  │ 4. User bayar (QRIS/VA/dll)             │
└────────────┬────────────┘                                         │
             │                                                      │
             │ 5. Webhook POST /api/payments/webhook/durianpay      │
             └─────────────────────────────────────────────────────▶│
                                                                    │
                       6. Update booking → paid + confirmed         │
                       7. Notifikasi ke customer & owner            │
```

---

## 🔧 Mode Pembayaran (`PAYMENT_MODE`)

Backend mendukung 3 mode via env `PAYMENT_MODE`:

| Mode | Deskripsi | Endpoint Aktif |
|------|-----------|----------------|
| `simulation` | Mock lokal, tidak panggil Durianpay. **Untuk demo tanpa internet.** | `/api/payments/simulate/{booking_id}` |
| `sandbox` | Durianpay sandbox (`dp_test_xxxxx`). Untuk development & testing. | `/api/payments/create/{booking_id}` |
| `production` | Durianpay production (`dp_live_xxxxx`). Untuk go-live. **GANTI KEY SAAT GO-LIVE!** | `/api/payments/create/{booking_id}` |

> Endpoint simulasi **otomatis nonaktif** ketika `PAYMENT_MODE=sandbox` atau `production`.

---

## 🚀 Cara Setup

### 1) Dapatkan API Key Durianpay
1. Daftar di https://durianpay.id/
2. Dashboard → **Settings → API Keys**
3. Copy **Sandbox Key** (`dp_test_xxxxx`) untuk development
4. Copy **Public Key** (RSA-2048) untuk verifikasi webhook dari **Settings → Webhook**

### 2) Isi `.env` di `backend/`
```env
PAYMENT_MODE=sandbox
DURIANPAY_API_KEY=dp_test_xxxxxxxxxxxxxxxxx
DURIANPAY_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----"
```

> **Penting**: Gunakan `\n` (bukan baris baru literal) di dalam string PEM.

### 3) Restart backend
```bash
sudo supervisorctl restart backend
```

---

## 📮 Daftarkan Webhook di Dashboard Durianpay

1. Login ke Dashboard Durianpay
2. **Settings → Webhook → Add Webhook**
3. Isi URL: `https://<domain-kamu>/api/payments/webhook/durianpay`
4. Pilih events (minimal):
   - `payment.completed` ✅
   - `order.completed` ✅
   - `payment.failed`
   - `payment.expired`
   - `payment.cancelled`
5. Set sebagai **Primary Webhook** (wajib, Durianpay hanya kirim webhook untuk primary)
6. Klik **Test Webhook** — endpoint kita harus merespons **200 OK**

> ⚠️ Bila endpoint tidak balas 200 OK, Durianpay akan retry di menit **2, 5, 10, 90, 210**.

---

## 🔐 Keamanan Webhook (RSA-2048)

Durianpay mengirim header:
- `X-SIGNATURE` — base64(RSA-SHA256(string_to_sign))
- `X-TIMESTAMP` — epoch timestamp

`string_to_sign` = `POST:/api/payments/webhook/durianpay:sha256_hex(raw_body):timestamp`

Backend memverifikasi dengan `cryptography.hazmat.primitives.asymmetric.padding.PKCS1v15`. Signature invalid → **401 Unauthorized**.

> Fallback: bila `DURIANPAY_PUBLIC_KEY_PEM` kosong tapi `DURIANPAY_WEBHOOK_SECRET` diisi, digunakan HMAC-SHA256 dengan `hmac.compare_digest` (timing-safe).

---

## 🧪 Simulasi Test Payment (Sandbox)

### A. Via aplikasi (rekomendasi)
1. Login sebagai customer di aplikasi
2. Pilih shop → layanan → barber → slot → **Bayar Sekarang**
3. Backend akan panggil Durianpay → return `payment_link_url`
4. App otomatis membuka link di browser eksternal
5. Di halaman Durianpay sandbox, pilih metode pembayaran & selesaikan
6. Kembali ke app → screen status akan polling & menampilkan **PEMBAYARAN BERHASIL** setelah webhook masuk

### B. Via curl (test webhook manual, TANPA verifikasi signature — hanya bila `PAYMENT_MODE=simulation`)
```bash
# Dapatkan token customer
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@pangkaskaka.id","password":"Customer123!"}' | jq -r .token)

# Buat booking (dari flow shop detail)
# Lalu simulasi sukses:
curl -X POST http://localhost:8001/api/payments/simulate/<BOOKING_ID> \
  -H "Authorization: Bearer $TOKEN"
```

### C. Simulasi webhook Durianpay (sandbox)
Di Durianpay Dashboard: **Settings → Webhook → History → Resend** pada event tertentu, atau gunakan tombol **Test Webhook**.

---

## 🔍 Debugging

### Cek log webhook masuk
```javascript
// Mongo shell / Compass
db.payment_webhooks.find().sort({received_at: -1}).limit(10)
```

Field penting:
- `status`: `received` | `invalid_signature` | `processed` | `duplicate` | `booking_not_found`
- `raw_body`: payload asli dari Durianpay
- `event`, `order_ref_id`: extracted info

### Fallback Status Check
Bila webhook tidak masuk dalam 2 menit, frontend otomatis panggil:
```
POST /api/payments/fallback-check/{booking_id}
```
Endpoint ini akan GET langsung ke Durianpay `/v1/orders/{order_id}` dan sinkronkan status.

---

## 🎬 Alur Frontend (React Native / Expo)

1. User klik **BAYAR SEKARANG** di step 4 booking
2. Frontend cek `GET /api/payments/mode`:
   - `simulation` → tampilkan modal QRIS mock, panggil `/payments/simulate/{id}`
   - `sandbox` / `production` → panggil `/payments/create/{id}` → `Linking.openURL(payment_link_url)`
3. Setelah panggil `create`, redirect ke `/payment/status/[bookingId]`
4. Screen status polling `GET /api/payments/status/{id}` tiap **5 detik**
5. Status akhir:
   - `paid` + `confirmed` → animasi sukses, tombol **Lihat Pesanan**
   - `unpaid` + countdown < 15 menit → tombol **Buka Link Pembayaran Lagi**
   - `forfeited` / `cancelled` → tombol **Booking Ulang**

---

## 🔄 Go-Live Checklist (Production)

- [ ] Ganti `PAYMENT_MODE=production`
- [ ] Ganti `DURIANPAY_API_KEY` ke `dp_live_xxxxx`
- [ ] Ganti `DURIANPAY_PUBLIC_KEY_PEM` ke Public Key production
- [ ] Pastikan URL webhook HTTPS (bukan HTTP)
- [ ] Test end-to-end 1x dengan nominal kecil
- [ ] Monitor `payment_webhooks` collection untuk error
- [ ] Setup alerting bila banyak `invalid_signature` atau `booking_not_found`

---

## ❓ Troubleshooting

| Problem | Solusi |
|---------|--------|
| `Invalid webhook signature` | Cek `DURIANPAY_PUBLIC_KEY_PEM` sudah diisi & format `\n` benar |
| `payment_link_url` kosong | Cek response Durianpay, biasanya `amount` tidak string atau `customer.given_name` kosong |
| Booking tetap `unpaid` setelah bayar | Cek dashboard Durianpay: webhook delivered? Kalau tidak, cek URL & pastikan primary |
| `502 Gagal membuat link pembayaran` | Cek `DURIANPAY_API_KEY` benar, cek log backend untuk detail error |
| Endpoint `/simulate/` return 403 | `PAYMENT_MODE` bukan `simulation`. Ubah env & restart backend |

---

Dibuat: Juni 2026 — PangkasKAKA Development Team
