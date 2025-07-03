import { router } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useAdmin } from "../contexts/AdminContext"; // adapte le chemin si besoin

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
            router.replace("/"); // on reste sur l'accueil après logout
          }
        }
      ]
    );
  };

  return (
    <View style={{
      flex: 1, justifyContent: "center", alignItems: "center",
      backgroundColor: "#091D36"
    }}>
      <Text style={{
        fontSize: 32, fontWeight: "bold", color: "#FF8200", marginBottom: 40
      }}>
        Les Comets Honfleur
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: "#fff", padding: 22, borderRadius: 18,
          marginBottom: 20, width: 220, alignItems: "center"
        }}
        onPress={() => router.push("/joueurs")}
      >
        <Text style={{ fontSize: 22, color: "#FF8200" }}>Joueurs</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          backgroundColor: "#fff", padding: 22, borderRadius: 18,
          marginBottom: 20, width: 220, alignItems: "center"
        }}
        onPress={() => router.push("/matchs")}
      >
        <Text style={{ fontSize: 22, color: "#FF8200" }}>Matchs</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          backgroundColor: "#fff", padding: 22, borderRadius: 18,
          marginBottom: 20, width: 220, alignItems: "center"
        }}
        onPress={() => router.push("/classement")}
      >
        <Text style={{ fontSize: 22, color: "#FF8200" }}>Classement</Text>
      </TouchableOpacity>

      {/* Onglet Messages : visible seulement si admin */}
      {isAdmin && (
        <TouchableOpacity
          style={{
            backgroundColor: "#fff", padding: 22, borderRadius: 18,
            marginBottom: 20, width: 220, alignItems: "center"
          }}
          onPress={() => router.push("/messages")}
        >
          <Text style={{ fontSize: 22, color: "#FF8200" }}>Messages</Text>
        </TouchableOpacity>
      )}

      {/* Bouton Connexion/Déconnexion */}
      <TouchableOpacity
        style={{
          backgroundColor: "#FFD08D", padding: 16, borderRadius: 14,
          marginTop: 30, width: 160, alignItems: "center"
        }}
        onPress={isAdmin ? handleLogout : () => router.push("/login")}
      >
        <Text style={{
          fontSize: 18,
          color: isAdmin ? "#D63908" : "#FF8200",
          fontWeight: "bold",
          letterSpacing: 1,
        }}>
          {isAdmin ? "Déconnexion" : "Connexion"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
