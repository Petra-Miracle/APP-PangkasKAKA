"use client";

import Link from "next/link";
import { Sparkles, Smartphone, ArrowRight } from "lucide-react";
import InstallAppBanner from "@/components/InstallAppBanner";

export default function AiScanPage() {
  return (
    <main className="flex-1 px-6 py-14 md:px-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg shadow-brand-primary/20">
          <Sparkles size={26} className="text-on-brand-primary" />
        </div>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-extrabold">
          AI Face Scan
        </h1>
        <p className="mt-2 text-sm text-on-surface-2">
          Deteksi bentuk wajah real-time, langsung dari kamera HP-mu.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-surface-2 p-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-dim">
            <Smartphone size={36} className="text-brand-secondary" />
          </div>
          <h2 className="mt-5 text-lg font-bold">Tersedia di Aplikasi Mobile</h2>
          <p className="mx-auto mt-2.5 max-w-sm text-sm leading-6 text-on-surface-3">
            Fitur ini memproses kamera langsung di perangkat kamu — tidak ada foto yang
            dikirim ke server — jadi hanya bisa berjalan lewat aplikasi Android/iOS, bukan
            di browser.
          </p>
          <Link
            href="/jelajahi"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3 text-sm font-bold text-on-brand-primary transition hover:brightness-110"
          >
            Jelajahi Barber
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <InstallAppBanner />
    </main>
  );
}
