// app/screens/MatchsScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Calendar from "expo-calendar";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image as RNImage,
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
import { DrawerMenuButton } from "../../components/navigation/AppDrawer";
import LogoutButton from "../../components/LogoutButton";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";
import { formatDateFr } from "../../lib/date";
import { resultColor, resultLabel } from "../../lib/match";

// ================== Palette Comets (sobre) ==================
const COLORS = {
  bg: "#0f1014",
  surface: "#11131a",
  surfaceBorder: "#1f2230",

  card: "#141821",
  cardBorder: "#252a38",

  text: "#eaeef7",
  textMuted: "#cfd3db",
  slateDark: "#0F172A",

  // Orange Comets (adouci)
  orange: "#D96B00",
  orangeBorder: "#C25F00",
  orangeSoftBg: "rgba(217,107,0,0.14)",
  orangeSoftBorder: "rgba(217,107,0,0.34)",

  // Bleu (moins flashy)
  blue: "#2F6AA9",
  blueSoftBg: "rgba(47,106,169,0.16)",
  blueSoftBorder: "rgba(47,106,169,0.42)",

  // Etats
  danger: "#B91C1C",

  // Infos / Pills
  infoBg: "#D6E3F3",
  infoBorder: "#7FA8D6",
  amberPillBg: "#EBD3A0",
  amberPillBorder: "#C98F3C",
};

const TOP_TABS = [
  { key: "upcoming", label: "A venir", icon: "calendar-outline" },
  { key: "played", label: "joués", icon: "list-outline" },
] as const;

const CATEGORY_FILTERS = ["Seniors", "15U", "12U"] as const;

const CATEGORY_META: Record<
  (typeof CATEGORY_FILTERS)[number],
  { icon: string; tone: string }
