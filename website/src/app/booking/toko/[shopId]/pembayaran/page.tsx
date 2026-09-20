"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import FauxQr from "@/components/FauxQr";
import LoadingScreen from "@/components/LoadingScreen";

const EXPIRY_SECONDS = 15 * 60;

export default function PembayaranTokoPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { token, user, loading: authLoading } = useAuth();

  const barberId = search.get("barber") ?? "";
  const serviceId = search.get("service") ?? "";
  const date = search.get("date") ?? "";
  const time = search.get("time") ?? "";

  const [status, setStatus] = useState<"idle" | "creating" | "ready" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      const next = `/booking/toko/${shopId}/pembayaran?${search.toString()}`;
      router.replace(`/masuk?next=${encodeURIComponent(next)}`);
      return;
    }
    if (submittedRef.current) return;
    submittedRef.current = true;

    queueMicrotask(() => setStatus("creating"));
    api
      .createBooking(
        {
          barber_id: barberId,
          shop_id: shopId,
          service_id: serviceId,
          booking_date: date,
          booking_time: time,
          delivery_mode: "toko",
        },
        token
      )
      .then((r) => {
        setAmount(r.booking.amount_total_charged ?? null);
        setBookingId(r.booking.id);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message ?? "Gagal membuat booking");
        setStatus("error");
      });
  }, [authLoading, user, token, shopId, barberId, serviceId, date, time, router, search]);

  useEffect(() => {
    if (status !== "ready") return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="flex-1">
      <BookingStepper active={4} />
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        {status === "creating" || authLoading ? (
          <LoadingScreen message="Menyiapkan booking kamu..." />
        ) : status === "error" ? (
          <div className="mt-10">
            <p className="text-sm text-error">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold"
            >
              Kembali
            </button>
          </div>
        ) : status === "ready" ? (
          <>
            <h1 className="text-lg font-semibold">Selesaikan Pembayaran</h1>
            <p className="mt-1.5 text-xs text-on-surface-3">
              Scan QRIS di bawah menggunakan e-wallet atau m-banking kamu.
            </p>
            <p className="mt-3 text-xs font-semibold text-brand-secondary">
              Selesaikan dalam {mm}:{ss}
            </p>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-border bg-white p-4">
              <FauxQr seed={bookingId ?? shopId} size={180} />
            </div>
            <p className="mt-4 text-xs text-on-surface-3">PangkasKAKA · QRIS Payment</p>
            <p className="mt-1 text-2xl font-bold text-brand-secondary">{formatIDR(amount)}</p>
            <button
              onClick={() => setStatus("done")}
              className="mt-6 w-full rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110"
            >
              Saya Sudah Bayar
            </button>
          </>
        ) : (
          <div className="mt-10">
            <CheckCircle2 size={48} className="mx-auto text-success" />
            <h1 className="mt-4 text-lg font-semibold">Booking dikonfirmasi</h1>
            <p className="mt-1.5 text-sm text-on-surface-2">
              Pantau status pemesananmu di halaman riwayat.
            </p>
            <button
              onClick={() => router.push("/riwayat")}
              className="mt-6 w-full rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110"
            >
              Lihat Riwayat Pemesanan
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
