"use client";

import { motion, useReducedMotion } from "framer-motion";

type Step = { n: string; title: string; desc: string };

/**
 * Baris "Cara Kerja" dengan garis penghubung yang "digambar" saat masuk
 * viewport (scaleX 0 → 1) — dipisah jadi client component sendiri karena
 * page.tsx (Home) adalah async server component dan tidak bisa pakai hook
 * Framer Motion langsung.
 */
export default function StepsRow({ steps }: { steps: Step[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto mt-12 max-w-4xl">
      <motion.div
        aria-hidden="true"
        initial={reduce ? undefined : { scaleX: 0 }}
        whileInView={reduce ? undefined : { scaleX: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{ transformOrigin: "left" }}
        className="absolute left-[8%] right-[8%] top-5 hidden h-px bg-border-strong md:block"
      />
      <div className="grid gap-10 text-left md:grid-cols-3">
        {steps.map((s, i) =>
          reduce ? (
            <div key={s.n} className="relative">
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary font-[family-name:var(--font-display)] text-sm font-bold text-on-brand-primary">
                {s.n}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-on-surface">{s.title}</h3>
              <p className="mt-1.5 text-sm text-on-surface-2">{s.desc}</p>
            </div>
          ) : (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
              className="relative"
            >
              <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary font-[family-name:var(--font-display)] text-sm font-bold text-on-brand-primary">
                {s.n}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-on-surface">{s.title}</h3>
              <p className="mt-1.5 text-sm text-on-surface-2">{s.desc}</p>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
