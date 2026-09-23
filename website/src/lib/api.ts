export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://app-pangkaskaka-production.up.railway.app";

// Link ke asset APK rilis terbaru langsung (redirect 302 dari GitHub ke file-nya),
// bukan ke halaman listing release — supaya klik "Pasang"/"Unduh" langsung memicu
// unduhan. Dipakai bareng oleh InstallAppBanner dan footer (alur yang cuma ada di
// aplikasi mobile, seperti daftar StreetBarber/toko).
export const APK_URL =
  "https://github.com/Petra-Miracle/APP-PangkasKAKA/releases/latest/download/app-release.apk";

export type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

export type Shop = {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  price_range?: string;
  image?: string;
  rating?: number;
  min_price?: number | null;
  distance_km?: number | null;
  services?: Service[];
  barbers?: Barber[];
  reviews?: Review[];
};

export type Barber = {
  id: string;
  name: string;
  photo?: string;
  karyawan_id?: string;
  shop_id?: string;
  shop_name?: string;
  rating?: number;
  is_street_barber?: boolean;
  services?: Service[];
  home_service_fee?: number;
  distance_km?: number;
  eta_minutes?: number;
};

export type Review = {
  id: string;
  rating: number;
  comment?: string;
  reviewer?: { name: string; photo?: string };
  created_at: string;
};

export type Slot = { time: string; available: boolean };

export type Product = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  shop_id?: string;
  shop_name?: string;
};

export type Booking = {
  id: string;
  status: string;
  booking_date: string;
  booking_time: string;
  delivery_mode: string;
  amount_total_charged?: number;
  shop?: { name: string; image?: string; address?: string };
  barber?: { name: string; photo?: string };
  service?: Service;
  has_review?: boolean;
};

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// FastAPI mengirim `detail` sebagai string untuk HTTPException manual, tapi sebagai
// array [{loc, msg, type}, ...] untuk error validasi Pydantic otomatis (422) — dulu
// kode ini menganggap detail selalu string dan menampilkan array mentah/"[object
// Object]", sama seperti bug yang sudah diperbaiki di aplikasi mobile.
function extractErrorMessage(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown; message?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((e) =>
        typeof e === "string" ? e : (e as { msg?: string })?.msg ?? JSON.stringify(e)
      )
      .join("; ");
  }
  const message = (data as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message) return message;
  return `Error ${status}`;
}

// fetch() bawaan tidak punya timeout — kalau Railway/koneksi macet di tengah jalan
// tanpa error, promise tidak pernah resolve/reject dan UI nyangkut di loading
// selamanya. GET dibatasi lebih ketat (data publik, aman diulang); POST/PUT diberi
// jeda lebih longgar karena bisa membawa aksi yang tidak aman diulang otomatis.
const GET_TIMEOUT_MS = 10_000;
const WRITE_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; revalidate?: number } = {}
): Promise<T> {
  const { token, headers, revalidate, ...rest } = options;
  const isGet = !rest.method || rest.method === "GET";
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_URL}/api${path}`,
      {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        // Publik & jarang berubah tiap detik (daftar toko, katalog, detail) boleh
        // di-cache singkat lewat revalidate — auth/booking/pembayaran/lokasi tetap
        // no-store (lihat pemanggil masing-masing) supaya selalu data terbaru.
        ...(revalidate != null ? { next: { revalidate } } : { cache: rest.cache ?? "no-store" }),
      },
      isGet ? GET_TIMEOUT_MS : WRITE_TIMEOUT_MS
    );
  } catch {
    throw new ApiError(0, "Koneksi ke server terputus. Periksa internet kamu dan coba lagi.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(data, res.status));
  }
  return data as T;
}

export const api = {
  publicStats: () =>
    request<{ shop_count: number; streetbarber_active_count: number; avg_rating: number | null }>(
      "/stats/public",
      { revalidate: 120 }
    ),
  listShops: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][]
    ).toString();
    return request<{ shops: Shop[] }>(`/shops${qs ? `?${qs}` : ""}`, { revalidate: 30 });
  },
  // Lokasi live StreetBarber — tidak pernah di-cache, beda dengan listing statis di atas.
  nearbyBarbers: (lat: number, lng: number) =>
    request<{ barbers: Barber[] }>(`/barbers/nearby?lat=${lat}&lng=${lng}`),
  shopDetail: (id: string) => request<Shop>(`/shops/${id}`, { revalidate: 60 }),
  barberDetail: (id: string) => request<Barber>(`/barbers/${id}`, { revalidate: 60 }),
  barberSlots: (barberId: string, date: string, serviceId: string) =>
    request<{ slots: Slot[] }>(
      `/barbers/${barberId}/slots?date=${date}&service_id=${serviceId}`
    ),
  listProducts: () => request<{ products: Product[] }>("/products/catalog", { revalidate: 60 }),
  shopSlots: (shopId: string, barberId: string, date: string, serviceId: string) =>
    request<{ slots: Slot[] }>(
      `/shops/${shopId}/slots?barber_id=${barberId}&date=${date}&service_id=${serviceId}`
    ),
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  register: (body: {
    email: string;
    password: string;
    name: string;
    phone: string;
    role: string;
  }) =>
    request<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) }
    ),
  me: (token: string) =>
    request<{ user: { id: string; name: string; email: string; role: string } }>("/auth/me", {
      token,
    }),
  myBookings: (token: string) =>
    request<{ bookings: Booking[] }>("/bookings", { token }),
  bookingDetail: (id: string, token: string) =>
    request<Booking & { id: string }>(`/bookings/${id}`, { token }),
  karyawanLocation: (bookingId: string, token: string) =>
    request<{ lat: number; lng: number; updated_at: string; distance_km?: number }>(
      `/bookings/${bookingId}/karyawan-location`,
      { token }
    ),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, new_password: newPassword }),
    }),
  createBooking: (
    body: {
      barber_id: string;
      shop_id: string;
      service_id: string;
      booking_date: string;
      booking_time: string;
      delivery_mode: string;
      customer_lat?: number;
      customer_lng?: number;
      customer_address?: string;
    },
    token: string
  ) => request<{ booking: Booking }>("/bookings", { method: "POST", body: JSON.stringify(body), token }),
  // Konfirmasi "Saya Sudah Bayar" — endpoint sama dengan aplikasi mobile
  // (POST /bookings/{bid}/pay), cek ulang status pembayaran di backend, bukan
  // cuma menandai state lokal jadi "done".
  payBooking: (bookingId: string, token: string) =>
    request<{ ok: boolean; already?: boolean }>(`/bookings/${bookingId}/pay`, {
      method: "POST",
      token,
    }),
};

export function formatIDR(n: number | undefined | null) {
  if (n == null) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}
