"use client";

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { supabase } from "../supabase";

type Role = "admin" | "member" | "guest";

export type Admin = {
  id: string;
  email: string;
  role: Role;
  participations?: number;
  first_name?: string;
  last_name?: string;
  expo_push_token?: string | null;
};

type AdminContextType = {
  admin: Admin | null;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
  setAdmin: React.Dispatch<React.SetStateAction<Admin | null>>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType>({
  admin: null,
  isAdmin: false,
  isMember: false,
  isLoading: true,
  setAdmin: () => {},
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  checkSession: async () => {},
});

const API_BASE = "https://les-comets-honfleur.vercel.app";
const SESSION_KEY = "session";
const EXPO_PUSH_TOKEN_KEY = "expoPushToken";

function isAuthRole(value: unknown): value is "admin" | "member" {
  return value === "admin" || value === "member";
}

function getProjectId(): string | undefined {
  const fromExtraPublic =
    (Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_PROJECT_ID ??
    (Constants.manifestExtra as any)?.EXPO_PUBLIC_PROJECT_ID;

  const fromEas =
    (Constants as any)?.easConfig?.projectId ??
    (Constants.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants.manifestExtra as any)?.eas?.projectId;

  return fromExtraPublic ?? fromEas;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [250, 250, 250, 250],
    sound: "default",
  });
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...(init ?? {}), signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function parseStoredSession(raw: string | null): Admin | null {
  if (!raw) return null;

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isAuthRole(parsed?.role)) return null;

  const id = parsed?.id != null ? String(parsed.id).trim() : "";
  const email = typeof parsed?.email === "string" ? parsed.email.trim().toLowerCase() : "";
  if (!id || !email) return null;

  return {
    id,
    email,
    role: parsed.role,
    participations:
      typeof parsed?.participations === "number" && Number.isFinite(parsed.participations)
        ? parsed.participations
        : 0,
    first_name: typeof parsed?.first_name === "string" ? parsed.first_name : undefined,
    last_name: typeof parsed?.last_name === "string" ? parsed.last_name : undefined,
  };
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const checkingRef = useRef<Promise<void> | null>(null);

  const isAdmin = admin?.role === "admin";
  const isMember = admin?.role === "member";

  useEffect(() => {
    ensureAndroidChannel().catch(() => {});
  }, []);

  const ensurePushTokenRegistered = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { status, granted, ios } = await Notifications.requestPermissionsAsync();
      const allowed =
        granted ||
        status === "granted" ||
        ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

      if (!allowed) return;

      const projectId = getProjectId();
      if (!projectId) return;

      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!expoPushToken) return;

      const savedLocal = await SecureStore.getItemAsync(EXPO_PUSH_TOKEN_KEY);
      if (savedLocal === expoPushToken) return;

      let updatedRows = 0;
      if (userEmail) {
        const { data } = await supabase
          .from("admins")
          .update({ expo_push_token: expoPushToken })
          .eq("email", userEmail)
          .select("id");

        updatedRows = data?.length ?? 0;
        if (updatedRows > 0) {
          await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, expoPushToken);
        }
      }

      if (updatedRows === 0 && userId) {
        const { data } = await supabase
          .from("admins")
          .update({ expo_push_token: expoPushToken })
          .eq("id", userId)
          .select("id");

        updatedRows = data?.length ?? 0;
        if (updatedRows > 0) {
          await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, expoPushToken);
        }
      }
    } catch {}
  }, []);

  const runSessionCheck = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (checkingRef.current) return checkingRef.current;

      const task = (async () => {
        const silent = !!opts?.silent;
        if (!silent) setIsLoading(true);
        try {
          const sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
          const hydrated = parseStoredSession(sessionStr);

          if (!hydrated) {
            await SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_KEY);
            await SecureStore.deleteItemAsync(SESSION_KEY);
            setAdmin(null);
            return;
          }

          setAdmin((prev) => {
            if (
              prev &&
              prev.id === hydrated.id &&
              prev.email === hydrated.email &&
              prev.role === hydrated.role &&
              (prev.participations ?? 0) === (hydrated.participations ?? 0) &&
              (prev.first_name ?? "") === (hydrated.first_name ?? "") &&
              (prev.last_name ?? "") === (hydrated.last_name ?? "")
            ) {
              return prev;
            }
            return hydrated;
          });
        } catch {
          setAdmin(null);
        } finally {
          if (!silent) setIsLoading(false);
        }
      })();

      checkingRef.current = task;
      try {
        await task;
      } finally {
        checkingRef.current = null;
      }
    },
    [],
  );

  const checkSession = useCallback(async () => {
    await runSessionCheck({ silent: false });
  }, [runSessionCheck]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runSessionCheck({ silent: true }).catch(() => {});
    });
    return () => sub.remove();
  }, [runSessionCheck]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!data?.success || !isAuthRole(data?.role)) return false;

      const id = data?.id != null ? String(data.id).trim() : "";
      const emailNormalized =
        typeof data?.email === "string" && data.email.trim()
          ? data.email.trim().toLowerCase()
          : email.trim().toLowerCase();
      if (!id || !emailNormalized) return false;

      const sess: Admin = {
        email: emailNormalized,
        id,
        role: data.role,
        participations:
          typeof data?.participations === "number" && Number.isFinite(data.participations)
            ? data.participations
            : 0,
        first_name: typeof data?.first_name === "string" ? data.first_name : undefined,
        last_name: typeof data?.last_name === "string" ? data.last_name : undefined,
      };

      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sess));
      setAdmin(sess);
      ensurePushTokenRegistered(sess.id, sess.email).catch(() => {});

      return true;
    } catch {
      return false;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      const sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionStr) {
        const s = JSON.parse(sessionStr) as { id: string; email?: string };
        await supabase.from("admins").update({ expo_push_token: null }).eq("id", s.id);
        if (s.email) {
          await supabase.from("admins").update({ expo_push_token: null }).eq("email", s.email);
        }
      }
    } finally {
      await SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setAdmin(null);
    }
  };

  return (
    <AdminContext.Provider
      value={{
        admin,
        isAdmin,
        isMember,
        isLoading,
        setAdmin,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
