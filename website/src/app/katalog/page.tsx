"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, PackageOpen } from "lucide-react";
import { api, formatIDR, Product } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import { cardClass } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/StatePanel";
import { CardSkeleton } from "@/components/ui/Skeleton";

export default function KatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // queueMicrotask menunda setState sinkron pertama supaya tidak dianggap
  // "cascading render" oleh react-hooks/set-state-in-effect — pola yang sama
  // sudah dipakai di halaman pembayaran (lihat setStatus("creating")).
  const load = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    api
      .listProducts()
      .then((r) => setProducts(r.products))
      .catch((err) => setError(err.message ?? "Gagal memuat katalog produk"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="mx-auto max-w-[1152px] flex-1 px-6 py-10 md:px-12 lg:px-20">
      <Badge tone="brand" icon={<ShoppingBag size={12} aria-hidden="true" />}>
        KATALOG PRODUK
      </Badge>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
        Produk Perawatan dari Barbershop Mitra
      </h1>
      <p className="mt-2 max-w-lg text-sm text-on-surface-2">
        Pomade, minyak rambut, sampo, dan produk lain dari barbershop di sekitar Kupang.
      </p>

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Memuat katalog produk...</span>
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState className="mt-8" description={error} onAction={load} />
      ) : products.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<PackageOpen size={20} aria-hidden="true" />}
          title="Belum ada produk tersedia"
          description="Barbershop mitra belum menambahkan produk. Coba lagi nanti."
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <div key={p.id} className={cardClass({ hoverable: true, padding: "p-0", className: "group flex h-full flex-col overflow-hidden" })}>
              <div className="relative h-36 w-full shrink-0 overflow-hidden bg-surface-3">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-on-surface-3">
                    <ShoppingBag size={24} aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-sm font-semibold text-on-surface">{p.name}</h3>
                {p.shop_name && <p className="mt-0.5 text-xs text-on-surface-3">{p.shop_name}</p>}
                <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                  <span className="text-sm font-bold text-on-surface">{formatIDR(p.price)}</span>
                  {p.shop_id && (
                    <Link
                      href={`/toko/${p.shop_id}`}
                      className="shrink-0 rounded-lg bg-brand-primary px-3.5 py-2 text-xs font-bold text-on-brand-primary transition hover:bg-brand-secondary hover:text-white"
                    >
                      Lihat Toko
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-on-surface-3">
        Pemesanan produk (pickup/delivery) saat ini tersedia lewat aplikasi mobile PangkasKAKA.
      </p>
    </main>
  );
}
