"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { api, Barber, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import BookingStepper from "@/components/BookingStepper";
import FauxQr from "@/components/FauxQr";
import LoadingScreen from "@/components/LoadingScreen";

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
            <p role="alert" className="text-sm text-error">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold"
            >
              Kembali
            </button>
          </div>
        ) : status === "ready" || status === "confirming" ? (
          <>
            <span className="inline-block rounded-full bg-warning/15 px-3 py-1 text-[11px] font-bold text-warning">
              Demo Pembayaran
            </span>
            <h1 className="mt-3 text-lg font-semibold">Selesaikan Pembayaran</h1>
            <p className="mt-1.5 text-xs text-on-surface-3">
              Scan QRIS di bawah menggunakan e-wallet atau m-banking kamu.
            </p>
            <p className="mt-3 text-xs font-semibold text-brand-secondary">
              Selesaikan dalam {mm}:{ss}
            </p>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-border bg-white p-4">
              <FauxQr seed={bookingId ?? id} size={180} />
            </div>
            <p className="mt-4 text-xs text-on-surface-3">PangkasKAKA · QRIS Payment</p>
            <p className="mt-1 text-2xl font-bold text-brand-secondary">{formatIDR(amount)}</p>
            <button
              onClick={confirmPayment}
              disabled={status === "confirming"}
              className="mt-6 w-full rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-60"
            >
              {status === "confirming" ? "Memverifikasi..." : "Saya Sudah Bayar"}
            </button>
          </>
        ) : status === "expired" ? (
          <div className="mt-10">
            <AlertCircle size={48} className="mx-auto text-error" />
            <h1 className="mt-4 text-lg font-semibold">Waktu Pembayaran Habis</h1>
            <p className="mt-1.5 text-sm text-on-surface-2">
              Booking ini sudah kedaluwarsa. Silakan pesan ulang untuk mendapatkan slot baru.
            </p>
            <button
              onClick={() => router.push(`/barber/${id}`)}
              className="mt-6 w-full rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110"
            >
              Pesan Ulang
            </button>
          </div>
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
