import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Clock, MapPin, CreditCard } from "lucide-react";
import { api, formatIDR } from "@/lib/api";

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
    <main className="flex-1 px-6 py-8 md:px-20">
      <div className="text-xs text-on-surface-3">
        <Link href="/jelajahi" className="hover:text-on-surface">Jelajahi Barber</Link>
        <span className="mx-1.5">›</span>
        <span className="text-on-surface-2">{barber.name}</span>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-surface-3 md:h-96">
            {barber.photo && (
              <Image
                src={barber.photo}
                alt={barber.name}
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
                priority
              />
            )}
          </div>

          <h2 className="mt-8 text-lg font-semibold">Tentang</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-2">
            {barber.name} adalah StreetBarber independen yang melayani panggilan home-service di
            area {barber.shop_name ? `sekitar ${barber.shop_name}` : "Kupang"} dan sekitarnya.
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
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface-2 p-6">
          <h3 className="text-lg font-semibold">{barber.name}</h3>
          <p className="text-xs text-on-surface-3">StreetBarber Independen</p>
          {barber.rating != null && (
            <div className="mt-2 flex items-center gap-1 text-sm">
              <Star size={14} className="fill-brand-secondary text-brand-secondary" />
              {barber.rating.toFixed(1)}
            </div>
          )}

          <div className="mt-4 space-y-3 border-t border-border pt-4 text-xs">
            <div className="flex items-center gap-2 text-on-surface-2">
              <MapPin size={13} />
              Divalidasi oleh {barber.shop_name || "—"}
            </div>
            <div className="flex items-center gap-2 text-on-surface-2">
              <CreditCard size={13} />
              QRIS, Transfer Bank
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-on-surface-3">Mulai dari</p>
            <p className="text-xl font-bold text-on-surface">{formatIDR(minPrice)}</p>
          </div>

          <Link
            href={`/booking/${barber.id}/layanan`}
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
