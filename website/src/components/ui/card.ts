/**
 * Class-string helper (bukan komponen) supaya bisa dipakai di <Link>, <div>,
 * atau <button> tanpa memaksa satu jenis tag — dipakai untuk kartu barber,
 * produk, layanan, dan ringkasan booking.
 */
export function cardClass({
  hoverable = false,
  padding = "p-5",
  className = "",
}: {
  hoverable?: boolean;
  padding?: string;
  className?: string;
} = {}) {
  return [
    // "block" wajib eksplisit: helper ini sering dipakai di <Link> (next/link
    // merender <a>, default display:inline browser) — tanpa ini, anchor yang
    // berisi anak block (div/h3/p) pecah jadi anonymous block box dan
    // background/border kartu jadi tidak menyatu dengan kontennya. Caller yang
    // butuh flex tetap bisa override lewat className (mis. "flex h-full flex-col").
    "block rounded-2xl border border-border bg-surface-2 shadow-soft",
    padding,
    hoverable &&
      "transition hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-elevated focus-visible:-translate-y-0.5",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
