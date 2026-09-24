"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation, CalendarClock } from "lucide-react";
import { api, Booking, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Badge, { BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/card";
import Skeleton from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/StatePanel";

const TABS = ["Semua", "Berlangsung", "Selesai", "Dibatalkan"] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  confirmed: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "warning",
  confirmed: "blue",
  completed: "success",
  cancelled: "error",
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
    <main className="mx-auto max-w-[1152px] flex-1 px-6 py-10 md:px-12 lg:px-20">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-on-surface">
        Riwayat Pemesanan
      </h1>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${
              tab === t
                ? "border-brand-primary bg-brand-primary text-on-brand-primary shadow-soft"
                : "border-border text-on-surface-2 hover:border-border-strong"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {authLoading || loading ? (
        <div className="mt-6 space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Memuat riwayat pemesanan...</span>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cardClass({ padding: "p-5" })}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-4 h-8 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState className="mt-8" description={error} onAction={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<CalendarClock size={20} aria-hidden="true" />}
          title="Belum ada pemesanan"
          description="Belum ada pemesanan di kategori ini. Yuk mulai booking barbershop atau StreetBarber."
          actionLabel="Jelajahi Barber"
          actionHref="/jelajahi"
        />
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className={cardClass({ padding: "p-5" })}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
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
                <Badge tone={STATUS_TONE[b.status] ?? "neutral"} className="shrink-0">
                  {STATUS_LABEL[b.status] ?? b.status}
                </Badge>
              </div>

              {b.status === "confirmed" && b.delivery_mode === "rumah" ? (
                <Button href={`/tracking/${b.id}`} size="sm" icon={<Navigation size={13} aria-hidden="true" />} className="mt-3">
                  Lacak StreetBarber
                </Button>
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
