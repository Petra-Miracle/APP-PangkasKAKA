"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, AlertCircle } from "lucide-react";
import { api, Barber, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";

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
        <div role="alert" className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-6 py-16 text-center">
          <AlertCircle size={28} className="text-error" />
          <p className="text-sm text-on-surface-2">{error ?? "Barber tidak ditemukan."}</p>
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

  const services = barber.services ?? [];

  return (
    <main className="flex-1">
      <BookingStepper active={1} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">{barber.name}</h1>
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
              className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-5 py-4 transition hover:border-brand-primary"
            >
              <div>
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-3">
                  <Clock size={11} /> {s.duration} menit
                </p>
              </div>
              <span className="text-sm font-bold text-brand-secondary">{formatIDR(s.price)}</span>
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
