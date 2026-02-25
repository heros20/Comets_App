"use client";

import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

const logoComets = require("../../assets/images/iconComets.png");

type AdminHeroProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
  statusLabel?: string;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
};

export function AdminHero({
  title,
  subtitle,
  onBack,
  statusLabel = "Admin",
  rightSlot,
  children,
}: AdminHeroProps) {
  return (
    <LinearGradient
      colors={["#1A2030", "#121620", "#0F1014"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.hero,
        { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10 },
      ]}
    >
      <View style={styles.glowCircle} pointerEvents="none" />

      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.9}
        >
          <Icon name="chevron-back" size={22} color="#FF8200" />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {rightSlot ?? <View style={styles.rightPlaceholder} />}
      </View>

      <View style={styles.profileRow}>
        <Image source={logoComets} style={styles.logo} resizeMode="contain" />
        <View style={styles.textWrap}>
          <Text style={styles.brand}>Espace administration</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTxt}>{statusLabel}</Text>
        </View>
      </View>

      {children ? <View style={styles.bottomSlot}>{children}</View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.24)",
    overflow: "hidden",
  },
  glowCircle: {
    position: "absolute",
    right: -34,
    top: -34,
    width: 170,
    height: 170,
    borderRadius: 90,
    backgroundColor: "rgba(255,130,0,0.16)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A3344",
  },
  title: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  rightPlaceholder: {
    width: 34,
    height: 34,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  textWrap: {
    flex: 1,
  },
  brand: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 2,
    color: "#B7BFCE",
    fontSize: 12.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "#2A3344",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusTxt: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 11.5,
  },
  bottomSlot: {
    marginTop: 12,
  },
});
