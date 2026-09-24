"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import FauxQr from "@/components/FauxQr";
import LoadingScreen from "@/components/LoadingScreen";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/card";

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

  const [status, setStatus] = useState<
    "idle" | "creating" | "ready" | "confirming" | "error" | "expired" | "done"
  >("idle");
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
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setStatus("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  const confirmPayment = () => {
    if (!token || !bookingId) return;
    setStatus("confirming");
    api
      .payBooking(bookingId, token)
      .then(() => setStatus("done"))
      .catch((err) => {
        if (err.status === 410) { setStatus("expired"); return; }
        setError(err.message ?? "Gagal mengonfirmasi pembayaran");
        setStatus("error");
      });
  };

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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
              <AlertCircle size={26} aria-hidden="true" />
            </div>
            <p role="alert" className="mt-4 text-sm text-error">{error}</p>
            <Button onClick={() => router.back()} variant="outline" fullWidth size="lg" className="mt-5">
              Kembali
            </Button>
          </div>
        ) : status === "ready" || status === "confirming" ? (
          <>
            <Badge tone="warning">Demo Pembayaran</Badge>
            <h1 className="mt-3 text-lg font-bold text-on-surface">Selesaikan Pembayaran</h1>
            <p className="mt-1.5 text-xs text-on-surface-3">
              Scan QRIS di bawah menggunakan e-wallet atau m-banking kamu.
            </p>
            <p role="timer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-secondary">
              <Clock size={13} aria-hidden="true" />
              Selesaikan dalam {mm}:{ss}
            </p>
            <div className={cardClass({ padding: "p-4", className: "mx-auto mt-4 w-fit bg-white shadow-elevated" })}>
              <FauxQr seed={bookingId ?? shopId} size={180} />
            </div>
            <p className="mt-4 text-xs text-on-surface-3">PangkasKAKA · QRIS Payment</p>
            <p className="mt-1 text-2xl font-bold text-brand-secondary">{formatIDR(amount)}</p>
            <Button
              onClick={confirmPayment}
              loading={status === "confirming"}
              fullWidth
              size="lg"
              className="mt-6"
            >
              {status === "confirming" ? "Memverifikasi..." : "Saya Sudah Bayar"}
            </Button>
          </>
        ) : status === "expired" ? (
          <div className="mt-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
              <AlertCircle size={26} aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-on-surface">Waktu Pembayaran Habis</h1>
            <p className="mt-1.5 text-sm text-on-surface-2">
              Booking ini sudah kedaluwarsa. Silakan pesan ulang untuk mendapatkan slot baru.
            </p>
            <Button onClick={() => router.push(`/toko/${shopId}`)} fullWidth size="lg" className="mt-6">
              Pesan Ulang
            </Button>
          </div>
        ) : (
          <div className="mt-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 size={26} aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-bold text-on-surface">Booking dikonfirmasi</h1>
            <p className="mt-1.5 text-sm text-on-surface-2">
              Pantau status pemesananmu di halaman riwayat.
            </p>
            <Button onClick={() => router.push("/riwayat")} fullWidth size="lg" className="mt-6">
              Lihat Riwayat Pemesanan
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
