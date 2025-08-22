// app/screens/AdminMenuScreen.tsx
"use client";

import { router } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";

const logoComets = require("../../assets/images/iconComets.png");

type AdminLink = { label: string; icon: string; route: string };

// 📨 Messagerie seule
const adminLinksMessaging: AdminLink[] = [
  { label: "Messages reçus", icon: "mail-unread-outline", route: "/messages" },
];

// ⚾ Gestion des matchs
const adminLinksMatchs: AdminLink[] = [
  { label: "Inscriptions aux matchs", icon: "list-outline", route: "/MatchsAdminScreen" },
  { label: "Matchs à venir", icon: "calendar-outline", route: "/matchs-admin" },
];

// 📰 Contenus & médias
const adminLinksContent: AdminLink[] = [
  { label: "Actualités", icon: "newspaper-outline", route: "/actus-admin" },
  { label: "Galerie", icon: "images-outline", route: "/AdminGalleryScreen" },
];

// 👥 Membres
const adminLinksMembers: AdminLink[] = [
  { label: "Jeunes (12U/15U)", icon: "school-outline", route: "/(admin)/youngPlayers" },
  { label: "Membres", icon: "people-outline", route: "/membres-admin" },
];

export default function AdminMenuScreen() {
  const { isAdmin } = useAdmin();

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f1014", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold", textAlign: "center", paddingHorizontal: 24 }}>
          Accès réservé aux admins !
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.9}
          style={{ marginTop: 14, backgroundColor: "#FF8200", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 12 : 22 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtnHero}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.9}
          >
            <Icon name="chevron-back" size={26} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Panel d’administration</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <View style={styles.heroAvatar}>
            <Icon name="shield-checkmark-outline" size={26} color="#FF8200" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Espace Admin</Text>
            <Text style={styles.heroEmail}>Gestion du club • Outils & contenus</Text>
            <View style={styles.heroChips}>
              <View style={[styles.chip, { backgroundColor: "#FFD7A1" }]}>
                <Text style={styles.chipTxt}>🔐 Rôle : Admin</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: "#D1F3FF" }]}>
                <Text style={[styles.chipTxt, { color: "#0C7499" }]}>⚙️ Actions rapides</Text>
              </View>
            </View>
          </View>

          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
        </View>
      </View>

      {/* CONTENU */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Intro card */}
        <View style={styles.cardIntro}>
          <Text style={styles.introTxt}>
            Bienvenue dans le centre de contrôle des Comets. Publie une actu, gère les matchs, la
            galerie et les membres — tout en un clin d’œil.
          </Text>
        </View>

        {/* Messagerie */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Messagerie</Text>
        <View style={styles.linksWrap}>
          {adminLinksMessaging.map(({ label, icon, route }) => (
            <AdminLinkItem key={label} label={label} icon={icon} route={route} />
          ))}
        </View>

        {/* Matchs */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Matchs</Text>
        <View style={styles.linksWrap}>
          {adminLinksMatchs.map(({ label, icon, route }) => (
            <AdminLinkItem key={label} label={label} icon={icon} route={route} />
          ))}
        </View>

        {/* Contenus & médias */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Contenus & Médias</Text>
        <View style={styles.linksWrap}>
          {adminLinksContent.map(({ label, icon, route }) => (
            <AdminLinkItem key={label} label={label} icon={icon} route={route} />
          ))}
        </View>

        {/* Membres */}
        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Membres</Text>
        <View style={styles.linksWrap}>
          {adminLinksMembers.map(({ label, icon, route }) => (
            <AdminLinkItem key={label} label={label} icon={icon} route={route} />
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// 🔹 Factorisation d’un lien Admin
function AdminLinkItem({ label, icon, route }: AdminLink) {
  return (
    <TouchableOpacity
      style={styles.adminLink}
      onPress={() => router.push(route)}
      activeOpacity={0.92}
    >
      <View style={styles.iconWrap}>
        <Icon name={icon as any} size={20} color="#FF8200" />
      </View>
      <Text style={styles.linkLabel} numberOfLines={1}>{label}</Text>
      <Icon name="chevron-forward" size={18} color="#cfd3db" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // === HERO (aligné sur Profil/Actus/Galerie) ===
  hero: {
    backgroundColor: "#11131a",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
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
    paddingTop: Platform.OS === "ios" ? 10 : 6,
  },
  backBtnHero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1b1e27",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a2f3d",
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
    paddingTop: 12,
    gap: 14,
  },
  heroAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#18181C",
    borderWidth: 3,
    borderColor: "#FF8200",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  heroEmail: { color: "#c7cad1", fontSize: 13 },
  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  chipTxt: { fontWeight: "800", fontSize: 12.5 },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
  },

  // === BODY ===
  body: { padding: 14, paddingBottom: 28, backgroundColor: "#0f1014" },

  // Intro card
  cardIntro: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },
  introTxt: { color: "#cfd3db", fontSize: 14.5, lineHeight: 20, textAlign: "center" },

  // Titres de sections
  sectionTitle: {
    color: "#FF8200",
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 14,
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Liens
  linksWrap: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 15,
    gap: 10,
  },
  adminLink: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#141821",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#252a38",
  },
  linkLabel: { color: "#eaeef7", fontWeight: "800", fontSize: 15.5, letterSpacing: 0.3, flex: 1 },
});
