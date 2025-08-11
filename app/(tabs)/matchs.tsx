// app/screens/MatchsScreen.tsx
"use client";

import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Calendar from "expo-calendar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Ionicons";
import LogoutButton from "../../components/LogoutButton";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

// ================== API utils ==================
const PRIMARY_API =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? "http://10.0.2.2:3000" : "https://les-comets-honfleur.vercel.app");
const FALLBACK_API = "https://les-comets-honfleur.vercel.app";

// timeout par défaut 3s (au lieu de 8s)
async function fetchWithTimeout(url: string, init?: RequestInit, ms = 3000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
async function apiTry<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const url = `${base}${path}`;
  const res = await fetchWithTimeout(url, init);
  let json: any = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    const msg = json?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}
async function apiGet<T>(path: string): Promise<T> {
  try {
    return await apiTry<T>(PRIMARY_API, path, { method: "GET" });
  } catch {
    return await apiTry<T>(FALLBACK_API, path, { method: "GET" });
  }
}
async function apiPost<T>(path: string, body: any): Promise<T> {
  const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  try {
    return await apiTry<T>(PRIMARY_API, path, init);
  } catch {
    return await apiTry<T>(FALLBACK_API, path, init);
  }
}

// ================== Assets & mapping ==================
const logoComets = require("../../assets/images/iconComets.png");

const LOGO_MAP: Record<string, any> = {
  Caen: require("../../assets/images/Caen.png"),
  Cherbourg: require("../../assets/images/Cherbourg.jpg"),
  "Les Andelys": require("../../assets/images/les_Andelys.png"),
  Louviers: require("../../assets/images/Louviers.png"),
  "Le Havre": require("../../assets/images/Le_Havre.png"),
  Rouen: require("../../assets/images/Rouen.jpg"),
  Honfleur: require("../../assets/images/Honfleur.png"),
};

// === Badges (mêmes noms/chemins que la page profil) ===
const BADGE_ASSETS = {
  rookie: require("../../assets/badges/rookie.png"),
  novice: require("../../assets/badges/novice.png"),
  initie: require("../../assets/badges/initie.png"),
  confirme: require("../../assets/badges/confirme.png"),
  allstar: require("../../assets/badges/allstar.png"),
} as const;

const TIERS = [
  { min: 7, key: "allstar",  label: "All-Star",  color: "#EF4444" }, // rouge
  { min: 5,  key: "confirme", label: "Confirmé", color: "#8B5CF6" }, // violet
  { min: 3,  key: "initie",   label: "Initié",   color: "#22C55E" }, // vert
  { min: 1,  key: "novice",   label: "Novice",   color: "#60A5FA" }, // bleu
  { min: 0,  key: "rookie",   label: "Rookie",   color: "#9CA3AF" }, // gris
] as const;

type TierKey = keyof typeof BADGE_ASSETS;

function computeBadgeFromCount(count: number) {
  const tier = TIERS.find(t => count >= t.min) ?? TIERS[TIERS.length - 1];
  const idx = TIERS.findIndex(t => t.key === tier.key);
  const next = idx > 0 ? TIERS[idx - 1] : null;
  let progress = 1;
  if (next) {
    const span = next.min - tier.min || 1;
    const inTier = Math.max(0, Math.min(span, count - tier.min));
    progress = inTier / span;
  }
  return {
    key: tier.key as TierKey,
    label: tier.label,
    color: tier.color,
    nextAt: next?.min ?? null,
    progress,
  };
}

// ================== Types ==================
const TEAM_NAMES: Record<string, string> = {
  HON: "Honfleur", LHA: "Le Havre", ROU: "Rouen", CAE: "Caen", CHE: "Cherbourg", WAL: "Louviers", AND: "Andelys",
};

type Game = {
  id: number;
  game_number: number;
  date: string;
  is_home: boolean;
  opponent_abbr: string;
  opponent_logo: string;
  team_score: number | null;
  opponent_score: number | null;
  result: string;
  boxscore_link: string;
  team_abbr?: string;
  note?: string | null;
};
type PlannedGame = {
  id: number | string;
  date: string;
  opponent: string;
  logo?: string;
  is_home: boolean;
  note?: string | null;
};
type ParticipationsGET = { matchIds: string[] };
type ParticipatePOST = {
  ok: boolean;
  participations: number;
  badge: { label: string; nextAt: number | null; progress: number };
};

