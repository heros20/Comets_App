// app/screens/MembresAdminScreen.tsx
"use client";

import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

const logoComets = require("../../assets/images/iconComets.png");

const CATEGORIES = [
  { value: "", label: "Catégorie" },
  { value: "12U", label: "12U" },
  { value: "15U", label: "15U" },
  { value: "Senior", label: "Senior" },
];

export default function MembresAdminScreen() {
  const { isAdmin } = useAdmin();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [categorie, setCategorie] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => { fetchMembers(); }, []);
  async function fetchMembers() {
    setLoading(true); setError("");
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("id, created_at, email, role, age, categorie, first_name, last_name")
        .neq("role", "admin")
        .order("created_at", { ascending: false });
      if (error) { setError(error.message); setMembers([]); setLoading(false); return; }
      setMembers(data || []);
    } catch {
      setError("Erreur réseau ou Supabase."); setMembers([]);
    }
    setLoading(false);
  }

  async function handleAdd() {
    setAddMsg(""); setError("");
    if (!email || !password || !firstName || !lastName || !age || !categorie) { setError("Tous les champs sont requis."); return; }
    const ageValue = parseInt(age, 10);
    if (isNaN(ageValue) || ageValue <= 0) { setError("Âge invalide."); return; }
    try {
      const res = await fetch("https://les-comets-honfleur.vercel.app/api/admin/members", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, age: ageValue, categorie }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Erreur inconnue."); return; }
      setAddMsg("✅ Membre ajouté !");
      setEmail(""); setPassword(""); setFirstName(""); setLastName(""); setAge(""); setCategorie("");
      fetchMembers();
    } catch { setError("Erreur lors de l'ajout."); }
  }

  function confirmDelete(member: any) {
    if (member.role === "admin") { setDeleteError("Impossible de supprimer un administrateur."); return; }
    Alert.alert("Suppression", `Supprimer ${member.first_name} ${member.last_name} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => handleDelete(member.id, member.role) },
    ]);
  }

  async function handleDelete(id: string, role: string) {
    setDeleteError("");
    if (role === "admin") { setDeleteError("Impossible de supprimer un administrateur."); return; }
    try {
      const res = await fetch("https://les-comets-honfleur.vercel.app/api/admin/members", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data?.error || "Erreur à la suppression."); }
      else fetchMembers();
    } catch { setDeleteError("Erreur lors de la suppression."); }
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold" }}>Accès réservé aux admins !</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View style={[styles.hero, { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 }]}>
        <View style={styles.heroStripe} />
        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Membres (admin)</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Gestion des comptes membres</Text>
            <Text style={styles.heroSub}>Ajoute, consulte et supprime des profils</Text>
          </View>
        </View>
      </View>

      {/* BODY */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 42, paddingTop: insets.top ? 0 : 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* FORM CARD */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ajouter un membre</Text>
            {error ? <Text style={styles.errorTxt}>{error}</Text> : null}

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9aa0ae" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Prénom" placeholderTextColor="#9aa0ae" value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <TextInput style={styles.input} placeholder="Nom" placeholderTextColor="#9aa0ae" value={lastName} onChangeText={setLastName} />
              <TextInput style={styles.input} placeholder="Âge" placeholderTextColor="#9aa0ae" value={age} onChangeText={setAge} keyboardType="number-pad" />
            </View>

            {/* Choix Catégorie simple (pills) */}
            <Text style={[styles.label, { marginBottom: 6 }]}>Catégorie</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CATEGORIES.slice(1).map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.pill, categorie === cat.value && styles.pillActive]}
                  onPress={() => setCategorie(cat.value)}
                >
                  <Text style={[styles.pillTxt, categorie === cat.value && styles.pillTxtActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { marginTop: 10 }]}
              placeholder="Mot de passe"
              placeholderTextColor="#9aa0ae"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.9}>
              <Icon name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Ajouter</Text>
            </TouchableOpacity>
            {!!addMsg && <Text style={styles.successTxt}>{addMsg}</Text>}
          </View>

          {/* LISTE MEMBRES */}
          <View style={{ gap: 10 }}>
            {loading ? (
              <ActivityIndicator size="large" color="#FF8200" style={{ marginTop: 8 }} />
            ) : (
              members.map(m => (
                <View key={m.id} style={styles.card}>
                  <Text style={styles.memberTitle}>
                    {m.first_name} {m.last_name} <Text style={{ color: "#9aa0ae", fontWeight: "700" }}>({m.role})</Text>
                  </Text>
                  <Text style={styles.memberRow}><Text style={styles.label}>Email :</Text> {m.email}</Text>
                  <Text style={styles.memberRow}><Text style={styles.label}>Âge :</Text> {m.age ?? "-"}</Text>
                  <Text style={styles.memberRow}><Text style={styles.label}>Catégorie :</Text> {m.categorie ?? "-"}</Text>
                  <Text style={styles.memberRow}><Text style={styles.label}>Créé le :</Text> {new Date(m.created_at).toLocaleDateString()}</Text>

                  <TouchableOpacity
                    style={[styles.dangerBtn, m.role === "admin" && { backgroundColor: "#bbb" }]}
                    onPress={() => confirmDelete(m)}
                    disabled={m.role === "admin"}
                    activeOpacity={0.9}
                  >
                    <Icon name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.dangerBtnTxt}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
          {!!deleteError && <Text style={styles.errorTxt}>{deleteError}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: "#11131a", borderBottomWidth: 1, borderBottomColor: "#1f2230", paddingBottom: 10 },
  heroStripe: { position: "absolute", right: -60, top: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: "rgba(255,130,0,0.10)", transform: [{ rotate: "18deg" }] },
  heroRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1b1e27", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2f3d" },
  heroTitle: { flex: 1, textAlign: "center", color: "#FF8200", fontSize: 20, fontWeight: "800", letterSpacing: 1.1 },
  heroProfileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  heroLogo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: "#FF8200" },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 16, marginBottom: 10 },

  input: { flex: 1, backgroundColor: "#fff", borderColor: "#FFD197", borderWidth: 1.2, borderRadius: 12, padding: 12, fontSize: 15.5, color: "#1c1c1c", fontWeight: "700" },
  label: { color: "#c7cad1", fontWeight: "800" },

  pill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.2, borderColor: "#FFD197", backgroundColor: "#fff" },
  pillActive: { backgroundColor: "#FF8200", borderColor: "#FF8200" },
  pillTxt: { color: "#FF8200", fontWeight: "900" },
  pillTxtActive: { color: "#fff" },

  primaryBtn: { marginTop: 12, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FF8200", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  successTxt: { color: "#27A02C", fontWeight: "bold", marginTop: 8, textAlign: "center" },

  memberTitle: { color: "#FF8200", fontWeight: "900", fontSize: 16.5, marginBottom: 4 },
  memberRow: { color: "#e6e7eb", fontSize: 14.5, marginTop: 2 },
  dangerBtn: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#E53935", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  dangerBtnTxt: { color: "#fff", fontWeight: "900" },

  errorTxt: { color: "#C50F0F", fontWeight: "bold", marginTop: 8, textAlign: "center" },
});
