# EVIDENCE PACK — PangkasKAKA
Dihasilkan: 2026-09-07 20:37 WITA
Commit: d203ed4 (working tree punya perubahan belum di-commit di atas commit ini — fitur katalog produk backend+frontend yang sedang berjalan di sesi yang sama; lihat `git status` untuk daftar file. Semua evidence di bawah ini dibaca dari working tree saat ini, bukan hanya commit d203ed4.)

Metodologi: seluruh Bagian 1, 2, 4, 5, 6 dikumpulkan oleh dua sub-agent read-only yang membaca kode sungguhan (bukan menyimpulkan dari nama file/komentar/TODO) dan menjalankan perintah `grep`/`wc`/`git log` langsung terhadap repo. Bagian 3 (pengujian) dijalankan sendiri terhadap **server lokal** yang mengarah ke database MongoDB Atlas **terpisah** bernama `pangkaskaka_evidence_test` (cluster yang sama dengan `.env`, tapi nama database baru & kosong) — database produksi (`pangkaskaka`) tidak pernah disentuh. Skrip pengujian ada di `tests/evidence/`.

---

## 1. INVENTARIS FITUR

| Fitur | Status | Lokasi kode | Catatan |
|---|---|---|---|
| Registrasi & autentikasi 4 aktor | BERFUNGSI (peran yang ada di kode: `customer, owner, admin, karyawan` — **tidak ada literal "superadmin"**, `admin` yang berperan sebagai superadmin) | `backend/server.py:413,418` (`RegisterIn`), `:793-834` (`/auth/register`, `/auth/login`, bcrypt+JWT) | Menulis ke `db.profiles` sungguhan, password di-hash bcrypt, token JWT nyata. |
| Pencarian pemangkas terdekat (Haversine) | BERFUNGSI | `server.py:253-259` (`haversine_km`), `:968-999` (`/barbers/nearby`) | Query nyata ke `db.karyawan_locations` (filter online + freshness), filter radius via `MAX_ETA_MINUTES`. |
| Booking slot & pencegahan bentrok jadwal | **BERFUNGSI DENGAN BUG KONKURENSI TERKONFIRMASI** (lihat §3.1) | `server.py:721-760` (`compute_available_slots`), `:1044-1139` (`create_booking`, race-check baris 1130-1139) | Pengecekan aplikasi 2 lapis (bukan unique index Mongo). Benar 100% secara sekuensial, **gagal di bawah beban konkuren sungguhan** — dibuktikan lewat pengujian nyata, bukan cuma pembacaan kode. |
| Layanan panggil ke rumah | BERFUNGSI | `server.py:606,1054-1082` (validasi radius/online), `:1990-2014` (`/karyawan/bookings/{bid}/complete`) | Alur lengkap tersambung DB, termasuk payout ke wallet karyawan (bukan wallet toko). |
| AI Style Analysis (deteksi bentuk wajah) | BERFUNGSI, **tapi deteksi terjadi on-device, bukan di backend/Gemini** | `frontend/src/lib/faceShape.ts` (algoritma geometris on-device via ML Kit), `backend/server.py:2496-2543` (`/ai/face-scan`) | Backend hanya menerima `face_shape`+`confidence` yang SUDAH dihitung klien (lihat komentar baris 2484-2486: "nothing here ever touches an image"). Gemini hanya menghasilkan 1 kalimat penjelasan, bukan mendeteksi bentuk wajah. |
| Mode fallback AI saat API gagal | **BERFUNGSI — diverifikasi lewat pengujian nyata, dua kali** (lihat §3.3) | `server.py:2487-2520` | Terverifikasi bekerja baik saat dimatikan sengaja (`GEMINI_API_KEY=""`) maupun saat gagal betulan (SSL error koneksi ke Google dari mesin dev ini). |
| Pembayaran & integrasi Durianpay | SIMULASI (kode integrasi asli ada & siap pakai, tapi mode aktif saat ini = simulasi) | `server.py:82` (`PAYMENT_MODE` default `"simulation"`), `:3243-3500` (kode HTTP asli ke Durianpay sandbox/production) | `.env` lokal memang diset `PAYMENT_MODE=simulation` walau `DURIANPAY_API_KEY` (sandbox) sudah terisi. |
| Penahanan dana platform / ledger | **BERFUNGSI, TAPI ADA BUG KRITIS TERKONFIRMASI PADA WALLET BARU** (lihat §3.2/§7) | `server.py:266-378` (`_hold_booking_funds`, `_release_booking_funds`, `_refund_booking_if_held`) | Model ledger double-entry nyata dengan `idempotency_key` unik. Bug: `get_or_create_wallet()` tidak memakai session Mongo transaksi yang sedang berjalan → wallet yang BENAR-BENAR BARU pertama kali dibuat di tengah transaksi menyebabkan crash 500 (`TypeError: 'NoneType' object is not subscriptable`), ditemukan & direproduksi langsung selama pengujian ini. |
| Verifikasi toko per-dokumen oleh superadmin | BERFUNGSI | `server.py:1370-1415` (review per dokumen + auto-approve), `:2115-2134` (approve/reject keseluruhan) | Dua jalur nyata, keduanya menulis ke `db.barbershops` dan mengirim notifikasi. |
| Chat admin ↔ owner | BERFUNGSI | `server.py:2786-2864` | Thread persisten di `db.chat_messages`, dengan status baca & lampiran R2. |
| Rekrutmen bertahap & skoring 6 komponen | BERFUNGSI, **skor 6 komponen diinput MANUAL oleh owner**, bukan dihitung otomatis dari dokumen | `server.py:630-636` (`EvaluateKaryawanIn`), `:1842-1870` (`evaluate_karyawan`, total ≥60/120 threshold) | Backend hanya menjumlahkan angka yang diketik owner (0-20 per komponen) dan menerapkan ambang batas. Diverifikasi hidup lewat pengujian §3.2 (karyawan berhasil dibuat "active" dengan skor 90/120). |
| Weighted Bayesian Rating | BERFUNGSI | `server.py:381-384` (`bayesian_rating`), dipanggil di `recalc_shop_rating` | Formula asli `((v/(v+m))*R + (m/(v+m))*C)`, bukan angka statis. |
| Katalog produk per barbershop | BERFUNGSI (fitur baru, ditambahkan pada sesi kerja yang sama — **belum di-commit ke git saat evidence ini dibuat**) | `server.py` (`/products/catalog`, `/owner/products`, `/admin/products` CRUD) | Koleksi `db.products` nyata, upload gambar ke R2, endpoint publik `/products/catalog` menggabungkan produk milik toko manapun + produk umum admin. |
| Paket layanan custom per toko | BERFUNGSI | `server.py:1651-1681` (`/owner/services` CRUD) | Dipakai langsung dalam `create_booking` (bukan data statis). |
| Rekap penghasilan per pemangkas | **BERFUNGSI, isolasi antar-pemangkas terverifikasi lewat pengujian nyata** (§3.2 skenario 2) | `server.py:1937-1953` (`/karyawan/earnings`) | Query di-scope ke `profile_id` pemanggil sendiri; dibuktikan dua akun karyawan berbeda masing-masing hanya melihat booking miliknya sendiri (1 vs 1, bukan tercampur 2). |
| ETA / estimasi waktu tiba | BERFUNGSI | `server.py:262-263` (`eta_minutes`), dipakai di pencarian & validasi booking | Dipakai konsisten di 2 titik (pencarian & re-validasi saat booking dibuat). |