// ================== Helpers ==================
function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function resultColor(result: string) {
  if (result === "W") return "#10B981";
  if (result === "L") return "#EF4444";
  return "#F59E0B";
}
function resultLabel(result: string) {
  if (result === "W") return "VICTOIRE";
  if (result === "L") return "DÉFAITE";
  return "NUL";
}

const TABS = [
  { label: "Matchs à venir", key: "upcoming", icon: "calendar-outline" },
  { label: "Matchs joués", key: "played", icon: "list-outline" },
] as const;

// ================== Local storage (anti-flip / offline) ==================
const storageKey = (adminId: string | number) => `comets:joined:${adminId}`;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

type JoinedCache = { map: Record<string, boolean>; ts: number };

async function readJoinedFromStorage(adminId: string | number): Promise<JoinedCache | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(adminId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.map && typeof parsed.ts === "number") return parsed as JoinedCache;
    return null;
  } catch {
    return null;
  }
}
async function writeJoinedToStorage(adminId: string | number, map: Record<string, boolean>) {
  try {
    const payload: JoinedCache = { map, ts: Date.now() };
    await AsyncStorage.setItem(storageKey(adminId), JSON.stringify(payload));
  } catch {}
}

// ================== Toast Gamification ==================
type ToastData = {
  participations: number;
  badgeKey: TierKey;
  badgeLabel: string;
  badgeColor: string;
  nextAt: number | null;
  progress: number;
};

function BadgeCoin({ size, borderColor, source }: { size: number; borderColor: string; source: any }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#fff",
        borderWidth: 3,
        borderColor,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        shadowColor: borderColor,
        shadowOpacity: Platform.OS === "ios" ? 0.18 : 0.12,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {source ? (
        <Image source={source} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={{ fontSize: size * 0.42 }}>🏅</Text>
      )}
    </View>
  );
}

