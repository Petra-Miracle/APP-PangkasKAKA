"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight, Scissors } from "lucide-react";
import { api, Barber, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";
import { ErrorState } from "@/components/ui/StatePanel";
import { cardClass } from "@/components/ui/card";

export default function PilihLayananPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { authed, loading: authLoading } = useRequireAuth(`/booking/${id}/layanan`);

  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .barberDetail(id)
      .then(setBarber)
      .catch((err) => setError(err.message ?? "Barber tidak ditemukan"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  if (authLoading || !authed) return <InlineLoading message="Memeriksa sesi login..." />;
  if (loading) return <InlineLoading message="Memuat data barber..." />;

  if (error || !barber) {
    return (
      <main className="flex-1">
        <BookingStepper active={1} />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <ErrorState title="Barber tidak ditemukan" description={error ?? undefined} onAction={load} />
        </div>
      </main>
    );
  }

  const services = barber.services ?? [];

  return (
    <main className="flex-1">
      <BookingStepper active={1} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-bold text-on-surface">{barber.name}</h1>
        <p className="text-xs text-on-surface-3">StreetBarber · {barber.shop_name || "Kupang"}</p>
        <p className="mt-4 text-xs text-on-surface-3">
          Layanan yang dipilih akan otomatis masuk ke ringkasan booking kamu di langkah
          berikutnya.
        </p>

        <h2 className="mt-6 text-sm font-semibold text-on-surface-2">Pilih Layanan</h2>
        <div className="mt-3 space-y-2.5">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/booking/${id}/jadwal?service=${s.id}`}
              className={cardClass({ hoverable: true, padding: "p-4", className: "flex items-center gap-4" })}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3">
                <Scissors size={16} className="text-brand-secondary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">{s.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-3">
                  <Clock size={11} aria-hidden="true" /> {s.duration} menit
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-brand-secondary">{formatIDR(s.price)}</span>
              <ChevronRight size={16} className="shrink-0 text-on-surface-3" aria-hidden="true" />
            </Link>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-on-surface-3">Belum ada layanan tersedia dari barber ini.</p>
          )}
        </div>
      </div>
    </main>
  );
}
