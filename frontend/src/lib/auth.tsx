import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

type User = { id: string; email: string; name: string; phone: string; role: "customer" | "owner" | "admin" | "karyawan"; address?: string; photo?: string };

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
      if (!token) { setUser(null); return; }
      const res = await api.get("/auth/me");
      setUser(res.user);
    } catch { setUser(null); await AsyncStorage.removeItem("token"); }
  }, []);

  useEffect(() => {
    (async () => { await refresh(); setLoading(false); })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem("token", res.token);
    setUser(res.user);
    return res.user as User;
  };

  const register = async (data: any) => {
    const res = await api.post("/auth/register", data);
    await AsyncStorage.setItem("token", res.token);
    setUser(res.user);
    return res.user as User;
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};
