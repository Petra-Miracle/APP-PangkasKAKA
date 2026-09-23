import type { MetadataRoute } from "next";
import { api } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app-pangkas-kaka.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/jelajahi`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/katalog`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/masuk`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/syarat`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privasi`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Toko & barber publik ikut didaftarkan supaya halaman detail juga bisa
  // diindeks — gagal ambil data tidak boleh menjatuhkan seluruh sitemap,
  // cukup jatuh ke rute statis saja.
  try {
    const { shops } = await api.listShops();
    const shopRoutes: MetadataRoute.Sitemap = shops.map((s) => ({
      url: `${SITE_URL}/toko/${s.id}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticRoutes, ...shopRoutes];
  } catch {
    return staticRoutes;
  }
}
