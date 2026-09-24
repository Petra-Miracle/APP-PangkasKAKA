"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Fade+slide-up saat elemen masuk viewport — dipakai untuk beri ritme scroll
 * di section fitur/cara-kerja/CTA. `once: true` supaya tidak berulang tiap
 * kali di-scroll bolak-balik, dan otomatis nonaktif saat prefers-reduced-motion.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
