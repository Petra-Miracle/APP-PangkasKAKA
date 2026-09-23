import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Foto toko/barber/produk (upload_to_r2 di backend, lihat R2_PUBLIC_URL).
      { protocol: "https", hostname: "pub-5f25da90982d4a29a9630149a3cce8c9.r2.dev" },
      // Foto hero placeholder & fallback gambar toko default.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
