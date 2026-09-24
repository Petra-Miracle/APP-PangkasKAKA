import { ReactNode } from "react";

type Tone = "surface" | "surface-2" | "navy";

const TONE_CLASS: Record<Tone, string> = {
  surface: "",
  "surface-2": "bg-surface-2",
  navy: "bg-[#0f1a2e] text-white",
};

/**
 * Wrapper section standar: max-width + padding konsisten di seluruh halaman.
 * `navTheme` menandai section untuk IntersectionObserver di Navbar (lihat
 * data-nav-theme di Navbar.tsx) supaya navbar otomatis gelap di atas section navy.
 */
export default function Section({
  children,
  id,
  tone = "surface",
  className = "",
  innerClassName = "",
  navTheme,
  border,
  as: Comp = "section",
}: {
  children: ReactNode;
  id?: string;
  tone?: Tone;
  className?: string;
  innerClassName?: string;
  navTheme?: "light" | "dark";
  border?: "top" | "y" | "none";
  as?: "section" | "div";
}) {
  const borderClass =
    border === "top" ? "border-t border-border" : border === "y" ? "border-y border-border" : "";

  return (
    <Comp
      id={id}
      data-nav-theme={navTheme}
      className={`scroll-mt-24 py-14 md:py-20 ${TONE_CLASS[tone]} ${borderClass} ${className}`}
    >
      <div className={`section-shell ${innerClassName}`}>{children}</div>
    </Comp>
  );
}
