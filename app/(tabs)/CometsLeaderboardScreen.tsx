// app/screens/CometsLeaderboardScreen.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Image,
  StatusBar,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

const logoComets = require("../../assets/images/iconComets.png");
const WEEK_WINDOW_DAYS = 7;

type Scope = "all_time" | "weekly";

type AdminInfo = {
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
};

type Row = {
  admin_id: string;
  best_score: number;
  total_runs: number;
  last_run_at: string | null;
  equipped_title: string | null;
  equipped_trail: string | null;
  equipped_theme: string | null;
  public_near_misses: number;
  public_missions_done: number;
  admins: AdminInfo | null;
};

type RawProfileRow = Omit<Row, "admins"> & {
  admins: AdminInfo | AdminInfo[] | null;
};

type RawRunRow = {
  admin_id: string | null;
  score: number | null;
  created_at: string | null;
};

type RawProfileIdentityRow = {
  admin_id: string;
  equipped_title?: string | null;
  equipped_trail?: string | null;
  equipped_theme?: string | null;
  public_near_misses?: number | null;
  public_missions_done?: number | null;
  admins: AdminInfo | AdminInfo[] | null;
};

function formatEquipLabel(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeAdmin(admins: AdminInfo | AdminInfo[] | null): AdminInfo | null {
  if (Array.isArray(admins)) return admins[0] ?? null;
  return admins ?? null;
}

function toSafeTime(input: string | null) {
  const t = input ? new Date(input).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

export default function CometsLeaderboardScreen() {
  const { admin, isAdmin } = useAdmin();
  const [scope, setScope] = useState<Scope>("weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const makeDisplayName = useMemo(() => {
    return (row: Row) => {
      const ln = row.admins?.last_name?.trim() || "";
      const fn = row.admins?.first_name?.trim() || "";
      if (ln || fn) return `${ln.toUpperCase()} ${fn}`.trim();
      if (isAdmin) return row.admins?.email || "Joueur";
      return "Joueur";
    };
  }, [isAdmin]);

  const fetchAllTime = useCallback(async () => {
    const { data, error } = await supabase
      .from("game_profiles")
      .select("admin_id, best_score, total_runs, last_run_at, equipped_title, equipped_trail, equipped_theme, public_near_misses, public_missions_done, admins(first_name,last_name,email)")
      .order("best_score", { ascending: false })
      .limit(50);

    if (error) {
      console.log("leaderboard all-time error:", error.message);
      setRows([]);
      return;
    }

    const normalizedRows: Row[] = ((data ?? []) as RawProfileRow[]).map((row) => ({
      admin_id: row.admin_id,
      best_score: Math.max(0, Math.floor(Number(row.best_score ?? 0))),
      total_runs: Math.max(0, Math.floor(Number(row.total_runs ?? 0))),
      last_run_at: row.last_run_at ?? null,
      equipped_title: typeof row.equipped_title === "string" ? row.equipped_title : null,
      equipped_trail: typeof row.equipped_trail === "string" ? row.equipped_trail : null,
      equipped_theme: typeof row.equipped_theme === "string" ? row.equipped_theme : null,
      public_near_misses: Math.max(0, Math.floor(Number(row.public_near_misses ?? 0))),
      public_missions_done: Math.max(0, Math.floor(Number(row.public_missions_done ?? 0))),
      admins: normalizeAdmin(row.admins),
    }));
    setRows(normalizedRows);
  }, []);

  const fetchWeekly = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - WEEK_WINDOW_DAYS);

    const { data, error } = await supabase
      .from("game_runs")
      .select("admin_id, score, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(4000);

    if (error) {
      console.log("leaderboard weekly error:", error.message);
      setRows([]);
      return;
    }

    const byAdmin = new Map<string, Row>();
    for (const raw of (data ?? []) as RawRunRow[]) {
      const adminId = String(raw.admin_id ?? "").trim();
      if (!adminId) continue;

      const score = Math.max(0, Math.floor(Number(raw.score ?? 0)));
      const runDate = raw.created_at ?? null;

      const existing = byAdmin.get(adminId);
      if (!existing) {
        byAdmin.set(adminId, {
          admin_id: adminId,
          best_score: score,
          total_runs: 1,
          last_run_at: runDate,
          equipped_title: null,
          equipped_trail: null,
          equipped_theme: null,
          public_near_misses: 0,
          public_missions_done: 0,
          admins: null,
        });
        continue;
      }

      existing.best_score = Math.max(existing.best_score, score);
      existing.total_runs += 1;
      if (toSafeTime(runDate) > toSafeTime(existing.last_run_at)) {
        existing.last_run_at = runDate;
      }
    }

    const ids = Array.from(byAdmin.keys());
    if (ids.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("game_profiles")
        .select("admin_id, equipped_title, equipped_trail, equipped_theme, public_near_misses, public_missions_done, admins(first_name,last_name,email)")
        .in("admin_id", ids);

      if (profileError) {
        console.log("leaderboard weekly profile error:", profileError.message);
      } else {
        for (const profile of (profileData ?? []) as RawProfileIdentityRow[]) {
          const target = byAdmin.get(profile.admin_id);
          if (!target) continue;
          target.admins = normalizeAdmin(profile.admins);
          target.equipped_title = typeof profile.equipped_title === "string" ? profile.equipped_title : null;
          target.equipped_trail = typeof profile.equipped_trail === "string" ? profile.equipped_trail : null;
          target.equipped_theme = typeof profile.equipped_theme === "string" ? profile.equipped_theme : null;
          target.public_near_misses = Math.max(0, Math.floor(Number(profile.public_near_misses ?? 0)));
          target.public_missions_done = Math.max(0, Math.floor(Number(profile.public_missions_done ?? 0)));
        }
      }
    }

    const ranked = Array.from(byAdmin.values())
      .sort((a, b) => {
        if (b.best_score !== a.best_score) return b.best_score - a.best_score;
        if (b.total_runs !== a.total_runs) return b.total_runs - a.total_runs;
        return toSafeTime(b.last_run_at) - toSafeTime(a.last_run_at);
      })
      .slice(0, 50);

    setRows(ranked);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (scope === "weekly") {
        await fetchWeekly();
      } else {
        await fetchAllTime();
      }
    } finally {
      setLoading(false);
    }
  }, [fetchAllTime, fetchWeekly, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heroSubtitle =
    scope === "weekly"
      ? `Top 50 des ${WEEK_WINDOW_DAYS} derniers jours.`
      : "Top 50 meilleurs scores du jeu.";

  const mySummary = useMemo(() => {
    const myId = admin?.id ?? null;
    if (!myId || rows.length === 0) return null;
    const myIndex = rows.findIndex((row) => row.admin_id === myId);
    if (myIndex < 0) return null;
    const myRow = rows[myIndex];
    const above = myIndex > 0 ? rows[myIndex - 1] : null;
    const podium = rows.length >= 3 ? rows[2] : null;
    const podiumGap = podium && myIndex > 2 ? Math.max(1, podium.best_score - myRow.best_score) : null;
    const rivalGap = above ? Math.max(1, above.best_score - myRow.best_score) : null;
    return {
      rank: myIndex + 1,
      score: myRow.best_score,
      rivalName: above ? makeDisplayName(above) : null,
      rivalGap,
      podiumGap,
    };
  }, [admin?.id, makeDisplayName, rows]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </Pressable>

          <Text style={styles.heroTitle}>Classement</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Comets</Text>
            <Text style={styles.heroSub}>{heroSubtitle}</Text>
          </View>
        </View>

        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope("all_time")}
            style={[styles.scopeBtn, scope === "all_time" && styles.scopeBtnActive]}
          >
            <Text style={[styles.scopeBtnText, scope === "all_time" && styles.scopeBtnTextActive]}>
              All-time
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope("weekly")}
            style={[styles.scopeBtn, scope === "weekly" && styles.scopeBtnActive]}
          >
            <Text style={[styles.scopeBtnText, scope === "weekly" && styles.scopeBtnTextActive]}>
              7 jours
            </Text>
          </Pressable>
        </View>

        {mySummary && (
          <View style={styles.mySummaryCard}>
            <Text style={styles.mySummaryTitle}>Votre position</Text>
            <Text style={styles.mySummaryRank}>#{mySummary.rank} · {mySummary.score} pts</Text>
            {!!mySummary.rivalGap && !!mySummary.rivalName && (
              <Text style={styles.mySummaryText}>
                Encore {mySummary.rivalGap} pts pour passer {mySummary.rivalName}
              </Text>
            )}
            {!mySummary.rivalGap && (
              <Text style={styles.mySummaryText}>Vous tenez la tête. Défendez votre place.</Text>
            )}
            {!!mySummary.podiumGap && (
              <Text style={styles.mySummarySub}>Podium à {mySummary.podiumGap} pts</Text>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.admin_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#FF8200" />}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        renderItem={({ item, index }) => {
          const isMe = admin?.id === item.admin_id;
          const rank = index + 1;
          const name = makeDisplayName(item);
          const titleLabel = formatEquipLabel(item.equipped_title);
          const trailLabel = formatEquipLabel(item.equipped_trail);
          const themeLabel = formatEquipLabel(item.equipped_theme);

          return (
            <View
              style={{
                backgroundColor: isMe ? "#1f2937" : "rgba(255,255,255,0.06)",
                borderColor: isMe ? "#334155" : "rgba(255,130,0,0.22)",
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: "#ffd166", fontWeight: "900", width: 28, textAlign: "center" }}>
                  #{rank}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#e5e7eb", fontWeight: "800" }}>{name}</Text>
                  {(titleLabel || trailLabel || themeLabel) && (
                    <View style={styles.cosmeticRow}>
                      {titleLabel ? <Text style={[styles.cosmeticTag, styles.cosmeticTagTitle]}>{titleLabel}</Text> : null}
                      {trailLabel ? <Text style={styles.cosmeticTag}>{trailLabel}</Text> : null}
                      {themeLabel ? <Text style={styles.cosmeticTag}>{themeLabel}</Text> : null}
                    </View>
                  )}
                  {isAdmin && item.admins?.email ? (
                    <Text style={{ color: "#9ca3af", fontSize: 12 }}>{item.admins.email}</Text>
                  ) : null}
                </View>
                <Text style={{ color: "#22d3ee", fontWeight: "900" }}>{item.best_score}</Text>
              </View>

              {!isAdmin ? (
                <View style={styles.publicStatsRow}>
                  <Text style={styles.publicStatText}>Near-miss: {item.public_near_misses}</Text>
                  <Text style={styles.publicStatText}>Missions: {item.public_missions_done}</Text>
                </View>
              ) : null}

              {isAdmin ? (
                <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                    {scope === "weekly" ? "Runs 7j" : "Parties"} : {item.total_runs}
                  </Text>
                  {item.last_run_at ? (
                    <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                      Dernier run : {new Date(item.last_run_at).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 24 }}>
              {scope === "weekly" ? "Aucun score sur 7 jours." : "Pas de scores pour le moment."}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  heroRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
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
  heroProfileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 12 },
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
  scopeRow: {
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  mySummaryCard: {
    marginTop: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.25)",
    backgroundColor: "rgba(9,36,51,0.42)",
  },
  mySummaryTitle: {
    color: "#9bdcf2",
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mySummaryRank: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  mySummaryText: {
    marginTop: 4,
    color: "#dce7f6",
    fontSize: 12.5,
    fontWeight: "700",
  },
  mySummarySub: {
    marginTop: 3,
    color: "#fbd38d",
    fontSize: 11.5,
    fontWeight: "800",
  },
  cosmeticRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  cosmeticTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#dce7f6",
    fontSize: 10.5,
    fontWeight: "800",
  },
  cosmeticTagTitle: {
    backgroundColor: "rgba(255,130,0,0.18)",
    color: "#ffd69e",
  },
  publicStatsRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 12,
  },
  publicStatText: {
    color: "#9ca3af",
    fontSize: 11.5,
    fontWeight: "700",
  },
  scopeBtn: {
    borderWidth: 1,
    borderColor: "#2f3647",
    backgroundColor: "#171c27",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scopeBtnActive: {
    borderColor: "#FF8200",
    backgroundColor: "rgba(255,130,0,0.14)",
  },
  scopeBtnText: {
    color: "#c7cad1",
    fontSize: 12.5,
    fontWeight: "800",
  },
  scopeBtnTextActive: {
    color: "#FFB35B",
  },
});
