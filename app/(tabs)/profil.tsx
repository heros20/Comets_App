import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";
const logoComets = require("../../assets/images/iconComets.png");
function normalizeName(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export default function ProfilPlayerScreen() {
  const { logout } = useAdmin();
  const [profile, setProfile] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [lastArticle, setLastArticle] = useState<any>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordEdit, setPasswordEdit] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Auth Bearer token mobile
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = token
  ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
  : {};


      // Appelle toutes les routes API
      const userRes = await fetch("https://les-comets-honfleur.vercel.app/api/me", { headers });
      const playersRes = await fetch("https://les-comets-honfleur.vercel.app/api/players", { headers });
      const cotisRes = await fetch("https://les-comets-honfleur.vercel.app/api/cotisations", { headers });
      const articleRes = await fetch("https://les-comets-honfleur.vercel.app/api/news?limit=1", { headers });

      const userJson = await userRes.json();
      const playersJson = await playersRes.json();
      const cotisJson = await cotisRes.json();
      const articleJson = await articleRes.json();

      setProfile(userJson.user);
      setPlayers(playersJson || []);
      setCotisations(cotisJson || []);
      setLastArticle(articleJson?.[0] || null);
      setForm({
        email: userJson.user.email,
        first_name: userJson.user.first_name,
        last_name: userJson.user.last_name,
        age: userJson.user.age,
        position: userJson.user.position,
        numero_maillot: userJson.user.numero_maillot,
        categorie: userJson.user.categorie,
        player_link: userJson.user.player_link,
      });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de charger le profil ou les infos club.");
    }
    setLoading(false);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setPasswordError(null);
    try {
      if (passwordEdit && (!oldPassword || password !== passwordConfirm)) {
        setPasswordError(
          !oldPassword
            ? "Ancien mot de passe requis"
            : "La confirmation ne correspond pas"
        );
        setSaving(false);
        return;
      }
      const body = {
        ...form,
        ...(passwordEdit ? { oldPassword, password } : {}),
      };
      // Auth Bearer token mobile
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch("https://les-comets-honfleur.vercel.app/api/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json?.error === "Ancien mot de passe incorrect") {
          setPasswordError("Ancien mot de passe incorrect");
        } else {
          Alert.alert("Erreur", "Mise à jour impossible.");
        }
        setSaving(false);
        return;
      }

      setProfile({ ...profile, ...form });
      setEdit(false);
      setPassword("");
      setPasswordConfirm("");
      setOldPassword("");
      setPasswordEdit(false);
      setPasswordError(null);
      Alert.alert("Succès", "Profil mis à jour !");
    } catch {
      Alert.alert("Erreur", "Mise à jour impossible.");
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEdit(false);
    setForm({
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      age: profile.age,
      position: profile.position,
      numero_maillot: profile.numero_maillot,
      categorie: profile.categorie,
      player_link: profile.player_link,
    });
    setPassword("");
    setPasswordConfirm("");
    setOldPassword("");
    setPasswordEdit(false);
    setPasswordError(null);
  };

  const handleDelete = async () => {
    Alert.alert(
      "Supprimer le compte",
      "⚠️ Es-tu sûr de vouloir supprimer ton compte ? Cette action est irréversible !",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = token
              ? { "Authorization": `Bearer ${token}` }
              : {};
            await fetch("https://les-comets-honfleur.vercel.app/api/me", {
              method: "DELETE",
              headers,
            });
            logout();
          },
        },
      ]
    );
  };

  // LOGIQUE cotisation identique au site
