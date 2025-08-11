// app/screens/ActuDetailScreen.tsx
"use client";

import { useNavigation, useRoute } from "@react-navigation/native";
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

const logoComets = require("../../assets/images/iconComets.png");

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  created_at?: string;
};

const TEAM_CATEGORIES = ["12U", "15U", "Seniors"] as const;

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
function getTeamCat(title: string) {
  const norm = (title || "").trim().toUpperCase();
  for (const cat of TEAM_CATEGORIES) {
    if (norm.startsWith(cat.toUpperCase())) return cat;
  }
  return "Autres";
}

export default function ActuDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const articleId = route.params?.articleId;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articleId) return;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`https://les-comets-honfleur.vercel.app/api/news/${articleId}`);
        const data = await r.json();
        setArticle(data);
      } catch (e) {
        setArticle(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [articleId]);

  const siteUrl = "https://les-comets-honfleur.vercel.app";
  const articleUrl = article?.id ? `${siteUrl}/actus/${article.id}` : siteUrl;
  const cleanContent = useMemo(() => stripHtml(article?.content || ""), [article?.content]);
  const excerpt = cleanContent.slice(0, 140) + (cleanContent.length > 140 ? "…" : "");

  const shareLinks = [
    {
      label: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}&quote=${encodeURIComponent(
        (article?.title || "") + " – " + excerpt
      )}`,
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
      url: `mailto:?subject=${encodeURIComponent("À lire : " + (article?.title || ""))}&body=${encodeURIComponent(
        `Je voulais te partager cet article du club Les Comets d’Honfleur !\n\n${article?.title}\n\n${excerpt}\n\nLire : ${articleUrl}`
      )}`,
      icon: "mail-outline" as const,
    },
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f1014" }}>
        <ActivityIndicator size="large" color="#FF8200" />
        <Text style={{ color: "#FF8200", fontWeight: "bold", marginTop: 18 }}>Chargement…</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f1014" }}>
        <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18, textAlign: "center", paddingHorizontal: 24 }}>
          Article introuvable ou supprimé 🥲
        </Text>
        <TouchableOpacity
          onPress={() => (navigation as any).goBack()}
          activeOpacity={0.9}
          style={{ marginTop: 16, backgroundColor: "#FF8200", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Retour aux actus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO (mêmes codes que ActusScreen) */}
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
              // @ts-ignore
              (navigation as any).canGoBack()
                ? // @ts-ignore
                  (navigation as any).goBack()
                : // @ts-ignore
                  (navigation as any).navigate("Home")
            }
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Actualité du club</Text>

          {/* espace symétrique */}
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Comets d’Honfleur</Text>
            <Text style={styles.heroSub}>Article détaillée</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* HERO IMAGE */}
        {article.image_url ? (
          <Image source={{ uri: article.image_url }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: "#141821" }]} />
        )}

        {/* CONTENU */}
        <View style={styles.body}>
          {/* Chips (catégorie + date) */}
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{getTeamCat(article.title)}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "#2b3141" }]}>
              <Icon name="time-outline" size={13} color="#cfd3db" />
              <Text style={[styles.chipTxt, { color: "#cfd3db" }]}>{formatDate(article.created_at)}</Text>
            </View>
          </View>

          {/* Titre + contenu */}
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.content}>{cleanContent}</Text>

          {/* Boutons d’action */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => Linking.openURL(articleUrl)}
              activeOpacity={0.9}
              style={styles.primaryBtn}
            >
              <Icon name="open-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Ouvrir sur le site</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => (navigation as any).goBack()}
              activeOpacity={0.9}
              style={[styles.secondaryBtn]}
            >
              <Icon name="arrow-back-outline" size={18} color="#FF8200" />
              <Text style={styles.secondaryBtnTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SHARE (boîte glass, sombre) */}
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
  // === HERO (identiques à ActusScreen) ===
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
  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
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

  // === IMAGE PRINCIPALE ===
  heroImage: {
    width: "92%",
    alignSelf: "center",
    height: 210,
    borderRadius: 17,
    marginTop: 14,
    backgroundColor: "#0f1014",
  },

  // === CORPS ===
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

  title: {
    color: "#eaeef7",
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 26,
    marginBottom: 8,
  },
  content: {
    color: "#cfd3db",
    fontSize: 15.5,
    lineHeight: 22,
    marginBottom: 18,
  },

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

  // === PARTAGE (glass sombre) ===
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
  shareTitle: {
    color: "#eaeef7",
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
