"use client";

import type { PointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useTransform, useReducedMotion, type Variants } from "framer-motion";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Sparkles,
  MapPin,
  Store,
  Bike,
  CheckCircle2,
} from "lucide-react";
import { APK_URL } from "@/lib/api";
import PhoneMockup from "./PhoneMockup";

const SERVICES = [
  { name: "Potong Rambut", price: "Rp35.000" },
  { name: "Cukur Jenggot", price: "Rp20.000" },
  { name: "Creambath", price: "Rp45.000" },
  { name: "Hair Styling", price: "Rp30.000" },
];

function FrontScreen() {
  return (
    <div className="flex h-full flex-col pt-12">
      <div className="flex items-center justify-between px-5">
        <span className="font-[family-name:var(--font-display)] text-sm font-bold text-on-surface">
          PangkasKAKA
        </span>
        <Sparkles size={15} className="text-brand-secondary" aria-hidden="true" />
      </div>

      <div className="mx-4 mt-4 overflow-hidden rounded-2xl">
        <div className="relative h-36 w-full">
          <Image
            src="https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=400&q=80"
            alt="StreetBarber sedang memangkas rambut pelanggan"
            fill
            sizes="252px"
            priority
            className="object-cover"
          />
        </div>
        <div className="bg-surface-2 px-3 py-2.5">
          <p className="text-xs font-bold text-on-surface">Rizky — StreetBarber</p>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-on-surface-3">
            <Star size={10} className="fill-brand-primary text-brand-primary" aria-hidden="true" />
            4.9 · 1.2 km dari kamu
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 px-4">
        {SERVICES.slice(0, 2).map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5"
          >
            <span className="text-[11px] font-semibold text-on-surface">{s.name}</span>
            <span className="text-[11px] font-bold text-brand-secondary">{s.price}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto px-4 pb-6">
        <div className="w-full rounded-xl bg-brand-primary py-3 text-center text-xs font-bold text-on-brand-primary">
          Booking Sekarang
        </div>
      </div>
    </div>
  );
}

function BackScreen() {
  return (
    <div className="flex h-full flex-col pt-11">
      <div className="flex items-center gap-2 px-4">
        <ChevronLeft size={16} className="text-on-surface-2" aria-hidden="true" />
        <span className="text-xs font-bold text-on-surface">Pilih Layanan</span>
      </div>

      <div className="mt-3 flex-1 space-y-1 px-3">
        {SERVICES.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-lg px-2.5 py-2.5"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3">
                <Scissors size={12} className="text-brand-secondary" aria-hidden="true" />
              </div>
              <span className="text-[10.5px] font-semibold text-on-surface">{s.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10.5px] font-bold text-on-surface-2">{s.price}</span>
              <ChevronRight size={12} className="text-on-surface-3" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-5">
        <div className="w-full rounded-xl border border-border-strong py-2.5 text-center text-[11px] font-bold text-on-surface">
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
        className="absolute -right-3 bottom-16 z-30 hidden items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-bold text-on-surface shadow-elevated sm:flex"
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
