// app/(admin)/youngPlayers.tsx
"use client";

import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { AdminHero } from "../../components/admin/AdminHero";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

type YoungPlayer = {
  id: string | number; // ← on accepte uuid ou int
  first_name: string;
  last_name: string;
  date_naissance: string | null; // "YYYY-MM-DD" ou "DD/MM/YYYY"
  categorie: "12U" | "15U" | null;
};

const CATS: ("12U" | "15U")[] = ["12U", "15U"];

// ========== Helpers date ==========
const maskBirthdateFR = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
const isValidBirthdateFR = (val: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return false;
  const [jj, mm, aaaa] = val.split("/").map(Number);
  if (mm < 1 || mm > 12) return false;
  const lastDay = new Date(aaaa, mm, 0).getDate();
  if (jj < 1 || jj > lastDay) return false;
  if (aaaa < 1900 || aaaa > 2100) return false;
  return true;
};
const toISOFromFR = (val: string) => {
  const [jj, mm, aaaa] = val.split("/");
  return `${aaaa}-${mm}-${jj}`;
};
const fromISOToFR = (val?: string | null) => {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [aaaa, mm, jj] = val.split("-");
    return `${jj}/${mm}/${aaaa}`;
  }
  return val; // déjà JJ/MM/AAAA
};

