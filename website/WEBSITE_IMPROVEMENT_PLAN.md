# PangkasKAKA Website Improvement Plan

Dokumen ini merangkum perbaikan website PangkasKAKA sebagai gambaran awal sistem aplikasi untuk customer dan kebutuhan demo pitching.

## Tujuan

Website harus:

- Menjelaskan value PangkasKAKA dalam beberapa detik.
- Mengarahkan customer ke booking Barbershop atau StreetBarber.
- Menampilkan alur booking yang benar-benar dapat diverifikasi.
- Tidak membuat klaim fitur yang belum tersedia.
- Tetap cepat, responsif, mudah dipahami, dan dapat dipercaya.

## Prioritas P0: Wajib Sebelum Pitching

### 1. Perbaiki pembayaran web

File utama:

- `src/app/booking/[id]/pembayaran/page.tsx`
- `src/app/booking/toko/[shopId]/pembayaran/page.tsx`
- `src/lib/api.ts`

Masalah:

- Tombol `Saya Sudah Bayar` hanya mengubah state lokal.
- Tidak ada verifikasi ke backend.
- Status booking dapat terlihat berhasil walaupun database masih `pending` atau `unpaid`.
- QR yang ditampilkan masih `FauxQr`.

Tindakan:

- Gunakan endpoint pembayaran yang sama dengan aplikasi mobile.
- Tambahkan API untuk membuat, mengecek, dan menyelesaikan pembayaran.
- Tampilkan state `menunggu pembayaran`, `berhasil`, `gagal`, dan `kedaluwarsa`.
- Jangan tampilkan `Booking dikonfirmasi` sebelum backend mengonfirmasi pembayaran.
- Jika masih menggunakan simulasi, beri label jelas `Demo pembayaran`.

Acceptance criteria:

- Status pembayaran berasal dari backend, bukan hanya state React.
- Refresh halaman tidak mengembalikan status ke kondisi palsu.
- Riwayat booking menampilkan status yang sama dengan halaman pembayaran.
- Timeout dan kegagalan API memiliki pesan yang jelas.

### 2. Selaraskan klaim live tracking

File utama:

- `src/app/page.tsx`
- `src/app/tracking/[bookingId]/page.tsx`

Masalah:

- Landing page mengklaim live tracking di peta.
- Halaman web hanya menampilkan jarak dan estimasi; peta masih placeholder.

Tindakan:

- Implementasikan peta dengan posisi terakhir StreetBarber, atau
- ubah copy menjadi `Pantau status perjalanan dan estimasi jarak`.

Acceptance criteria:

- Tidak ada klaim fitur peta jika peta belum tersedia.
- Status lokasi memiliki state loading, aktif, tidak tersedia, dan error.
- Polling berhenti saat halaman ditutup.

### 3. Perbaiki statistik hero

File utama:

- `src/app/page.tsx`

Masalah:

- Jumlah barbershop digunakan sebagai jumlah StreetBarber aktif.
- Rating masih menggunakan `-`.
- Fallback `300+` tidak berasal dari data terverifikasi.

Tindakan:

- Gunakan endpoint dan label yang sesuai.
- Tampilkan hanya angka yang benar-benar tersedia.
- Jika belum ada data valid, hilangkan statistik tersebut atau gunakan copy non-numerik.

Acceptance criteria:

- Setiap angka memiliki sumber data yang jelas.
- Label statistik sesuai dengan field backend.
- Tidak ada angka dummy pada halaman publik tanpa label demo.

## Prioritas P1: First Impression dan Conversion

### 4. Perjelas CTA utama

File utama:

- `src/components/Navbar.tsx`
- `src/app/page.tsx`

Masalah:

- CTA utama selalu mengarah ke `StreetBarber`.
- Jalur Barbershop dan StreetBarber tidak sama-sama terlihat sebagai pilihan utama.

Tindakan:

Gunakan salah satu pola:

