"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import LoadingScreen from "@/components/LoadingScreen";

export default function AkunPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/masuk?next=/akun");
  }, [loading, user, router]);

  if (loading || !user) {
    return <LoadingScreen message="Memuat akun kamu..." />;
  }

  return (
    <main className="flex-1 px-6 py-10 md:px-20">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-3">
          <User size={28} className="text-on-surface-3" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{user.name}</h1>
          <p className="text-xs text-on-surface-3">{user.email}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-1">
          <SideLink label="Data Diri" active />
          <Link href="/riwayat" className="block rounded-lg px-4 py-2.5 text-sm text-on-surface-2 hover:bg-surface-2">
            Riwayat Pemesanan
          </Link>
          <SideLink label="Metode Pembayaran" />
          <SideLink label="Pengaturan" />
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm text-error hover:bg-surface-2"
          >
            <LogOut size={14} /> Keluar
          </button>
        </aside>

        <div className="rounded-xl border border-border bg-surface-2 p-6">
          <h2 className="text-sm font-semibold text-on-surface-2">Data Diri</h2>
          <div className="mt-4 space-y-4 text-sm">
            <Field label="Nama Lengkap" value={user.name} />
            <Field label="Email" value={user.email} />
          </div>
        </div>
      </div>
    </main>
  );
}

function SideLink({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className={`rounded-lg px-4 py-2.5 text-sm ${
        active ? "bg-brand-primary/10 font-semibold text-brand-secondary" : "text-on-surface-2"
      }`}
    >
      {label}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-3">
      <p className="text-xs text-on-surface-3">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
