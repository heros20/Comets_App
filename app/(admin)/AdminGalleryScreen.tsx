// app/screens/AdminGalleryScreen.tsx
"use client";

import * as FileSystem from "expo-file-system";
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

const logoComets = require("../../assets/images/iconComets.png");

type GalleryItem = {
  id: number;
  url: string;
  legend: string | null;
  created_at: string;
};

function base64ToUint8Array(base64: string) {
  const binary_string = globalThis.atob
    ? globalThis.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
  return bytes;
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
    const { data, error } = await supabase
      .from("gallery")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setGallery(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchGallery();
  }, [isAdmin]);

  async function handleUploadImage() {
    if (uploading) return;
    setUploading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission refusée", "Autorise l'accès à la galerie photo !");
        setUploading(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets?.length) {
        setUploading(false);
        return;
      }
      const asset = result.assets[0];
      if (!asset.uri) { setUploading(false); return; }

      const manip = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.27, format: ImageManipulator.SaveFormat.JPEG }
      );
      const base64 = await FileSystem.readAsStringAsync(manip.uri, { encoding: FileSystem.EncodingType.Base64 });
      const byteArray = base64ToUint8Array(base64);
      const fileName = `gallery/${Date.now()}_${Math.floor(Math.random() * 99999)}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("news-images")
        .upload(fileName, byteArray, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
          duplex: "half",
        });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from("news-images").getPublicUrl(fileName);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error("URL de l'image introuvable.");

      const { error: insertErr } = await supabase
        .from("gallery")
        .insert([{ url: publicUrl, legend }]);
      if (insertErr) throw insertErr;

      setLegend("");
      fetchGallery();
      Alert.alert("Image ajoutée !", "L'image a bien été ajoutée à la galerie.");
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Erreur lors de l'ajout.");
    }
    setUploading(false);
  }

  async function handleDeleteImage(id: number, url: string) {
    if (uploading) return;
    Alert.alert(
      "Supprimer l'image",
      "Tu es sûr de vouloir supprimer cette image ?",
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
          <Text style={styles.heroTitle}>Galerie (admin)</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.heroProfileRow}>
          <RNImage source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Photos officielles du club</Text>
            <Text style={styles.heroSub}>Ajoute, légende et supprime des images</Text>
          </View>
        </View>
      </View>

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
                onPress={() => handleDeleteImage(item.id, item.url)}
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
  hero: {
    backgroundColor: "#11131a",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
    paddingBottom: 10,
  },
  heroStripe: {
    position: "absolute",
    right: -60, top: -40, width: 240, height: 240, borderRadius: 120,
    backgroundColor: "rgba(255,130,0,0.10)", transform: [{ rotate: "18deg" }],
  },
  heroRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#1b1e27",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2f3d",
  },
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