- `Cari Barbershop` dan `Panggil StreetBarber`, atau
- `Jelajahi Semua Barber` dengan filter yang mudah dipilih.

### 5. Perkuat hero section

Masalah:

- Hero menggunakan foto barber generik sebagai background.
- Produk dan alur booking belum terlihat langsung pada viewport pertama.

Tindakan:

- Tambahkan preview UI booking, kartu toko, status pembayaran, atau tracking.
- Pertahankan foto sebagai pendukung visual, bukan satu-satunya representasi produk.
- Tambahkan konteks area layanan: `Kupang, NTT`.

### 6. Perjelas value proposition

Pastikan halaman awal menjawab:

- Apa masalah yang diselesaikan?
- Siapa yang menggunakan produk?
- Apa beda Barbershop dan StreetBarber?
- Apakah harga dan jadwal transparan?
- Area mana yang dilayani?

Copy yang disarankan:

> Booking barbershop atau panggil StreetBarber ke rumah di Kupang. Pilih layanan, lihat jadwal, cek harga, dan pantau status pesanan dari satu aplikasi.

### 7. Perbaiki footer

File utama:

- `src/app/page.tsx`

Masalah:

- Beberapa teks terlihat seperti link tetapi tidak dapat diklik.

Tindakan:

- Hubungkan ke halaman yang tersedia.
- Buat halaman legal minimal untuk syarat dan privasi.
- Hapus link yang belum memiliki tujuan agar tidak memberi kesan unfinished.

## Prioritas P1: UX dan Error Handling

### 8. Tampilkan error API dengan jelas

File utama:

- `src/app/jelajahi/page.tsx`
- `src/app/katalog/page.tsx`
- `src/lib/api.ts`

Masalah:

- Banyak error ditelan dengan `catch(() => {})`.
- User dapat melihat halaman kosong tanpa tahu penyebabnya.

Tindakan:

- Tambahkan state `loading`, `error`, `empty`, dan `success`.
- Sediakan tombol `Coba lagi`.
- Bedakan error jaringan, data kosong, dan lokasi belum tersedia.

### 9. Tambahkan fallback lokasi

Masalah:

- StreetBarber bergantung pada izin GPS browser.
- Jika izin ditolak, user dapat melihat hasil kosong.

Tindakan:

- Gunakan fallback area Kupang.
- Sediakan input lokasi manual jika diperlukan.
- Jelaskan mengapa izin lokasi dibutuhkan.

### 10. Validasi alur booking

File yang perlu diaudit:

- `src/app/booking/[id]/jadwal/page.tsx`
- `src/app/booking/[id]/layanan/page.tsx`
- `src/app/booking/[id]/ringkasan/page.tsx`
- `src/app/booking/[id]/pembayaran/page.tsx`

Tindakan:

- Validasi service, tanggal, jam, barber, alamat, dan token sebelum request booking.
- Jika parameter URL hilang atau tidak valid, arahkan user ke langkah yang benar.
- Tambahkan tombol kembali yang jelas.
- Tampilkan halaman `Booking tidak ditemukan` jika detail gagal dimuat.

## Prioritas P2: Performa

### 11. Tambahkan timeout API

File utama:

- `src/lib/api.ts`

Tindakan:

- Gunakan `AbortController`.
- Gunakan timeout sekitar 8-10 detik untuk GET.
- Gunakan retry terbatas hanya untuk request yang aman diulang.
- Tampilkan pesan yang berguna saat Railway/API tidak merespons.

### 12. Optimalkan cache

Saat ini request menggunakan `no-store` secara umum.

Pertimbangkan cache atau revalidation untuk:

- daftar barbershop,
- katalog produk,
- detail barber publik.

Tetap gunakan data terbaru tanpa cache untuk:

- autentikasi,
- booking,
- pembayaran,
- status lokasi pribadi.

### 13. Optimalkan gambar

Masalah:

