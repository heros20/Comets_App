// navigation/RootNavigation.ts
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function navTo(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  } else {
    console.log("⚠️ navigationRef pas prêt, route ignorée:", name, params);
  }
}
