"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ArrowLeft, Scissors } from "lucide-react";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, remember);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Panel kiri — dekoratif, brand */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#0f1a2e] via-[#0f1a2e] to-[#c97a08] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute h-6 rounded-full bg-gradient-to-r from-[#f5a524] to-[#f5a524]/0"
              style={{
                width: `${140 + i * 30}px`,
                bottom: `${-40 + i * 60}px`,
                left: `${-60 + i * 90}px`,
                transform: "rotate(-45deg)",
                opacity: 0.55 - i * 0.06,
              }}
            />
          ))}
        </div>

        <Link href="/" className="relative z-10 flex items-center gap-2.5 text-white">
          <Image src="/logo.jpeg" alt="PangkasKAKA" width={38} height={38} className="rounded-lg object-cover" />
          <span className="font-[family-name:var(--font-display)] text-xl font-extrabold">PangkasKAKA</span>
        </Link>

        <div className="relative z-10">
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight text-white xl:text-5xl">
            Rapikan gaya,
            <br />
            tanpa antre.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            Masuk untuk kelola booking, lacak StreetBarber-mu secara real-time, dan lihat riwayat
            pemesanan — semua dari browser.
          </p>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} PangkasKAKA. Barbershop &amp; StreetBarber Marketplace.
        </p>
      </div>

      {/* Panel kanan — form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Image src="/logo.jpeg" alt="PangkasKAKA" width={32} height={32} className="rounded-lg object-cover" />
            <span className="font-[family-name:var(--font-display)] text-lg font-extrabold">PangkasKAKA</span>
          </div>

          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-brand-secondary">
            <Scissors size={13} /> MASUK AKUN
          </span>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-extrabold">
            Selamat datang kembali
          </h2>
          <p className="mt-1.5 text-sm text-on-surface-2">
            Gunakan akun yang sama dengan aplikasi mobile.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <div className="relative">
              <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-3" />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-border bg-surface-2 py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand-primary"
              />
            </div>
            <div className="relative">
              <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-3" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-border bg-surface-2 py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand-primary"
              />
            </div>

            <div className="flex items-center justify-between px-1 text-xs">
              <label className="flex items-center gap-2 font-medium text-on-surface-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-primary"
                />
                Ingat saya
              </label>
              <Link href="/lupa-password" className="font-semibold text-brand-secondary hover:underline">
                Lupa password?
              </Link>
            </div>

            {error && <p className="text-xs text-error">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-full bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Memproses..." : "MASUK"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-on-surface-3">
            Belum punya akun? Daftar lewat aplikasi mobile PangkasKAKA.
          </p>
          <Link
            href="/"
            className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-3 hover:text-on-surface"
          >
            <ArrowLeft size={13} /> Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
