// app/screens/ClassementScreen.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import LogoutButton from "../../components/LogoutButton";
import { supabase } from "../../supabase";

const logoComets = require("../../assets/images/iconComets.png");

// Rang précédent / variation
function getPrevRank(team: any, tabIdx: number, classement: any) {
  if (!classement?.previous?.standings) return null;
  const prevTab = classement.previous.standings[tabIdx];
  if (!prevTab) return null;
  const prev = prevTab.find((t: any) => t.abbreviation === team.abbreviation);
  return prev ? prev.rank : null;
}
function getRankChangeSymbol(prev: number | null, current: number) {
  if (!prev || prev === current) return null;
  if (prev > current) return { symbol: "▲", color: "#10B981" };
  if (prev < current) return { symbol: "▼", color: "#EF4444" };
  return null;
}

export default function ClassementScreen() {
  const navigation = useNavigation();
  const [classement, setClassement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("classement_normandie")
          .select("data")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (error) setErrorMsg("Erreur de récupération Supabase : " + error.message);
        else if (!data) setErrorMsg("Aucun classement trouvé");
        else setClassement(data.data);
      } catch (e: any) {
        setErrorMsg("Gros crash côté JS : " + (e?.message || e));
      }
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18 }}>Chargement…</Text>
      </SafeAreaView>
    );
  if (errorMsg)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "tomato", textAlign: "center", paddingHorizontal: 24 }}>{errorMsg}</Text>
      </SafeAreaView>
    );
  if (!classement)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#9aa0ae" }}>Aucun classement trouvé</Text>
      </SafeAreaView>
    );

  const tabs: string[] = classement.tabs || [];
  const tables: any[][] = classement.standings || [];
  const currentRows = tables[activeTab] || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() =>
              // @ts-ignore
              (navigation as any).canGoBack()
                ? // @ts-ignore
                  (navigation as any).goBack()
                : // @ts-ignore
                  (navigation as any).navigate("Home")
            }
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Classement R1 Normandie</Text>
          <LogoutButton />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Saison {classement.year}</Text>
            <Text style={styles.heroSub}>Comets Honfleur — Standings officiels</Text>
          </View>
        </View>

        {/* Onglets */}
        <View style={styles.tabsRow}>
          {(tabs.length ? tabs : ["Classement"]).map((t: string, i: number) => {
            const active = i === activeTab;
            return (
              <TouchableOpacity
                key={`${t}-${i}`}
                onPress={() => {
                  setActiveTab(i);
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]} numberOfLines={1}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* TABLE ACTIVE – responsive (nom complet + chips) */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 220)}
          scrollEventThrottle={16}
        >
          <View style={styles.groupCard}>
            {currentRows.map((team: any, idx: number) => {
              const isComets =
                team.name?.toLowerCase().includes("honfleur") || team.abbreviation === "HON";
              const prevRank = getPrevRank(team, activeTab, classement);
              const rankChange = getRankChangeSymbol(prevRank, team.rank);

              return (
                <View
                  key={`${team.abbreviation}-${idx}`}
                  style={[
                    styles.teamCard,
                    isComets && styles.cometsRow,
                    idx === 0 && styles.firstRow,
                  ]}
                >
                  {/* Ligne 1 : Rang + Logo + Nom (wrap autorisé) */}
                  <View style={styles.rowTop}>
                    <View style={styles.rankBox}>
                      <Text
                        style={[
                          styles.rankText,
                          idx === 0 && styles.rankTextFirst,
                          isComets && styles.rankTextComets,
                        ]}
                      >
                        {idx === 0 ? "🥇" : team.rank}
                      </Text>
                      {!!rankChange && (
                        <Text style={{ fontSize: 12, marginTop: 1, color: rankChange.color, fontWeight: "900" }}>
                          {rankChange.symbol}
                        </Text>
                      )}
                    </View>

                    {!!team.logo && (
                      <Image
                        source={{ uri: team.logo }}
                        style={[styles.teamLogo, isComets && styles.teamLogoComets]}
                      />
                    )}

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.teamName,
                          isComets && styles.teamNameComets,
                          idx === 0 && styles.teamNameFirst,
                        ]}
                      >
                        {/* pas de numberOfLines → nom COMPLET, wrap ok */}
                        {team.name} <Text style={styles.abbr}>({team.abbreviation})</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Ligne 2 : Chips stats (wrap en multi-ligne si étroit) */}
                  <View style={styles.statsRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipLabel}>W</Text>
                      <Text style={styles.chipValue}>{team.W}</Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipLabel}>L</Text>
                      <Text style={styles.chipValue}>{team.L}</Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipLabel}>T</Text>
                      <Text style={styles.chipValue}>{team.T}</Text>
                    </View>
                    <View style={styles.chipWide}>
                      <Text style={styles.chipLabel}>PCT</Text>
                      <Text style={styles.chipValue}>{team.PCT}</Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipLabel}>GB</Text>
                      <Text style={styles.chipValue}>{team.GB}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtn}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.8}
          >
            <Icon name="chevron-up" size={30} color="#FF8200" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // HERO
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
  backBtn: {
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

  // Tabs
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: { backgroundColor: "#FF8200", borderColor: "#FF8200" },
  tabBtnText: { color: "#FF8200", fontWeight: "900", fontSize: 13.5, letterSpacing: 0.3 },
  tabBtnTextActive: { color: "#fff" },

  // Group wrapper (glass)
  groupCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 10,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },

  // Team card
  teamCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  firstRow: {
    borderColor: "rgba(255,130,0,0.45)",
    backgroundColor: "rgba(255,130,0,0.09)",
  },
  cometsRow: {
    borderColor: "#FF8200",
    backgroundColor: "rgba(255,130,0,0.13)",
    shadowColor: "#FF8200",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },

  // Row top
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  rankBox: { width: 40, alignItems: "center", justifyContent: "center" },
  rankText: { color: "#cfd3db", fontWeight: "900", fontSize: 16, letterSpacing: 0.6 },
  rankTextFirst: { color: "#f4b26a", fontSize: 18 },
  rankTextComets: { color: "#FF8200" },
  teamLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e6e8ee",
  },
  teamLogoComets: { borderColor: "#FF8200" },
  teamName: {
    color: "#eaeef7",
    fontWeight: "900",
    fontSize: 15,
    flexWrap: "wrap", // ← affiche tout le nom
  },
  teamNameFirst: { color: "#f4b26a" },
  teamNameComets: { color: "#FF8200" },
  abbr: { color: "#9aa0ae", fontWeight: "700", fontSize: 13 },

  // Stats chips
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,24,33,0.9)",
    borderWidth: 1,
    borderColor: "#252a38",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipWide: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,24,33,0.9)",
    borderWidth: 1,
    borderColor: "#252a38",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipLabel: { color: "#9aa0ae", fontWeight: "900", marginRight: 6, fontSize: 12.5, letterSpacing: 0.4 },
  chipValue: { color: "#eaeef7", fontWeight: "900", fontSize: 13.5 },

  // Scroll to top
  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 25,
    backgroundColor: "#101017EE",
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#FF8200",
  },
});