function CometsToast({
  visible,
  data,
  onClose,
}: {
  visible: boolean;
  data: ToastData | null;
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      const id = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 120, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onClose());
      }, 2700);
      return () => clearTimeout(id);
    }
  }, [visible]);

  if (!visible || !data) return null;

  return (
    <View pointerEvents="box-none" style={styles.toastOverlay}>
      <Animated.View
        style={[
          styles.toastCard,
          {
            transform: [{ translateY }],
            opacity,
            borderColor: data.badgeColor + "55",
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BadgeCoin size={58} borderColor={data.badgeColor} source={BADGE_ASSETS[data.badgeKey]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.toastTitle, { color: data.badgeColor }]}>
              {data.badgeLabel}
            </Text>
            <Text style={styles.toastSub}>
              {data.participations} participation{data.participations > 1 ? "s" : ""} enregistrée{data.participations > 1 ? "s" : ""} 🎉
            </Text>
            <View style={styles.toastBarBg}>
              <View style={[styles.toastBarFg, { width: `${Math.round(data.progress * 100)}%`, backgroundColor: data.badgeColor }]} />
            </View>
            <Text style={styles.toastNext}>
              {data.nextAt === null ? "Palier max atteint" : `Prochain titre à ${data.nextAt} participations`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={18} color="#cfd3db" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ================== Screen ==================
export default function MatchsScreen() {
  const navigation = useNavigation();
  const { admin, setAdmin } = useAdmin() as any;

  const [games, setGames] = useState<Game[]>([]);
  const [plannedGames, setPlannedGames] = useState<PlannedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlanned, setLoadingPlanned] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<(typeof TABS)[number]["key"]>("upcoming");

  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hydratingJoined, setHydratingJoined] = useState(false);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData] = useState<ToastData | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Load games played
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("games")
          .select("*")
          .order("date", { ascending: true });
        if (error) setErrorMsg("Erreur Supabase (joués) : " + error.message);
        else setGames((data as Game[]) ?? []);
      } catch (e: any) {
        setErrorMsg("Crash côté JS (joués) : " + (e?.message || e));
      }
      setLoading(false);
    })();
  }, []);

  // Load upcoming
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("matches_planned")
          .select("*")
          .order("date", { ascending: true });
        if (error) setErrorMsg("Erreur Supabase (à venir) : " + error.message);
        else setPlannedGames((data as PlannedGame[]) ?? []);
      } catch (e: any) {
        setErrorMsg("Crash côté JS (à venir) : " + (e?.message || e));
      }
      setLoadingPlanned(false);
    })();
  }, []);

  // —— Hydrate "joined" depuis storage (instantané) puis API (source de vérité) avec TTL
  const hydrateJoined = useCallback(async () => {
    if (!admin?.id) return;

    // 1) LOCAL FIRST – affichage instantané
    const local = await readJoinedFromStorage(admin.id);
    if (local?.map) setJoined(local.map);

    // 2) Si cache récent, stop (pas de hit API)
    if (local && Date.now() - local.ts < TTL_MS) return;

    // 3) API en arrière-plan
    setHydratingJoined(true);
    try {
      let apiMap: Record<string, boolean> = {};
      try {
        const res = await apiGet<ParticipationsGET>(`/api/matches/participations?adminId=${admin.id}`);
        (res.matchIds || []).forEach((mid) => { apiMap[String(mid)] = true; });
      } catch {
        // silencieux : on reste sur le local si l’API timeoute
      }
      // 4) Fusion OR
      const merged: Record<string, boolean> = { ...(local?.map || {}), ...(apiMap || {}) };
      setJoined(merged);
      await writeJoinedToStorage(admin.id, merged);
    } finally {
      setHydratingJoined(false);
    }
  }, [admin?.id]);

  // — au focus de l’écran (et quand admin change), on (re)hydrate
  useFocusEffect(
    useCallback(() => {
      if (admin?.id) {
        hydrateJoined();
      }
    }, [admin?.id, hydrateJoined])
  );

  // Data filtering
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const playedGames = useMemo(() => games.filter((g) => g.result), [games]);
  const upcomingGames = useMemo(() => plannedGames.filter((pg) => new Date(pg.date) >= today), [plannedGames]);
  const dataToShow = selectedTab === "played" ? playedGames : upcomingGames;

  // Native calendar
  async function addMatchToCalendar(match: PlannedGame) {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission requise", "Autorisez l’accès au calendrier.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find((cal) => cal.allowsModifications);
      if (!defaultCal) {
        Alert.alert("Erreur", "Aucun calendrier modifiable trouvé.");
        return;
      }
      const baseDate = new Date(match.date);
      baseDate.setHours(11, 0, 0, 0);
      const endDate = new Date(baseDate.getTime() + 6 * 60 * 60 * 1000);
      await Calendar.createEventAsync(defaultCal.id, {
        title: `Match Comets vs ${match.opponent}`,
        startDate: baseDate,
        endDate,
        location: match.is_home ? "Stade de Honfleur" : `Déplacement - ${match.opponent}`,
        notes: match.note || "",
        alarms: [{ relativeOffset: -60 }],
        timeZone: "Europe/Paris",
      });
      Alert.alert("Ajouté !", "Le match a été ajouté dans votre calendrier.");
    } catch (e: any) {
      Alert.alert("Erreur calendrier", e?.message || "Erreur inconnue.");
    }
  }

  // Participate (gamification) —> Toast Comets
  async function handleParticipate(match: PlannedGame) {
    if (!admin?.id) {
      Alert.alert("Connexion requise", "Connecte-toi pour participer.");
      return;
    }
    const mid = String(match.id);
    if (joined[mid]) return;

    setPosting((p) => ({ ...p, [mid]: true }));
    try {
      const res = await apiPost<ParticipatePOST>(`/api/matches/${mid}/participate`, { adminId: admin.id });
      console.log("[participate] mid=%s ->", mid, res);
      // Mark local (optimiste)
      setJoined((j) => {
        const upd = { ...j, [mid]: true };
        writeJoinedToStorage(admin.id, upd); // persiste
        return upd;
      });

      // Update admin context
      if (setAdmin && typeof res?.participations === "number") {
        setAdmin((prev: any) => (prev ? { ...prev, participations: res.participations } : prev));
      }

      // Palier actuel
      const b = computeBadgeFromCount(res.participations);

      // Toast
      setToastData({
        participations: res.participations,
        badgeKey: b.key,
        badgeLabel: b.label,
        badgeColor: b.color,
        nextAt: b.nextAt,
        progress: b.progress,
      });
      setToastVisible(true);
    } catch (e: any) {
      Alert.alert("Oups", e?.message ?? "Impossible d’enregistrer");
    } finally {
      setPosting((p) => ({ ...p, [mid]: false }));
    }
  }

  function getOpponentLogo(opponent: string): any {
    return LOGO_MAP[opponent] || null;
  }

  // ================== UI Components ==================
  const TabBtn = ({ tab }: { tab: (typeof TABS)[number] }) => {
    const active = selectedTab === tab.key;
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedTab(tab.key);
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }}
        style={[styles.tabBtn, active && styles.tabBtnActive]}
        activeOpacity={0.9}
      >
        <Icon name={tab.icon as any} size={16} color={active ? "#fff" : "#FF8200"} />
        <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };

  const UpcomingCard = ({ item }: { item: PlannedGame }) => {
    const mid = String(item.id);
    const isJoined = !!joined[mid];
    const isPosting = !!posting[mid];

    return (
      <View style={[styles.card, { borderColor: "rgba(82,182,250,0.5)" }]}>
        <View style={styles.cardTopRow}>
          <Text style={styles.matchBadgeUpcoming}>À venir</Text>
          <Text style={styles.matchDate}>{formatDate(item.date)}</Text>
        </View>

        <View style={styles.venueRow}>
          <Icon name={item.is_home ? "home" : "airplane-outline"} size={18} color={item.is_home ? "#FF8200" : "#52b6fa"} />
          <Text style={styles.venueTxt}>{item.is_home ? "À domicile" : "Extérieur"}</Text>
        </View>

        <View style={styles.vsRow}>
          <View style={styles.teamCol}>
            <Image source={LOGO_MAP["Honfleur"]} style={styles.logoTeam} />
            <Text style={[styles.teamName, { color: "#FF8200" }]}>Honfleur</Text>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.teamCol}>
            {getOpponentLogo(item.opponent) ? (
              <Image source={getOpponentLogo(item.opponent)} style={styles.logoTeam} />
            ) : (
              <View style={[styles.logoTeam, { backgroundColor: "#fff" }]} />
            )}
            <Text style={[styles.teamName, { color: "#52b6fa" }]} numberOfLines={1}>
              {item.opponent}
            </Text>
          </View>
        </View>

        {!!item.note && <Text style={styles.noteTxt}>{item.note}</Text>}

        <TouchableOpacity
          style={styles.calBtn}
          activeOpacity={0.88}
          onPress={() =>
            Alert.alert("Ajouter au calendrier", "Ajouter ce match à votre calendrier ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Oui", onPress: () => addMatchToCalendar(item) },
            ])
          }
        >
          <Icon name="calendar-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.calBtnTxt}>Ajouter au calendrier</Text>
        </TouchableOpacity>

        {!admin?.id ? (
          <TouchableOpacity disabled style={[styles.joinBtn, { backgroundColor: "#6b7280" }]} activeOpacity={0.9}>
            <Icon name="lock-closed-outline" size={18} color="#fff" style={{ marginRight: 7 }} />
            <Text style={styles.joinBtnTxt}>Connecte-toi pour participer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            disabled={isJoined || isPosting} // ⬅️ plus de blocage pendant hydratingJoined
            onPress={() => handleParticipate(item)}
            style={[
              styles.joinBtn,
              isJoined && { backgroundColor: "#334155" },
              isPosting && { opacity: 0.7 },
            ]}
            activeOpacity={0.9}
          >
            <Icon
              name={isJoined ? "checkmark-circle-outline" : "baseball-outline"}
              size={18}
              color="#fff"
              style={{ marginRight: 7 }}
            />
            <Text style={styles.joinBtnTxt}>
              {isJoined ? "Inscrit" : isPosting ? "Inscription…" : "Je participe"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const PlayedCard = ({ g }: { g: Game }) => {
    const teamAbbr = g.team_abbr || "HON";
    const homeTeam = g.is_home ? teamAbbr : g.opponent_abbr;
    const awayTeam = g.is_home ? g.opponent_abbr : teamAbbr;

    const leftName = TEAM_NAMES[homeTeam] || homeTeam;
    const rightName = TEAM_NAMES[awayTeam] || awayTeam;

    const homeIsHonfleur = leftName === "Honfleur";
    const leftLogo = homeIsHonfleur ? LOGO_MAP["Honfleur"] : getOpponentLogo(leftName);
    const rightLogo = !homeIsHonfleur ? LOGO_MAP["Honfleur"] : getOpponentLogo(rightName);

    const leftScore = g.is_home ? g.team_score ?? "--" : g.opponent_score ?? "--";
    const rightScore = g.is_home ? g.opponent_score ?? "--" : g.team_score ?? "--";

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.matchBadgePlayed}>Match #{g.game_number}</Text>
          <Text style={styles.matchDate}>{formatDate(g.date)}</Text>
        </View>

        <View style={styles.venueRow}>
          <Icon name={g.is_home ? "home" : "airplane-outline"} size={18} color={g.is_home ? "#FF8200" : "#52b6fa"} />
          <Text style={styles.venueTxt}>{g.is_home ? "À domicile" : "Extérieur"}</Text>
        </View>

        <View style={styles.scoresRow}>
          <View style={styles.teamScoreCol}>
            {leftLogo && <Image source={leftLogo} style={styles.logoTeam} />}
            <Text style={[styles.teamName, { color: homeIsHonfleur ? "#FF8200" : "#52b6fa" }]} numberOfLines={1}>
              {leftName}
            </Text>
            <Text style={styles.scoreTxt}>{leftScore}</Text>
          </View>

          <Text style={styles.vsDash}>—</Text>

          <View style={styles.teamScoreCol}>
            {rightLogo && <Image source={rightLogo} style={styles.logoTeam} />}
            <Text style={[styles.teamName, { color: !homeIsHonfleur ? "#FF8200" : "#52b6fa" }]} numberOfLines={1}>
              {rightName}
            </Text>
            <Text style={styles.scoreTxt}>{rightScore}</Text>
          </View>
        </View>

        <View style={styles.resultRow}>
          <View style={[styles.resultBadge, { backgroundColor: resultColor(g.result) }]}>
            <Text style={styles.resultBadgeTxt}>{resultLabel(g.result)}</Text>
          </View>
          {!!g.boxscore_link && (
            <TouchableOpacity style={styles.boxscoreBtn} onPress={() => Linking.openURL(g.boxscore_link)} activeOpacity={0.9}>
              <Text style={styles.boxscoreBtnTxt}>Boxscore FFBS</Text>
              <Icon name="open-outline" size={18} color="#fff" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const isLoading = (selectedTab === "played" && loading) || (selectedTab === "upcoming" && loadingPlanned);

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

          <Text style={styles.heroTitle}>Calendrier & Résultats</Text>
          <LogoutButton />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Saison 2025 — Comets</Text>
            <Text style={styles.heroSub}>Matchs officiels & amicaux</Text>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setSelectedTab(tab.key);
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              style={[styles.tabBtn, selectedTab === tab.key && styles.tabBtnActive]}
              activeOpacity={0.9}
            >
              <Icon
                name={tab.icon as any}
                size={16}
                color={selectedTab === tab.key ? "#fff" : "#FF8200"}
              />
              <Text
                style={[styles.tabBtnText, selectedTab === tab.key && styles.tabBtnTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* LISTE */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
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
              keyExtractor={(it: any) => String(it.id)}
              contentContainerStyle={{ padding: 14, paddingBottom: 36 }}
              ListEmptyComponent={<Text style={styles.emptyTxt}>Aucun match à afficher.</Text>}
              renderItem={({ item }) =>
                selectedTab === "upcoming" ? (
                  <UpcomingCard item={item as PlannedGame} />
                ) : (
                  <PlayedCard g={item as Game} />
                )
              }
              onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 240)}
              scrollEventThrottle={16}
            />
            {showScrollTop && (
              <TouchableOpacity
                style={styles.scrollTopBtn}
                onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                activeOpacity={0.8}
              >
                <Icon name="chevron-up" size={30} color="#FF8200" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* TOAST GAMIFICATION */}
      <CometsToast
        visible={toastVisible}
        data={toastData}
        onClose={() => {
          setToastVisible(false);
          setToastData(null);
        }}
      />
    </SafeAreaView>
  );
}

// ================== Styles ==================
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

  // Tabs
  tabsRow: { flexDirection: "row", paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  tabBtn: {
    flex: 1,
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  tabBtnActive: { backgroundColor: "#FF8200", borderColor: "#FF8200" },
  tabBtnText: { color: "#FF8200", fontWeight: "900", fontSize: 13.5, letterSpacing: 0.3 },
  tabBtnTextActive: { color: "#fff" },

  // Load & empty
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", fontWeight: "bold", fontSize: 18 },
  errorTxt: { color: "tomato", fontSize: 15, textAlign: "center", paddingHorizontal: 20 },
  emptyTxt: { color: "#9aa0ae", fontSize: 15, textAlign: "center", marginTop: 40 },

  // Card (glass)
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
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  matchBadgeUpcoming: {
    color: "#52b6fa",
    backgroundColor: "rgba(82,182,250,0.15)",
    borderColor: "rgba(82,182,250,0.4)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: "900",
    fontSize: 12.5,
  },
  matchBadgePlayed: {
    color: "#FF8200",
    backgroundColor: "rgba(255,130,0,0.12)",
    borderColor: "rgba(255,130,0,0.35)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: "900",
    fontSize: 12.5,
  },
  matchDate: { color: "#d5d8df", fontWeight: "700", fontSize: 13.5 },

  venueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  venueTxt: { color: "#cfd3db", fontWeight: "700", fontSize: 13.5 },

  // VS (upcoming)
  vsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  teamCol: { flex: 1, alignItems: "center" },
  teamName: { color: "#fff", fontWeight: "900", fontSize: 15, marginTop: 6 },
  logoTeam: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  vs: { color: "#FF8200", fontWeight: "900", fontSize: 16, marginHorizontal: 10 },

  // Scores (played)
  scoresRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  teamScoreCol: { flex: 1, alignItems: "center" },
  scoreTxt: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 22,
    marginTop: 2,
    textShadowColor: "#0006",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  vsDash: { color: "#FF8200", fontWeight: "900", fontSize: 20, marginHorizontal: 10 },

  // Result + boxscore
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  resultBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  resultBadgeTxt: { color: "#fff", fontWeight: "900", letterSpacing: 0.6, fontSize: 13.5 },
  boxscoreBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#FF8200", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  boxscoreBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  // Notes
  noteTxt: { color: "#FF8200", fontWeight: "bold", fontSize: 13, marginTop: 8, textAlign: "center" },

  // Buttons
  calBtn: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FF8200", borderRadius: 12, paddingVertical: 10 },
  calBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  joinBtn: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#0ea5e9", borderRadius: 12, paddingVertical: 10 },
  joinBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },

  // Scroll to top
  scrollTopBtn: {
    position: "absolute",
    right: 18, bottom: 25,
    backgroundColor: "#101017EE",
    borderRadius: 25, width: 50, height: 50,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#FF8200", shadowOpacity: 0.17, shadowRadius: 8, elevation: 3,
    borderWidth: 2, borderColor: "#FF8200",
  },

  // Toast
  toastOverlay: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    alignItems: "center", paddingBottom: 18, paddingHorizontal: 12,
  },
  toastCard: {
    width: "100%", maxWidth: 520,
    backgroundColor: "rgba(17,19,26,0.98)",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, elevation: 8,
  },
  toastTitle: { fontWeight: "900", fontSize: 16 },
  toastSub: { color: "#eaeef7", fontWeight: "700", fontSize: 13, marginTop: 2 },
  toastBarBg: { height: 8, borderRadius: 6, backgroundColor: "#242937", marginTop: 8, overflow: "hidden" },
  toastBarFg: { height: "100%", borderRadius: 6 },
  toastNext: { color: "#9aa0ae", fontWeight: "700", fontSize: 11.5, marginTop: 6 },
});
