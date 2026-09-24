"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { api, Barber, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import FauxQr from "@/components/FauxQr";
import LoadingScreen from "@/components/LoadingScreen";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cardClass } from "@/components/ui/card";

const EXPIRY_SECONDS = 15 * 60;

export default function PembayaranPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { token, user, loading: authLoading } = useAuth();

  const serviceId = search.get("service") ?? "";
  const date = search.get("date") ?? "";
  const time = search.get("time") ?? "";
  const address = search.get("address") ?? "";

  const [barber, setBarber] = useState<Barber | null>(null);
  const [status, setStatus] = useState<
    "idle" | "creating" | "ready" | "confirming" | "error" | "expired" | "done"
  >("idle");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const submittedRef = useRef(false);

  useEffect(() => {
    api.barberDetail(id).then(setBarber).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      const next = `/booking/${id}/pembayaran?${search.toString()}`;
      router.replace(`/masuk?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!barber || submittedRef.current) return;
    submittedRef.current = true;

    queueMicrotask(() => setStatus("creating"));
    const submit = (lat?: number, lng?: number) => {
      api
        .createBooking(
          {
            barber_id: id,
            shop_id: barber.shop_id ?? "",
            service_id: serviceId,
            booking_date: date,
            booking_time: time,
            delivery_mode: "rumah",
            customer_lat: lat,
            customer_lng: lng,
            customer_address: address,
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
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => submit(pos.coords.latitude, pos.coords.longitude),
        () => {
          setError("Aktifkan akses lokasi untuk melanjutkan booking panggilan ke rumah.");
          setStatus("error");
        },
        { timeout: 5000 }
      );
    } else {
      queueMicrotask(() => {
        setError("Browser tidak mendukung akses lokasi.");
        setStatus("error");
      });
    }
  }, [authLoading, user, token, barber, id, serviceId, date, time, address, router, search]);

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
        // 410 = booking sudah kedaluwarsa di backend (>15 menit) — status paling
        // akurat datang dari server, bukan cuma timer lokal yang bisa meleset.
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
              <FauxQr seed={bookingId ?? id} size={180} />
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
            <Button onClick={() => router.push(`/barber/${id}`)} fullWidth size="lg" className="mt-6">
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
