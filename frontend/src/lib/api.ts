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

export const COLORS = {
  bg: "#121212", surface: "#1E1E1E", surface2: "#292929",
  text: "#F5F5F5", textDim: "#A3A3A3", textMuted: "#D4D4D4",
  brand: "#FF5722", brandDim: "#4E2112", brandLight: "#FF8A65",
  success: "#00BFA5", warning: "#FFC107", error: "#D32F2F",
  border: "#333333", borderStrong: "#4D4D4D",
};
