"use client";

import { useNavigation } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { DrawerMenuButton } from "../../components/navigation/AppDrawer";
import { markArticleRead } from "../../lib/newsNotifyStore";

const logoComets = require("../../assets/images/iconComets.png");
const NEWS_API = "https://les-comets-honfleur.vercel.app/api/news";
const PAGE_SIZE = 20;

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  category?: string | null;
};

const CATEGORY_META = [
  { value: "12U", label: "12U", color: "#10B981" },
  { value: "15U", label: "15U", color: "#3B82F6" },
  { value: "Seniors", label: "Seniors", color: "#F59E0B" },
  { value: "Autres", label: "Autres", color: "#FF8200" },
] as const;

type CatValue = (typeof CATEGORY_META)[number]["value"];
type CategoryFilter = CatValue | "ALL";
type SeasonFilter = "ALL" | string;

function normalizeKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]/g, "")
    .toUpperCase();
}

function stripHtml(html: string) {
  return (html || "").replace(/(<([^>]+)>)/gi, "").replace(/&nbsp;/g, " ");
}

function excerpt(text: string, n = 180) {
  const t = stripHtml(text).trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
}

function withAlpha(hex: string, alpha = 0.35) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(255,130,0,${alpha})`;
  const int = parseInt(clean, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getSeasonYear(str: string) {
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return new Date().getFullYear();
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 8 ? y + 1 : y;
}

function getCatValue(article: Article): CatValue {
  const raw = (article.category || "").trim();
  if (raw) {
    const key = normalizeKey(raw);
    if (key === "12U") return "12U";
    if (key === "15U") return "15U";
    if (key === "SENIOR" || key === "SENIORS") return "Seniors";
    return "Autres";
  }

  const titleKey = normalizeKey(article.title || "");
  if (titleKey.startsWith("12U")) return "12U";
  if (titleKey.startsWith("15U")) return "15U";
  if (titleKey.startsWith("SENIOR") || titleKey.startsWith("SENIORS")) return "Seniors";
  return "Autres";
}

function catMetaOf(value: CatValue) {
  return CATEGORY_META.find((c) => c.value === value) || CATEGORY_META[CATEGORY_META.length - 1];
}

function catLabel(value: CategoryFilter) {
  if (value === "ALL") return "Toutes categories";
  return catMetaOf(value).label;
}

type FilterTabProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

const FilterTab = React.memo(function FilterTab({ label, active, onPress }: FilterTabProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

type ArticleCardProps = {
  article: Article;
  index: number;
  onOpen: (article: Article) => void;
};

const ArticleCard = React.memo(function ArticleCard({ article, index, onOpen }: ArticleCardProps) {
  const [isReady, setIsReady] = useState(!article.image_url);

  useEffect(() => {
    setIsReady(!article.image_url);
  }, [article.image_url]);

  const cat = getCatValue(article);
  const meta = catMetaOf(cat);
  const badgeBg = withAlpha(meta.color, 0.14);
  const badgeBorder = withAlpha(meta.color, 0.42);
  const cardBorder = withAlpha(meta.color, 0.3);

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      style={[styles.card, { borderColor: cardBorder }]}
      onPress={() => onOpen(article)}
    >
      <View style={styles.cardImageWrap}>
        {!!article.image_url ? (
          <>
            <ExpoImage
              source={{ uri: article.image_url, cacheKey: `news-${article.id}` }}
              recyclingKey={`news-${article.id}`}
              cachePolicy="memory-disk"
              priority={index < 5 ? "high" : "normal"}
              transition={140}
              contentFit="cover"
              style={styles.cardImage}
              onLoad={() => setIsReady(true)}
              onError={() => setIsReady(true)}
            />
            {!isReady && (
              <View style={styles.cardImageLoader}>
                <ActivityIndicator size="small" color="#FF9E3A" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Icon name="image-outline" size={20} color="#4B5563" />
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            <Text style={[styles.chipTxt, { color: meta.color }]}>{meta.label}</Text>
          </View>

          <View style={[styles.chip, styles.dateChip]}>
            <Icon name="time-outline" size={13} color="#CBD5E1" />
            <Text style={[styles.chipTxt, styles.dateChipTxt]}>{formatDate(article.created_at)}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{article.title}</Text>
        <Text style={styles.cardExcerpt}>{excerpt(article.content, 180)}</Text>

        <View style={styles.readRow}>
          <Text style={styles.readBtnTxt}>Lire l article</Text>
          <Icon name="chevron-forward" size={18} color="#111827" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function ActusScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Article>>(null);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState<SeasonFilter>("ALL");
  const [selectedCat, setSelectedCat] = useState<CategoryFilter>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    Asset.loadAsync([logoComets]).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const fetchNews = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const r = await fetch(NEWS_API, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const data = await r.json();
        if (!mounted) return;

        const sorted = Array.isArray(data)
          ? (data as any[])
              .map((x) => ({
                ...x,
                image_url: x.image_url ?? null,
                category: x.category ?? null,
              }))
              .sort(
                (a: Article, b: Article) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
          : [];
        setArticles(sorted);
      } catch (e: any) {
        if (!mounted || e?.name === "AbortError") return;
        setArticles([]);
        setErrorMsg("Impossible de charger les actualites.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchNews();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  const seasons = useMemo(() => {
    const set = new Set<number>(articles.map((a) => getSeasonYear(a.created_at)));
    const arr = Array.from(set).sort((a, b) => b - a);
    return arr.length ? arr : [getSeasonYear(new Date().toISOString())];
  }, [articles]);

  const seasonTabs = useMemo<SeasonFilter[]>(() => ["ALL", ...seasons.map(String)], [seasons]);

  useEffect(() => {
    const current = String(getSeasonYear(new Date().toISOString()));
    if (seasonTabs.includes(current)) {
      setSelectedSeason(current);
      return;
    }
    setSelectedSeason("ALL");
  }, [seasonTabs]);

  useEffect(() => {
    setPage(1);
    setSelectedCat("ALL");
  }, [selectedSeason]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const season = String(getSeasonYear(a.created_at));
      const category = getCatValue(a);
      const seasonOk = selectedSeason === "ALL" ? true : season === selectedSeason;
      const catOk = selectedCat === "ALL" ? true : category === selectedCat;
      return seasonOk && catOk;
    });
  }, [articles, selectedSeason, selectedCat]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page <= pageCount) return;
    setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * PAGE_SIZE;
  const pageRows = useMemo(() => filtered.slice(start, start + PAGE_SIZE), [filtered, start]);

  const prefetchUrls = useMemo(() => {
    return filtered
      .slice(start, start + PAGE_SIZE + 8)
      .map((a) => a.image_url)
      .filter((url): url is string => typeof url === "string" && url.length > 4);
  }, [filtered, start]);

  useEffect(() => {
    if (!prefetchUrls.length) return;
    ExpoImage.prefetch(prefetchUrls, "memory-disk").catch(() => {});
  }, [prefetchUrls]);

  const listBottomPadding = Math.max(120, insets.bottom + 104);
  const scrollTopBottom = Math.max(22, insets.bottom + 16);

  const onOpenArticle = useCallback(
    async (article: Article) => {
      await markArticleRead(article.id);
      (navigation as any).navigate("ActuDetail", { articleId: article.id });
    },
    [navigation]
  );

  const onScrollList = useCallback((offsetY: number) => {
    setShowScrollTop(offsetY > 300);
  }, []);

  const keyExtractor = useCallback((item: Article) => String(item.id), []);

  const renderItem = useCallback(
    ({ item, index }: { item: Article; index: number }) => (
      <ArticleCard article={item} index={index} onOpen={onOpenArticle} />
    ),
    [onOpenArticle]
  );

  const pagination =
    filtered.length > 0 && pageCount > 1 && !loading ? (
      <View style={styles.pagination}>
        <TouchableOpacity
          onPress={() => {
            setPage((p) => Math.max(1, p - 1));
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
          disabled={page === 1}
          style={[styles.pagBtn, page === 1 && styles.pagBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={styles.pagBtnTxt}>Precedent</Text>
        </TouchableOpacity>

        <Text style={styles.pagIndicator}>
          Page {page} / {pageCount}
        </Text>

        <TouchableOpacity
          onPress={() => {
            setPage((p) => Math.min(pageCount, p + 1));
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
          disabled={page === pageCount}
          style={[styles.pagBtn, page === pageCount && styles.pagBtnDisabled]}
          activeOpacity={0.85}
        >
          <Text style={styles.pagBtnTxt}>Suivant</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.loaderTxt}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            {
              paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10,
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroShine}
          />

          <View style={styles.heroTopRow}>
            <DrawerMenuButton style={styles.backBtn} />

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Actualites Comets</Text>
              <Text style={styles.heroSub}>
                {selectedSeason === "ALL" ? "Toutes saisons" : `Saison ${selectedSeason}`}
              </Text>
            </View>

            <View style={styles.heroPill}>
              <Icon name="newspaper-outline" size={13} color="#FFDDBA" />
              <Text style={styles.heroPillText}>{filtered.length}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <ExpoImage
              source={logoComets}
              cachePolicy="memory-disk"
              transition={100}
              contentFit="contain"
              style={styles.heroLogo}
            />

            <View style={styles.heroMetaContent}>
              <Text style={styles.heroMetaTitle}>Filtrage rapide</Text>
              <Text style={styles.heroMetaText}>
                {selectedSeason === "ALL" ? "Toutes saisons" : `Saison ${selectedSeason}`} |{" "}
                {catLabel(selectedCat)}
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {seasonTabs.map((season) => (
              <FilterTab
                key={season}
                label={season === "ALL" ? "Toutes saisons" : `Saison ${season}`}
                active={selectedSeason === season}
                onPress={() => {
                  setSelectedSeason(season);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterRow, styles.filterRowSecond]}
          >
            {(["ALL", ...CATEGORY_META.map((c) => c.value)] as CategoryFilter[]).map((category) => (
              <FilterTab
                key={category}
                label={catLabel(category)}
                active={selectedCat === category}
                onPress={() => {
                  setSelectedCat(category);
                  setPage(1);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
            ))}
          </ScrollView>
        </LinearGradient>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.loaderBox}>
          <Text style={styles.emptyTxt}>Aucun article a afficher pour ces filtres.</Text>
          {!!errorMsg && <Text style={styles.errorTxt}>{errorMsg}</Text>}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={pageRows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContainer, { paddingBottom: listBottomPadding }]}
          onScroll={(e) => onScrollList(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          ListFooterComponent={pagination}
          ListHeaderComponent={
            errorMsg ? (
              <View style={styles.warningCard}>
                <Icon name="alert-circle-outline" size={16} color="#F59E0B" />
                <Text style={styles.warningText}>{errorMsg}</Text>
              </View>
            ) : null
          }
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={8}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}

      {showScrollTop && (
        <View style={[styles.scrollTopWrap, { bottom: scrollTopBottom }]}>
          <TouchableOpacity
            style={styles.scrollTopBtn}
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.85}
          >
            <Icon name="chevron-up" size={26} color="#FF8200" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  heroWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "#0E1524",
  },
  heroGradient: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  heroShine: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: "56%",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
  },
  heroSub: {
    marginTop: 1,
    color: "#BEC8DB",
    fontSize: 12,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroPillText: {
    color: "#FFDDBA",
    fontWeight: "700",
    fontSize: 11,
  },
  heroMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FF9E3A",
  },
  heroMetaContent: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaTitle: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "800",
  },
  heroMetaText: {
    marginTop: 1,
    color: "#CBD2DF",
    fontSize: 11.5,
  },

  filterRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
    paddingRight: 2,
  },
  filterRowSecond: {
    marginTop: 6,
  },
  tabBtn: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "#FF8200",
    borderColor: "#FFB366",
  },
  tabBtnText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 12,
  },
  tabBtnTextActive: {
    color: "#111827",
    fontWeight: "800",
  },

  loaderBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  loaderTxt: {
    color: "#FF8200",
    marginTop: 14,
    fontWeight: "800",
    fontSize: 16,
  },
  emptyTxt: {
    color: "#9AA6BD",
    fontSize: 15,
    textAlign: "center",
  },
  errorTxt: {
    marginTop: 8,
    color: "#FCA5A5",
    fontSize: 12.5,
    textAlign: "center",
  },

  listContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  warningCard: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 12.5,
    lineHeight: 18,
  },

  card: {
    backgroundColor: "#151C29",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImageWrap: {
    width: "100%",
    height: 168,
    backgroundColor: "#101623",
    position: "relative",
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardImageLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,14,20,0.5)",
  },
  cardImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101623",
  },
  cardBody: {
    padding: 13,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipTxt: {
    fontWeight: "800",
    fontSize: 12,
  },
  dateChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "#2B3141",
  },
  dateChipTxt: {
    color: "#CBD5E1",
  },
  cardTitle: {
    color: "#EAEEF7",
    fontWeight: "900",
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 6,
  },
  cardExcerpt: {
    color: "#CFD3DB",
    fontSize: 14,
    lineHeight: 20,
  },
  readRow: {
    marginTop: 11,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF8200",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFAA58",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  readBtnTxt: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13,
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  pagBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFAA58",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pagBtnDisabled: {
    opacity: 0.5,
  },
  pagBtnTxt: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 13.5,
  },
  pagIndicator: {
    color: "#FF8200",
    fontWeight: "800",
    fontSize: 13.5,
  },

  scrollTopWrap: {
    position: "absolute",
    right: 16,
    zIndex: 50,
  },
  scrollTopBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(16,16,23,0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FF8200",
  },
});
