import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app-pangkas-kaka.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Halaman ini butuh login atau state alur booking (query param) — tidak
        // ada gunanya diindeks, dan mencegah crawler membuang budget di sana.
        disallow: ["/akun", "/riwayat", "/tracking", "/booking"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
