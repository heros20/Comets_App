"use client";

import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import LogoutButton from "../../components/LogoutButton";
import { supabase } from "../../supabase";

const logoComets = require("../../assets/images/iconComets.png");

type StandingTeam = {
  rank?: number | string | null;
  name?: string | null;
  abbreviation?: string | null;
  logo?: string | null;
  W?: number | string | null;
  L?: number | string | null;
  T?: number | string | null;
  PCT?: number | string | null;
  GB?: number | string | null;
};

type ClassementData = {
  tabs?: string[];
  standings?: StandingTeam[][];
  previous?: {
    standings?: StandingTeam[][];
  };
  year?: number | string | null;
};

type RankChange = {
  icon: "caret-up" | "caret-down";
  color: string;
} | null;

function toRankNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDisplay(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function getPrevRank(team: StandingTeam, tabIdx: number, classement: ClassementData | null): number | null {
  const prevRows = classement?.previous?.standings?.[tabIdx];
  if (!Array.isArray(prevRows)) return null;
  const prev = prevRows.find(
    (it) =>
      (it.abbreviation || "").toUpperCase() === (team.abbreviation || "").toUpperCase() ||
      (it.name || "").toUpperCase() === (team.name || "").toUpperCase()
  );
  return toRankNumber(prev?.rank);
}

function getRankChange(prev: number | null, current: number | null): RankChange {
  if (prev === null || current === null || prev === current) return null;
  if (prev > current) return { icon: "caret-up", color: "#10B981" };
  if (prev < current) return { icon: "caret-down", color: "#EF4444" };
  return null;
}

type TeamRowProps = {
  team: StandingTeam;
  index: number;
  rankLabel: string;
  wins: string;
  losses: string;
  draws: string;
  pct: string;
  gb: string;
  isComets: boolean;
  rankChange: RankChange;
};

const TeamRow = React.memo(function TeamRow({
  team,
  index,
  rankLabel,
  wins,
  losses,
  draws,
  pct,
  gb,
  isComets,
  rankChange,
}: TeamRowProps) {
  const isLeader = index === 0;
  const abbr = (team.abbreviation || "").toUpperCase();
  const teamName = team.name || "Equipe";
  const logoUri = team.logo || "";

  return (
    <View style={[styles.rowCard, isLeader && styles.rowLeader, isComets && styles.rowComets]}>
      <View style={styles.rowTop}>
        <View style={styles.rankWrap}>
          {isLeader ? (
            <View style={styles.rankBadge}>
              <Icon name="trophy" size={13} color="#111827" />
            </View>
          ) : (
            <Text style={[styles.rankText, isComets && styles.rankTextComets]}>{rankLabel}</Text>
          )}
          {!!rankChange && (
            <Icon
              name={rankChange.icon}
              size={12}
              color={rankChange.color}
              style={styles.rankDeltaIcon}
            />
          )}
        </View>

        {!!logoUri && (
          <ExpoImage
            source={{ uri: logoUri, cacheKey: `${abbr}-${teamName}` }}
            recyclingKey={`${abbr}-${teamName}`}
            cachePolicy="memory-disk"
            priority={index < 4 ? "high" : "normal"}
            transition={120}
            contentFit="cover"
            style={[styles.teamLogo, isComets && styles.teamLogoComets]}
          />
        )}

        <View style={styles.rowTitleWrap}>
          <Text style={[styles.teamName, isLeader && styles.teamNameLeader, isComets && styles.teamNameComets]}>
            {teamName} {!!abbr && <Text style={styles.abbr}>({abbr})</Text>}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>W</Text>
          <Text style={styles.chipValue}>{wins}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>L</Text>
          <Text style={styles.chipValue}>{losses}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>T</Text>
          <Text style={styles.chipValue}>{draws}</Text>
        </View>
        <View style={styles.chipWide}>
          <Text style={styles.chipLabel}>PCT</Text>
          <Text style={styles.chipValue}>{pct}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>GB</Text>
          <Text style={styles.chipValue}>{gb}</Text>
        </View>
      </View>
    </View>
  );
});

export default function ClassementScreen() {
  const navigation = useNavigation();

  const [classement, setClassement] = useState<ClassementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const listRef = useRef<FlatList<StandingTeam>>(null);

  useEffect(() => {
    Asset.loadAsync([logoComets]).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchClassement = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from("classement_normandie")
          .select("data")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!mounted) return;

        if (error) {
          setErrorMsg(`Erreur de recuperation Supabase: ${error.message}`);
          return;
        }
        if (!data?.data) {
          setErrorMsg("Aucun classement trouve.");
          return;
        }
        setClassement(data.data as ClassementData);
      } catch (e: any) {
        if (!mounted) return;
        setErrorMsg(`Erreur cote application: ${e?.message || e}`);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchClassement();

    return () => {
      mounted = false;
    };
  }, []);

  const tabs = useMemo(() => {
    const raw = classement?.tabs;
    if (!Array.isArray(raw) || raw.length === 0) return ["Classement"];
    return raw;
  }, [classement?.tabs]);

  const tables = useMemo(() => {
    const raw = classement?.standings;
    if (!Array.isArray(raw)) return [] as StandingTeam[][];
    return raw;
  }, [classement?.standings]);

  useEffect(() => {
    if (activeTab < tabs.length) return;
    setActiveTab(0);
  }, [activeTab, tabs.length]);

  const currentRows = useMemo<StandingTeam[]>(() => {
    const rows = tables[activeTab];
    return Array.isArray(rows) ? rows : [];
  }, [tables, activeTab]);

  const seasonLabel = useMemo(() => {
    if (classement?.year) return `Saison ${classement.year}`;
    return "Saison en cours";
  }, [classement?.year]);

  const currentTabLabel = tabs[activeTab] || "Classement";

  const currentLogos = useMemo(() => {
    return currentRows
      .map((row) => row.logo)
      .filter((uri): uri is string => typeof uri === "string" && uri.length > 4)
      .slice(0, 20);
  }, [currentRows]);

  useEffect(() => {
    if (!currentLogos.length) return;
    ExpoImage.prefetch(currentLogos, "memory-disk").catch(() => {});
  }, [currentLogos]);

  const onSelectTab = useCallback((index: number) => {
    setActiveTab(index);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onScrollList = useCallback((offsetY: number) => {
    setShowScrollTop(offsetY > 260);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: StandingTeam; index: number }) => {
      const rankNumber = toRankNumber(item.rank);
      const rankLabel = rankNumber === null ? "-" : String(rankNumber);
      const wins = toDisplay(item.W);
      const losses = toDisplay(item.L);
      const draws = toDisplay(item.T);
      const pct = toDisplay(item.PCT);
      const gb = toDisplay(item.GB);
      const isComets =
        (item.name || "").toLowerCase().includes("honfleur") ||
        (item.abbreviation || "").toUpperCase() === "HON";

      const prevRank = getPrevRank(item, activeTab, classement);
      const rankChange = getRankChange(prevRank, rankNumber);

      return (
        <TeamRow
          team={item}
          index={index}
          rankLabel={rankLabel}
          wins={wins}
          losses={losses}
          draws={draws}
          pct={pct}
          gb={gb}
          isComets={isComets}
          rankChange={rankChange}
        />
      );
    },
    [activeTab, classement]
  );

  const keyExtractor = useCallback((item: StandingTeam, index: number) => {
    return `${item.abbreviation || item.name || "team"}-${index}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.stateSafe}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.stateLoadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.stateSafe}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.stateErrorText}>{errorMsg}</Text>
      </SafeAreaView>
    );
  }

  if (!classement) {
    return (
      <SafeAreaView style={styles.stateSafe}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.stateNeutralText}>Aucun classement disponible.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
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
              activeOpacity={0.9}
            >
              <Icon name="chevron-back" size={22} color="#F3F4F6" />
            </TouchableOpacity>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Classement Comets</Text>
              <Text style={styles.heroSub}>{currentTabLabel}</Text>
            </View>

            <LogoutButton />
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
              <Text style={styles.heroSeason}>{seasonLabel}</Text>
              <Text style={styles.heroMetaText}>{currentRows.length} equipes classees</Text>
            </View>
            <View style={styles.heroPill}>
              <Icon name="trophy-outline" size={13} color="#FFDDBA" />
              <Text style={styles.heroPillText}>R1 Normandie</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsRow}
          >
            {tabs.map((tab, index) => {
              const active = index === activeTab;
              return (
                <TouchableOpacity
                  key={`${tab}-${index}`}
                  onPress={() => onSelectTab(index)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]} numberOfLines={1}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </LinearGradient>
      </View>

      <View style={styles.flex}>
        <FlatList
          ref={listRef}
          data={currentRows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={(e) => onScrollList(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconWrap}>
                <Icon name="stats-chart-outline" size={15} color="#FF9E3A" />
              </View>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryTitle}>Classement actuel</Text>
                <Text style={styles.summaryText}>Donnees officielles de la poule active</Text>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Aucune equipe dans cette poule.</Text>}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={Platform.OS === "android"}
        />

        {showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtn}
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.85}
          >
            <Icon name="chevron-up" size={28} color="#FF9E3A" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  stateSafe: {
    flex: 1,
    backgroundColor: "#0B0F17",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  stateLoadingText: {
    color: "#FF8200",
    fontWeight: "800",
    fontSize: 18,
  },
  stateErrorText: {
    color: "#F87171",
    textAlign: "center",
    lineHeight: 20,
  },
  stateNeutralText: {
    color: "#AAB2C2",
    textAlign: "center",
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
  },
  heroSeason: {
    color: "#F9FAFB",
    fontSize: 14.5,
    fontWeight: "800",
  },
  heroMetaText: {
    marginTop: 1,
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

  tabsScroll: {
    marginTop: 8,
  },
  tabsRow: {
    paddingHorizontal: 1,
    gap: 6,
  },
  tabBtn: {
    minHeight: 36,
    minWidth: 104,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
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

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 36,
  },
  summaryCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,158,58,0.45)",
    backgroundColor: "rgba(255,158,58,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    color: "#F3F4F6",
    fontSize: 14,
    fontWeight: "800",
  },
  summaryText: {
    marginTop: 1,
    color: "#AAB2C2",
    fontSize: 12,
  },
  emptyText: {
    color: "#AAB2C2",
    textAlign: "center",
    marginTop: 30,
    fontSize: 14,
  },

  rowCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#141A27",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowLeader: {
    borderColor: "rgba(245,158,11,0.58)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  rowComets: {
    borderColor: "#FF8200",
    backgroundColor: "rgba(255,130,0,0.13)",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  rankWrap: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  rankText: {
    color: "#CFD3DB",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  rankTextComets: {
    color: "#FF9E3A",
  },
  rankDeltaIcon: {
    marginTop: 2,
  },
  teamLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E6E8EE",
  },
  teamLogoComets: {
    borderColor: "#FF8200",
  },
  rowTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    color: "#EAEFF8",
    fontWeight: "900",
    fontSize: 14.5,
  },
  teamNameLeader: {
    color: "#F6C27E",
  },
  teamNameComets: {
    color: "#FF9E3A",
  },
  abbr: {
    color: "#A7B0C0",
    fontWeight: "700",
    fontSize: 12.5,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101827",
    borderWidth: 1,
    borderColor: "#273042",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipWide: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101827",
    borderWidth: 1,
    borderColor: "#273042",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipLabel: {
    color: "#9BA5B8",
    fontWeight: "900",
    marginRight: 6,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  chipValue: {
    color: "#EAEFF8",
    fontWeight: "900",
    fontSize: 13,
  },

  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FF9E3A",
    backgroundColor: "#101827EE",
    shadowColor: "#FF9E3A",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
});
