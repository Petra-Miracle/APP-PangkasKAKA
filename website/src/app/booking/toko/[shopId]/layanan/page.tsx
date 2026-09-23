"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, User, AlertCircle } from "lucide-react";
import { api, Shop, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";

export default function PilihLayananTokoPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = use(params);
  const router = useRouter();
  const { authed, loading: authLoading } = useRequireAuth(`/booking/toko/${shopId}/layanan`);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const load = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .shopDetail(shopId)
      .then(setShop)
      .catch((err) => setError(err.message ?? "Toko tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (authLoading || !authed) return <InlineLoading message="Memeriksa sesi login..." />;
  if (loading) return <InlineLoading message="Memuat data toko..." />;

  if (error || !shop) {
    return (
      <main className="flex-1">
        <BookingStepper active={1} />
        <div role="alert" className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-16 text-center">
          <AlertCircle size={28} className="text-error" />
          <p className="text-sm text-on-surface-2">{error ?? "Toko tidak ditemukan."}</p>
          <button
            onClick={load}
            className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            Coba Lagi
          </button>
        </div>
      </main>
    );
  }

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
              aria-pressed={barberId === b.id}
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
              aria-pressed={serviceId === s.id}
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