- Banyak gambar menggunakan CSS `background-image`.
- Ukuran dan loading gambar tidak dikontrol dengan optimal.

Tindakan:

- Gunakan `next/image` jika memungkinkan.
- Tetapkan ukuran gambar.
- Gunakan thumbnail untuk daftar.
- Tambahkan fallback image.
- Pastikan domain gambar dikonfigurasi di Next.js.

### 14. Ringankan loading screen

File utama:

- `src/components/LoadingScreen.tsx`

Tindakan:

- Gunakan skeleton lokal untuk loading data biasa.
- Simpan animasi overlay besar untuk proses penting.
- Pastikan loading screen tidak membuat user merasa seluruh halaman macet.
- Jangan menyembunyikan status loading dari screen reader.

## Prioritas P2: Accessibility dan SEO

### Accessibility

- Gunakan `<label>` untuk semua input.
- Tambahkan `aria-label` pada tombol icon.
- Gunakan `aria-pressed` pada filter.
- Tambahkan live region untuk error dan perubahan status booking.
- Pastikan focus state terlihat jelas.
- Berikan alt text untuk gambar produk, toko, barber, dan hero.

### SEO

File utama:

- `src/app/layout.tsx`
- halaman detail toko dan barber

Tambahkan:

- metadata unik per halaman,
- Open Graph image,
- Twitter card,
- canonical URL,
- sitemap,
- structured data untuk bisnis lokal,
- judul dan deskripsi detail toko/barber.

## Konsistensi Dengan Aplikasi Mobile

Website harus konsisten dengan aplikasi mobile dalam hal:

- status booking,
- status pembayaran,
- validasi slot,
- fallback lokasi,
- arti StreetBarber independen,
- informasi harga dan biaya layanan,
- status tracking.

Jangan membuat website menjanjikan fitur yang hanya ada di aplikasi mobile tanpa penjelasan yang jelas.

## Urutan Implementasi

1. Hubungkan pembayaran web ke backend.
2. Hapus atau labeli fitur demo yang belum nyata.
3. Perbaiki statistik hero.
4. Perbaiki CTA Barbershop dan StreetBarber.
5. Tambahkan error state, retry, dan fallback lokasi.
6. Selaraskan klaim tracking dengan implementasi aktual.
7. Tambahkan timeout API dan optimasi gambar.
8. Tambahkan accessibility dan SEO.

## Checklist Validasi Pitching

- [ ] Customer memahami produk dalam 5-10 detik.
- [ ] Customer bisa memilih Barbershop atau StreetBarber dengan jelas.
- [ ] Flow discovery sampai booking dapat dicoba tanpa kebingungan.
- [ ] Pembayaran tidak mengubah status hanya dari state frontend.
- [ ] Refresh halaman tidak merusak status transaksi.
- [ ] Statistik landing page akurat.
- [ ] Tidak ada klaim peta jika peta belum tersedia.
- [ ] Error Railway/API menampilkan pesan dan tombol retry.
- [ ] Website tetap usable saat GPS ditolak.
- [ ] Layout nyaman di mobile dan desktop.
- [ ] Semua link footer memiliki tujuan yang benar.
- [ ] Metadata dan preview link tersedia untuk demo.

## Prompt Untuk AI Coding

> Audit dan optimalkan folder `website/` berdasarkan dokumen `WEBSITE_IMPROVEMENT_PLAN.md`. Mulai dari pengukuran dan reproduksi, bukan refactor besar. Prioritaskan pembayaran web, keakuratan statistik, konsistensi klaim live tracking, CTA Barbershop/StreetBarber, error state, fallback lokasi, dan API timeout. Jangan mengubah behavior bisnis tanpa bukti. Jangan menyatakan booking sukses sebelum backend mengonfirmasi status pembayaran. Setelah setiap perubahan jalankan lint, typecheck, build, dan test yang relevan. Laporkan file yang diubah, hasil validasi, serta risiko yang masih tersisa.
