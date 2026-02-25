// app/(admin)/cotisation.tsx
"use client";

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { AdminHero } from "../../components/admin/AdminHero";
import { getSupabase } from "../../lib/supabase";
import { useAdmin } from "../../contexts/AdminContext";


// ===== Types & helpers =====
type Cotisation = {
  id: number;
  nom: string;
  prenom: string;
  date_naissance: string | null;
  email: string;
  montant_eur: number;
  statut: string;
  paid_at: string | null;
  stripe_id: string;
};

function formatDateFR(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
}
function formatEUR(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} €`;
  }
}
// âge au 31/12
function ageAu31Dec(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ref = new Date(new Date().getFullYear(), 11, 31);
  let age = ref.getFullYear() - d.getFullYear();
  if (ref < new Date(ref.getFullYear(), d.getMonth(), d.getDate())) age -= 1;
  return age;
}
type Cat = "Tous" | "12U" | "15U" | "Seniors";
const CATS: Cat[] = ["Tous", "12U", "15U", "Seniors"];
const getCat = (dn: string | null): Exclude<Cat, "Tous"> => {
  const a = ageAu31Dec(dn);
  if (a !== null && a <= 12) return "12U";
  if (a !== null && a <= 15) return "15U";
  return "Seniors";
};

export default function CotisationAdminScreen() {
  const router = useRouter();
  const { isAdmin } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Cotisation[]>([]);
  const [cat, setCat] = useState<Cat>("Tous");

  const listRef = useRef<FlatList<Cotisation>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("cotisations")
        .select("id, nom, prenom, date_naissance, email, montant_eur, statut, paid_at, stripe_id")
        .order("paid_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      setRows(
        (data || []).map((r: any) => ({
          id: r.id,
          nom: r.nom ?? "",
          prenom: r.prenom ?? "",
          date_naissance: r.date_naissance ?? null,
          email: r.email ?? "",
          montant_eur: Number(r.montant_eur ?? 0) || 0,
          statut: r.statut ?? "",
          paid_at: r.paid_at ?? null,
          stripe_id: r.stripe_id ?? "",
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Filtres (sans recherche)
  const filtered = useMemo(() => {
    return rows.filter((r) => (cat === "Tous" ? true : getCat(r.date_naissance) === cat));
  }, [rows, cat]);

  // Total général (uniquement pour l'onglet "Tous")
  const totalGeneral = useMemo(() => {
    if (cat !== "Tous") return 0;
    return filtered.reduce((s, r) => s + (Number(r.montant_eur) || 0), 0);
  }, [filtered, cat]);

  // Actions
  const openStripe = (id: string) =>
    id &&
    Linking.openURL(`https://dashboard.stripe.com/payments/${id}`).catch(() =>
      Alert.alert("Erreur", "Impossible d’ouvrir Stripe.")
    );

  const mailTo = (email: string) =>
    email &&
    Linking.openURL(`mailto:${encodeURIComponent(email)}`).catch(() =>
      Alert.alert("Erreur", "Impossible d’ouvrir l’e-mail.")
    );

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold", textAlign: "center", paddingHorizontal: 24 }}>
          Accès réservé aux administrateurs.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />
      <AdminHero
        title="Cotisations"
        subtitle="Paiements recus - Filtre par categorie"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />

      {/* FILTRES */}
      <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 }}>
        <View style={styles.filtersRow}>
          {CATS.map((c) => {
            const active = cat === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCat(c)}
                activeOpacity={0.9}
                style={[
                  styles.filterChip,
                  {
                    borderColor: active ? "rgba(255,130,0,0.8)" : "rgba(255,130,0,0.35)",
                    backgroundColor: active ? "rgba(255,130,0,0.12)" : "transparent",
                  },
                ]}
              >
                <Text style={[styles.filterChipTxt, { color: active ? "#FF8200" : "#eaeef7" }]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* LISTE */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.loaderTxt}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={styles.loaderBox}>
          <Text style={[styles.loaderTxt, { color: "#ffb4a8" }]}>Erreur : {error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTxt}>Aucune cotisation ne correspond au filtre.</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 260)}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80, paddingTop: 12 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                {/* top line */}
                <View style={styles.cardTopRow}>
                  <Text style={styles.nameTxt} numberOfLines={1}>
                    {item.nom} {item.prenom}
                  </Text>
                  <Text style={styles.dateTxt}>{formatDateFR(item.paid_at)}</Text>
                </View>

                {/* email / stripe */}
                {!!item.email && (
                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      onPress={() => mailTo(item.email)}
                      activeOpacity={0.9}
                      style={[styles.chip, { backgroundColor: "rgba(255,130,0,0.12)", borderColor: "rgba(255,130,0,0.35)" }]}
                    >
                      <Icon name="mail-outline" size={14} color="#FF8200" />
                      <Text style={[styles.chipTxt, { color: "#FF8200" }]} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </TouchableOpacity>

                    {!!item.stripe_id && (
                      <TouchableOpacity
                        onPress={() => openStripe(item.stripe_id)}
                        activeOpacity={0.9}
                        style={[styles.chip, { backgroundColor: "rgba(33,150,243,0.12)", borderColor: "rgba(33,150,243,0.35)" }]}
                      >
                        <Icon name="card-outline" size={14} color="#2196F3" />
                        <Text style={[styles.chipTxt, { color: "#2196F3" }]} numberOfLines={1}>
                          Voir paiement Stripe
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* body */}
                <Text style={styles.bodyTxt}>
                  Date de naissance : {formatDateFR(item.date_naissance) || "—"}
                </Text>
                <Text style={styles.bodyTxt}>
                  Montant : <Text style={{ fontWeight: "900", color: "#FFCDD2" }}>{formatEUR(item.montant_eur)}</Text>
                </Text>
                <Text style={styles.bodyTxt}>Statut : {item.statut || "—"}</Text>
              </View>
            )}
          />

          {/* Scroll-to-top */}
          {showScrollTop && (
            <TouchableOpacity
              style={styles.scrollTopBtn}
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              activeOpacity={0.85}
            >
              <Icon name="chevron-up" size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* TOTAL GÉNÉRAL — seulement quand "Tous" */}
      {cat === "Tous" && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 18 }}>
          <Text
            style={{
              textAlign: "center",
              color: "#eaeef7",
              fontSize: 15,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            Total général : <Text style={{ color: "#eaeef7" }}>{formatEUR(totalGeneral)}</Text>
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Filtres
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipTxt: {
    fontWeight: "900",
    fontSize: 12.5,
    letterSpacing: 0.3,
  },

  // Loader / Empty
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", marginTop: 10, fontWeight: "bold", fontSize: 16 },
  emptyBox: {
    padding: 16,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  emptyTxt: { color: "#cfd3db", fontSize: 15, textAlign: "center" },

  // Card
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  nameTxt: { color: "#eaeef7", fontWeight: "900", fontSize: 17, flexShrink: 1, maxWidth: "60%" },
  dateTxt: { color: "#9aa0ae", fontSize: 12.5, fontWeight: "700" },

  chipsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipTxt: { fontWeight: "800", fontSize: 12.5 },

  bodyTxt: { color: "#e6e7eb", fontSize: 15, lineHeight: 21, marginTop: 10 },

  // Scroll-to-top
  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF8200",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#FF8200",
  },
});

