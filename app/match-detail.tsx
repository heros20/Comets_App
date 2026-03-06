"use client";

import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Calendar from "expo-calendar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Linking,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { supabase } from "../supabase";
import { useAdmin } from "../contexts/AdminContext";

const SITE_URL = "https://les-comets-honfleur.vercel.app";
const PRIMARY_API =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? "http://10.0.2.2:3000" : SITE_URL);
const FALLBACK_API = SITE_URL;
const PARTICIPANTS_PATH = "/api/admin/match/participants";
const TEAM_NAMES: Record<string, string> = {
  HON: "Honfleur",
  LHA: "Le Havre",
  ROU: "Rouen",
  CAE: "Caen",
  CHE: "Cherbourg",
  WAL: "Louviers",
  AND: "Les Andelys",
  STL: "Saint-Lô",
};

const TEAM_ALIASES: Record<string, string> = {
  hon: "Honfleur",
  honfleur: "Honfleur",
  lha: "Le Havre",
  havre: "Le Havre",
  "le havre": "Le Havre",
  sailors: "Le Havre",
  rou: "Rouen",
  rouen: "Rouen",
  dragons: "Rouen",
  cae: "Caen",
  caen: "Caen",
  phenix: "Caen",
  che: "Cherbourg",
  cherbourg: "Cherbourg",
  seagulls: "Cherbourg",
  wal: "Louviers",
  louviers: "Louviers",
  wallabies: "Louviers",
  and: "Les Andelys",
  andelys: "Les Andelys",
  "les andelys": "Les Andelys",
  stl: "Saint-Lô",
  "saint lo": "Saint-Lô",
  "saint-lo": "Saint-Lô",
  "saint lô": "Saint-Lô",
  "saint-lô": "Saint-Lô",
  jimmers: "Saint-Lô",
};

const LOGO_MAP: Record<string, any> = {
  Caen: require("../assets/images/Caen.png"),
  Cherbourg: require("../assets/images/Cherbourg.jpg"),
  "Les Andelys": require("../assets/images/les_Andelys.png"),
  Andelys: require("../assets/images/les_Andelys.png"),
  Louviers: require("../assets/images/Louviers.png"),
  "Le Havre": require("../assets/images/Le_Havre.png"),
  Rouen: require("../assets/images/Rouen.jpg"),
  Honfleur: require("../assets/images/Honfleur.png"),
  "Saint-Lô": require("../assets/images/Saint-Lo.jpg"),
  "Saint-Lo": require("../assets/images/Saint-Lo.jpg"),
};

type MatchKind = "upcoming" | "played";
type PlannedGame = {
  id: number | string;
  date: string;
  opponent: string;
  logo?: string | null;
  is_home: boolean;
  note?: string | null;
  categorie?: "Seniors" | "15U" | "12U";
};
type PlayedGame = {
  id: number;
  game_number: number;
  date: string;
  is_home: boolean;
  opponent_abbr: string;
  team_abbr?: string;
  opponent_logo?: string | null;
  team_score: number | null;
  opponent_score: number | null;
  result: string;
  boxscore_link?: string | null;
  note?: string | null;
};
type ParticipantRow = { admin_id: string | number | null };
type AdminRow = {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};
type Participant = { id: string; name: string };
type ParticipantApiPerson = {
  id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
};
type ParticipantApiItem = {
  match_id: string | number;
  count?: number | null;
  participants?: ParticipantApiPerson[] | null;
};
type ParticipantApiResponse = {
  items?: ParticipantApiItem[] | null;
};
type VenueInfo = { label: string; address: string };

const VENUE_MAP: Record<string, VenueInfo> = {
  Honfleur: {
    label: "Stade d'Honfleur",
    address: "Avenue de la brigade Piron, 14600 Honfleur",
  },
  Rouen: {
    label: "Stade de Rouen",
    address: "37 rue Verdi, 76000 Rouen",
  },
  Caen: {
    label: "Stade de Caen",
    address: "26 rue Henri de Montherlant, 14123 Ifs",
  },
  Louviers: {
    label: "Stade de Louviers",
    address: "Mairie de Louviers CS 10621 2, 27406 Louviers Cedex",
  },
  "Le Havre": {
    label: "Stade du Havre",
    address: "19 rue Hélène Boucher, 76600 Le Havre",
  },
  "Les Andelys": {
    label: "Stade des Andelys",
    address: "Allée du Roi de Rome, 27700 Les Andelys",
  },
  "Saint-Lo": {
    label: "Stade de Saint-Lô",
    address: "Rue des Ronchettes, 50000 Saint-Lô",
  },
  Cherbourg: {
    label: "Stade de Cherbourg",
    address: "Place de la République, 50100 Cherbourg",
  },
};

