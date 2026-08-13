# Cara pakai MongoDB Playground di VSCode/Cursor

## 1. Hubungkan ke database (sekali saja, tersimpan lokal — TIDAK masuk git)

1. Klik ikon daun MongoDB di sidebar kiri (logo leaf hijau).
2. Klik **"Add Connection"**.
3. Pilih **"I'll provide a connection string"**, paste isi `MONGO_URL` dari `backend/.env` kamu
   (yang connection string `mongodb+srv://...`), lalu beri nama koneksi mis. `pangkaskaka-atlas`.
4. Connect. Sekarang kamu bisa expand tree-nya untuk browse database `pangkaskaka` →
   koleksi → dokumen, tanpa buka Compass/Atlas web sama sekali.

> Kredensial hanya tersimpan di secret storage lokal editor kamu, bukan di file manapun
> di repo ini — makanya `.env` tetap gitignored dan aman.

## 2. Jalankan file playground (`*.mongodb.js`)

1. Buka salah satu file di folder ini, mis. `01-overview.mongodb.js`.
2. Di pojok kanan atas editor akan muncul dropdown pilih koneksi aktif — pastikan
   pilih `pangkaskaka-atlas` yang tadi dibuat.
3. Cara eksekusi:
   - **Run seluruh file**: klik tombol ▶ "Run Playground" di kanan atas, atau
     klik kanan di editor → "Run Playground".
   - **Run satu blok/baris**: select teks yang mau dijalankan, klik kanan →
     "Run Selected Lines From Playground" (ini yang paling mirip cara kerja
     jalanin query MySQL satu-satu).
4. Hasilnya muncul di panel "Playground Result" di sisi kanan, bentuknya tree JSON
   yang bisa di-expand per dokumen.

## 3. Bikin playground baru

Klik kanan folder ini → "New MongoDB Playground", atau langsung bikin file baru
dengan akhiran `.mongodb.js`. Isinya JavaScript biasa + method Mongo shell
(`db.<collection>.find()`, `.insertOne()`, `.aggregate()`, dll) — persis seperti
nulis query di mongosh, tapi bisa disimpan, di-review, dan dijalankan ulang kapan saja.

## Isi folder ini

- `01-overview.mongodb.js` — daftar koleksi & jumlah dokumen tiap koleksi utama.
- `02-users-and-shops.mongodb.js` — query user/owner & barbershop.
- `03-bookings.mongodb.js` — query booking & payment, termasuk contoh update
  (sengaja dikomentari, edit manual dulu sebelum dijalankan).

Tambahkan file baru sesuai kebutuhan — folder ini bukan bagian dari kode aplikasi,
jadi bebas dipakai sebagai "notebook" query kamu sendiri.