const hasCotisation = () => {
  const f = normalizeName(profile?.first_name);
  const l = normalizeName(profile?.last_name);

  // Table cotisations
  const cotisationOk = cotisations.some(
    (c) =>
      normalizeName(c.prenom) === f &&
      normalizeName(c.nom) === l
  );
  // Table players
  const playersOk = players.some(
    (p) =>
      normalizeName(p.first_name) === f &&
      normalizeName(p.last_name) === l
  );
  return cotisationOk || playersOk;
};



  // Lien stats FFBS (match dans table players sur prénom/nom)
  const ffbsLink = (() => {
    const f = profile?.first_name?.trim().toLowerCase();
    const l = profile?.last_name?.trim().toLowerCase();
    const match = players.find(
      (p) =>
        p.first_name?.trim().toLowerCase() === f &&
        p.last_name?.trim().toLowerCase() === l &&
        !!p.player_link
    );
    return match?.player_link || null;
  })();

  // Fonctions partage
  const getArticleUrl = (id: number | string) =>
    `https://les-comets-honfleur.vercel.app/actus/${id}`;
  function getExcerpt(text: string, n = 120) {
    if (!text) return "";
    return text.replace(/(<([^>]+)>)/gi, "").slice(0, n) + "…";
  }
  function shareLink(label: string, url: string, color: string, icon: string) {
    return (
      <TouchableOpacity
        key={label}
        onPress={() => Linking.openURL(url)}
        style={[styles.shareBtn, { backgroundColor: color }]}
        activeOpacity={0.89}
      >
        <Text style={{ fontSize: 19, marginRight: 7 }}>{icon}</Text>
        <Text style={styles.shareLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }
  function ShareLinksBox({ article }: { article: any }) {
    if (!article) return null;
    const url = getArticleUrl(article.id);
    const excerpt = getExcerpt(article.content);
    return (
      <View style={styles.shareBox}>
        <Text style={styles.shareTitle}>📣 Partage cet article !</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
          {shareLink(
            "Facebook",
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(article.title + " – " + excerpt)}`,
            "#1877F2",
            "📘"
          )}
          {shareLink(
            "X (Twitter)",
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(article.title + " – " + excerpt)}`,
            "#181818",
            "🐦"
          )}
          {shareLink(
            "LinkedIn",
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
            "#2155A5",
            "💼"
          )}
          {shareLink(
            "Email",
            `mailto:?subject=${encodeURIComponent("À lire : " + article.title)}&body=${encodeURIComponent("Je voulais te partager cet article du club Les Comets d’Honfleur !\n\n" + article.title + "\n\n" + excerpt + "\n\nDécouvre l’article complet ici : " + url)}`,
            "#FF8200",
            "✉️"
          )}
        </View>
        <Text style={styles.shareFooter}>Avec les Comets, l’info fait toujours un home run !</Text>
      </View>
    );
  }

  if (loading)
    return (
      <Text style={{ textAlign: 'center', marginTop: 70, color: '#aaa', fontSize: 18 }}>
        Chargement du profil…
      </Text>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#18181C' }}>
         {/* Logo Comets */}
      <View style={styles.logoBox}>
        <Image source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>
      <StatusBar barStyle="light-content" />
      {/* === Header : flèche retour + titre === */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon profil joueur</Text>
        <View style={{ width: 32 }} />
      </View>

   

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Affichage et édition du profil */}
          {!edit ? (
            <>
              <View style={styles.avatarBox}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {form.first_name?.[0] || ""}{form.last_name?.[0] || ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.name}>
                {form.first_name} {form.last_name}
              </Text>
              <Text style={styles.email}>{form.email}</Text>
              <View style={styles.badgeContainer}>
                {form.age ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>🧓 {form.age} ans</Text>
                  </View>
                ) : null}
                {form.categorie ? (
                  <View style={[styles.badge, { backgroundColor: "#FFE66D" }]}>
                    <Text style={[styles.badgeText, { color: "#99750C" }]}>
                      🏷️ {form.categorie}
                    </Text>
                  </View>
                ) : null}
                {form.position ? (
                  <View style={[styles.badge, { backgroundColor: "#D1F3FF" }]}>
                    <Text style={[styles.badgeText, { color: "#0C7499" }]}>
                      🧢 {form.position}
                    </Text>
                  </View>
                ) : null}
                {form.numero_maillot ? (
                  <View style={[styles.badge, { backgroundColor: "#FFD7A1" }]}>
                    <Text style={styles.badgeText}>
                      🎽 #{form.numero_maillot}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: "center", marginVertical: 16 }}>
                {hasCotisation() ? (
              <View style={styles.cotisationOk}>
                <Text style={styles.cotisationText}>
                  ✅ Cotisation payée
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.cotisationKo}>
                  <Text style={styles.cotisationText}>
                    ❌ Cotisation non payée
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#FF8200",
                    borderRadius: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 26,
                    marginVertical: 10,
                    alignItems: "center",
                    shadowColor: "#FF8200",
                    shadowOpacity: 0.14,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={async () => {
                    try {
                      const body = {
                        nom: form.last_name,
                        prenom: form.first_name,
                        age: form.age,
                        email: form.email,
                        tarif: 120,
                      };

                      const res = await fetch("https://les-comets-honfleur.vercel.app/api/stripe/checkout-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });

                      const data = await res.json();
                      if (data.url) {
                        Linking.openURL(data.url);
                      } else {
                        Alert.alert("Erreur", data.error || "Impossible de lancer le paiement.");
                      }
                    } catch (err) {
                      Alert.alert("Erreur", "Problème lors du paiement.");
                    }
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 17 }}>
                    Payer ma cotisation – 120 €
                  </Text>
                </TouchableOpacity>
              </>
            )}

              </View>
              {ffbsLink ? (
                <TouchableOpacity
                  style={styles.statsButton}
                  onPress={() => Linking.openURL(ffbsLink)}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    Voir mes stats FFBS
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEdit(true)}
              >
                <Text style={styles.editBtnText}>Modifier mon profil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
              >
                <Text style={styles.deleteBtnText}>Supprimer mon compte</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={form.first_name}
                onChangeText={(text) => handleChange("first_name", text)}
                placeholder="Prénom"
                style={styles.input}
              />
              <TextInput
                value={form.last_name}
                onChangeText={(text) => handleChange("last_name", text)}
                placeholder="Nom"
                style={styles.input}
              />
              <TextInput
                value={form.age?.toString()}
                onChangeText={(text) => handleChange("age", text)}
                placeholder="Âge"
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={form.position}
                onChangeText={(text) => handleChange("position", text)}
                placeholder="Position préférée"
                style={styles.input}
              />
              <TextInput
                value={form.numero_maillot?.toString()}
                onChangeText={(text) => handleChange("numero_maillot", text)}
                placeholder="Numéro de maillot"
                keyboardType="numeric"
                style={styles.input}
              />
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Switch
                  value={passwordEdit}
                  onValueChange={setPasswordEdit}
                  thumbColor={passwordEdit ? "#FF8200" : "#ccc"}
                  trackColor={{ false: "#ccc", true: "#FFD197" }}
                />
                <Text style={{ marginLeft: 8, color: "#FF8200", fontWeight: "600" }}>
                  Modifier le mot de passe
                </Text>
              </View>
              {passwordEdit && (
                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    placeholder="Ancien mot de passe"
                    secureTextEntry
                    style={styles.input}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Nouveau mot de passe"
                    secureTextEntry
                    style={styles.input}
                  />
                  <TextInput
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    placeholder="Confirmation du mot de passe"
                    secureTextEntry
                    style={styles.input}
                  />
                  {passwordError && (
                    <Text style={{ color: "#E53935", fontWeight: "bold", marginTop: 2 }}>
                      {passwordError}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving || (passwordEdit && (password !== passwordConfirm || !oldPassword))}
              >
                <Text style={styles.saveBtnText}>Sauvegarder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancel}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
              >
                <Text style={styles.deleteBtnText}>Supprimer mon compte</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {/* Dernier article publié */}
        {lastArticle && (
          <View style={styles.articleBox}>
            {lastArticle.image_url ? (
              <Image
                source={{ uri: lastArticle.image_url }}
                style={styles.articleImg}
                resizeMode="cover"
              />
            ) : null}
            <Text style={styles.articleDate}>
              {lastArticle.created_at &&
                new Date(lastArticle.created_at).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
            </Text>
            <Text style={styles.articleTitle}>
              {lastArticle.title}
            </Text>
            <Text numberOfLines={4} style={styles.articleExcerpt}>
              {lastArticle.content?.replace(/(<([^>]+)>)/gi, "").slice(0, 160) + "…"}
            </Text>
            <TouchableOpacity
              style={styles.readMoreBtn}
              onPress={() =>
                navigation.navigate("ActuDetail", { articleId: lastArticle.id })
              }
            >
              <Text style={styles.readMoreText}>Lire l’article</Text>
            </TouchableOpacity>
            <ShareLinksBox article={lastArticle} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181C",
    borderBottomColor: "#FF8200",
    borderBottomWidth: 1.2,
    paddingTop: Platform.OS === "ios" ? 15 : 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    marginBottom: 0,
  },
  backBtn: {
    padding: 4,
    borderRadius: 30,
    marginRight: 10,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 23,
    fontWeight: "bold",
    color: "#FF8200",
    textAlign: "center",
    letterSpacing: 1.2,
  },
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 16,
    backgroundColor: "#18181C",
    borderRadius: 26,
    padding: 8,
  },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 23,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 8,
    minHeight: 600,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(255,244,230,0.95)",
    borderRadius: 30,
    padding: 26,
    shadowColor: "#FF8200",
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 5,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "#FF8200",
  },
  avatarBox: {
    alignItems: "center",
    marginBottom: 5,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 40,
    backgroundColor: "#18181C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 3,
    borderWidth: 3,
    borderColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarText: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 28,
    letterSpacing: 2,
  },
  name: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#FF8200",
    textAlign: "center",
    marginBottom: 2,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  email: {
    color: "#222",
    textAlign: "center",
    marginBottom: 13,
    fontSize: 15,
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 11,
    justifyContent: "center",
  },
  badge: {
    backgroundColor: "#FF8200",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 19,
    margin: 4,
    shadowColor: "#FF8200",
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14.5,
    letterSpacing: 0.4,
  },
  cotisationOk: {
    backgroundColor: "#0FE97E",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 2,
    shadowColor: "#0FE97E",
    shadowOpacity: 0.13,
    shadowRadius: 3,
    elevation: 2,
  },
  cotisationKo: {
    backgroundColor: "#F44336",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 2,
    shadowColor: "#F44336",
    shadowOpacity: 0.13,
    shadowRadius: 3,
    elevation: 2,
  },
  cotisationText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    textAlign: "center",
  },
  statsButton: {
    backgroundColor: "#292E3A",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginVertical: 7,
    borderWidth: 1.5,
    borderColor: "#FF8200",
  },
  editBtn: {
    marginTop: 18,
    backgroundColor: "#FF8200",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.19,
    shadowRadius: 6,
    elevation: 3,
  },
  editBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  saveBtn: {
    backgroundColor: "#27A02C",
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 0.8,
  },
  cancelBtn: {
    backgroundColor: "#BBB",
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
  },
  cancelBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  deleteBtn: {
    backgroundColor: "#F44336",
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#F44336",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  deleteBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "#FF8200",
    borderWidth: 1.4,
    borderRadius: 13,
    padding: 15,
    marginBottom: 10,
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
    shadowColor: "#FF8200",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  articleBox: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#FF8200",
    shadowOpacity: 0.13,
    shadowRadius: 9,
    elevation: 2,
    marginBottom: 26,
    marginTop: 8,
    borderWidth: 1.2,
    borderColor: "#FF8200",
  },
  articleImg: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 11,
    backgroundColor: "#FFE2C1",
  },
  articleTitle: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 19,
    marginBottom: 4,
  },
  articleDate: {
    color: "#8d5806",
    fontWeight: "600",
    fontSize: 13,
    marginBottom: 8,
  },
  articleExcerpt: {
    color: "#33260A",
    fontSize: 15,
    marginBottom: 7,
  },
  readMoreBtn: {
    backgroundColor: "#FF8200",
    paddingVertical: 9,
    paddingHorizontal: 21,
    borderRadius: 13,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 7,
    marginBottom: 2,
  },
  readMoreText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.8,
  },
  shareBox: {
    backgroundColor: "#fff5ec",
    borderRadius: 18,
    marginTop: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  shareTitle: {
    fontWeight: "bold",
    color: "#FF8200",
    fontSize: 16,
    marginBottom: 9,
  },
  shareBtnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 3,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 13,
    margin: 5,
    marginTop: 2,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOpacity: 0.09,
    shadowRadius: 3,
    elevation: 1,
  },
  shareLabel: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  shareFooter: {
    fontSize: 13,
    color: "#FF8200",
    marginTop: 8,
    fontWeight: "600",
  },
});
