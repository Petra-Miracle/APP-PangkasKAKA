"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Star, MapPin, Home } from "lucide-react";
import { api, formatIDR, Shop, Barber } from "@/lib/api";
import LoadingScreen from "@/components/LoadingScreen";

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

function JelajahiContent() {
  const searchParams = useSearchParams();
  const initialFilter = FILTERS.find((f) => f === searchParams.get("filter")) ?? "Semua";
  const homeService = initialFilter === "StreetBarber";

  const [shops, setShops] = useState<Shop[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(initialFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listShops()
      .then((r) => setShops(r.shops))
      .catch(() => {})
      .finally(() => setLoading(false));

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api
            .nearbyBarbers(pos.coords.latitude, pos.coords.longitude)
            .then((r) => setBarbers(r.barbers))
            .catch(() => {});
        },
        () => {},
        { timeout: 4000 }
      );
    }
  }, []);

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
    <main className="flex-1 px-6 py-10 md:px-20">
      {homeService && (
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-dim px-3 py-1.5 text-xs font-bold text-brand-secondary">
          <Home size={13} /> LAYANAN PANGGIL KE RUMAH
        </span>
      )}
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
        {homeService ? "Booking StreetBarber ke Rumah" : "Jelajahi Barber"}
      </h1>
      <p className="mt-2 text-sm text-on-surface-2">
        {homeService
          ? "Nggak perlu keluar rumah — pilih StreetBarber terdekat, dia yang datang ke kamu."
          : `${shops.length || "..."} barbershop dan StreetBarber siap melayani di sekitar Kupang.`}
      </p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3">
          <Search size={16} className="text-on-surface-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama barbershop atau StreetBarber..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-3"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                filter === f
                  ? "border-brand-primary bg-brand-primary text-on-brand-primary"
                  : "border-border text-on-surface-2 hover:border-border-strong"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingScreen message="Menjelajahi barber di sekitarmu..." />
      ) : cards.length === 0 ? (
        <div className="mt-16 text-center text-sm text-on-surface-3">
          Tidak ada hasil yang cocok.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={`${c.kind}-${c.id}`}
              href={c.href}
              className="group overflow-hidden rounded-xl border border-border bg-surface-2 transition hover:border-border-strong"
            >
              <div
                className="h-40 w-full bg-cover bg-center bg-surface-3"
                style={c.image ? { backgroundImage: `url('${c.image}')` } : undefined}
              />
              <div className="p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-secondary">
                  {c.category}
                </span>
                <h3 className="mt-1 text-base font-semibold">{c.name}</h3>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-on-surface-3">
                  {c.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star size={12} className="fill-brand-secondary text-brand-secondary" />
                      {c.rating.toFixed(1)}
                    </span>
                  )}
                  {c.distanceKm != null && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {c.distanceKm.toFixed(1)} km
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">
                    {c.priceFrom != null ? `Mulai ${formatIDR(c.priceFrom)}` : ""}
                  </span>
                  <span className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-on-brand-primary transition group-hover:brightness-110">
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
