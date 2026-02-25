"use client";

import { useNavigation } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

const logoComets = require("../../assets/images/iconComets.png");
const NEWS_API_BASE = "https://les-comets-honfleur.vercel.app/api/news";
const SITE_URL = "https://les-comets-honfleur.vercel.app";

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  created_at?: string;
  category?: string | null;
  [key: string]: any;
};

const CATEGORY_META = [
  { value: "12U", label: "12U", color: "#10B981" },
  { value: "15U", label: "15U", color: "#3B82F6" },
  { value: "Seniors", label: "Seniors", color: "#F59E0B" },
  { value: "Autres", label: "Autres", color: "#FF8200" },
] as const;

type CatValue = (typeof CATEGORY_META)[number]["value"];

function stripHtml(html = "") {
  return html.replace(/(<([^>]+)>)/gi, "").replace(/&nbsp;/g, " ").trim();
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function normalizeKey(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]/g, "")
    .toUpperCase();
}

function readCategory(a: any): string {
  const raw = a?.category ?? a?.categorie ?? a?.team_category ?? "";
  return typeof raw === "string" ? raw : String(raw ?? "");
}

function getCatValue(a: Article): CatValue {
  const raw = readCategory(a).trim();
  if (raw) {
    const key = normalizeKey(raw);
    if (key === "12U") return "12U";
    if (key === "15U") return "15U";
    if (key === "SENIOR" || key === "SENIORS") return "Seniors";
    return "Autres";
  }

  const titleKey = normalizeKey(a.title || "");
  if (titleKey.startsWith("12U")) return "12U";
  if (titleKey.startsWith("15U")) return "15U";
  if (titleKey.startsWith("SENIOR") || titleKey.startsWith("SENIORS")) return "Seniors";
  return "Autres";
}

function catMetaOf(value: CatValue) {
  return CATEGORY_META.find((c) => c.value === value) || CATEGORY_META[CATEGORY_META.length - 1];
}

