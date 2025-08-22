// app/screens/AdminMatchsScreen.tsx
"use client";

import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  UIManager,
  Image as RNImage,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LOGOS: Record<string, any> = {
  Rouen: require("../../assets/images/Rouen.jpg"),
  "Le Havre": require("../../assets/images/Le_Havre.png"),
  Cherbourg: require("../../assets/images/Cherbourg.jpg"),
  Caen: require("../../assets/images/Caen.png"),
  "Les Andelys": require("../../assets/images/les_Andelys.png"),
  Louviers: require("../../assets/images/Louviers.png"),
};
const ADVERSAIRES = ["Rouen", "Le Havre", "Cherbourg", "Caen", "Les Andelys", "Louviers"];
const CATEGORIES = ["Seniors", "15U", "12U"] as const;
const FILTERS = ["Tous", ...CATEGORIES] as const;

const logoComets = require("../../assets/images/iconComets.png");

// 🔶 Form inclut categorie
const initialForm = {
  date: "",
  opponent: "",
  is_home: true,
  note: "",
  categorie: "Seniors" as (typeof CATEGORIES)[number],
};

export default function AdminMatchsScreen({ navigation }: any) {
  const { isAdmin } = useAdmin();
  const router = useRouter();

  const [matchs, setMatchs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...initialForm });

  // Sous-onglets de filtre
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("Tous");

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const dropdownBtnRef = useRef<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Accordéon formulaire
  const [showForm, setShowForm] = useState(false);
  const toggleForm = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowForm((s) => !s);
  };

  async function fetchMatchs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches_planned")
      .select("*")
      .order("date", { ascending: true });
    if (!error && data) setMatchs(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchMatchs();
  }, [isAdmin]);

  function handleChange(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openDatePicker() {
    setShowDatePicker(true);
  }
  function onDateChange(_: any, selectedDate?: Date) {
    setShowDatePicker(false);
    if (selectedDate) handleChange("date", selectedDate.toISOString().slice(0, 10));
  }

  async function handleSave() {
    if (!form.date || !form.opponent) {
      Alert.alert("Champ requis", "Date et adversaire sont obligatoires.");
      return;
    }
    if (!form.categorie || !CATEGORIES.includes(form.categorie as any)) {
      Alert.alert("Catégorie requise", "Choisis une catégorie : Seniors, 15U ou 12U.");
      return;
    }

    setLoading(true);
    try {
      const row = {
        date: form.date,
        opponent: form.opponent,
        is_home: form.is_home,
        note: form.note || null,
        logo: null,
        categorie: form.categorie,
      };

      if (editId) {
        await supabase.from("matches_planned").update(row).eq("id", editId);
      } else {
        await supabase.from("matches_planned").insert([row]);
      }

      setForm({ ...initialForm });
      setEditId(null);
      fetchMatchs();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    Alert.alert("Supprimer ce match ?", "Confirmer la suppression du match.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          await supabase.from("matches_planned").delete().eq("id", id);
          fetchMatchs();
          setLoading(false);
        },
      },
    ]);
  }

  function handleEdit(m: any) {
    setForm({
      date: m.date ? String(m.date).slice(0, 10) : "",
      opponent: m.opponent,
      is_home: m.is_home,
      note: m.note || "",
      categorie: m.categorie && CATEGORIES.includes(m.categorie) ? m.categorie : "Seniors",
    });
    setEditId(m.id);
    // Ouvre le formulaire si on édite
    if (!showForm) toggleForm();
  }

  function getLogo(opponent: string) {
    return LOGOS[opponent] || null;
  }

  // Ferme la liste déroulante d'adversaires si on quitte l'écran
  useEffect(() => {
    if (!dropdownVisible) return;
    const close = () => setDropdownVisible(false);
    const sub = navigation?.addListener?.("blur", close);
    return () => sub && sub();
  }, [dropdownVisible]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold" }}>Accès réservé aux admins !</Text>
      </SafeAreaView>
    );
  }

  const screenHeight = Dimensions.get("window").height;

  // 🔎 Applique le filtre de catégorie
  const filteredMatchs =
    activeFilter === "Tous" ? matchs : matchs.filter((m) => m.categorie === activeFilter);

  // Petits compteurs dans les onglets (optionnel)
  const counts = {
    Tous: matchs.length,
    Seniors: matchs.filter((m) => m.categorie === "Seniors").length,
    "15U": matchs.filter((m) => m.categorie === "15U").length,
    "12U": matchs.filter((m) => m.categorie === "12U").length,
  } as const;

  // ---------- HEADER collant : Barre + (Form accordéon) + Onglets ----------
  const StickyHeader = () => (
    <View style={styles.stickyHeaderWrap}>
      {/* Barre compacte */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : navigation?.goBack?.())}
          style={styles.toolbarBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-back" size={20} color="#FF8200" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.toolbarTitle}>Matchs à venir (admin)</Text>
        </View>

        <TouchableOpacity style={[styles.addBtn]} onPress={toggleForm} activeOpacity={0.9}>
          <Icon name={showForm || editId ? "remove-circle-outline" : "add-circle-outline"} size={18} color="#fff" />
          <Text style={styles.addBtnTxt}>{showForm || editId ? "Fermer" : "Ajouter un match"}</Text>
        </TouchableOpacity>
      </View>

      {/* Formulaire déroulant */}
      {showForm && (
        <View style={[styles.card, { marginHorizontal: 12, marginBottom: 8, marginTop: 6 }]}>
          <Text style={styles.cardTitle}>{editId ? "Modifier un match" : "Ajouter un match"}</Text>

          {/* Date */}
          <TouchableOpacity style={styles.rowBetween} onPress={openDatePicker}>
            <Text style={styles.label}>Date</Text>
            <View style={styles.inputPill}>
              <Text style={styles.inputPillTxt}>{form.date || "Choisir une date"}</Text>
              <Icon name="calendar-outline" size={18} color="#b36a00" />
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={form.date ? new Date(form.date) : new Date()}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date("2023-01-01")}
              maximumDate={new Date("2030-12-31")}
            />
          )}

          {/* Adversaire */}
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Adversaire</Text>
            <TouchableOpacity
              ref={dropdownBtnRef}
              style={styles.inputPill}
              onPress={() => {
                dropdownBtnRef.current?.measure?.(
                  (fx: number, fy: number, width: number, height: number, px: number, py: number) => {
                    setDropdownPos({ top: py + height, left: px, width });
                    setDropdownVisible(true);
                  }
                );
              }}
            >
              <Text style={styles.inputPillTxt}>{form.opponent || "Choisir"}</Text>
              <Icon name="chevron-down-outline" size={18} color="#b36a00" />
            </TouchableOpacity>
          </View>

          {/* Lieu */}
          <View style={[styles.rowBetween, { gap: 8 }]}>
            <Text style={styles.label}>Lieu</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.toggleBtn, form.is_home && styles.toggleActive]}
                onPress={() => handleChange("is_home", true)}
              >
                <Text style={[styles.toggleTxt, form.is_home && styles.toggleTxtActive]}>Domicile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !form.is_home && styles.toggleActive]}
                onPress={() => handleChange("is_home", false)}
              >
                <Text style={[styles.toggleTxt, !form.is_home && styles.toggleTxtActive]}>Extérieur</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Catégorie */}
          <View style={[styles.rowBetween, { gap: 8 }]}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {CATEGORIES.map((cat) => {
                const active = form.categorie === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.toggleBtn, active && styles.toggleActive]}
                    onPress={() => handleChange("categorie", cat)}
                  >
                    <Text style={[styles.toggleTxt, active && styles.toggleTxtActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Note */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.input}
              value={form.note}
              onChangeText={(t) => handleChange("note", t)}
              placeholder="Note (optionnel)"
              placeholderTextColor="#9aa0ae"
              maxLength={64}
            />
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={loading} activeOpacity={0.9}>
              <Icon name={editId ? "save" : "add"} size={16} color="#fff" />
              <Text style={styles.primaryBtnTxt}>{editId ? "Modifier" : "Ajouter"}</Text>
            </TouchableOpacity>
            {editId && (
              <TouchableOpacity
                style={[styles.secondaryBtn]}
                onPress={() => {
                  setEditId(null);
                  setForm({ ...initialForm });
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.secondaryBtnTxt}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 🔸 Sous-onglets catégorie */}
      <View style={[styles.tabsRow, styles.tabsStickyBar]}>
        {FILTERS.map((f) => {
          const active = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>
                {f} {!!counts[f as keyof typeof counts] && `(${counts[f as keyof typeof counts]})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View style={[styles.hero, { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 }]}>
        <View style={styles.heroStripe} />
        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : navigation?.goBack?.())}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Matchs à venir (admin)</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.heroProfileRow}>
          <RNImage source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Planifie le calendrier</Text>
            <Text style={styles.heroSub}>Date, adversaire, lieu, catégorie, note</Text>
          </View>
        </View>
      </View>

      {/* OVERLAY dropdown adversaires */}
      {dropdownVisible && (
        <>
          <Pressable
            style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 8888 }}
            onPress={() => setDropdownVisible(false)}
          />
          <View
            style={[
              styles.absoluteDropdownList,
              {
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: Math.min(240, screenHeight - dropdownPos.top - 60),
              },
            ]}
          >
            <FlatList
              data={ADVERSAIRES}
              keyExtractor={(it) => it}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    handleChange("opponent", item);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              nestedScrollEnabled
            />
          </View>
        </>
      )}

      {/* CONTENU : FlatList avec header sticky (bouton + accordéon + onglets) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={filteredMatchs}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          ListHeaderComponent={StickyHeader}
          stickyHeaderIndices={[0]}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color="#FF8200" style={{ marginTop: 22 }} />
            ) : (
              <Text style={{ color: "#cfd3db", textAlign: "center", marginTop: 22 }}>
                Aucun match {activeFilter !== "Tous" ? `en ${activeFilter}` : "à venir"} pour l’instant…
              </Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.cardTopRow, { marginBottom: 6 }]}>
                {getLogo(item.opponent) && (
                  <RNImage source={getLogo(item.opponent)} style={styles.matchLogo} resizeMode="contain" />
                )}
                <Text style={styles.cardDate}>{item.date ? String(item.date).slice(0, 10) : ""}</Text>
                <Text style={styles.cardOpponent} numberOfLines={1}>
                  {item.opponent}
                </Text>
                <TouchableOpacity onPress={() => handleEdit(item)}>
                  <Icon name="create-outline" size={20} color="#FF8200" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Icon name="trash-outline" size={20} color="#E53935" />
                </TouchableOpacity>
              </View>

              {/* Lieu + Catégorie */}
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Text style={item.is_home ? styles.badgeHome : styles.badgeAway}>
                  {item.is_home ? "Domicile" : "Extérieur"}
                </Text>
                {!!item.categorie && <Text style={styles.badgeCategory}>{item.categorie}</Text>}
              </View>

              {!!item.note && <Text style={styles.noteTxt}>{item.note}</Text>}
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: "#11131a", borderBottomWidth: 1, borderBottomColor: "#1f2230", paddingBottom: 10 },
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
  heroTitle: { flex: 1, textAlign: "center", color: "#FF8200", fontSize: 20, fontWeight: "800", letterSpacing: 1.1 },
  heroProfileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  heroLogo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: "#FF8200" },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },

  // ---- Sticky header wrapper ----
  stickyHeaderWrap: {
    backgroundColor: "#0f1014",
    paddingTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 5,
  },

  // Barre compacte en haut (back + titre + bouton accordéon)
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  toolbarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1b1e27",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a2f3d",
  },
  toolbarTitle: { color: "#FF8200", fontSize: 16, fontWeight: "900", letterSpacing: 0.8 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF8200",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

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
  cardTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 16, marginBottom: 10 },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  label: { color: "#c7cad1", fontWeight: "800", minWidth: 80 },
  input: {
    backgroundColor: "#fff",
    borderColor: "#FFD197",
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
    fontSize: 15.5,
    color: "#1c1c1c",
    fontWeight: "700",
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderColor: "#FFD197",
    borderWidth: 1.2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inputPillTxt: { color: "#1c1c1c", fontWeight: "700" },

  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1.2,
    borderColor: "#FFD197",
  },
  toggleActive: { backgroundColor: "#FF8200", borderColor: "#FF8200" },
  toggleTxt: { color: "#FF8200", fontWeight: "900" },
  toggleTxtActive: { color: "#fff", fontWeight: "900" },

  absoluteDropdownList: {
    position: "absolute",
    zIndex: 9999,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF8200",
    overflow: "hidden",
    elevation: 10,
  },
  dropdownItem: { padding: 11, borderBottomColor: "#ffe0b2", borderBottomWidth: 1 },
  dropdownItemText: { color: "#B36A00", fontSize: 15.5 },

  // Sous-onglets
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  tabsStickyBar: {
    paddingTop: 2,
    paddingBottom: 8,
    backgroundColor: "#0f1014",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,130,0,0.22)",
  },
  tab: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,130,0,0.22)",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tabActive: {
    backgroundColor: "#FF8200",
    borderColor: "#FF8200",
  },
  tabTxt: { color: "#eaeef7", fontWeight: "800" },
  tabTxtActive: { color: "#fff", fontWeight: "900" },

  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  matchLogo: { width: 40, height: 40, borderRadius: 22, borderWidth: 1, borderColor: "#ffe0b2", backgroundColor: "#fff" },
  cardDate: { color: "#FF8200", fontWeight: "bold", fontSize: 15, minWidth: 82 },
  cardOpponent: { color: "#e6e7eb", fontSize: 16.5, fontWeight: "bold", flex: 1 },

  badgeHome: {
    backgroundColor: "#0FE97E",
    color: "#063",
    borderRadius: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "900",
  },
  badgeAway: {
    backgroundColor: "#F44336",
    color: "#fff",
    borderRadius: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "900",
  },
  badgeCategory: {
    backgroundColor: "#141821",
    color: "#eaeef7",
    borderRadius: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.35)",
  },
  noteTxt: { color: "#cfd3db", fontSize: 13.5, marginTop: 6 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  secondaryBtn: { backgroundColor: "#BBB", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryBtnTxt: { color: "#111", fontWeight: "900", fontSize: 14.5 },
});
