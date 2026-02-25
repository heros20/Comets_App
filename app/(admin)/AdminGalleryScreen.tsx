// app/screens/AdminGalleryScreen.tsx
"use client";

import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image as RNImage,
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
import { sortGalleryNewest } from "../../lib/gallerySort";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";


type GalleryItem = {
  id: number | string;
  url: string;
  legend: string | null;
  created_at?: string | null;
};

const PRIMARY_API =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? "http://10.0.2.2:3000" : "https://les-comets-honfleur.vercel.app");
const FALLBACK_API = "https://les-comets-honfleur.vercel.app";

type GalleryCreatePayload = {
  url: string;
  legend?: string;
};

type GalleryFetchResponse = GalleryItem[] | { error?: string };

function trimSlash(s: string) {
  return s.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 6000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function postGalleryRecord(payload: GalleryCreatePayload) {
  const doPost = async (base: string) => {
    const res = await fetchWithTimeout(`${trimSlash(base)}/api/gallery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error ?? `HTTP ${res.status}`);
    }
    return json;
  };

  try {
    return await doPost(PRIMARY_API);
  } catch (e) {
    if (trimSlash(PRIMARY_API) === trimSlash(FALLBACK_API)) throw e;
    return await doPost(FALLBACK_API);
  }
}

async function fetchGalleryRecords() {
  const doGet = async (base: string): Promise<GalleryItem[]> => {
    const res = await fetchWithTimeout(`${trimSlash(base)}/api/gallery`, { method: "GET" });
    const json: GalleryFetchResponse = await res.json().catch(() => []);
    if (!res.ok) {
      throw new Error((json as any)?.error ?? `HTTP ${res.status}`);
    }
    return Array.isArray(json) ? (json as GalleryItem[]) : [];
  };

  try {
    return await doGet(PRIMARY_API);
  } catch (e) {
    if (trimSlash(PRIMARY_API) === trimSlash(FALLBACK_API)) throw e;
    return await doGet(FALLBACK_API);
  }
}

// ---- Helpers compat ----
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

/**
 * Convertit une file:// URI en ArrayBuffer, avec fallback robuste
 * 1) fetch(uri).arrayBuffer() si dispo
 * 2) sinon FileSystem.readAsStringAsync(..., base64) -> Uint8Array.buffer
 */
async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(uri);
    // Certaines versions RN n'ont pas blob(), mais ont arrayBuffer()
    if (typeof (res as any).arrayBuffer === "function") {
      return await (res as any).arrayBuffer();
    }
    // Dernier ressort si blob existe quand même
    if (typeof (res as any).blob === "function") {
      const b = await (res as any).blob();
      if (typeof (b as any).arrayBuffer === "function") {
        return await (b as any).arrayBuffer();
      }
    }
  } catch {
    // on tente le fallback FS
  }
  // Fallback FileSystem -> base64
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToUint8Array(b64).buffer;
}

export default function AdminGalleryScreen({ navigation }: any) {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [legend, setLegend] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchGallery() {
    setLoading(true);
    try {
      const rows = await fetchGalleryRecords();
      setGallery(sortGalleryNewest(rows));
    } catch (e) {
      console.log("fetch_gallery_error(AdminGalleryScreen):", e);
      setGallery([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) fetchGallery();
  }, [isAdmin]);

  async function handleUploadImage() {
    if (uploading) return;
    setUploading(true);
    try {
      // 1) Permissions
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission refusée", "Autorise l'accès à la galerie photo !");
        return;
      }

      // 2) Picker — rétro-compatible (évite MediaType qui est undefined chez toi)
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        selectionLimit: 1, // ignoré si non supporté, sans gravité
      });

      if (!pick || pick.canceled || !pick.assets?.length) return;

      const asset = pick.assets[0];
      if (!asset?.uri) return;

      // 3) Normalisation (force JPEG pour HEIC iOS) + resize
      const manip = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 4) URI -> ArrayBuffer (compat totale, sans blob())
      const data = await uriToArrayBuffer(manip.uri);

      // 5) Nom + meta
      const fileName = `gallery/${Date.now()}_${Math.floor(Math.random() * 99999)}.jpg`;
      const contentType = "image/jpeg";

      // 6) Upload Supabase (ArrayBuffer direct)
      const { error: uploadErr } = await supabase.storage
        .from("news-images")
        .upload(fileName, data, {
          contentType,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      // 7) URL publique + insert via API site (declenche push galerie)
      const { data: pub } = supabase.storage.from("news-images").getPublicUrl(fileName);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error("URL de l'image introuvable.");

      const trimmedLegend = legend.trim();
      const payload: GalleryCreatePayload = trimmedLegend
        ? { url: publicUrl, legend: trimmedLegend }
        : { url: publicUrl };
      await postGalleryRecord(payload);

      setLegend("");
      await fetchGallery();
      Alert.alert("Image ajoutée !", "L'image a bien été ajoutée à la galerie.");
    } catch (e: any) {
      console.log("upload_error(AdminGalleryScreen):", e);
      Alert.alert("Erreur", e?.message || "Erreur lors de l'ajout.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(id: number, url: string) {
    if (uploading) return;
    Alert.alert(
      "Supprimer l'image",
      "Tu es sûr de vouloir supprimer cette image ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setUploading(true);
            await supabase.from("gallery").delete().eq("id", id);
            if (url) {
              const filePath = url.split("/storage/v1/object/public/news-images/")[1];
              if (filePath) await supabase.storage.from("news-images").remove([filePath]);
            }
            fetchGallery();
            setUploading(false);
          },
        },
      ]
    );
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
      <AdminHero
        title="Galerie admin"
        subtitle="Ajoute, legende et supprime des images"
        onBack={() => (router.canGoBack() ? router.back() : navigation?.goBack?.())}
      />

      {/* BODY */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ListHeaderComponent={
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ajouter une image</Text>
              <View style={styles.addForm}>
                <TextInput
                  placeholder="Légende (facultatif)"
                  style={styles.input}
                  value={legend}
                  onChangeText={setLegend}
                  placeholderTextColor="#9aa0ae"
                  maxLength={60}
                  editable={!uploading}
                />
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleUploadImage}
                  disabled={uploading}
                  activeOpacity={0.9}
                >
                  {uploading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Icon name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.primaryBtnTxt}>Ajouter</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.tip}>Les images sont compressées avant upload – tu peux y aller tranquille !</Text>
              {loading && <ActivityIndicator color="#FF8200" size="large" style={{ marginTop: 16 }} />}
              {!loading && gallery.length === 0 && (
                <Text style={{ color: "#cfd3db", textAlign: "center", marginTop: 16 }}>
                  Aucune image dans la galerie…
                </Text>
              )}
            </View>
          }
          data={gallery}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 36 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <RNImage source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
              {!!item.legend && <Text style={styles.legend}>{item.legend}</Text>}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#E53935", alignSelf: "flex-end", marginTop: 8 }]}
                onPress={() => {
                  const numericId =
                    typeof item.id === "number" ? item.id : Number(item.id);
                  if (!Number.isFinite(numericId)) {
                    Alert.alert("Erreur", "Impossible de supprimer: identifiant invalide.");
                    return;
                  }
                  handleDeleteImage(numericId, item.url);
                }}
                activeOpacity={0.9}
                disabled={uploading}
              >
                <Icon name="trash" size={16} color="#fff" />
                <Text style={styles.actionTxt}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  cardTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 16, marginBottom: 8 },
  addForm: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1, backgroundColor: "#fff", borderColor: "#FFD197", borderWidth: 1.2, borderRadius: 12,
    padding: 12, fontSize: 15.5, color: "#1c1c1c", fontWeight: "700",
  },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FF8200", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  tip: { color: "#bba163", fontSize: 12.5, marginTop: 8, fontStyle: "italic", textAlign: "center" },

  image: { width: "100%", height: 210, borderRadius: 12, backgroundColor: "#22262f" },
  legend: { color: "#e6e7eb", fontSize: 15, marginTop: 8, textAlign: "center" },

  actionBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  actionTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },
});

