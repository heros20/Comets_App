"use client";

import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  InteractionManager,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { DrawerMenuButton } from "../components/navigation/AppDrawer";
import { fetchRecentCometsRunResults, type CometsRunResult } from "../lib/cometsRun";
import { useAdmin } from "../contexts/AdminContext";
import { formatDateFr } from "../lib/date";
import { sortGalleryNewest } from "../lib/gallerySort";
import { resultColor, resultLabel } from "../lib/match";
import { supabase } from "../supabase";

const logoComets = require("../assets/images/iconComets.png");
const API_BASE = "https://les-comets-honfleur.vercel.app";
const BATCH = 6;
const INITIAL_RENDER_COUNT = 4;
const MAX_BATCH_RENDER = 4;
const WINDOW_SIZE = 5;

const TEAM_NAMES: Record<string, string> = {
  HON: "Honfleur",
  LHA: "Le Havre",
  ROU: "Rouen",
  CAE: "Caen",
  CHE: "Cherbourg",
  WAL: "Louviers",
  AND: "Les Andelys",
};

type FilterKey = "all" | "news" | "match" | "gallery" | "cometsRun";
type NewsItem = { id: number | string; title: string; content: string; image_url?: string | null; created_at?: string | null };
type GalleryItem = { id?: number | string; url: string; legend?: string | null; created_at?: string | null };
type PlannedMatch = { id: number | string; date: string; opponent: string; is_home: boolean; categorie?: string | null; note?: string | null };
type PlayedGame = { id: number; date: string; is_home: boolean; opponent_abbr: string; team_score: number | null; opponent_score: number | null; result: string; note?: string | null };
type FeedItem =
  | { key: string; kind: "news"; item: NewsItem }
  | { key: string; kind: "gallery"; item: GalleryItem }
  | { key: string; kind: "cometsrun"; item: CometsRunResult }
  | { key: string; kind: "match"; mode: "upcoming" | "played"; item: PlannedMatch | PlayedGame };

const FILTERS: { key: FilterKey; label: string; icon: string; tone: string }[] = [
  { key: "all", label: "Tout", icon: "sparkles-outline", tone: "#FF8200" },
  { key: "news", label: "News", icon: "newspaper-outline", tone: "#3B82F6" },
  { key: "match", label: "Matchs", icon: "baseball-outline", tone: "#10B981" },
  { key: "gallery", label: "Photos", icon: "images-outline", tone: "#8B5CF6" },
  { key: "cometsRun", label: "Comets Run", icon: "game-controller-outline", tone: "#22D3EE" },
];

