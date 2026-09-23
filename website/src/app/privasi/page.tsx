import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Bagaimana PangkasKAKA mengumpulkan dan menggunakan data penggunanya.",
};

export default function PrivasiPage() {
  return (
    <main className="flex-1 px-6 py-14 md:px-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          Kebijakan Privasi
        </h1>
        <p className="mt-2 text-xs text-on-surface-3">Terakhir diperbarui: September 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-on-surface-2">
          <section>
            <h2 className="text-base font-semibold text-on-surface">1. Data yang Dikumpulkan</h2>
            <p className="mt-2">
              Kami mengumpulkan data yang kamu berikan langsung — nama, email, nomor telepon,
              alamat, dan lokasi (saat digunakan untuk mencari barber terdekat atau memesan
              layanan panggilan). Barbershop dan StreetBarber tambahan mengunggah dokumen
              identitas untuk keperluan verifikasi mitra.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">2. Penggunaan Data</h2>
            <p className="mt-2">
              Data digunakan untuk memproses pemesanan, menampilkan barber/toko terdekat,
              memverifikasi identitas mitra, dan mengirim notifikasi terkait status
              pesananmu. Kami tidak menjual data pengguna ke pihak ketiga.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">3. Lokasi</h2>
            <p className="mt-2">
              Akses lokasi bersifat opsional dan hanya digunakan selama sesi aktif untuk
              menampilkan barber/toko terdekat serta status perjalanan StreetBarber ke
              lokasimu. Lokasi StreetBarber yang sedang online dibagikan secara real-time
              kepada pelanggan yang memesan layanan mereka.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">4. Dokumen Verifikasi Mitra</h2>
            <p className="mt-2">
              Dokumen identitas dan legalitas yang diunggah barbershop/StreetBarber untuk
              verifikasi hanya dapat diakses oleh SuperAdmin platform dan disimpan secara
              tersegmentasi dari data publik.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-on-surface">5. Hubungi Kami</h2>
            <p className="mt-2">
              Pertanyaan seputar privasi data dapat disampaikan melalui kontak yang tertera di
              aplikasi mobile PangkasKAKA.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
