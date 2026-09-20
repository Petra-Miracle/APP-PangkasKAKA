"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Barber, formatIDR } from "@/lib/api";
import BookingStepper from "@/components/BookingStepper";

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

  const [barber, setBarber] = useState<Barber | null>(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    api.barberDetail(id).then(setBarber).catch(() => {});
  }, [id]);

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
