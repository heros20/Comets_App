import { router } from "expo-router";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
} from "react-native";
import { useAdmin } from "../contexts/AdminContext";

const logoComets = require("../assets/images/iconComets.png");

export default function Accueil() {
  const { isAdmin, isMember, logout } = useAdmin();
  const isLoggedIn = isAdmin || isMember;
  const windowWidth = Dimensions.get("window").width;

  // 1 colonne sous 400px, sinon 2 colonnes.
  const isNarrow = windowWidth < 400;
  const cardWidth = isNarrow
    ? windowWidth - 34
    : Math.max((windowWidth - 48) / 2, 155);

  // **Nav classique SANS l’admin**
  const navItems = [
    { label: "Joueurs", icon: "⚾️", route: "/joueurs" },
    { label: "Matchs", icon: "🗓️", route: "/matchs" },
    { label: "Classement", icon: "🏆", route: "/classement" },
    { label: "Actualités", icon: "📰", route: "/actus" },
    { label: "Galerie", icon: "🖼️", route: "/GalleryScreen" },
    ...(isLoggedIn ? [{ label: "Profil", icon: "👤", route: "/profil" }] : []),
  ];

  const handleLogout = async () => {
    Alert.alert(
      "Déconnexion",
      "Tu veux vraiment te déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/");
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoWrap}>
          <Image source={logoComets} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Les Comets Honfleur</Text>
        <Text style={styles.subTitle}>Club Officiel • Baseball R1 • 2025</Text>

        <View style={styles.authBtns}>
          {isLoggedIn ? (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Déconnexion</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
                <Text style={styles.loginBtnText}>Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.registerBtn} onPress={() => router.push("/(tabs)/Register")}>
                <Text style={styles.registerBtnText}>Inscription</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.menuGrid}>
          {navItems.map(({ label, icon, route }, idx) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  marginRight: isNarrow ? 0 : idx % 2 === 0 ? 7 : 0,
                  marginLeft: isNarrow ? 0 : idx % 2 === 1 ? 7 : 0,
                },
              ]}
              onPress={() => router.push(route)}
              activeOpacity={0.87}
            >
              <Text style={styles.cardIcon}>{icon}</Text>
              <Text
                style={styles.cardText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- ADMIN BUTTON distinct en bas --- */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push("/admin")}
            activeOpacity={0.88}
          >
            <Text style={styles.adminBtnIcon}>🛠️</Text>
            <Text style={styles.adminBtnText}>Espace Admin</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.footNote}>Made by Kevin – powered by Comets Honfleur 🟠</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181C",
  },
  scrollContainer: {
    alignItems: "center",
    paddingTop: 34,
    paddingBottom: 26,
    paddingHorizontal: 8,
    minHeight: "100%",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 0,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    shadowColor: "#FF8200",
    shadowOpacity: 0.16,
    shadowRadius: 13,
    elevation: 4,
  },
  title: {
    fontSize: 27,
    fontWeight: "bold",
    color: "#FF8200",
    letterSpacing: 1.2,
    textAlign: "center",
    textShadowColor: "#FFE3B7",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#f3b981",
    letterSpacing: 0.7,
    textAlign: "center",
    marginBottom: 18,
  },
  authBtns: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 27,
    marginTop: 4,
  },
  loginBtn: {
    backgroundColor: "#FFD08D",
    paddingVertical: 9,
    paddingHorizontal: 19,
    borderRadius: 11,
    marginRight: 6,
  },
  loginBtnText: {
    fontSize: 15,
    color: "#FF8200",
    fontWeight: "bold",
    letterSpacing: 0.7,
  },
  registerBtn: {
    backgroundColor: "#FF8200",
    paddingVertical: 9,
    paddingHorizontal: 19,
    borderRadius: 11,
  },
  registerBtnText: {
    fontSize: 15,
    color: "#FFF",
    fontWeight: "bold",
    letterSpacing: 0.7,
  },
  logoutBtn: {
    backgroundColor: "#FFD08D",
    paddingVertical: 9,
    paddingHorizontal: 24,
    borderRadius: 11,
  },
  logoutBtnText: {
    fontSize: 15,
    color: "#D63908",
    fontWeight: "bold",
    letterSpacing: 0.7,
  },
  // Grille du menu
  menuGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 13,
    marginTop: 0,
  },
  card: {
    backgroundColor: "rgba(255,250,245,0.98)",
    borderRadius: 17,
    marginBottom: 13,
    paddingVertical: 17,
    paddingHorizontal: 10,
    alignItems: "center",
    flexDirection: "row",
    shadowColor: "#FF8200",
    shadowOpacity: 0.11,
    shadowRadius: 9,
    elevation: 1,
    borderWidth: 2,
    borderColor: "#FF8200",
    gap: 13,
    minWidth: 138,
    maxWidth: 210,
    flex: 1,
  },
  cardIcon: {
    fontSize: 25,
    marginRight: 7,
  },
  cardText: {
    fontSize: 16,
    color: "#FF8200",
    fontWeight: "bold",
    letterSpacing: 0.5,
    flex: 1,
  },
  // --- Admin button style distinct ---
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF8200",
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 37,
    marginTop: 19,
    marginBottom: 15,
    shadowColor: "#FF8200",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
    borderWidth: 2.2,
    borderColor: "#FFD08D",
  },
  adminBtnIcon: {
    fontSize: 25,
    color: "#FFF",
    marginRight: 13,
  },
  adminBtnText: {
    fontSize: 17.5,
    color: "#FFF",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    textShadowColor: "#FFD08D",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  footNote: {
    color: "#666",
    fontSize: 11,
    textAlign: "center",
    marginTop: 32,
    marginBottom: 0,
    fontStyle: "italic",
  },
});
