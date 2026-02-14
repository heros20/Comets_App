// app/screens/ActuDetailScreen.tsx
"use client";

import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";

const logoComets = require("../../assets/images/iconComets.png");

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  created_at?: string;
  category?: string | null;
  // tolère d'autres clés éventuelles renvoyées par l'API
  [key: string]: any;
};

/** Doit matcher l'admin */
const CATEGORY_META = [
  { value: "", label: "Autres", color: "#FF8200" },
  { value: "12U", label: "12U", color: "#10b981" },
  { value: "15U", label: "15U", color: "#3b82f6" },
  { value: "Séniors", label: "Séniors", color: "#f59e0b" },
] as const;
type CatValue = (typeof CATEGORY_META)[number]["value"];

/* =================== Helpers =================== */
function stripHtml(html = "") {
  return html.replace(/(<([^>]+)>)/gi, "").replace(/&nbsp;/g, " ").trim();
}
function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

/** supprime accents, espaces, tirets/underscores, met en MAJ */
function normalizeKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques
    .replace(/[\s\-_]/g, "") // espaces/tirets/underscores
    .toUpperCase();
}

/** lit la catégorie depuis l'objet (tolère plusieurs noms de clé) */
function readCategory(a: any): string {
  const raw = a?.category ?? a?.categorie ?? a?.team_category ?? "";
  return typeof raw === "string" ? raw : String(raw ?? "");
}

/** DB -> valeur canonique ("" | "12U" | "15U" | "Séniors"). Fallback par titre si vide. */
function getCatValue(a: Article): CatValue {
  const raw = readCategory(a).trim();
  if (raw) {
    const key = normalizeKey(raw);
    if (key === "12U") return "12U";
    if (key === "15U") return "15U";
    // toutes variantes: Seniors/Séniors/Senior/Sénior
    if (key === "SENIOR" || key === "SENIORS") return "Séniors";
    // valeur non reconnue -> Autres
    return "";
  }
  // Fallback anciens posts : infère via le titre
  const tk = normalizeKey(a.title || "");
  if (tk.startsWith("12U")) return "12U";
  if (tk.startsWith("15U")) return "15U";
  if (tk.startsWith("SENIOR") || tk.startsWith("SENIORS")) return "Séniors";
  return ""; // Autres
}

function catMetaOf(value: CatValue) {
  return CATEGORY_META.find((c) => c.value === value);
}
/* =============================================== */

