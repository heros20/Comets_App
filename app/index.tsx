// app/screens/Accueil.tsx
"use client";

import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../contexts/AdminContext";

const logoComets = require("../assets/images/iconComets.png");

async function testLocalNotif() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Local OK ✅",
      body: "Si tu vois ça, le handler/canal affichent bien une notif.",
      data: { route: "/messages" },
      sound: "default",
    },
    trigger: null, // immédiat
  });
}

export default function Accueil() {
  const { isAdmin, isMember, logout } = useAdmin();
  const isLoggedIn = isAdmin || isMember;
  const windowWidth = Dimensions.get("window").width;

  // 1 colonne sous 400px, sinon 2 colonnes.
  const isNarrow = windowWidth < 400;
  const cardWidth = isNarrow ? windowWidth - 34 : Math.max((windowWidth - 48) / 2, 155);

  // Navigation principale
  const navItems = [
    { label: "Joueurs", icon: "person-outline" as const, route: "/joueurs" },
    { label: "Matchs", icon: "calendar-outline" as const, route: "/matchs" },
    { label: "Classement", icon: "trophy-outline" as const, route: "/classement" },
    { label: "Actualités", icon: "newspaper-outline" as const, route: "/actus" },
    { label: "Galerie", icon: "images-outline" as const, route: "/GalleryScreen" },
    ...(isLoggedIn
      ? [{ label: "Comets Run", icon: "game-controller-outline" as const, route: "/(tabs)/CometsRunScreen" }]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        {/* Titre centré */}
        <View style={styles.heroRow}>
          <View style={{ width: 36 }} />
          <Text style={styles.heroTitle}>Comets d’Honfleur</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Logo + sous-titres */}
        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Les Comets Honfleur</Text>
            <Text style={styles.heroSub}>Club Officiel • Baseball</Text>
          </View>
        </View>

        {/* Boutons Connexion / Inscription OU Profil / Déconnexion */}
        <View style={styles.authRow}>
          {isLoggedIn ? (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => router.push("/profil")}
                activeOpacity={0.9}
              >
                <Icon name="person-circle-outline" size={16} color="#fff" />
                <Text style={styles.btnPrimaryTxt}>Profil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnLight]}
                onPress={handleLogout}
                activeOpacity={0.9}
              >
                <Icon name="log-out-outline" size={16} color="#D63908" />
                <Text style={[styles.btnLightTxt, { color: "#D63908" }]}>Déconnexion</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnLight]}
                onPress={() => router.push("/login")}
                activeOpacity={0.9}
              >
                <Icon name="log-in-outline" size={16} color="#FF8200" />
                <Text style={styles.btnLightTxt}>Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => router.push("/(tabs)/Register")}
                activeOpacity={0.9}
              >
                <Icon name="person-add-outline" size={16} color="#fff" />
                <Text style={styles.btnPrimaryTxt}>Inscription</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* CONTENU */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {/* Intro card */}
        <View style={styles.introCard}>
          <Text style={styles.introTxt}>
            Bienvenue dans l’app officielle des Comets. Actus, matchs, galerie, profil…
            tout le club au bout des doigts. ⚾
          </Text>
        </View>

        {/* Grille menu */}
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
              activeOpacity={0.92}
            >
              <View style={styles.cardIconWrap}>
                <Icon name={icon} size={20} color="#FF8200" />
              </View>
              <Text style={styles.cardText} numberOfLines={1}>
                {label}
              </Text>
              <Icon name="chevron-forward" size={18} color="#cfd3db" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ADMIN distinct */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push("/admin")}
            activeOpacity={0.92}
          >
            <Icon name="construct-outline" size={18} color="#fff" />
            <Text style={styles.adminBtnTxt}>Espace Admin</Text>
          </TouchableOpacity>
        )}

        <Text
          style={styles.footNote}
          onPress={() => Linking.openURL("https://heros20.github.io/Portfolio-2.0/")}
        >
          Made by Kevin Bigoni
        </Text>

        <Text
          style={styles.footNote}
          onPress={() => Linking.openURL("https://les-comets-honfleur.vercel.app/mentions-legales")}
        >
           © {new Date().getFullYear()} Les Comets d’Honfleur — Tous droits réservés.
        </Text>

        {/* Bouton test notif local (optionnel) */}
        {/* <TouchableOpacity onPress={testLocalNotif} style={[styles.adminBtn, { marginTop: 10, backgroundColor: "#1b1e27", borderColor: "#2b3141" }]}>
          <Icon name="notifications-outline" size={18} color="#FF8200" />
          <Text style={[styles.adminBtnTxt, { color: "#FF8200" }]}>Tester une notif locale</Text>
        </TouchableOpacity> */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // === HERO (aligné sur Actus/Galerie) ===
  hero: {
    backgroundColor: "#11131a",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
    paddingBottom: 12,
  },
  heroStripe: {
    position: "absolute",
    right: -60,
    top: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,130,0,0.10)",
    transform: [{ rotate: "18deg" }],
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  heroTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FF8200",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },

  // Boutons d’auth
  authRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnLight: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "#2b3141",
  },
  btnLightTxt: { color: "#FF8200", fontWeight: "900", fontSize: 13.5 },
  btnPrimary: {
    backgroundColor: "#D96B00",
    borderWidth: 1,
    borderColor: "#FF8200",
  },
  btnPrimaryTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  // === CONTENU LISTE ===
  listContainer: { paddingHorizontal: 12, paddingBottom: 34, paddingTop: 14 },

  introCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    padding: 14,
    marginBottom: 12,
  },
  introTxt: { color: "#cfd3db", fontSize: 14.5, lineHeight: 20, textAlign: "center" },

  // Grille du menu
  menuGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    gap: 12,
    minWidth: 138,
    maxWidth: 240,
    flex: 1,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#141821",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#252a38",
  },
  cardText: { fontSize: 15.5, color: "#eaeef7", fontWeight: "800", letterSpacing: 0.3, flex: 1 },

  // Admin
  adminBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#D96B00",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "##D96B00",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  adminBtnTxt: { backgroundColor: "##D96B00", color: "#fff", fontWeight: "900", fontSize: 14.5, letterSpacing: 0.5, textTransform: "uppercase" },

  // Footnote
  footNote: {
    color: "#9aa0ae",
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 22,
  },
});
