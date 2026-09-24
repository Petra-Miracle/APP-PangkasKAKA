import Image from "next/image";
import { ArrowDownRight } from "lucide-react";

/**
 * Badge QR unduh app — fixed di pojok kanan bawah, desktop saja, tampil di
 * semua section homepage. Chip "Booking Dikonfirmasi" milik Hero sengaja
 * dipindah ke sisi kiri (lihat Hero.tsx) supaya pojok ini permanen kosong.
 */
export default function QRDownloadBadge() {
  return (
    <div className="fixed bottom-6 right-6 z-40 hidden flex-col items-end gap-1.5 lg:flex">
      <div className="flex items-center gap-1.5 rounded-full bg-[#0f1a2e] py-1.5 pl-3 pr-2 text-xs font-bold text-white shadow-elevated">
        Scan &amp; unduh app
        <ArrowDownRight size={15} className="animate-bounce text-brand-primary" aria-hidden="true" />
      </div>
      <div className="rounded-2xl border border-border bg-white p-2 shadow-elevated">
        <Image
          src="/qr-app.png"
          alt="QR code unduh aplikasi PangkasKAKA"
          width={104}
          height={104}
          className="block"
        />
      </div>
    </div>
  );
}