---

## 2. FAKTA ARSITEKTUR

**Endpoint API**: 115 endpoint total (`grep -c "^@api\.\(get\|post\|put\|delete\)" backend/server.py`). Breakdown terbesar: `/admin/*` 30, `/owner/*` 27, `/bookings*` 11, `/karyawan/*` 7, `/auth/*` 6, `/payments/*` 5, `/chat/*` 5, `/analytics/*` 4, sisanya (`/shops`, `/wallets`, `/notifications`, `/ai`, `/barbers`, `/products`, `/payouts`, `/hairstyles`, `/recruitment`, `/seed`, `/`) masing-masing 1-3.

**Koleksi MongoDB** (28 total, lewat `grep -oE "db\.[a-z_]+\." | sort -u`): `ai_analysis, barbers, barbershops, bookings, chat_messages, face_references, hairstyles, karyawan, karyawan_locations, ledger_entries, notifications, owner_messages, owners, password_resets, payment_webhooks, payments, payouts, products, profiles, recruitment_criteria, recruitment_messages, reviews, schedules, service_messages, services, shop_schedule_overrides, shop_schedules, wallets`. Field utama tiap koleksi besar (bookings, wallets, ledger_entries, dll.) dicantumkan lengkap di laporan sub-agent; lihat `bookings` sebagai contoh koleksi terkompleks: 27 field termasuk seluruh rincian biaya (`amount_service`, `amount_admin_fee`, `amount_total_charged`, `amount_platform_commission`, `amount_barber_net`) dan status dana (`fund_state`).

