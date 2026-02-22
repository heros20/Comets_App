// app/screens/AdminActusScreen.tsx
"use client";

import { Picker } from "@react-native-picker/picker";
import * as ExpoFileSystem from "expo-file-system/legacy";
import * as ExpoImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useCallback, useEffect, useState } from "react";
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

/** Catégories disponibles */
const CATEGORY_META = [
  { value: "", label: "Aucune", color: "#6b7280" },
  { value: "12U", label: "12U", color: "#10b981" },
  { value: "15U", label: "15U", color: "#3b82f6" },
  { value: "Séniors", label: "Séniors", color: "#f59e0b" },
];

/** Onglets de filtre */
const CATEGORY_TABS = [
  { value: "__ALL__", label: "Toutes" },
  { value: "12U", label: "12U" },
  { value: "15U", label: "15U" },
  { value: "Séniors", label: "Séniors" },
];

const initialForm = { title: "", content: "", image_url: "" };

// ==================== NOTIFS CONFIG ====================
const PRIMARY_API =
  process.env.EXPO_PUBLIC_PRIMARY_API || "https://les-comets-honfleur.vercel.app";
const NOTIF_PATH = "/api/notifications/news";
const PUSH_ARTICLE_SECRET = process.env.EXPO_PUBLIC_PUSH_ARTICLE_SECRET || "";

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function sendArticleNotification(payload: {
  id?: number;
  title?: string;
  content?: string;
  image_url?: string | null;
  route?: string;
  dryRun?: boolean;
}) {
  const url = joinUrl(PRIMARY_API, NOTIF_PATH);
  const body = {
    ...(payload.id ? { id: payload.id } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.content ? { content: payload.content } : {}),
    ...(payload.image_url ? { image_url: payload.image_url } : {}),
    ...(payload.route ? { route: payload.route } : {}),
    ...(payload.dryRun ? { dryRun: true } : {}),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(PUSH_ARTICLE_SECRET ? { "x-hook-secret": PUSH_ARTICLE_SECRET } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.warn("[article notify] network error:", e);
    return false;
  }
}
// ======================================================

// ===== Helpers upload compat (sans blob) =====
function base64ToUint8Array(base64: string) {
  const binary =
    (globalThis as any).atob
      ? (globalThis as any).atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** URI file:// → ArrayBuffer (fetch.arrayBuffer ou fallback FileSystem→base64) */
async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(uri);
    if (typeof (res as any).arrayBuffer === "function") {
      return await (res as any).arrayBuffer();
    }
  } catch {}
  const b64 = await ExpoFileSystem.readAsStringAsync(uri, {
    encoding: ExpoFileSystem.EncodingType.Base64,
  });
  return base64ToUint8Array(b64).buffer;
}
// ============================================

