// app/screens/AdminActusScreen.tsx
"use client";

import { Picker } from "@react-native-picker/picker";
import * as ExpoFileSystem from "expo-file-system";
import * as ExpoImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image as RNImage,
  SafeAreaView,
  ScrollView,
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
import { useNavigation } from "@react-navigation/native";

const logoComets = require("../../assets/images/iconComets.png");

const CATEGORIES = [
  { value: "", label: "-- Choisis une catégorie --" },
  { value: "", label: "" },
  { value: "12U - ", label: "12U" },
  { value: "15U - ", label: "15U" },
  { value: "Séniors - ", label: "Séniors" },
];

const initialForm = { title: "", content: "", image_url: "" };

export default function AdminActusScreen() {
  const { isAdmin } = useAdmin();
  const [newsList, setNewsList] = useState<any[]>([]);
  const [form, setForm] = useState(initialForm);
  const [category, setCategory] = useState("");
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const navigation = useNavigation();

  async function fetchNews() {
    setLoading(true);
    const { data, error } = await supabase.from("news").select("*").order("created_at", { ascending: false });
    if (!error && data) setNewsList(data);
    setLoading(false);
  }
  useEffect(() => { if (isAdmin) fetchNews(); }, [isAdmin]);

  async function handleImagePick() {
    try {
      const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission refusée", "Autorise l'accès à la galerie photo !"); return; }
      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images, quality: 0.72, allowsEditing: true, aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setUploading(true);
      const uri = result.assets[0].uri;
      const base64 = await ExpoFileSystem.readAsStringAsync(uri, { encoding: ExpoFileSystem.EncodingType.Base64 });
      const fileName = `news/${Date.now()}_${Math.floor(Math.random() * 99999)}.jpg`;
      const byteArray = (function base64ToUint8Array(base64: string) {
        const bin = globalThis.atob ? globalThis.atob(base64) : Buffer.from(base64, "base64").toString("binary");
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      })(base64);

      const { error: uploadErr } = await supabase.storage.from("news-images").upload(fileName, byteArray, {
        contentType: "image/jpeg", cacheControl: "3600", upsert: false, duplex: "half",
      });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from("news-images").getPublicUrl(fileName);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error("URL de l'image introuvable.");

      setForm(f => ({ ...f, image_url: publicUrl }));
      setUploading(false);
    } catch (e: any) {
      setUploading(false);
      Alert.alert("Erreur", e.message || "Erreur lors de l'upload");
    }
  }

  async function handleSubmit() {
    if (!category) { setFormError("Merci de choisir une catégorie pour l’article."); return; }
    if (!form.title.trim()) { setFormError("Merci de renseigner un titre d’article."); return; }
    if (!form.content.trim()) { setFormError("Merci de rédiger le texte de l’article."); return; }
    setFormError(""); setLoading(true);

    const fullTitle = category + form.title;
    try {
      if (editingId) {
        await supabase.from("news").update({ ...form, title: fullTitle }).eq("id", editingId);
      } else {
        await supabase.from("news").insert([{ ...form, title: fullTitle }]);
      }
      setForm(initialForm); setCategory(""); setEditingId(null); fetchNews();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Erreur lors de l’enregistrement");
    }
    setLoading(false);
  }

  function handleEdit(news: any) {
    const cat = CATEGORIES.find(c => news.title.startsWith(c.value))?.value || "";
    const titleSansCat = cat ? news.title.replace(cat, "") : news.title;
    setForm({ title: titleSansCat, content: news.content, image_url: news.image_url || "" });
    setCategory(cat); setEditingId(news.id); setFormError("");
  }

  async function handleDelete(id: number) {
    Alert.alert("Supprimer cet article ?", "Confirmation requise.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        await supabase.from("news").delete().eq("id", id);
        setNewsList(list => list.filter(n => n.id !== id));
        if (editingId === id) { setEditingId(null); setForm(initialForm); setCategory(""); }
      }},
    ]);
  }
  function handleCancelEdit() { setForm(initialForm); setCategory(""); setEditingId(null); setFormError(""); }

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
            onPress={() => (navigation as any)?.goBack?.()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Actualités (admin)</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.heroProfileRow}>
          <RNImage source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Publie les infos du club</Text>
            <Text style={styles.heroSub}>Catégorie, titre, contenu et image</Text>
          </View>
        </View>
      </View>

      {/* BODY */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 48 }}>
          {/* FORM CARD */}
          <View style={styles.card}>
            {formError ? <Text style={{ color: "#C50F0F", fontWeight: "bold", marginBottom: 8 }}>{formError}</Text> : null}

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Catégorie</Text>
                <View style={{ borderWidth: 1, borderColor: "#FF8200", borderRadius: 10, overflow: "hidden" }}>
                  <Picker selectedValue={category} onValueChange={setCategory} style={{ color: "#B36A00" }}>
                    {CATEGORIES.map(cat => <Picker.Item key={cat.value} label={cat.label} value={cat.value} />)}
                  </Picker>
                </View>
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Titre</Text>
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(t) => setForm(f => ({ ...f, title: t }))}
                  placeholder="Titre de l’article"
                  placeholderTextColor="#9aa0ae"
                  editable={!!category}
                />
              </View>
            </View>

            <View style={{ marginBottom: 10 }}>
              <Text style={styles.label}>Contenu</Text>
              <TextInput
                style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
                value={form.content}
                onChangeText={(t) => setForm(f => ({ ...f, content: t }))}
                placeholder="Texte de l’article"
                placeholderTextColor="#9aa0ae"
                multiline
              />
            </View>

            <View>
              <Text style={styles.label}>Image (optionnel)</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleImagePick} disabled={uploading} activeOpacity={0.9}>
                <Icon name="image-outline" size={16} color="#fff" />
                <Text style={styles.primaryBtnTxt}>
                  {uploading ? "Envoi en cours..." : (form.image_url ? "Changer l’image" : "Ajouter une image")}
                </Text>
              </TouchableOpacity>
              {!!form.image_url && (
                <RNImage
                  source={{ uri: form.image_url }}
                  style={{ width: 140, height: 100, borderRadius: 8, backgroundColor: "#22262f", alignSelf: "center", marginTop: 10 }}
                  resizeMode="cover"
                />
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.9}>
                <Icon name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryBtnTxt}>
                  {loading ? (editingId ? "Mise à jour…" : "Publication…") : (editingId ? "Mettre à jour" : "Publier")}
                </Text>
              </TouchableOpacity>
              {editingId && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancelEdit} activeOpacity={0.9}>
                  <Text style={styles.secondaryBtnTxt}>Annuler</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* LISTE DES ACTUS */}
          {loading ? (
            <ActivityIndicator size="large" color="#FF8200" style={{ marginTop: 12 }} />
          ) : newsList.length === 0 ? (
            <Text style={{ color: "#cfd3db", textAlign: "center", marginTop: 16 }}>Aucune actualité publiée…</Text>
          ) : (
            newsList.map(item => (
              <View style={styles.card} key={item.id}>
                {!!item.image_url && <RNImage source={{ uri: item.image_url }} style={styles.cardImg} resizeMode="cover" />}
                <Text style={styles.cardTitleTxt}>{item.title}</Text>
                <Text style={styles.cardBodyTxt}>{item.content}</Text>
                <Text style={styles.cardDateTxt}>
                  {item.created_at ? `Publié le ${new Date(item.created_at).toLocaleDateString("fr-FR")}` : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: "#FF8200" }]}>
                    <Icon name="create-outline" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Éditer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: "#E53935" }]}>
                    <Icon name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  label: { color: "#c7cad1", fontWeight: "800", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderColor: "#FFD197", borderWidth: 1.2, borderRadius: 12, padding: 12, fontSize: 15.5, color: "#1c1c1c", fontWeight: "700" },

  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FF8200", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  secondaryBtn: { backgroundColor: "#BBB", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryBtnTxt: { color: "#111", fontWeight: "900", fontSize: 14.5 },

  cardImg: { width: "100%", height: 140, borderRadius: 10, backgroundColor: "#22262f", marginBottom: 10 },
  cardTitleTxt: { color: "#FF8200", fontWeight: "900", fontSize: 17 },
  cardBodyTxt: { color: "#e6e7eb", fontSize: 15, marginTop: 4 },
  cardDateTxt: { color: "#9aa0ae", fontSize: 12.5, marginTop: 6 },

  actionBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  actionTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },
});
