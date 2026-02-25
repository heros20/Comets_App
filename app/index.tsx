// app/screens/Accueil.tsx
"use client";

import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  ImageBackground,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { useAdmin } from "../contexts/AdminContext";

const logoComets = require("../assets/images/iconComets.png");
const heroBackdrop = require("../assets/images/hero-page.png");

const API_BASE = "https://les-comets-honfleur.vercel.app";

type AppRoute = Parameters<typeof router.push>[0];

type HomeAction = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: AppRoute;
  tone: string;
};

type NewsItem = {
  id: number | string;
  title: string;
  content: string;
  created_at?: string | null;
};

type PlannedMatch = {
  id: number | string;
  date: string;
  opponent: string;
  is_home?: boolean;
  categorie?: string | null;
  note?: string | null;
};

function dedupeByRoute(items: HomeAction[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.route);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const CORE_ACTIONS: HomeAction[] = [
  {
    id: "matchs",
    title: "Prochains matchs",
    subtitle: "Calendrier, participation et convocations",
    icon: "calendar-outline",
    route: "/matchs",
    tone: "#FF8200",
  },
  {
    id: "actus",
    title: "Actualit\u00E9s",
    subtitle: "Suivre les infos du club",
    icon: "newspaper-outline",
    route: "/actus",
    tone: "#3B82F6",
  },
  {
    id: "classement",
    title: "Classement",
    subtitle: "Voir la progression de la saison",
    icon: "trophy-outline",
    route: "/classement",
    tone: "#10B981",
  },
];

function parseDateValue(input?: string | null): Date | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  if (raw.includes("/")) {
    const [d, m, y] = raw.split("/");
    if (!d || !m || !y) return null;
    const parsed = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(`${raw}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateFr(value?: string | null) {
  const date = parseDateValue(value) ?? (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "Date a confirmer";
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function stripHtml(text: string) {
  return (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function excerpt(text: string, max = 140) {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}...`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function QuickCard({ item }: { item: HomeAction }) {
  return (
    <TouchableOpacity
      style={[styles.quickCard, { borderColor: `${item.tone}66` }]}
      activeOpacity={0.92}
      onPress={() => router.push(item.route)}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${item.tone}22`, borderColor: `${item.tone}66` }]}> 
        <Icon name={item.icon as any} size={21} color={item.tone} />
      </View>
      <View style={styles.quickTextWrap}>
        <Text style={styles.quickTitle}>{item.title}</Text>
        <Text style={styles.quickSub}>{item.subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color="#C5CBD7" />
    </TouchableOpacity>
  );
}

function TabCard({ item, width }: { item: HomeAction; width: number }) {
  return (
    <TouchableOpacity
      style={[styles.tabCard, { width, borderColor: `${item.tone}55` }]}
      activeOpacity={0.92}
      onPress={() => router.push(item.route)}
    >
      <View style={[styles.tabIcon, { backgroundColor: `${item.tone}20` }]}> 
        <Icon name={item.icon as any} size={16} color={item.tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tabTitle}>{item.title}</Text>
        <Text style={styles.tabSub}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function HighlightCard({
  title,
  text,
  cta,
  icon,
  tone,
  onPress,
  loading = false,
}: {
  title: string;
  text: string;
  cta: string;
  icon: string;
  tone: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.highlightCard, { borderColor: `${tone}66` }]} activeOpacity={0.92} onPress={onPress}>
      <View style={styles.highlightTop}>
        <View style={[styles.highlightIcon, { backgroundColor: `${tone}22`, borderColor: `${tone}55` }]}> 
          <Icon name={icon as any} size={17} color={tone} />
        </View>
        <Text style={styles.highlightTitle}>{title}</Text>
      </View>
      <Text style={styles.highlightText}>{loading ? "Chargement..." : text}</Text>
      <View style={styles.highlightLink}>
        <Text style={[styles.highlightLinkText, { color: tone }]}>{cta}</Text>
        <Icon name="arrow-forward" size={14} color={tone} />
      </View>
    </TouchableOpacity>
  );
}

export default function Accueil() {
  const { isAdmin, isMember, logout } = useAdmin();
  const isLoggedIn = isAdmin || isMember;
  const { width, height } = useWindowDimensions();
  const [latestNews, setLatestNews] = useState<NewsItem | null>(null);
  const [nextMatch, setNextMatch] = useState<PlannedMatch | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(true);

  const statusLabel = isAdmin ? "Admin" : isMember ? "Membre" : "Visiteur";
  const twoCols = width >= 390;
  const gridGap = 10;
  const gridWidth = twoCols ? (width - 24 - gridGap) / 2 : width - 24;
  const heroHeight = Math.max(520, Math.min(height * 0.92, 760));

  useEffect(() => {
    let mounted = true;

    (async () => {
      setHighlightsLoading(true);
      try {
        const [news, matches] = await Promise.all([
          fetchJson<NewsItem[]>("/api/news"),
          fetchJson<PlannedMatch[]>("/api/matches_planned"),
        ]);

        if (!mounted) return;

        const sortedNews = Array.isArray(news)
          ? [...news].sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime())
          : [];
        setLatestNews(sortedNews[0] ?? null);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = (Array.isArray(matches) ? matches : [])
          .map((match) => ({
            ...match,
            parsedDate: parseDateValue(match.date),
          }))
          .filter((match) => !!match.parsedDate && match.parsedDate >= today)
          .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

        setNextMatch(upcoming[0] ?? null);
      } catch {
        if (!mounted) return;
        setLatestNews(null);
        setNextMatch(null);
      } finally {
        if (mounted) setHighlightsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const quickActions = useMemo(() => {
    const list = [...CORE_ACTIONS];
    if (isLoggedIn) {
      list.push({
        id: "comets-run",
        title: "Comets Run",
        subtitle: "Mode arcade et d\u00E9fi score",
        icon: "game-controller-outline",
        route: "/CometsRunScreen",
        tone: "#F59E0B",
      });
    }
    return dedupeByRoute(list);
  }, [isLoggedIn]);

  const allTabs = useMemo(() => {
    const list: HomeAction[] = [
      {
        id: "tab-matchs",
        title: "Matchs",
        subtitle: "Calendrier",
        icon: "calendar-outline",
        route: "/matchs",
        tone: "#FF8200",
      },
      {
        id: "tab-actus",
        title: "Actualit\u00E9s",
        subtitle: "Infos du club",
        icon: "newspaper-outline",
        route: "/actus",
        tone: "#3B82F6",
      },
      {
        id: "tab-classement",
        title: "Classement",
        subtitle: "Championnat",
        icon: "trophy-outline",
        route: "/classement",
        tone: "#10B981",
      },
      {
        id: "tab-joueurs",
        title: "Joueurs",
        subtitle: "Effectif",
        icon: "people-outline",
        route: "/joueurs",
        tone: "#F97316",
      },
      {
        id: "tab-galerie",
        title: "Galerie",
        subtitle: "Photos",
        icon: "images-outline",
        route: "/GalleryScreen",
        tone: "#6366F1",
      },
    ];

    if (isLoggedIn) {
      list.push(
        {
          id: "tab-profil",
          title: "Profil",
          subtitle: "Compte",
          icon: "person-circle-outline",
          route: "/profil",
          tone: "#22C55E",
        },
        {
          id: "tab-run",
          title: "Comets Run",
          subtitle: "Mini-jeu",
          icon: "game-controller-outline",
          route: "/CometsRunScreen",
          tone: "#EAB308",
        },
      );
    } else {
      list.push(
        {
          id: "tab-login",
          title: "Connexion",
          subtitle: "Se connecter",
          icon: "log-in-outline",
          route: "/login",
          tone: "#38BDF8",
        },
        {
          id: "tab-register",
          title: "Inscription",
          subtitle: "Cr\u00E9er un compte",
          icon: "person-add-outline",
          route: "/(tabs)/Register",
          tone: "#22C55E",
        },
      );
    }

    return dedupeByRoute(list);
  }, [isLoggedIn]);

  const secondaryTabs = useMemo(() => {
    const quickRoutes = new Set(quickActions.map((item) => String(item.route)));
    return allTabs.filter((item) => !quickRoutes.has(String(item.route)));
  }, [allTabs, quickActions]);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.heroWrap, { minHeight: heroHeight }]}>
          <ImageBackground source={heroBackdrop} resizeMode="cover" style={styles.heroImage} imageStyle={styles.heroImageRadius}>
            <LinearGradient
              colors={["rgba(0,0,0,0.24)", "rgba(0,0,0,0.68)", "rgba(5,9,18,0.96)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.heroShine}
            />

            <View
              style={[
                styles.heroContent,
                {
                  paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10,
                },
              ]}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.brandWrap}>
                  <Image source={logoComets} style={styles.logo} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.brandTitle}>Comets d&apos;Honfleur</Text>
                    <Text style={styles.brandSub}>Application officielle du club</Text>
                  </View>
                </View>

                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              </View>

              <View style={styles.heroTextBlock}>
                <Text style={styles.heroChip}>Baseball Normandie</Text>
                <Text style={styles.heroTitle}>Baseball Club Honfleur - Les Comets</Text>
                <Text style={styles.heroCatch}>
                  Toute la vie du club au même endroit: actualités, matchs, classement et infos utiles.
                </Text>
              </View>

              <View style={styles.heroCtaRow}>
                <TouchableOpacity style={[styles.heroBtn, styles.heroBtnPrimary]} activeOpacity={0.9} onPress={() => router.push("/matchs")}>
                  <Icon name="calendar-outline" size={16} color="#111827" />
                  <Text style={styles.heroBtnPrimaryTxt}>Voir le calendrier</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.heroBtn, styles.heroBtnGhost]} activeOpacity={0.9} onPress={() => router.push("/actus")}>
                  <Icon name="newspaper-outline" size={16} color="#F3F4F6" />
                  <Text style={styles.heroBtnGhostTxt}>Voir les actus</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.accountRow}>
                {isLoggedIn ? (
                  <>
                    <TouchableOpacity style={[styles.accountBtn, styles.accountBtnLight]} activeOpacity={0.9} onPress={() => router.push("/profil")}>
                      <Icon name="person-circle-outline" size={16} color="#E5E7EB" />
                      <Text style={styles.accountBtnLightTxt}>Mon profil</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.accountBtn, styles.accountBtnDanger]} activeOpacity={0.9} onPress={handleLogout}>
                      <Icon name="log-out-outline" size={16} color="#FFF" />
                      <Text style={styles.accountBtnDangerTxt}>{"D\u00E9connexion"}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={[styles.accountBtn, styles.accountBtnLight]} activeOpacity={0.9} onPress={() => router.push("/login")}>
                      <Icon name="log-in-outline" size={16} color="#E5E7EB" />
                      <Text style={styles.accountBtnLightTxt}>Connexion</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.accountBtn, styles.accountBtnPrimary]}
                      activeOpacity={0.9}
                      onPress={() => router.push("/(tabs)/Register")}
                    >
                      <Icon name="person-add-outline" size={16} color="#111827" />
                      <Text style={styles.accountBtnPrimaryTxt}>Inscription</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"\u00C0 la une"}</Text>
            <Text style={styles.sectionHint}>{"Revenez souvent pour rester inform\u00E9."}</Text>
          </View>

          <View style={styles.highlightGrid}>
            <HighlightCard
              title={"Derni\u00E8re actualit\u00E9"}
              icon="newspaper-outline"
              tone="#3B82F6"
              loading={highlightsLoading}
              text={
                latestNews
                  ? `${latestNews.title}${latestNews.created_at ? ` - ${formatDateFr(latestNews.created_at)}` : ""}\n${excerpt(latestNews.content)}`
                  : "Aucune actualit\u00E9 charg\u00E9e pour le moment. Ouvrez la section Actualit\u00E9s pour toutes les publications."
              }
              cta={"Lire les actualit\u00E9s"}
              onPress={() => router.push("/actus")}
            />
            <HighlightCard
              title="Prochain rendez-vous"
              icon="baseball-outline"
              tone="#FF8200"
              loading={highlightsLoading}
              text={
                nextMatch
                  ? `${nextMatch.is_home ? "Domicile" : "Ext\u00E9rieur"} - ${nextMatch.opponent}\n${formatDateFr(nextMatch.date)}${
                      nextMatch.categorie ? `\nCat\u00E9gorie : ${nextMatch.categorie}` : ""
                    }`
                  : "Le prochain match sera affich\u00E9 ici d\u00E8s qu'il est planifi\u00E9."
              }
              cta="Voir les matchs"
              onPress={() => router.push("/matchs")}
            />
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"Acc\u00E8s rapide"}</Text>
            <Text style={styles.sectionHint}>{"L'essentiel du site, adapt\u00E9 \u00E0 l'app."}</Text>
          </View>
          {quickActions.map((item) => (
            <QuickCard key={item.id} item={item} />
          ))}
        </View>

        {secondaryTabs.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Autres onglets</Text>
              <Text style={styles.sectionHint}>Un seul affichage par onglet.</Text>
            </View>

            <View style={styles.tabGrid}>
              {secondaryTabs.map((item, idx) => (
                <View key={item.id} style={{ marginBottom: gridGap, marginRight: twoCols && idx % 2 === 0 ? gridGap : 0 }}>
                  <TabCard item={item} width={gridWidth} />
                </View>
              ))}
            </View>
          </View>
        )}

        {isAdmin && (
          <TouchableOpacity style={styles.adminCard} activeOpacity={0.92} onPress={() => router.push("/admin")}>
            <LinearGradient colors={["#F59E0B", "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.adminGradient}>
              <View style={styles.adminIconWrap}>
                <Icon name="construct-outline" size={18} color="#0F1014" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminTitle}>Espace administration</Text>
                <Text style={styles.adminSub}>Gestion membres, matchs et contenus</Text>
              </View>
              <Icon name="chevron-forward" size={20} color="#0F1014" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.legalWrap}>
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://heros20.github.io/Portfolio-2.0/")}>
            Made by Kevin Bigoni
          </Text>
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://les-comets-honfleur.vercel.app/mentions-legales")}>
            {"Copyright "}
            {new Date().getFullYear()}
            {" Les Comets d'Honfleur - Tous droits r\u00E9serv\u00E9s."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  scrollContent: {
    paddingBottom: 30,
  },

  heroWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.35)",
    backgroundColor: "#0E1524",
  },
  heroImage: {
    flex: 1,
  },
  heroImageRadius: {
    borderRadius: 24,
  },
  heroShine: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: "45%",
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 14,
    justifyContent: "space-between",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  brandTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  brandSub: {
    marginTop: 2,
    color: "#D4D8E0",
    fontSize: 12.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusText: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 11.5,
  },
  heroTextBlock: {
    marginTop: 12,
    maxWidth: "92%",
  },
  heroChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(0,0,0,0.35)",
    color: "#FDE6D3",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 3 },
  },
  heroCatch: {
    marginTop: 10,
    color: "#E5E7EB",
    fontSize: 14.5,
    lineHeight: 21,
    maxWidth: "95%",
  },
  heroCtaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  heroBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  heroBtnPrimary: {
    backgroundColor: "#FF8200",
    borderColor: "#FFAA58",
  },
  heroBtnGhost: {
    backgroundColor: "rgba(0,0,0,0.38)",
    borderColor: "rgba(255,255,255,0.45)",
  },
  heroBtnPrimaryTxt: {
    color: "#111827",
    fontSize: 13.5,
    fontWeight: "900",
  },
  heroBtnGhostTxt: {
    color: "#F3F4F6",
    fontSize: 13.5,
    fontWeight: "900",
  },

  accountRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  accountBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  accountBtnLight: {
    backgroundColor: "rgba(0,0,0,0.34)",
    borderColor: "rgba(255,255,255,0.32)",
  },
  accountBtnPrimary: {
    backgroundColor: "#F9FAFB",
    borderColor: "#FFFFFF",
  },
  accountBtnDanger: {
    backgroundColor: "#B91C1C",
    borderColor: "#DC2626",
  },
  accountBtnLightTxt: {
    color: "#E5E7EB",
    fontSize: 13.5,
    fontWeight: "800",
  },
  accountBtnPrimaryTxt: {
    color: "#111827",
    fontSize: 13.5,
    fontWeight: "900",
  },
  accountBtnDangerTxt: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "900",
  },

  sectionBlock: {
    marginTop: 24,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#F3F4F6",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.25,
  },
  sectionHint: {
    marginTop: 4,
    color: "#AAB2C2",
    fontSize: 12.8,
    lineHeight: 18,
  },

  highlightGrid: {
    gap: 12,
  },
  highlightCard: {
    backgroundColor: "#131B2A",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  highlightTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  highlightIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightTitle: {
    color: "#E5E7EB",
    fontSize: 14.5,
    fontWeight: "900",
  },
  highlightText: {
    marginTop: 10,
    color: "#CBD5E1",
    lineHeight: 20,
    fontSize: 13.5,
  },
  highlightLink: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightLinkText: {
    fontWeight: "900",
    fontSize: 13.5,
  },

  quickCard: {
    backgroundColor: "#151E2F",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  quickIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  quickTextWrap: {
    flex: 1,
  },
  quickTitle: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "900",
  },
  quickSub: {
    marginTop: 3,
    color: "#AAB2C2",
    fontSize: 12.8,
    lineHeight: 18,
  },

  tabGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tabCard: {
    backgroundColor: "#141D2C",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tabTitle: {
    color: "#F3F4F6",
    fontSize: 14,
    fontWeight: "900",
  },
  tabSub: {
    marginTop: 3,
    color: "#9AA6B8",
    fontSize: 12,
    lineHeight: 16,
  },

  adminCard: {
    marginTop: 12,
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: "hidden",
  },
  adminGradient: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adminIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  adminTitle: {
    color: "#0F1014",
    fontSize: 14.5,
    fontWeight: "900",
  },
  adminSub: {
    marginTop: 1,
    color: "rgba(15,16,20,0.8)",
    fontSize: 12,
    fontWeight: "700",
  },

  legalWrap: {
    marginTop: 22,
    paddingHorizontal: 18,
  },
  legalLink: {
    color: "#8C94A5",
    textAlign: "center",
    fontSize: 11.8,
    marginTop: 10,
    lineHeight: 17,
  },
});
