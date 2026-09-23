import Link from "next/link";
import Image from "next/image";
import { Zap, UserRoundCheck, Radar, ScanFace, Store, Bike, ShoppingBag } from "lucide-react";
import { api, APK_URL } from "@/lib/api";

// Mengikuti 3 quick-tile di layar Beranda aplikasi mobile (Barbershop /
// StreetBarber / Produk) — lihat frontend/app/(customer)/home.tsx.
const QUICK_ACCESS = [
  {
    title: "Barbershop",
    Icon: Store,
    href: "/jelajahi?filter=Barbershop",
  },
  {
    title: "StreetBarber",
    Icon: Bike,
    href: "/jelajahi?filter=StreetBarber",
  },
  {
    title: "Katalog Produk",
    Icon: ShoppingBag,
    href: "/katalog",
  },
];

async function getLiveStats() {
  try {
    return await api.publicStats();
  } catch {
    return { shop_count: null, streetbarber_active_count: null, avg_rating: null } as {
      shop_count: number | null;
      streetbarber_active_count: number | null;
      avg_rating: number | null;
    };
  }
}

const FEATURES = [
  {
    title: "Booking Instan",
    desc: "Pilih layanan, jadwal, dan bayar langsung dari HP. Konfirmasi dalam hitungan detik.",
    Icon: Zap,
  },
  {
    title: "StreetBarber Independen",
    desc: "Barber panggilan yang tervalidasi barbershop tapi berdiri sendiri — kamu booking langsung dengan mereka.",
    Icon: UserRoundCheck,
  },
  {
    title: "Pantau Status Pesanan",
    desc: "Lihat status perjalanan StreetBarber menuju rumah kamu, lengkap dengan estimasi jarak dan waktu tiba.",
    Icon: Radar,
  },
  {
    title: "AI Face Scan",
    desc: "Scan bentuk wajah lewat app untuk rekomendasi gaya potongan yang paling cocok buat kamu.",
    Icon: ScanFace,
    badge: "Aplikasi Mobile",
    href: "/ai-scan",
  },
];

const STEPS = [
  { n: "1", title: "Cari & Pilih", desc: "Jelajahi barbershop atau StreetBarber terdekat, bandingkan rating dan harga." },
  { n: "2", title: "Pilih Jadwal", desc: "Tentukan layanan, tanggal, dan jam yang paling pas buat kamu." },
  { n: "3", title: "Bayar & Selesai", desc: "Konfirmasi booking dan bayar via QRIS. Tinggal datang atau tunggu StreetBarber tiba." },
];

