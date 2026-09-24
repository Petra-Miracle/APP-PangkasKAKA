import { ReactNode } from "react";

export type BadgeTone = "brand" | "success" | "neutral" | "error" | "blue" | "warning";

const TONE_CLASS: Record<BadgeTone, string> = {
  brand: "bg-brand-dim text-brand-secondary",
  success: "bg-success/10 text-success",
  neutral: "bg-surface-3 text-on-surface-3",
  error: "bg-error/10 text-error",
  blue: "bg-accent-blue-dim text-accent-blue",
  warning: "bg-warning/15 text-warning",
};

/**
 * Selalu sertakan label teks (bukan cuma warna) supaya status tetap jelas
 * tanpa bergantung pada persepsi warna — lihat aturan aksesibilitas di brief.
 */
export default function Badge({
  children,
  tone = "neutral",
  icon,
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE_CLASS[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
