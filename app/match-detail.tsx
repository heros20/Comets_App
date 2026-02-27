"use client";

import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

const SITE_URL = "https://les-comets-honfleur.vercel.app";
const TEAM_NAMES: Record<string, string> = {
  HON: "Honfleur",
  LHA: "Le Havre",
  ROU: "Rouen",
  CAE: "Caen",
  CHE: "Cherbourg",
  WAL: "Louviers",
  AND: "Les Andelys",
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
  "Saint-LÃ´": require("../assets/images/Saint-Lo.jpg"),
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

function normalizeName(name: string) {
  return name.replace(/^Les\s+/i, "").trim();
}
function getTeamLogo(name: string) {
  return LOGO_MAP[name] || LOGO_MAP[normalizeName(name)] || null;
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
  if (!result) return "Resultat non renseigne";
  if (result === "W") return "Victoire";
  if (result === "L") return "Defaite";
  if (result === "T") return "Egalite";
  return String(result);
}

export default function MatchDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
      setErrorMsg("Aucun match selectionne.");
      setLoading(false);
      return;
    }

    let mounted = true;
    const mid = String(matchId);

    const loadParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from("match_participations")
          .select("admin_id")
          .eq("match_id", mid);

        if (error || !Array.isArray(data)) {
          if (mounted) {
            setParticipantCount(0);
            setParticipants([]);
          }
          return;
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
          return;
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
          return;
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
      } catch {
        if (!mounted) return;
        setParticipantCount(0);
        setParticipants([]);
      }
    };

    const loadMatch = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        if (kind === "played") {
          const { data, error } = await supabase
            .from("games")
            .select("*")
            .eq("id", mid)
            .maybeSingle();
          if (error || !data) throw new Error("Match joue introuvable");
          if (!mounted) return;
          setPlayed(data as PlayedGame);
        } else {
          const { data, error } = await supabase
            .from("matches_planned")
            .select("*")
            .eq("id", mid)
            .maybeSingle();
          if (error || !data) throw new Error("Match a venir introuvable");
          if (!mounted) return;
          setUpcoming(data as PlannedGame);
        }

        await loadParticipants();
      } catch {
        if (!mounted) return;
        setErrorMsg("Impossible de charger les details du match.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadMatch();
    return () => {
      mounted = false;
    };
  }, [kind, matchId]);

  const isUpcoming = kind === "upcoming";

  const opponentName = useMemo(() => {
    if (isUpcoming) return upcoming?.opponent || "Adversaire";
    const abbr = played?.opponent_abbr || "";
    return TEAM_NAMES[abbr] || abbr || "Adversaire";
  }, [isUpcoming, played?.opponent_abbr, upcoming?.opponent]);

  const homeName = useMemo(() => {
    if (isUpcoming) return upcoming?.is_home ? "Honfleur" : opponentName;
    const teamAbbr = played?.team_abbr || "HON";
    const homeAbbr = played?.is_home ? teamAbbr : played?.opponent_abbr || "";
    return TEAM_NAMES[homeAbbr] || homeAbbr || "Domicile";
  }, [isUpcoming, opponentName, played?.is_home, played?.opponent_abbr, played?.team_abbr, upcoming?.is_home]);

  const awayName = useMemo(() => {
    if (isUpcoming) return upcoming?.is_home ? opponentName : "Honfleur";
    const teamAbbr = played?.team_abbr || "HON";
    const awayAbbr = played?.is_home ? played?.opponent_abbr || "" : teamAbbr;
    return TEAM_NAMES[awayAbbr] || awayAbbr || "Exterieur";
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

  const dateValue = isUpcoming ? upcoming?.date : played?.date;
  const venueLabel = isUpcoming
    ? upcoming?.is_home
      ? "A domicile"
      : "Exterieur"
    : played?.is_home
      ? "A domicile"
      : "Exterieur";
  const category = isUpcoming ? upcoming?.categorie || "Non precisee" : "Match joue";
  const note = isUpcoming ? upcoming?.note || "" : played?.note || "";
  const resultLabel = !isUpcoming ? formatResultLabel(played?.result) : null;
  const resultBadgeColor =
    played?.result === "W" ? "#16A34A" : played?.result === "L" ? "#B91C1C" : "#334155";

  const shareTitle = `Match Comets vs ${opponentName}`;
  const shareUrl = `${SITE_URL}/matchs?matchId=${encodeURIComponent(matchId)}&kind=${kind}`;
  const shareText = `${shareTitle}
${formatDateLong(dateValue || "")}
${venueLabel}
Categorie: ${category}
Participants: ${participantCount}`;

  const shareTargets = useMemo(
    () => [
      {
        key: "whatsapp",
        label: "WhatsApp",
        icon: "logo-whatsapp" as const,
        color: "#22c55e",
        url: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      },
      {
        key: "x",
        label: "X / Twitter",
        icon: "logo-twitter" as const,
        color: "#93c5fd",
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      },
      {
        key: "facebook",
        label: "Facebook",
        icon: "logo-facebook" as const,
        color: "#60a5fa",
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(
          shareText,
        )}`,
      },
      {
        key: "telegram",
        label: "Telegram",
        icon: "paper-plane-outline" as const,
        color: "#38bdf8",
        url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        icon: "logo-linkedin" as const,
        color: "#94a3b8",
        url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      },
      {
        key: "email",
        label: "Email",
        icon: "mail-outline" as const,
        color: "#f59e0b",
        url: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(
          `${shareText}\n\n${shareUrl}`,
        )}`,
      },
    ],
    [shareText, shareTitle, shareUrl],
  );

  const openUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {}
  }, []);

  const openNativeShare = useCallback(async () => {
    try {
      await Share.share({
        title: shareTitle,
        message: `${shareText}\n${shareUrl}`,
      });
    } catch {}
  }, [shareText, shareTitle, shareUrl]);

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
              <Text style={styles.heroTitle}>Detail du match</Text>
              <Text style={styles.heroSub}>{isUpcoming ? "A venir" : "Joue"}</Text>
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
            <View style={styles.noteBox}>
              <Icon name="information-circle-outline" size={16} color="#F59E0B" />
              <Text style={styles.noteTxt}>{note}</Text>
            </View>
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
            <Text style={styles.emptyParticipants}>Aucun participant renseigne pour le moment.</Text>
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
            Diffuse le rendez-vous a ton equipe et sur les reseaux du club.
          </Text>

          <TouchableOpacity style={styles.sharePrimary} activeOpacity={0.9} onPress={openNativeShare}>
            <Icon name="share-social-outline" size={18} color="#111827" />
            <Text style={styles.sharePrimaryTxt}>Partager (natif)</Text>
          </TouchableOpacity>

          <View style={styles.shareGrid}>
            {shareTargets.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.shareBtn, { borderColor: `${s.color}88` }]}
                activeOpacity={0.9}
                onPress={() => openUrl(s.url)}
              >
                <Icon name={s.icon} size={16} color={s.color} />
                <Text style={styles.shareBtnTxt}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  noteTxt: { color: "#E5E7EB", fontSize: 13.5, fontWeight: "600", flex: 1 },
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
  shareGrid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#141821",
  },
  shareBtnTxt: { color: "#e5e7eb", fontWeight: "800", fontSize: 12.5 },
});

