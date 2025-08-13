// contexts/AdminContext.tsx
"use client";

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
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

// === Config ===
const API_BASE = "https://les-comets-honfleur.vercel.app";
const SESSION_KEY = "session";
const EXPO_PUSH_TOKEN_KEY = "expoPushToken";

// === Utils ===
function showLog(title: string, message: string) {
  console.log(`LOG  📢 ${title}: ${message}`);
  Alert.alert(title, message);
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
    sound: true,
  });
  showLog("Push", "Canal Android configuré ✅");
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = admin?.role === "admin";
  const isMember = admin?.role === "member";

  useEffect(() => {
    ensureAndroidChannel().catch((e) =>
      showLog("Push", "Erreur création canal: " + e?.message)
    );
  }, []);

  async function showExpoTokenOnce() {
    const projectId = getProjectId();
    if (!projectId) {
      showLog("Push", "Project ID manquant. Vérifie app.json > extra.");
      return;
    }
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    showLog("Expo Push Token", expoPushToken);
  }

  /**
   * Récupère le token Expo et l'enregistre dans Supabase:
   * admins.expo_push_token = <token> pour l'utilisateur connecté.
   * - Compare avec SecureStore pour éviter les updates inutiles.
   * - Tente d'abord WHERE id = userId, puis fallback WHERE email = userEmail.
   */
  async function ensurePushTokenRegistered(userId: string, userEmail?: string) {
  try {
    const { status, granted, ios } = await Notifications.requestPermissionsAsync();
    const allowed =
      granted ||
      status === "granted" ||
      ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!allowed) {
      showLog("Push", "Permission notifications refusée ❌");
      return;
    }
    showLog("Push", "Permission notifications accordée ✅");

    const projectId = getProjectId();
    if (!projectId) {
      showLog("Push", "⚠️ ProjectId manquant (extra/public ou EAS).");
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!expoPushToken) {
      showLog("Push", "Impossible d'obtenir un ExpoPushToken ❌");
      return;
    }
    showLog("Push", "Token récupéré: " + expoPushToken);

    // Évite l’UPDATE si identique au cache local
    const savedLocal = await SecureStore.getItemAsync(EXPO_PUSH_TOKEN_KEY);
    if (savedLocal === expoPushToken) {
      showLog("Push", "Token identique déjà stocké localement — skip update.");
      return;
    }

    // ============ TENTATIVE 1: par EMAIL =============
    let updatedRows = 0;
    if (userEmail) {
      const { data, error } = await supabase
        .from("admins")
        .update({ expo_push_token: expoPushToken })
        .eq("email", userEmail)
        .select("id");

      if (error) {
        console.log("LOG  📢 Push: ⚠️ UPDATE par email KO:", error.message);
      } else {
        updatedRows = data?.length ?? 0;
        if (updatedRows > 0) {
          await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, expoPushToken);
          showLog("Push", `Token enregistré (email=${userEmail}) ✅ (${updatedRows} ligne(s))`);
        } else {
          console.log("LOG  📢 Push: UPDATE par email OK mais 0 ligne affectée.");
        }
      }
    }

    // ============ TENTATIVE 2: par ID si email n’a rien touché ============
    if (updatedRows === 0 && userId) {
      const { data, error } = await supabase
        .from("admins")
        .update({ expo_push_token: expoPushToken })
        .eq("id", userId) // attention si admins.id != uuid (bigint ?)
        .select("id");

      if (error) {
        console.log("LOG  📢 Push: ⚠️ UPDATE par id KO:", error.message);
      } else {
        updatedRows = data?.length ?? 0;
        if (updatedRows > 0) {
          await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, expoPushToken);
          showLog("Push", `Token enregistré (id=${userId}) ✅ (${updatedRows} ligne(s))`);
        } else {
          console.log("LOG  📢 Push: UPDATE par id OK mais 0 ligne affectée.");
        }
      }
    }

    // ============ Vérification: relire la valeur en base ============
    if (userEmail) {
      const { data: rowByEmail, error: readErrEmail } = await supabase
        .from("admins")
        .select("email, expo_push_token, id")
        .eq("email", userEmail)
        .maybeSingle();

      if (!readErrEmail && rowByEmail) {
        console.log("LOG  🔎 Vérif admins (email):", rowByEmail);
        if (rowByEmail.expo_push_token === expoPushToken) {
          showLog("Push", "Vérif OK: token présent en base ✅");
          return;
        }
      }
    }

    if (userId) {
      const { data: rowById, error: readErrId } = await supabase
        .from("admins")
        .select("id, email, expo_push_token")
        .eq("id", userId)
        .maybeSingle();

      if (!readErrId && rowById) {
        console.log("LOG  🔎 Vérif admins (id):", rowById);
        if (rowById.expo_push_token === expoPushToken) {
          showLog("Push", "Vérif OK: token présent en base ✅");
          return;
        }
      }
    }

    // Si on arrive ici, rien n’a été écrit
    showLog(
      "Push",
      "⚠️ Aucune ligne mise à jour. Vérifie que `admins` contient bien une ligne pour cet email/id et les types de colonnes."
    );
  } catch (e: any) {
    showLog("Push", "Erreur: " + (e?.message || e));
  }
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

        showLog("Session", `Reprise de session pour ${s.email}`);
        if (s.id) ensurePushTokenRegistered(s.id, s.email);
      } else {
        setAdmin(null);
        showLog("Session", "Aucune session trouvée");
      }
    } catch (err) {
      setAdmin(null);
      showLog("Session", "Erreur lecture session: " + err);
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
      if (!res.ok) {
        showLog("Login", "Échec: " + res.status);
        return false;
      }
      const data = await res.json();

      if (!data?.success || !data?.role || !data?.id) {
        showLog("Login", "Réponse invalide du serveur");
        return false;
      }

      const sess = {
        email: data.email as string,
        id: data.id as string,
        role: data.role as Role,
        participations: (data.participations as number) ?? 0,
      };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sess));

      setAdmin({
        id: sess.id,
        email: sess.email,
        role: sess.role,
        participations: sess.participations,
      });

      showLog("Login", `Connecté en tant que ${sess.email}`);

      // 👉 Enregistre/MAJ le token Expo directement dans Supabase
      await ensurePushTokenRegistered(sess.id, sess.email);

      return true;
    } catch (e: any) {
      showLog("Login", "Erreur: " + (e?.message || e));
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
      if (!res.ok) {
        showLog("Register", "Échec: " + res.status);
        return false;
      }
      showLog("Register", `Compte créé pour ${email}`);
      return true;
    } catch (e: any) {
      showLog("Register", "Erreur: " + (e?.message || e));
      return false;
    }
  };

  const logout = async () => {
    try {
      // Nettoyage côté DB: on supprime le token pour ce user (sans updated_at)
      const sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionStr) {
        const s = JSON.parse(sessionStr) as { id: string; email?: string };
        const byId = await supabase
          .from("admins")
          .update({ expo_push_token: null })
          .eq("id", s.id);

        if (byId.error && s.email) {
          await supabase
            .from("admins")
            .update({ expo_push_token: null })
            .eq("email", s.email);
        }
      }
    } finally {
      await SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setAdmin(null);
      showLog("Logout", "Session supprimée localement ✅");
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
