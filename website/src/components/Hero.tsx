"use client";

import type { PointerEvent } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform, useReducedMotion, type Variants } from "framer-motion";
import {
  Star,
  ChevronLeft,
  Scissors,
  Sparkles,
  MapPin,
  Store,
  Bike,
  ShoppingBag,
  Bell,
  MessageCircle,
  Search,
  SlidersHorizontal,
  CheckCircle2,
} from "lucide-react";
import { APK_URL } from "@/lib/api";
import PhoneMockup from "./PhoneMockup";

// Cermin dari 4 layanan di frontend/app/(customer)/shop/[id].tsx step "PILIH LAYANAN".
const SERVICES = [
  { name: "Potong Rambut", price: "Rp35.000", duration: "30 menit" },
  { name: "Cukur Jenggot", price: "Rp20.000", duration: "15 menit" },
  { name: "Creambath", price: "Rp45.000", duration: "40 menit" },
  { name: "Hair Styling", price: "Rp30.000", duration: "20 menit" },
];

const QUICK_TILES = [
  { label: "Barbershop", Icon: Store },
  { label: "StreetBarber", Icon: Bike },
  { label: "Produk", Icon: ShoppingBag },
];

// Cermin dari 2 produk placeholder di frontend/app/(customer)/home.tsx —
// dipakai untuk carousel "Katalog Produk" (productCard + productShopBadge).
const CATALOG_PREVIEW = [
  { name: "Pomade Matte", price: "Rp45.000", shop: "Toko Rapi" },
  { name: "Minyak Rambut", price: "Rp38.000", shop: "Barbershop Jaya" },
];