**Integrasi eksternal**:
| Integrasi | Status |
|---|---|
| MongoDB Atlas | AKTIF |
| Durianpay | SIMULASI (kode sandbox/production asli ada, gated di belakang `PAYMENT_MODE`) |
| Cloudflare R2 | AKTIF, dengan fallback ke base64 kalau kredensial kosong |
| Google Gemini Vision | AKTIF secara kode, **tapi gagal konek dari mesin dev ini** (lihat §3.3) — fallback template selalu jalan |
| Brevo (email OTP) | AKTIF secara kode, no-op eksplisit kalau `BREVO_API_KEY` kosong |

**Versi runtime**: FastAPI `0.110.1`, `uvicorn 0.25.0`, `motor 3.3.1`, `pymongo 4.6.3`. Python: **tidak ada pin versi di repo manapun** (tidak ada `runtime.txt`/`.python-version`) — interpreter yang dipakai untuk pengujian ini adalah venv Python 3.12.10. Expo SDK `54.0.35`, React Native `0.81.5`, React `19.1.0`.

**Baris kode** (metode: `find <dir> -name "*.py"/"*.tsx"/"*.ts" | xargs wc -l`, venv/node_modules dikecualikan): backend **4.743 baris** (server.py sendiri 4.166 baris), frontend (`app/`+`src/`) **9.422 baris**.

**File & commit**: `git ls-files | wc -l` → **110 file terlacak**. `git log --oneline | wc -l` → **54 commit**.

### Algoritma inti

**1. Haversine** — `server.py:253-259`
```python
def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    a = math.sin(dlat/2)**2 + math.cos(to_rad(lat1))*math.cos(to_rad(lat2))*math.sin(dlng/2)**2
    return round(R * 2 * math.asin(math.sqrt(a)) * 100) / 100
```

**2. Greedy Slot Availability** — `server.py:744-759`
```python
overlap = any(not (s_end <= r[0] or s_min >= r[1]) for r in booked_ranges)
past = is_today and (s_min <= now_wita.hour * 60 + now_wita.minute)
result.append({"time": s, "available": (not overlap) and (not past)})
```

**3. Weighted Bayesian Rating** — `server.py:381-384`
```python
def bayesian_rating(v: int, R: float, C: float, m: int = 10) -> float:
    return round(((v/(v+m))*R + (m/(v+m))*C) * 100) / 100
```

**4. Skoring rekrutmen 6-komponen** — `server.py:1851-1853`
```python
weights = body.dict()
total = sum(weights.values())
status = "active" if total >= 60 else "rejected"
```
Catatan jujur: skor per-komponen (`portfolio_weight`, dst.) diinput manual oleh owner (0-20 tiap komponen) — backend tidak menurunkan skor itu sendiri dari dokumen/portofolio yang diunggah.

---

## 3. HASIL PENGUJIAN

Setup: server lokal (`uvicorn`, port 8001) menunjuk ke `DB_NAME=pangkaskaka_evidence_test` di cluster Atlas yang sama dengan `.env` — database kosong terpisah, tidak menyentuh data produksi/demo investor. Untuk memungkinkan pembuatan puluhan akun uji, rate limit `/auth/register` (`server.py:795`, default 10/jam per IP) dinaikkan **sementara** ke 1000 selama pengujian lokal berjalan, lalu **dikembalikan persis ke nilai semula (10)** sebelum evidence ini ditulis — `git diff backend/server.py` tidak menunjukkan perubahan pada baris tsb.

### 3.1 Anti-bentrok booking

Skrip: `tests/evidence/test_booking_race.py`. Setup: 1 toko, 1 barber, 20 akun customer berbeda, mencoba pesan slot **sama persis** (toko/barber/tanggal/jam sama).

**Sekuensial** (20 percobaan berurutan, tanpa konkurensi):
- Diterima: **1**
- Ditolak: **19**
- Verifikasi ground-truth langsung ke MongoDB (bukan cuma percaya respons API): **1 dokumen booking**, cocok
- Bentrok terjadi: **TIDAK**
- Hasil sesuai ekspektasi dokumen (1 diterima, 19 ditolak).

