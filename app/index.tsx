import { router } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useAdmin } from "../contexts/AdminContext";

export default function Accueil() {
  const { isAdmin, logout } = useAdmin();

  const handleLogout = async () => {
    Alert.alert(
      "Déconnexion",
      "Tu veux vraiment te déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion", style: "destructive", onPress: async () => {
            await logout();
            router.replace("/");
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#091D36" }}>
      {/* HEADER avec titre centré et bouton à droite */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 48,
        paddingHorizontal: 24,
        backgroundColor: "#07162A",
      }}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{
            fontSize: 28,
            fontWeight: "bold",
            color: "#FF8200",
            letterSpacing: 0.5,
            marginBottom: 0,
            textAlign: "center",
          }}>
            Les Comets Honfleur
          </Text>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: "#FFD08D",
            paddingVertical: 10,
            paddingHorizontal: 19,
            borderRadius: 13,
            marginLeft: 18,
          }}
          onPress={isAdmin ? handleLogout : () => router.push("/login")}
        >
          <Text style={{
            fontSize: 17,
            color: isAdmin ? "#D63908" : "#FF8200",
            fontWeight: "bold",
            letterSpacing: 1,
          }}>
            {isAdmin ? "Déconnexion" : "Connexion"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* NAVIGATION CENTRALE */}
      <View style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 45,
      }}>
        <TouchableOpacity
          style={{
            backgroundColor: "#fff", padding: 22, borderRadius: 18,
            marginBottom: 18, width: 220, alignItems: "center"
          }}
          onPress={() => router.push("/joueurs")}
        >
          <Text style={{ fontSize: 22, color: "#FF8200", fontWeight: "600" }}>Joueurs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: "#fff", padding: 22, borderRadius: 18,
            marginBottom: 18, width: 220, alignItems: "center"
          }}
          onPress={() => router.push("/matchs")}
        >
          <Text style={{ fontSize: 22, color: "#FF8200", fontWeight: "600" }}>Matchs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: "#fff", padding: 22, borderRadius: 18,
            marginBottom: 18, width: 220, alignItems: "center"
          }}
          onPress={() => router.push("/classement")}
        >
          <Text style={{ fontSize: 22, color: "#FF8200", fontWeight: "600" }}>Classement</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            style={{
              backgroundColor: "#fff", padding: 22, borderRadius: 18,
              marginBottom: 18, width: 220, alignItems: "center"
            }}
            onPress={() => router.push("/messages")}
          >
            <Text style={{ fontSize: 22, color: "#FF8200", fontWeight: "600" }}>Messages</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
