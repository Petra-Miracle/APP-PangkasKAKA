"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { api, Booking, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import InlineLoading from "@/components/InlineLoading";

const TABS = ["Semua", "Berlangsung", "Selesai", "Dibatalkan"] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  confirmed: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

function tabMatches(tab: (typeof TABS)[number], status: string) {
  if (tab === "Semua") return true;
  if (tab === "Berlangsung") return status === "confirmed" || status === "pending";
  if (tab === "Selesai") return status === "completed";
  return status === "cancelled";
}

export default function RiwayatPage() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Semua");

  const load = useCallback(() => {
    if (!token) return;
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .myBookings(token)
      .then((r) => setBookings(r.bookings))
      .catch((err) => setError(err.message ?? "Gagal memuat riwayat pemesanan"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.replace("/masuk?next=/riwayat");
      return;
    }
    load();
  }, [authLoading, user, token, router, load]);

  const filtered = bookings.filter((b) => tabMatches(tab, b.status));

  return (
    <main className="flex-1 px-6 py-10 md:px-20">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Riwayat Pemesanan
      </h1>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${
              tab === t
                ? "border-brand-primary bg-brand-primary text-on-brand-primary"
                : "border-border text-on-surface-2"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {authLoading || loading ? (
        <InlineLoading message="Memuat riwayat pemesanan..." />
      ) : error ? (
        <div role="alert" className="mt-16 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={28} className="text-error" />
          <p className="max-w-xs text-sm text-on-surface-2">{error}</p>
          <button
            onClick={load}
            className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            Coba Lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-sm text-on-surface-3">Belum ada pemesanan di kategori ini.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-surface-2 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {b.barber?.name ?? b.shop?.name ?? "Barber"} ·{" "}
                    {b.delivery_mode === "rumah" ? "StreetBarber" : "Barbershop"}
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-3">
                    {b.service?.name} ·{" "}
                    {new Date(b.booking_date + "T00:00:00").toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    , {b.booking_time}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-3 px-3 py-1 text-[11px] font-semibold text-on-surface-2">
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </div>

              {b.status === "confirmed" && b.delivery_mode === "rumah" ? (
                <Link
                  href={`/tracking/${b.id}`}
                  className="mt-3 inline-block rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-on-brand-primary"
                >
                  Lacak StreetBarber
                </Link>
              ) : (
                <p className="mt-3 text-sm font-bold text-on-surface">
                  {formatIDR(b.amount_total_charged)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
