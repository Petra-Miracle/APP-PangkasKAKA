import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

const NETWORK_RETRY_DELAYS_MS = [800, 2000];

async function req(path: string, opts: RequestInit = {}) {
  const token = await AsyncStorage.getItem("token");
  const headers: any = {
    "Content-Type": "application/json",
    ...(opts.headers as any || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  let attempt = 0;
  while (true) {
    try {
      res = await fetch(`${API}${path}`, { ...opts, headers });
      break;
    } catch {
      // fetch() melempar TypeError (bukan response HTTP) saat koneksi putus di
      // tengah transfer — sering terjadi pada upload foto (payload lebih besar)
      // di sinyal seluler lemah. Retry singkat sebelum menyerah ke pesan yang
      // lebih jelas daripada "Network request failed" mentah dari RN.
      if (attempt >= NETWORK_RETRY_DELAYS_MS.length) {
        throw new Error("Koneksi jaringan terputus. Periksa sinyal/internet Anda dan coba lagi.");
      }
      await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAYS_MS[attempt]));
      attempt++;
    }
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Error ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : "Terjadi kesalahan");
  }
  return data;
}

export const api = {
  get: (p: string) => req(p),
  post: (p: string, body?: any) => req(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (p: string, body?: any) => req(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: (p: string) => req(p, { method: "DELETE" }),
};

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

export const tanggal = (s: string) => {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(s));
  } catch { return s; }
};

export const formatJarak = (km: number | null) =>
  km == null ? "-" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;

// Warm Cream + Amber Theme — Migrasi Pendev (was Electric Blue)
export const COLORS = {
  bg: "#F7F3EC",             // krem hangat (was abu-abu)
  surface: "#FFFFFF",       // card white — tetap
  surface2: "#F5EFE3",      // warm soft container / input bg (was abu cool)
  text: "#0F1A2E",          // ink gelap
  textDim: "#6C7789",       // muted body
  textMuted: "#3A4761",     // secondary
  brand: "#F5A524",         // amber utama (was biru)
  brandDim: "#FDF0D9",      // amber-soft
  brandLight: "#C97A08",    // amber-dark — teks di atas brandDim
  success: "#12915A",
  warning: "#F5A524",
  info: "#2F5FD0",
  error: "#D6382B",
  border: "#E7E1D6",        // line krem (was abu)
  borderStrong: "#CBCCC9",
  textInverse: "#0F1A2E",   // teks ink di atas tombol amber (was putih)
  sidebar: "#0059C9",       // bright blue — DIPERTAHANKAN utk Owner/StreetBarber
  sidebarSurface: "#006FEE",// brighter blue — DIPERTAHANKAN
  sidebarText: "#FFFFFF",
  sidebarTextDim: "rgba(255,255,255,0.75)",
  shadow: "rgba(15, 26, 46, 0.08)",
  // Derived tokens — turunan brand, jangan dipakai untuk mengganti token dasar
  gold: "#FFB84D",                  // rating / premium accent
  brandGradStart: "#F5A524",
  brandGradMid: "#F7B84D",
  brandGradEnd: "#FBCB7A",
  navyGradStart: "#0059C9",
  navyGradMid: "#006FEE",
  navyGradEnd: "#4C9FFF",
  cardShadow: "rgba(15, 26, 46, 0.06)",
  cardShadowStrong: "rgba(15, 26, 46, 0.1)",
  overlay: "rgba(15, 26, 46, 0.5)",
  onBrand: "#0F1A2E",
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 28,
};

// Plus Jakarta Sans font stack
export const FONT = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  extrabold: "PlusJakartaSans-ExtraBold",
};

// Spacing scale — konsisten di semua halaman
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

// Shadow presets untuk kartu bertingkat
export const SHADOW = {
  sm: { shadowColor: "rgba(15,26,46,0.04)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 1 },
  md: { shadowColor: "rgba(15,26,46,0.06)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  lg: { shadowColor: "rgba(15,26,46,0.08)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18, elevation: 5 },
  xl: { shadowColor: "rgba(15,26,46,0.10)", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 24, elevation: 8 },
  brand: { shadowColor: "#F5A524", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
} as const;
