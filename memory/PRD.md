# PangkasKAKA — Product Requirements Document (PRD)

## Ringkasan
Aplikasi mobile on-demand barbershop untuk Kupang, NTT dengan 4 role: Customer, Owner, Karyawan (barber applicant), Admin. AI-powered face shape analysis untuk rekomendasi gaya rambut.

## Stack
- **Frontend**: React Native (Expo SDK 54) + expo-router file-based routing
- **Backend**: FastAPI (Python) + MongoDB (motor async driver)
- **Auth**: JWT (7-hari expiry) + bcrypt
- **AI**: Gemini Vision (gemini-2.5-flash) via emergentintegrations LlmChat multimodal
- **Payment**: Mock QRIS (countdown 15 menit, auto-flip status) — Durianpay integration deferred until credentials tersedia

## 4 Role & Flow Utama
1. **Customer**: GPS discovery (Haversine sort) → AI Face Scan → 4-step booking (service→barber→slot→confirm) → QRIS mock → order tracking → review
2. **Owner**: register shop + upload 4 docs → dashboard stats → CRUD barber/service/schedule → orders (transition state machine) → evaluate karyawan (6 kriteria × 0-20)
3. **Karyawan**: apply ke toko dengan portfolio + sertifikat → view status
4. **Admin**: verifikasi dokumen legal → suspend toko + mass cancel booking → user management

## 4 Algoritma Inti
1. **Haversine**: `haversine_km(lat1,lng1,lat2,lng2)` untuk sort terdekat
2. **Greedy Slot Availability**: 30-min interval, hindari overlap booking existing, mask past slots (WITA)
3. **Weighted Bayesian Rating**: `WR = (v/(v+m))·R + (m/(v+m))·C`, m=10
4. **Karyawan Scoring**: sum 6 weights (0-20 each), ≥60 active + skill (≥85 Senior, ≥70 Standar, else Junior), <60 rejected

## API Endpoints (semua di /api/*)
- `/auth/*` — register, login, me, profile
- `/shops` — list + detail + slots
- `/bookings` — CRUD + pay + cancel + review
- `/owner/*` — shop, dashboard, barbers, services, schedules, karyawan evaluation
- `/karyawan/apply|my`
- `/admin/*` — dashboard, pending-shops, verify, suspend, users
- `/ai/face-scan` — Gemini Vision (image_base64 → {faceShape, confidence, reasoning, recommendations})
- `/hairstyles`, `/notifications`

## Data & Seeding
Idempotent seed on startup:
- 4 role test users (see /app/memory/test_credentials.md)
- 4 approved barbershops di Kupang + 1 pending shop untuk demo verifikasi admin
- 12+ hairstyles dengan suitable_shapes & match_score_map
- Barbers + services + 7-day schedules untuk tiap shop

## Privacy — AI Face Scan
Foto DIKIRIM ke Gemini Vision untuk analisis, TIDAK DISIMPAN di DB — hanya hasil (face_shape, confidence, reasoning, recommended_styles) yang di-persist ke koleksi `ai_analysis`.

## Deployment
- Backend port 8001 (via supervisor)
- Expo Metro (frontend)
- MongoDB local
- EMERGENT_LLM_KEY di backend/.env (dilindungi, tidak pernah ke frontend)

## Non-Goals (Deferred)
- Realtime Supabase-style postgres_changes (di-simulate via focus-refetch)
- Durianpay real gateway integration (menunggu credential)
- Push notifications
- Multi-owner shop hierarchy
- Rescheduling flow (backend hooks ready, UI trigger belum)
