import { Slot, useRouter, useSegments } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { Text, TouchableOpacity, View } from 'react-native'

export const options = { headerShown: false }

// Dictionnaire de titres par segment (tu peux l’étendre)
const TITLES: Record<string, string> = {
  joueurs: "Joueurs",
  matchs: "Matchs",
  classement: "Classement",
  messages: "Messages",
  // Ajoute ici d’autres titres si besoin
}

export default function TabsLayout() {
  const segments = useSegments()
  const router = useRouter()
  const current = segments[segments.length - 1]

  // Si on est sur la home des tabs, pas de header retour
  const isHome = current === undefined || current === "(tabs)"

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FB" }}>
      {/* Header custom si pas sur la home */}
      {!isHome && (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: 32,
          paddingBottom: 16,
          paddingHorizontal: 16,
          backgroundColor: "#E3F6FF"
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 6 }}>
            <ArrowLeft size={24} color="#2196F3" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: "#2196F3" }}>
            {TITLES[current as string] || ""}
          </Text>
        </View>
      )}
      <Slot />
    </View>
  )
}
