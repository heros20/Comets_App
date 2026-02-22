// navigation/RootNavigation.ts
import { createNavigationContainerRef, ParamListBase } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<ParamListBase>();

export function navTo(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    console.log("⚠️ navigationRef pas prêt, route ignorée:", name, params);
  }
}
