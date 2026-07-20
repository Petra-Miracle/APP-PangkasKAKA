# PangkasKAKA — Barbershop Booking Mobile App

Aplikasi mobile on-demand barbershop untuk Kupang, NTT. Dibangun dengan React Native (Expo) + FastAPI + MongoDB.

## Fitur Utama
- 4 role: Customer, Owner, Karyawan (barber), Admin
- GPS Discovery + Haversine distance sorting
- AI Face Shape Analysis via Gemini Vision (foto tidak disimpan, hanya hasil)
- 4-step Booking + QRIS mock dengan countdown 15 menit
- Weighted Bayesian Rating
- Owner: dashboard, CRUD barber/service, evaluasi karyawan (6 kriteria, 0-20)
- Admin: verifikasi dokumen KTP/NIB/NPWP, manajemen pengguna

## Setup
1. `pip install -r backend/requirements.txt`
2. Set env vars di `backend/.env` (MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY)
3. Set env vars di `frontend/.env` (EXPO_PUBLIC_BACKEND_URL)
4. Start backend: `sudo supervisorctl start backend`
5. Start expo: `sudo supervisorctl start expo`
6. Seed berjalan otomatis saat startup backend

## Kredensial demo
Lihat `/app/memory/test_credentials.md`