function parseDateValue(input?: string | null): Date | null {
  if (!input) return null;
  const fr = input.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/);
  if (fr) {
    const parsed = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ts(input?: string | null) {
  return parseDateValue(input)?.getTime() ?? 0;
}

function formatMatchDate(input?: string | null) {
  const parsed = parseDateValue(input);
  if (!parsed) return input || "Date à confirmer";
  return parsed.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long" });
}

function stripHtml(text = "") {
  return text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function excerpt(text: string, max = 150) {
  const clean = stripHtml(text);
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function formatRunMoment(input?: string | null) {
  const parsed = parseDateValue(input);
  if (!parsed) return "Run recent";
  return `${formatDateFr(parsed)} · ${parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatScoreValue(value: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.floor(value)));
}

function formatRelativeSyncLabel(lastSyncAt: number | null, now: number) {
  if (!lastSyncAt) return "Chargement";

  const diffMs = Math.max(0, now - lastSyncAt);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 1) return "Mis a jour a l'instant";
  if (diffMinutes < 60) return `Mis a jour il y a ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Mis a jour il y a ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Mis a jour il y a ${diffDays} j`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function mix<T>(pools: Record<string, T[]>, pattern: string[]) {
  const work = Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, [...v]])) as Record<string, T[]>;
  const output: T[] = [];
  while (Object.values(work).some((rows) => rows.length)) {
    let advanced = false;
    for (const key of pattern) {
      const next = work[key]?.shift();
      if (!next) continue;
      output.push(next);
      advanced = true;
    }
    if (!advanced) break;
  }
  return output;
}

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const { isAdmin, isMember } = useAdmin();
  const statusLabel = isAdmin ? "Admin" : isMember ? "Membre" : "Visiteur";

  const [news, setNews] = useState<NewsItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [planned, setPlanned] = useState<PlannedMatch[]>([]);
  const [games, setGames] = useState<PlayedGame[]>([]);
  const [cometsRunResults, setCometsRunResults] = useState<CometsRunResult[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [relativeNow, setRelativeNow] = useState(() => Date.now());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef<FlatList<FeedItem>>(null);
  const showScrollTopRef = useRef(false);
  const scrollTopAnim = useRef(new Animated.Value(0)).current;
  const scrollTopPressAnim = useRef(new Animated.Value(0)).current;

  const loadFeed = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    const [newsResult, galleryResult, matchesResult, gamesResult, cometsRunResult] = await Promise.allSettled([
      fetchJson<NewsItem[]>("/api/news"),
      fetchJson<GalleryItem[]>("/api/gallery"),
      supabase.from("matches_planned").select("id, date, opponent, is_home, categorie, note"),
      supabase.from("games").select("id, date, is_home, opponent_abbr, team_score, opponent_score, result, note"),
      fetchRecentCometsRunResults(8),
    ]);

    setNews(newsResult.status === "fulfilled" && Array.isArray(newsResult.value) ? [...newsResult.value].sort((a, b) => ts(b.created_at) - ts(a.created_at)) : []);
    setGallery(galleryResult.status === "fulfilled" && Array.isArray(galleryResult.value) ? sortGalleryNewest(galleryResult.value) : []);
    setPlanned(matchesResult.status === "fulfilled" && Array.isArray(matchesResult.value.data) ? (matchesResult.value.data as PlannedMatch[]) : []);
    const nextGames = gamesResult.status === "fulfilled" && Array.isArray(gamesResult.value.data)
      ? [...(gamesResult.value.data as PlayedGame[])].sort((a, b) => ts(b.date) - ts(a.date))
      : [];
    setGames(nextGames);
    setCometsRunResults(cometsRunResult.status === "fulfilled" && Array.isArray(cometsRunResult.value) ? cometsRunResult.value : []);
    setErrorMsg([newsResult, galleryResult, matchesResult, gamesResult].some((x) => x.status === "rejected") ? "Une partie du feed n'a pas pu être chargée." : null);
    setErrorMsg([newsResult, galleryResult, matchesResult, gamesResult, cometsRunResult].some((x) => x.status === "rejected") ? "Une partie du feed n'a pas pu être chargée." : null);
    setLastSyncAt(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadFeed("initial").catch(() => {
        setLoading(false);
        setRefreshing(false);
        setErrorMsg("Impossible de charger le feed.");
      });
    });

    return () => task.cancel();
  }, [loadFeed]);

  useEffect(() => {
    const id = setInterval(() => {
      setRelativeNow(Date.now());
    }, 60000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.timing(scrollTopAnim, {
      toValue: showScrollTop ? 1 : 0,
      duration: showScrollTop ? 180 : 120,
      useNativeDriver: true,
    }).start();
  }, [scrollTopAnim, showScrollTop]);

  const lastSyncLabel = useMemo(() => formatRelativeSyncLabel(lastSyncAt, relativeNow), [lastSyncAt, relativeNow]);
  const scrollTopAnimatedStyle = useMemo(() => {
    const revealScale = scrollTopAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
    const pressScale = scrollTopPressAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });

    return {
      opacity: scrollTopAnim,
      transform: [
        { translateY: scrollTopAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        { scale: Animated.multiply(revealScale, pressScale) },
      ],
    };
  }, [scrollTopAnim, scrollTopPressAnim]);

  const upcomingMatches = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...planned]
      .map((item) => ({ ...item, parsedDate: parseDateValue(item.date) }))
      .filter((item) => !!item.parsedDate && item.parsedDate >= today)
      .sort((a, b) => (a.parsedDate?.getTime() ?? 0) - (b.parsedDate?.getTime() ?? 0))
      .slice(0, 10)
      .map(({ parsedDate, ...item }) => item);
  }, [planned]);

  const matchFeed = useMemo<FeedItem[]>(() => {
    const upcoming: FeedItem[] = upcomingMatches.map((item) => ({
      key: `upcoming-${item.id}`,
      kind: "match",
      mode: "upcoming",
      item,
    }));
    const recentGames: FeedItem[] = games.slice(0, 10).map((item) => ({
      key: `played-${item.id}`,
      kind: "match",
      mode: "played",
      item,
    }));
    return mix({ upcoming, recentGames }, ["upcoming", "recentGames", "upcoming"]);
  }, [games, upcomingMatches]);

  const newsFeed = useMemo<FeedItem[]>(() => news.map((item) => ({ key: `news-${item.id}`, kind: "news", item })), [news]);
  const galleryFeed = useMemo<FeedItem[]>(() => gallery.map((item) => ({ key: `gallery-${String(item.id ?? item.url)}`, kind: "gallery", item })), [gallery]);
  const cometsRunFeed = useMemo<FeedItem[]>(
    () => cometsRunResults.map((item) => ({ key: `comets-run-${item.id}`, kind: "cometsrun", item })),
    [cometsRunResults],
  );
  const mixedFeed = useMemo(
    () =>
      mix(
        { news: newsFeed, match: matchFeed, gallery: galleryFeed, cometsRun: cometsRunFeed },
        ["news", "match", "gallery", "news", "cometsRun", "gallery", "match"],
      ),
    [cometsRunFeed, galleryFeed, matchFeed, newsFeed],
  );
  const feed = useMemo(
    () =>
      filter === "news"
        ? newsFeed
        : filter === "match"
          ? matchFeed
          : filter === "gallery"
            ? galleryFeed
            : filter === "cometsRun"
              ? cometsRunFeed
              : mixedFeed,
    [cometsRunFeed, filter, galleryFeed, matchFeed, mixedFeed, newsFeed],
  );

  useEffect(() => {
    setVisibleCount(feed.length ? Math.min(BATCH, feed.length) : 0);
  }, [feed]);

  const visibleFeed = useMemo(() => feed.slice(0, visibleCount), [feed, visibleCount]);
  const hasMore = visibleFeed.length < feed.length;

  const onLoadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setVisibleCount((prev) => Math.min(prev + BATCH, feed.length));
  }, [feed.length, hasMore, loading]);

  const onRefresh = useCallback(() => {
    void loadFeed("refresh");
  }, [loadFeed]);

  const onSelectFilter = useCallback((key: FilterKey) => {
    startTransition(() => {
      setFilter(key);
    });
  }, []);

  const keyExtractor = useCallback((item: FeedItem) => item.key, []);
  const onScroll = useCallback((event: any) => {
    const next = event.nativeEvent.contentOffset.y > 260;
    if (showScrollTopRef.current === next) return;
    showScrollTopRef.current = next;
    setShowScrollTop(next);
  }, []);
  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  const onScrollTopPressIn = useCallback(() => {
    Animated.spring(scrollTopPressAnim, {
      toValue: 1,
      speed: 28,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [scrollTopPressAnim]);
  const onScrollTopPressOut = useCallback(() => {
    Animated.spring(scrollTopPressAnim, {
      toValue: 0,
      speed: 24,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [scrollTopPressAnim]);

  const sectionShortcut =
    filter === "cometsRun"
      ? { label: "Classement jeu", route: "/CometsLeaderboardScreen" }
      : { label: "Calendrier", route: "/matchs" };
  const statusPillTone = isAdmin ? styles.statusPillAdmin : isMember ? styles.statusPillMember : styles.statusPillVisitor;
  const statusDotTone = isAdmin ? styles.statusDotAdmin : isMember ? styles.statusDotMember : styles.statusDotVisitor;
  const scrollTopBottom = Math.max(24, insets.bottom + 12);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={visibleFeed}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.35}
        initialNumToRender={INITIAL_RENDER_COUNT}
        maxToRenderPerBatch={MAX_BATCH_RENDER}
        windowSize={WINDOW_SIZE}
        updateCellsBatchingPeriod={45}
        removeClippedSubviews={Platform.OS === "android"}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            <LinearGradient colors={["#18263B", "#101A2A", "#0B101A"]} style={styles.hero}>
              <View style={styles.topRow}>
                <View style={styles.brand}>
                  <DrawerMenuButton style={styles.menuBtn} />
                  <ExpoImage source={logoComets} style={styles.logo} contentFit="cover" cachePolicy="memory-disk" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.brandTitle}>Comets d&apos;Honfleur</Text>
                  </View>
                </View>
                <View style={[styles.statusPill, statusPillTone]}>
                  <View style={[styles.statusDot, statusDotTone]} />
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              </View>

              <Text style={styles.heroTag}>Nouveautés</Text>
              <Text style={styles.heroTitle}>Tu lances l&apos;app, tu scrolles, tu vois ce qui a bougé.</Text>
              <Text style={styles.heroText}>Les nouveautés du club, en direct.</Text>

            </LinearGradient>

            <View style={styles.sectionRow}>
              <View>
                <Text style={styles.sectionTitle}>Fil des nouveautés</Text>
                <Text style={styles.sectionHintHuman}>{lastSyncLabel}</Text>
              </View>
              <TouchableOpacity style={styles.sectionLink} onPress={() => router.push(sectionShortcut.route as any)} activeOpacity={0.9}>
                <Text style={styles.sectionLinkText}>{sectionShortcut.label}</Text>
                <Icon name="arrow-forward" size={12} color="#E9C7A4" />
              </TouchableOpacity>
            </View>

            <View style={styles.filters}>
              {FILTERS.map((item) => {
                const active = filter === item.key;
                return (
                  <TouchableOpacity key={item.key} style={[styles.filterChip, active && { borderColor: `${item.tone}88`, backgroundColor: `${item.tone}22` }]} onPress={() => onSelectFilter(item.key)} activeOpacity={0.9}>
                    <Icon name={item.icon as any} size={14} color={active ? item.tone : "#B8C1CF"} />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === "news") {
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.94} onPress={() => router.push(`/ActuDetail?articleId=${encodeURIComponent(String(item.item.id))}` as any)}>
                {!!item.item.image_url && <ExpoImage source={{ uri: item.item.image_url, cacheKey: `news-${item.item.id}` }} recyclingKey={`news-${item.item.id}`} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" transition={120} />}
                <View style={styles.cardBody}>
                  <Text style={styles.meta}>ACTU · {item.item.created_at ? formatDateFr(item.item.created_at) : "Publication"}</Text>
                  <Text style={styles.cardTitle}>{item.item.title}</Text>
                  <Text style={styles.cardText}>{excerpt(item.item.content)}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          if (item.kind === "gallery") {
            const photoId = item.item.id != null ? String(item.item.id) : "";
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.94} onPress={() => router.push(photoId ? (`/GalleryScreen?photoId=${encodeURIComponent(photoId)}` as any) : ("/GalleryScreen" as any))}>
                <ExpoImage source={{ uri: item.item.url, cacheKey: `gallery-${photoId || item.item.url}` }} recyclingKey={`gallery-${photoId || item.item.url}`} style={styles.galleryImage} contentFit="cover" cachePolicy="memory-disk" transition={120} />
                <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.78)"]} style={styles.galleryOverlay} />
                <View style={styles.galleryContent}>
                  <Text style={styles.meta}>PHOTO · {item.item.created_at ? formatDateFr(item.item.created_at) : "Galerie"}</Text>
                  <Text style={styles.cardTitle}>{item.item.legend || "Nouveau moment dans la galerie"}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          if (item.kind === "cometsrun") {
            return (
              <TouchableOpacity
                style={[styles.card, styles.runCard]}
                activeOpacity={0.94}
                onPress={() => router.push("/CometsLeaderboardScreen" as any)}
              >
                <LinearGradient colors={["#17253D", "#0F1729", "#09111C"]} style={styles.runCardGradient}>
                  <View style={styles.runTopRow}>
                    <View style={styles.runBadge}>
                      <Icon name="game-controller-outline" size={14} color="#67E8F9" />
                      <Text style={styles.runBadgeText}>COMETS RUN</Text>
                    </View>
                    <Text style={styles.runDate}>{formatRunMoment(item.item.created_at)}</Text>
                  </View>

                  <View style={styles.runHeroRow}>
                    <View style={styles.runOrb}>
                      <ExpoImage source={logoComets} style={styles.runLogoSmall} contentFit="cover" cachePolicy="memory-disk" />
                    </View>

                    <View style={styles.runCopy}>
                      <Text style={styles.runEyebrow}>Dernier score enregistré</Text>
                      <Text style={styles.runPlayer}>{item.item.player_name}</Text>
                      <Text style={styles.runSupport}>Le mode arcade du club continue de tourner.</Text>
                    </View>

                    <View style={styles.runScoreBox}>
                      <Text style={styles.runScoreLabel}>Score</Text>
                      <Text style={styles.runScoreValue}>{formatScoreValue(item.item.score)}</Text>
                    </View>
                  </View>

                  <View style={styles.runFooterRow}>
                    <Text style={styles.runFooterText}>Voir le classement Comets Run</Text>
                    <Icon name="arrow-forward" size={15} color="#FFD5AF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          const isUpcoming = item.mode === "upcoming";
          const match = item.item as PlannedMatch & PlayedGame;
          const opponent = isUpcoming ? match.opponent : TEAM_NAMES[match.opponent_abbr] || match.opponent_abbr;
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.94} onPress={() => router.push((isUpcoming ? `/match-detail?kind=upcoming&matchId=${encodeURIComponent(String(match.id))}` : `/match-detail?kind=played&matchId=${encodeURIComponent(String(match.id))}`) as any)}>
              <View style={styles.cardBody}>
                <Text style={styles.meta}>{isUpcoming ? "À VENIR" : "RÉSULTAT"} · {formatMatchDate(match.date)}</Text>
                <Text style={styles.cardTitle}>Comets vs {opponent}</Text>
                <Text style={styles.cardText}>
                  {isUpcoming
                    ? `${match.is_home ? "Domicile" : "Extérieur"}${match.categorie ? ` · ${match.categorie}` : ""}`
                    : `${match.team_score ?? "-"} - ${match.opponent_score ?? "-"} · ${resultLabel(match.result)}`}
                </Text>
                {!isUpcoming && <View style={[styles.resultPill, { backgroundColor: resultColor(match.result) }]}><Text style={styles.resultText}>{resultLabel(match.result)}</Text></View>}
                {!!match.note && <Text style={styles.note}>{match.note}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{loading ? "Chargement du feed..." : "Aucun contenu pour ce filtre."}</Text></View>}
        ListFooterComponent={
          <>
            {hasMore && <TouchableOpacity style={styles.moreBtn} onPress={onLoadMore} activeOpacity={0.9}><Text style={styles.moreText}>Charger plus</Text></TouchableOpacity>}
            <View style={styles.footer}>
              <Text style={styles.footerLink} onPress={() => Linking.openURL("https://heros20.github.io/Portfolio-2.0/")}>Créé par Kevin Bigoni</Text>
              <Text style={styles.footerLink} onPress={() => Linking.openURL("https://les-comets-honfleur.vercel.app/mentions-legales")}>Copyright {new Date().getFullYear()} Les Comets d&apos;Honfleur</Text>
            </View>
          </>
        }
      />
      <Animated.View
        pointerEvents={showScrollTop ? "auto" : "none"}
        style={[styles.scrollTopWrap, { bottom: scrollTopBottom }, scrollTopAnimatedStyle]}
      >
        <TouchableOpacity
          style={styles.scrollTopBtn}
          onPress={scrollToTop}
          onPressIn={onScrollTopPressIn}
          onPressOut={onScrollTopPressOut}
          activeOpacity={0.94}
        >
          <Icon name="chevron-up" size={24} color="#FFB366" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#09111C" },
  content: { paddingHorizontal: 12, paddingBottom: 34 },
  hero: { marginTop: 8, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,130,0,0.3)" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  menuBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(0,0,0,0.25)" },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", borderWidth: 2, borderColor: "#FF8200" },
  brandTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "900" },
  brandSub: { marginTop: 2, color: "#B7C1D1", fontSize: 12.5 },
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 6 },
  statusPillAdmin: { borderColor: "rgba(255,184,102,0.42)", backgroundColor: "rgba(255,130,0,0.14)" },
  statusPillMember: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.05)" },
  statusPillVisitor: { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.18)" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  statusDotAdmin: { backgroundColor: "#FF9E3A" },
  statusDotMember: { backgroundColor: "#22C55E" },
  statusDotVisitor: { backgroundColor: "#94A3B8" },
  statusText: { color: "#F8FAFC", fontSize: 10.8, fontWeight: "800" },
  heroTag: { marginTop: 10, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", paddingHorizontal: 9, paddingVertical: 4, color: "#FFDDBA", fontSize: 10.5, fontWeight: "900" },
  heroTitle: { marginTop: 7, color: "#FFFFFF", fontSize: 23, lineHeight: 27, fontWeight: "900" },
  heroText: { marginTop: 6, color: "#D9E0EA", fontSize: 12.8, lineHeight: 18 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  stat: { flex: 1, minHeight: 80, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(9,14,24,0.45)" },
  statValue: { color: "#F8FAFC", fontSize: 20, fontWeight: "900" },
  statLabel: { marginTop: 4, color: "#AAB2C2", fontSize: 12.5 },
  authRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  authBtn: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  authBtnGhost: { backgroundColor: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.2)" },
  authBtnPrimary: { backgroundColor: "#F9FAFB", borderColor: "#FFFFFF" },
  authBtnDanger: { backgroundColor: "#B91C1C", borderColor: "#DC2626" },
  authGhostText: { color: "#F8FAFC", fontWeight: "800", fontSize: 13.5 },
  authPrimaryText: { color: "#111827", fontWeight: "900", fontSize: 13.5 },
  authDangerText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13.5 },
  sectionRow: { marginTop: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { color: "#F3F4F6", fontSize: 20, fontWeight: "900" },
  sectionHint: { marginTop: 4, color: "#AAB2C2", fontSize: 12.8 },
  sectionHintHuman: { marginTop: 4, color: "#AAB2C2", fontSize: 12.4 },
  sectionLink: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" },
  sectionLinkText: { color: "#E9C7A4", fontSize: 11.8, fontWeight: "800" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { color: "#B8C1CF", fontSize: 12.6, fontWeight: "800" },
  filterTextActive: { color: "#F8FAFC" },
  errorText: { color: "#FCD34D", marginBottom: 12, fontSize: 12.8 },
  card: { marginBottom: 12, borderRadius: 22, overflow: "hidden", backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  runCard: { borderColor: "rgba(34,211,238,0.18)", backgroundColor: "#0F1729" },
  runCardGradient: { padding: 16 },
  runTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  runBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(103,232,249,0.28)", backgroundColor: "rgba(34,211,238,0.12)" },
  runBadgeText: { color: "#CFFAFE", fontSize: 11.2, fontWeight: "900" },
  runDate: { flex: 1, textAlign: "right", color: "#9DB2CF", fontSize: 11.6, fontWeight: "700" },
  runHeroRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  runOrb: { width: 58, height: 58, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,130,0,0.28)", backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  runLogoSmall: { width: 44, height: 44, borderRadius: 12 },
  runCopy: { flex: 1 },
  runEyebrow: { color: "#67E8F9", fontSize: 11.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  runPlayer: { marginTop: 6, color: "#F8FAFC", fontSize: 19, lineHeight: 24, fontWeight: "900" },
  runSupport: { marginTop: 6, color: "#CBD5E1", fontSize: 12.8, lineHeight: 18 },
  runScoreBox: { minWidth: 92, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,130,0,0.26)", backgroundColor: "rgba(255,130,0,0.12)", alignItems: "flex-end" },
  runScoreLabel: { color: "#FFD5AF", fontSize: 11.2, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  runScoreValue: { marginTop: 4, color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  runFooterRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  runFooterText: { color: "#FFD5AF", fontSize: 12.8, fontWeight: "900" },
  cardImage: { width: "100%", height: 188, backgroundColor: "#1F2937" },
  galleryImage: { width: "100%", height: 270, backgroundColor: "#1F2937" },
  galleryOverlay: { ...StyleSheet.absoluteFillObject },
  galleryContent: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16 },
  cardBody: { padding: 16 },
  meta: { color: "#9DB2CF", fontSize: 12.2, fontWeight: "800" },
  cardTitle: { marginTop: 10, color: "#F8FAFC", fontSize: 21, lineHeight: 27, fontWeight: "900" },
  cardText: { marginTop: 10, color: "#CBD5E1", fontSize: 13.8, lineHeight: 21 },
  note: { marginTop: 10, color: "#FDE68A", fontSize: 12.8, lineHeight: 18 },
  resultPill: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  resultText: { color: "#FFFFFF", fontSize: 11.8, fontWeight: "900" },
  empty: { paddingVertical: 60, alignItems: "center" },
  emptyTitle: { color: "#F3F4F6", fontSize: 18, fontWeight: "900" },
  moreBtn: { marginTop: 4, minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,130,0,0.28)", backgroundColor: "#121A29", alignItems: "center", justifyContent: "center" },
  moreText: { color: "#FFD5AF", fontSize: 13.5, fontWeight: "900" },
  footer: { marginTop: 22 },
  footerLink: { marginTop: 10, color: "#8D98AA", textAlign: "center", fontSize: 11.8, lineHeight: 17 },
  scrollTopWrap: { position: "absolute", right: 18 },
  scrollTopBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#101827EE", borderWidth: 1.5, borderColor: "#FF9E3A", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});
