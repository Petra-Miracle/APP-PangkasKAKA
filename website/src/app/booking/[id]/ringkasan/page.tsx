"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { api, Barber, formatIDR } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import InlineLoading from "@/components/InlineLoading";

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

  const service = barber?.services?.find((s) => s.id === serviceId);

  function onConfirm() {
    const qs = new URLSearchParams({ service: serviceId, date, time, address }).toString();
    router.push(`/booking/${id}/pembayaran?${qs}`);
  }

  return (
    <main className="flex-1">
      <BookingStepper active={3} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold">Ringkasan Booking</h1>
        {barber && (
          <>
            <p className="mt-4 text-sm font-semibold">{barber.name}</p>
            <p className="text-xs text-on-surface-3">StreetBarber Independen</p>
          </>
        )}

        <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface-2 p-5 text-sm">
          <Row label="Layanan" value={service?.name ?? "-"} />
          <Row label="Tanggal" value={date ? formatTanggal(date) : "-"} />
          <Row label="Jam" value={time ? `${time} WITA` : "-"} />
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold text-on-surface-2">
            Lokasi — alamat rumah untuk dikunjungi
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Jl. Timor Raya No. 12, Naikoten"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand-primary"
          />
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <Row label="Subtotal Layanan" value={formatIDR(service?.price)} />
          <p className="text-[11px] text-on-surface-3">
            Biaya layanan aplikasi dihitung otomatis saat konfirmasi pembayaran.
          </p>
        </div>

        <button
          onClick={onConfirm}
          disabled={!service || !date || !time || !address.trim()}
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
