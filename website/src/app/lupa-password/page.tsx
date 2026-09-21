"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
import { api } from "@/lib/api";

export default function LupaPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api.forgotPassword(email);
      setMessage(r.message);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim kode");
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      router.push("/masuk");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-1 flex-col justify-center px-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Lupa Password
      </h1>
      <p className="mt-2 text-sm text-on-surface-2">
        {step === "email"
          ? "Masukkan email akunmu, kami kirimkan kode reset."
          : `Masukkan kode yang dikirim ke ${email} dan password baru.`}
      </p>

      {step === "email" ? (
        <form onSubmit={onRequestCode} className="mt-8 flex flex-col gap-4">
          <div className="relative">
            <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-3" />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-border bg-surface-2 py-3.5 pl-11 pr-4 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Mengirim..." : "Kirim Kode Reset"}
          </button>
        </form>
      ) : (
        <form onSubmit={onReset} className="mt-8 flex flex-col gap-4">
          {message && <p className="text-xs text-success">{message}</p>}
          <div className="relative">
            <KeyRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-3" />
            <input
              type="text"
              required
              inputMode="numeric"
              placeholder="Kode 6 digit"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-full border border-border bg-surface-2 py-3.5 pl-11 pr-4 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div className="relative">
            <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-3" />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password baru (min. 8 karakter)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-full border border-border bg-surface-2 py-3.5 pl-11 pr-4 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-brand-primary py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Reset Password"}
          </button>
        </form>
      )}

      <Link
        href="/masuk"
        className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-3 hover:text-on-surface"
      >
        <ArrowLeft size={13} /> Kembali ke halaman masuk
      </Link>
    </main>
  );
}
