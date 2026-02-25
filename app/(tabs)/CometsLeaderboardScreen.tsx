// app/screens/CometsLeaderboardScreen.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import { supabase } from "../../supabase";
import { useAdmin } from "../../contexts/AdminContext";

const logoComets = require("../../assets/images/iconComets.png");

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
  admins: AdminInfo | null; // ← jointure
};

type RawRow = Omit<Row, "admins"> & {
  admins: AdminInfo | AdminInfo[] | null;
};

export default function CometsLeaderboardScreen() {
  const { admin, isAdmin } = useAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const makeDisplayName = useMemo(() => {
    return (r: Row) => {
      const ln = r.admins?.last_name?.trim() || "";
      const fn = r.admins?.first_name?.trim() || "";
      if (ln || fn) return `${ln.toUpperCase()} ${fn}`.trim();
      if (isAdmin) return r.admins?.email || "Joueur";
      return "Joueur";
    };
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("game_profiles")
      .select("admin_id, best_score, total_runs, last_run_at, admins(first_name,last_name,email)")
      .order("best_score", { ascending: false })
      .limit(50);

    if (error) {
      console.log("leaderboard error:", error.message);
      setRows([]);
    } else {
      const normalizedRows: Row[] = ((data ?? []) as RawRow[]).map((r) => ({
        admin_id: r.admin_id,
        best_score: r.best_score,
        total_runs: r.total_runs,
        last_run_at: r.last_run_at,
        admins: Array.isArray(r.admins) ? (r.admins[0] ?? null) : (r.admins ?? null),
      }));
      setRows(normalizedRows);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* ===== HERO (style LoginScreen) ===== */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <Pressable
            onPress={() => {
              try {
                require("expo-router").router.back();
              } catch {}
            }}
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
            <Text style={styles.heroSub}>Top 50 meilleurs scores du jeu.</Text>
          </View>
        </View>
      </View>
      {/* ===== FIN HERO ===== */}

      <FlatList
        data={rows}
        keyExtractor={(it) => it.admin_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#FF8200" />}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        renderItem={({ item, index }) => {
          const isMe = admin?.id === item.admin_id;
          const rank = index + 1;
          const name = makeDisplayName(item);

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
                <Text style={{ color: "#ffd166", fontWeight: "900", width: 28, textAlign: "center" }}>#{rank}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#e5e7eb", fontWeight: "800" }}>{name}</Text>
                  {isAdmin && item.admins?.email ? (
                    <Text style={{ color: "#9ca3af", fontSize: 12 }}>{item.admins.email}</Text>
                  ) : null}
                </View>
                <Text style={{ color: "#22d3ee", fontWeight: "900" }}>{item.best_score}</Text>
              </View>

              {isAdmin ? (
                <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>Parties : {item.total_runs}</Text>
                  {item.last_run_at && (
                    <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                      Dernier run : {new Date(item.last_run_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 24 }}>Pas de scores pour l’instant.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // === HERO ===
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
});
