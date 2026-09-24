import { ReactNode } from "react";

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
}) {
  const alignClass = align === "center" ? "mx-auto text-center" : "text-left";

  return (
    <div className={`max-w-xl ${alignClass}`}>
      {eyebrow && (
        <span
          className={`text-xs font-bold tracking-widest ${
            tone === "dark" ? "text-brand-primary" : "text-brand-secondary"
          }`}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={`mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-4xl ${
          tone === "dark" ? "text-white" : "text-on-surface"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p className={`mt-3 text-sm leading-relaxed md:text-base ${tone === "dark" ? "text-white/70" : "text-on-surface-2"}`}>
          {description}
        </p>
      )}
    </div>
  );
}