export default async function Home() {
  const stats = await getLiveStats();

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="flex flex-col items-center gap-12 px-6 py-16 md:flex-row md:px-20 md:py-24">
        <div className="w-full md:flex-1">
          
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-wide md:text-6xl">
            Rapikan gaya, tanpa antre.
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-on-surface-2">
            Booking barbershop favorit atau panggil StreetBarber independen langsung ke lokasi
            kamu cepat, transparan, dan bisa dilacak real-time.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {QUICK_ACCESS.map(({ title, Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="group flex flex-col items-start gap-2.5 rounded-xl border border-border bg-surface-2 p-4 transition hover:border-brand-primary/50 hover:bg-surface"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary">
                  <Icon size={17} className="text-on-brand-primary" />
                </div>
                <span className="text-sm font-bold">{title}</span>
              </Link>
            ))}
          </div>
          <div className="mt-7 flex max-w-lg gap-8 border-t border-border pt-5">
            {stats.shop_count != null && (
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl font-semibold text-brand-secondary">
                  {stats.shop_count}
                </div>
                <div className="text-xs text-on-surface-3">Barbershop Mitra</div>
              </div>
            )}
            {stats.streetbarber_active_count != null && (
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl font-semibold text-brand-secondary">
                  {stats.streetbarber_active_count}
                </div>
                <div className="text-xs text-on-surface-3">StreetBarber Aktif</div>
              </div>
            )}
            {stats.avg_rating != null && (
              <div>
                <div className="font-[family-name:var(--font-display)] text-2xl font-semibold text-brand-secondary">
                  {stats.avg_rating.toFixed(1)}
                </div>
                <div className="text-xs text-on-surface-3">Rating Rata-rata</div>
              </div>
            )}
          </div>
        </div>
        <div className="relative h-[400px] w-full overflow-hidden rounded-2xl md:h-[560px] md:w-[480px] md:shrink-0">
          <Image
            src="https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=900&q=80"
            alt="Barber sedang memangkas rambut pelanggan"
            fill
            sizes="(min-width: 768px) 480px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="bg-surface-2 px-6 py-20 md:px-20">
        <span className="text-xs font-bold tracking-widest text-brand-secondary">
          KENAPA PANGKASKAKA
        </span>
        <h2 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
          Semua yang kamu butuh untuk rapi, dalam satu app.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, desc, Icon, badge, href }) => {
            const cardClass =
              "relative rounded-xl border border-border bg-surface p-6 transition hover:border-brand-primary/50";
            const content = (
              <>
                {badge && (
                  <span className="absolute right-4 top-4 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-on-surface-3">
                    {badge}
                  </span>
                )}
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3">
                  <Icon size={20} className="text-brand-secondary" />
                </div>
                <h3 className="mt-3.5 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-on-surface-3">{desc}</p>
              </>
            );
            return href ? (
              <Link key={title} href={href} className={cardClass}>
                {content}
              </Link>
            ) : (
              <div key={title} className={cardClass}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* Cara Kerja */}
      <section id="cara-kerja" className="scroll-mt-24 px-6 py-20 text-center md:px-20">
        <span className="text-xs font-bold tracking-widest text-brand-secondary">CARA KERJA</span>
        <h2 className="mx-auto mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
          Booking dalam 3 langkah
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-10 text-left md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span className="text-xs font-bold tracking-widest text-on-surface-3">
                LANGKAH {s.n}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-on-surface-2">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="tentang" className="scroll-mt-24 border-t border-border px-6 py-20 text-center md:px-20">
        <h2 className="mx-auto max-w-lg font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
          Siap coba PangkasKAKA?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-on-surface-2">
          Panggil StreetBarber langsung ke rumahmu lewat browser, atau install aplikasinya untuk
          pengalaman penuh termasuk AI Face Scan.
        </p>
        <Link
          href="/jelajahi?filter=StreetBarber"
          className="mt-7 inline-block rounded-lg bg-brand-primary px-6 py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110"
        >
          Mulai Booking di Web
        </Link>
      </section>

      <footer className="border-t border-border px-6 py-14 md:px-20">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
              PangkasKAKA
            </span>
            <p className="mt-2 max-w-xs text-xs text-on-surface-3">
              Marketplace barbershop &amp; StreetBarber independen, berbasis di Kupang, NTT.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-3">Produk</h4>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-2">
              <li><Link href="/jelajahi" className="hover:text-on-surface">Jelajahi Barber</Link></li>
              {/* Jadi StreetBarber & Daftarkan Toko cuma ada di alur aplikasi mobile
                  (lihat frontend/app/(auth)/register.tsx & shop-apply.tsx) — arahkan
                  ke unduhan APK, bukan link mati ke halaman yang belum ada di web. */}
              <li><a href={APK_URL} className="hover:text-on-surface">Jadi StreetBarber</a></li>
              <li><a href={APK_URL} className="hover:text-on-surface">Daftarkan Toko</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-3">Perusahaan</h4>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-2">
              <li><a href="#tentang" className="hover:text-on-surface">Tentang Kami</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-3">Bantuan</h4>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-2">
              <li><Link href="/syarat" className="hover:text-on-surface">Syarat &amp; Ketentuan</Link></li>
              <li><Link href="/privasi" className="hover:text-on-surface">Kebijakan Privasi</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-on-surface-3 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} PangkasKAKA. Seluruh hak cipta dilindungi.</span>
          <span>Dibuat dengan bangga di Kupang, NTT 🇮🇩</span>
        </div>
      </footer>
    </main>
  );
}
