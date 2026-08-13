// Query cepat: users (profiles) & barbershops
use("pangkaskaka");

// Cari user berdasarkan email (ganti emailnya)
db.profiles.findOne({ email: "petra221106@gmail.com" });

// List semua owner
db.profiles.find({ role: "owner" }).limit(10);

// Shop yang masih pending verifikasi
db.barbershops.find({ verification_status: "pending" });

// Shop dengan rating tertinggi
db.barbershops.find().sort({ rating_avg: -1 }).limit(5);
