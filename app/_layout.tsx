// app/_layout.tsx
"use client";

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";

import PushGateway from "../components/PushGateway";
import { AdminProvider } from "../contexts/AdminContext";
import { useColorScheme } from "../hooks/useColorScheme";

// 🔥 Firebase init (si tu l'utilises)
import { initFirebase } from "../utils/firebaseConfig";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Fonts
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Initialise Firebase une seule fois
  useEffect(() => {
    initFirebase?.();
  }, []);

  if (!loaded) return null;

  return (
    <AdminProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        {/* Navigation principale */}
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

        {/* Gestion centralisée des notifications (token, cold start, tap → router.push) */}
        <PushGateway />

        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </AdminProvider>
  );
}
