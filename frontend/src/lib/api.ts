import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API = `${BASE}/api`;

async function req(path: string, opts: RequestInit = {}) {
  const token = await AsyncStorage.getItem("token");
  const headers: any = {
    "Content-Type": "application/json",
    ...(opts.headers as any || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
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

// Electric Blue Theme — Hackathon PIDI.id
export const COLORS = {
  bg: "#F9F9FA",           // main background (light gray)
  surface: "#FFFFFF",       // card white
  surface2: "#F3F3F4",      // soft container / input bg
  text: "#0A2540",          // dark navy — primary text
  textDim: "#6B7C8F",       // muted body
  textMuted: "#2D3F55",     // secondary
  brand: "#006FEE",         // electric blue
  brandDim: "#E6F0FF",      // brand tint background
  brandLight: "#3B8CFF",    // brand lighter for accents/links
  success: "#00B27A",
  warning: "#F5A524",
  info: "#0EA5E9",
  error: "#DC2626",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  textInverse: "#FFFFFF",   // text on brand button
  sidebar: "#0A2540",       // dark navy for owner/admin nav
  sidebarSurface: "#0F2E4F",// slightly lighter navy
  sidebarText: "#FFFFFF",
  sidebarTextDim: "#8FA5BF",
  shadow: "rgba(10, 37, 64, 0.08)",
  // Derived tokens — turunan brand, jangan dipakai untuk mengganti token dasar
  gold: "#FFB84D",                  // rating / premium accent
  brandGradStart: "#0059C9",
  brandGradMid: "#006FEE",
  brandGradEnd: "#4C9FFF",
  navyGradStart: "#0A2540",
  navyGradMid: "#0F2E4F",
  navyGradEnd: "#1B4A7A",
  cardShadow: "rgba(10, 37, 64, 0.06)",
  cardShadowStrong: "rgba(10, 37, 64, 0.1)",
  overlay: "rgba(10, 37, 64, 0.5)",
  onBrand: "#FFFFFF",
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
