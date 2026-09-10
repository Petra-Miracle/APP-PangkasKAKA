import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { registerPushToken, unregisterPushToken } from "./notifications";

type User = { id: string; email: string; name: string; phone: string; role: "customer" | "owner" | "streetbarber" | "admin" | "superadmin"; address?: string; lat?: number; lng?: number; photo?: string; home_delivery_blocked?: boolean };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) { setUser(null); await AsyncStorage.removeItem("cached_user"); return; }
      const res = await api.get("/auth/me");
      setUser(res.user);
      await AsyncStorage.setItem("cached_user", JSON.stringify(res.user));
    } catch { setUser(null); await AsyncStorage.multiRemove(["token", "cached_user"]); }
  }, []);

  useEffect(() => {
    (async () => {
      // Startup lama terasa lambat karena splash menunggu round-trip
      // /auth/me sebelum bisa navigasi. Untuk user yang sudah pernah login,
      // tampilkan dulu dari cache lokal (loading=false langsung) lalu
      // konfirmasi/koreksi ke server di latar belakang — bukan sebaliknya.
      try {
        const cached = await AsyncStorage.getItem("cached_user");
        if (cached) { setUser(JSON.parse(cached)); setLoading(false); refresh(); return; }
      } catch {}
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (user) registerPushToken().catch(() => {});
  }, [user]);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem("token", res.token);
    await AsyncStorage.setItem("cached_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user as User;
  };

  const register = async (data: any) => {
    const res = await api.post("/auth/register", data);
    await AsyncStorage.setItem("token", res.token);
    await AsyncStorage.setItem("cached_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user as User;
  };

  const logout = async () => {
    await unregisterPushToken().catch(() => {});
    await AsyncStorage.multiRemove(["token", "cached_user"]);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};