export default function YoungPlayersAdminScreen() {
  const { isAdmin } = useAdmin();

  useEffect(() => {
    const checkSession = async () => {
      await supabase.auth.getSession();
      // Vérifie ce que voit Postgres via RPC (optionnel / diagnostique)
      await supabase.rpc("whoami_email");
    };
    checkSession();
  }, []);

  // Garde-fou (même logique que AdminMatchsScreen)
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert("Accès réservé", "Cette section est réservée aux administrateurs.");
      router.back();
    }
  }, [isAdmin]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [players, setPlayers] = useState<YoungPlayer[]>([]);

  // Ajout
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addBirth, setAddBirth] = useState("");
  const [addCat, setAddCat] = useState<"12U" | "15U">("12U");

  // Edition inline
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [editCat, setEditCat] = useState<"12U" | "15U">("12U");

  const fetchPlayers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("young_players")
        .select("id, first_name, last_name, date_naissance, categorie")
        .in("categorie", ["12U", "15U"])
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });

      if (error) throw error;

      const norm = (data || []).map((p: any) => ({
        id: p.id, // ← on garde le type renvoyé par la DB (string ou number)
        first_name: p.first_name,
        last_name: p.last_name,
        date_naissance: p.date_naissance ?? null,
        categorie: p.categorie ?? null,
      })) as YoungPlayer[];

      setPlayers(norm);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlayers();
    setRefreshing(false);
  }, [fetchPlayers]);

  // ====== Actions ======
  const handleAdd = async () => {
    if (!isAdmin) {
      Alert.alert("Accès réservé", "Tu dois être admin pour ajouter.");
      return;
    }
    if (!addFirst.trim() || !addLast.trim() || !addBirth.trim()) {
      Alert.alert("Champs requis", "Prénom, nom et date de naissance sont requis.");
      return;
    }
    if (!isValidBirthdateFR(addBirth)) {
      Alert.alert("Date invalide", "Utilise le format JJ/MM/AAAA.");
      return;
    }

    try {
      const payload = {
        first_name: addFirst.trim(),
        last_name: addLast.trim(),
        date_naissance: toISOFromFR(addBirth),
        categorie: addCat as "12U" | "15U",
      };

      const { error } = await supabase
        .from("young_players")
        .insert(payload)
        .select("id, first_name, last_name, date_naissance, categorie");

      if (error) throw error;

      setAddFirst("");
      setAddLast("");
      setAddBirth("");
      setAddCat("12U");
      await fetchPlayers();
      Alert.alert("Succès", "Joueur ajouté.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Fail à l'ajout.");
    }
  };

  const startEdit = (p: YoungPlayer) => {
    setEditingId(p.id);
    setEditFirst(p.first_name || "");
    setEditLast(p.last_name || "");
    setEditBirth(fromISOToFR(p.date_naissance) || "");
    setEditCat((p.categorie as "12U" | "15U") || "12U");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFirst("");
    setEditLast("");
    setEditBirth("");
  };

  const submitEdit = async () => {
    if (!isAdmin) {
      Alert.alert("Accès réservé", "Tu dois être admin pour modifier.");
      return;
    }
    if (!editingId) return;
    if (!editFirst.trim() || !editLast.trim()) {
      Alert.alert("Champs requis", "Prénom et nom sont requis.");
      return;
    }
    if (editBirth && !isValidBirthdateFR(editBirth)) {
      Alert.alert("Date invalide", "Utilise le format JJ/MM/AAAA.");
      return;
    }

    try {
      const payload: Partial<YoungPlayer> = {
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
        date_naissance: editBirth ? toISOFromFR(editBirth) : null,
        categorie: editCat as "12U" | "15U",
      };

      const { data, error } = await supabase
        .from("young_players")
        .update(payload)
        .eq("id", editingId as any) // ← on garde le type original
        .select("id, first_name, last_name, date_naissance, categorie");

      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert(
          "Aucune ligne mise à jour",
          "Vérifie que l'ID correspond et que la row est bien 12U/15U."
        );
        return;
      }

      cancelEdit();
      await fetchPlayers();
      Alert.alert("Succès", "Joueur mis à jour.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Fail à la mise à jour.");
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!isAdmin) {
      Alert.alert("Accès réservé", "Tu dois être admin pour supprimer.");
      return;
    }
    Alert.alert(
      "Supprimer",
      "Tu confirmes la suppression de ce joueur ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("young_players")
                .delete()
                .eq("id", id as any)
                .select("id");

              if (error) throw error;
              await fetchPlayers();
              Alert.alert("Supprimé", "Le joueur a été supprimé.");
            } catch (e: any) {
              Alert.alert("Erreur", e?.message || "Fail à la suppression.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ====== UI ======
  const renderItem = ({ item }: { item: YoungPlayer }) => {
    const isEditing = editingId === item.id;
    return (
      <View style={styles.card}>
        {isEditing ? (
          <>
            <View style={styles.row}>
              <TextInput
                value={editFirst}
                onChangeText={setEditFirst}
                placeholder="Prénom"
                placeholderTextColor="#a6acb8"
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={editLast}
                onChangeText={setEditLast}
                placeholder="Nom"
                placeholderTextColor="#a6acb8"
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                value={editBirth}
                onChangeText={(t) => setEditBirth(maskBirthdateFR(t))}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor="#a6acb8"
                style={[styles.input, { flex: 1 }]}
                keyboardType="numeric"
                maxLength={10}
              />
              <View style={[styles.catSwitch, { marginLeft: 8 }]}>
                {CATS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEditCat(c)}
                    style={[styles.catPill, editCat === c && styles.catPillActive]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.catPillTxt,
                        editCat === c && styles.catPillTxtActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={submitEdit}
                activeOpacity={0.9}
              >
                <Icon name="save-outline" size={18} color="#fff" />
                <Text style={styles.btnTxtWhite}>Enregistrer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnGrey]}
                onPress={cancelEdit}
                activeOpacity={0.9}
              >
                <Icon name="close" size={18} color="#222" />
                <Text style={styles.btnTxtDark}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.topRow}>
              <Text style={styles.cardTitle}>
                {item.first_name} {item.last_name}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{item.categorie || "-"}</Text>
              </View>
            </View>
            <Text style={styles.cardSub}>
              Date de naissance : {fromISOToFR(item.date_naissance) || "-"}
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => startEdit(item)}
                activeOpacity={0.9}
              >
                <Icon name="pencil" size={18} color="#fff" />
                <Text style={styles.btnTxtWhite}>Éditer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={() => handleDelete(item.id)}
                activeOpacity={0.9}
              >
                <Icon name="trash" size={18} color="#fff" />
                <Text style={styles.btnTxtWhite}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />
      <AdminHero
        title="Jeunes 12U / 15U"
        subtitle="Ajoute, edite ou supprime des profils"
        onBack={() => router.back()}
      />

      {/* BODY */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        {/* Formulaire d'ajout */}
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Ajouter un jeune</Text>
          <View style={styles.row}>
            <TextInput
              value={addFirst}
              onChangeText={setAddFirst}
              placeholder="Prénom"
              placeholderTextColor="#a6acb8"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={addLast}
              onChangeText={setAddLast}
              placeholder="Nom"
              placeholderTextColor="#a6acb8"
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
            />
          </View>
          <View style={styles.row}>
            <TextInput
              value={addBirth}
              onChangeText={(t) => setAddBirth(maskBirthdateFR(t))}
              placeholder="JJ/MM/AAAA"
              placeholderTextColor="#a6acb8"
              style={[styles.input, { flex: 1 }]}
              keyboardType="numeric"
              maxLength={10}
            />
            <View style={[styles.catSwitch, { marginLeft: 8 }]}>
              {CATS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setAddCat(c)}
                  style={[styles.catPill, addCat === c && styles.catPillActive]}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.catPillTxt, addCat === c && styles.catPillTxtActive]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginTop: 10, alignSelf: "flex-start" }]}
            onPress={handleAdd}
            activeOpacity={0.9}
          >
            <Icon name="add" size={18} color="#fff" />
            <Text style={styles.btnTxtWhite}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Liste */}
        <FlatList
          data={players}
          keyExtractor={(it) => String(it.id)} // ← toujours string
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          ListEmptyComponent={
            !loading ? <Text style={styles.emptyTxt}>Aucun jeune (12U/15U) pour le moment.</Text> : null
          }
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8200" />
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ===== HERO (nouveau) =====

  // ===== BODY & composants existants =====
  addCard: {
    margin: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },
  addTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 16, marginBottom: 8 },
  row: { flexDirection: "row" },
  input: {
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontWeight: "700",
  },
  catSwitch: {
    flexDirection: "row",
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    borderRadius: 12,
    padding: 4,
    alignItems: "center",
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  catPillActive: { backgroundColor: "#FF8200" },
  catPillTxt: { color: "#FF8200", fontWeight: "900" },
  catPillTxtActive: { color: "#fff" },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    marginBottom: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardSub: { color: "#cfd3db", marginTop: 6 },

  badge: {
    backgroundColor: "#FFE66D",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeTxt: { fontWeight: "900", color: "#8a6a08" },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimary: { backgroundColor: "#FF8200" },
  btnDanger: { backgroundColor: "#D94848" },
  btnSave: { backgroundColor: "#16a34a" },
  btnGrey: { backgroundColor: "#E5E7EB" },
  btnTxtWhite: { color: "#fff", fontWeight: "900" },
  btnTxtDark: { color: "#222", fontWeight: "900" },

  emptyTxt: { color: "#9aa0ae", textAlign: "center", marginTop: 30, fontSize: 14.5 },
});


