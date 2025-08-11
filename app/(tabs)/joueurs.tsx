// app/screens/JoueursScreen.tsx
"use client";

import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import LogoutButton from "../../components/LogoutButton";
import { supabase } from "../../supabase";

const logoComets = require("../../assets/images/iconComets.png");

type Admin = {
  id: number;
  first_name: string;
  last_name: string;
  age: number | null;
  categorie: string | null;
  email: string | null;
};
type Player = {
  id: number;
  last_name: string;
  first_name: string;
  number: number;
  yob: number | null;
  player_link: string | null;
  team_abbr: string | null;
};

const CATEGORIES = ["Senior", "15U", "12U"] as const;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function JoueursScreen() {
  const navigation = useNavigation();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCat, setSelectedCat] = useState<(typeof CATEGORIES)[number]>("Senior");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFilter, setShowFilter] = useState(false); // <<< nouveau : pliable
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data: adminsData, error: errorAdmins } = await supabase
          .from("admins")
          .select("id, first_name, last_name, age, categorie, email");
        const { data: playersData, error: errorPlayers } = await supabase
          .from("players")
          .select("id, last_name, first_name, number, yob, player_link, team_abbr");

        if (errorAdmins) {
          setErrorMsg("Erreur Supabase Admins : " + errorAdmins.message);
        } else if (errorPlayers) {
          setErrorMsg("Erreur Supabase Players : " + errorPlayers.message);
        } else {
          setAdmins((adminsData || []) as Admin[]);
          setPlayers((playersData || []) as Player[]);
        }
      } catch (e: any) {
        setErrorMsg("Gros crash côté JS : " + (e?.message || e));
      }
      setLoading(false);
    };

    fetchAll();
  }, []);

  // Data de base (catégorie)
  const allData = useMemo(() => {
    if (selectedCat === "Senior") {
      return [...players]
        .sort(
          (a, b) =>
            a.last_name.localeCompare(b.last_name) ||
            a.first_name.localeCompare(b.first_name)
        )
        .map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          year: p.yob || "--",
          link: p.player_link || "",
          number: p.number,
          team: p.team_abbr || "",
        }));
    }
    // 15U / 12U — depuis admins
    return admins
      .filter(
        (a) =>
          a.categorie &&
          a.categorie.toUpperCase() === selectedCat.toUpperCase()
      )
      .sort(
        (a, b) =>
          (a.last_name || "").localeCompare(b.last_name || "") ||
          (a.first_name || "").localeCompare(b.first_name || "")
      )
      .map((a) => ({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        year: a.age ? new Date().getFullYear() - a.age : "--",
        link: "",
        number: undefined as number | undefined,
        team: "",
      }));
  }, [admins, players, selectedCat]);

  // Filtre texte + alphabet
  const dataToShow = useMemo(() => {
    const q = query.trim().toUpperCase();
    let base = allData;
    if (q) {
      base = base.filter(
        (it) =>
          (it.first_name || "").toUpperCase().includes(q) ||
          (it.last_name || "").toUpperCase().includes(q)
      );
    }
    if (activeLetter) {
      base = base.filter(
        (it) =>
          (it.last_name || "").toUpperCase().startsWith(activeLetter) ||
          (it.first_name || "").toUpperCase().startsWith(activeLetter)
      );
    }
    return base;
  }, [allData, query, activeLetter]);

  // Compteurs pour onglets
  const counts = useMemo(() => {
    const senior = players.length;
    const u15 = admins.filter((a) => (a.categorie || "").toUpperCase() === "15U").length;
    const u12 = admins.filter((a) => (a.categorie || "").toUpperCase() === "12U").length;
    return { Senior: senior, "15U": u15, "12U": u12 } as Record<(typeof CATEGORIES)[number], number>;
  }, [players, admins]);

  // UI
  const CategoryTab = ({ cat, icon }: { cat: (typeof CATEGORIES)[number]; icon: string }) => {
    const active = selectedCat === cat;
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedCat(cat);
          setActiveLetter(null);
          setQuery("");
          setShowFilter(false); // on replie le filtre si on change d'onglet
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }}
        style={[styles.tabBtn, active && styles.tabBtnActive]}
        activeOpacity={0.9}
      >
        <Text style={[styles.tabIcon, active && { color: "#fff" }]}>{icon}</Text>
        <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
          {cat} · {counts[cat] ?? 0}
        </Text>
      </TouchableOpacity>
    );
  };

  const Card = ({
    first_name,
    last_name,
    year,
    link,
    number,
    team,
  }: {
    first_name: string;
    last_name: string;
    year: number | string;
    link: string;
    number?: number;
    team?: string;
  }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(first_name?.[0] || "").toUpperCase()}
            {(last_name?.[0] || "").toUpperCase()}
          </Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">
            {first_name} {last_name}
          </Text>
          <View style={styles.metaRow}>
            {typeof number === "number" ? (
              <View style={[styles.metaPill, { backgroundColor: "#FFD7A1" }]}>
                <Text style={[styles.metaTxt, { color: "#7C2D12" }]}>#{number}</Text>
              </View>
            ) : null}
            {team ? (
              <View style={[styles.metaPill, { backgroundColor: "#D1F3FF" }]}>
                <Text style={[styles.metaTxt, { color: "#0C7499" }]}>{team}</Text>
              </View>
            ) : null}
            <View style={[styles.metaPill, { backgroundColor: "#FFE66D" }]}>
              <Text style={[styles.metaTxt, { color: "#8a6a08" }]}>{year}</Text>
            </View>
          </View>
        </View>
      </View>

      {!!link && (
        <TouchableOpacity
          onPress={() => Linking.openURL(link)}
          style={styles.ffbsBtn}
          activeOpacity={0.88}
        >
          <Text style={styles.ffbsBtnText}>Fiche FFBS</Text>
          <Icon name="open-outline" size={17} color="#fff" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HÉRO */}
      <View style={styles.hero}>
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
            style={styles.backBtnHero}
          >
            <Icon name="chevron-back" size={26} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Les Comets — Effectif</Text>
          <LogoutButton />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Joueurs 2025</Text>
            <Text style={styles.heroSub}>Roster & jeunes catégories</Text>
          </View>
        </View>

        {/* Onglets catégories */}
        <View style={styles.tabs}>
          <CategoryTab cat="Senior" icon="⚾️" />
          <CategoryTab cat="15U" icon="🧢" />
          <CategoryTab cat="12U" icon="⭐️" />
        </View>

        {/* Recherche */}
        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color="#FF8200" />
          <TextInput
            value={query}
            onChangeText={(t) => setQuery(t)}
            placeholder="Rechercher un joueur…"
            placeholderTextColor="#a6acb8"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              style={styles.clearBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="close" size={18} color="#a6acb8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtrer (A‑Z) — pliable */}
        <View style={{ marginHorizontal: 14, marginTop: 8, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => setShowFilter((s) => !s)}
            activeOpacity={0.85}
            style={styles.filterHeader}
          >
            <Text style={styles.filterTitle}>Filtrer</Text>
            <Icon
              name={showFilter ? "chevron-up" : "chevron-down"}
              size={18}
              color="#FF8200"
            />
          </TouchableOpacity>

          {showFilter && (
            <View style={styles.alphaRow}>
              <TouchableOpacity
                style={[styles.alphaBtn, !activeLetter && styles.alphaBtnActive]}
                onPress={() => {
                  setActiveLetter(null);
                  setShowFilter(false); // se replie après choix
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.alphaBtnText,
                    !activeLetter && styles.alphaBtnTextActive,
                  ]}
                >
                  TOUT
                </Text>
              </TouchableOpacity>
              {ALPHABET.map((letter) => (
                <TouchableOpacity
                  key={letter}
                  style={[
                    styles.alphaBtn,
                    activeLetter === letter && styles.alphaBtnActive,
                  ]}
                  onPress={() => {
                    setActiveLetter(letter);
                    setShowFilter(false); // se replie après choix
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.alphaBtnText,
                      activeLetter === letter && styles.alphaBtnTextActive,
                    ]}
                  >
                    {letter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* LISTE */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loaderBox}>
            <Text style={styles.loaderTxt}>Chargement…</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.loaderBox}>
            <Text style={styles.errorTxt}>{errorMsg}</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={dataToShow}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 14, paddingBottom: 36 }}
              ListEmptyComponent={
                <Text style={styles.emptyTxt}>
                  Aucun joueur à afficher dans cette catégorie.
                </Text>
              }
              renderItem={({ item }) => (
                <Card
                  first_name={item.first_name}
                  last_name={item.last_name}
                  year={item.year}
                  link={item.link}
                  number={item.number}
                  team={item.team}
                />
              )}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                setShowScrollTop(y > 240);
              }}
              scrollEventThrottle={16}
            />

            {showScrollTop && (
              <TouchableOpacity
                style={styles.scrollTopBtn}
                onPress={() =>
                  flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
                }
                activeOpacity={0.75}
              >
                <Icon name="chevron-up" size={30} color="#FF8200" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // HÉRO
  hero: {
    backgroundColor: "#11131a",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
    paddingTop:
      Platform.OS === "android"
        ? (StatusBar.currentHeight || 0) + 12 // espace dynamique Android
        : 22, // petit espace iOS
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
    paddingTop: 4, // ↓ avant c'était 10 sur iOS, 6 sur Android
    gap: 10,
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

  // Onglets catégories
  tabs: {
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
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabIcon: { color: "#FF8200", fontSize: 14 },
  tabBtnText: {
    color: "#FF8200",
    fontWeight: "900",
    fontSize: 13.5,
    letterSpacing: 0.3,
  },
  tabBtnActive: { backgroundColor: "#FF8200", borderColor: "#FF8200" },
  tabBtnTextActive: { color: "#fff" },

  // Recherche
  searchWrap: {
    marginTop: 10,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontWeight: "700",
    fontSize: 14.5,
  },
  clearBtn: {
    padding: 2,
    borderRadius: 12,
    backgroundColor: "transparent",
  },

  // Filtrer (header)
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterTitle: {
    color: "#FF8200",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },

  // Alphabet
  alphaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingTop: 10,
  },
  alphaBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff6ee",
    borderWidth: 1.3,
    borderColor: "#FF8200",
    minWidth: 28,
    alignItems: "center",
    marginBottom: 4,
  },
  alphaBtnActive: { backgroundColor: "#FF8200" },
  alphaBtnText: { color: "#FF8200", fontWeight: "900", fontSize: 13.5 },
  alphaBtnTextActive: { color: "#fff" },

  // Liste & états
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", fontWeight: "bold", fontSize: 18 },
  errorTxt: { color: "tomato", fontSize: 15, textAlign: "center", paddingHorizontal: 20 },
  emptyTxt: { color: "#9aa0ae", fontSize: 15, textAlign: "center", marginTop: 40 },

  // Cartes
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181C",
    borderWidth: 2,
    borderColor: "#FF8200",
    marginRight: 12,
    shadowColor: "#FF8200",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: { color: "#FF8200", fontWeight: "900", fontSize: 22, letterSpacing: 1 },
  infoCol: { flex: 1, minWidth: 0 },
  nameText: {
    color: "#fff",
    fontSize: 16.5,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  metaPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  metaTxt: { fontWeight: "800", fontSize: 12 },

  // Bouton FFBS
  ffbsBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8200",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#FF8200",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
    maxWidth: "100%",
  },
  ffbsBtnText: { color: "#fff", fontWeight: "900", fontSize: 13.5, flexShrink: 1 },

  // Scroll-to-top
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
