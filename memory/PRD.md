# PangkasKAKA — Product Requirements Document (PRD)

## Ringkasan
Aplikasi mobile on-demand barbershop untuk Kupang, NTT dengan 4 role: Customer, Owner, Karyawan (barber applicant), Admin. AI-powered face shape analysis untuk rekomendasi gaya rambut. **Design: Electric Blue + Dark Navy theme, Plus Jakarta Sans, cocok untuk Hackathon PIDI.id**.

## Stack
- **Frontend**: React Native (Expo SDK 54) + expo-router
- **Backend**: FastAPI (Python) + MongoDB (motor async)
- **Auth**: JWT + bcrypt
- **AI**: Gemini Vision (gemini-2.5-flash) via emergentintegrations LlmChat multimodal
- **Payment**: Mock QRIS (Durianpay deferred until credential ready)
- **Font**: Plus Jakarta Sans (Regular, Medium, SemiBold, Bold, ExtraBold) — di-bundle di /app/frontend/assets/fonts/

## Design System
- **Electric Blue** (#006FEE): brand, semua CTA, ikon aktif
- **Clean White & Light Gray** (#F9F9FA): background utama
- **Soft Container** (#F3F3F4): input & sub-card
- **Dark Navy** (#0A2540): header + tab bar untuk Owner & Admin (kesan profesional)
- Rounded corners 12-24px, subtle shadows, high contrast typography

## 4 Role & Flow Utama
1. **Customer** (tabs light blue accent): GPS discovery Haversine → AI Face Scan → 4-step booking (service→barber→slot→confirm) → QRIS mock → order tracking → review
2. **Owner** (navy sidebar): register + upload docs → dashboard stats + navy header → CRUD barber/service/schedule → orders state machine → evaluate karyawan (6 kriteria × 0-20)
3. **Karyawan** (navy header): apply ke toko + view status
4. **Admin** (navy Command Center): verifikasi dokumen KTP/NIB/NPWP/Surat Usaha → suspend toko + mass cancel → user management

## 4 Algoritma Inti
1. **Haversine** — jarak GPS user ↔ toko
2. **Greedy Slot Availability** — 30-min interval, anti-overlap, mask past slots (WITA)
3. **Weighted Bayesian Rating** — `WR = (v/(v+m))·R + (m/(v+m))·C`, m=10
4. **Karyawan Scoring** — sum 6 weights, ≥60 active + skill (≥85 Senior, ≥70 Standar, else Junior)

## Privacy — AI Face Scan
Foto DIKIRIM ke Gemini Vision, TIDAK DISIMPAN. Hanya hasil (face_shape, confidence, reasoning, recommendations) yang di-persist ke `ai_analysis` collection.

## Seed Data (Idempotent, on backend startup)
- 4 test users (customer, owner, admin, karyawan) — see `/app/memory/test_credentials.md`
- 4 approved barbershops di Kupang + 1 pending shop untuk demo verifikasi admin
- 12 hairstyles dengan suitable_shapes & match_score_map
- Barbers + services + 7-day schedules per shop

## Non-Goals (Deferred)
- Durianpay real gateway (mock only)
- Push notifications
- Realtime websocket (via focus-refetch)
- Reschedule UI trigger
