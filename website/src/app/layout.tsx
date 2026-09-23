import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ThemeRegistry from "@/components/ThemeRegistry";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app-pangkas-kaka.vercel.app";
const SITE_TITLE = "PangkasKAKA — Barbershop & StreetBarber Marketplace";
const SITE_DESCRIPTION =
  "Pesan barbershop atau StreetBarber panggilan langsung dari browser. Booking cepat, harga transparan, pantau status pesanan real-time.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · PangkasKAKA" },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "PangkasKAKA",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.jpeg", width: 512, height: 512, alt: "PangkasKAKA" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo.jpeg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        <ThemeRegistry>
          <AuthProvider>
            <Navbar />
            {children}
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
