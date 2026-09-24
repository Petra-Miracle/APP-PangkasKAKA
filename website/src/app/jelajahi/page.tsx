"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Search, Star, MapPin, Home, Store, Bike, SlidersHorizontal } from "lucide-react";
import { api, formatIDR, Shop, Barber } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import { cardClass } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/StatePanel";
import { CardSkeleton } from "@/components/ui/Skeleton";

// Sama seperti fallback di aplikasi mobile — kalau izin lokasi ditolak/gagal,
// StreetBarber terdekat tetap dicari dari titik default Kupang, bukan dibiarkan
// kosong tanpa penjelasan.
const KUPANG_FALLBACK = { lat: -10.1789, lng: 123.607 };

type Card = {
  id: string;
  kind: "shop" | "barber";
  name: string;
  category: string;
  image?: string;
  rating?: number;
  distanceKm?: number | null;
  priceFrom?: number | null;
  href: string;
};

const FILTERS = ["Semua", "Barbershop", "StreetBarber", "Rating 4.5+"] as const;
const FILTER_ICON: Partial<Record<(typeof FILTERS)[number], typeof Store>> = {
  Barbershop: Store,
  StreetBarber: Bike,
};

function JelajahiContent() {
  const searchParams = useSearchParams();
  const initialFilter = FILTERS.find((f) => f === searchParams.get("filter")) ?? "Semua";
  const homeService = initialFilter === "StreetBarber";

  const [shops, setShops] = useState<Shop[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShops = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .listShops()
      .then((r) => setShops(r.shops))
      .catch((err) => setError(err.message ?? "Gagal memuat daftar barber"))
      .finally(() => setLoading(false));
  }, []);

  const loadNearbyBarbers = useCallback((coords: { lat: number; lng: number }) => {
    api
      .nearbyBarbers(coords.lat, coords.lng)
      .then((r) => setBarbers(r.barbers))
      .catch(() => {}); // sekunder terhadap daftar toko — kegagalan di sini tidak memblokir halaman
  }, []);

  useEffect(() => {
    loadShops();

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadNearbyBarbers({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => loadNearbyBarbers(KUPANG_FALLBACK),
        { timeout: 4000 }
      );
    } else {
      loadNearbyBarbers(KUPANG_FALLBACK);
    }
  }, [loadShops, loadNearbyBarbers]);

  const cards = useMemo<Card[]>(() => {
    const shopCards: Card[] = shops.map((s) => ({
      id: s.id,
      kind: "shop",
      name: s.name,
      category: "Barbershop",
      image: s.image,
      rating: s.rating,
      distanceKm: s.distance_km,
      priceFrom: s.min_price,
      href: `/toko/${s.id}`,
    }));
    const barberCards: Card[] = barbers.map((b) => ({
      id: b.id,
      kind: "barber",
      name: b.name,
      category: "StreetBarber",
      image: b.photo,
      rating: b.rating,
      distanceKm: b.distance_km,
      priceFrom: undefined,
      href: `/barber/${b.id}`,
    }));
    let all = [...shopCards, ...barberCards];
    if (filter === "Barbershop") all = all.filter((c) => c.kind === "shop");
    if (filter === "StreetBarber") all = all.filter((c) => c.kind === "barber");
    if (filter === "Rating 4.5+") all = all.filter((c) => (c.rating ?? 0) >= 4.5);
    if (query.trim()) {
      const q = query.toLowerCase();
      all = all.filter((c) => c.name.toLowerCase().includes(q));
    }
    return all;
  }, [shops, barbers, filter, query]);

  return (
    <main className="mx-auto max-w-[1152px] flex-1 px-6 py-10 md:px-12 lg:px-20">
      {homeService && (
        <Badge tone="brand" icon={<Home size={12} aria-hidden="true" />} className="mb-3">
          LAYANAN PANGGIL KE RUMAH
        </Badge>
      )}
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
        {homeService ? "Booking StreetBarber ke Rumah" : "Jelajahi Barber"}
      </h1>
      <p className="mt-2 max-w-lg text-sm text-on-surface-2">
        {homeService
          ? "Nggak perlu keluar rumah — pilih StreetBarber terdekat, dia yang datang ke kamu."
          : `${shops.length || "..."} barbershop dan StreetBarber siap melayani di sekitar Kupang.`}
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-3 shadow-soft md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
          <Search size={16} className="shrink-0 text-on-surface-3" aria-hidden="true" />
          <span className="sr-only">Cari barbershop atau StreetBarber</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama barbershop atau StreetBarber..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-3"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={14} className="hidden shrink-0 text-on-surface-3 md:block" aria-hidden="true" />
          {FILTERS.map((f) => {
            const FIcon = FILTER_ICON[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                  filter === f
                    ? "border-brand-primary bg-brand-primary text-on-brand-primary"
                    : "border-border text-on-surface-2 hover:border-border-strong hover:bg-surface"
                }`}
              >
                {FIcon && <FIcon size={12} aria-hidden="true" />}
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Menjelajahi barber di sekitarmu...</span>
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState className="mt-8" description={error} onAction={loadShops} />
      ) : cards.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Tidak ada hasil yang cocok"
          description="Coba ubah kata kunci pencarian atau ganti filter di atas."
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={`${c.kind}-${c.id}`}
              href={c.href}
              className={cardClass({ hoverable: true, padding: "p-0", className: "group flex h-full flex-col overflow-hidden" })}
            >
              <div className="relative h-40 w-full shrink-0 overflow-hidden bg-surface-3">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-on-surface-3">
                    {c.kind === "shop" ? <Store size={28} aria-hidden="true" /> : <Bike size={28} aria-hidden="true" />}
                  </div>
                )}
                <Badge
                  tone={c.kind === "shop" ? "blue" : "brand"}
                  icon={c.kind === "shop" ? <Store size={11} aria-hidden="true" /> : <Bike size={11} aria-hidden="true" />}
                  className="absolute left-3 top-3 bg-white/95 shadow-soft"
                >
                  {c.category}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-semibold text-on-surface">{c.name}</h3>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-on-surface-3">
                  {c.rating != null ? (
                    <span className="flex items-center gap-1">
                      <Star size={12} className="fill-brand-secondary text-brand-secondary" aria-hidden="true" />
                      {c.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span>Belum ada rating</span>
                  )}
                  {c.distanceKm != null && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} aria-hidden="true" />
                      {c.distanceKm.toFixed(1)} km
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                  <span className="text-sm font-bold text-on-surface">
                    {c.priceFrom != null ? `Mulai ${formatIDR(c.priceFrom)}` : " "}
                  </span>
                  <span className="shrink-0 rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-on-brand-primary transition group-hover:bg-brand-secondary group-hover:text-white">
                    Lihat Detail
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default function JelajahiPage() {
  return (
    <Suspense>
      <JelajahiContent />
    </Suspense>
  );
}
