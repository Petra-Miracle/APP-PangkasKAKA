export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://app-pangkaskaka-production.up.railway.app";

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

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: rest.cache ?? "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.detail ?? "Terjadi kesalahan");
  }
  return data as T;
}

export const api = {
  listShops: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][]
    ).toString();
    return request<{ shops: Shop[] }>(`/shops${qs ? `?${qs}` : ""}`);
  },
  nearbyBarbers: (lat: number, lng: number) =>
    request<{ barbers: Barber[] }>(`/barbers/nearby?lat=${lat}&lng=${lng}`),
  shopDetail: (id: string) => request<Shop>(`/shops/${id}`),
  barberDetail: (id: string) => request<Barber>(`/barbers/${id}`),
  barberSlots: (barberId: string, date: string, serviceId: string) =>
    request<{ slots: Slot[] }>(
      `/barbers/${barberId}/slots?date=${date}&service_id=${serviceId}`
    ),
  listProducts: () => request<{ products: Product[] }>("/products/catalog"),
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
};

export function formatIDR(n: number | undefined | null) {
  if (n == null) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}
