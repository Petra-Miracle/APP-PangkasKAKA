// PangkasKAKA — Database Overview Playground
// Cara pakai: klik kanan di editor ini > "Run All" (atau select baris lalu klik "Run Selected Lines"),
// hasilnya muncul di panel "Playground Result" di sebelah kanan.
// Pastikan koneksi aktif (lihat status bar bawah, atau file 00-connect-instructions.md).

use("pangkaskaka");

// Daftar semua koleksi (collection) yang ada
db.getCollectionNames();

// Jumlah dokumen per koleksi utama
[
  "profiles",
  "barbershops",
  "barbers",
  "bookings",
  "payments",
  "reviews",
  "karyawan",
  "notifications",
].forEach((name) => {
  print(`${name}: ${db.getCollection(name).countDocuments()}`);
});
