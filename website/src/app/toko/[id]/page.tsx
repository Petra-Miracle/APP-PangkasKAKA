import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Clock, MapPin } from "lucide-react";
import { api, formatIDR } from "@/lib/api";

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shop = await api.shopDetail(id).catch(() => null);
  if (!shop) notFound();

  const services = shop.services ?? [];
  const reviews = shop.reviews ?? [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : shop.rating;

  return (
    <main className="flex-1 px-6 py-8 md:px-20">
      <div className="text-xs text-on-surface-3">
        <Link href="/jelajahi" className="hover:text-on-surface">Jelajahi Barber</Link>
        <span className="mx-1.5">›</span>
        <span className="text-on-surface-2">{shop.name}</span>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div
            className="h-72 w-full rounded-2xl bg-cover bg-center bg-surface-3 md:h-96"
            style={shop.image ? { backgroundImage: `url('${shop.image}')` } : undefined}
          />

          <h2 className="mt-8 text-lg font-semibold">Tentang</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-2">
            {shop.name} berlokasi di {shop.address}.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Daftar Layanan</h2>
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-3">
                    <Clock size={11} /> {s.duration} menit
                  </p>
                </div>
                <span className="text-sm font-bold text-brand-secondary">{formatIDR(s.price)}</span>
              </div>
            ))}
            {services.length === 0 && (
              <p className="px-5 py-6 text-sm text-on-surface-3">Belum ada layanan terdaftar.</p>
            )}
          </div>

          {reviews.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-semibold">
                Rating &amp; Review{" "}
                <span className="text-sm font-normal text-on-surface-3">
                  · {avgRating?.toFixed(1)} dari {reviews.length} ulasan
                </span>
              </h2>
              <div className="mt-3 space-y-3">
                {reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{r.reviewer?.name ?? "Pengguna"}</span>
                      <span className="flex items-center gap-1 text-xs text-brand-secondary">
                        <Star size={12} className="fill-brand-secondary" /> {r.rating}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-xs text-on-surface-2">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface-2 p-6">
          <h3 className="text-lg font-semibold">{shop.name}</h3>
          <p className="text-xs text-on-surface-3">Barbershop</p>
          {avgRating != null && (
            <div className="mt-2 flex items-center gap-1 text-sm">
              <Star size={14} className="fill-brand-secondary text-brand-secondary" />
              {avgRating.toFixed(1)}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs text-on-surface-2">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            {shop.address}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-on-surface-3">Mulai dari</p>
            <p className="text-xl font-bold text-on-surface">{formatIDR(shop.min_price)}</p>
          </div>

          <Link
            href={`/booking/toko/${shop.id}/layanan`}
            className="mt-4 block rounded-lg bg-brand-primary py-3.5 text-center text-sm font-bold text-on-brand-primary transition hover:brightness-110"
          >
            Booking Sekarang
          </Link>
          <p className="mt-3 text-center text-[11px] text-on-surface-3">
            Gratis dibatalkan hingga 1 jam sebelum jadwal.
          </p>
        </aside>
      </div>
    </main>
  );
}
