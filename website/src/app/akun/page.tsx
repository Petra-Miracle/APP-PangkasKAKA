"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut, History, CreditCard, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import InlineLoading from "@/components/InlineLoading";
import Badge from "@/components/ui/Badge";
import { cardClass } from "@/components/ui/card";

export default function AkunPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/masuk?next=/akun");
  }, [loading, user, router]);

  if (loading || !user) {
    return <InlineLoading message="Memuat akun kamu..." />;
  }

  return (
    <main className="mx-auto max-w-[1152px] flex-1 px-6 py-10 md:px-12 lg:px-20">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-3">
          <User size={28} className="text-on-surface-3" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">{user.name}</h1>
          <p className="text-xs text-on-surface-3">{user.email}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Menu akun" className="space-y-1">
          <SideLink label="Data Diri" icon={<User size={15} aria-hidden="true" />} active />
          <Link
            href="/riwayat"
            className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm text-on-surface-2 transition hover:bg-surface-2"
          >
            <History size={15} aria-hidden="true" /> Riwayat Pemesanan
          </Link>
          <SideLink label="Metode Pembayaran" icon={<CreditCard size={15} aria-hidden="true" />} comingSoon />
          <SideLink label="Pengaturan" icon={<Settings size={15} aria-hidden="true" />} comingSoon />
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-sm text-error transition hover:bg-error/5"
          >
            <LogOut size={15} aria-hidden="true" /> Keluar
          </button>
        </nav>

        <div className={cardClass({ padding: "p-6" })}>
          <h2 className="text-sm font-bold text-on-surface">Data Diri</h2>
          <div className="mt-4 space-y-4 text-sm">
            <Field label="Nama Lengkap" value={user.name} />
            <Field label="Email" value={user.email} />
          </div>
        </div>
      </div>
    </main>
  );
}

function SideLink({
  label,
  active,
  icon,
  comingSoon,
}: {
  label: string;
  active?: boolean;
  icon?: ReactNode;
  comingSoon?: boolean;
}) {
  return (
    <div
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm ${
        active
          ? "bg-brand-primary/10 font-semibold text-brand-secondary"
          : comingSoon
            ? "text-on-surface-3"
            : "text-on-surface-2"
      }`}
    >
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      {comingSoon && <Badge tone="neutral">Segera</Badge>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-3">
      <p className="text-xs text-on-surface-3">{label}</p>
      <p className="mt-1 font-medium text-on-surface">{value}</p>
    </div>
  );
}
