import React, { useEffect } from "react";
import { Slot, usePathname } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

function OrientationGuard() {
  const pathname = (usePathname() || "").toLowerCase();

  // match les deux noms possibles
  const isGame = pathname.includes("cometsrunner") || pathname.includes("cometsrunscreen");

  // Fallbacks selon ta version d'expo-screen-orientation
  const LANDSCAPE_LOCK =
    (ScreenOrientation.OrientationLock as any).LANDSCAPE ??
    (ScreenOrientation.OrientationLock as any).LANDSCAPE_RIGHT ??
    (ScreenOrientation.OrientationLock as any).LANDSCAPE_LEFT ??
    ScreenOrientation.OrientationLock.DEFAULT; // dernier recours

  useEffect(() => {
    (async () => {
      try {
        if (isGame) {
          // Jeu : paysage ONLY
          await ScreenOrientation.lockAsync(LANDSCAPE_LOCK);
        } else {
          // Reste de l’app : portrait only
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (e) {
        console.log("Orientation lock error:", e);
      }
    })();
  }, [isGame]);

  return null;
}

export default function TabsLayout() {
  return (
    <>
      <OrientationGuard />
      <Slot />
    </>
  );
}