// Cermin dari layar Beranda aplikasi (frontend/app/(customer)/home.tsx):
// header lokasi + 2 ikon (chat, notifikasi), search bar, 3 quick-tile, lalu
// carousel horizontal "Katalog Produk" — pola kartu + badge toko yang khas
// dan sebelumnya hilang total dari mockup ini.
function FrontScreen() {
  return (
    <div className="flex h-full flex-col gap-3 px-4 pt-12">
      <div className="flex items-center gap-1.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-primary/25 bg-brand-dim">
          <MapPin size={15} className="text-brand-secondary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-medium text-on-surface-3">Lokasi kamu</p>
          <p className="truncate text-[12px] font-extrabold text-on-surface">Kupang, NTT</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
          <MessageCircle size={13} className="text-on-surface" aria-hidden="true" />
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
          <Bell size={13} className="text-on-surface" aria-hidden="true" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2.5">
        <Search size={12} className="shrink-0 text-on-surface-3" aria-hidden="true" />
        <span className="flex-1 truncate text-[9px] font-medium text-on-surface-3">
          Cari barbershop atau gaya rambut
        </span>
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-dim">
          <SlidersHorizontal size={10} className="text-brand-secondary" aria-hidden="true" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {QUICK_TILES.map(({ label, Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface py-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary">
              <Icon size={15} className="text-on-brand-primary" aria-hidden="true" />
            </div>
            <span className="text-[7px] font-bold text-on-surface">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-1">
        <p className="text-[11px] font-extrabold text-on-surface">Katalog Produk</p>
        <div className="mt-2 flex gap-2">
          {CATALOG_PREVIEW.map((item) => (
            <div key={item.name} className="flex-1 rounded-xl border border-border bg-surface p-2">
              <div className="relative flex h-12 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                <ShoppingBag size={16} className="text-brand-secondary/70" aria-hidden="true" />
                <span className="absolute left-1 top-1 max-w-[85%] truncate rounded-full bg-[#0f1a2e]/60 px-1.5 py-[1.5px] text-[6px] font-bold text-white">
                  {item.shop}
                </span>
              </div>
              <p className="mt-1.5 truncate text-[9px] font-bold text-on-surface">{item.name}</p>
              <p className="text-[9px] font-extrabold text-brand-secondary">{item.price}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Cermin dari step "PILIH LAYANAN" di frontend/app/(customer)/shop/[id].tsx:
// stepper 4 langkah, lalu daftar layanan dengan ikon gunting + durasi + harga.
function BackScreen() {
  const STEPS = ["Layanan", "Barber", "Jadwal", "Bayar"];

  return (
    <div className="flex h-full flex-col pt-11">
      <div className="flex items-center gap-2 px-4">
        <ChevronLeft size={16} className="text-on-surface-2" aria-hidden="true" />
        <span className="text-xs font-bold text-on-surface">Pilih Layanan</span>
      </div>

      <div className="mt-3 flex items-center gap-1 px-4">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-1 last:flex-none">
            <div
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold ${
                i === 0 ? "bg-brand-primary text-on-brand-primary" : "bg-surface-3 text-on-surface-3"
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      <p className="mt-4 px-4 text-[8.5px] font-bold uppercase tracking-wide text-on-surface-3">
        Pilih Layanan
      </p>

      <div className="mt-2 flex-1 space-y-1.5 px-3">
        {SERVICES.map((s, i) => (
          <div
            key={s.name}
            className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${
              i === 0 ? "border border-brand-primary/40 bg-brand-dim" : ""
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                i === 0 ? "bg-brand-primary" : "bg-surface-3"
              }`}
            >
              <Scissors
                size={12}
                className={i === 0 ? "text-on-brand-primary" : "text-brand-secondary"}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] font-semibold text-on-surface">{s.name}</span>
              <span className="text-[8.5px] text-on-surface-3">{s.duration}</span>
            </div>
            <span className="shrink-0 text-[10px] font-bold text-on-surface-2">{s.price}</span>
            {i === 0 && (
              <CheckCircle2 size={13} className="shrink-0 text-brand-secondary" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="px-3 pb-5">
        <div className="w-full rounded-xl bg-brand-primary py-2.5 text-center text-[11px] font-bold text-on-brand-primary">
          Lanjut
        </div>
      </div>
    </div>
  );
}

const headlineContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const wordVariant: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function Headline({ reduce }: { reduce: boolean }) {
  if (reduce) {
    return (
      <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.08] text-on-surface md:text-6xl">
        Rapikan gaya, <span className="text-brand-secondary">tanpa antre.</span>
      </h1>
    );
  }

  return (
    <motion.h1
      initial="hidden"
      animate="visible"
      variants={headlineContainer}
      className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.08] text-on-surface md:text-6xl"
    >
      <span className="block overflow-hidden pb-1">
        {["Rapikan", "gaya,"].map((w) => (
          <motion.span key={w} variants={wordVariant} className="mr-2.5 inline-block">
            {w}
          </motion.span>
        ))}
      </span>
      <span className="block overflow-hidden pb-1">
        <motion.span variants={wordVariant} className="mr-2.5 inline-block">
          tanpa
        </motion.span>
        <motion.span variants={wordVariant} className="inline-block text-brand-secondary">
          antre.
        </motion.span>
      </span>
    </motion.h1>
  );
}

function PhoneStage({ reduce }: { reduce: boolean }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useTransform(ry, [-60, 60], [7, -7]);
  const rotateY = useTransform(rx, [-60, 60], [-7, 7]);

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const bounds = e.currentTarget.getBoundingClientRect();
    rx.set(e.clientX - bounds.left - bounds.width / 2);
    ry.set(e.clientY - bounds.top - bounds.height / 2);
  }
  function handlePointerLeave() {
    rx.set(0);
    ry.set(0);
  }

  const tiltStyle = reduce ? undefined : { rotateX, rotateY };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: 1200 }}
      className="relative h-[400px] w-full max-w-lg shrink-0 md:h-[500px] lg:h-[540px]"
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -z-10 h-[75%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--brand-dim),transparent_70%)] blur-2xl"
      />

      <motion.div
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-2 top-6 z-30 hidden items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-on-surface shadow-elevated sm:flex"
      >
        <Star size={12} className="fill-brand-primary text-brand-primary" aria-hidden="true" />
        4.9 Rating
      </motion.div>
      <motion.div
        animate={reduce ? undefined : { y: [0, 9, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        className="absolute -left-3 bottom-16 z-30 hidden items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-on-surface shadow-elevated sm:flex"
      >
        <CheckCircle2 size={12} className="text-success" aria-hidden="true" />
        Booking Dikonfirmasi
      </motion.div>

      <motion.div
        style={tiltStyle}
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-2 z-10 hidden -translate-x-[15%] rotate-6 sm:block"
      >
        <PhoneMockup size="sm">
          <BackScreen />
        </PhoneMockup>
      </motion.div>

      <motion.div
        style={tiltStyle}
        animate={reduce ? undefined : { y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute left-1/2 top-0 z-20 -translate-x-1/2 sm:-translate-x-[85%] md:-translate-x-[95%]"
      >
        <PhoneMockup size="md">
          <FrontScreen />
        </PhoneMockup>
      </motion.div>
    </motion.div>
  );
}

export default function Hero() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section
      data-nav-theme="transparent"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,var(--brand-dim),transparent_42%),var(--surface)] px-6 py-20 lg:py-28"
    >
      {/* Dekorasi latar — dot grid, blob blur, motif gunting/sisir. Semua
          aria-hidden & pointer-events-none, murni tekstur, tidak memengaruhi
          alur baca atau navigasi keyboard. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-6 h-72 w-72 rounded-full bg-brand-primary/20 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-36 h-64 w-64 rounded-full bg-[#0f1a2e]/10 blur-[100px]"
      />
      <Scissors
        aria-hidden="true"
        className="pointer-events-none absolute left-[6%] top-[16%] hidden h-16 w-16 -rotate-[18deg] text-brand-secondary/10 md:block"
      />
      <Sparkles
        aria-hidden="true"
        className="pointer-events-none absolute right-[9%] top-[22%] hidden h-10 w-10 rotate-12 text-brand-secondary/15 md:block"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 text-center lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-left">
        <div className="max-w-2xl lg:max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-dim px-3 py-1 text-xs font-bold text-brand-secondary"
          >
            <MapPin size={12} aria-hidden="true" />
            Kupang, NTT
          </motion.div>

          <div className="mt-5">
            <Headline reduce={reduce} />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
            className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-on-surface-2 lg:mx-0"
          >
            Booking barbershop favorit atau panggil StreetBarber independen langsung ke lokasi
            kamu — cepat, transparan, dan bisa dilacak real-time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
            className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-2 lg:mx-0 lg:justify-start"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-2/80 px-3 py-1.5 text-xs font-semibold text-on-surface-2">
              <Store size={12} aria-hidden="true" />
              Barbershop — datang ke toko
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-2/80 px-3 py-1.5 text-xs font-semibold text-on-surface-2">
              <Bike size={12} aria-hidden="true" />
              StreetBarber — kami ke rumahmu
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65, ease: "easeOut" }}
            className="mt-7 flex flex-col items-center gap-3 lg:items-start"
          >
            <div className="relative inline-flex">
              {!reduce && (
                <motion.span
                  aria-hidden="true"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0, 0.45] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-brand-primary/60 blur-md"
                />
              )}
              <Link
                href="/jelajahi"
                className="relative inline-flex items-center gap-2 rounded-full bg-brand-primary px-7 py-3.5 text-sm font-bold text-on-brand-primary transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/10"
              >
                Booking Sekarang
              </Link>
            </div>
            <a
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-on-surface-3 underline-offset-4 transition hover:text-on-surface hover:underline"
            >
              atau unduh aplikasinya
            </a>
          </motion.div>
        </div>

        <PhoneStage reduce={reduce} />
      </div>
    </section>
  );
}
