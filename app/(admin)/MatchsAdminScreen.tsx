// app/screens/MatchsAdminScreen.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useAdmin } from "../../contexts/AdminContext";

const logoComets = require("../../assets/images/iconComets.png");

// ================== API utils (aligné avec MatchsScreen) ==================
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

// ================== Types ==================
type Participant = { id: string; first_name: string; last_name: string };
type AdminMatchItem = {
  match_id: string;
  date: string;
  opponent: string;
  is_home: boolean;
  note: string | null;
  count: number;
  participants: Participant[];
};
type ApiResp = { items: AdminMatchItem[] };

// ================== Helpers ==================
function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ================== Screen ==================
export default function MatchsAdminScreen() {
  const navigation = useNavigation();
  const { isAdmin } = useAdmin();

  const [items, setItems] = useState<AdminMatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setErr(null);
    try {
      const resp = await apiGet<ApiResp>("/api/admin/match/participants");
      setItems(resp.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await apiGet<ApiResp>("/api/admin/match/participants");
      setItems(resp.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur réseau");
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f1014", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold", textAlign: "center" }}>
          Accès réservé aux admins.
        </Text>
      </View>
    );
  }

  const toggle = (mid: string) =>
    setExpanded((m) => ({ ...m, [mid]: !m[mid] }));

  const Header = () => (
    <View
      style={[
        styles.hero,
        { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 12 : 22 },
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
                (navigation as any).navigate("AdminMenuScreen")
          }
          style={styles.backBtnHero}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.9}
        >
          <Icon name="chevron-back" size={26} color="#FF8200" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Matchs — Participations</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.heroProfileRow}>
        <View style={styles.heroAvatar}>
          <Icon name="calendar-outline" size={26} color="#FF8200" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName}>Suivi des inscrits</Text>
          <Text style={styles.heroEmail}>Liste des joueurs par match</Text>
        </View>
        <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
      </View>
    </View>
  );

  const ItemCard = ({ it }: { it: AdminMatchItem }) => {
    const isOpen = !!expanded[it.match_id];
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.matchDate}>{formatDate(it.date)}</Text>
            <Text style={styles.matchTitle}>
              {it.is_home ? "🏠 Domicile" : "✈️ Extérieur"} • Honfleur vs {it.opponent}
            </Text>
            {!!it.note && <Text style={styles.noteTxt}>{it.note}</Text>}
          </View>

          <View style={styles.countBadge}>
            <Icon name="people-outline" size={16} color="#FF8200" />
            <Text style={styles.countTxt}>{it.count}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => toggle(it.match_id)}
          activeOpacity={0.9}
          style={styles.toggleBtn}
        >
          <Text style={styles.toggleTxt}>
            {isOpen ? "Masquer les participants" : "Voir les participants"}
          </Text>
          <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#fff" />
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.participantsWrap}>
            {it.participants.length === 0 ? (
              <Text style={styles.emptyTxt}>Aucun inscrit pour le moment.</Text>
            ) : (
              it.participants.map((p) => (
                <View key={p.id} style={styles.participantRow}>
                  <Icon name="person-circle-outline" size={18} color="#cfd3db" />
                  <Text style={styles.participantName}>
                    {p.first_name || "—"} {p.last_name || ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />
      <Header />

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator />
          <Text style={styles.loaderTxt}>Chargement…</Text>
        </View>
      ) : err ? (
        <View style={styles.loaderBox}>
          <Text style={styles.errorTxt}>{err}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.match_id}
          contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8200" />}
          ListEmptyComponent={<Text style={styles.emptyTxt}>Aucun match à venir.</Text>}
          renderItem={({ item }) => <ItemCard it={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // HERO
  hero: {
    backgroundColor: "#11131a",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
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
    paddingTop: Platform.OS === "ios" ? 10 : 6,
  },
  backBtnHero: {
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
    paddingTop: 12,
    gap: 14,
  },
  heroAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#18181C",
    borderWidth: 3,
    borderColor: "#FF8200",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  heroEmail: { color: "#c7cad1", fontSize: 13 },

  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
  },

  // LIST
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", marginTop: 8, fontWeight: "bold" },
  errorTxt: { color: "tomato", textAlign: "center", paddingHorizontal: 20 },

  // Card
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },
  cardTopRow: { flexDirection: "row", alignItems: "center" },
  matchDate: { color: "#d5d8df", fontWeight: "700", fontSize: 13.5 },
  matchTitle: { color: "#fff", fontWeight: "900", fontSize: 15, marginTop: 2 },

  countBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,130,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countTxt: { color: "#FF8200", fontWeight: "900" },

  toggleBtn: {
    marginTop: 10,
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleTxt: { color: "#fff", fontWeight: "800" },

  participantsWrap: { marginTop: 10, gap: 8 },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "#252a38",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  participantName: { color: "#eaeef7", fontWeight: "700" },

  emptyTxt: { color: "#9aa0ae", fontSize: 14, textAlign: "center", marginTop: 8 },

  noteTxt: { color: "#FF8200", fontWeight: "bold", fontSize: 12.5, marginTop: 6 },
});
