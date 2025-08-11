// app/screens/ActusScreen.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const logoComets = require("../../assets/images/iconComets.png");

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
};

const TEAM_CATEGORIES = ["12U", "15U", "Seniors"] as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}
function stripHtml(html: string) {
  return (html || "").replace(/(<([^>]+)>)/gi, "").replace(/&nbsp;/g, " ");
}
function excerpt(text: string, n = 200) {
  const t = stripHtml(text).trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}
function getYear(str: string) {
  const y = new Date(str).getFullYear();
  return Number.isFinite(y) ? y : new Date().getFullYear();
}
function getTeamCat(title: string): string {
  const norm = (title || "").trim().toUpperCase();
  for (const cat of TEAM_CATEGORIES) {
    if (norm.startsWith(cat.toUpperCase())) return cat;
  }
  return "Autres";
}

export default function ActusScreen() {
  const navigation = useNavigation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Scroll to top
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Filtres
  const [selectedSeason, setSelectedSeason] = useState<string>("ALL");
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://les-comets-honfleur.vercel.app/api/news");
        const data = await r.json();
        const sorted = Array.isArray(data)
          ? data.sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          : [];
        setArticles(sorted);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Années & onglets
  const years = useMemo(() => {
    const coll = Array.from(new Set(articles.map((a) => getYear(a.created_at)))).sort((a, b) => b - a);
    return coll.length ? coll : [new Date().getFullYear()];
  }, [articles]);
  const seasonTabs = useMemo(() => ["ALL", ...years.map(String)], [years]);
  const categories = useMemo(() => ["ALL", ...TEAM_CATEGORIES, "Autres"], []);

  useEffect(() => {
    setPage(1);
    setSelectedCat("ALL");
  }, [selectedSeason]);

  const catLabel = (cat: string) => (cat === "ALL" ? "Toutes les catégories" : cat);

  // Filtrage
  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const cat = getTeamCat(a.title);
      const y = String(getYear(a.created_at));
      const seasonOk = selectedSeason === "ALL" ? true : y === selectedSeason;
      const catOk = selectedCat === "ALL" ? true : cat === selectedCat;
      return seasonOk && catOk;
    });
  }, [articles, selectedSeason, selectedCat]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const start = (page - 1) * PAGE_SIZE;
  const end = page * PAGE_SIZE;

  // Scroll handler
  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > 300 && !showScrollTop) {
      setShowScrollTop(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else if (y <= 300 && showScrollTop) {
      setShowScrollTop(false);
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const FilterTab = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

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

        {/* Ligne top : back + titre */}
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

          <Text style={styles.heroTitle}>Actualités des Comets</Text>

          {/* espace symétrique */}
          <View style={{ width: 36 }} />
        </View>

        {/* Logo + sous-titres */}
        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Toute l’actu du club</Text>
            <Text style={styles.heroSub}>Saisons, catégories — filtre en un clin d’œil</Text>
          </View>
        </View>

        {/* Onglets Saisons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsRow, { paddingRight: 12 }]}
        >
          {seasonTabs.map((s) => (
            <FilterTab
              key={s}
              label={s === "ALL" ? "Toutes les saisons" : `Saison ${s}`}
              active={selectedSeason === s}
              onPress={() => setSelectedSeason(s)}
            />
          ))}
        </ScrollView>

        {/* Onglets Catégories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsRow, { paddingTop: 8, paddingRight: 12 }]}
        >
          {categories.map((c) => (
            <FilterTab key={c} label={catLabel(c)} active={selectedCat === c} onPress={() => setSelectedCat(c)} />
          ))}
        </ScrollView>
      </View>

      {/* CONTENU */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.loaderTxt}>Chargement…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.loaderBox}>
          <Text style={styles.emptyTxt}>Aucun article à afficher (pour l’instant…)</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContainer}
        >
          {filtered.slice(start, end).map((a) => (
            <TouchableOpacity
              key={a.id}
              activeOpacity={0.94}
              style={styles.card}
              // @ts-ignore
              onPress={() => (navigation as any).navigate("ActuDetail", { articleId: a.id })}
            >
              {a.image_url ? (
                <Image source={{ uri: a.image_url }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: "#141821" }]} />
              )}

              <View style={styles.cardBody}>
                <View style={styles.chipsRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipTxt}>{getTeamCat(a.title)}</Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "#2b3141" }]}>
                    <Icon name="time-outline" size={13} color="#cfd3db" />
                    <Text style={[styles.chipTxt, { color: "#cfd3db" }]}>{formatDate(a.created_at)}</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardExcerpt}>{excerpt(a.content, 180)}</Text>

                <View style={styles.readRow}>
                  <Text style={styles.readBtnTxt}>Lire l’article</Text>
                  <Icon name="chevron-forward" size={18} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Pagination */}
          {pageCount > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pagBtn, page === 1 && styles.pagBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={styles.pagBtnTxt}>Précédent</Text>
              </TouchableOpacity>
              <Text style={styles.pagIndicator}>
                Page {page} / {pageCount}
              </Text>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                style={[styles.pagBtn, page === pageCount && styles.pagBtnDisabled]}
                activeOpacity={0.85}
              >
                <Text style={styles.pagBtnTxt}>Suivant</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Scroll-to-top */}
      <Animated.View pointerEvents={showScrollTop ? "auto" : "none"} style={[styles.scrollTopWrap, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.scrollTopBtn} onPress={scrollToTop} activeOpacity={0.85}>
          <Icon name="chevron-up" size={26} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // HERO
  hero: {
    backgroundColor: "#11131a",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
    paddingBottom: 10,
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

  // Tabs (recyclés style Comets)
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  tabBtn: {
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: { backgroundColor: "#FF8200", borderColor: "#FF8200" },
  tabBtnText: { color: "#FF8200", fontWeight: "900", fontSize: 13.5, letterSpacing: 0.3 },
  tabBtnTextActive: { color: "#fff" },

  // Loader / Empty
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", marginTop: 14, fontWeight: "bold", fontSize: 16 },
  emptyTxt: { color: "#9aa0ae", fontSize: 15, textAlign: "center" },

  // List
  listContainer: { paddingHorizontal: 12, paddingBottom: 38 },

  // Card (glass)
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  cardImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#141821",
  },
  cardBody: { padding: 14 },
  chipsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,130,0,0.12)",
    borderColor: "rgba(255,130,0,0.35)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipTxt: { color: "#FF8200", fontWeight: "900", fontSize: 12.5 },

  cardTitle: {
    color: "#eaeef7",
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardExcerpt: { color: "#cfd3db", fontSize: 14.5, lineHeight: 20 },

  readRow: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  // Pagination
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  pagBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pagBtnDisabled: { opacity: 0.5 },
  pagBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14 },
  pagIndicator: { color: "#FF8200", fontWeight: "900", fontSize: 14 },

  // Scroll to top
  scrollTopWrap: {
    position: "absolute",
    right: 18,
    bottom: 25,
    zIndex: 50,
  },
  scrollTopBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF8200",
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
