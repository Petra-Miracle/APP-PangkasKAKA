"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, AlertCircle } from "lucide-react";
import { api, formatIDR, Product } from "@/lib/api";
import InlineLoading from "@/components/InlineLoading";

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
    <main className="flex-1 px-6 py-10 md:px-20">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-dim px-3 py-1.5 text-xs font-bold text-brand-secondary">
        <ShoppingBag size={13} /> KATALOG PRODUK
      </span>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
        Produk Perawatan dari Barbershop Mitra
      </h1>
      <p className="mt-2 text-sm text-on-surface-2">
        Pomade, minyak rambut, sampo, dan produk lain dari barbershop di sekitar Kupang.
      </p>

      {loading ? (
        <InlineLoading message="Memuat katalog produk..." />
      ) : error ? (
        <div role="alert" className="mt-16 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={28} className="text-error" />
          <p className="max-w-xs text-sm text-on-surface-2">{error}</p>
          <button
            onClick={load}
            className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold hover:bg-surface-2"
          >
            Coba Lagi
          </button>
        </div>
      ) : products.length === 0 ? (
        <p className="mt-16 text-center text-sm text-on-surface-3">Belum ada produk tersedia.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-xl border border-border bg-surface-2 transition hover:border-border-strong"
            >
              <div className="relative h-36 w-full overflow-hidden bg-surface-3">
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold">{p.name}</h3>
                {p.shop_name && <p className="mt-0.5 text-xs text-on-surface-3">{p.shop_name}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">{formatIDR(p.price)}</span>
                  {p.shop_id && (
                    <Link
                      href={`/toko/${p.shop_id}`}
                      className="rounded-lg bg-brand-primary px-3.5 py-2 text-xs font-bold text-on-brand-primary transition hover:brightness-110"
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
