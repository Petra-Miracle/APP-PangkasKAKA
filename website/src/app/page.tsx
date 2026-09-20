import Link from "next/link";
import { Zap, UserRoundCheck, Radar, ScanFace, CalendarCheck, MapPin } from "lucide-react";
import { api } from "@/lib/api";

async function getLiveStats() {
  try {
    const { shops } = await api.listShops();
    return { shopCount: shops.length };
  } catch {
    return { shopCount: null as number | null };
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
    title: "Live Tracking",
    desc: "Pantau lokasi StreetBarber menuju rumah kamu secara real-time di peta, lengkap dengan estimasi jarak.",
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
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-on-surface-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            MELAYANI KOTA KUPANG, NTT
          </span>
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-wide md:text-6xl">
            Rapikan gaya, tanpa antre.
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-on-surface-2">
            Booking barbershop favorit atau panggil StreetBarber independen langsung ke lokasi
            kamu — cepat, transparan, dan bisa dilacak real-time.
          </p>
          <div className="mt-7 flex flex-wrap gap-3.5">
            <Link
              href="/jelajahi"
              className="flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3.5 text-sm font-bold text-on-brand-primary transition hover:brightness-110"
            >
              <CalendarCheck size={16} />
              Mulai Booking
            </Link>
            <Link
              href="/jelajahi"
              className="flex items-center gap-2 rounded-lg border border-border-strong px-6 py-3.5 text-sm font-bold text-on-surface transition hover:bg-surface-2"
            >
              <MapPin size={16} />
              Lihat Barber Terdekat
            </Link>
          </div>
          <div className="mt-7 flex max-w-lg gap-8 border-t border-border pt-5">
            <div>
              <div className="font-[family-name:var(--font-display)] text-2xl font-semibold text-brand-secondary">
                120+
              </div>
              <div className="text-xs text-on-surface-3">Barbershop Mitra</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-display)] text-2xl font-semibold text-brand-secondary">
                {stats.shopCount ? `${stats.shopCount}+` : "300+"}
              </div>
              <div className="text-xs text-on-surface-3">StreetBarber Aktif</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-display)] text-2xl font-semibold text-brand-secondary">
                4.8
              </div>
              <div className="text-xs text-on-surface-3">Rating Rata-rata</div>
            </div>
          </div>
        </div>
        <div
          className="h-[400px] w-full rounded-2xl bg-cover bg-center md:h-[560px] md:w-[480px] md:shrink-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=900&q=80')",
          }}
        />
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
      <section id="cara-kerja" className="px-6 py-20 text-center md:px-20">
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
      <section id="tentang" className="border-t border-border px-6 py-20 text-center md:px-20">
        <h2 className="mx-auto max-w-lg font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
          Siap coba PangkasKAKA?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-on-surface-2">
          Langsung booking lewat browser, atau install aplikasinya untuk pengalaman penuh
          termasuk AI Face Scan.
        </p>
        <Link
          href="/jelajahi"
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
              <li><Link href="/jelajahi">Jelajahi Barber</Link></li>
              <li>Jadi StreetBarber</li>
              <li>Daftarkan Toko</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-3">Perusahaan</h4>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-2">
              <li>Tentang Kami</li>
              <li>Karier</li>
              <li>Blog</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-3">Bantuan</h4>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-2">
              <li>Pusat Bantuan</li>
              <li>Syarat &amp; Ketentuan</li>
              <li>Kebijakan Privasi</li>
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
