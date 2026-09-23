"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation } from "lucide-react";
import { api, Booking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import InlineLoading from "@/components/InlineLoading";

export default function TrackingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.replace(`/masuk?next=/tracking/${bookingId}`);
      return;
    }
    api
      .bookingDetail(bookingId, token)
      .then(setBooking)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, token, bookingId, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const poll = () => {
      api
        .karyawanLocation(bookingId, token)
        .then((loc) => {
          if (cancelled) return;
          setDistanceKm(loc.distance_km ?? null);
          setUpdatedAt(loc.updated_at);
          setLocError("");
        })
        .catch((err) => {
          if (!cancelled) setLocError(err.message ?? "Lokasi belum tersedia");
        });
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token, bookingId]);

  const etaMinutes = distanceKm != null ? Math.max(1, Math.round((distanceKm / 25) * 60)) : null;

  if (loading) return <InlineLoading message="Memuat status pemesanan..." />;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <div className="flex h-64 flex-1 items-center justify-center bg-surface-2 md:h-auto">
        {locError ? (
          <p className="max-w-xs px-6 text-center text-sm text-on-surface-3">{locError}</p>
        ) : (
          <div className="text-center text-on-surface-3">
            <Navigation size={32} className="mx-auto text-brand-secondary" />
            <p className="mt-2 text-xs">
              Peta interaktif untuk versi web sedang disiapkan — posisi StreetBarber di bawah
              tetap live.
            </p>
          </div>
        )}
      </div>

      <aside className="w-full border-t border-border p-6 md:w-[380px] md:border-l md:border-t-0">
        <h1 className="text-lg font-semibold">Menuju Lokasi Kamu</h1>
        <p className="mt-3 text-sm font-semibold">{booking?.barber?.name ?? "StreetBarber"}</p>
        <p className="text-xs text-on-surface-3">StreetBarber Independen</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-xs text-on-surface-3">Estimasi Tiba</p>
            <p className="mt-1 text-lg font-bold">
              {etaMinutes != null ? `${etaMinutes} menit` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <p className="text-xs text-on-surface-3">Jarak</p>
            <p className="mt-1 text-lg font-bold">
              {distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
          <div>
            <p className="text-xs text-on-surface-3">Layanan</p>
            <p className="font-medium">{booking?.service?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-3">Jadwal</p>
            <p className="font-medium">
              {booking
                ? `${new Date(booking.booking_date + "T00:00:00").toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })} · ${booking.booking_time}`
                : "-"}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={13} className="mt-0.5 shrink-0 text-on-surface-3" />
            <div>
              <p className="text-xs text-on-surface-3">Tujuan</p>
              <p className="font-medium">{booking?.shop?.address ?? "-"}</p>
            </div>
          </div>
        </div>
        {updatedAt && (
          <p className="mt-4 text-[11px] text-on-surface-3">
            Update terakhir: {new Date(updatedAt).toLocaleTimeString("id-ID")}
          </p>
        )}
      </aside>
    </main>
  );
}
