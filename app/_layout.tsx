// app/_layout.tsx
"use client";

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, View } from "react-native";
import "react-native-reanimated";

import PushGateway from "../components/PushGateway";
import PremiumRouteLoader from "../components/ui/PremiumRouteLoader";
import { AdminProvider } from "../contexts/AdminContext";
import { useColorScheme } from "../hooks/useColorScheme";
import { initFirebase } from "../utils/firebaseConfig";

const ROUTE_LOADER_DELAY_MS = 180;
const ROUTE_LOADER_MIN_VISIBLE_MS = 280;
const ROUTE_LOADER_FALLBACK_MS = 900;

function GlobalRouteLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const firstRenderRef = useRef(true);
  const transitionIdRef = useRef(0);
  const shownAtRef = useRef(0);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionRef = useRef<{ cancel: () => void } | null>(null);

  const routeLabel = useMemo(() => {
    const segment = (pathname || "").split("/").filter(Boolean).pop() || "index";
    const labels: Record<string, string> = {
      index: "Accueil",
      matchs: "Matchs",
      actus: "Actualit\u00E9s",
      classement: "Classement",
      joueurs: "Joueurs",
      profil: "Profil",
      galleryscreen: "Galerie",
      actudetail: "Actualit\u00E9",
      login: "Connexion",
      register: "Inscription",
      admin: "Administration",
    };
    return labels[segment.toLowerCase()] ?? "Page";
  }, [pathname]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    transitionIdRef.current += 1;
    const transitionId = transitionIdRef.current;

    const clearShowTimer = () => {
      if (!showTimeoutRef.current) return;
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    };

    const clearHideTimer = () => {
      if (!hideTimeoutRef.current) return;
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    };

    const clearSettleTimer = () => {
      if (!settleTimeoutRef.current) return;
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    };

    const completeTransition = () => {
      if (transitionIdRef.current !== transitionId) return;

      clearShowTimer();
      clearSettleTimer();

      if (!visibleRef.current) return;

      clearHideTimer();

      const elapsed = Date.now() - shownAtRef.current;
      const wait = Math.max(0, ROUTE_LOADER_MIN_VISIBLE_MS - elapsed);

      hideTimeoutRef.current = setTimeout(() => {
        if (transitionIdRef.current !== transitionId) return;
        visibleRef.current = false;
        setVisible(false);
        hideTimeoutRef.current = null;
      }, wait);
    };

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (!visibleRef.current) {
      showTimeoutRef.current = setTimeout(() => {
        if (transitionIdRef.current !== transitionId) return;
        shownAtRef.current = Date.now();
        visibleRef.current = true;
        setVisible(true);
        showTimeoutRef.current = null;
      }, ROUTE_LOADER_DELAY_MS);
    }

    interactionRef.current?.cancel?.();
    interactionRef.current = InteractionManager.runAfterInteractions(() => {
      completeTransition();
    });

    settleTimeoutRef.current = setTimeout(() => {
      completeTransition();
    }, ROUTE_LOADER_FALLBACK_MS);

    return () => {
      clearShowTimer();
      clearHideTimer();
      clearSettleTimer();
      interactionRef.current?.cancel?.();
      interactionRef.current = null;
    };
  }, [pathname]);

  return (
    <PremiumRouteLoader
      visible={visible}
      title="Chargement"
      subtitle={`Ouverture : ${routeLabel}`}
    />
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    initFirebase?.();
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070C14" }}>
        <PremiumRouteLoader
          visible
          fullscreen
          title="Initialisation"
          subtitle="Chargement de l'application..."
        />
      </View>
    );
  }

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

        <PushGateway />
        <GlobalRouteLoader />

        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </AdminProvider>
  );
}