export default function AdminActusScreen() {
  const { isAdmin } = useAdmin();
  const [newsList, setNewsList] = useState<any[]>([]);
  const [form, setForm] = useState(initialForm);
  const [categoryValue, setCategoryValue] = useState<string>(""); // champ du formulaire
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("__ALL__"); // filtre de la liste
  const navigation = useNavigation();

  const fetchNews = useCallback(async (filter: string) => {
    setLoading(true);
    try {
      let q = supabase.from("news").select("*").order("created_at", { ascending: false });
      if (filter !== "__ALL__") {
        q = q.eq("category", filter);
      }
      const { data, error } = await q;
      if (error) throw error;
      setNewsList(data || []);
    } catch (e) {
      console.warn("fetchNews error:", e);
      setNewsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchNews(activeTab);
  }, [isAdmin, activeTab, fetchNews]);

  async function handleImagePick() {
    try {
      const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorise l'accès à la galerie photo !");
        return;
      }

      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      const srcUri = result.assets[0].uri;

      // Normalisation: force JPEG + resize
      const manip = await ImageManipulator.manipulateAsync(
        srcUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const data = await uriToArrayBuffer(manip.uri);
      const fileName = `news/${Date.now()}_${Math.floor(Math.random() * 99999)}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("news-images")
        .upload(fileName, data, {
          contentType: "image/jpeg",
          cacheControl: "3600",
        });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from("news-images").getPublicUrl(fileName);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error("URL introuvable");

      setForm((f) => ({ ...f, image_url: publicUrl }));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      setFormError("Merci de renseigner un titre d’article.");
      return;
    }
    if (!form.content.trim()) {
      setFormError("Merci de rédiger le texte de l’article.");
      return;
    }
    setFormError("");
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("news")
          .update({
            title: form.title.trim(),
            content: form.content.trim(),
            image_url: form.image_url || null,
            category: categoryValue,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("news")
          .insert([
            {
              title: form.title.trim(),
              content: form.content.trim(),
              image_url: form.image_url || null,
              category: categoryValue,
            },
          ])
          .select("id")
          .single();
        if (error) throw error;

        if (inserted?.id) {
          await sendArticleNotification({
            id: inserted.id,
            title: form.title.trim(),
            content: form.content.trim(),
            image_url: form.image_url || undefined,
            route: `/actus/${inserted.id}`,
          });
        }
      }

      setForm(initialForm);
      setCategoryValue("");
      setEditingId(null);
      fetchNews(activeTab); // refresh avec filtre courant
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Erreur lors de l’enregistrement");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(news: any) {
    setForm({
      title: news.title || "",
      content: news.content || "",
      image_url: news.image_url || "",
    });
    setCategoryValue(news.category || "");
    setEditingId(news.id);
    setFormError("");
  }

  async function handleDelete(id: number) {
    Alert.alert("Supprimer cet article ?", "Confirmation requise.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.from("news").delete().eq("id", id);
          setNewsList((list) => list.filter((n) => n.id !== id));
          if (editingId === id) {
            setEditingId(null);
            setForm(initialForm);
            setCategoryValue("");
          }
        },
      },
    ]);
  }

  function handleCancelEdit() {
    setForm(initialForm);
    setCategoryValue("");
    setEditingId(null);
    setFormError("");
  }

  if (!isAdmin) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}
      >
        <StatusBar barStyle="light-content" />
        <Text style={{ color: "#FF8200", fontSize: 18, fontWeight: "bold" }}>
          Accès réservé aux admins !
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 48 }}>
          {/* ===== Header (hero) rétabli ===== */}
          <View style={[styles.hero, { marginBottom: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
            <View style={styles.heroStripe} />
            <View style={{ paddingTop: 10, paddingBottom: 6 }}>
              <View style={styles.heroRow}>
                <TouchableOpacity
                  onPress={() => (navigation as any)?.goBack?.()}
                  style={styles.backBtn}
                  activeOpacity={0.85}
                >
                  <Icon name="arrow-back" size={18} color="#FF8200" />
                </TouchableOpacity>
                <Text style={styles.heroTitle}>Administration — Actus</Text>
                <View style={{ width: 36, height: 36 }} />
              </View>

              <View style={styles.heroProfileRow}>
                <RNImage source={logoComets} style={styles.heroLogo} resizeMode="cover" />
                <View>
                  <Text style={styles.heroName}>Comets d’Honfleur</Text>
                  <Text style={styles.heroSub}>Gestion des actualités & push</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ===== FORM ===== */}
          <View style={styles.card}>
            {formError ? (
              <Text style={{ color: "#C50F0F", fontWeight: "bold", marginBottom: 8 }}>{formError}</Text>
            ) : null}

            {/* Catégorie + Titre */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={categoryValue}
                    onValueChange={(val) => setCategoryValue(val)}
                    style={{ color: "#B36A00" }}
                  >
                    {CATEGORY_META.map((cat, idx) => (
                      <Picker.Item key={idx} label={cat.label} value={cat.value} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Titre</Text>
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
                  placeholder="Titre de l’article"
                  placeholderTextColor="#9aa0ae"
                />
              </View>
            </View>

            {/* Contenu */}
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.label}>Contenu</Text>
              <TextInput
                style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
                value={form.content}
                onChangeText={(t) => setForm((f) => ({ ...f, content: t }))}
                placeholder="Texte de l’article"
                placeholderTextColor="#9aa0ae"
                multiline
              />
            </View>

            {/* Image */}
            <View>
              <Text style={styles.label}>Image (optionnel)</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleImagePick}
                disabled={uploading}
              >
                <Icon name="image-outline" size={16} color="#fff" />
                <Text style={styles.primaryBtnTxt}>
                  {uploading ? "Envoi en cours..." : form.image_url ? "Changer l’image" : "Ajouter une image"}
                </Text>
              </TouchableOpacity>

              {!!form.image_url && (
                <RNImage
                  source={{ uri: form.image_url }}
                  style={styles.preview}
                  resizeMode="cover"
                />
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Icon name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryBtnTxt}>
                  {loading ? (editingId ? "Mise à jour…" : "Publication…") : editingId ? "Mettre à jour" : "Publier"}
                </Text>
              </TouchableOpacity>

              {editingId && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancelEdit}>
                  <Text style={styles.secondaryBtnTxt}>Annuler</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ===== Onglets de filtre (DÉPLACÉS sous le bloc édition) ===== */}
          <View style={[styles.card, { paddingTop: 10, paddingBottom: 10 }]}>
            <Text style={[styles.label, { marginBottom: 8 }]}>Filtrer les actus par catégorie</Text>
            <View style={styles.tabsRow}>
              {CATEGORY_TABS.map((t) => {
                const isActive = t.value === activeTab;
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setActiveTab(t.value)}
                    activeOpacity={0.9}
                    style={[
                      styles.tabBtn,
                      isActive && styles.tabBtnActive,
                    ]}
                  >
                    <Text style={[styles.tabTxt, isActive && styles.tabTxtActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ===== Liste des actus ===== */}
          {loading ? (
            <ActivityIndicator size="large" color="#FF8200" style={{ marginTop: 12 }} />
          ) : newsList.length === 0 ? (
            <Text style={{ color: "#cfd3db", textAlign: "center", marginTop: 16 }}>
              Aucune actualité publiée…
            </Text>
          ) : (
            newsList.map((item) => {
              const catMeta = CATEGORY_META.find((c) => c.value === item.category);
              return (
                <View key={item.id} style={styles.card}>
                  {!!item.image_url && (
                    <RNImage source={{ uri: item.image_url }} style={styles.cardImg} resizeMode="cover" />
                  )}
                  {item.category ? (
                    <View
                      style={[
                        styles.badge,
                        {
                          borderColor: catMeta?.color ?? "#9aa0ae",
                          backgroundColor: (catMeta?.color ?? "#9aa0ae") + "22",
                        },
                      ]}
                    >
                      <Text style={[styles.badgeTxt, { color: catMeta?.color ?? "#9aa0ae" }]}>
                        {catMeta?.label || item.category}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.cardTitleTxt}>{item.title}</Text>
                  <Text style={styles.cardBodyTxt}>{item.content}</Text>
                  <Text style={styles.cardDateTxt}>
                    {item.created_at ? `Publié le ${new Date(item.created_at).toLocaleDateString("fr-FR")}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleEdit(item)}
                      style={[styles.actionBtn, { backgroundColor: "#FF8200" }]}
                    >
                      <Icon name="create-outline" size={16} color="#fff" />
                      <Text style={styles.actionTxt}>Éditer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id)}
                      style={[styles.actionBtn, { backgroundColor: "#E53935" }]}
                    >
                      <Icon name="trash-outline" size={16} color="#fff" />
                      <Text style={styles.actionTxt}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Tabs
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 0,
    justifyContent: "space-between",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a2f3d",
    backgroundColor: "#1b1e27",
    alignItems: "center",
  },
  tabBtnActive: {
    borderColor: "#FF8200",
    backgroundColor: "rgba(255,130,0,0.15)",
  },
  tabTxt: { color: "#c7cad1", fontWeight: "800" },
  tabTxtActive: { color: "#FF8200" },

  // Header (hero)
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

  // Cards & inputs
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
  pickerWrap: {
    backgroundColor: "#fff",
    borderColor: "#FFD197",
    borderWidth: 1.2,
    borderRadius: 12,
    overflow: "hidden",
  },
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

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  secondaryBtn: { backgroundColor: "#BBB", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryBtnTxt: { color: "#111", fontWeight: "900", fontSize: 14.5 },

  cardImg: { width: "100%", height: 140, borderRadius: 10, backgroundColor: "#22262f", marginBottom: 10 },
  cardTitleTxt: { color: "#eaeef7", fontWeight: "900", fontSize: 17, marginTop: 2 },
  cardBodyTxt: { color: "#e6e7eb", fontSize: 15, marginTop: 4 },
  cardDateTxt: { color: "#9aa0ae", fontSize: 12.5, marginTop: 6 },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  badgeTxt: { fontWeight: "900", fontSize: 12.5 },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  actionTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },

  // Preview image
  preview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    backgroundColor: "#22262f",
    marginTop: 10,
  },
});
