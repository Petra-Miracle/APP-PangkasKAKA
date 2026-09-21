"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Download, ArrowRight } from "lucide-react";

// Link ke asset APK rilis terbaru langsung (redirect 302 dari GitHub ke file-nya),
// bukan ke halaman listing release — supaya klik "Pasang" langsung memicu unduhan,
// bukan mendarat di halaman GitHub dulu.
const APK_URL = "https://github.com/Petra-Miracle/APP-PangkasKAKA/releases/latest/download/app-release.apk";

export default function InstallAppBanner({
  text = "Pasang aplikasi PangkasKAKA untuk coba AI Face Scan",
}: {
  text?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => queueMicrotask(() => setShown(true)), 400);
    return () => clearTimeout(t);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-4 z-50 mx-auto w-full max-w-[360px] px-4 transition-all duration-500 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-[#1c2b4a] bg-[#0f1a2e] shadow-2xl shadow-black/40">
        <div className="flex min-h-[2cm] items-center gap-3 px-3 py-2.5">
          <Image
            src="/logo.jpeg"
            alt="PangkasKAKA"
            width={40}
            height={40}
            className="shrink-0 rounded-xl object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{text}</p>

          <a
            href={APK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-xs font-bold text-on-brand-primary transition hover:brightness-110"
          >
            <Download size={13} />
            Pasang
          </a>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Nanti saja"
            className="shrink-0 text-white/50 transition hover:text-white"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] text-white/60">
          <span>Tap</span>
          <Download size={12} className="text-brand-primary" />
          <ArrowRight size={12} />
          <span className="font-semibold text-white/80">Unduh & install APK-nya</span>
        </div>
      </div>
    </div>
  );
}