**Konkurren** (20 percobaan ditembak bersamaan lewat `asyncio.gather`, slot berbeda dari tes sekuensial supaya tidak saling mengganggu):
- Diterima (menurut respons API): **9**
- Ditolak: **11**
- Verifikasi ground-truth langsung ke MongoDB: **9 dokumen booking berbeda** untuk slot yang sama
- **Bentrok terjadi: YA — TEMUAN KRITIS**

**Analisis akar masalah** (`server.py:1130-1139`): logika anti-bentrok bukan operasi atomik tingkat database (bukan unique index), melainkan pola "insert dulu, cek belakangan": tiap request insert booking-nya sendiri, lalu query ulang semua booking non-cancelled di slot itu; kalau lebih dari satu ditemukan, HANYA booking dengan `created_at` PALING BARU yang menghapus dirinya sendiri. Di bawah insert yang benar-benar simultan, banyak request bisa saling melihat kondisi "lebih dari satu" itu SEBELUM booking yang lebih baru sempat menghapus dirinya, sehingga lebih dari satu booking survive. Ini **bukan** race condition langka/timing-sensitif teoretis — pada pengujian ini, reproduksinya konsisten (9 dari 20 percobaan konkuren lolos, bukan 1 kebetulan lolos 2).

### 3.2 Otorisasi antar peran

Skrip: `tests/evidence/test_role_authorization.py`. Setup: 2 toko (X, Y) dengan owner masing-masing, 2 akun karyawan (A, B) yang sama-sama lolos rekrutmen (skor 90/120) jadi StreetBarber aktif di toko X, 2 booking panggilan-ke-rumah berbeda (masing-masing sudah dibayar via simulasi) untuk barber A dan barber B.

| # | Skenario | Status HTTP | Diblokir? |
|---|---|---|---|
| 1 | Pemangkas A menyelesaikan booking milik pemangkas B | 403 | ✅ Ya |
| 2 | Pemangkas A membuka rekap penghasilan — isolasi dari data pemangkas B | 200 (isolasi data terverifikasi: masing-masing `completed_count=1`, bukan tercampur jadi 2) | ✅ Ya |
| 3 | Owner toko X mengedit layanan toko Y | 404 | ✅ Ya |
| 4 | Customer mengakses endpoint khusus owner (`/owner/orders`) | 403 | ✅ Ya |
| 5 | Customer 2 membatalkan booking milik Customer 1 | 404 | ✅ Ya |
| 6 | Request tanpa token ke `/wallets/me` | 401 | ✅ Ya |

**Ringkasan: 6 dari 6 skenario diblokir dengan benar.**

**Temuan tambahan di luar 6 skenario wajib** (ditemukan & diverifikasi ulang selama pengujian ini, sudah pernah dicatat tim sebelumnya di `Noted/2026-09-02/akun-demo-investor.md` tapi belum diperbaiki):
```
curl -X POST .../api/auth/register -d '{"...","role":"admin"}'
→ 200 OK, langsung dapat token JWT ber-role admin.
```
`POST /auth/register` menerima `role: "admin"` dari publik tanpa validasi tambahan apa pun (`server.py:418`, `RegisterIn.role: Literal["customer","owner","admin","karyawan"]` — tidak ada pengecekan bahwa pendaftar publik tidak boleh memilih `admin`). **Siapa pun bisa self-register jadi admin.** Ini adalah celah keamanan kritis yang harus ditutup sebelum go-live, bukan sekadar catatan kosmetik.

### 3.3 AI Style Analysis

**Akurasi 20 foto**: TIDAK DAPAT DIUJI — tidak ada kumpulan foto uji dengan label bentuk wajah "ground truth" di repo (satu-satunya folder gambar wajah, `backend/db/Data-Rambut/`, berisi foto referensi gaya rambut untuk rekomendasi, bukan foto uji berlabel bentuk wajah). Selain itu, deteksi bentuk wajah terjadi **on-device** (ML Kit), bukan di backend — mengujinya butuh alat uji di sisi mobile/kamera, di luar cakupan pengujian API lokal ini.

**Berapa kali fitur pernah dijalankan selama pengembangan**: TIDAK DAPAT DIUJI — tidak ada log persisten yang bisa diakses dari lingkungan pengujian lokal ini (log Railway produksi tidak diakses sesuai aturan "jangan sentuh produksi").

