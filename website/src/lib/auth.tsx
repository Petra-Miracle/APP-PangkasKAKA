"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type User = { id: string; name: string; email: string; role: string };

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "pangkaskaka_web_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
        : null;
    if (!saved) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    queueMicrotask(() => setToken(saved));
    api
      .me(saved)
      .then((r) => setUser(r.user))
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, remember = true) {
    const r = await api.login(email, password);
    (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, r.token);
    setToken(r.token);
    setUser(r.user);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Pemesanan (booking) hanya untuk user yang sudah punya akun & login — dipakai di
// tiap langkah alur booking (layanan/jadwal/ringkasan/pembayaran), bukan cuma di
// langkah terakhir, supaya guest tidak diminta login setelah repot memilih
// layanan/jadwal dulu. `nextPath` dipakai auth.tsx untuk redirect balik ke langkah
// yang sama setelah login.
export function useRequireAuth(nextPath: string) {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace(`/masuk?next=${encodeURIComponent(nextPath)}`);
    }
  }, [loading, user, token, router, nextPath]);

  return { user, token, loading, authed: !loading && !!user && !!token };
}
