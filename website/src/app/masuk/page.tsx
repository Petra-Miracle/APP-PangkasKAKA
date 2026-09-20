"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-1 flex-col justify-center px-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
        Masuk ke PangkasKAKA
      </h1>
      <p className="mt-2 text-sm text-on-surface-2">
        Gunakan akun yang sama dengan aplikasi mobile.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-on-surface-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand-primary"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-on-surface-2">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm outline-none focus:border-brand-primary"
          />
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-on-surface-3">
        Belum punya akun? Daftar lewat aplikasi mobile PangkasKAKA.
      </p>
      <Link href="/" className="mt-4 text-center text-xs text-on-surface-3 hover:text-on-surface">
        ← Kembali ke beranda
      </Link>
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