> = {
  Seniors: { icon: "baseball-outline", tone: "#FFB366" },
  "15U": { icon: "people-outline", tone: "#93C5FD" },
  "12U": { icon: "sparkles-outline", tone: "#86EFAC" },
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

// ================== API utils ==================
const PRIMARY_API =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? "http://10.0.2.2:3000" : "https://les-comets-honfleur.vercel.app");
const FALLBACK_API = "https://les-comets-honfleur.vercel.app";

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 3000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
async function apiTry<T>(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${base}${path}`;
  const res = await fetchWithTimeout(url, { credentials: "include", ...(init ?? {}) });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
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
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  try {
    return await apiTry<T>(PRIMARY_API, path, init);
  } catch {
    return await apiTry<T>(FALLBACK_API, path, init);
  }
}

// ================== Assets & mapping ==================
const LOGO_MAP: Record<string, any> = {
  Caen: require("../../assets/images/Caen.png"),
  Cherbourg: require("../../assets/images/Cherbourg.jpg"),
  "Les Andelys": require("../../assets/images/les_Andelys.png"),
  Andelys: require("../../assets/images/les_Andelys.png"),
  Louviers: require("../../assets/images/Louviers.png"),
  "Le Havre": require("../../assets/images/Le_Havre.png"),
  Rouen: require("../../assets/images/Rouen.jpg"),
  Honfleur: require("../../assets/images/Honfleur.png"),
  "Saint-Lô": require("../../assets/images/Saint-Lo.jpg"),
  "Saint-Lo": require("../../assets/images/Saint-Lo.jpg"),
};

// === Badges ===
const BADGE_ASSETS = {
  rookie: require("../../assets/badges/rookie.png"),
  novice: require("../../assets/badges/novice.png"),
  initie: require("../../assets/badges/initie.png"),
  confirme: require("../../assets/badges/confirme.png"),
  allstar: require("../../assets/badges/allstar.png"),
} as const;

const TIERS = [
  { min: 7, key: "allstar", label: "All-Star", color: "#EF4444" },
  { min: 5, key: "confirme", label: "Confirmé", color: "#8B5CF6" },
  { min: 3, key: "initie", label: "Initié", color: "#22C55E" },
  { min: 1, key: "novice", label: "Novice", color: "#60A5FA" },
  { min: 0, key: "rookie", label: "Rookie", color: "#9CA3AF" },
] as const;

type TierKey = keyof typeof BADGE_ASSETS;

// ================== Utils ==================
function computeBadgeFromCount(count: number) {
  const tier = TIERS.find((t) => count >= t.min) ?? TIERS[TIERS.length - 1];
  const idx = TIERS.findIndex((t) => t.key === tier.key);
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
function hexToRgba(hex: string, alpha = 0.33) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return `rgba(255,255,255,${alpha})`;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255,
    g = (int >> 8) & 255,
    b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function normalizeName(name: string) {
  return name.replace(/^Les\s+/i, "").trim();
}
function parseDateValue(dateValue: string): Date | null {
  if (!dateValue) return null;

  // Priorite au format FR "JJ/MM/AAAA" (ou JJ-MM-AAAA) pour eviter
  // l'interpretation ambigue en MM/JJ par le parser natif.
  const frMatch = dateValue.match(/^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/);
  if (frMatch) {
    const [, ddRaw, mmRaw, yyyyRaw] = frMatch;
    const dd = Number(ddRaw);
    const mm = Number(mmRaw);
    const yyyy = Number(yyyyRaw);
    const parsed = new Date(yyyy, mm - 1, dd);

    if (
      parsed.getFullYear() !== yyyy ||
      parsed.getMonth() !== mm - 1 ||
      parsed.getDate() !== dd
    ) {
      return null;
    }

    return parsed;
  }

  const nativeParsed = new Date(dateValue);
  if (!Number.isNaN(nativeParsed.getTime())) return nativeParsed;
  return null;
}
function getDateTimestamp(dateValue: string): number | null {
  const parsed = parseDateValue(dateValue);
  return parsed ? parsed.getTime() : null;
}
function getMonthKey(dateValue: string) {
  const parsed = parseDateValue(dateValue);
  if (!parsed) return "unknown";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}
function getMonthLabel(dateValue: string) {
  const parsed = parseDateValue(dateValue);
  if (!parsed) return "Date inconnue";
  const label = MONTH_LABEL_FORMATTER.format(parsed);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ================== Types ==================
const TEAM_NAMES: Record<string, string> = {
  HON: "Honfleur",
  LHA: "Le Havre",
  ROU: "Rouen",
  CAE: "Caen",
  CHE: "Cherbourg",
  WAL: "Louviers",
  AND: "Les Andelys",
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
  categorie?: "Seniors" | "15U" | "12U";
};
type ParticipationsGET = { matchIds: string[]; declinedMatchIds?: string[] };
type ParticipatePOST = { ok: boolean; participations: number };
type Eligibility = {
  eligible: boolean | null;
  category: "Seniors" | "15U" | "12U" | null;
};
type MatchListItem =
  | { type: "month"; key: string; label: string }
  | { type: "upcoming"; key: string; match: PlannedGame }
  | { type: "played"; key: string; game: Game };

function groupUpcomingByMonth(items: PlannedGame[]): MatchListItem[] {
  const grouped: MatchListItem[] = [];
  let currentMonth: string | null = null;

  const sorted = [...items].sort((a, b) => {
    const ta = getDateTimestamp(a.date);
    const tb = getDateTimestamp(b.date);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });

  sorted.forEach((match) => {
    const monthKey = getMonthKey(match.date);
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      grouped.push({
        type: "month",
        key: `month-upcoming-${monthKey}`,
        label: getMonthLabel(match.date),
      });
    }
    grouped.push({
      type: "upcoming",
      key: `upcoming-${String(match.id)}`,
      match,
    });
  });

  return grouped;
}

function groupPlayedByMonth(items: Game[]): MatchListItem[] {
  const grouped: MatchListItem[] = [];
  let currentMonth: string | null = null;

  const sorted = [...items].sort((a, b) => {
    const ta = getDateTimestamp(a.date);
    const tb = getDateTimestamp(b.date);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });

  sorted.forEach((game) => {
    const monthKey = getMonthKey(game.date);
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      grouped.push({
        type: "month",
        key: `month-played-${monthKey}`,
        label: getMonthLabel(game.date),
      });
    }
    grouped.push({
      type: "played",
      key: `played-${String(game.id)}`,
      game,
    });
  });

  return grouped;
}

// ================== Local storage ==================
const storageKey = (adminId: string | number) => `comets:joined:${adminId}`;
type JoinedCache = { map: Record<string, boolean>; ts: number };

async function readJoinedFromStorage(
  adminId: string | number,
): Promise<JoinedCache | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(adminId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.map && typeof parsed.ts === "number")
      return parsed as JoinedCache;
    return null;
  } catch {
    return null;
  }
}
async function writeJoinedToStorage(
  adminId: string | number,
  map: Record<string, boolean>,
) {
  try {
    const payload: JoinedCache = { map, ts: Date.now() };
    await AsyncStorage.setItem(storageKey(adminId), JSON.stringify(payload));
  } catch {}
}

// ================== Toast ==================
type ToastData = {
  participations: number;
  badgeKey: TierKey;
  badgeLabel: string;
  badgeColor: string;
  nextAt: number | null;
  progress: number;
};
function BadgeCoin({
  size,
  borderColor,
  source,
}: {
  size: number;
  borderColor: string;
  source: any;
}) {
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
      }}
    >
      {source ? (
        <ExpoImage
          source={source}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={100}
        />
      ) : (
        <Icon name="trophy-outline" size={Math.round(size * 0.42)} color="#64748B" />
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
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      const id = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 120,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onClose());
      }, 2700);
      return () => clearTimeout(id);
    }
  }, [visible, onClose, opacity, translateY]);
  if (!visible || !data) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        paddingBottom: 18,
        paddingHorizontal: 12,
      }}
    >
      <Animated.View
        style={{
          width: "100%",
          maxWidth: 520,
          backgroundColor: "rgba(17,19,26,0.98)",
          borderWidth: 1.5,
          borderRadius: 16,
          padding: 12,
          transform: [{ translateY }],
          opacity,
          borderColor: hexToRgba(data.badgeColor || "#ffffff", 0.33),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <BadgeCoin
            size={58}
            borderColor={data.badgeColor}
            source={BADGE_ASSETS[data.badgeKey]}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{
                fontWeight: "900",
                fontSize: 16,
                color: data.badgeColor,
              }}
            >
              {data.badgeLabel}
            </Text>
            <Text
              style={{
                color: COLORS.text,
                fontWeight: "700",
                fontSize: 13,
                marginTop: 2,
              }}
            >
              {data.participations} participation
              {data.participations > 1 ? "s" : ""} enregistrée
              {data.participations > 1 ? "s" : ""} 🎉
            </Text>
            <View
              style={{
                height: 8,
                borderRadius: 6,
                backgroundColor: "#242937",
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  borderRadius: 6,
                  width: `${Math.round(data.progress * 100)}%`,
                  backgroundColor: data.badgeColor,
                }}
              />
            </View>
            <Text
              style={{
                color: "#9aa0ae",
                fontWeight: "700",
                fontSize: 11.5,
                marginTop: 6,
              }}
            >
              {data.nextAt === null
                ? "Palier max atteint"
                : `Prochain titre à ${data.nextAt} participations`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={18} color="#cfd3db" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ================== Screen ==================
export default function MatchsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { admin, setAdmin } = useAdmin() as any;

  const [games, setGames] = useState<Game[]>([]);
  const [plannedGames, setPlannedGames] = useState<PlannedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlanned, setLoadingPlanned] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"upcoming" | "played">(
    "upcoming",
  );

  // filtres catégorie (par défaut Seniors)
  const [catFilter, setCatFilter] = useState<"Seniors" | "15U" | "12U">(
    "Seniors",
  );

  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [declined, setDeclined] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ÉLIGIBILITÉ + catégorie
  const [elig, setElig] = useState<Eligibility>({
    eligible: null,
    category: null,
  });

  // Comptes d'inscrits par match (cache locale)
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData] = useState<ToastData | null>(null);

  const flatListRef = useRef<FlatList<MatchListItem>>(null);

  // INIT NOTIFS
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    Asset.loadAsync([
      ...Object.values(LOGO_MAP),
      ...Object.values(BADGE_ASSETS),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    const remoteLogos = Array.from(
      new Set(
        plannedGames
          .map((m) => m.logo)
          .filter(
            (logo): logo is string =>
              typeof logo === "string" && /^https?:\/\//i.test(logo),
          ),
      ),
    );

    remoteLogos.slice(0, 24).forEach((uri) => {
      ExpoImage.prefetch(uri).catch(() => {});
    });
  }, [plannedGames]);

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

  // —— Hydrate "joined" depuis storage puis API (TTL)
  const hydrateJoined = useCallback(async () => {
    if (!admin?.id) return;
    const local = await readJoinedFromStorage(admin.id);
    if (local?.map) setJoined(local.map);

    try {
      let apiMap: Record<string, boolean> = {};
      let apiDeclinedMap: Record<string, boolean> = {};
      try {
        const res = await apiGet<ParticipationsGET>(
          `/api/matches/participations?adminId=${admin.id}`,
        );
        (res.matchIds || []).forEach((mid) => {
          apiMap[String(mid)] = true;
        });
        (res.declinedMatchIds || []).forEach((mid) => {
          apiDeclinedMap[String(mid)] = true;
        });
      } catch {}
      const merged: Record<string, boolean> = {
        ...(local?.map || {}),
        ...(apiMap || {}),
      };
      setJoined(merged);
      setDeclined(apiDeclinedMap);
      await writeJoinedToStorage(admin.id, merged);
    } catch {
      setDeclined({});
    }
  }, [admin?.id]);

  // 🔎 Check éligibilité + hydrate joined au focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!admin?.id) {
          setElig({ eligible: null, category: null });
          setJoined({});
          setDeclined({});
          return;
        }
        try {
          const res = await apiGet<{
            eligible: boolean;
            source: "players" | "young_players" | null;
            category: "Seniors" | "15U" | "12U" | null;
          }>(`/api/matches/eligibility?adminId=${admin.id}`);
          setElig({ eligible: !!res.eligible, category: res.category ?? null });
        } catch {
          setElig({ eligible: false, category: null });
        }
      })();
      if (admin?.id) hydrateJoined();
    }, [admin?.id, hydrateJoined]),
  );

  // ===== Comptage des inscrits (par match) =====
  useEffect(() => {
    const ids = plannedGames.map((m) => String(m.id));
    if (!ids.length) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("match_participations")
          .select("match_id")
          .in("match_id", ids);
        if (error) return;

        const next: Record<string, number> = {};
        ids.forEach((id) => {
          next[id] = 0;
        });
        ((data ?? []) as { match_id: string | number | null }[]).forEach(
          (row) => {
            const key = String(row.match_id ?? "");
            if (!key) return;
            next[key] = (next[key] ?? 0) + 1;
          },
        );

        setCounts(next);
      } catch {}
    })();
  }, [plannedGames]);

  // Data filtering
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const playedGames = useMemo(
    () =>
      games.filter(
        (g) => g.result === "W" || g.result === "L" || g.result === "T",
      ),
    [games],
  );
  const upcomingGames = useMemo(
    () =>
      plannedGames.filter((pg) => {
        const parsed = parseDateValue(pg.date);
        return !!parsed && parsed >= today;
      }),
    [plannedGames, today],
  );

  // filtre catégorie appliqué aux à-venir
  const filteredUpcoming = useMemo(() => {
    return upcomingGames.filter((m) => m.categorie === catFilter);
  }, [upcomingGames, catFilter]);

  // Compteurs pour sous-onglets
  const catCounts = useMemo(() => {
    const base = { Seniors: 0, "15U": 0, "12U": 0 } as Record<
      "Seniors" | "15U" | "12U",
      number
    >;
    upcomingGames.forEach((m) => {
      const c = (m.categorie ?? "") as "Seniors" | "15U" | "12U" | "";
      if (c === "Seniors" || c === "15U" || c === "12U") base[c] += 1;
    });
    return base;
  }, [upcomingGames]);

  const upcomingList = useMemo(
    () => groupUpcomingByMonth(filteredUpcoming),
    [filteredUpcoming],
  );
  const playedList = useMemo(() => groupPlayedByMonth(playedGames), [playedGames]);
  const dataToShow = selectedTab === "played" ? playedList : upcomingList;

  // Native calendar
  async function addMatchToCalendar(match: PlannedGame) {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission requise", "Autorisez l’accès au calendrier.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      const defaultCal = calendars.find((cal) => cal.allowsModifications);
      if (!defaultCal) {
        Alert.alert("Erreur", "Aucun calendrier modifiable trouvé.");
        return;
      }
      const baseDate = new Date(match.date);
      baseDate.setHours(11, 0, 0, 0);
      const endDate = new Date(baseDate.getTime() + 6 * 60 * 60 * 1000);
      await Calendar.createEventAsync(defaultCal.id, {
        title: `Match ${match.categorie ? `[${match.categorie}] ` : ""}Comets vs ${match.opponent}`,
        startDate: baseDate,
        endDate,
        location: match.is_home
          ? "Stade de Honfleur"
          : `Déplacement - ${match.opponent}`,
        notes: match.note || "",
        alarms: [{ relativeOffset: -60 }],
        timeZone: "Europe/Paris",
      });
      Alert.alert("Ajouté !", "Le match a été ajouté dans votre calendrier.");
    } catch (e: any) {
      Alert.alert("Erreur calendrier", e?.message || "Erreur inconnue.");
    }
  }

  // Participate
  async function handleParticipate(match: PlannedGame) {
    if (!admin?.id) {
      Alert.alert("Connexion requise", "Connecte-toi pour participer.");
      return;
    }
    const catOk =
      !match.categorie ||
      (elig.category !== null && match.categorie === elig.category);
    if (elig.eligible !== true || !catOk) {
      if (!catOk)
        Alert.alert(
          "Catégorie non autorisée",
          `Ce match est ${match.categorie ?? "?"} — ton profil est ${elig.category ?? "?"}.`,
        );
      else
        Alert.alert(
          "Profil joueur requis",
          "Ton profil (admins) doit correspondre à un joueur dans players ou young_players (prénom/nom).",
        );
      return;
    }
    const mid = String(match.id);
    if (joined[mid]) return;

    setPosting((p) => ({ ...p, [mid]: true }));
    try {
      const res = await apiPost<ParticipatePOST>(
        `/api/matches/${mid}/participate`,
        { adminId: admin.id },
      );
      setJoined((j) => {
        const upd = { ...j, [mid]: true };
        writeJoinedToStorage(admin.id, upd);
        return upd;
      });
      setDeclined((d) => {
        const upd = { ...d };
        delete upd[mid];
        return upd;
      });
      // incrémente le compteur local
      setCounts((c) => ({ ...c, [mid]: (c[mid] ?? 0) + 1 }));

      if (setAdmin && typeof res?.participations === "number") {
        setAdmin((prev: any) =>
          prev ? { ...prev, participations: res.participations } : prev,
        );
      }
      const b = computeBadgeFromCount(res.participations);
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
  // Unparticipate / mark as not participating
  async function handleUnparticipate(match: PlannedGame) {
    if (!admin?.id) {
      Alert.alert("Connexion requise", "Connecte-toi pour te desinscrire.");
      return;
    }

    const mid = String(match.id);
    const wasJoined = !!joined[mid];
    const wasDeclined = !!declined[mid];
    if (wasDeclined) return;

    const submit = async () => {
      setPosting((p) => ({ ...p, [mid]: true }));
      try {
        await apiPost<{ ok: boolean }>(`/api/matches/${mid}/unparticipate`, {
          adminId: admin.id,
        });
        setJoined((j) => {
          const upd = { ...j };
          delete upd[mid];
          writeJoinedToStorage(admin.id, upd);
          return upd;
        });
        setDeclined((d) => ({ ...d, [mid]: true }));
        setCounts((c) => ({
          ...c,
          [mid]: wasJoined ? Math.max(0, (c[mid] ?? 1) - 1) : c[mid] ?? 0,
        }));
      } catch (e: any) {
        Alert.alert("Oups", e?.message ?? "Impossible de mettre a jour ta reponse");
      } finally {
        setPosting((p) => ({ ...p, [mid]: false }));
      }
    };

    if (wasJoined) {
      Alert.alert("Me desinscrire", "Tu te desinscris de ce match ?", [
        { text: "Annuler", style: "cancel" },
        {
          text: "Oui",
          style: "destructive",
          onPress: submit,
        },
      ]);
      return;
    }

    await submit();
  }

  function getOpponentLogo(opponent: string): any {
    return LOGO_MAP[opponent] || LOGO_MAP[normalizeName(opponent)] || null;
  }

  const openUpcomingDetail = useCallback(
    (item: PlannedGame) => {
      const href = `/match-detail?kind=upcoming&matchId=${encodeURIComponent(String(item.id))}`;
      router.push(href as any);
    },
    [router],
  );

  const openPlayedDetail = useCallback(
    (game: Game) => {
      const href = `/match-detail?kind=played&matchId=${encodeURIComponent(String(game.id))}`;
      router.push(href as any);
    },
    [router],
  );

  // ================== UI Components ==================
  const UpcomingCard = ({ item }: { item: PlannedGame }) => {
    const mid = String(item.id);
    const isJoined = !!joined[mid];
    const isDeclined = !!declined[mid];
    const isPosting = !!posting[mid];
    const opponentLogo = getOpponentLogo(item.opponent);

    const catOk =
      !item.categorie ||
      (elig.category !== null && item.categorie === elig.category);
    const canRespond = elig.eligible === true && catOk;
    const showParticipationControls = !!admin?.id && canRespond;
    const joinDisabled = isJoined || isPosting || !canRespond;
    const leaveDisabled = isDeclined || isPosting || !canRespond;
    const count = counts[mid] ?? 0;
    const stateLabel = isJoined
      ? "Participe"
      : isDeclined
        ? "Ne participe pas"
        : "En attente";
    const joinOpacity = joinDisabled ? (isJoined ? 0.45 : 0.7) : 1;
    const declineOpacity = leaveDisabled ? (isDeclined ? 0.45 : 0.7) : 1;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.96}
        onPress={() => openUpcomingDetail(item)}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.matchBadgeUpcoming}>À venir</Text>
          <Text style={styles.matchDate} numberOfLines={2}>
            {formatDateFr(item.date)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.detailBtn}
          activeOpacity={0.85}
          onPress={() => openUpcomingDetail(item)}
        >
          <Icon name="eye-outline" size={14} color="#CBD5E1" />
          <Text style={styles.detailBtnTxt}>Voir le détail</Text>
          <Icon name="chevron-forward" size={14} color="#94A3B8" />
        </TouchableOpacity>

        {showParticipationControls && (
          <View style={styles.cardTopMetaRow}>
            <View style={styles.countPill}>
              <Icon name="people-outline" size={14} color={COLORS.slateDark} />
              <Text style={styles.countPillTxt}>
                {count} inscrit{count > 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.statePill}>
              <Text style={styles.statePillTxt}>{stateLabel}</Text>
            </View>
          </View>
        )}

        <View style={styles.venueRow}>
          <Icon
            name={item.is_home ? "home" : "airplane-outline"}
            size={18}
            color={item.is_home ? COLORS.orange : COLORS.blue}
          />
          <Text style={styles.venueTxt}>
            {item.is_home ? "À domicile" : "Extérieur"}
          </Text>
        </View>

        {/* VS */}
        <View style={styles.vsRow}>
          {/* LEFT (home) */}
          <View style={styles.teamCol}>
            {item.is_home ? (
              <>
                <RNImage
                  source={LOGO_MAP["Honfleur"]}
                  style={styles.logoTeam}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                <Text style={[styles.teamName, { color: COLORS.orange }]}>
                  Honfleur
                </Text>
              </>
            ) : (
              <>
                {opponentLogo ? (
                  <RNImage
                    source={opponentLogo}
                    style={styles.logoTeam}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                ) : (
                  <View style={[styles.logoTeam]} />
                )}
                <Text
                  style={[styles.teamName, { color: COLORS.blue }]}
                  numberOfLines={1}
                >
                  {item.opponent}
                </Text>
              </>
            )}
          </View>

          <Text style={styles.vs}>VS</Text>

          {/* RIGHT (away) */}
          <View style={styles.teamCol}>
            {item.is_home ? (
              <>
                {opponentLogo ? (
                  <RNImage
                    source={opponentLogo}
                    style={styles.logoTeam}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                ) : (
                  <View style={[styles.logoTeam]} />
                )}
                <Text
                  style={[styles.teamName, { color: COLORS.blue }]}
                  numberOfLines={1}
                >
                  {item.opponent}
                </Text>
              </>
            ) : (
              <>
                <RNImage
                  source={LOGO_MAP["Honfleur"]}
                  style={styles.logoTeam}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                <Text style={[styles.teamName, { color: COLORS.orange }]}>
                  Honfleur
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Catégorie + Note */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {!!item.categorie && (
            <Text
              style={{
                color: COLORS.text,
                backgroundColor: COLORS.card,
                borderColor: COLORS.orangeSoftBorder,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                fontWeight: "900",
                fontSize: 12.5,
              }}
            >
              {item.categorie}
            </Text>
          )}
          {!!item.note && (
            <Text
              style={{
                color: COLORS.orange,
                fontWeight: "bold",
                fontSize: 12.5,
              }}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.calBtn}
          activeOpacity={0.88}
          onPress={() =>
            Alert.alert(
              "Ajouter au calendrier",
              "Ajouter ce match à votre calendrier ?",
              [
                { text: "Annuler", style: "cancel" },
                { text: "Oui", onPress: () => addMatchToCalendar(item) },
              ],
            )
          }
        >
          <Icon
            name="calendar-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.calBtnTxt}>Ajouter au calendrier</Text>
        </TouchableOpacity>
        {showParticipationControls && (
          <>
            {/* Boutons participation / non participation */}
            <TouchableOpacity
              disabled={joinDisabled}
              accessibilityState={{ disabled: joinDisabled }}
              onPress={() => handleParticipate(item)}
              style={[
                styles.joinBtn,
                isJoined ? styles.actionBtnCurrent : null,
                {
                  opacity: joinOpacity,
                  marginTop: 10,
                },
              ]}
              activeOpacity={0.9}
            >
              <Icon
                name="baseball-outline"
                size={18}
                color={isJoined ? COLORS.textMuted : "#fff"}
                style={{ marginRight: 7 }}
              />
              <Text style={[styles.joinBtnTxt, isJoined ? styles.actionBtnCurrentTxt : null]}>
                {isPosting ? "Inscription..." : "Je participe"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleUnparticipate(item)}
              disabled={leaveDisabled}
              style={[
                styles.unsubscribeBtn,
                isDeclined ? styles.actionBtnCurrent : null,
                { opacity: declineOpacity },
              ]}
              activeOpacity={0.9}
            >
              <Icon
                name="close-circle-outline"
                size={18}
                color={isDeclined ? COLORS.textMuted : "#fff"}
                style={{ marginRight: 7 }}
              />
              <Text style={[styles.joinBtnTxt, isDeclined ? styles.actionBtnCurrentTxt : null]}>
                {isPosting ? "Mise a jour..." : "Je ne participe pas"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const PlayedCard = ({ g }: { g: Game }) => {
    const teamAbbr = g.team_abbr || "HON";
    const homeTeam = g.is_home ? teamAbbr : g.opponent_abbr;
    const awayTeam = g.is_home ? g.opponent_abbr : teamAbbr;

    const leftName = TEAM_NAMES[homeTeam] || homeTeam;
    const rightName = TEAM_NAMES[awayTeam] || awayTeam;

    const homeIsHonfleur = leftName === "Honfleur";
    const leftLogo = homeIsHonfleur
      ? LOGO_MAP["Honfleur"]
      : getOpponentLogo(leftName);
    const rightLogo = !homeIsHonfleur
      ? LOGO_MAP["Honfleur"]
      : getOpponentLogo(rightName);

    const leftScore = g.is_home
      ? (g.team_score ?? "--")
      : (g.opponent_score ?? "--");
    const rightScore = g.is_home
      ? (g.opponent_score ?? "--")
      : (g.team_score ?? "--");

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.96}
        onPress={() => openPlayedDetail(g)}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.matchBadgePlayed}>Match #{g.game_number}</Text>
          <Text style={styles.matchDate} numberOfLines={2}>
            {formatDateFr(g.date)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.detailBtn}
          activeOpacity={0.85}
          onPress={() => openPlayedDetail(g)}
        >
          <Icon name="eye-outline" size={14} color="#CBD5E1" />
          <Text style={styles.detailBtnTxt}>Voir le détail</Text>
          <Icon name="chevron-forward" size={14} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.venueRow}>
          <Icon
            name={g.is_home ? "home" : "airplane-outline"}
            size={18}
            color={g.is_home ? COLORS.orange : COLORS.blue}
          />
          <Text style={styles.venueTxt}>
            {g.is_home ? "À domicile" : "Extérieur"}
          </Text>
        </View>

        <View style={styles.scoresRow}>
          <View style={styles.teamScoreCol}>
            {leftLogo && (
              <RNImage
                source={leftLogo}
                style={styles.logoTeam}
                resizeMode="cover"
                fadeDuration={0}
              />
            )}
            <Text
              style={[
                styles.teamName,
                { color: homeIsHonfleur ? COLORS.orange : COLORS.blue },
              ]}
              numberOfLines={1}
            >
              {leftName}
            </Text>
            <Text style={styles.scoreTxt}>{leftScore}</Text>
          </View>

          <Text style={styles.vsDash}>—</Text>

          <View style={styles.teamScoreCol}>
            {rightLogo && (
              <RNImage
                source={rightLogo}
                style={styles.logoTeam}
                resizeMode="cover"
                fadeDuration={0}
              />
            )}
            <Text
              style={[
                styles.teamName,
                { color: !homeIsHonfleur ? COLORS.orange : COLORS.blue },
              ]}
              numberOfLines={1}
            >
              {rightName}
            </Text>
            <Text style={styles.scoreTxt}>{rightScore}</Text>
          </View>
        </View>

        <View style={styles.resultRow}>
          <View
            style={[
              styles.resultBadge,
              { backgroundColor: resultColor(g.result) },
            ]}
          >
            <Text style={styles.resultBadgeTxt}>{resultLabel(g.result)}</Text>
          </View>
          {!!g.boxscore_link && (
            <TouchableOpacity
              style={styles.boxscoreBtn}
              onPress={() => Linking.openURL(g.boxscore_link)}
              activeOpacity={0.9}
            >
              <Text style={styles.boxscoreBtnTxt}>Boxscore FFBS</Text>
              <Icon
                name="open-outline"
                size={18}
                color="#fff"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const isLoadingList =
    (selectedTab === "played" && loading) ||
    (selectedTab === "upcoming" && loadingPlanned);
  const totalUpcoming = upcomingGames.length;
  const totalPlayed = playedGames.length;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            {
              paddingTop:
                Platform.OS === "android"
                  ? Math.max(StatusBar.currentHeight || 0, insets.top) + 6
                  : insets.top + 2,
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
              <Text style={styles.heroTitle}>Calendrier des matchs</Text>
              <Text style={styles.heroSub}>Saison {new Date().getFullYear()}</Text>
            </View>

            <LogoutButton />
          </View>

          <View style={styles.heroMetaCompactRow}>
            <Text style={styles.heroMetaText}>
              {totalUpcoming} à venir | {totalPlayed} joués
            </Text>
            <View style={styles.heroPill}>
              <Icon
                name={selectedTab === "upcoming" ? "calendar-outline" : "trophy-outline"}
                size={13}
                color="#FFDDBA"
              />
              <Text style={styles.heroPillText}>
                {selectedTab === "upcoming" ? catFilter : "Resultats"}
              </Text>
            </View>
          </View>

          <View style={styles.tabs}>
            {TOP_TABS.map((tab) => {
              const active = selectedTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => {
                    setSelectedTab(tab.key);
                    flatListRef.current?.scrollToOffset({
                      offset: 0,
                      animated: true,
                    });
                  }}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  activeOpacity={0.9}
                >
                  <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                    <Icon
                      name={tab.icon}
                      size={14}
                      color={active ? "#111827" : COLORS.orange}
                    />
                  </View>
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedTab === "upcoming" && (
            <View style={styles.catRow}>
              {CATEGORY_FILTERS.map((f) => {
                const active = catFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => {
                      setCatFilter(f);
                      flatListRef.current?.scrollToOffset({
                        offset: 0,
                        animated: true,
                      });
                    }}
                    style={[styles.catBtn, active && styles.catBtnActive]}
                    activeOpacity={0.9}
                  >
                    <Icon
                      name={CATEGORY_META[f].icon}
                      size={14}
                      color={active ? "#111827" : CATEGORY_META[f].tone}
                    />
                    <Text style={[styles.catBtnText, active && styles.catBtnTextActive]}>
                      {f} ({catCounts[f]})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </LinearGradient>
      </View>

      {/* LISTE */}
      <View style={styles.listWrap}>
        {isLoadingList ? (
          <View style={styles.loaderBox}>
            <Text style={styles.loaderTxt}>Chargement...</Text>
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
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyTxt}>
                  {selectedTab === "upcoming"
                    ? `Aucun match en ${catFilter} à venir.`
                    : "Aucun match joué a afficher."}
                </Text>
              }
              renderItem={({ item }) => {
                if (item.type === "month") {
                  return (
                    <View style={styles.monthHeaderRow}>
                      <View style={styles.monthHeaderLine} />
                      <Text style={styles.monthHeaderText}>{item.label}</Text>
                      <View style={styles.monthHeaderLine} />
                    </View>
                  );
                }
                if (item.type === "upcoming") return <UpcomingCard item={item.match} />;
                return <PlayedCard g={item.game} />;
              }}
              onScroll={(e) =>
                setShowScrollTop(e.nativeEvent.contentOffset.y > 240)
              }
              scrollEventThrottle={16}
              initialNumToRender={8}
              maxToRenderPerBatch={10}
              windowSize={7}
              updateCellsBatchingPeriod={30}
              removeClippedSubviews={Platform.OS === "android"}
            />
            {showScrollTop && (
              <TouchableOpacity
                style={styles.scrollTopBtn}
                onPress={() =>
                  flatListRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                  })
                }
                activeOpacity={0.8}
              >
                <Icon name="chevron-up" size={28} color={COLORS.orange} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* TOAST */}
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
  safe: {
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
    bottom: "58%",
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
  heroMetaCompactRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroMetaText: {
    flexShrink: 1,
    color: "#CBD2DF",
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
  tabs: {
    flexDirection: "row",
    marginTop: 8,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  tabBtnActive: {
    backgroundColor: "#FF8200",
    borderColor: "#FFB366",
  },
  tabIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,130,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.62)",
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
  catRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
  },
  catBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.26)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  catBtnActive: {
    backgroundColor: "#FF9E3A",
    borderColor: "#FFBD80",
  },
  catBtnText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 11.5,
  },
  catBtnTextActive: {
    color: "#111827",
    fontWeight: "800",
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  monthHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  monthHeaderText: {
    color: "#FFD4A2",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: COLORS.orange, fontWeight: "bold", fontSize: 18 },
  errorTxt: {
    color: "tomato",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  emptyTxt: {
    color: "#9aa0ae",
    fontSize: 15,
    textAlign: "center",
    marginTop: 40,
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTopMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  matchBadgeUpcoming: {
    color: "#DBEAFE",
    backgroundColor: "rgba(59,130,246,0.24)",
    borderColor: "rgba(147,197,253,0.56)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: "900",
    fontSize: 12,
  },
  matchBadgePlayed: {
    color: "#FFE2C2",
    backgroundColor: "rgba(255,130,0,0.24)",
    borderColor: "rgba(255,195,130,0.62)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: "900",
    fontSize: 12,
  },
  matchDate: {
    color: "#d5d8df",
    fontWeight: "700",
    fontSize: 13.5,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "62%",
    textAlign: "right",
  },
  detailBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  detailBtnTxt: {
    color: "#CBD5E1",
    fontSize: 11.5,
    fontWeight: "800",
  },

  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  venueTxt: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },

  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  teamCol: { flex: 1, alignItems: "center", minWidth: 0 },
  teamName: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14.5,
    marginTop: 6,
  },
  logoTeam: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: COLORS.orange,
  },
  vs: {
    color: COLORS.orange,
    backgroundColor: "rgba(255,130,0,0.16)",
    borderColor: "rgba(255,130,0,0.45)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontWeight: "900",
    fontSize: 12.5,
    letterSpacing: 0.3,
    marginHorizontal: 6,
  },

  scoresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
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
  vsDash: {
    color: COLORS.orange,
    fontWeight: "900",
    fontSize: 20,
    marginHorizontal: 10,
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  resultBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  resultBadgeTxt: {
    color: "#fff",
    fontWeight: "900",
    letterSpacing: 0.6,
    fontSize: 13.5,
  },

  boxscoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  boxscoreBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  calBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    paddingVertical: 10,
  },
  calBtnTxt: { color: "#E5E7EB", fontWeight: "800", fontSize: 13.5 },

  joinBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 10,
  },
  joinBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14 },

  unsubscribeBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnCurrent: {
    backgroundColor: "rgba(148,163,184,0.14)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  actionBtnCurrentTxt: {
    color: "#cbd5e1",
  },

  disabledInfo: {
    color: "#9aa0ae",
    fontWeight: "700",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 6,
  },

  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 25,
    backgroundColor: "#101827EE",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.orange,
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#FF9E3A",
  },

  // Compteur d'inscrits (pill visible) — moins flashy
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.amberPillBg,
    borderColor: COLORS.amberPillBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countPillTxt: {
    color: COLORS.slateDark,
    fontWeight: "900",
    fontSize: 12.5,
  },
  statePill: {
    borderWidth: 1,
    borderColor: "#4b5563",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statePillTxt: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 11.5,
  },

  // Bannière d’info — bleu doux
  infoBanner: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: COLORS.infoBg,
    borderColor: COLORS.infoBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  infoBannerTxt: {
    flex: 1,
    color: COLORS.slateDark,
    fontWeight: "800",
    fontSize: 12.5,
    lineHeight: 18,
  },
});

