"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { api, Barber, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";
import { ErrorState } from "@/components/ui/StatePanel";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/card";

function formatTanggal(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

export default function RingkasanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const serviceId = search.get("service") ?? "";
  const date = search.get("date") ?? "";
  const time = search.get("time") ?? "";
  const { authed, loading: authLoading } = useRequireAuth(`/booking/${id}/ringkasan?${search.toString()}`);

  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");

  // queueMicrotask menunda setState sinkron pertama supaya tidak dianggap
  // "cascading render" oleh react-hooks/set-state-in-effect — pola yang sama
  // dipakai di halaman pembayaran (lihat setStatus("creating")).
  const load = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .barberDetail(id)
      .then(setBarber)
      .catch((err) => setError(err.message ?? "Gagal memuat data barber"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (authLoading || !authed) return <InlineLoading message="Memeriksa sesi login..." />;
  if (loading) return <InlineLoading message="Menyiapkan ringkasan booking..." />;

  if (error || !barber) {
    return (
      <main className="flex-1">
        <BookingStepper active={3} />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <ErrorState title="Barber tidak ditemukan" description={error ?? undefined} onAction={load} />
        </div>
      </main>
    );
  }

  const service = barber?.services?.find((s) => s.id === serviceId);

  function onConfirm() {
    const qs = new URLSearchParams({ service: serviceId, date, time, address }).toString();
    router.push(`/booking/${id}/pembayaran?${qs}`);
  }

  const canConfirm = !!service && !!date && !!time && !!address.trim();

  return (
    <main className="flex-1">
      <BookingStepper active={3} />
      <div className="mx-auto max-w-2xl px-6 py-10 pb-28 md:pb-10">
        <h1 className="text-lg font-bold text-on-surface">Ringkasan Booking</h1>
        {barber && (
          <>
            <p className="mt-4 text-sm font-semibold text-on-surface">{barber.name}</p>
            <p className="text-xs text-on-surface-3">StreetBarber Independen</p>
          </>
        )}

        <div className={cardClass({ padding: "p-5", className: "mt-6 space-y-3 text-sm" })}>
          <Row label="Layanan" value={service?.name ?? "-"} />
          <Row label="Tanggal" value={date ? formatTanggal(date) : "-"} />
          <Row label="Jam" value={time ? `${time} WITA` : "-"} />
        </div>

        <div className="mt-5">
          <label htmlFor="alamat" className="text-xs font-semibold text-on-surface-2">
            Lokasi — alamat rumah untuk dikunjungi
          </label>
          <div className="relative mt-1.5">
            <MapPin size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-3" aria-hidden="true" />
            <input
              id="alamat"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Timor Raya No. 12, Naikoten"
              className="w-full rounded-lg border border-border bg-surface-2 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-brand-primary"
            />
          </div>
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <Row label="Subtotal Layanan" value={formatIDR(service?.price)} />
          <p className="text-[11px] text-on-surface-3">
            Biaya layanan aplikasi dihitung otomatis saat konfirmasi pembayaran.
          </p>
        </div>

        <Button onClick={onConfirm} disabled={!canConfirm} fullWidth size="lg" className="mt-6 hidden md:inline-flex">
          Lanjut ke Pembayaran
        </Button>
      </div>

      {/* CTA sticky di mobile supaya selalu terjangkau tanpa perlu scroll ke bawah. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-2/95 px-6 py-3 backdrop-blur-sm md:hidden">
        <Button onClick={onConfirm} disabled={!canConfirm} fullWidth size="lg">
          Lanjut ke Pembayaran
        </Button>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-on-surface-3">{label}</span>
      <span className="font-semibold text-on-surface">{value}</span>
    </div>
  );
}
