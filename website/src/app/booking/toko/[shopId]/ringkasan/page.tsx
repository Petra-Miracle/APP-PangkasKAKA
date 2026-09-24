"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Shop, formatIDR } from "@/lib/api";
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
        <div className="mx-auto max-w-2xl px-6 py-16">
          <ErrorState title="Toko tidak ditemukan" description={error ?? undefined} onAction={load} />
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

  const canConfirm = !!service && !!barber && !!date && !!time;

  return (
    <main className="flex-1">
      <BookingStepper active={3} />
      <div className="mx-auto max-w-2xl px-6 py-10 pb-28 md:pb-10">
        <h1 className="text-lg font-bold text-on-surface">Ringkasan Booking</h1>
        {shop && (
          <>
            <p className="mt-4 text-sm font-semibold text-on-surface">{shop.name}</p>
            <p className="text-xs text-on-surface-3">{shop.address}</p>
          </>
        )}

        <div className={cardClass({ padding: "p-5", className: "mt-6 space-y-3 text-sm" })}>
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

        <Button onClick={onConfirm} disabled={!canConfirm} fullWidth size="lg" className="mt-6 hidden md:inline-flex">
          Lanjut ke Pembayaran
        </Button>
      </div>

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
