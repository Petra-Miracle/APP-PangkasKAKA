"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, User, Check } from "lucide-react";
import { api, Shop, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";
import { ErrorState } from "@/components/ui/StatePanel";
import Button from "@/components/ui/Button";

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
        <div className="mx-auto max-w-2xl px-6 py-16">
          <ErrorState title="Toko tidak ditemukan" description={error ?? undefined} onAction={load} />
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
      <div className="mx-auto max-w-2xl px-6 py-10 pb-28 md:pb-10">
        <h1 className="text-lg font-bold text-on-surface">{shop?.name ?? "Toko tidak ditemukan"}</h1>
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
                  ? "border-brand-primary bg-brand-primary text-on-brand-primary shadow-soft"
                  : "border-border text-on-surface-2 hover:border-border-strong"
              }`}
            >
              <User size={14} aria-hidden="true" />
              {b.name}
            </button>
          ))}
          {barbers.length === 0 && shop && (
            <p className="text-sm text-on-surface-3">Belum ada barber di toko ini.</p>
          )}
        </div>

        <h2 className="mt-8 text-sm font-semibold text-on-surface-2">Pilih Layanan</h2>
        <div className="mt-3 space-y-2.5">
          {services.map((s) => {
            const selected = serviceId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setServiceId(s.id)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition ${
                  selected
                    ? "border-brand-primary bg-brand-dim shadow-soft"
                    : "border-border bg-surface-2 hover:border-border-strong"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-3">
                    <Clock size={11} aria-hidden="true" /> {s.duration} menit
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-brand-secondary">{formatIDR(s.price)}</span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-brand-primary bg-brand-primary text-on-brand-primary" : "border-border-strong"
                  }`}
                  aria-hidden="true"
                >
                  {selected && <Check size={12} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <Button onClick={next} disabled={!barberId || !serviceId} fullWidth size="lg" className="mt-8 hidden md:inline-flex">
          Lanjut Pilih Jadwal
        </Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-2/95 px-6 py-3 backdrop-blur-sm md:hidden">
        <Button onClick={next} disabled={!barberId || !serviceId} fullWidth size="lg">
          Lanjut Pilih Jadwal
        </Button>
      </div>
    </main>
  );
}
