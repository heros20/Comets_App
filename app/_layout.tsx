import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '../hooks/useColorScheme';

// 🟠 Import du provider admin !
import { AdminProvider } from '../contexts/AdminContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    // On englobe toute l'app avec le provider admin
    <AdminProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* Accueil */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          {/* Toutes les pages avec tabs */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Page 404 */}
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AdminProvider>
  );
}
