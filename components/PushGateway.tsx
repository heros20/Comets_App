// components/PushGateway.tsx
"use client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAdmin } from "../contexts/AdminContext";
import { supabase } from "../supabase";

let __notifInitDone = false; // évite double init en dev

if (!__notifInitDone) {
  __notifInitDone = true;

  // Afficher la notif en foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Canal Android (son + vibration)
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

async function registerForPushNotificationsAsync() {
  // Permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("🔕 Notifications non autorisées");
    return null;
  }

  // ProjectId pour EAS build
  const projectId =
    // SDK 51+ : expoConfig.extra.eas.projectId si défini
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
    // Fallback EAS
    (Constants as any)?.easConfig?.projectId;

  if (!projectId) {
    console.warn("⚠️ projectId manquant (extra.eas.projectId). Vérifie app.json.");
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

const STORAGE_KEY = "expo_push_token_cached";

type PushData = {
  route?: unknown;
  appRoute?: unknown;
  articleId?: unknown;
  id?: unknown;
};

function toStringValue(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function resolvePushTarget(data: unknown): string | null {
  const d = (data && typeof data === "object" ? (data as PushData) : {}) as PushData;

  const explicitArticleId = toStringValue(d.articleId) ?? toStringValue(d.id);
  const route = toStringValue(d.route);
  const appRoute = toStringValue(d.appRoute);

  if (explicitArticleId) {
    return `/ActuDetail?articleId=${encodeURIComponent(explicitArticleId)}`;
  }

  if (route) {
    // Les notifs news envoient souvent une route web: /actus/:id
    const m = route.match(/^\/actus\/([^/?#]+)/i);
    if (m?.[1]) {
      return `/ActuDetail?articleId=${encodeURIComponent(m[1])}`;
    }
  }

  if (appRoute && appRoute.startsWith("/")) {
    return appRoute;
  }

  if (route) {
    // Compat: routes web -> routes app
    if (/^\/galerie(?:\/|$)/i.test(route)) return "/GalleryScreen";
    if (/^\/calendrier(?:\/|$)/i.test(route)) return "/matchs";
    if (/^\/actus(?:\/|$)/i.test(route)) return "/(tabs)/actus";
    if (route.startsWith("/")) return route;
  }

  return null;
}

export default function PushGateway() {
  const { admin, isAdmin } = useAdmin();
  const email = admin?.email ?? null;
  const handledRequestIdsRef = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1) Récup token
      const token = await registerForPushNotificationsAsync();
      if (!mounted || !token) return;

      console.log("📨 Expo Push Token:", token);

      // 2) Cache local
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached === token) {
        // Rien à faire si identique
        // On tente quand même un push base si on vient juste de se loguer
        if (isAdmin && email) {
          await saveTokenIfNeeded(token, email);
        }
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEY, token);

      // 3) Sauvegarde en base si logué
      if (isAdmin && email) {
        await saveTokenIfNeeded(token, email);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAdmin, email]);

  useEffect(() => {
    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;

      const reqId = response.notification.request.identifier;
      if (reqId && handledRequestIdsRef.current.has(reqId)) return;
      if (reqId) handledRequestIdsRef.current.add(reqId);

      console.log("🧭 Action notif:", JSON.stringify(response, null, 2));
      const data = response.notification.request.content.data;
      const target = resolvePushTarget(data);

      if (!target) return;

      try {
        router.push(target as any);
        (Notifications as any).clearLastNotificationResponseAsync?.().catch(() => {});
      } catch (e) {
        console.warn("⚠️ Navigation notif impossible:", target, e);
      }
    };

    // Cas app fermée: ouverture via tap sur notif
    Notifications.getLastNotificationResponseAsync()
      .then(openFromResponse)
      .catch((e) => console.warn("⚠️ getLastNotificationResponseAsync error:", e));

    // Listeners (foreground + réponse)
    const subReceived = Notifications.addNotificationReceivedListener((n) => {
      console.log("🔔 Notif reçue (foreground):", JSON.stringify(n, null, 2));
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromResponse(response);
    });

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  }, []);

  return null;
}

async function saveTokenIfNeeded(token: string, email: string) {
  try {
    // Optionnel: ne save que si différent de ce qui est déjà en base
    const { data, error: readErr } = await supabase
      .from("admins")
      .select("expo_push_token")
      .eq("email", email)
      .maybeSingle();

    if (readErr) {
      console.error("❌ Read token error:", readErr.message);
      // on tente quand même l'update
    }

    if (!data || data.expo_push_token !== token) {
      const { error } = await supabase
        .from("admins")
        .update({
          expo_push_token: token,
          expo_push_platform: Platform.OS, // (colonne optionnelle)
          expo_push_updated_at: new Date().toISOString(), // (colonne optionnelle)
        })
        .eq("email", email);

      if (error) console.error("❌ Save token error:", error.message);
      else console.log("✅ Token enregistré pour", email);
    } else {
      console.log("↔️ Token inchangé en base pour", email);
    }
  } catch (e) {
    console.error("❌ Save token exception:", e);
  }
}
