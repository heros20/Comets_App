import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
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

// Logo Comets
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

  // State
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [deleteError, setDeleteError] = useState("");
  // Form state
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [categorie, setCategorie] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("id, created_at, email, role, age, categorie, first_name, last_name")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setMembers([]);
        setLoading(false);
        return;
      }
      setMembers(data || []);
    } catch (e: any) {
      setError("Erreur réseau ou Supabase.");
      setMembers([]);
    }
    setLoading(false);
  }

  async function handleAdd() {
    setAddMsg("");
    setError("");
    if (!email || !password || !firstName || !lastName || !age || !categorie) {
      setError("Tous les champs sont requis.");
      return;
    }
    const ageValue = parseInt(age, 10);
    if (isNaN(ageValue) || ageValue <= 0) {
      setError("Âge invalide.");
      return;
    }
    try {
      // Utilise la route API Next.js
      const res = await fetch("https://les-comets-honfleur.vercel.app/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          age: ageValue,
          categorie,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Erreur inconnue.");
        return;
      }
      setAddMsg("✅ Membre ajouté !");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setAge("");
      setCategorie("");
      fetchMembers();
    } catch (e: any) {
      setError("Erreur lors de l'ajout.");
    }
  }

  function confirmDelete(member: any) {
    if (member.role === "admin") {
      setDeleteError("Impossible de supprimer un administrateur.");
      return;
    }
    Alert.alert(
      "Suppression",
      `Supprimer ${member.first_name} ${member.last_name} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => handleDelete(member.id, member.role),
        },
      ]
    );
  }

  async function handleDelete(id: string, role: string) {
    setDeleteError("");
    if (role === "admin") {
      setDeleteError("Impossible de supprimer un administrateur.");
      return;
    }
    try {
      const res = await fetch("https://les-comets-honfleur.vercel.app/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data?.error || "Erreur à la suppression.");
      } else {
        fetchMembers();
      }
    } catch (e: any) {
      setDeleteError("Erreur lors de la suppression.");
    }
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: "#18181C", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold" }}>
          Accès réservé aux admins !
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#18181C" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: insets.top + 28, // padding top clean
          paddingBottom: 34,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Comets */}
        <Image
          source={logoComets}
          style={{
            width: 70,
            height: 70,
            borderRadius: 19,
            marginBottom: 10,
            backgroundColor: "#fff",
            borderWidth: 2,
            borderColor: "#FF8200",
            shadowColor: "#FF8200",
            shadowOpacity: 0.11,
            shadowRadius: 7,
            elevation: 2,
          }}
          resizeMode="contain"
        />

        {/* Header flèche + titre */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="chevron-back" size={27} color="#FF8200" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.title}>Gestion des membres</Text>
          </View>
          <View style={{ width: 27 }} />
        </View>

        {/* Formulaire ajout */}
        <View style={styles.formBox}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#a96c01"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Prénom"
              placeholderTextColor="#a96c01"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.input}
              placeholder="Nom"
              placeholderTextColor="#a96c01"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Âge"
              placeholderTextColor="#a96c01"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
            <View style={[styles.input, { flex: 1, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent", borderWidth: 0 }]}>
              <TouchableOpacity
                style={styles.categoryPicker}
                onPress={() => Alert.alert("Sélection", "Catégorie à choisir dans le patch custom si besoin")}
                disabled
              >
                <Text style={{ color: categorie ? "#a96c01" : "#bbb" }}>
                  {CATEGORIES.find(c => c.value === categorie)?.label || "Catégorie"}
                </Text>
              </TouchableOpacity>
              {/* Si tu veux une vraie Picker, passe sur @react-native-picker/picker */}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#a96c01"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          {/* Picker Catégorie réel, version simple */}
          <View style={styles.formRow}>
            <Text style={{ color: "#a96c01", fontWeight: "bold", marginRight: 6 }}>Catégorie</Text>
            {CATEGORIES.slice(1).map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryBtn,
                  categorie === cat.value && styles.categoryBtnActive,
                ]}
                onPress={() => setCategorie(cat.value)}
              >
                <Text style={{ color: categorie === cat.value ? "#fff" : "#a96c01", fontWeight: "bold" }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
            <Text style={styles.saveBtnText}>Ajouter</Text>
          </TouchableOpacity>
          {addMsg ? <Text style={styles.success}>{addMsg}</Text> : null}
        </View>

        {/* Liste membres */}
        <View style={{ width: "100%", maxWidth: 460, marginTop: 15 }}>
          {loading ? (
            <ActivityIndicator size="large" color="#FF8200" style={{ marginTop: 22 }} />
          ) : (
            members.map(m => (
              <View key={m.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {m.first_name} {m.last_name}
                  {"  "}
                  <Text style={{ fontWeight: "normal", fontSize: 14, color: "#b36a00" }}>({m.role})</Text>
                </Text>
                <Text style={styles.cardDetail}><Text style={styles.label}>Email :</Text> {m.email}</Text>
                <Text style={styles.cardDetail}><Text style={styles.label}>Âge :</Text> {m.age ?? "-"}</Text>
                <Text style={styles.cardDetail}><Text style={styles.label}>Catégorie :</Text> {m.categorie ?? "-"}</Text>
                <Text style={styles.cardDetail}><Text style={styles.label}>Créé le :</Text> {new Date(m.created_at).toLocaleDateString()}</Text>
                <TouchableOpacity
                  style={[styles.deleteBtn, m.role === "admin" && { backgroundColor: "#bbb" }]}
                  onPress={() => confirmDelete(m)}
                  disabled={m.role === "admin"}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "96%",
    marginBottom: 20,
  },
  backBtn: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: "#FFF7EE",
    borderWidth: 1.2,
    borderColor: "#FF8200",
    marginRight: 8,
    elevation: 2,
    shadowColor: "#FF8200",
    shadowOpacity: 0.07,
    shadowRadius: 5,
  },
  title: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 21,
    textAlign: "center",
    letterSpacing: 1,
  },
  formBox: {
    width: "98%",
    maxWidth: 460,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 22,
    shadowColor: "#FF8200",
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1.1,
    borderColor: "#FF8200",
  },
  formRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 8,
    width: "100%",
  },
  input: {
    backgroundColor: "#fff8ef",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#FF8200",
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 15.5,
    color: "#a96c01",
    flex: 1,
    marginRight: 5,
    fontWeight: "bold",
  },
  categoryPicker: {
    padding: 12,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: "#FF8200",
    backgroundColor: "#fff8ef",
    alignItems: "center",
    marginRight: 5,
  },
  categoryBtn: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: "#FF8200",
    backgroundColor: "#fff8ef",
    marginRight: 9,
    marginBottom: 4,
  },
  categoryBtnActive: {
    backgroundColor: "#FF8200",
    borderColor: "#c06b00",
  },
  saveBtn: {
    backgroundColor: "#27A02C",
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 2,
  },
  cardTitle: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 16.5,
    marginBottom: 2,
  },
  cardDetail: {
    color: "#b36a00",
    fontSize: 14.5,
    marginBottom: 1,
  },
  label: {
    fontWeight: "bold",
    color: "#a96c01",
  },
  deleteBtn: {
    backgroundColor: "#F44336",
    borderRadius: 7,
    paddingVertical: 8,
    marginTop: 10,
    alignItems: "center",
  },
  error: {
    color: "#c50f0f",
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  success: {
    color: "#27A02C",
    fontWeight: "bold",
    marginTop: 7,
    textAlign: "center",
  },
});
