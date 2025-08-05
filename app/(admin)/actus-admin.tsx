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
    ScrollView,
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

// Logo du club
const logoComets = require("../../assets/images/iconComets.png");

const CATEGORIES = [
  { value: "", label: "-- Choisis une catégorie --" },
  { value: "", label: "" },
  { value: "12U - ", label: "12U" },
  { value: "15U - ", label: "15U" },
  { value: "Séniors - ", label: "Séniors" },
];

const initialForm = {
  title: "",
  content: "",
  image_url: "",
};

export default function AdminActusScreen({}: any) {
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
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setNewsList(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchNews();
  }, [isAdmin]);

  async function handleImagePick() {
    try {
      const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorise l'accès à la galerie photo !");
        return;
      }
      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        quality: 0.72,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (result.canceled || !result.assets || !result.assets[0]?.uri) return;

      setUploading(true);
      const asset = result.assets[0];
      const uri = asset.uri;

      // Lecture du fichier binaire
      const base64 = await ExpoFileSystem.readAsStringAsync(uri, { encoding: ExpoFileSystem.EncodingType.Base64 });
      const fileName = `news/${Date.now()}_${Math.floor(Math.random() * 99999)}.jpg`;

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
      const byteArray = base64ToUint8Array(base64);

      const { error: uploadErr } = await supabase.storage
        .from("news-images")
        .upload(fileName, byteArray, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
          duplex: "half",
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase
        .storage
        .from("news-images")
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) throw new Error("URL de l'image introuvable.");

      setForm(f => ({ ...f, image_url: publicUrl }));
      setUploading(false);
    } catch (e: any) {
      setUploading(false);
      Alert.alert("Erreur", e.message || "Erreur lors de l'upload");
    }
  }

  async function handleSubmit() {
    if (!category) {
      setFormError("Merci de choisir une catégorie pour l’article.");
      return;
    }
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

    const fullTitle = category + form.title;
    try {
      if (editingId) {
        await supabase
          .from("news")
          .update({ ...form, title: fullTitle })
          .eq("id", editingId);
      } else {
        await supabase
          .from("news")
          .insert([{ ...form, title: fullTitle }]);
      }
      setForm(initialForm);
      setCategory("");
      setEditingId(null);
      fetchNews();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Erreur lors de l’enregistrement");
    }
    setLoading(false);
  }

  function handleEdit(news: any) {
    const cat = CATEGORIES.find(c => news.title.startsWith(c.value))?.value || "";
    const titleSansCat = cat ? news.title.replace(cat, "") : news.title;
    setForm({
      title: titleSansCat,
      content: news.content,
      image_url: news.image_url || ""
    });
    setCategory(cat);
    setEditingId(news.id);
    setFormError("");
  }

  async function handleDelete(id: number) {
    Alert.alert(
      "Supprimer cet article ?",
      "Confirmation requise.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await supabase.from("news").delete().eq("id", id);
            setNewsList(list => list.filter(n => n.id !== id));
            if (editingId === id) {
              setEditingId(null);
              setForm(initialForm);
              setCategory("");
            }
          },
        },
      ]
    );
  }

  function handleCancelEdit() {
    setForm(initialForm);
    setCategory("");
    setEditingId(null);
    setFormError("");
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.forbidden}>
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
    <ScrollView contentContainerStyle={styles.cometsPage}>
      {/* Logo + header */}
      <View style={styles.logoBox}>
        <RNImage source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // Flèche retour multiplateforme
            if (navigation && navigation.goBack) {
              navigation.goBack();
            } else if (typeof window !== "undefined" && window.history) {
              window.history.back();
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajout Article – Admin</Text>
        <View style={{ width: 38 }} />
      </View>
      {/* ---- FOND SOMBRE EN DESSOUS ---- */}
      <View style={styles.sombreBg} />

      {/* Bloc formulaire */}
      <View style={styles.form}>
        {formError ? (
          <Text style={{ color: "#C50F0F", fontWeight: "bold", marginBottom: 8 }}>
            {formError}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", marginBottom: 10, gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={{ borderWidth: 1, borderColor: "#FF8200", borderRadius: 7 }}>
              <Picker
                selectedValue={category}
                onValueChange={setCategory}
                style={{ color: "#B36A00" }}
              >
                {CATEGORIES.map(cat => (
                  <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={t => setForm(f => ({ ...f, title: t }))}
              placeholder="Titre de l’article"
              placeholderTextColor="#b36a00"
              editable={!!category}
            />
          </View>
        </View>
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.label}>Contenu</Text>
          <TextInput
            style={[styles.input, { minHeight: 66, textAlignVertical: "top" }]}
            value={form.content}
            onChangeText={t => setForm(f => ({ ...f, content: t }))}
            placeholder="Texte de l’article"
            placeholderTextColor="#b36a00"
            multiline
          />
        </View>
        <View style={{ marginBottom: 10 }}>
          <Text style={styles.label}>Image (optionnel)</Text>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleImagePick}
            disabled={uploading}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              {uploading ? "Envoi en cours..." : (form.image_url ? "Changer l’image" : "Ajouter une image")}
            </Text>
          </TouchableOpacity>
          {form.image_url ? (
            <RNImage
              source={{ uri: form.image_url }}
              style={{ width: 120, height: 90, borderRadius: 8, backgroundColor: "#eee", alignSelf: "center", marginTop: 8 }}
              resizeMode="contain"
            />
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.saveText}>
              {loading
                ? (editingId ? "Mise à jour..." : "Publication…")
                : (editingId ? "Mettre à jour" : "Publier")}
            </Text>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelEdit}
            >
              <Text style={styles.cancelText}>
                Annuler
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* ---- CARDS ACTUS ---- */}
      <View style={{ marginBottom: 30, marginTop: 2 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#FF8200" />
        ) : newsList.length === 0 ? (
          <Text style={{ color: "#aaa", textAlign: "center", marginTop: 44 }}>
            Aucune actualité publiée…
          </Text>
        ) : (
          newsList.map(item => (
            <View style={styles.card} key={item.id}>
              {item.image_url ? (
                <RNImage
                  source={{ uri: item.image_url }}
                  style={styles.cardImg}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardContent}>{item.content}</Text>
              <Text style={styles.cardDate}>
                {item.created_at ? `Publié le ${new Date(item.created_at).toLocaleDateString("fr-FR")}` : ""}
              </Text>
              <View style={{ flexDirection: "row", marginTop: 7, gap: 10 }}>
                <TouchableOpacity onPress={() => handleEdit(item)}>
                  <Icon name="create-outline" size={21} color="#FF8200" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Icon name="trash-outline" size={21} color="#C50F0F" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
);
}

// --------- STYLES ---------
const styles = StyleSheet.create({
  cometsPage: {
    minHeight: "100%",
    backgroundColor: "#18181C", // FOND SOMBRE 2025
    paddingBottom: 60,
    paddingTop: 10,
  },
  sombreBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#18181C",
    zIndex: -1,
  },
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 26,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 23,
    borderWidth: 2.1,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    shadowColor: "#FF8200",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 3,
    paddingTop: Platform.OS === "ios" ? 7 : 4,
    paddingBottom: 11,
    backgroundColor: "#18181C",
    borderBottomColor: "#FF8200",
    borderBottomWidth: 1.7,
    marginHorizontal: 0,
    marginBottom: 11,
  },
  backBtn: {
    padding: 5,
    marginRight: 12,
    marginLeft: 3,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: "bold",
    color: "#FF8200",
    textAlign: "center",
    letterSpacing: 0.85,
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 27,
    shadowColor: "#FF8200",
    shadowOpacity: 0.13,
    shadowRadius: 15,
    elevation: 3,
    marginHorizontal: 14,
    borderWidth: 1.3,
    borderColor: "#FF8200",
  },
  label: {
    fontWeight: "bold",
    color: "#B36A00",
    marginBottom: 4,
    minWidth: 76,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff8ef",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 13,
    fontSize: 15.5,
    color: "#B36A00",
    borderWidth: 1,
    borderColor: "#FF8200",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8200",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    minWidth: 45,
    justifyContent: "center",
    elevation: 2,
    marginLeft: 8,
  },
  saveBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 32,
    elevation: 2,
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
  },
  cancelBtn: {
    backgroundColor: "#eee",
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: "#C50F0F",
    fontWeight: "bold",
    fontSize: 17,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 17,
    marginBottom: 17,
    shadowColor: "#FF8200",
    shadowOpacity: 0.13,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 1.6,
    borderColor: "#FF8200",
    marginHorizontal: 13,
    marginTop: 8,
  },
  cardImg: {
    width: 135,
    height: 98,
    borderRadius: 9,
    backgroundColor: "#ffe0b2",
    marginBottom: 9,
    alignSelf: "center",
  },
  cardTitle: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 17.7,
    marginBottom: 3,
  },
  cardContent: {
    color: "#b36a00",
    fontSize: 15.5,
    marginTop: 2,
    marginBottom: 2,
  },
  cardDate: {
    color: "#bba163",
    fontSize: 12.3,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    backgroundColor: "#18181C",
    justifyContent: "center",
    alignItems: "center",
  },
  forbidden: {
    color: "#FF8200",
    fontSize: 18,
    fontWeight: "bold",
  },
});