export default function ActuDetailScreen() {
  const navigation = useNavigation();
  // ✅ Accepte articleId OU id, et gère les tableaux (Expo Router peut renvoyer string | string[])
  const params = useLocalSearchParams<{ articleId?: string | string[]; id?: string | string[] }>();
  const rawId = Array.isArray(params.articleId)
    ? params.articleId[0]
    : params.articleId ?? (Array.isArray(params.id) ? params.id[0] : params.id);
  const articleId = rawId ? String(rawId) : undefined;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [paramError, setParamError] = useState<string | null>(null);

  useEffect(() => {
    // Si pas d'ID → on stoppe le loader et on affiche une erreur propre
    if (!articleId) {
      setParamError("Aucun identifiant d’article reçu.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setParamError(null);
        const r = await fetch(
          `https://les-comets-honfleur.vercel.app/api/news/${encodeURIComponent(articleId)}`
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Article | null;
        if (!cancelled)
          setArticle(
            data
              ? {
                  ...data,
                  image_url: data.image_url ?? null,
                  // on ne perd pas la catégorie si elle existe sous d'autres clés
                  category: data.category ?? data.categorie ?? data.team_category ?? null,
                }
              : null
          );

        // // Debug (optionnel) :
        // if (__DEV__) {
        //   console.log("[ActuDetail] raw category:", data?.category, data?.categorie, data?.team_category);
        //   console.log("[ActuDetail] normalized:", data ? getCatValue(data as Article) : null);
        // }
      } catch {
        if (!cancelled) setArticle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const siteUrl = "https://les-comets-honfleur.vercel.app";
  const articleUrl = article?.id ? `${siteUrl}/actus/${article.id}` : siteUrl;
  const cleanContent = useMemo(() => stripHtml(article?.content || ""), [article?.content]);
  const excerpt = cleanContent.slice(0, 140) + (cleanContent.length > 140 ? "…" : "");

  const shareLinks = [
    {
      label: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        articleUrl
      )}&quote=${encodeURIComponent((article?.title || "") + " – " + excerpt)}`,
      icon: "logo-facebook" as const,
    },
    {
      label: "X / Twitter",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(
        (article?.title || "") + " – " + excerpt
      )}`,
      icon: "logo-twitter" as const,
    },
    {
      label: "LinkedIn",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
      icon: "logo-linkedin" as const,
    },
    {
      label: "Email",
      url: `mailto:?subject=${encodeURIComponent(
        "À lire : " + (article?.title || "")
      )}&body=${encodeURIComponent(
        `Je voulais te partager cet article du club Les Comets d’Honfleur !\n\n${article?.title}\n\n${excerpt}\n\nLire : ${articleUrl}`
      )}`,
      icon: "mail-outline" as const,
    },
  ];

  // === ÉTATS ===
  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f1014" }}
      >
        <ActivityIndicator size="large" color="#FF8200" />
        <Text style={{ color: "#FF8200", fontWeight: "bold", marginTop: 18 }}>Chargement…</Text>
      </View>
    );
  }

  if (paramError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0f1014",
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18, textAlign: "center" }}>
          {paramError}
        </Text>
        <TouchableOpacity
          onPress={() => (navigation as any).goBack?.()}
          activeOpacity={0.9}
          style={{
            marginTop: 16,
            backgroundColor: "#FF8200",
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Retour aux actus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!article) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0f1014",
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18, textAlign: "center" }}>
          Article introuvable ou supprimé 🥲
        </Text>
        <TouchableOpacity
          onPress={() => (navigation as any).goBack?.()}
          activeOpacity={0.9}
          style={{
            marginTop: 16,
            backgroundColor: "#FF8200",
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Retour aux actus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // === Pastille catégorie (alignée admin) ===
  const cv = getCatValue(article);
  const meta = catMetaOf(cv);
  const badgeBg = meta ? `${meta.color}22` : "rgba(255,255,255,0.06)";
  const badgeBorder = meta?.color ?? "#2b3141";
  const badgeText = meta?.color ?? "#cfd3db";

  // === RENDU ===
  return (
    <View style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() =>
              (navigation as any).canGoBack?.()
                ? (navigation as any).goBack()
                : (navigation as any).navigate?.("Home")
            }
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Actualité du club</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Comets d’Honfleur</Text>
            <Text style={styles.heroSub}>Article détaillé</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {article.image_url ? (
          <Image source={{ uri: article.image_url }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: "#141821" }]} />
        )}

        <View style={styles.body}>
          <View className="chips" style={styles.chipsRow}>
            {/* Catégorie (couleur admin) */}
            <View style={[styles.chip, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.chipTxt, { color: badgeText }]}>{meta?.label ?? "Autres"}</Text>
            </View>

            {/* Date */}
            <View
              style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "#2b3141" }]}
            >
              <Icon name="time-outline" size={13} color="#cfd3db" />
              <Text style={[styles.chipTxt, { color: "#cfd3db" }]}>{formatDate(article.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.content}>{cleanContent}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => Linking.openURL(articleUrl)} activeOpacity={0.9} style={styles.primaryBtn}>
              <Icon name="open-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Ouvrir sur le site</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => (navigation as any).goBack?.()}
              activeOpacity={0.9}
              style={styles.secondaryBtn}
            >
              <Icon name="arrow-back-outline" size={18} color="#FF8200" />
              <Text style={styles.secondaryBtnTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.shareBox}>
          <Text style={styles.shareTitle}>📣 Partage cet article</Text>
          <View style={styles.shareLinks}>
            {shareLinks.map((link) => (
              <TouchableOpacity
                key={link.label}
                onPress={() => Linking.openURL(link.url)}
                activeOpacity={0.9}
                style={styles.shareBtn}
              >
                <Icon name={link.icon} size={16} color="#fff" />
                <Text style={styles.shareBtnTxt}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
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
    gap: 10,
  },
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
  heroLogo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: "#FF8200" },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },

  heroImage: { width: "92%", alignSelf: "center", height: 210, borderRadius: 17, marginTop: 14, backgroundColor: "#0f1014" },
  body: { paddingHorizontal: 16, paddingTop: 14 },

  chipsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,130,0,0.12)",
    borderColor: "rgba(255,130,0,0.35)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipTxt: { color: "#FF8200", fontWeight: "900", fontSize: 12.5 },

  title: { color: "#eaeef7", fontWeight: "900", fontSize: 22, lineHeight: 26, marginBottom: 8 },
  content: { color: "#cfd3db", fontSize: 15.5, lineHeight: 22, marginBottom: 18 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 6 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "#2b3141",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnTxt: { color: "#FF8200", fontWeight: "900", fontSize: 13.5 },

  shareBox: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  shareTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 16, marginBottom: 10, textAlign: "center" },
  shareLinks: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF8200",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