function withAlpha(hex: string, alpha = 0.35) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(255,130,0,${alpha})`;
  const int = parseInt(clean, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ActuDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ articleId?: string | string[]; id?: string | string[] }>();
  const rawId = Array.isArray(params.articleId)
    ? params.articleId[0]
    : params.articleId ?? (Array.isArray(params.id) ? params.id[0] : params.id);
  const articleId = rawId ? String(rawId) : undefined;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    Asset.loadAsync([logoComets]).catch(() => {});
  }, []);

  useEffect(() => {
    if (!articleId) {
      setErrorMsg("Aucun identifiant d article recu.");
      setLoading(false);
      return;
    }

    let mounted = true;
    const ctrl = new AbortController();

    const loadArticle = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const r = await fetch(`${NEWS_API_BASE}/${encodeURIComponent(articleId)}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as Article | null;

        if (!mounted) return;
        if (!data) {
          setArticle(null);
          setErrorMsg("Article introuvable.");
          return;
        }

        const normalized: Article = {
          ...data,
          image_url: data.image_url ?? null,
          category: data.category ?? data.categorie ?? data.team_category ?? null,
        };
        setArticle(normalized);

        if (normalized.image_url) {
          ExpoImage.prefetch([normalized.image_url], "memory-disk").catch(() => {});
        }
      } catch (e: any) {
        if (!mounted || e?.name === "AbortError") return;
        setArticle(null);
        setErrorMsg("Impossible de charger cet article.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadArticle();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [articleId]);

  useEffect(() => {
    setImageReady(!article?.image_url);
  }, [article?.image_url]);

  const goBack = useCallback(() => {
    if ((navigation as any).canGoBack?.()) {
      (navigation as any).goBack();
      return;
    }
    (navigation as any).navigate?.("actus");
  }, [navigation]);

  const articleUrl = article?.id ? `${SITE_URL}/actus/${article.id}` : SITE_URL;

  const cleanContent = useMemo(() => stripHtml(article?.content || ""), [article?.content]);
  const preview = useMemo(() => {
    const text = cleanContent.slice(0, 140);
    return cleanContent.length > 140 ? `${text}...` : text;
  }, [cleanContent]);

  const shareLinks = useMemo(
    () => [
      {
        label: "Facebook",
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}&quote=${encodeURIComponent(
          `${article?.title || ""} - ${preview}`
        )}`,
        icon: "logo-facebook" as const,
      },
      {
        label: "X / Twitter",
        url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(
          `${article?.title || ""} - ${preview}`
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
        url: `mailto:?subject=${encodeURIComponent(`A lire: ${article?.title || ""}`)}&body=${encodeURIComponent(
          `Je voulais te partager cet article des Comets.\n\n${article?.title || ""}\n\n${preview}\n\nLire: ${articleUrl}`
        )}`,
        icon: "mail-outline" as const,
      },
    ],
    [article?.title, articleUrl, preview]
  );

  const openLink = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {}
  }, []);

  const scrollBottomPadding = Math.max(32, insets.bottom + 20);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.stateTitle}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg || !article) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>{errorMsg || "Article introuvable."}</Text>
          <TouchableOpacity onPress={goBack} activeOpacity={0.9} style={styles.stateBtn}>
            <Text style={styles.stateBtnTxt}>Retour aux actus</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cv = getCatValue(article);
  const meta = catMetaOf(cv);
  const badgeBg = withAlpha(meta.color, 0.14);
  const badgeBorder = withAlpha(meta.color, 0.4);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10 },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroShine}
          />

          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.9}>
              <Icon name="chevron-back" size={22} color="#F3F4F6" />
            </TouchableOpacity>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Actualite detail</Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {formatDate(article.created_at)}
              </Text>
            </View>

            <View style={[styles.heroCatPill, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.heroCatText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <ExpoImage
              source={logoComets}
              cachePolicy="memory-disk"
              transition={100}
              contentFit="contain"
              style={styles.heroLogo}
            />

            <View style={styles.heroMetaContent}>
              <Text style={styles.heroMetaTitle} numberOfLines={2}>
                {article.title}
              </Text>
              <Text style={styles.heroMetaText}>Publication officielle du club</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
      >
        <View style={styles.coverWrap}>
          {!!article.image_url ? (
            <>
              <ExpoImage
                source={{ uri: article.image_url, cacheKey: `news-detail-${article.id}` }}
                recyclingKey={`news-detail-${article.id}`}
                cachePolicy="memory-disk"
                priority="high"
                transition={140}
                contentFit="cover"
                style={styles.coverImage}
                onLoad={() => setImageReady(true)}
                onError={() => setImageReady(true)}
              />
              {!imageReady && (
                <View style={styles.coverLoader}>
                  <ActivityIndicator size="small" color="#FF9E3A" />
                </View>
              )}
            </>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Icon name="image-outline" size={24} color="#4B5563" />
            </View>
          )}
        </View>

        <View style={styles.articleCard}>
          <View style={styles.articleMetaRow}>
            <View style={[styles.metaChip, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.metaChipText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <View style={styles.metaDateChip}>
              <Icon name="time-outline" size={13} color="#CBD5E1" />
              <Text style={styles.metaDateText}>{formatDate(article.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.articleTitle}>{article.title}</Text>
          <Text style={styles.articleContent}>{cleanContent}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => openLink(articleUrl)} activeOpacity={0.9} style={styles.primaryBtn}>
              <Icon name="open-outline" size={18} color="#111827" />
              <Text style={styles.primaryBtnTxt}>Ouvrir sur le site</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={goBack} activeOpacity={0.9} style={styles.secondaryBtn}>
              <Icon name="arrow-back-outline" size={18} color="#FF8200" />
              <Text style={styles.secondaryBtnTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.shareBox}>
          <Text style={styles.shareTitle}>Partager cet article</Text>
          <View style={styles.shareLinks}>
            {shareLinks.map((link) => (
              <TouchableOpacity
                key={link.label}
                onPress={() => openLink(link.url)}
                activeOpacity={0.9}
                style={styles.shareBtn}
              >
                <Icon name={link.icon} size={16} color="#111827" />
                <Text style={styles.shareBtnTxt}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: "#FF8200",
    fontWeight: "800",
    fontSize: 17,
    marginTop: 14,
    textAlign: "center",
  },
  stateBtn: {
    marginTop: 16,
    backgroundColor: "#FF8200",
    borderWidth: 1,
    borderColor: "#FFAA58",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  stateBtnTxt: {
    color: "#111827",
    fontWeight: "800",
  },

  heroWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "#0E1524",
  },
  heroGradient: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  heroShine: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: "58%",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
  },
  heroSub: {
    marginTop: 1,
    color: "#BEC8DB",
    fontSize: 12,
  },
  heroCatPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroCatText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  heroMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FF9E3A",
    backgroundColor: "#FFFFFF",
  },
  heroMetaContent: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaTitle: {
    color: "#F9FAFB",
    fontSize: 14.5,
    fontWeight: "800",
  },
  heroMetaText: {
    marginTop: 1,
    color: "#CBD2DF",
    fontSize: 11.5,
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  coverWrap: {
    width: "100%",
    height: 214,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#101623",
    position: "relative",
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,14,20,0.5)",
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101623",
  },

  articleCard: {
    marginTop: 12,
    backgroundColor: "#151C29",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.24)",
    padding: 14,
  },
  articleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  metaChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  metaDateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaDateText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
  },
  articleTitle: {
    color: "#EAEEF7",
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 27,
    marginBottom: 10,
  },
  articleContent: {
    color: "#CFD3DB",
    fontSize: 15,
    lineHeight: 22,
  },

  actionsRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFAA58",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnTxt: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13.5,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "#2B3141",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnTxt: {
    color: "#FF8200",
    fontWeight: "900",
    fontSize: 13.5,
  },

  shareBox: {
    marginTop: 14,
    backgroundColor: "#151C29",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    padding: 14,
  },
  shareTitle: {
    color: "#EAEEF7",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  shareLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF8200",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFAA58",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareBtnTxt: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13,
  },
});
