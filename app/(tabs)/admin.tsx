import { router } from "expo-router";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";

const logoComets = require("../../assets/images/iconComets.png");

const adminLinks = [
  { label: "Messages reçus", icon: "✉️", route: "/messages" },
  { label: "Galerie", icon: "🖼️", route: "/AdminGalleryScreen" },
  { label: "Matchs à venir", icon: "🗓️", route: "/matchs-admin" },
  { label: "Actualités", icon: "📰", route: "/actus-admin" },
  { label: "Membres", icon: "👥", route: "/membres-admin" },
];

export default function AdminMenuScreen() {
  const { isAdmin } = useAdmin();
  const insets = useSafeAreaInsets();

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: "#18181C", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold" }}>
          Accès réservé aux admins !
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#18181C" }}
      contentContainerStyle={{
        alignItems: "center",
        paddingVertical: 20,
        paddingTop: insets.top + 16, // Padding dynamique au top
      }}
    >
      <Image source={logoComets} style={styles.logo} resizeMode="contain" />

      {/* Header titre + flèche */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={27} color="#FF8200" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Panel d'administration</Text>
        </View>
        <View style={{ width: 29 }} />
      </View>

      <View style={styles.linksWrap}>
        {adminLinks.map(({ label, icon, route }) => (
          <TouchableOpacity
            key={label}
            style={styles.adminLink}
            onPress={() => router.push(route)}
            activeOpacity={0.87}
          >
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.label}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "98%",
    marginBottom: 24,
    marginTop: 8,
  },
  backBtn: {
    padding: 4,
    borderRadius: 18,
    backgroundColor: "#FFF7EE",
    borderWidth: 1.2,
    borderColor: "#FF8200",
    marginRight: 7,
    elevation: 2,
    shadowColor: "#FF8200",
    shadowOpacity: 0.07,
    shadowRadius: 5,
  },
  title: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 22,
    letterSpacing: 1,
    textAlign: "center",
  },
  linksWrap: {
    width: "98%",
    maxWidth: 410,
    gap: 14,
  },
  adminLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff7ee",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderWidth: 1.4,
    borderColor: "#FF8200",
    marginBottom: 4,
    shadowColor: "#FF8200",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    fontSize: 25,
    marginRight: 14,
  },
  label: {
    color: "#18181C",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
