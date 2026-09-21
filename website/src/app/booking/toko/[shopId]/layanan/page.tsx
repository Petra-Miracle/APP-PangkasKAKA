"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, User } from "lucide-react";
import { api, Shop, formatIDR } from "@/lib/api";
import BookingStepper from "@/components/BookingStepper";
import LoadingScreen from "@/components/LoadingScreen";

export default function PilihLayananTokoPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = use(params);
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");

  useEffect(() => {
    api
      .shopDetail(shopId)
      .then(setShop)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shopId]);

  if (loading) return <LoadingScreen message="Memuat data toko..." />;

  const barbers = (shop?.barbers ?? []).filter((b) => !b.is_street_barber);
  const services = shop?.services ?? [];

  function next() {
    router.push(`/booking/toko/${shopId}/jadwal?barber=${barberId}&service=${serviceId}`);
  }

  return (
    <main className="flex-1">
      <BookingStepper active={1} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">{shop?.name ?? "Toko tidak ditemukan"}</h1>
        <p className="text-xs text-on-surface-3">Barbershop</p>

        <h2 className="mt-6 text-sm font-semibold text-on-surface-2">Pilih Barber</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setBarberId(b.id)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                barberId === b.id
                  ? "border-brand-primary bg-brand-primary text-on-brand-primary"
                  : "border-border text-on-surface-2 hover:border-border-strong"
              }`}
            >
              <User size={14} />
              {b.name}
            </button>
          ))}
          {barbers.length === 0 && shop && (
            <p className="text-sm text-on-surface-3">Belum ada barber di toko ini.</p>
          )}
        </div>

        <h2 className="mt-8 text-sm font-semibold text-on-surface-2">Pilih Layanan</h2>
        <div className="mt-3 space-y-2.5">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => setServiceId(s.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition ${
                serviceId === s.id
                  ? "border-brand-primary bg-brand-dim"
                  : "border-border bg-surface-2 hover:border-border-strong"
              }`}
            >
              <div>
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-3">
                  <Clock size={11} /> {s.duration} menit
                </p>
              </div>
              <span className="text-sm font-bold text-brand-secondary">{formatIDR(s.price)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={next}
          disabled={!barberId || !serviceId}
          className="mt-8 w-full rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-40"
        >
          Lanjut Pilih Jadwal
        </button>
      </div>
    </main>
  );
}
