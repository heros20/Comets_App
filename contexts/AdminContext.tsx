"use client";

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
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
    sound: true,
  });
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = admin?.role === "admin";
  const isMember = admin?.role === "member";

  useEffect(() => {
    ensureAndroidChannel().catch(() => {});
  }, []);

  async function ensurePushTokenRegistered(userId: string, userEmail?: string) {
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
  }

  const checkSession = async () => {
    setIsLoading(true);
    try {
      const sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionStr) {
        const s = JSON.parse(sessionStr) as {
          id: string;
          email: string;
          role: Role;
          participations?: number;
        };
        setAdmin({
          id: s.id,
          email: s.email,
          role: s.role,
          participations: s.participations ?? 0,
        });
        if (s.id) ensurePushTokenRegistered(s.id, s.email);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      if (!data?.success || !data?.role || !data?.id) return false;

      const sess = {
        email: data.email as string,
        id: data.id as string,
        role: data.role as Role,
        participations: (data.participations as number) ?? 0,
      };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sess));
      setAdmin(sess);

      await ensurePushTokenRegistered(sess.id, sess.email);

      return true;
    } catch {
      return false;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
