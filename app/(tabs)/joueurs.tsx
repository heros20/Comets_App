// app/screens/JoueursScreen.tsx
"use client";

import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { DrawerMenuButton } from "../../components/navigation/AppDrawer";
import LogoutButton from "../../components/LogoutButton";
import { supabase } from "../../supabase";

type YoungPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  date_naissance: string | null;
  categorie: "12U" | "15U" | null;
};

type Player = {
  id: number;
  last_name: string;
  first_name: string;
  number: number;
  yob: number | null;
  player_link: string | null;
  team_abbr: string | null;
  status: string | null;
};

type PlayerCardData = {
  id: string;
  first_name: string;
  last_name: string;
  year: number | string;
  link: string;
  number?: number;
  team?: string;
};

const CATEGORIES = ["Senior", "15U", "12U"] as const;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CATEGORY_META: Record<
  (typeof CATEGORIES)[number],
  { icon: string; tone: string; label: string }
> = {
  Senior: { icon: "baseball-outline", tone: "#FF8200", label: "Senior" },
  "15U": { icon: "people-outline", tone: "#3B82F6", label: "15U" },
  "12U": { icon: "sparkles-outline", tone: "#10B981", label: "12U" },
};

function getBirthYearFromDate(val?: string | null): number | null {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return parseInt(val.slice(0, 4), 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return parseInt(val.slice(6, 10), 10);
  return null;
}

function isActiveSenior(status?: string | null) {
  return /\bactive\b/i.test(status ?? "");
}

const PlayerCard = React.memo(function PlayerCard({
  first_name,
  last_name,
  year,
  link,
  number,
  team,
}: {
  first_name: string;
  last_name: string;
  year: number | string;
  link: string;
  number?: number;
  team?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(first_name?.[0] || "").toUpperCase()}
            {(last_name?.[0] || "").toUpperCase()}
          </Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">
            {first_name} {last_name}
          </Text>

          <View style={styles.metaRow}>
            {typeof number === "number" ? (
              <View style={[styles.metaPill, styles.metaPillNumber]}>
                <Text style={[styles.metaTxt, styles.metaTxtNumber]}>#{number}</Text>
              </View>
            ) : null}

            {team ? (
              <View style={[styles.metaPill, styles.metaPillTeam]}>
                <Text style={[styles.metaTxt, styles.metaTxtTeam]}>{team}</Text>
              </View>
            ) : null}

            <View style={[styles.metaPill, styles.metaPillYear]}>
              <Text style={[styles.metaTxt, styles.metaTxtYear]}>{year}</Text>
            </View>
          </View>
        </View>
      </View>

      {!!link && (
        <TouchableOpacity
          onPress={() => Linking.openURL(link)}
          style={styles.ffbsBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.ffbsBtnText}>Voir la fiche FFBS</Text>
          <Icon name="open-outline" size={16} color="#E5E7EB" />
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function JoueursScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [youngPlayers, setYoungPlayers] = useState<YoungPlayer[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCat, setSelectedCat] =
    useState<(typeof CATEGORIES)[number]>("Senior");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const flatListRef = useRef<FlatList<PlayerCardData>>(null);

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const { data: playersData, error: errorPlayers } = await supabase
          .from("players")
          .select("id, last_name, first_name, number, yob, player_link, team_abbr, status");

        const { data: ypData, error: ypErr } = await supabase
          .from("young_players")
          .select("id, first_name, last_name, date_naissance, categorie")
          .in("categorie", ["12U", "15U"]);

        if (!mounted) return;

        if (errorPlayers) {
          setErrorMsg(`Erreur Supabase players: ${errorPlayers.message}`);
        } else {
          setPlayers((playersData || []) as Player[]);
        }

        if (ypErr) {
          setErrorMsg((prev) => `${prev ? `${prev} | ` : ""}Erreur Supabase jeunes: ${ypErr.message}`);
        } else {
          setYoungPlayers((ypData || []) as YoungPlayer[]);
        }
      } catch (e: any) {
        if (!mounted) return;
        setErrorMsg(`Erreur cote application: ${e?.message || e}`);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, []);

  const allData = useMemo<PlayerCardData[]>(() => {
    if (selectedCat === "Senior") {
      return [...players.filter((p) => isActiveSenior(p.status))]
        .sort(
          (a, b) =>
            a.last_name.localeCompare(b.last_name) ||
            a.first_name.localeCompare(b.first_name)
        )
        .map((p) => ({
          id: String(p.id),
          first_name: p.first_name,
          last_name: p.last_name,
          year: p.yob ?? "--",
          link: p.player_link || "",
          number: p.number,
          team: p.team_abbr || "",
        }));
    }

    return youngPlayers
      .filter(
        (yp) =>
          (yp.categorie || "").toUpperCase() === selectedCat.toUpperCase()
      )
      .sort(
        (a, b) =>
          (a.last_name || "").localeCompare(b.last_name || "", "fr", {
            sensitivity: "base",
          }) ||
          (a.first_name || "").localeCompare(b.first_name || "", "fr", {
            sensitivity: "base",
          })
      )
      .map((yp) => {
        const year = getBirthYearFromDate(yp.date_naissance);
        return {
          id: String(yp.id),
          first_name: yp.first_name || "",
          last_name: yp.last_name || "",
          year: year ?? "--",
          link: "",
          number: undefined,
          team: "",
        };
      });
  }, [players, youngPlayers, selectedCat]);

  const dataToShow = useMemo(() => {
    const q = query.trim().toUpperCase();
    let base = allData;

    if (q) {
      base = base.filter(
        (it) =>
          (it.first_name || "").toUpperCase().includes(q) ||
          (it.last_name || "").toUpperCase().includes(q)
      );
    }

    if (activeLetter) {
      base = base.filter(
        (it) =>
          (it.last_name || "").toUpperCase().startsWith(activeLetter) ||
          (it.first_name || "").toUpperCase().startsWith(activeLetter)
      );
    }

    return base;
  }, [allData, query, activeLetter]);

  const counts = useMemo(() => {
    const senior = players.filter((p) => isActiveSenior(p.status)).length;
    const u15 = youngPlayers.filter((yp) => (yp.categorie || "").toUpperCase() === "15U").length;
    const u12 = youngPlayers.filter((yp) => (yp.categorie || "").toUpperCase() === "12U").length;

    return { Senior: senior, "15U": u15, "12U": u12 } as Record<
      (typeof CATEGORIES)[number],
      number
    >;
  }, [players, youngPlayers]);

  const totalPlayers = counts.Senior + counts["15U"] + counts["12U"];
  const hasAnyData = totalPlayers > 0;

  const onSelectCategory = useCallback((cat: (typeof CATEGORIES)[number]) => {
    setSelectedCat(cat);
    setActiveLetter(null);
    setQuery("");
    setShowFilter(false);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onClearFilters = useCallback(() => {
    setActiveLetter(null);
    setShowFilter(false);
  }, []);

  const renderItem = useCallback(({ item }: { item: PlayerCardData }) => {
    return (
      <PlayerCard
        first_name={item.first_name}
        last_name={item.last_name}
        year={item.year}
        link={item.link}
        number={item.number}
        team={item.team}
      />
    );
  }, []);

  const keyExtractor = useCallback((item: PlayerCardData) => item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.stateSafe}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.stateLoadingText}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (errorMsg && !hasAnyData) {
    return (
      <SafeAreaView style={styles.stateSafe}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.stateErrorText}>{errorMsg}</Text>
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
            <DrawerMenuButton style={styles.backBtn} />

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Joueurs Comets</Text>
              <Text style={styles.heroSub}>Saison {new Date().getFullYear()}</Text>
            </View>

            <LogoutButton />
          </View>

          <View style={styles.heroMetaCompactRow}>
            <Text style={styles.heroMetaText}>{totalPlayers} joueurs references</Text>
            <View style={styles.heroPill}>
              <Icon name="people-outline" size={13} color="#FFDDBA" />
              <Text style={styles.heroPillText}>{selectedCat}</Text>
            </View>
          </View>

          <View style={styles.tabs}>
            {CATEGORIES.map((cat) => {
              const active = selectedCat === cat;
              const meta = CATEGORY_META[cat];

              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => onSelectCategory(cat)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  activeOpacity={0.9}
                >
                  <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                    <Icon name={meta.icon as any} size={14} color={active ? "#111827" : meta.tone} />
                  </View>
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                    {meta.label} ({counts[cat] ?? 0})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Icon name="search-outline" size={18} color="#AAB2C2" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher un joueur"
                placeholderTextColor="#9BA5B8"
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery("")} style={styles.clearBtn}>
                  <Icon name="close" size={16} color="#AAB2C2" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setShowFilter((v) => !v)}
              activeOpacity={0.85}
              style={[styles.filterChip, (showFilter || !!activeLetter) && styles.filterChipActive]}
            >
              <Icon
                name="funnel-outline"
                size={15}
                color={(showFilter || !!activeLetter) ? "#111827" : "#FF9E3A"}
              />
              <Text
                style={[
                  styles.filterChipText,
                  (showFilter || !!activeLetter) && styles.filterChipTextActive,
                ]}
              >
                {activeLetter ? `Lettre ${activeLetter}` : "Filtre"}
              </Text>
            </TouchableOpacity>
          </View>

          {showFilter && (
            <View style={styles.alphaRow}>
              <TouchableOpacity
                style={[styles.alphaBtn, !activeLetter && styles.alphaBtnActive]}
                onPress={onClearFilters}
                activeOpacity={0.8}
              >
                <Text style={[styles.alphaBtnText, !activeLetter && styles.alphaBtnTextActive]}>TOUT</Text>
              </TouchableOpacity>

              {ALPHABET.map((letter) => (
                <TouchableOpacity
                  key={letter}
                  style={[styles.alphaBtn, activeLetter === letter && styles.alphaBtnActive]}
                  onPress={() => {
                    setActiveLetter(letter);
                    setShowFilter(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.alphaBtnText, activeLetter === letter && styles.alphaBtnTextActive]}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </LinearGradient>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={dataToShow}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            errorMsg ? (
              <View style={styles.warningCard}>
                <Icon name="alert-circle-outline" size={16} color="#F59E0B" />
                <Text style={styles.warningText}>{errorMsg}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyTxt}>Aucun joueur a afficher dans cette categorie.</Text>
          }
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 240)}
          scrollEventThrottle={16}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={Platform.OS === "android"}
        />

        {showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtn}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
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
  safe: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  stateSafe: {
    flex: 1,
    backgroundColor: "#0B0F17",
    alignItems: "center",
    justifyContent: "center",
  },
  stateLoadingText: {
    color: "#FF8200",
    fontWeight: "800",
    fontSize: 18,
  },
  stateErrorText: {
    color: "#F87171",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
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
    fontSize: 11.5,
  },
  tabBtnTextActive: {
    color: "#111827",
    fontWeight: "800",
  },

  searchRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    color: "#F3F4F6",
    fontSize: 13.5,
    fontWeight: "600",
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  filterChip: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: "#FF9E3A",
    borderColor: "#FFBD80",
  },
  filterChipText: {
    color: "#FF9E3A",
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: "#111827",
  },
  alphaRow: {
    marginTop: 7,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
  },
  alphaBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  alphaBtnActive: {
    backgroundColor: "#FF8200",
    borderColor: "#FFB366",
  },
  alphaBtnText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 11.5,
  },
  alphaBtnTextActive: {
    color: "#111827",
    fontWeight: "800",
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
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
  emptyTxt: {
    color: "#AAB2C2",
    fontSize: 15,
    textAlign: "center",
    marginTop: 34,
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1523",
    borderWidth: 2,
    borderColor: "#FF9E3A",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFE4C6",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 0.8,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    color: "#F3F4F6",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  metaPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaPillNumber: {
    backgroundColor: "rgba(255,130,0,0.24)",
    borderColor: "rgba(255,195,130,0.65)",
  },
  metaPillTeam: {
    backgroundColor: "rgba(59,130,246,0.22)",
    borderColor: "rgba(147,197,253,0.6)",
  },
  metaPillYear: {
    backgroundColor: "rgba(16,185,129,0.22)",
    borderColor: "rgba(110,231,183,0.65)",
  },
  metaTxt: {
    fontWeight: "800",
    fontSize: 11.5,
  },
  metaTxtNumber: {
    color: "#FFE2C2",
  },
  metaTxtTeam: {
    color: "#DBEAFE",
  },
  metaTxtYear: {
    color: "#D1FAE5",
  },
  ffbsBtn: {
    marginTop: 11,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  ffbsBtnText: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 12.5,
  },

  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 25,
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