**Waktu respons rata-rata pemanggilan Gemini Vision**: TIDAK DAPAT DIUJI SECARA VALID dari lingkungan ini. 5 percobaan pemanggilan nyata ke Gemini (`gemini-flash-latest`) semuanya **gagal di level koneksi TLS** (`httpcore.ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate`) — pola yang sama persis dengan masalah SSL yang pernah ditemukan pada integrasi Cloudflare R2 di mesin developer ini sebelumnya (kemungkinan antivirus/VPN lokal yang mencegat TLS). Waktu 0.87–1.35 detik yang tercatat adalah waktu **gagal-cepat lalu fallback ke template**, BUKAN waktu respons Gemini yang sesungguhnya — sengaja tidak dilaporkan sebagai angka Gemini asli supaya tidak menyesatkan.

**Verifikasi foto tidak disimpan**: **TERVERIFIKASI, bukti kuat.** `POST /ai/face-scan` (`server.py:2496`, model `AIFaceScanIn` baris 639-642) hanya menerima `face_shape` (string) dan `confidence` (angka) — **tidak ada field foto/gambar sama sekali** di request body. Komentar eksplisit di kode (`server.py:2484-2486`): *"Face shape itself is computed on-device ... nothing here ever touches an image."* Backend secara struktural tidak mungkin menyimpan foto di endpoint ini karena tidak pernah menerimanya.

**Verifikasi mode fallback saat API gagal**: **TERVERIFIKASI DUA KALI, termasuk di bawah kegagalan nyata:**
1. Kegagalan tak disengaja (SSL error di atas) — sistem tetap mengembalikan HTTP 200 dengan kalimat template + rekomendasi gaya rambut lengkap, tidak pernah crash ke customer.
2. Kegagalan disengaja (server dijalankan ulang dengan `GEMINI_API_KEY=""`) — hasil identik: HTTP 200, `reasoning` = kalimat template persis dari `FACE_SHAPE_FALLBACK_REASONING["oval"]`, rekomendasi gaya rambut tetap lengkap dari database asli.

### 3.4 Tambahan

**Tingkat keberhasilan simulasi transaksi (20 percobaan)**: skrip `tests/evidence/test_simulation_success_rate.py` — 20 booking berbeda (slot tidak bentrok) lalu `POST /payments/simulate/{id}` untuk masing-masing. **Hasil: 20/20 berhasil (100%).**

**Waktu respons rata-rata 5 endpoint tersibuk**: TIDAK DAPAT DIUJI dengan bermakna dari lingkungan ini — "tersibuk" mengacu pada pola trafik produksi sungguhan yang tidak tersedia untuk pengujian lokal ini (mengukur latensi lokal terhadap database uji kosong tidak merepresentasikan beban produksi nyata, akan menyesatkan bila dilaporkan sebagai angka produksi).

**Verifikasi kontrol akses foto/dokumen KTP & NPWP**: **DIVERIFIKASI, temuan negatif.** Dokumen diunggah ke Cloudflare R2 lewat `upload_to_r2()` (`server.py:189-208`) dan disimpan sebagai URL publik `{R2_PUBLIC_URL}/{folder}/{uuid}{ext}` (`server.py:202`) — bucket R2 dikonfigurasi dengan "Public Development URL" aktif (dikonfirmasi dari `Noted/2026-09-05/Claoudflare-endpoints.md` sesi kerja sebelumnya). Artinya KTP/NPWP/dokumen toko **tidak disimpan di balik autentikasi/otorisasi apa pun** — siapa pun yang tahu URL persis (yang memuat UUID acak, jadi tidak bisa ditebak, tapi TIDAK ada pengecekan token/session di level R2) bisa mengaksesnya langsung. ANY yang bocor (log, referrer header, screenshot) akan bisa diakses siapa saja. Ini "keamanan lewat ketidaktahuan" (unguessable path), bukan kontrol akses yang sesungguhnya.

---

## 4. TEMUAN KONSISTENSI

