import { ReactNode } from "react";

export default function PhoneMockup({
  children,
  className = "",
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const dims = size === "md" ? "h-[560px] w-[272px]" : "h-[480px] w-[232px]";
  const island = size === "md" ? "h-7 w-24 top-3.5" : "h-6 w-20 top-3";

  return (
    <div
      className={`${dims} shrink-0 rounded-[48px] bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-500 p-[10px] shadow-2xl drop-shadow-2xl ${className}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-white">
        <div
          className={`absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black ${island}`}
        />
        {children}
      </div>
    </div>
  );
}
