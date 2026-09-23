"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { api, Shop, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";

function formatTanggal(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

export default function RingkasanTokoPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const barberId = search.get("barber") ?? "";
  const serviceId = search.get("service") ?? "";
  const date = search.get("date") ?? "";
  const time = search.get("time") ?? "";
  const { authed, loading: authLoading } = useRequireAuth(`/booking/toko/${shopId}/ringkasan?${search.toString()}`);

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .shopDetail(shopId)
      .then(setShop)
      .catch((err) => setError(err.message ?? "Gagal memuat data toko"))
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (authLoading || !authed) return <InlineLoading message="Memeriksa sesi login..." />;
  if (loading) return <InlineLoading message="Menyiapkan ringkasan booking..." />;

  if (error || !shop) {
    return (
      <main className="flex-1">
        <BookingStepper active={3} />
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

  const service = shop?.services?.find((s) => s.id === serviceId);
  const barber = shop?.barbers?.find((b) => b.id === barberId);

  function onConfirm() {
    const qs = new URLSearchParams({ barber: barberId, service: serviceId, date, time }).toString();
    router.push(`/booking/toko/${shopId}/pembayaran?${qs}`);
  }

  return (
    <main className="flex-1">
      <BookingStepper active={3} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">Ringkasan Booking</h1>
        {shop && (
          <>
            <p className="mt-4 text-sm font-semibold">{shop.name}</p>
            <p className="text-xs text-on-surface-3">{shop.address}</p>
          </>
        )}

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface-2 p-5 text-sm">
          <Row label="Barber" value={barber?.name ?? "-"} />
          <Row label="Layanan" value={service?.name ?? "-"} />
          <Row label="Tanggal" value={date ? formatTanggal(date) : "-"} />
          <Row label="Jam" value={time ? `${time} WITA` : "-"} />
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <Row label="Subtotal Layanan" value={formatIDR(service?.price)} />
          <p className="text-[11px] text-on-surface-3">
            Biaya layanan aplikasi dihitung otomatis saat konfirmasi pembayaran.
          </p>
        </div>

        <button
          onClick={onConfirm}
          disabled={!service || !barber || !date || !time}
          className="mt-6 w-full rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-40"
        >
          Lanjut ke Pembayaran
        </button>
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