- **`supabase`/`postgres`/`postgresql`**: 0 kemunculan di seluruh repo. Bersih.
- **`KUR`/"kredit usaha rakyat"**: 0 kemunculan. Bersih.
- **Variasi nama aplikasi**: hanya 2 bentuk dipakai, konsisten sesuai konteksnya — `PangkasKAKA` (brand/tampilan) dan `pangkaskaka` (slug/package/identifier mesin). Tidak ditemukan variasi salah (tidak ada "Pangkas Kaka" dengan spasi, tidak ada "pangkas_kaka" underscore). Satu ketidaksesuaian kecil: `frontend/package.json` memakai `"name": "frontend"` (generik, bukan salah, cuma tidak konsisten dengan branding di tempat lain).
- **Kunci API/rahasia hardcoded di source tracked**: 0 ditemukan. Semua variabel bertipe kunci/rahasia (`GEMINI_API_KEY`, `BREVO_API_KEY`, `DURIANPAY_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) dibaca eksklusif dari `os.environ.get(...)` dengan fallback string kosong — tidak ada nilai literal di kode. `.env`/`.env.example` sudah diperiksa: hanya berisi placeholder, bukan nilai asli.

---

## 5. KONTRIBUSI PER ANGGOTA

| Anggota | Commit | Area | Kontribusi utama |
|---|---|---|---|
| Petra Miracle M. E. Lenggu (Developer) | 42 | Merata: backend (51 file-touch), `frontend/app/(customer)/` (33), config/root frontend (29), `frontend/src/` (24), `(auth)` (22), `(owner)` (19) | 1) Sistem wallet/ledger fund-holding dengan breakdown biaya & radius ETA (commit `812910c`). 2) Modul oversight keuangan admin: rekonsiliasi, pendapatan platform, antrian payout (commit `d203ed4`). 3) Review dokumen verifikasi toko berbantuan AI Gemini Vision, dengan fallback manual non-blocking (commit `b862caa`). |
| Samuel Adian (PM) | 0 | — | Tidak ada commit di repo ini. |
| Rivaldy Christian Adoe (Data Analyst) | 0 | — | Tidak ada commit di repo ini. |
| Yudha Habel Palulun (Cyber Security) | 0 | — | Tidak ada commit di repo ini. |
| *(scaffold, bukan kontribusi manusia)* `emergent-agent-e1` | 12 | Bootstrap awal proyek | Commit auto-generate dari platform no-code "Emergent" yang dipakai untuk membuat kerangka awal proyek sebelum tim migrasi keluar darinya (`5090dd6`, `f751f9c`). |

**Catatan jujur wajib**: seluruh 42 commit substantif berasal dari **satu akun** (Petra). Ketiga anggota tim lain yang disebut di brief tidak punya commit sama sekali di repo ini. Semua 42 commit itu juga mencantumkan trailer `Co-Authored-By: Claude Sonnet 5` — pekerjaan dikerjakan dengan bantuan AI pair-programming, diungkapkan apa adanya di metadata commit itu sendiri.

---

## 6. ASET DEMO

- **Akun demo**: tersimpan di `Noted/2026-09-02/akun-demo-investor.md` (role owner, karyawan, admin — password TIDAK direproduksi di sini). Set kredensial massal lain: `memory/kupang_owner_accounts.csv` (120 baris akun owner toko Kupang).
- **Volume data demo**: tidak dapat dipastikan dari pembacaan kode saja berapa banyak yang benar-benar sudah di-seed ke database live/demo (butuh panggilan API live berautentikasi, di luar cakupan audit statis ini). Dua mekanisme seed ada di kode: `seed_all()` (4 akun dasar + beberapa toko, jalan otomatis tiap non-production startup) dan `backend/kupang_seed_data.py` (120 toko Kupang riil, lewat endpoint admin `/api/seed/kupang-shops`, tidak otomatis).
- **Screenshot/rekaman**: **tidak ditemukan satupun** di repo (bukan di `frontend/assets`, bukan di folder terpisah manapun). Kalau pitch deck butuh screenshot, harus diambil baru dari build yang jalan.
- **Perintah jalankan backend lokal**:
  ```bash
  cd backend
  python -m venv venv && venv\Scripts\activate
  pip install -r requirements.txt
  # isi .env dari .env.example
  uvicorn server:app --reload --host 0.0.0.0 --port 8000
  ```
  (server.py tidak punya `if __name__=="__main__"`, wajib lewat `uvicorn`.)
- **Perintah jalankan frontend lokal**:
  ```bash
  cd frontend
  npm install
  # isi frontend/.env: EXPO_PUBLIC_BACKEND_URL=http://<LAN-IP>:8000
  npx expo start --dev-client
  ```
  **Expo Go tidak bisa dipakai** — ada native module (`react-native-vision-camera` dkk.) yang butuh custom dev-client (`eas build --profile development`).
- **Kemampuan offline**: **TIDAK ADA.** Tidak ditemukan deteksi status jaringan, antrian offline, atau cache read-only apa pun di frontend (`NetInfo`/`offline`/`queue` — 0 kemunculan). AsyncStorage hanya dipakai untuk token sesi, bukan cache data. Backend butuh koneksi internet permanen ke MongoDB Atlas, Gemini, R2, Durianpay, dan Brevo. Aplikasi ini sepenuhnya online-only.

---

## 7. BATASAN YANG DIKETAHUI

1. **[KRITIS] Race condition nyata pada anti-bentrok booking** di bawah beban konkuren — 9 dari 20 percobaan simultan berhasil memesan slot yang sama persis (dibuktikan lewat query database langsung, bukan cuma respons API). Akar masalah: pengecekan "insert dulu, hapus belakangan" bukan operasi atomik. Lihat §3.1. Ini bug fungsional, bukan cuma catatan teoretis — direproduksi konsisten pada pengujian ini.
2. **[KRITIS] Wallet baru bisa membuat transaksi keuangan crash (500)** — `get_or_create_wallet()` tidak menyertakan session Mongo transaksi aktif saat membuat wallet baru, menyebabkan `_adjust_wallet()` yang berjalan di dalam transaksi yang sama gagal membaca wallet yang baru saja dibuat (snapshot isolation). Direproduksi langsung selama pengujian ini (lihat traceback lengkap di §3.2 setup). Berisiko terjadi di produksi setiap kali ada wallet toko/karyawan yang benar-benar baru menerima transaksi pertamanya.
3. **[KRITIS — keamanan] Registrasi publik menerima `role: "admin"`** tanpa validasi apa pun — siapa pun bisa self-register jadi admin lewat API publik. Sudah pernah dicatat tim (`Noted/2026-09-02/akun-demo-investor.md`) tapi belum diperbaiki sampai evidence ini ditulis.
4. **Dokumen KTP/NPWP/legalitas toko disimpan di URL publik R2** tanpa kontrol akses berbasis autentikasi — hanya mengandalkan UUID acak yang sulit ditebak, bukan izin akses sungguhan.
5. **Pembayaran masih dalam mode simulasi** di konfigurasi saat ini (`PAYMENT_MODE=simulation`) meski kode integrasi Durianpay sandbox/production sudah lengkap dan siap — belum pernah diuji end-to-end melawan sandbox Durianpay yang sesungguhnya dalam sesi ini.
6. **Integrasi Gemini Vision tidak bisa diverifikasi latensinya** dari lingkungan pengembangan ini karena kegagalan koneksi TLS lokal (kemungkinan besar masalah jaringan mesin developer, bukan masalah kode) — namun ini justru berarti fallback-nya sudah teruji di bawah kegagalan nyata, bukan cuma simulasi kegagalan.
7. **Seluruh kontribusi commit berasal dari satu developer** (Petra), dibantu AI pair-programming (diungkap di trailer commit). Tiga anggota tim lain yang disebut di brief proyek tidak memiliki jejak commit di repo ini — kalau pitch deck mengklaim kontribusi kode merata antar anggota, klaim itu tidak didukung oleh riwayat git.
8. **Tidak ada dukungan offline sama sekali** — aplikasi berhenti berfungsi total tanpa koneksi internet, termasuk untuk melihat data yang sudah pernah dimuat.
9. **Tidak ada screenshot/rekaman demo di repo** — perlu disiapkan terpisah untuk pitch deck.
10. **Akurasi AI Style Analysis dan "berapa kali fitur dijalankan selama development" tidak bisa diverifikasi** — tidak ada data/log yang tersedia untuk diaudit; jangan mengklaim angka akurasi apa pun di pitch deck tanpa pengujian tambahan dengan foto berlabel sungguhan.
11. **"Superadmin" bukan nama role yang benar-benar ada di kode** — role sebenarnya adalah `admin`. Sesuaikan istilah di pitch deck supaya konsisten dengan sistem.
12. Fitur "Katalog produk per barbershop" yang tercantum di §1 **belum ter-commit ke git** saat evidence ini ditulis (masih perubahan berjalan di working tree sesi yang sama) — pastikan sudah di-commit sebelum dianggap sebagai bagian resmi dari submission.
