import React, { useEffect, useRef, useState } from "react";
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

// Mets à jour le chemin selon ton arbo !
const logoComets = require("../../assets/images/iconComets.png");

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
};

const TEAM_CATEGORIES = ["12U", "15U", "Seniors"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function excerpt(text: string, n = 200) {
  return text.length > n ? text.slice(0, n) + "…" : text;
}

function getYear(str: string) {
  return new Date(str).getFullYear();
}

function getTeamCat(title: string) {
  const norm = title.trim().toUpperCase();
  for (const cat of TEAM_CATEGORIES) {
    if (norm.startsWith(cat.toUpperCase())) return cat;
  }
  return "Autres";
}

export default function ActusScreen() {
  const navigation = useNavigation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Scroll to top logic
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current; // For fade-in/out button

  // Filtres
  const [selectedSeason, setSelectedSeason] = useState<string>("ALL");
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetch("https://les-comets-honfleur.vercel.app/api/news")
      .then((r) => r.json())
      .then((data) => {
        setArticles(
          Array.isArray(data)
            ? data.sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
            : []
        );
      })
      .finally(() => setLoading(false));
  }, []);

  // Gère la pagination & années
  const allYears = Array.from(
    new Set(articles.map((a) => getYear(a.created_at)))
  ).sort((a, b) => b - a);
  const thisYear = new Date().getFullYear();
  const years = allYears.length ? allYears : [thisYear];
  const seasonTabs = ["ALL", ...years.map(String)];
  const categories = ["ALL", ...TEAM_CATEGORIES];

  useEffect(() => {
    setPage(1);
    setSelectedCat("ALL");
  }, [selectedSeason]);

  const catLabel = (cat: string) =>
    cat === "ALL" ? "Toutes les catégories" : cat;

  // Filtrage des articles
  const articlesToShow = articles.filter((a) => {
    const cat = getTeamCat(a.title);
    const yearStr = String(getYear(a.created_at));
    if (selectedSeason === "ALL") {
      if (selectedCat === "ALL") return true;
      return cat === selectedCat;
    }
    if (selectedCat === "ALL") return yearStr === selectedSeason;
    return yearStr === selectedSeason && cat === selectedCat;
  });

  const pageCount = Math.ceil(articlesToShow.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const end = page * PAGE_SIZE;

  // Scroll handler for scroll to top btn
  const handleScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > 300 && !showScrollTop) {
      setShowScrollTop(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (y <= 300 && showScrollTop) {
      setShowScrollTop(false);
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER LOGO + TITRE + RETOUR */}
      <View style={styles.headerRow}>
        {/* Bouton retour */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={30} color="#FF8200" />
        </TouchableOpacity>

        {/* Logo + titres */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <View style={styles.logoWrap}>
            <Image
              source={logoComets}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Actualités des Comets</Text>
          <Text style={styles.subTitle}>
            Toute l’actualité du club, filtrée en un clin d’œil !
          </Text>
        </View>
        {/* (Un View vide pour occuper la même largeur que le bouton retour, centrer le titre) */}
        <View style={{ width: 38 }} />
      </View>

      {/* FILTRES : saisons + catégories */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRowWrap}>
          {seasonTabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterBtn,
                selectedSeason === tab && styles.filterBtnActive,
              ]}
              onPress={() => setSelectedSeason(tab)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  selectedSeason === tab && styles.filterBtnTextActive,
                ]}
              >
                {tab === "ALL" ? "Toutes les saisons" : `Saison ${tab}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.filterRowWrap, { marginTop: 6 }]}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterBtn,
                selectedCat === cat && styles.filterBtnActive,
              ]}
              onPress={() => setSelectedCat(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  selectedCat === cat && styles.filterBtnTextActive,
                ]}
              >
                {catLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* LISTE DES ARTICLES */}
      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#FF8200" />
          <Text
            style={{
              color: "#FF8200",
              marginTop: 18,
              fontWeight: "bold",
            }}
          >
            Chargement…
          </Text>
        </View>
      ) : articlesToShow.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text
            style={{
              color: "#FF8200",
              fontWeight: "bold",
              fontSize: 17,
            }}
          >
            Aucun article à afficher (pour l’instant…)
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.articlesList}
        >
          {articlesToShow.slice(start, end).map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              activeOpacity={0.94}
              onPress={() =>
                navigation.navigate("ActuDetail", { articleId: a.id })
              }
            >
              {a.image_url && (
                <Image source={{ uri: a.image_url }} style={styles.cardImage} />
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardCat}>{getTeamCat(a.title)}</Text>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardDate}>{formatDate(a.created_at)}</Text>
                <Text style={styles.cardExcerpt}>
                  {excerpt(a.content, 160)}
                </Text>
                <View style={styles.readBtnWrap}>
                  <Text style={styles.readBtn}>Lire l’article</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* PAGINATION */}
          {pageCount > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[
                  styles.pagBtn,
                  page === 1 && styles.pagBtnDisabled,
                ]}
              >
                <Text style={styles.pagBtnTxt}>Précédent</Text>
              </TouchableOpacity>
              <Text style={styles.pagIndicator}>
                Page {page} / {pageCount}
              </Text>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                style={[
                  styles.pagBtn,
                  page === pageCount && styles.pagBtnDisabled,
                ]}
              >
                <Text style={styles.pagBtnTxt}>Suivant</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* SCROLL TO TOP BUTTON */}
      <Animated.View
        pointerEvents={showScrollTop ? "auto" : "none"}
        style={[
          styles.scrollTopBtnWrap,
          { opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={styles.scrollTopBtn}
          onPress={scrollToTop}
          activeOpacity={0.8}
        >
          <Text style={styles.scrollTopBtnTxt}> ↑ </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181C",
    paddingTop: Platform.OS === "ios" ? 20 : 0,
  },
  header: {
    alignItems: "center",
    paddingTop: 44,
    paddingBottom: 20,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 34,
    paddingBottom: 8,
    backgroundColor: "transparent",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  backBtn: {
    padding: 4,
    paddingRight: 2,
    marginLeft: 2,
    zIndex: 2,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logo: {
    width: 75,
    height: 75,
    borderRadius: 18,
    borderWidth: 2.1,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 29,
    fontWeight: "bold",
    color: "#FF8200",
    letterSpacing: 1,
    textAlign: "center",
    textShadowColor: "#FFE3B7",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFD197",
    letterSpacing: 0.7,
    textAlign: "center",
    marginBottom: 8,
  },
  filtersContainer: {
    paddingHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  filterRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 46,
    marginBottom: 0,
    rowGap: 7,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#18181C",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FF8200",
    marginRight: 0,
    marginBottom: 0,
    minWidth: 50,
    marginTop: 5,
  },
  filterBtnActive: {
    backgroundColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 2,
  },
  filterBtnText: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 15,
  },
  filterBtnTextActive: {
    color: "#fff",
  },
  articlesList: {
    paddingHorizontal: 10,
    paddingBottom: 35,
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFD197",
    shadowColor: "#FF8200",
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 4,
    width: "100%",
    maxWidth: 420,
  },
  cardImage: {
    width: "100%",
    height: 150,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#FFF4E6",
  },
  cardContent: {
    padding: 15,
    paddingTop: 10,
    gap: 2,
  },
  cardCat: {
    fontSize: 13,
    color: "#FF8200",
    fontWeight: "bold",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#191410",
    marginBottom: 1,
    lineHeight: 24,
  },
  cardDate: {
    fontSize: 13,
    color: "#B06E18",
    fontWeight: "600",
    marginBottom: 5,
  },
  cardExcerpt: {
    color: "#1A2636",
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  readBtnWrap: {
    marginTop: 6,
    alignItems: "flex-start",
  },
  readBtn: {
    backgroundColor: "#FF8200",
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 13,
    fontWeight: "bold",
    fontSize: 15,
    overflow: "hidden",
    shadowColor: "#FF8200",
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 2,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    gap: 12,
  },
  pagBtn: {
    backgroundColor: "#FFD197",
    borderRadius: 14,
    paddingHorizontal: 17,
    paddingVertical: 9,
    minWidth: 80,
    alignItems: "center",
  },
  pagBtnDisabled: {
    opacity: 0.5,
  },
  pagBtnTxt: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 15,
  },
  pagIndicator: {
    fontWeight: "bold",
    color: "#FF8200",
    fontSize: 15,
  },
  // -------- Scroll to top ---------
  scrollTopBtnWrap: {
    position: "absolute",
    bottom: 30,
    right: 20,
    zIndex: 99,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 8,
  },
  scrollTopBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollTopBtnTxt: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 1,
  },
});
