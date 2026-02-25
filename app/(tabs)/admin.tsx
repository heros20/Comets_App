// app/screens/AdminMenuScreen.tsx
"use client";

import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminHero } from "../../components/admin/AdminHero";
import { useAdmin } from "../../contexts/AdminContext";

type AdminRoute = Parameters<typeof router.push>[0];
type Domain = "Operations" | "Contenu" | "Membres" | "Finance";

type AdminModule = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: AdminRoute;
  tone: string;
  domain: Domain;
};

const MODULES: AdminModule[] = [
  {
    id: "messages",
    title: "Messages",
    subtitle: "Boîte de réception",
    icon: "mail-unread-outline",
    route: "/messages",
    tone: "#FF8200",
    domain: "Operations",
  },
  {
    id: "matchs-participants",
    title: "Participations",
    subtitle: "Inscriptions par match",
    icon: "list-outline",
    route: "/MatchsAdminScreen",
    tone: "#3B82F6",
    domain: "Operations",
  },
  {
    id: "matchs-planning",
    title: "Planning matchs",
    subtitle: "Créer et éditer",
    icon: "calendar-outline",
    route: "/matchs-admin",
    tone: "#10B981",
    domain: "Operations",
  },
  {
    id: "actus",
    title: "Actualités",
    subtitle: "Articles + push",
    icon: "newspaper-outline",
    route: "/actus-admin",
    tone: "#F97316",
    domain: "Contenu",
  },
  {
    id: "gallery",
    title: "Galerie",
    subtitle: "Ajout et suppression",
    icon: "images-outline",
    route: "/AdminGalleryScreen",
    tone: "#6366F1",
    domain: "Contenu",
  },
  {
    id: "young",
    title: "Jeunes 12U / 15U",
    subtitle: "Gestion des profils",
    icon: "school-outline",
    route: "/(admin)/youngPlayers",
    tone: "#06B6D4",
    domain: "Membres",
  },
  {
    id: "members",
    title: "Membres du club",
    subtitle: "Comptes et suppression",
    icon: "people-outline",
    route: "/membres-admin",
    tone: "#F59E0B",
    domain: "Membres",
  },
  {
    id: "cotisations",
    title: "Cotisations",
    subtitle: "Paiements et suivi",
    icon: "card-outline",
    route: "/(admin)/cotisation",
    tone: "#22C55E",
    domain: "Finance",
  },
];

const DOMAIN_META: Record<Domain, { title: string; hint: string }> = {
  Operations: {
    title: "Opérations",
    hint: "Matchs et flux quotidien",
  },
  Contenu: {
    title: "Contenu",
    hint: "Site, actualités et médias",
  },
  Membres: {
    title: "Membres",
    hint: "Comptes et catégories",
  },
  Finance: {
    title: "Finance",
    hint: "Cotisations et suivi",
  },
};

const DOMAIN_ORDER: Domain[] = ["Operations", "Contenu", "Membres", "Finance"];

function ModuleTile({ item, width }: { item: AdminModule; width: number }) {
  return (
    <TouchableOpacity
      style={[styles.moduleTile, { width, borderColor: `${item.tone}44` }]}
      onPress={() => router.push(item.route)}
      activeOpacity={0.9}
    >
      <View style={[styles.moduleIcon, { backgroundColor: `${item.tone}20` }]}>
        <Icon name={item.icon as any} size={18} color={item.tone} />
      </View>

      <View style={styles.moduleTextWrap}>
        <Text style={styles.moduleTitle}>{item.title}</Text>
        <Text style={styles.moduleSub}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminMenuScreen() {
  const { isAdmin } = useAdmin();
  const { width } = useWindowDimensions();

  const stats = useMemo(
    () => [
      { id: "tools", label: "Outils", value: String(MODULES.length), icon: "grid-outline", tone: "#FF8200" },
      {
        id: "ops",
        label: "Opérations",
        value: String(MODULES.filter((m) => m.domain === "Operations").length),
        icon: "flash-outline",
        tone: "#3B82F6",
      },
      {
        id: "content",
        label: "Contenu",
        value: String(MODULES.filter((m) => m.domain === "Contenu").length),
        icon: "albums-outline",
        tone: "#10B981",
      },
    ],
    []
  );

  const twoCols = width >= 390;
  const tileWidth = twoCols ? (width - 44) / 2 : width - 32;

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.lockWrap}>
          <View style={styles.lockIconWrap}>
            <Icon name="shield-outline" size={24} color="#FF8200" />
          </View>
          <Text style={styles.lockTitle}>Accès réservé aux admins</Text>
          <Text style={styles.lockSub}>Connecte-toi avec un compte admin pour ouvrir cet espace.</Text>
          <TouchableOpacity style={styles.lockBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Text style={styles.lockBtnTxt}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AdminHero
          title="Panel administration"
          subtitle="Contrôle central de tous les modules"
          onBack={() => router.back()}
          rightSlot={
            <View style={styles.heroTag}>
              <Text style={styles.heroTagTxt}>{MODULES.length} outils</Text>
            </View>
          }
        />

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vue globale</Text>
            <Text style={styles.sectionHint}>Résumé rapide des modules</Text>
          </View>

          <View style={styles.statsRow}>
            {stats.map((s, idx) => {
              const statWidth = twoCols ? (width - 44) / 3 : width - 32;
              return (
                <View
                  key={s.id}
                  style={[
                    styles.statCard,
                    {
                      width: statWidth,
                      borderColor: `${s.tone}55`,
                      marginRight: twoCols && idx < stats.length - 1 ? 6 : 0,
                    },
                  ]}
                >
                  <View style={[styles.statIcon, { backgroundColor: `${s.tone}22` }]}>
                    <Icon name={s.icon as any} size={16} color={s.tone} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {DOMAIN_ORDER.map((domain) => {
          const domainModules = MODULES.filter((m) => m.domain === domain);
          const meta = DOMAIN_META[domain];

          return (
            <View key={domain} style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{meta.title}</Text>
                <Text style={styles.sectionHint}>{meta.hint}</Text>
              </View>

              <View style={styles.moduleGrid}>
                {domainModules.map((item, idx) => (
                  <View
                    key={item.id}
                    style={{
                      marginBottom: 12,
                      marginRight: twoCols && idx % 2 === 0 ? 12 : 0,
                    }}
                  >
                    <ModuleTile item={item} width={tileWidth} />
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0F1014",
  },
  scrollContent: {
    paddingBottom: 30,
  },

  heroTag: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "#2A3344",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  heroTagTxt: {
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "800",
  },

  sectionBlock: {
    marginTop: 18,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#F3F4F6",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  sectionHint: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 12.5,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
  },
  statCard: {
    backgroundColor: "#151925",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    color: "#AAB2C2",
    fontSize: 11.5,
    fontWeight: "700",
  },

  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  moduleTile: {
    backgroundColor: "#141822",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  moduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleTextWrap: {
    flex: 1,
  },
  moduleTitle: {
    color: "#F3F4F6",
    fontSize: 13.5,
    fontWeight: "800",
  },
  moduleSub: {
    marginTop: 2,
    color: "#98A1B2",
    fontSize: 11.5,
  },

  lockWrap: {
    flex: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,130,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockTitle: {
    marginTop: 14,
    color: "#F3F4F6",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  lockSub: {
    marginTop: 6,
    color: "#AAB2C2",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  lockBtn: {
    marginTop: 16,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lockBtnTxt: {
    color: "#0F1014",
    fontWeight: "900",
    fontSize: 14,
  },
});
