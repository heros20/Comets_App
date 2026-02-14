// app/screens/ActusScreen.tsx
"use client";

import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { markArticleRead } from "../lib/newsNotifyStore"; // garde

const logoComets = require("../../assets/images/iconComets.png");

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  category?: string | null; // ⇦ NOUVEAU : catégorie depuis la DB
};

/** Doit matcher l’admin */
const CATEGORY_META = [
  { value: "", label: "Autres", color: "#FF8200" },
  { value: "12U", label: "12U", color: "#10b981" },
  { value: "15U", label: "15U", color: "#3b82f6" },
  { value: "Séniors", label: "Séniors", color: "#f59e0b" },
] as const;

type CatValue = (typeof CATEGORY_META)[number]["value"] | "Autres";

const PAGE_SIZE = 20;

/** Helpers */
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

/** Saison = année suivante dès septembre. */
function getSeasonYear(str: string) {
  const d = new Date(str);
  if (isNaN(d.getTime())) return new Date().getFullYear();
  const y = d.getFullYear();
  const m = d.getMonth(); // 0..11 ; 8 = septembre
  return m >= 8 ? y + 1 : y;
}

/** Normalise une catégorie “valeur” (DB) à partir de l’article */
function getCatValue(a: Article): CatValue {
  // 1) Si DB fournit la catégorie, on la normalise
  const raw = (a.category ?? "").trim();
  if (raw) {
    // tolère "Seniors" sans accent en DB
    if (/^s(e|é)niors$/i.test(raw)) return "Séniors";
    if (/^12u$/i.test(raw)) return "12U";
    if (/^15u$/i.test(raw)) return "15U";
    // autre string custom => "Autres"
    const known = CATEGORY_META.some(c => c.value.toLowerCase() === raw.toLowerCase());
    return known ? (CATEGORY_META.find(c => c.value.toLowerCase() === raw.toLowerCase())!.value) : "Autres";
  }

  // 2) Fallback: inférer via le titre (compat anciens articles)
  const norm = (a.title || "").trim().toUpperCase();
  if (norm.startsWith("12U")) return "12U";
  if (norm.startsWith("15U")) return "15U";
  if (norm.startsWith("SENIORS") || norm.startsWith("SÉNIORS")) return "Séniors";

  // 3) Sans info explicite → valeur vide (Autres)
  return "";
}

function catMetaOf(value: CatValue) {
  return CATEGORY_META.find(c => c.value === value);
}

export default function ActusScreen() {
  const navigation = useNavigation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [selectedSeason, setSelectedSeason] = useState<string>("ALL");
  const [selectedCat, setSelectedCat] = useState<CatValue | "ALL">("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://les-comets-honfleur.vercel.app/api/news");
        const data = await r.json();
        const sorted = Array.isArray(data)
          ? data
              .map((x: any) => ({
                ...x,
                // sécurité typage
                image_url: x.image_url ?? null,
                category: x.category ?? null,
              }))
              .sort(
                (a: Article, b: Article) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
          : [];
        setArticles(sorted);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Saisons d’après les articles
  const seasons = useMemo(() => {
    const set = new Set<number>(articles.map((a) => getSeasonYear(a.created_at)));
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [getSeasonYear(new Date().toISOString())];
  }, [articles]);

  const seasonTabs = useMemo(() => ["ALL", ...seasons.map(String)], [seasons]);

  // Catégories = ALL + (valeurs admin) + Autres (si besoin)
  const hasAutres = useMemo(() => {
    return articles.some((a) => getCatValue(a) === "Autres");
  }, [articles]);

  const categoryTabs: (CatValue | "ALL")[] = useMemo(() => {
    const base: (CatValue | "ALL")[] = ["ALL", ...CATEGORY_META.map((c) => c.value)];
    return hasAutres ? [...base, "Autres"] : base;
  }, [hasAutres]);

  // Onglet saison par défaut = saison courante
  useEffect(() => {
    setSelectedSeason(String(getSeasonYear(new Date().toISOString())));
  }, []);

  // Reset pagination et catégorie quand on change de saison
  useEffect(() => {
    setPage(1);
    setSelectedCat("ALL");
  }, [selectedSeason]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const catVal = getCatValue(a); // "", "12U", "15U", "Séniors", "Autres"
      const s = String(getSeasonYear(a.created_at));
      const seasonOk = selectedSeason === "ALL" ? true : s === selectedSeason;
      const catOk =
        selectedCat === "ALL"
          ? true
          : catVal === selectedCat;
      return seasonOk && catOk;
    });
  }, [articles, selectedSeason, selectedCat]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const start = (page - 1) * PAGE_SIZE;
  const end = page * PAGE_SIZE;

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

  const catLabel = (v: CatValue | "ALL") => {
    if (v === "ALL") return "Toutes les catégories";
    if (v === "Autres") return "Autres";
    return CATEGORY_META.find((c) => c.value === v)?.label ?? "Autres";
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

        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() =>
              (navigation as any).canGoBack()
                ? (navigation as any).goBack()
                : (navigation as any).navigate("Home")
            }
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Actualités des Comets</Text>

          <View style={{ width: 36 }} />
        </View>

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
          {categoryTabs.map((c) => (
            <FilterTab
              key={String(c)}
              label={catLabel(c)}
              active={selectedCat === c}
              onPress={() => setSelectedCat(c)}
            />
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
          {filtered.slice(start, end).map((a) => {
            const cv = getCatValue(a); // valeur
            const meta = catMetaOf(cv);
            const badgeBg =
              meta ? `${meta.color}22` : "rgba(255,255,255,0.06)";
            const badgeBorder = meta?.color ?? "#2b3141";
            const badgeText = meta?.color ?? "#cfd3db";

            return (
              <TouchableOpacity
                key={a.id}
                activeOpacity={0.94}
                style={styles.card}
                onPress={async () => {
                  await markArticleRead(a.id); // optimiste
                  (navigation as any).navigate("ActuDetail", { articleId: a.id });
                }}
              >
                {a.image_url ? (
                  <Image source={{ uri: a.image_url }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, { backgroundColor: "#141821" }]} />
                )}

                <View style={styles.cardBody}>
                  <View style={styles.chipsRow}>
                    {/* Catégorie (colorée) */}
                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor: badgeBg,
                          borderColor: badgeBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.chipTxt, { color: badgeText }]}>
                        {meta?.label ?? "Autres"}
                      </Text>
                    </View>

                    {/* Date */}
                    <View
                      style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "#2b3141" }]}
                    >
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
            );
          })}

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

      <Animated.View
        pointerEvents={showScrollTop ? "auto" : "none"}
        style={[styles.scrollTopWrap, { opacity: fadeAnim }]}
      >
        <TouchableOpacity style={styles.scrollTopBtn} onPress={scrollToTop} activeOpacity={0.85}>
          <Icon name="chevron-up" size={26} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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

  tabsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10 },
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

  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", marginTop: 14, fontWeight: "bold", fontSize: 16 },
  emptyTxt: { color: "#9aa0ae", fontSize: 15, textAlign: "center" },

  listContainer: { paddingHorizontal: 12, paddingBottom: 38 },

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

  cardTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 18, lineHeight: 22, marginBottom: 6 },
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

  scrollTopWrap: { position: "absolute", right: 18, bottom: 25, zIndex: 50 },
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
