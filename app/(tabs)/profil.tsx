// app/screens/ProfilPlayerScreen.tsx
"use client";

import { useNavigation, useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

// PDF local
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";

const logoComets = require("../../assets/images/iconComets.png");
const DOSSIER_MINEUR = require("../../assets/papiers/Mineur-inscription.pdf");
const DOSSIER_MAJEUR = require("../../assets/papiers/Majeur-inscription.pdf");
// === Badges ===
const BADGE_ASSETS = {
  rookie: require("../../assets/badges/rookie.png"),
  novice: require("../../assets/badges/novice.png"),
  initie: require("../../assets/badges/initie.png"),
  confirme: require("../../assets/badges/confirme.png"),
  allstar: require("../../assets/badges/allstar.png"),
} as const;

const TIERS = [
  { min: 7, key: "allstar", label: "All-Star", color: "#EF4444" },
  { min: 5, key: "confirme", label: "Confirmé", color: "#8B5CF6" },
  { min: 3, key: "initie", label: "Initié", color: "#22C55E" },
  { min: 1, key: "novice", label: "Novice", color: "#60A5FA" },
  { min: 0, key: "rookie", label: "Rookie", color: "#9CA3AF" },
] as const;

type TierKey = keyof typeof BADGE_ASSETS;

function computeBadgeFromCount(count: number) {
  const tier = TIERS.find((t) => count >= t.min) ?? TIERS[TIERS.length - 1];
  const idx = TIERS.findIndex((t) => t.key === tier.key);
  const next = idx > 0 ? TIERS[idx - 1] : null;
  let progress = 1;
  if (next) {
    const span = next.min - tier.min || 1;
    const inTier = Math.max(0, Math.min(span, count - tier.min));
    progress = inTier / span;
  }
  return { label: tier.label, key: tier.key as TierKey, color: tier.color, nextAt: next?.min ?? null, progress };
}

function normalizeName(str: string) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

type TabKey = "overview" | "edit" | "security";

// ===== Helpers date (FR <-> ISO) =====
function maskBirthdateFR(raw: string) {
  const digits = (raw || "").replace(/[^\d]/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length >= 2) {
    parts.push(digits.slice(0, 2));
    if (digits.length >= 4) {
      parts.push(digits.slice(2, 4));
      if (digits.length > 4) parts.push(digits.slice(4));
    } else {
      parts.push(digits.slice(2));
    }
  } else if (digits.length > 0) {
    parts.push(digits);
  }
  return parts.join("/");
}
function isValidFRDate(s: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const [d, m, y] = s.split("/").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
function frToISO(s: string) {
  const [d, m, y] = s.split("/").map(Number);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function isoToFR(s?: string | null) {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y).padStart(4, "0")}`;
}
function computeAgeFromISO(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dob = new Date(y, m - 1, d);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const dm = today.getMonth() - dob.getMonth();
  if (dm < 0 || (dm === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
function ageToCategorie(age: number): "12U" | "15U" | "Senior" {
  if (age < 13) return "12U";
  if (age < 17) return "15U";
  return "Senior";
}

// === Positions (label / value) ===
const POSITIONS = [
  { label: "Lanceur (P)", value: "P" },
  { label: "Receveur (C)", value: "C" },
  { label: "1ère base (1B)", value: "1B" },
  { label: "2ème base (2B)", value: "2B" },
  { label: "3ème base (3B)", value: "3B" },
  { label: "Arrêt-court (SS)", value: "SS" },
  { label: "Champ gauche (LF)", value: "LF" },
  { label: "Champ centre (CF)", value: "CF" },
  { label: "Champ droit (RF)", value: "RF" },
  { label: "Batteur désigné (DH)", value: "DH" },
  { label: "Polyvalent (UT)", value: "UT" },
] as const;
const ALLOWED_POSITIONS = POSITIONS.map((p) => p.value);

export default function ProfilPlayerScreen() {
  const navigation = useNavigation();
  const { logout, admin } = useAdmin();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [profile, setProfile] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [youngPlayers, setYoungPlayers] = useState<any[]>([]);

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Gamification (profil)
  const [participations, setParticipations] = useState<number>(
    typeof admin?.participations === "number" ? admin.participations : 0
  );

  // Sécurité (mdp)
  const [passwordEdit, setPasswordEdit] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Refetch sur focus (évite profil vide après inactivité)
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    fetchAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (!lastFetchRef.current || now - lastFetchRef.current > 60_000) {
        fetchAll(false);
      }
    }, [])
  );

  const ensureSession = async () => {
    // S’assure d’avoir une session valide (évite profil vide si token périmé)
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      try {
        await supabase.auth.refreshSession();
      } catch {
        // non bloquant
      }
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const fetchAll = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const token = await ensureSession();

      const headers: Record<string, string> = token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };

      // Ne pas remettre profile à null avant d’avoir tout reçu
      const [userRes, playersRes, cotisRes, youngRes] = await Promise.all([
        fetch("https://les-comets-honfleur.vercel.app/api/me", { headers }),
        fetch("https://les-comets-honfleur.vercel.app/api/players", { headers }),
        fetch("https://les-comets-honfleur.vercel.app/api/cotisations", { headers }),
        fetch("https://les-comets-honfleur.vercel.app/api/young_players", { headers }),
      ]);

      const safeJson = async (r: Response) => {
        try {
          return await r.json();
        } catch {
          return null;
        }
      };

      const [userJson, playersJson, cotisJson, youngJson] = await Promise.all([
        safeJson(userRes),
        safeJson(playersRes),
        safeJson(cotisRes),
        safeJson(youngRes),
      ]);

      if (userRes.ok && userJson?.user) {
        setProfile(userJson.user);
        // hydrate form
        setForm({
          email: userJson.user?.email ?? "",
          first_name: userJson.user?.first_name ?? "",
          last_name: userJson.user?.last_name ?? "",
          date_naissance_fr: isoToFR(userJson.user?.date_naissance) ?? "",
          position: userJson.user?.position ?? "",
          numero_maillot: userJson.user?.numero_maillot ?? "",
          categorie: userJson.user?.categorie ?? "",
          player_link: userJson.user?.player_link ?? "",
        });

        if (typeof userJson.user?.participations === "number") {
          setParticipations(userJson.user.participations);
        } else if (typeof admin?.participations === "number") {
          setParticipations(admin.participations);
        }
      }

      if (playersRes.ok) setPlayers(playersJson || []);
      if (cotisRes.ok) setCotisations(cotisJson || []);
      if (youngRes.ok) setYoungPlayers(Array.isArray(youngJson?.data) ? youngJson.data : []);

      lastFetchRef.current = Date.now();
    } catch {
      if (initial) Alert.alert("Erreur", "Impossible de charger le profil ou les infos club.");
    } finally {
      if (initial) setLoading(false);
    }
  };

  // === Lien FFBS (d’après players)
  const ffbsLink = useMemo(() => {
    const f = profile?.first_name?.trim().toLowerCase();
    const l = profile?.last_name?.trim().toLowerCase();
    const match = (players || []).find(
      (p) =>
        p.first_name?.trim().toLowerCase() === f &&
        p.last_name?.trim().toLowerCase() === l &&
        !!p.player_link
    );
    return match?.player_link || null;
  }, [players, profile?.first_name, profile?.last_name]);

  // === Données dérivées d'affichage
  const ageComputed = useMemo(() => computeAgeFromISO(profile?.date_naissance), [profile?.date_naissance]);
  const birthFR = useMemo(() => isoToFR(profile?.date_naissance), [profile?.date_naissance]);
  const categorieFromAge = useMemo(() => {
    if (ageComputed == null) return null;
    return ageToCategorie(ageComputed);
  }, [ageComputed]);

  // === Gamification derived data
  const badge = useMemo(() => computeBadgeFromCount(participations), [participations]);
  const unlockedKeys = useMemo(
    () => TIERS.filter((t) => participations >= t.min).map((t) => t.key as TierKey),
    [participations]
  );

  // === Helpers UI
  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // === Sauvegarde du profil (infos publiques, SANS mot de passe)
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const dnFR = (form.date_naissance_fr || "").trim();
      if (dnFR) {
        if (!isValidFRDate(dnFR)) {
          Alert.alert("Date invalide", "Merci d’entrer une date au format JJ/MM/AAAA.");
          setSaving(false);
          return;
        }
        const [d, m, y] = dnFR.split("/").map(Number);
        const dob = new Date(y, m - 1, d);
        if (dob > new Date()) {
          Alert.alert("Date invalide", "La date de naissance ne peut pas être dans le futur.");
          setSaving(false);
          return;
        }
      }

      if (form.position && !ALLOWED_POSITIONS.includes(form.position)) {
        Alert.alert("Position invalide", "Merci de sélectionner une position valide.");
        setSaving(false);
        return;
      }
      if (form.numero_maillot !== "" && form.numero_maillot != null) {
        const num = Number(form.numero_maillot);
        if (!Number.isInteger(num) || num < 1 || num > 99) {
          Alert.alert("Numéro invalide", "Merci de sélectionner un numéro entre 1 et 99.");
          setSaving(false);
          return;
        }
      }

      const token = await ensureSession();
      const headers = token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };

      const body: any = {
        first_name: form.first_name,
        last_name: form.last_name,
        ...(form.position ? { position: form.position } : { position: null }),
        ...(form.numero_maillot ? { numero_maillot: Number(form.numero_maillot) } : { numero_maillot: null }),
        ...(dnFR ? { date_naissance: frToISO(dnFR) } : { date_naissance: null }),
      };

      const res = await fetch("https://les-comets-honfleur.vercel.app/api/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        Alert.alert("Erreur", json?.error || "Mise à jour impossible.");
        setSaving(false);
        return;
      }

      if (json?.user) {
        setProfile(json.user);
        setForm((prev: any) => ({
          ...prev,
          first_name: json.user.first_name ?? "",
          last_name: json.user.last_name ?? "",
          position: json.user.position ?? "",
          numero_maillot: json.user.numero_maillot ?? "",
          categorie: json.user.categorie ?? "",
          date_naissance_fr: isoToFR(json.user.date_naissance) ?? "",
        }));
      }

      setEdit(false);
      setActiveTab("overview");
      Alert.alert("Succès", "Profil mis à jour !");
    } catch {
      Alert.alert("Erreur", "Mise à jour impossible.");
    }
    setSaving(false);
  };

  // === Changement de mot de passe (onglet Sécurité)
  const handleChangePassword = async () => {
    setSaving(true);
    setPasswordError(null);
    try {
      if (!passwordEdit) {
        setSaving(false);
        return;
      }
      if (!oldPassword) {
        setPasswordError("Ancien mot de passe requis");
        setSaving(false);
        return;
      }
      if (password !== passwordConfirm) {
        setPasswordError("La confirmation ne correspond pas");
        setSaving(false);
        return;
      }

      const token = await ensureSession();
      const headers = token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };

      const res = await fetch("https://les-comets-honfleur.vercel.app/api/me", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ oldPassword, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json?.error === "Ancien mot de passe incorrect") {
          setPasswordError("Ancien mot de passe incorrect");
        } else {
          setPasswordError(json?.error || "Mise à jour du mot de passe impossible.");
        }
        setSaving(false);
        return;
      }

      setPassword("");
      setPasswordConfirm("");
      setOldPassword("");
      setPasswordEdit(false);
      setPasswordError(null);
      Alert.alert("Succès", "Mot de passe mis à jour !");
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour le mot de passe.");
    }
    setSaving(false);
  };

  const handleCancelProfile = () => {
    setEdit(false);
    setActiveTab("overview");
    setForm({
      email: profile?.email ?? "",
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      date_naissance_fr: isoToFR(profile?.date_naissance) ?? "",
      position: profile?.position ?? "",
      numero_maillot: profile?.numero_maillot ?? "",
      categorie: profile?.categorie ?? "",
      player_link: profile?.player_link ?? "",
    });
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
            try {
              const token = await ensureSession();
              const headers = token ? { Authorization: `Bearer ${token}` } : {};
              await fetch("https://les-comets-honfleur.vercel.app/api/me", { method: "DELETE", headers });
            } catch {}
            logout();
          },
        },
      ]
    );
  };

  // === COTISATION: logique “payée” étendue avec young_players
  const hasCotisation = () => {
    const fAdmin = normalizeName(admin?.first_name);
    const lAdmin = normalizeName(admin?.last_name);
    const fProfile = normalizeName(profile?.first_name);
    const lProfile = normalizeName(profile?.last_name);

    const f = fAdmin || fProfile;
    const l = lAdmin || lProfile;

    const cotisationOk = (cotisations || []).some(
      (c) => normalizeName(c.prenom) === f && normalizeName(c.nom) === l
    );

    const playersOk = (players || []).some(
      (p) => normalizeName(p.first_name) === f && normalizeName(p.last_name) === l
    );

    const youngOk = (youngPlayers || []).some(
      (yp) => normalizeName(yp.first_name) === f && normalizeName(yp.last_name) === l
    );

    return cotisationOk || playersOk || youngOk;
  };

// ——— Remplace TOUTE la fonction handleAdhesionDownload par ceci :

// Téléchargement/partage d'un PDF local (générique)
const downloadLocalPdf = async (pdfModule: any, outName: string) => {
  try {
    if (Platform.OS === "web") {
      Alert.alert(
        "Non disponible sur web",
        "Le téléchargement local n’est pas disponible ici. Récupère le PDF depuis le site si besoin."
      );
      return;
    }

    const asset = Asset.fromModule(pdfModule);
    await asset.downloadAsync();
    const src = asset.localUri || asset.uri;
    if (!src) {
      Alert.alert("Erreur", "PDF introuvable dans le bundle.");
      return;
    }

    const dest = FileSystem.documentDirectory + outName;
    try {
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      }
    } catch {}

    await FileSystem.copyAsync({ from: src, to: dest });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(dest, {
        dialogTitle: "Documents d’adhésion – Les Comets",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    } else {
      await Linking.openURL(dest);
    }
  } catch {
    Alert.alert("Erreur", "Impossible d’ouvrir le PDF.");
  }
};

const handleDownloadMineur = () =>
  downloadLocalPdf(DOSSIER_MINEUR, "dossier_mineur_les_comets.pdf");

const handleDownloadMajeur = () =>
  downloadLocalPdf(DOSSIER_MAJEUR, "dossier_majeur_les_comets.pdf");


  if (loading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#18181C" }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18 }}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );

  // ——— Composants UI ———
  const Coin = ({ size, borderColor, source }: { size: number; borderColor: string; source: any }) => (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#fff",
        borderWidth: 3,
        borderColor,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        shadowColor: borderColor,
        shadowOpacity: Platform.OS === "ios" ? 0.18 : 0.12,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {source ? (
        <Image source={source} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={{ fontSize: size * 0.42 }}>🏅</Text>
      )}
    </View>
  );

const Tab = ({ id, label, icon }: { id: TabKey; label: string; icon: string }) => {
  const active = activeTab === id;
  return (
    <TouchableOpacity
      onPress={() => {
        setActiveTab(id);
        if (id === "edit") setEdit(true);
        else setEdit(false);
      }}
      style={[styles.tabBtn, active && { backgroundColor: "#FF8200", borderColor: "#FF8200" }]}
      activeOpacity={0.9}
    >
      <Text style={[styles.tabIcon, active && { color: "#fff" }]}>{String(icon)}</Text>
      <Text style={[styles.tabLabel, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
};


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HÉRO */}
      <View style={styles.hero}>
        <View style={styles.heroStripe} />
        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() =>
              // @ts-ignore
              (navigation as any).canGoBack()
                ? // @ts-ignore
                  (navigation as any).goBack()
                : // @ts-ignore
                  (navigation as any).navigate("Home")
            }
            style={styles.backBtnHero}
          >
            <Icon name="chevron-back" size={26} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Mon profil joueur</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarTxt}>
              {(form.first_name?.[0] || "").toUpperCase()}
              {(form.last_name?.[0] || "").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>
              {form.first_name} {form.last_name}
            </Text>
            <Text style={styles.heroEmail}>{form.email}</Text>
            <View style={styles.heroChips}>
              {(categorieFromAge || profile?.categorie) ? (
                <View style={[styles.chip, { backgroundColor: "#FFE66D" }]}>
                  <Text style={[styles.chipTxt, { color: "#8a6a08" }]}>
                    🏷️ {(categorieFromAge || profile?.categorie) as string}
                  </Text>
                </View>
              ) : null}

              {profile?.position ? (
                <View style={[styles.chip, { backgroundColor: "#D1F3FF" }]}>
                  <Text style={[styles.chipTxt, { color: "#0C7499" }]}>🧢 {profile.position}</Text>
                </View>
              ) : null}

              {profile?.numero_maillot ? (
                <View style={[styles.chip, { backgroundColor: "#FFD7A1" }]}>
                  <Text style={styles.chipTxt}>🎽 #{profile.numero_maillot}</Text>
                </View>
              ) : null}

              {ageComputed !== null ? (
                <View style={[styles.chip, { backgroundColor: "#FFEDD5" }]}>
                  <Text style={[styles.chipTxt, { color: "#7C2D12" }]}>🧓 {ageComputed} ans</Text>
                </View>
              ) : null}

              {birthFR ? (
                <View style={[styles.chip, { backgroundColor: "#E0F2FE" }]}>
                  <Text style={[styles.chipTxt, { color: "#075985" }]}>📅 {birthFR}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
        </View>

        {/* Onglets */}
        <View style={styles.tabs}>
          <Tab id="overview" label="Aperçu" icon="🏠" />
          <Tab id="edit" label="Éditer" icon="✏️" />
          <Tab id="security" label="Sécurité" icon="🔒" />
        </View>
      </View>

      {/* CONTENU */}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Aperçu */}
        {activeTab === "overview" && (
          <>
            {/* Carte Gamification */}
            <View style={styles.card}>
              <View style={styles.rowCenter}>
                <View style={{ alignItems: "center", marginRight: 18 }}>
                  <Coin size={96} borderColor={badge.color} source={BADGE_ASSETS[badge.key]} />
                  <Text style={[styles.badgeTitle, { color: badge.color }]}>{badge.label}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.progressWrap}>
                    <View style={styles.progressBg}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(badge.progress * 100)}%`, backgroundColor: badge.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressHelp}>
                      {badge.nextAt === null
                        ? "Palier max atteint 🎉"
                        : `Prochain titre à ${badge.nextAt} participations`}
                    </Text>
                  </View>

                  <View style={styles.statRow}>
                    <View style={styles.statPill}>
                      <Text style={styles.statPillTxt}>
                        🔥 {participations} participation{participations > 1 ? "s" : ""}
                      </Text>
                    </View>
                    {ffbsLink ? (
                      <TouchableOpacity
                        style={styles.statLink}
                        onPress={() => Linking.openURL(ffbsLink!)}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.statLinkTxt}>Voir mes stats FFBS ↗</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Mur de badges */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 2, paddingTop: 14 }}
              >
                {TIERS.slice().reverse().map((t) => {
                  const k = t.key as TierKey;
                  const gotIt = unlockedKeys.includes(k);
                  return (
                    <View
                      key={k}
                      style={{
                        alignItems: "center",
                        opacity: gotIt ? 1 : 0.35,
                        marginRight: 16,
                      }}
                    >
                      <Coin size={64} borderColor={t.color} source={BADGE_ASSETS[k]} />
                      <Text style={styles.wallLabel}>{t.label}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* Cotisation + Paiement */}
            <View style={styles.card}>
              {hasCotisation() ? (
                <View style={styles.cotisationOk}>
                  <Text style={styles.cotisationText}>✅ Cotisation payée</Text>
                </View>
              ) : (
                <>
                  <View style={styles.cotisationKo}>
                    <Text style={styles.cotisationText}>❌ Cotisation non payée</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={async () => {
                      try {
                        const body = {
                          nom: profile?.last_name,
                          prenom: profile?.first_name,
                          age: ageComputed,
                          email: profile?.email,
                          tarif: 120,
                        };

                        const res = await fetch(
                          "https://les-comets-honfleur.vercel.app/api/stripe/checkout-session",
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          }
                        );

                        const data = await res.json();
                        if (data.url) {
                          Linking.openURL(data.url);
                        } else {
                          Alert.alert("Erreur", data.error || "Impossible de lancer le paiement.");
                        }
                      } catch {
                        Alert.alert("Erreur", "Problème lors du paiement.");
                      }
                    }}
                  >
                    <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 17 }}>
                      Payer ma cotisation – 120 €
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Documents d’adhésion */}
           <View style={styles.card}>
              <Text style={styles.sectionTitle}>📎 Documents d’adhésion</Text>
              <Text style={{ color: "#98a0ae", fontSize: 13, fontStyle: "italic", marginBottom: 10, textAlign: "center" }}>
                Choisis et télécharge ton dossier d’inscription selon ton âge.
              </Text>



              <TouchableOpacity style={styles.payBtn} onPress={handleDownloadMineur} activeOpacity={0.9}>
                <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 17 }}>
                 Dossier d’inscription – Mineur (PDF)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.payBtn, { marginTop: 10 }]} onPress={handleDownloadMajeur} activeOpacity={0.9}>
                <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 17 }}>
                  Dossier d’inscription – Majeur (PDF)
                </Text>
              </TouchableOpacity>

              <View style={{ marginTop: 10, opacity: 0.8 }}>
                <Text style={{ color: "#98a0ae", fontSize: 12.5 }}>
                  Format: PDF • Ouvrable avec n’importe quel lecteur PDF
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ÉDITER — version moderne (sans mdp) */}
        {activeTab === "edit" && (
          <View style={styles.cardModern}>
            <View style={styles.headerModern}>
              <Text style={styles.headerTitle}>Éditer mon profil</Text>
              <Text style={styles.headerSubtitle}>Mets à jour tes infos en 20 secondes chrono.</Text>
            </View>

            {/* Prénom */}
            <View style={styles.field}>
              <Text style={styles.label}>Prénom</Text>
              <View style={styles.fieldRow}>
                <Icon name="person-outline" size={18} style={styles.iconLeft} />
                <TextInput
                  value={form.first_name}
                  onChangeText={(t) => handleChange("first_name", t)}
                  placeholder="John"
                  placeholderTextColor="#8d93a3"
                  style={styles.inputModern}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Nom */}
            <View style={styles.field}>
              <Text style={styles.label}>Nom</Text>
              <View style={styles.fieldRow}>
                <Icon name="id-card-outline" size={18} style={styles.iconLeft} />
                <TextInput
                  value={form.last_name}
                  onChangeText={(t) => handleChange("last_name", t)}
                  placeholder="Doe"
                  placeholderTextColor="#8d93a3"
                  style={styles.inputModern}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Date de naissance */}
            <View style={styles.field}>
              <Text style={styles.label}>Date de naissance</Text>
              <View style={styles.fieldRow}>
                <Icon name="calendar-outline" size={18} style={styles.iconLeft} />
                <TextInput
                  value={form.date_naissance_fr ?? ""}
                  onChangeText={(t) => handleChange("date_naissance_fr", maskBirthdateFR(t))}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor="#8d93a3"
                  keyboardType="number-pad"
                  style={styles.inputModern}
                  maxLength={10}
                />
              </View>
              {isValidFRDate(form.date_naissance_fr || "") ? (
                <Text style={styles.hint}>
                  {(() => {
                    const iso = frToISO(form.date_naissance_fr || "");
                    const age = computeAgeFromISO(iso);
                    const cat = age != null ? ageToCategorie(age) : null;
                    return `Âge estimé: ${age ?? "?"} • Catégorie: ${cat ?? "?"}`;
                  })()}
                </Text>
              ) : (
                (form.date_naissance_fr || "").length > 0 && (
                  <Text style={styles.hintWarn}>Format attendu : JJ/MM/AAAA</Text>
                )
              )}
            </View>

            {/* Position préférée */}
            <View style={styles.field}>
              <Text style={styles.label}>Position préférée</Text>
              <View style={styles.fieldRow}>
                <Icon name="baseball-outline" size={18} style={styles.iconLeft} />
                <Picker
                  selectedValue={form.position ?? ""}
                  style={styles.pickerModern}
                  dropdownIconColor="#FF8200"
                  onValueChange={(value) => handleChange("position", value)}
                >
                  <Picker.Item label="— Sélectionner —" value="" />
                  {POSITIONS.map((p) => (
                    <Picker.Item key={p.value} label={p.label} value={p.value} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Numéro de maillot */}
            <View style={styles.field}>
              <Text style={styles.label}>Numéro de maillot</Text>
              <View style={styles.fieldRow}>
                <Icon name="pricetag-outline" size={18} style={styles.iconLeft} />
                <Picker
                  selectedValue={String(form.numero_maillot ?? "")}
                  style={styles.pickerModern}
                  dropdownIconColor="#FF8200"
                  onValueChange={(value) => {
                    if (value === "") handleChange("numero_maillot", "");
                    else handleChange("numero_maillot", Number(value));
                  }}
                >
                  <Picker.Item label="— Sélectionner —" value="" />
                  {Array.from({ length: 99 }, (_, i) => i + 1).map((num) => (
                    <Picker.Item key={num} label={num.toString()} value={num.toString()} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave, saving && styles.btnDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                <Text style={styles.btnSaveText}>Sauvegarder</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={handleCancelProfile}>
                <Text style={styles.btnGhostText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* SÉCURITÉ */}
        {activeTab === "security" && (
          <View style={styles.cardModern}>
            <View style={styles.headerModern}>
              <Text style={styles.headerTitle}>Sécurité du compte</Text>
              <Text style={styles.headerSubtitle}>
                Modifie ton mot de passe et gère la suppression du compte.
              </Text>
            </View>

            {/* Toggle mdp */}
            <TouchableOpacity
              onPress={() => setPasswordEdit(!passwordEdit)}
              style={styles.passwordToggle}
              activeOpacity={0.85}
            >
              <View style={styles.passwordToggleLeft}>
                <Icon name="lock-closed-outline" size={18} color="#FF8200" />
                <Text style={styles.passwordToggleText}>Modifier le mot de passe</Text>
              </View>
              <Switch
                value={passwordEdit}
                onValueChange={setPasswordEdit}
                thumbColor={passwordEdit ? "#FF8200" : "#666"}
                trackColor={{ false: "#2a2f3b", true: "#ffcf9f" }}
              />
            </TouchableOpacity>

            {passwordEdit && (
              <View style={{ gap: 10, marginTop: 6 }}>
                {/* Ancien mdp */}
                <View style={styles.fieldRow}>
                  <Icon name="key-outline" size={18} style={styles.iconLeft} />
                  <TextInput
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    placeholder="Ancien mot de passe"
                    placeholderTextColor="#8d93a3"
                    secureTextEntry={!showOld}
                    style={styles.inputModern}
                  />
                  <TouchableOpacity onPress={() => setShowOld((v) => !v)}>
                    <Icon name={showOld ? "eye-off-outline" : "eye-outline"} size={20} color="#FF8200" />
                  </TouchableOpacity>
                </View>

                {/* Nouveau mdp */}
                <View style={styles.fieldRow}>
                  <Icon name="shield-checkmark-outline" size={18} style={styles.iconLeft} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="#8d93a3"
                    secureTextEntry={!showNew}
                    style={styles.inputModern}
                  />
                  <TouchableOpacity onPress={() => setShowNew((v) => !v)}>
                    <Icon name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color="#FF8200" />
                  </TouchableOpacity>
                </View>

                {/* Confirmation */}
                <View style={styles.fieldRow}>
                  <Icon name="shield-outline" size={18} style={styles.iconLeft} />
                  <TextInput
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    placeholder="Confirmation"
                    placeholderTextColor="#8d93a3"
                    secureTextEntry={!showConfirm}
                    style={styles.inputModern}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
                    <Icon name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#FF8200" />
                  </TouchableOpacity>
                </View>

                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>
            )}

            {/* Actions sécurité */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnSave,
                  (saving || (passwordEdit && (password !== passwordConfirm || !oldPassword))) && styles.btnDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={saving || (passwordEdit && (password !== passwordConfirm || !oldPassword))}
              >
                <Text style={styles.btnSaveText}>
                  {passwordEdit ? "Mettre à jour le mot de passe" : "Rien à sauvegarder"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => {
                  setPasswordEdit(false);
                  setPassword("");
                  setPasswordConfirm("");
                  setOldPassword("");
                  setPasswordError(null);
                  setShowOld(false);
                  setShowNew(false);
                  setShowConfirm(false);
                }}
              >
                <Text style={styles.btnGhostText}>Annuler</Text>
              </TouchableOpacity>
            </View>

            {/* Suppression de compte */}
            <TouchableOpacity style={styles.btnDangerOutline} onPress={handleDelete}>
              <Text style={styles.btnDangerOutlineText}>Supprimer mon compte</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab !== "edit" && <View style={{ height: 24 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // HÉRO
  hero: {
    backgroundColor: "#11131a",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 12 : 22,
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
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 10 : 6,
  },
  backBtnHero: {
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
  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  heroAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#18181C",
    borderWidth: 3,
    borderColor: "#FF8200",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  heroAvatarTxt: {
    color: "#FF8200",
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: 1,
  },
  heroName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  heroEmail: {
    color: "#c7cad1",
    fontSize: 13,
  },
  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipTxt: {
    fontWeight: "800",
    fontSize: 12.5,
  },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: "#141821",
    borderWidth: 1,
    borderColor: "#252a38",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabIcon: {
    color: "#FF8200",
    fontSize: 15,
  },
  tabLabel: {
    color: "#FF8200",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },

  // BODY
  body: {
    padding: 14,
    paddingBottom: 28,
    backgroundColor: "#0f1014",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },

  // Gamif
  rowCenter: { flexDirection: "row", alignItems: "center" },
  badgeTitle: { fontWeight: "900", fontSize: 16, marginTop: 8 },
  progressWrap: { gap: 6 },
  progressBg: {
    width: "100%",
    height: 12,
    backgroundColor: "#1c2030",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2f3d",
  },
  progressFill: { height: "100%", borderRadius: 12 },
  progressHelp: { color: "#b9bdc8", fontSize: 12.5, fontWeight: "600" },

  // Stats
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
    flexWrap: "wrap",
  },
  statPill: {
    backgroundColor: "#141821",
    borderColor: "#252a38",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  statPillTxt: { color: "#fff", fontWeight: "800", fontSize: 13.5 },

  statLink: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#FF8200",
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  statLinkTxt: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12.5,
  },

  wallLabel: { color: "#fff", fontWeight: "800", fontSize: 12, marginTop: 7 },

  // Paiement
  cotisationOk: {
    backgroundColor: "#0FE97E",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  cotisationKo: {
    backgroundColor: "#F44336",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  cotisationText: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  payBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 26,
    marginTop: 12,
    alignItems: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
    alignSelf: "center",
  },

  // Texte
  sectionTitle: { color: "#FF8200", fontWeight: "900", fontSize: 16, marginBottom: 8 },

  // Moderne (Éditer + Sécurité)
  cardModern: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 14,
  },

  headerModern: { marginBottom: 10 },
  headerTitle: { color: "#FF8200", fontWeight: "900", fontSize: 18, letterSpacing: 0.3 },
  headerSubtitle: { color: "#b8bdc8", fontSize: 12.5, marginTop: 2 },

  field: { marginBottom: 12 },
  label: { color: "#e7e9ee", fontWeight: "800", fontSize: 13, marginBottom: 6 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.2,
    borderColor: "rgba(255,130,0,0.28)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 0,
    minHeight: 44,
  },
  iconLeft: { color: "#FF9E3A", marginRight: 8 },
  inputModern: {
    flex: 1,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  pickerModern: {
    flex: 1,
    color: "#fff",
    backgroundColor: "transparent",
  },

  hint: { color: "#91ffa8", fontSize: 12, marginTop: 6, fontWeight: "700" },
  hintWarn: { color: "#ffd18f", fontSize: 12, marginTop: 6, fontWeight: "700" },
  errorText: { color: "#ff6b6b", fontWeight: "800", marginTop: 4 },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 1,
    marginVertical: 12,
  },

  passwordToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  passwordToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  passwordToggleText: { color: "#FF8200", fontWeight: "900" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },

  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSave: {
    backgroundColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  btnSaveText: { color: "#0f1014", fontWeight: "900", fontSize: 16, letterSpacing: 0.6 },

  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  btnGhostText: { color: "#e7e9ee", fontWeight: "800", fontSize: 16 },

  btnDisabled: { opacity: 0.6 },

  btnDangerOutline: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "rgba(255,60,60,0.7)",
    alignItems: "center",
  },
  btnDangerOutlineText: { color: "#ff6b6b", fontWeight: "900" },
});
