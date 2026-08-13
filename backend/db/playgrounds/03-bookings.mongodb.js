// Query cepat: bookings & pembayaran
use("pangkaskaka");

// Booking aktif (belum selesai/batal)
db.bookings.find({ status: { $in: ["pending", "confirmed"] } }).sort({ created_at: -1 }).limit(20);

// Booking hari ini
db.bookings.find({ booking_date: new Date().toISOString().slice(0, 10) });

// Cek pembayaran yang masih unpaid tapi sudah lewat expired
db.payments.find({ status: "unpaid", expires_at: { $lt: new Date() } });

// Contoh update manual (HATI-HATI — jalankan baris ini satu-satu, bukan run all,
// dan ganti _id sesuai kebutuhan sebelum eksekusi)
// db.bookings.updateOne({ _id: "xxxx" }, { $set: { status: "cancelled" } });
