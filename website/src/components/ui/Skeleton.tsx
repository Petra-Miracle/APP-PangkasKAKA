export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-3 ${className}`} aria-hidden="true" />;
}

/** Bentuk kartu barber/produk saat memuat — dimensi sama dengan kartu asli supaya tidak ada layout shift. */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4" aria-hidden="true">
      <Skeleton className="h-36 w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}
