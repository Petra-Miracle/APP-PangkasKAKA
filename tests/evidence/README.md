# tests/evidence/

Skrip pengujian yang dipakai untuk menghasilkan `EVIDENCE_PACK.md` di root repo. Semua
skrip di sini WAJIB dijalankan terhadap server lokal yang menunjuk ke database MongoDB
**terpisah dari produksi** — jangan pernah menjalankan ini terhadap database yang dipakai
akun demo investor atau data produksi asli.

## Cara menjalankan ulang

1. Install dependency (sekali saja):
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\pip install -r requirements.txt
   ```

2. Jalankan server lokal dengan nama database TERPISAH (dari folder `backend/`):
   ```bash
   DB_NAME=pangkaskaka_evidence_test venv\Scripts\python -m uvicorn server:app --host 127.0.0.1 --port 8001
   ```
   Ini memakai `MONGO_URL` yang sama dari `backend/.env` (cluster Atlas yang sama), tapi
   menulis ke database baru yang kosong bernama `pangkaskaka_evidence_test` — nol risiko
   ke data produksi/demo, karena `python-dotenv` tidak menimpa env var yang sudah di-set
   lewat shell (`DB_NAME` di atas menang atas nilai di `.env`).

3. Dari root repo, jalankan skrip yang diinginkan:
   ```bash
   backend/venv/Scripts/python tests/evidence/test_booking_race.py
   backend/venv/Scripts/python tests/evidence/test_role_authorization.py
   backend/venv/Scripts/python tests/evidence/test_simulation_success_rate.py
   ```
   Tiap skrip menulis hasilnya ke file `*_results.json` di folder ini juga, plus print ke stdout.

## Catatan penting

- `test_booking_race.py` dan `test_role_authorization.py` sama-sama meregistrasi puluhan
  akun uji lewat `/auth/register`. Endpoint itu punya rate limit 10 registrasi/jam/IP
  (`server.py:795`) — kalau menjalankan berkali-kali dalam waktu singkat dari IP yang sama,
  restart proses server (bucket rate-limit tersimpan in-memory, hilang saat restart) atau
  naikkan `max_requests` di baris itu SEMENTARA untuk kebutuhan pengujian, lalu **kembalikan
  ke nilai semula sebelum commit apa pun** — jangan biarkan perubahan itu masuk ke kode asli.
- `test_role_authorization.py` akan gagal dengan `TypeError` di server kalau wallet
  "platform" belum pernah dibuat sama sekali di database yang dipakai (bug nyata, dicatat
  di `EVIDENCE_PACK.md` §7 poin 2) — skrip ini sudah punya workaround (memanggil
  `GET /wallets/me` untuk pre-warm wallet karyawan sebelum transaksi apa pun menyentuhnya)
  supaya tetap bisa jalan sampai selesai tanpa perlu memperbaiki bug itu di kode produksi.
- Database `pangkaskaka_evidence_test` dibiarkan ada di cluster Atlas setelah pengujian
  (tidak dihapus otomatis) supaya bisa diperiksa ulang lewat MongoDB Compass kalau perlu.
  Aman dihapus kapan saja — isinya cuma data uji sintetis.
