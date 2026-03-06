// app/screens/ProfilPlayerScreen.tsx
"use client";

import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";
import { DrawerMenuButton } from "../../components/navigation/AppDrawer";
import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

// PDF local
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";

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

function normalizeName(str?: string | null) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

type TabKey = "overview" | "edit" | "security";

type FamilyMember = {
  id: string;
  relation: "self" | "child";
  first_name: string;
  last_name: string;
  categorie?: "Seniors" | "15U" | "12U" | null;
  date_naissance?: string | null;
  young_player_id?: string | null;
};

type YoungPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  categorie?: "15U" | "12U" | "Seniors" | "Senior" | null;
  date_naissance?: string | null;
};

const CATEGORY_SORT_ORDER: Record<string, number> = {
  "12U": 0,
  "15U": 1,
  Seniors: 2,
  Senior: 2,
};

function getCategorySortValue(categorie?: string | null) {
  const key = String(categorie ?? "").trim();
  if (!key) return 99;
  return CATEGORY_SORT_ORDER[key] ?? 99;
}

function compareByCategoryThenName(
  a: { categorie?: string | null; first_name?: string; last_name?: string },
  b: { categorie?: string | null; first_name?: string; last_name?: string }
) {
  const categoryDelta = getCategorySortValue(a.categorie) - getCategorySortValue(b.categorie);
  if (categoryDelta !== 0) return categoryDelta;

  const lastNameDelta = String(a.last_name ?? "").localeCompare(String(b.last_name ?? ""), "fr");
  if (lastNameDelta !== 0) return lastNameDelta;

  return String(a.first_name ?? "").localeCompare(String(b.first_name ?? ""), "fr");
}

