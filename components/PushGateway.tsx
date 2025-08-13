// components/PushGateway.tsx
"use client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
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

export default function PushGateway() {
  const { admin, isAdmin } = useAdmin();
  const email = admin?.email ?? null;

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

    // Listeners (foreground + réponse)
    const subReceived = Notifications.addNotificationReceivedListener((n) => {
      console.log("🔔 Notif reçue (foreground):", JSON.stringify(n, null, 2));
    });
    const subResponse = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("🧭 Action notif:", JSON.stringify(response, null, 2));
        const route = response?.notification?.request?.content?.data?.route;
        // TIP: si tu utilises expo-router:
        // if (route) router.push(route);
      }
    );

    return () => {
      mounted = false;
      subReceived.remove();
      subResponse.remove();
    };
  }, [isAdmin, email]);

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