function normalizeName(name: string) {
  return name.replace(/^Les\s+/i, "").trim();
}

function normalizeTeamKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveTeamName(name?: string | null) {
  if (!name) return null;

  const raw = String(name).trim();
  if (!raw) return null;

  const byAbbr = TEAM_NAMES[raw.toUpperCase()];
  if (byAbbr) return byAbbr;

  const normalized = normalizeTeamKey(raw);
  const exactAlias = TEAM_ALIASES[normalized];
  if (exactAlias) return exactAlias;

  const partialAlias = Object.entries(TEAM_ALIASES).find(
    ([alias]) => alias.length > 3 && normalized.includes(alias),
  );
  if (partialAlias) return partialAlias[1];

  return raw;
}

function getTeamLogo(name: string) {
  const resolvedName = resolveTeamName(name) ?? name;
  return LOGO_MAP[resolvedName] || LOGO_MAP[normalizeName(resolvedName)] || null;
}
function getVenueInfo(name?: string | null) {
  const resolvedName = resolveTeamName(name);
  if (!resolvedName) return null;
  if (resolvedName === "Saint-Lô") return VENUE_MAP["Saint-Lo"] || null;
  return VENUE_MAP[resolvedName] || null;
}
function getGoogleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(init ?? {}), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
function getApiCandidates(path: string) {
  return Array.from(
    new Set(
      [PRIMARY_API, FALLBACK_API]
        .map((base) => String(base ?? "").trim())
        .filter((base) => !!base),
    ),
  ).map((base) => `${base}${path}`);
}
function parseDateValue(dateValue: string): Date | null {
  if (!dateValue) return null;
  const frMatch = dateValue.match(/^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/);
  if (frMatch) {
    const [, ddRaw, mmRaw, yyyyRaw] = frMatch;
    const dd = Number(ddRaw);
    const mm = Number(mmRaw);
    const yyyy = Number(yyyyRaw);
    const parsed = new Date(yyyy, mm - 1, dd);
    if (
      parsed.getFullYear() === yyyy &&
      parsed.getMonth() === mm - 1 &&
      parsed.getDate() === dd
    ) {
      return parsed;
    }
    return null;
  }
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatDateLong(dateValue?: string | null) {
  if (!dateValue) return "Date inconnue";
  const parsed = parseDateValue(dateValue);
  if (!parsed) return dateValue;
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
function formatResultLabel(result?: string | null) {
  if (!result) return "Résultat non renseigné";
  if (result === "W") return "Victoire";
  if (result === "L") return "Défaite";
  if (result === "T") return "Égalité";
  return String(result);
}

export default function MatchDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { admin } = useAdmin();
  const adminSessionToken = useMemo(() => {
    if (typeof admin?.session_token !== "string") return "";
    return admin.session_token.trim();
  }, [admin?.session_token]);

  const params = useLocalSearchParams<{ matchId?: string | string[]; kind?: string | string[] }>();
  const rawMatchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const matchId = rawMatchId ? String(rawMatchId) : "";
  const kind: MatchKind = rawKind === "played" ? "played" : "upcoming";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<PlannedGame | null>(null);
  const [played, setPlayed] = useState<PlayedGame | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/matchs");
  }, [router]);

  useEffect(() => {
    if (!matchId) {
      setErrorMsg("Aucun match sélectionné.");
      setLoading(false);
      return;
    }

    let mounted = true;
    const mid = String(matchId);

    const loadParticipantsFromApi = async (): Promise<"full" | "count_only" | "none"> => {
      if (!adminSessionToken) return "none";

      const urls = getApiCandidates(PARTICIPANTS_PATH);
      for (const url of urls) {
        try {
          const res = await fetchWithTimeout(url, {
            method: "GET",
            credentials: "include",
            headers: {
              "x-admin-session": adminSessionToken,
              Authorization: `Bearer ${adminSessionToken}`,
            },
          });

          if (res.status === 401 || res.status === 403) {
            continue;
          }
          if (!res.ok) {
            continue;
          }

          const json = (await res.json().catch(() => null)) as ParticipantApiResponse | null;
          if (!json || !Array.isArray(json.items)) {
            continue;
          }

          const item = json.items.find((entry) => String(entry.match_id) === mid);
          if (!item) {
            continue;
          }

          const names = (Array.isArray(item.participants) ? item.participants : [])
            .map((person, idx) => {
              const id = String(person?.id ?? `participant-${idx}`);
              const fullName = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim();
              return {
                id,
                name: fullName || "Participant",
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name, "fr"));

          if (!mounted) return "none";

          const countRaw = Number(item.count ?? names.length);
          const count = Number.isFinite(countRaw) ? countRaw : names.length;
          setParticipantCount(count);
          setParticipants(names);

          if (count > 0 && names.length === 0) {
            return "count_only";
          }

          return "full";
        } catch {}
      }

      return "none";
    };

    const loadParticipantsFromSupabase = async (opts?: { keepExistingOnFail?: boolean }) => {
      try {
        const { data, error } = await supabase
          .from("match_participations")
          .select("admin_id")
          .eq("match_id", mid);

        if (error || !Array.isArray(data)) {
          if (mounted && !opts?.keepExistingOnFail) {
            setParticipantCount(0);
            setParticipants([]);
          }
          return false;
        }

        const ids = Array.from(
          new Set(
            (data as ParticipantRow[])
              .map((row) => String(row.admin_id ?? "").trim())
              .filter((id) => !!id),
          ),
        );

        if (!mounted) return;
        setParticipantCount(ids.length);

        if (!ids.length) {
          setParticipants([]);
          return true;
        }

        const { data: admins, error: adminsError } = await supabase
          .from("admins")
          .select("id,first_name,last_name,email")
          .in("id", ids);

        if (adminsError || !Array.isArray(admins)) {
          setParticipants(
            ids.map((id, idx) => ({
              id,
              name: `Participant ${idx + 1}`,
            })),
          );
          return true;
        }

        const byId = new Map(
          (admins as AdminRow[]).map((a) => [String(a.id), a]),
        );

        const names = ids
          .map((id) => {
            const a = byId.get(id);
            if (!a) return { id, name: "Participant" };
            const full = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
            return {
              id,
              name: full || a.email?.trim() || "Participant",
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));

        setParticipants(names);
        return true;
      } catch {
        if (!mounted) return;
        if (!opts?.keepExistingOnFail) {
          setParticipantCount(0);
          setParticipants([]);
        }
        return false;
      }
    };

    const loadParticipants = async () => {
      const apiStatus = await loadParticipantsFromApi();
      if (apiStatus === "full") return;
      await loadParticipantsFromSupabase({ keepExistingOnFail: apiStatus === "count_only" });
    };

    const loadMatch = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        setParticipantCount(0);
        setParticipants([]);

        if (kind === "played") {
          const { data, error } = await supabase
            .from("games")
            .select("*")
            .eq("id", mid)
            .maybeSingle();
          if (error || !data) throw new Error("Match joué introuvable");
          if (!mounted) return;
          setPlayed(data as PlayedGame);
        } else {
          const { data, error } = await supabase
            .from("matches_planned")
            .select("*")
            .eq("id", mid)
            .maybeSingle();
          if (error || !data) throw new Error("Match à venir introuvable");
          if (!mounted) return;
          setUpcoming(data as PlannedGame);
        }

        if (mounted) setLoading(false);
        loadParticipants().catch(() => {});
      } catch {
        if (!mounted) return;
        setErrorMsg("Impossible de charger les details du match.");
        if (mounted) setLoading(false);
      }
    };

    loadMatch();
    return () => {
      mounted = false;
    };
  }, [adminSessionToken, kind, matchId]);

  const isUpcoming = kind === "upcoming";

  const opponentName = useMemo(() => {
    const rawOpponent = isUpcoming ? upcoming?.opponent : played?.opponent_abbr;
    return resolveTeamName(rawOpponent) || rawOpponent || "Adversaire";
  }, [isUpcoming, played?.opponent_abbr, upcoming?.opponent]);

  const homeName = useMemo(() => {
    if (isUpcoming) return upcoming?.is_home ? "Honfleur" : opponentName;
    const teamAbbr = played?.team_abbr || "HON";
    const homeAbbr = played?.is_home ? teamAbbr : played?.opponent_abbr || "";
    return resolveTeamName(homeAbbr) || homeAbbr || "Domicile";
  }, [isUpcoming, opponentName, played?.is_home, played?.opponent_abbr, played?.team_abbr, upcoming?.is_home]);

  const awayName = useMemo(() => {
    if (isUpcoming) return upcoming?.is_home ? opponentName : "Honfleur";
    const teamAbbr = played?.team_abbr || "HON";
    const awayAbbr = played?.is_home ? played?.opponent_abbr || "" : teamAbbr;
    return resolveTeamName(awayAbbr) || awayAbbr || "Extérieur";
  }, [isUpcoming, opponentName, played?.is_home, played?.opponent_abbr, played?.team_abbr, upcoming?.is_home]);

  const homeScore = !isUpcoming
    ? played?.is_home
      ? played?.team_score ?? "-"
      : played?.opponent_score ?? "-"
    : null;
  const awayScore = !isUpcoming
    ? played?.is_home
      ? played?.opponent_score ?? "-"
      : played?.team_score ?? "-"
    : null;

  const opponentRemoteLogo =
    isUpcoming && upcoming?.logo && /^https?:\/\//i.test(upcoming.logo)
      ? { uri: upcoming.logo }
      : null;

  const homeLogo =
    homeName === "Honfleur"
      ? LOGO_MAP.Honfleur
      : isUpcoming && homeName === opponentName && opponentRemoteLogo
        ? opponentRemoteLogo
        : getTeamLogo(homeName);
  const awayLogo =
    awayName === "Honfleur"
      ? LOGO_MAP.Honfleur
      : isUpcoming && awayName === opponentName && opponentRemoteLogo
        ? opponentRemoteLogo
        : getTeamLogo(awayName);
  const venueTeam = isUpcoming
    ? upcoming?.is_home
      ? "Honfleur"
      : opponentName
    : played?.is_home
      ? "Honfleur"
      : opponentName;
  const venueInfo = getVenueInfo(venueTeam);
  const venueMapsUrl = venueInfo ? getGoogleMapsUrl(venueInfo.address) : null;

  const dateValue = isUpcoming ? upcoming?.date : played?.date;
  const venueLabel = isUpcoming
    ? upcoming?.is_home
      ? "À domicile"
      : "Extérieur"
    : played?.is_home
      ? "À domicile"
      : "Extérieur";
  const category = isUpcoming ? upcoming?.categorie || "Non précisée" : "Match joué";
  const note = isUpcoming ? upcoming?.note || "" : played?.note || "";
  const resultLabel = !isUpcoming ? formatResultLabel(played?.result) : null;
  const resultBadgeColor =
    played?.result === "W" ? "#16A34A" : played?.result === "L" ? "#B91C1C" : "#334155";

  const shareTitle = `Match Comets vs ${opponentName}`;
  const shareUrl = `${SITE_URL}/calendrier/match-detail?kind=${encodeURIComponent(kind)}&matchId=${encodeURIComponent(matchId)}&src=mobile-app`;
  const shareAddress = venueInfo ? `${venueInfo.label}, ${venueInfo.address}` : "Adresse a confirmer";
  const shareText = `${shareTitle}
${formatDateLong(dateValue || "")}
${venueLabel}
Adresse : ${shareAddress}
Catégorie : ${category}
Participants: ${participantCount}`;
  const shareMessageWithUrl = `${shareText}\n${shareUrl}`;

  const openUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {}
  }, []);

  const openNativeShare = useCallback(async () => {
    try {
      await Share.share({
        title: shareTitle,
        message: shareMessageWithUrl,
      });
    } catch {}
  }, [shareMessageWithUrl, shareTitle]);

  const addMatchToCalendar = useCallback(async (match: PlannedGame) => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission requise", "Autorisez l'accès au calendrier.");
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find((cal) => cal.allowsModifications);
      if (!defaultCal) {
        Alert.alert("Erreur", "Aucun calendrier modifiable trouve.");
        return;
      }

      const resolvedOpponent = resolveTeamName(match.opponent) || match.opponent;
      const venueTeam = match.is_home ? "Honfleur" : resolvedOpponent;
      const venueInfo = getVenueInfo(venueTeam);
      const baseDate = parseDateValue(match.date) ?? new Date(match.date);
      baseDate.setHours(11, 0, 0, 0);
      const endDate = new Date(baseDate.getTime() + 6 * 60 * 60 * 1000);

      const eventId = await Calendar.createEventAsync(defaultCal.id, {
        title: `Match ${match.categorie ? `[${match.categorie}] ` : ""}Comets vs ${resolvedOpponent}`,
        startDate: baseDate,
        endDate,
        location: venueInfo
          ? `${venueInfo.label}, ${venueInfo.address}`
          : `Deplacement - ${resolvedOpponent}`,
        notes: match.note || "",
        alarms: [{ relativeOffset: -60 }],
        timeZone: "Europe/Paris",
      });

      try {
        await Calendar.openEventInCalendarAsync({ id: eventId });
      } catch {
        Alert.alert(
          "Ajoute !",
          "Le match a ete ajoute dans votre calendrier."
        );
      }
    } catch (e: any) {
      Alert.alert("Erreur calendrier", e?.message || "Erreur inconnue.");
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.stateTitle}>Chargement du match...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>{errorMsg}</Text>
          <TouchableOpacity onPress={goBack} style={styles.stateBtn} activeOpacity={0.9}>
            <Text style={styles.stateBtnTxt}>Retour aux matchs</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10 },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroShine}
          />

          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.9}>
              <Icon name="chevron-back" size={22} color="#F3F4F6" />
            </TouchableOpacity>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Détail du match</Text>
              <Text style={styles.heroSub}>{isUpcoming ? "À venir" : "Joué"}</Text>
            </View>

            {!isUpcoming && resultLabel ? (
              <View style={[styles.resultBadge, { backgroundColor: resultBadgeColor }]}>
                <Text style={styles.resultBadgeTxt}>{resultLabel}</Text>
              </View>
            ) : (
              <View style={styles.resultPlaceholder} />
            )}
          </View>
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(28, insets.bottom + 14) }}>
        <View style={styles.card}>
          <Text style={styles.matchDate}>{formatDateLong(dateValue || "")}</Text>
          <Text style={styles.metaLine}>
            {venueLabel} | {category}
          </Text>

          <View style={styles.teamsRow}>
            <View style={styles.teamCol}>
              {homeLogo ? (
                <RNImage source={homeLogo} style={styles.logo} resizeMode="cover" />
              ) : (
                <View style={styles.logo} />
              )}
              <Text style={styles.teamName}>{homeName}</Text>
              {homeScore !== null && <Text style={styles.score}>{homeScore}</Text>}
            </View>

            <Text style={styles.vs}>{homeScore !== null ? "-" : "VS"}</Text>

            <View style={styles.teamCol}>
              {awayLogo ? (
                <RNImage source={awayLogo} style={styles.logo} resizeMode="cover" />
              ) : (
                <View style={styles.logo} />
              )}
              <Text style={styles.teamName}>{awayName}</Text>
              {awayScore !== null && <Text style={styles.score}>{awayScore}</Text>}
            </View>
          </View>

          {!!note && (
            venueMapsUrl ? (
              <TouchableOpacity style={styles.noteBox} activeOpacity={0.9} onPress={() => openUrl(venueMapsUrl)}>
                <Icon name="information-circle-outline" size={16} color="#F59E0B" />
                <View style={styles.noteContent}>
                  <Text style={styles.noteTxt}>{note}</Text>
                  <Text style={styles.noteLinkTxt}>Ouvrir dans Google Maps</Text>
                </View>
                <Icon name="open-outline" size={16} color="#F59E0B" />
              </TouchableOpacity>
            ) : (
              <View style={styles.noteBox}>
                <Icon name="information-circle-outline" size={16} color="#F59E0B" />
                <Text style={styles.noteTxt}>{note}</Text>
              </View>
            )
          )}

          {isUpcoming && upcoming && (
            <TouchableOpacity
              style={styles.calBtn}
              activeOpacity={0.9}
              onPress={() =>
                Alert.alert(
                  "Ajouter au calendrier",
                  "Ajouter ce match a votre calendrier ?",
                  [
                    { text: "Annuler", style: "cancel" },
                    { text: "Oui", onPress: () => addMatchToCalendar(upcoming) },
                  ]
                )
              }
            >
              <Icon name="calendar-outline" size={16} color="#fff" />
              <Text style={styles.calBtnTxt}>Ajouter au calendrier</Text>
            </TouchableOpacity>
          )}

          {!!played?.boxscore_link && (
            <TouchableOpacity
              style={styles.boxscoreBtn}
              activeOpacity={0.9}
              onPress={() => openUrl(played.boxscore_link || "")}
            >
              <Icon name="open-outline" size={16} color="#fff" />
              <Text style={styles.boxscoreTxt}>Ouvrir boxscore FFBS</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Participants</Text>
            <View style={styles.countPill}>
              <Icon name="people-outline" size={14} color="#0F172A" />
              <Text style={styles.countPillTxt}>
                {participantCount} inscrit{participantCount > 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {participants.length === 0 ? (
            <Text style={styles.emptyParticipants}>Aucun participant renseigné pour le moment.</Text>
          ) : (
            <View style={styles.participantsList}>
              {participants.map((p) => (
                <View key={p.id} style={styles.participantRow}>
                  <Icon name="person-circle-outline" size={18} color="#FFB366" />
                  <Text style={styles.participantName}>{p.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partager ce match</Text>
          <Text style={styles.shareSub}>
            Diffuse le rendez-vous à ton équipe et sur les réseaux du club.
          </Text>

          <TouchableOpacity style={styles.sharePrimary} activeOpacity={0.9} onPress={openNativeShare}>
            <Icon name="share-social-outline" size={18} color="#111827" />
            <Text style={styles.sharePrimaryTxt}>Partager</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0F17" },
  stateWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  stateTitle: { color: "#E5E7EB", fontWeight: "800", fontSize: 16, textAlign: "center" },
  stateBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FF8200",
  },
  stateBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  heroWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "#0E1524",
  },
  heroGradient: { paddingHorizontal: 12, paddingBottom: 10 },
  heroShine: { ...StyleSheet.absoluteFillObject, top: 0, bottom: "52%" },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  heroTitleWrap: { flex: 1 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#d5d8df", marginTop: 2, fontWeight: "700", fontSize: 12.5 },
  resultBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBadgeTxt: { color: "#fff", fontWeight: "900", fontSize: 11.5, letterSpacing: 0.3 },
  resultPlaceholder: { width: 22, height: 22 },

  card: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#252a38",
    backgroundColor: "#141821",
    padding: 14,
  },
  matchDate: { color: "#fff", fontWeight: "900", fontSize: 17 },
  metaLine: { color: "#cfd3db", fontWeight: "700", marginTop: 2, fontSize: 13 },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  teamCol: { flex: 1, alignItems: "center" },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D96B00",
    backgroundColor: "#fff",
  },
  teamName: { color: "#eaeef7", marginTop: 6, fontWeight: "900", fontSize: 14 },
  score: { color: "#fff", fontWeight: "900", fontSize: 24, marginTop: 2 },
  vs: { color: "#FF9E3A", fontWeight: "900", fontSize: 18, marginHorizontal: 8 },
  noteBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  noteContent: { flex: 1 },
  noteTxt: { color: "#E5E7EB", fontSize: 13.5, fontWeight: "600", flex: 1 },
  noteLinkTxt: { color: "#FDBA74", fontSize: 12, fontWeight: "800", marginTop: 6 },
  calBtn: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#0F2746",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.7)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  calBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },
  boxscoreBtn: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#D96B00",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  boxscoreTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  section: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#252a38",
    backgroundColor: "#11131a",
    padding: 14,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#D6E3F3",
    borderColor: "#7FA8D6",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countPillTxt: { color: "#0F172A", fontWeight: "900", fontSize: 11.5 },
  participantsList: { marginTop: 10, gap: 8 },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#141821",
    borderColor: "#2a3040",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  participantName: { color: "#eaeef7", fontWeight: "700", fontSize: 13.5 },
  emptyParticipants: { color: "#9CA3AF", marginTop: 10, fontWeight: "600" },

  shareSub: { color: "#AEB6C3", fontSize: 13, marginTop: 4, marginBottom: 10 },
  sharePrimary: {
    borderRadius: 11,
    backgroundColor: "#FFB366",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sharePrimaryTxt: { color: "#111827", fontWeight: "900", fontSize: 13.5 },
});
