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

// Helper pour convertir base64 -> Uint8Array (binaire)
function base64ToUint8Array(base64: string) {
  const binary_string = globalThis.atob
    ? globalThis.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setUploading(false);
        return;
      }
      const asset = result.assets[0];
      if (!asset.uri) {
        setUploading(false);
        return;
      }

      // Manipulation image (compression/resize)
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.27, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Lecture binaire base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: FileSystem.EncodingType.Base64 });
      const byteArray = base64ToUint8Array(base64);

      const fileName = `gallery/${Date.now()}_${Math.floor(Math.random() * 99999)}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("news-images")
        .upload(
          fileName,
          byteArray,
          {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
            duplex: "half",
          }
        );

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase
        .storage
        .from("news-images")
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl;
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
    setUploading(true);

    Alert.alert(
      "Supprimer l'image",
      "Tu es sûr de vouloir supprimer cette image ?",
      [
        { text: "Annuler", style: "cancel", onPress: () => setUploading(false) },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await supabase.from("gallery").delete().eq("id", id);
            if (url) {
              const urlParts = url.split("/storage/v1/object/public/news-images/");
              const filePath = urlParts.length > 1 ? urlParts[1] : null;
              if (filePath) {
                await supabase.storage.from("news-images").remove([filePath]);
              }
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
      <View style={styles.logoBox}>
        <RNImage source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack && router.canGoBack()) {
              router.back();
            } else if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Galerie – Admin</Text>
        <View style={{ width: 38 }} />
      </View>
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.addForm}>
              <TextInput
                placeholder="Légende de l'image (facultatif)"
                style={styles.input}
                value={legend}
                onChangeText={setLegend}
                placeholderTextColor="#b36a00"
                maxLength={60}
                editable={!uploading}
              />
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handleUploadImage}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="cloud-upload-outline" size={20} color="#fff" style={{ marginRight: 7 }} />
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>Ajouter</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.tip}>
              Les images sont compressées avant upload – tu peux y aller tranquille !
            </Text>
            {loading && (
              <ActivityIndicator color="#FF8200" size="large" style={{ marginTop: 26 }} />
            )}
            {(!loading && gallery.length === 0) && (
              <Text style={{ color: "#aaa", textAlign: "center", marginTop: 44 }}>
                Aucune image dans la galerie…
              </Text>
            )}
          </>
        }
        data={gallery}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ padding: 14, paddingBottom: 42 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <RNImage
              source={{ uri: item.url }}
              style={styles.image}
              resizeMode="cover"
            />
            {item.legend ? (
              <Text style={styles.legend}>{item.legend}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.delBtn}
              onPress={() => handleDeleteImage(item.id, item.url)}
              activeOpacity={0.78}
              disabled={uploading}
            >
              <Icon name="trash" size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 34,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    shadowColor: "#FF8200",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    paddingTop: Platform.OS === "ios" ? 12 : 7,
    paddingBottom: 10,
    backgroundColor: "#18181C",
    borderBottomColor: "#FF8200",
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
    marginLeft: 2,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF8200",
    textAlign: "center",
    letterSpacing: 0.8,
  },
  addForm: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
    paddingHorizontal: 10,
    gap: 7,
  },
  input: {
    flex: 1,
    backgroundColor: "#FFF3E0",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    fontSize: 15.5,
    color: "#B36A00",
    borderWidth: 1.3,
    borderColor: "#FF8200",
    marginRight: 7,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8200",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    minWidth: 42,
    justifyContent: "center",
    elevation: 2,
  },
  card: {
    backgroundColor: "#fff8ef",
    borderRadius: 18,
    marginBottom: 15,
    padding: 11,
    shadowColor: "#FF8200",
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.2,
    borderColor: "#FF8200",
    position: "relative",
  },
  image: {
    width: "100%",
    height: 210,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#ffe0b2",
  },
  legend: {
    color: "#b36a00",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 5,
    marginTop: 2,
    textAlign: "center",
  },
  delBtn: {
    position: "absolute",
    top: 13,
    right: 13,
    backgroundColor: "#E53935",
    borderRadius: 17,
    padding: 6,
    zIndex: 10,
    elevation: 3,
    shadowColor: "#C50F0F",
    shadowOpacity: 0.17,
    shadowRadius: 6,
  },
  tip: {
    color: "#bba163",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 6,
    fontStyle: "italic",
  },
});
