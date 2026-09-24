import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Clock, MapPin, CreditCard, Scissors, Bike } from "lucide-react";
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
  const barber = await api.barberDetail(id).catch(() => null);
  if (!barber) return { title: "StreetBarber tidak ditemukan" };
  const description = `${barber.name} — StreetBarber independen panggilan ke rumah${barber.shop_name ? `, divalidasi ${barber.shop_name}` : ""}. Lihat layanan dan harga, lalu booking dari browser.`;
  return {
    title: barber.name,
    description,
    openGraph: { title: barber.name, description, images: barber.photo ? [barber.photo] : undefined },
  };
}

export default async function BarberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const barber = await api.barberDetail(id).catch(() => null);
  if (!barber) notFound();

  const services = barber.services ?? [];
  const minPrice = services.length ? Math.min(...services.map((s) => s.price)) : null;

  return (
    <main className="mx-auto max-w-[1152px] flex-1 px-6 py-8 md:px-12 lg:px-20">
      <nav aria-label="Navigasi breadcrumb" className="text-xs text-on-surface-3">
        <Link href="/jelajahi" className="hover:text-on-surface">Jelajahi Barber</Link>
        <span className="mx-1.5" aria-hidden="true">›</span>
        <span className="text-on-surface-2">{barber.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-surface-3 shadow-soft md:h-96">
            {barber.photo ? (
              <Image
                src={barber.photo}
                alt={`Foto ${barber.name}`}
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-on-surface-3">
                <Bike size={40} aria-hidden="true" />
              </div>
            )}
            <Badge tone="brand" icon={<Bike size={11} aria-hidden="true" />} className="absolute left-4 top-4 bg-white/95 shadow-soft">
              StreetBarber Independen
            </Badge>
          </div>

          <h2 className="mt-8 text-lg font-bold text-on-surface">Tentang</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-2">
            {barber.name} adalah StreetBarber independen yang melayani panggilan home-service di
            area {barber.shop_name ? `sekitar ${barber.shop_name}` : "Kupang"} dan sekitarnya.
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
        </div>

        <aside className={cardClass({ padding: "p-6", className: "h-fit shadow-elevated lg:sticky lg:top-28" })}>
          <h1 className="text-lg font-bold text-on-surface">{barber.name}</h1>
          <p className="text-xs text-on-surface-3">StreetBarber Independen</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            {barber.rating != null ? (
              <>
                <Star size={14} className="fill-brand-secondary text-brand-secondary" aria-hidden="true" />
                <span className="font-semibold text-on-surface">{barber.rating.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-on-surface-3">Belum ada rating</span>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4 text-xs">
            <div className="flex items-center gap-2 text-on-surface-2">
              <MapPin size={13} aria-hidden="true" />
              Divalidasi oleh {barber.shop_name || "—"}
            </div>
            <div className="flex items-center gap-2 text-on-surface-2">
              <CreditCard size={13} aria-hidden="true" />
              QRIS, Transfer Bank
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-on-surface-3">Mulai dari</p>
            <p className="text-xl font-bold text-on-surface">{minPrice != null ? formatIDR(minPrice) : "—"}</p>
          </div>

          <Button href={`/booking/${barber.id}/layanan`} fullWidth size="lg" className="mt-4">
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
