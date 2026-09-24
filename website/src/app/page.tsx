import Link from "next/link";
import { Zap, UserRoundCheck, Radar, ScanFace, Store, Bike, ShoppingBag, Download } from "lucide-react";
import { api, APK_URL } from "@/lib/api";
import Hero from "@/components/Hero";
import StepsRow from "@/components/StepsRow";
import QRDownloadBadge from "@/components/QRDownloadBadge";
import Section from "@/components/ui/Section";
import SectionHeading from "@/components/ui/SectionHeading";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Reveal from "@/components/ui/Reveal";
import StatCounter from "@/components/ui/StatCounter";
import { cardClass } from "@/components/ui/card";

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

type LiveStats = {
  shop_count: number | null;
  streetbarber_active_count: number | null;
  avg_rating: number | null;
  status: "ok" | "error";
};

async function getLiveStats(): Promise<LiveStats> {
  try {
    const stats = await api.publicStats();
    return { ...stats, status: "ok" };
  } catch {
    return { shop_count: null, streetbarber_active_count: null, avg_rating: null, status: "error" };
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

const FAQS = [
  {
    q: "Apakah booking di PangkasKAKA gratis?",
    a: "Ya. Tidak ada biaya pendaftaran atau biaya booking tersembunyi — kamu cuma bayar layanan potong rambut yang dipilih.",
  },
  {
    q: "Apa bedanya Barbershop dan StreetBarber?",
    a: "Barbershop adalah toko fisik yang kamu datangi langsung. StreetBarber adalah barber panggilan independen yang tervalidasi barbershop, dan datang ke lokasi kamu.",
  },
  {
    q: "Bagaimana cara pembayarannya?",
    a: "Pembayaran dilakukan langsung dari aplikasi atau website via QRIS, instan setelah booking dikonfirmasi.",
  },
  {
    q: "Apa yang terjadi kalau saya belum bayar?",
    a: "Booking yang belum dibayar otomatis kedaluwarsa setelah beberapa saat, supaya jadwal bisa dipakai pelanggan lain.",
  },
  {
    q: "Perlu punya akun untuk booking?",
    a: "Ya, kamu perlu daftar dan login dulu sebelum booking — supaya riwayat dan status pesanan kamu bisa dilacak dengan aman.",
  },
];

function StatBlock({
  value,
  decimals = 0,
  suffix = "",
  label,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
}) {
  return (
    <div>
      <div className="font-[family-name:var(--font-display)] text-4xl font-extrabold text-brand-secondary">
        <StatCounter value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="mt-1 text-xs font-semibold tracking-wide text-on-surface-3">{label}</div>
    </div>
  );
}

export default async function Home() {
  const stats = await getLiveStats();
  const hasAnyStat = stats.shop_count || stats.streetbarber_active_count || stats.avg_rating;

  return (
    <main className="flex-1">
      <Hero />

      {/* Akses Cepat */}
      <Section innerClassName="max-w-4xl">
        <div className="grid gap-3 sm:grid-cols-3">
          {QUICK_ACCESS.map(({ title, Icon, href }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <Link
                href={href}
                className={cardClass({
                  hoverable: true,
                  padding: "p-4",
                  className: "group flex flex-col items-start gap-2.5",
                })}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary">
                  <Icon size={17} className="text-on-brand-primary" aria-hidden="true" />
                </div>
                <span className="text-sm font-bold text-on-surface">{title}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Statistik */}
      <Section tone="surface-2" border="y" innerClassName="max-w-4xl">
        {stats.status === "error" ? (
          <p role="status" className="text-center text-sm text-on-surface-3">
            Statistik sedang tidak tersedia saat ini — coba muat ulang halaman.
          </p>
        ) : !hasAnyStat ? (
          <p role="status" className="text-center text-sm text-on-surface-3">
            PangkasKAKA baru saja mulai di Kupang — jadilah salah satu yang pertama coba.
          </p>
        ) : (
          <div className="grid gap-8 text-center sm:grid-cols-3">
            {stats.shop_count != null && (
              <StatBlock value={stats.shop_count} suffix="+" label="BARBERSHOP MITRA" />
            )}
            {stats.streetbarber_active_count != null && (
              <StatBlock value={stats.streetbarber_active_count} suffix="+" label="STREETBARBER AKTIF" />
            )}
            {stats.avg_rating != null && (
              <StatBlock value={stats.avg_rating} decimals={1} label="RATING RATA-RATA" />
            )}
          </div>
        )}
      </Section>

      {/* Fitur */}
      <Section id="fitur">
        <SectionHeading
          eyebrow="KENAPA PANGKASKAKA"
          title="Semua yang kamu butuh untuk rapi, dalam satu app."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, desc, Icon, badge, href }, i) => {
            const classes = cardClass({
              hoverable: true,
              className: "relative flex h-full flex-col hover:-translate-y-1",
            });
            const content = (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3">
                    <Icon size={20} className="text-brand-secondary" aria-hidden="true" />
                  </div>
                  <span className="font-[family-name:var(--font-display)] text-xl font-bold text-border-strong">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-3.5 flex flex-wrap items-center gap-2 text-lg font-semibold text-on-surface">
                  {title}
                  {badge && <Badge tone="blue">{badge}</Badge>}
                </h3>
                <p className="mt-1.5 text-[13px] leading-5 text-on-surface-3">{desc}</p>
              </>
            );
            return (
              <Reveal key={title} delay={i * 0.08}>
                {href ? (
                  <Link href={href} className={classes}>
                    {content}
                  </Link>
                ) : (
                  <div className={classes}>{content}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* Cara Kerja */}
      <Section id="cara-kerja" tone="surface-2" navTheme="light" className="text-center">
        <SectionHeading
          eyebrow="CARA KERJA"
          title="Booking dalam 3 langkah"
          align="center"
        />
        <StepsRow steps={STEPS} />
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading
          eyebrow="FAQ"
          title="Pertanyaan yang sering ditanyakan"
          align="center"
        />
        <div className="mx-auto mt-10 max-w-2xl space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className={cardClass({ className: "group open:border-brand-primary/40" })}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-on-surface">
                {f.q}
                <span className="shrink-0 text-lg text-on-surface-3 transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-on-surface-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section id="tentang" navTheme="dark" className="pb-14 md:pb-20">
        <Reveal>
          <div className="relative flex flex-col items-center gap-8 overflow-hidden rounded-3xl bg-[#0f1a2e] px-8 py-14 text-center md:flex-row md:justify-between md:px-16 md:text-left">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_80%_100%_at_0%_0%,black,transparent_70%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-accent-blue/25 blur-[100px]"
            />
            <div className="relative">
              <h2 className="max-w-md font-[family-name:var(--font-display)] text-3xl font-extrabold text-white md:text-4xl">
                Siap coba PangkasKAKA?
              </h2>
              <p className="mt-3 max-w-md text-white/70">
                Panggil StreetBarber langsung ke rumahmu, atau install aplikasinya untuk pengalaman
                penuh termasuk AI Face Scan. Gratis, tanpa biaya pendaftaran.
              </p>
            </div>
            <div className="relative flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button href={APK_URL} target="_blank" rel="noopener noreferrer" icon={<Download size={16} aria-hidden="true" />}>
                Unduh Aplikasi
              </Button>
              <Button href="/jelajahi?filter=StreetBarber" variant="outline-dark">
                Mulai Booking di Web
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* pb ekstra di lg+ menyisakan ruang kosong di bawah baris terakhir
          supaya tidak tertindih QRDownloadBadge yang fixed di pojok kanan
          bawah saat halaman discroll sampai ujung. */}
      <footer className="border-t border-border px-6 py-14 md:px-20 lg:pb-48">
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

      <QRDownloadBadge />
    </main>
  );
}
