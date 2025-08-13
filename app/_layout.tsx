// app/_layout.tsx
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import "react-native-reanimated";

import { useColorScheme } from "../hooks/useColorScheme";
import { AdminProvider } from "../contexts/AdminContext";
import PushGateway from "../components/PushGateway";

// 🔥 Firebase init (si tu l'utilises pour autre chose que les push Expo)
import { initFirebase } from "../utils/firebaseConfig";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Initialise Firebase une seule fois
  useEffect(() => {
    initFirebase();
  }, []);

  if (!loaded) return null;

  return (
    <AdminProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            title: "",
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false, title: "" }} />
          <Stack.Screen name="+not-found" />
        </Stack>

        {/* Gestion token + handlers/chan notifs (centralisé dans PushGateway) */}
        <PushGateway />

        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </AdminProvider>
  );
}
