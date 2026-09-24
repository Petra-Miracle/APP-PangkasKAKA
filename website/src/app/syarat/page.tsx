import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: "Syarat dan ketentuan penggunaan platform PangkasKAKA.",
};

export default function SyaratPage() {
  return (
    <main className="flex-1 px-6 py-14 md:px-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-on-surface">
          Syarat &amp; Ketentuan
        </h1>
        <p className="mt-2 text-xs text-on-surface-3">Terakhir diperbarui: September 2026</p>

        <div className="mt-8 space-y-6 divide-y divide-border text-sm leading-relaxed text-on-surface-2 [&>section:not(:first-child)]:pt-6">
          <section>
            <h2 className="text-base font-semibold text-on-surface">1. Status Layanan</h2>
            <p className="mt-2">
              PangkasKAKA saat ini berjalan sebagai prototipe demo yang berbasis di Kupang, NTT.
              Beberapa alur — termasuk pembayaran QRIS — berjalan dalam mode simulasi untuk
              keperluan demonstrasi dan belum memproses transaksi finansial nyata melalui
              penyedia pembayaran pihak ketiga.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">2. Akun Pengguna</h2>
            <p className="mt-2">
              Kamu bertanggung jawab menjaga kerahasiaan kata sandi akunmu. Barbershop dan
              StreetBarber wajib melalui proses verifikasi dokumen sebelum dapat menerima
              pesanan di platform.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">3. Pemesanan &amp; Pembatalan</h2>
            <p className="mt-2">
              Pemesanan dapat dibatalkan gratis hingga 1 jam sebelum jadwal layanan. Pemesanan
              yang belum dibayar akan kedaluwarsa otomatis 15 menit setelah dibuat.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">4. StreetBarber Independen</h2>
            <p className="mt-2">
              StreetBarber adalah mitra independen yang tervalidasi oleh sebuah barbershop
              partner, namun tidak berstatus sebagai karyawan barbershop tersebut maupun
              PangkasKAKA.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">5. Perubahan Ketentuan</h2>
            <p className="mt-2">
              Ketentuan ini dapat diperbarui seiring perkembangan platform. Perubahan signifikan
              akan diinformasikan melalui aplikasi atau website.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