const YOUTH_TABS = ["12U", "15U"] as const;
type YouthTab = (typeof YOUTH_TABS)[number];

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
  const { logout, admin, isLoading: isAuthLoading } = useAdmin();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [profile, setProfile] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [youngPlayers, setYoungPlayers] = useState<YoungPlayer[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedYoungPlayerId, setSelectedYoungPlayerId] = useState("");
  const [activeYouthTab, setActiveYouthTab] = useState<YouthTab>("12U");
  const [linkingChild, setLinkingChild] = useState(false);
  const [unlinkingChildId, setUnlinkingChildId] = useState<string | null>(null);
  const [familyStatus, setFamilyStatus] = useState<null | "success" | "error">(null);
  const [familyMessage, setFamilyMessage] = useState("");

  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSlowLoading, setShowSlowLoading] = useState(false);

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
  const logoutInFlightRef = useRef(false);

  const ensureSession = useCallback(async () => {
    // Assure une session valide (evite profil vide si token perime)
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
  }, []);

  const withSessionHeader = useCallback(
    (headers: Record<string, string>) => {
      const out = { ...headers };
      const sessionToken =
        typeof admin?.session_token === "string" ? admin.session_token.trim() : "";
      if (sessionToken) {
        out["x-admin-session"] = sessionToken;
      }
      return out;
    },
    [admin?.session_token]
  );

  const refreshFamilyMembers = useCallback(async () => {
    try {
      const token = await ensureSession();
      const headers = withSessionHeader(
        token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" }
      );

      const res = await fetch("https://les-comets-honfleur.vercel.app/api/family/members", {
        headers,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.data)) {
        setFamilyMembers(json.data as FamilyMember[]);
        return;
      }
    } catch {}
    setFamilyMembers([]);
  }, [ensureSession, withSessionHeader]);

  const fetchAll = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const token = await ensureSession();

      const headers = withSessionHeader(
        token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" }
      );

      const requestInit: RequestInit = { headers, credentials: "include" };

      // Ne pas remettre profile à null avant d'avoir tout reçu
      const [userRes, playersRes, cotisRes, youngRes, familyRes] = await Promise.all([
        fetch("https://les-comets-honfleur.vercel.app/api/me", requestInit),
        fetch("https://les-comets-honfleur.vercel.app/api/players", requestInit),
        fetch("https://les-comets-honfleur.vercel.app/api/cotisations", requestInit),
        fetch("https://les-comets-honfleur.vercel.app/api/young_players?onlyKids=true", requestInit),
        fetch("https://les-comets-honfleur.vercel.app/api/family/members", requestInit),
      ]);

      const safeJson = async (r: Response) => {
        try {
          return await r.json();
        } catch {
          return null;
        }
      };

      const [userJson, playersJson, cotisJson, youngJson, familyJson] = await Promise.all([
        safeJson(userRes),
        safeJson(playersRes),
        safeJson(cotisRes),
        safeJson(youngRes),
        safeJson(familyRes),
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
      } else {
        // Garde un minimum d'infos visibles même si /api/me répond 401/404
        setForm((prev: any) => ({
          email: prev?.email || admin?.email || "",
          first_name: prev?.first_name || admin?.first_name || "",
          last_name: prev?.last_name || admin?.last_name || "",
          date_naissance_fr: prev?.date_naissance_fr || "",
          position: prev?.position || "",
          numero_maillot: prev?.numero_maillot || "",
          categorie: prev?.categorie || "",
          player_link: prev?.player_link || "",
        }));
      }

      if (playersRes.ok) setPlayers(playersJson || []);
      if (cotisRes.ok) setCotisations(cotisJson || []);
      if (youngRes.ok) setYoungPlayers(Array.isArray(youngJson?.data) ? youngJson.data : []);
      if (familyRes.ok) setFamilyMembers(Array.isArray(familyJson?.data) ? familyJson.data : []);

      lastFetchRef.current = Date.now();
    } catch {
      if (initial) Alert.alert("Erreur", "Impossible de charger le profil ou les infos club.");
    } finally {
      if (initial) setLoading(false);
    }
  }, [
    admin?.email,
    admin?.first_name,
    admin?.last_name,
    admin?.participations,
    ensureSession,
    withSessionHeader,
  ]);

  useEffect(() => {
    fetchAll(true);
  }, [fetchAll]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (admin) return;
    requestAnimationFrame(() => {
      router.replace("/");
    });
  }, [admin, isAuthLoading, router]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (!lastFetchRef.current || now - lastFetchRef.current > 60_000) {
        fetchAll(false);
      }
    }, [fetchAll])
  );

  useEffect(() => {
    if (!loading) {
      setShowSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowLoading(true), 650);
    return () => clearTimeout(timer);
  }, [loading]);

  // === Lien FFBS (d'après players)
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
  const childMembers = useMemo(
    () => familyMembers.filter((m) => m.relation === "child"),
    [familyMembers]
  );
  const sortedChildMembers = useMemo(
    () => [...childMembers].sort(compareByCategoryThenName),
    [childMembers]
  );
  const childCountsByTab = useMemo(
    () => ({
      "12U": childMembers.filter((member) => member.categorie === "12U").length,
      "15U": childMembers.filter((member) => member.categorie === "15U").length,
    }),
    [childMembers]
  );
  const linkedYoungIds = useMemo(() => {
    const out = new Set<string>();
    childMembers.forEach((member) => {
      const id = String(member.young_player_id ?? "").trim();
      if (id) out.add(id);
    });
    return out;
  }, [childMembers]);
  const youthPlayersOnly = useMemo(
    () => youngPlayers.filter((p) => p.categorie === "12U" || p.categorie === "15U"),
    [youngPlayers]
  );
  const availableYoungPlayers = useMemo(
    () => youthPlayersOnly.filter((p) => !linkedYoungIds.has(String(p.id))),
    [youthPlayersOnly, linkedYoungIds]
  );
  const sortedAvailableYoungPlayers = useMemo(
    () => [...availableYoungPlayers].sort(compareByCategoryThenName),
    [availableYoungPlayers]
  );
  const availableCountsByTab = useMemo(
    () => ({
      "12U": sortedAvailableYoungPlayers.filter((player) => player.categorie === "12U").length,
      "15U": sortedAvailableYoungPlayers.filter((player) => player.categorie === "15U").length,
    }),
    [sortedAvailableYoungPlayers]
  );
  const visibleChildMembers = useMemo(
    () => sortedChildMembers.filter((member) => member.categorie === activeYouthTab),
    [sortedChildMembers, activeYouthTab]
  );
  const visibleAvailableYoungPlayers = useMemo(
    () => sortedAvailableYoungPlayers.filter((player) => player.categorie === activeYouthTab),
    [sortedAvailableYoungPlayers, activeYouthTab]
  );

  // === Gamification derived data
  const badge = useMemo(() => computeBadgeFromCount(participations), [participations]);
  const unlockedKeys = useMemo(
    () => TIERS.filter((t) => participations >= t.min).map((t) => t.key as TierKey),
    [participations]
  );

  useEffect(() => {
    if (!selectedYoungPlayerId) return;
    if (visibleAvailableYoungPlayers.some((p) => String(p.id) === selectedYoungPlayerId)) return;
    setSelectedYoungPlayerId("");
  }, [visibleAvailableYoungPlayers, selectedYoungPlayerId]);

  useEffect(() => {
    const activeTotal = childCountsByTab[activeYouthTab] + availableCountsByTab[activeYouthTab];
    if (activeTotal > 0) return;

    const fallback = YOUTH_TABS.find(
      (tab) => childCountsByTab[tab] + availableCountsByTab[tab] > 0
    );
    if (fallback && fallback !== activeYouthTab) {
      setActiveYouthTab(fallback);
    }
  }, [activeYouthTab, childCountsByTab, availableCountsByTab]);

  // === Helpers UI
  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleLinkChild = async () => {
    if (!selectedYoungPlayerId) return;
    setLinkingChild(true);
    setFamilyStatus(null);
    setFamilyMessage("");

    try {
      const token = await ensureSession();
      const headers = withSessionHeader(
        token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" }
      );

      const res = await fetch("https://les-comets-honfleur.vercel.app/api/family/members", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ young_player_id: selectedYoungPlayerId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Impossible de lier cet enfant."));
      }

      if (Array.isArray(json?.members)) {
        setFamilyMembers(json.members as FamilyMember[]);
      } else {
        await refreshFamilyMembers();
      }
      setSelectedYoungPlayerId("");
      setFamilyStatus("success");
      setFamilyMessage("Enfant lié avec succès.");
    } catch (e: any) {
      setFamilyStatus("error");
      setFamilyMessage(String(e?.message ?? "Impossible de lier cet enfant."));
    } finally {
      setLinkingChild(false);
    }
  };

  const performUnlinkChild = useCallback(
    async (member: FamilyMember) => {
      setUnlinkingChildId(member.id);
      setFamilyStatus(null);
      setFamilyMessage("");
      try {
        const token = await ensureSession();
        const headers = withSessionHeader(
          token ? { Authorization: `Bearer ${token}` } : {}
        );

        const res = await fetch(
          `https://les-comets-honfleur.vercel.app/api/family/members/${encodeURIComponent(member.id)}`,
          {
            method: "DELETE",
            headers,
            credentials: "include",
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(String(json?.error ?? "Impossible de retirer cet enfant."));
        }
        await refreshFamilyMembers();
        setFamilyStatus("success");
        setFamilyMessage("Enfant retiré du compte.");
      } catch (e: any) {
        setFamilyStatus("error");
        setFamilyMessage(String(e?.message ?? "Impossible de retirer cet enfant."));
      } finally {
        setUnlinkingChildId(null);
      }
    },
    [ensureSession, refreshFamilyMembers, withSessionHeader]
  );

  const handleUnlinkChild = (member: FamilyMember) => {
    if (member.relation !== "child") return;
    const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
    Alert.alert("Retirer l'enfant", `Retirer ${fullName || "cet enfant"} de votre compte ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: () => {
          performUnlinkChild(member);
        },
      },
    ]);
  };

  // === Sauvegarde du profil (infos publiques, SANS mot de passe)
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const dnFR = (form.date_naissance_fr || "").trim();
      if (dnFR) {
        if (!isValidFRDate(dnFR)) {
          Alert.alert("Date invalide", "Merci de saisir une date au format JJ/MM/AAAA.");
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
      const headers = withSessionHeader(
        token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" }
      );

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
        credentials: "include",
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
      const headers = withSessionHeader(
        token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" }
      );

      const res = await fetch("https://les-comets-honfleur.vercel.app/api/me", {
        method: "PATCH",
        headers,
        credentials: "include",
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

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Souhaites-tu te déconnecter de ton compte sur cet appareil ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: async () => {
            if (logoutInFlightRef.current) return;
            logoutInFlightRef.current = true;
            try {
              await logout();
            } catch {
              Alert.alert("Erreur", "Impossible de se déconnecter pour le moment.");
            } finally {
              logoutInFlightRef.current = false;
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert(
      "Supprimer le compte",
      "Es-tu sûr de vouloir supprimer ton compte ? Cette action est irréversible !",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            if (logoutInFlightRef.current) return;
            logoutInFlightRef.current = true;
            try {
              const token = await ensureSession();
              const headers = withSessionHeader(
                token ? { Authorization: `Bearer ${token}` } : {}
              );
              await fetch("https://les-comets-honfleur.vercel.app/api/me", { method: "DELETE", headers, credentials: "include" });
            } catch {}
            try {
              await logout();
            } finally {
              logoutInFlightRef.current = false;
            }
          },
        },
      ]
    );
  };

  // === COTISATION: logique "payée" étendue avec young_players
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

// --- Remplace toute la fonction handleAdhesionDownload par ceci :

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
        dialogTitle: "Documents d’adhésion - Les Comets",
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

  if (loading && !showSlowLoading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#18181C" }}>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>
    );

  if (!isAuthLoading && !admin)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#18181C" }}>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>
    );

  if (loading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#18181C" }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18 }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );

  // --- Composants UI ---
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
        <Text style={{ fontSize: size * 0.42 }}></Text>
      )}
    </View>
  );

const Tab = ({ id, label, icon }: { id: TabKey; label: string; icon: string }) => {
  const active = activeTab === id;
  return (
    <TouchableOpacity
      onPress={() => {
        setActiveTab(id);
      }}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      activeOpacity={0.9}
    >
      <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
        <Icon name={icon as any} size={15} color={active ? "#0B0F17" : "#FF9C41"} />
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
};


  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View style={styles.hero}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroShine}
          />

          <View style={styles.heroRow}>
            <DrawerMenuButton style={styles.backBtnHero} />

            <View style={styles.heroHeading}>
              <Text style={styles.heroEyebrow}>Espace joueur</Text>
              <Text style={styles.heroTitle}>Mon profil</Text>
            </View>

            <View style={styles.heroStatus}>
              <View style={styles.heroStatusDot} />
              <Text style={styles.heroStatusText}>Actif</Text>
            </View>
          </View>

          <View style={styles.heroProfileRow}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarTxt}>
                {(form.first_name?.[0] || "").toUpperCase()}
                {(form.last_name?.[0] || "").toUpperCase()}
              </Text>
            </View>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroName}>
                {form.first_name} {form.last_name}
              </Text>
              <Text style={styles.heroEmail}>{form.email}</Text>
            </View>
          </View>

          <View style={styles.heroChips}>
            {(categorieFromAge || profile?.categorie) ? (
              <View style={[styles.chip, { backgroundColor: "rgba(255,130,0,0.25)", borderColor: "rgba(255,195,130,0.65)" }]}>
                <Text style={[styles.chipTxt, { color: "#FFE2C2" }]}>Catégorie {(categorieFromAge || profile?.categorie) as string}</Text>
              </View>
            ) : null}

            {profile?.position ? (
              <View style={[styles.chip, { backgroundColor: "rgba(59,130,246,0.22)", borderColor: "rgba(147,197,253,0.6)" }]}>
                <Text style={[styles.chipTxt, { color: "#DBEAFE" }]}>Poste {profile.position}</Text>
              </View>
            ) : null}

            {profile?.numero_maillot ? (
              <View style={[styles.chip, { backgroundColor: "rgba(16,185,129,0.22)", borderColor: "rgba(110,231,183,0.65)" }]}>
                <Text style={[styles.chipTxt, { color: "#D1FAE5" }]}>Maillot #{profile.numero_maillot}</Text>
              </View>
            ) : null}

            {ageComputed !== null ? (
              <View style={[styles.chip, { backgroundColor: "rgba(244,114,182,0.2)", borderColor: "rgba(251,207,232,0.58)" }]}>
                <Text style={[styles.chipTxt, { color: "#FCE7F3" }]}>{ageComputed} ans</Text>
              </View>
            ) : null}

            {birthFR ? (
              <View style={[styles.chip, { backgroundColor: "rgba(167,139,250,0.22)", borderColor: "rgba(221,214,254,0.58)" }]}>
                <Text style={[styles.chipTxt, { color: "#EDE9FE" }]}>Ne le {birthFR}</Text>
              </View>
            ) : null}
          </View>

          {/* Onglets */}
          <View style={styles.tabs}>
            <Tab id="overview" label="Aperçu" icon="home-outline" />
            <Tab id="edit" label="Éditer" icon="create-outline" />
            <Tab id="security" label="Sécurité" icon="shield-checkmark-outline" />
          </View>
        </LinearGradient>
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
                        ? "Palier max atteint"
                        : `Prochain titre dans ${badge.nextAt} participations`}
                    </Text>
                  </View>

                  <View style={styles.statRow}>
                    <View style={styles.statPill}>
                      <Text style={styles.statPillTxt}>
                         {participations} participation{participations > 1 ? "s" : ""}
                      </Text>
                    </View>
                    {ffbsLink ? (
                      <TouchableOpacity
                        style={styles.statLink}
                        onPress={() => Linking.openURL(ffbsLink!)}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.statLinkTxt}>Voir mes stats FFBS</Text>
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
                  <Text style={styles.cotisationText}>Cotisation payée</Text>
                </View>
              ) : (
                <>
                  <View style={styles.cotisationKo}>
                    <Text style={styles.cotisationText}>Cotisation non payée</Text>
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
                      Payer ma cotisation - 120 EUR
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Comptes enfants liés */}
            <View style={styles.card}>
              <View style={styles.familyHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Comptes enfants liés</Text>
                  <Text style={styles.familySubtitle}>
                    Liez vos enfants depuis la base jeunes joueurs pour gérer matchs et cotisations.
                  </Text>
                </View>
                <View style={styles.familyCountBadge}>
                  <Text style={styles.familyCountText}>{childMembers.length} lié(s)</Text>
                </View>
              </View>

              <View style={styles.familyTabsWrap}>
                {YOUTH_TABS.map((tab) => {
                  const active = activeYouthTab === tab;
                  const tabStyle =
                    tab === "12U" ? styles.familyTabBtn12UActive : styles.familyTabBtn15UActive;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.familyTabBtn, active && tabStyle]}
                      onPress={() => setActiveYouthTab(tab)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.familyTabTitle, active && styles.familyTabTitleActive]}>
                        {tab}
                      </Text>
                      <Text style={[styles.familyTabMeta, active && styles.familyTabMetaActive]}>
                        {childCountsByTab[tab]} lié(s) - {availableCountsByTab[tab]} a lier
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.field, { marginTop: 12, marginBottom: 0 }]}>
                <Text style={styles.label}>Ajouter un enfant ({activeYouthTab})</Text>
                <View style={styles.fieldRow}>
                  <Icon name="person-add-outline" size={18} style={styles.iconLeft} />
                  <Picker
                    selectedValue={selectedYoungPlayerId}
                    style={styles.familyPicker}
                    dropdownIconColor="#FF8200"
                    onValueChange={(value) => setSelectedYoungPlayerId(String(value || ""))}
                  >
                    <Picker.Item label={`- Selectionner un enfant ${activeYouthTab} -`} value="" />
                    {visibleAvailableYoungPlayers.map((player) => {
                      const name = [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
                      return <Picker.Item key={player.id} label={name || String(player.id)} value={String(player.id)} />;
                    })}
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.familyLinkBtn,
                  (linkingChild || !selectedYoungPlayerId || visibleAvailableYoungPlayers.length === 0) &&
                    styles.familyLinkBtnDisabled,
                ]}
                onPress={handleLinkChild}
                activeOpacity={0.9}
                disabled={linkingChild || !selectedYoungPlayerId || visibleAvailableYoungPlayers.length === 0}
              >
                <Text style={styles.familyLinkBtnText}>
                  {linkingChild ? "Liaison..." : "Lier cet enfant"}
                </Text>
              </TouchableOpacity>

              {youngPlayers.length > 0 && availableYoungPlayers.length === 0 && (
                <Text style={styles.familyHint}>
                  Tous les jeunes joueurs disponibles sont deja liés a ce compte.
                </Text>
              )}
              {availableYoungPlayers.length > 0 && visibleAvailableYoungPlayers.length === 0 && (
                <Text style={styles.familyHint}>Aucun joueur disponible dans l onglet {activeYouthTab}.</Text>
              )}
              {familyStatus === "success" && <Text style={styles.familyStatusSuccess}>{familyMessage}</Text>}
              {familyStatus === "error" && <Text style={styles.familyStatusError}>{familyMessage}</Text>}

              <View style={{ marginTop: 12, gap: 8 }}>
                {childMembers.length === 0 ? (
                  <Text style={styles.familyEmptyText}>Aucun enfant lié pour le moment.</Text>
                ) : visibleChildMembers.length === 0 ? (
                  <Text style={styles.familyEmptyText}>
                    Aucun enfant lié dans l onglet {activeYouthTab}.
                  </Text>
                ) : (
                  visibleChildMembers.map((member) => {
                    const name = [member.first_name, member.last_name].filter(Boolean).join(" ").trim();
                    return (
                      <View key={member.id} style={styles.familyMemberRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.familyMemberName}>{name || member.id}</Text>
                          <Text style={styles.familyMemberMeta}>
                            {member.categorie || "-"}
                            {member.date_naissance ? `  ${isoToFR(member.date_naissance)}` : ""}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.familyUnlinkBtn,
                            unlinkingChildId === member.id && styles.familyUnlinkBtnDisabled,
                          ]}
                          onPress={() => handleUnlinkChild(member)}
                          disabled={unlinkingChildId === member.id}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.familyUnlinkBtnText}>
                            {unlinkingChildId === member.id ? "..." : "Retirer"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* Documents d’adhésion */}
           <View style={styles.card}>
              <Text style={styles.sectionTitle}>Documents d’adhésion</Text>
              <Text style={{ color: "#98a0ae", fontSize: 13, fontStyle: "italic", marginBottom: 10, textAlign: "center" }}>
                Choisis et télécharge ton dossier d’inscription selon ton âge.
              </Text>



              <TouchableOpacity style={styles.payBtn} onPress={handleDownloadMineur} activeOpacity={0.9}>
                <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 17 }}>
                 Dossier d’inscription - Mineur (PDF)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.payBtn, { marginTop: 10 }]} onPress={handleDownloadMajeur} activeOpacity={0.9}>
                <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 17 }}>
                  Dossier d’inscription - Majeur (PDF)
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

        {/* ÉDITER - version moderne (sans mdp) */}
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
                    return `Age estime: ${age ?? "?"} • Categorie: ${cat ?? "?"}`;
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
                  <Picker.Item label="- Sélectionner -" value="" />
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
                  <Picker.Item label="- Sélectionner -" value="" />
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
                Modifie ton mot de passe, déconnecte-toi et gère la suppression du compte.
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
                  styles.btnPasswordAction,
                  !passwordEdit && styles.btnPasswordActionIdle,
                  (saving || (passwordEdit && (password !== passwordConfirm || !oldPassword || !password))) &&
                    styles.btnDisabled,
                ]}
                onPress={passwordEdit ? handleChangePassword : () => setPasswordEdit(true)}
                disabled={saving || (passwordEdit && (password !== passwordConfirm || !oldPassword || !password))}
              >
                <View style={styles.btnPasswordContent}>
                  <Icon
                    name={passwordEdit ? "shield-checkmark-outline" : "create-outline"}
                    size={18}
                    color={passwordEdit ? "#0f1014" : "#FFE9D1"}
                  />
                  <Text style={[styles.btnPasswordText, !passwordEdit && styles.btnPasswordTextIdle]}>
                    {passwordEdit ? "Mettre à jour le mot de passe" : "Activer la modification"}
                  </Text>
                </View>
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

            <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.9}>
              <Icon name="log-out-outline" size={18} color="#FFD6AB" />
              <Text style={styles.btnLogoutText}>Se déconnecter</Text>
            </TouchableOpacity>

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
  safe: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  // HERO
  hero: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.34)",
    backgroundColor: "#101826",
  },
  heroGradient: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 12,
    paddingBottom: 14,
  },
  heroShine: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: "50%",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  backBtnHero: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroHeading: {
    flex: 1,
    marginLeft: 2,
  },
  heroEyebrow: {
    color: "#FFD6AB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.05,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 2,
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "900",
  },
  heroStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  heroStatusText: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 11.5,
  },
  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.34)",
    borderWidth: 2,
    borderColor: "#FFAA58",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarTxt: {
    color: "#FFE4C6",
    fontWeight: "900",
    fontSize: 21,
    letterSpacing: 0.8,
  },
  heroIdentity: {
    flex: 1,
  },
  heroName: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 23,
  },
  heroEmail: {
    marginTop: 2,
    color: "#D4D8E0",
    fontSize: 12.5,
  },
  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  chipTxt: {
    fontWeight: "800",
    fontSize: 12,
    color: "#F3F4F6",
  },
  tabs: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  tabBtnActive: {
    backgroundColor: "#FF8200",
    borderColor: "#FFB366",
  },
  tabIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,130,0,0.2)",
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  tabLabel: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 13.5,
  },
  tabLabelActive: {
    color: "#0B0F17",
    fontWeight: "900",
  },

  // BODY
  body: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 34,
    backgroundColor: "#0B0F17",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
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
  familyHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  familySubtitle: {
    color: "#B8C1CF",
    fontSize: 12.5,
    lineHeight: 18,
  },
  familyCountBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.32)",
    backgroundColor: "rgba(255,130,0,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  familyCountText: {
    color: "#FFD8B0",
    fontSize: 11.5,
    fontWeight: "800",
  },
  familyTabsWrap: {
    marginTop: 8,
    gap: 8,
  },
  familyTabBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  familyTabBtn12UActive: {
    borderColor: "rgba(52,211,153,0.7)",
    backgroundColor: "rgba(16,185,129,0.22)",
  },
  familyTabBtn15UActive: {
    borderColor: "rgba(125,211,252,0.7)",
    backgroundColor: "rgba(14,116,144,0.26)",
  },
  familyTabTitle: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "900",
  },
  familyTabTitleActive: {
    color: "#FFFFFF",
  },
  familyTabMeta: {
    marginTop: 2,
    color: "#AEB8C8",
    fontSize: 11.5,
    fontWeight: "700",
  },
  familyTabMetaActive: {
    color: "#F4F8FF",
  },
  familyPicker: {
    flex: 1,
    color: "#fff",
    backgroundColor: "transparent",
  },
  familyLinkBtn: {
    marginTop: 12,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  familyLinkBtnDisabled: {
    opacity: 0.5,
  },
  familyLinkBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "900",
  },
  familyHint: {
    marginTop: 8,
    color: "#B9C3D1",
    fontSize: 12,
    fontWeight: "600",
  },
  familyStatusSuccess: {
    marginTop: 8,
    color: "#86EFAC",
    fontSize: 12.5,
    fontWeight: "800",
  },
  familyStatusError: {
    marginTop: 8,
    color: "#FCA5A5",
    fontSize: 12.5,
    fontWeight: "800",
  },
  familyMemberRow: {
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.26)",
    backgroundColor: "rgba(15,23,42,0.58)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  familyMemberName: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "800",
  },
  familyMemberMeta: {
    marginTop: 2,
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  familyUnlinkBtn: {
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.7)",
    backgroundColor: "rgba(249,115,22,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  familyUnlinkBtnDisabled: {
    opacity: 0.55,
  },
  familyUnlinkBtnText: {
    color: "#FFD9B1",
    fontSize: 12,
    fontWeight: "800",
  },
  familyEmptyText: {
    color: "#CBD5E1",
    fontSize: 12.5,
    fontWeight: "600",
  },

  // Moderne (Editer + Securite)
  cardModern: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 12,
  },

  headerModern: { marginBottom: 10 },
  headerTitle: { color: "#FF9E3A", fontWeight: "900", fontSize: 18, letterSpacing: 0.3 },
  headerSubtitle: { color: "#B8C1CF", fontSize: 12.5, marginTop: 2 },

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

  btnPasswordAction: {
    backgroundColor: "#FF8200",
    borderWidth: 1,
    borderColor: "#FFB366",
    shadowColor: "#FF8200",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  btnPasswordActionIdle: {
    backgroundColor: "rgba(255,130,0,0.16)",
    borderColor: "rgba(255,130,0,0.48)",
    shadowOpacity: 0,
    elevation: 0,
  },
  btnPasswordContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPasswordText: {
    color: "#0f1014",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  btnPasswordTextIdle: {
    color: "#FFE9D1",
  },

  btnLogout: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "rgba(255,130,0,0.5)",
    backgroundColor: "rgba(255,130,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnLogoutText: {
    color: "#FFD6AB",
    fontWeight: "900",
    fontSize: 14.5,
  },

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






