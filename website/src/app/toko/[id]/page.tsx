import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Clock, MapPin, Store, Scissors } from "lucide-react";
import { api, formatIDR } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shop = await api.shopDetail(id).catch(() => null);
  if (!shop) return { title: "Toko tidak ditemukan" };
  const description = `${shop.name} di ${shop.address}. Lihat layanan, harga, dan rating, lalu booking langsung dari browser.`;
  return {
    title: shop.name,
    description,
    openGraph: { title: shop.name, description, images: shop.image ? [shop.image] : undefined },
  };
}

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
    <main className="mx-auto max-w-[1152px] flex-1 px-6 py-8 md:px-12 lg:px-20">
      <nav aria-label="Navigasi breadcrumb" className="text-xs text-on-surface-3">
        <Link href="/jelajahi" className="hover:text-on-surface">Jelajahi Barber</Link>
        <span className="mx-1.5" aria-hidden="true">›</span>
        <span className="text-on-surface-2">{shop.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-surface-3 shadow-soft md:h-96">
            {shop.image ? (
              <Image
                src={shop.image}
                alt={`Foto ${shop.name}`}
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-on-surface-3">
                <Store size={40} aria-hidden="true" />
              </div>
            )}
            <Badge tone="blue" icon={<Store size={11} aria-hidden="true" />} className="absolute left-4 top-4 bg-white/95 shadow-soft">
              Barbershop
            </Badge>
          </div>

          <h2 className="mt-8 text-lg font-bold text-on-surface">Tentang</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-2">
            {shop.name} berlokasi di {shop.address}.
          </p>

          <h2 className="mt-8 text-lg font-bold text-on-surface">Daftar Layanan</h2>
          <div className={cardClass({ padding: "p-0", className: "mt-3 divide-y divide-border" })}>
            {services.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3">
                  <Scissors size={15} className="text-brand-secondary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-3">
                    <Clock size={11} aria-hidden="true" /> {s.duration} menit
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-brand-secondary">{formatIDR(s.price)}</span>
              </div>
            ))}
            {services.length === 0 && (
              <p className="px-5 py-6 text-sm text-on-surface-3">Belum ada layanan terdaftar.</p>
            )}
          </div>

          {reviews.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-bold text-on-surface">
                Rating &amp; Review{" "}
                <span className="text-sm font-normal text-on-surface-3">
                  · {avgRating?.toFixed(1)} dari {reviews.length} ulasan
                </span>
              </h2>
              <div className="mt-3 space-y-3">
                {reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-on-surface">{r.reviewer?.name ?? "Pengguna"}</span>
                      <span className="flex items-center gap-1 text-xs text-brand-secondary">
                        <Star size={12} className="fill-brand-secondary" aria-hidden="true" /> {r.rating}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-xs text-on-surface-2">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className={cardClass({ padding: "p-6", className: "h-fit shadow-elevated lg:sticky lg:top-28" })}>
          <h1 className="text-lg font-bold text-on-surface">{shop.name}</h1>
          <p className="text-xs text-on-surface-3">Barbershop</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            {avgRating != null ? (
              <>
                <Star size={14} className="fill-brand-secondary text-brand-secondary" aria-hidden="true" />
                <span className="font-semibold text-on-surface">{avgRating.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-on-surface-3">Belum ada rating</span>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs text-on-surface-2">
            <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {shop.address}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-on-surface-3">Mulai dari</p>
            <p className="text-xl font-bold text-on-surface">{shop.min_price != null ? formatIDR(shop.min_price) : "—"}</p>
          </div>

          <Button href={`/booking/toko/${shop.id}/layanan`} fullWidth size="lg" className="mt-4">
            Booking Sekarang
          </Button>
          <p className="mt-3 text-center text-[11px] text-on-surface-3">
            Gratis dibatalkan hingga 1 jam sebelum jadwal.
          </p>
        </aside>
      </div>
    </main>
  );
}
