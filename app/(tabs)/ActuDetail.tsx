import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar, Linking } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useRoute, useNavigation } from "@react-navigation/native";

// Mets à jour le chemin si besoin
const logoComets = require("../../assets/images/iconComets.png");

type Article = {
  id: number;
  title: string;
  content: string;
  image_url?: string;
  created_at?: string;
};

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ActuDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const articleId = route.params?.articleId;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    fetch(`https://les-comets-honfleur.vercel.app/api/news/${articleId}`)
      .then(r => r.json())
      .then(data => setArticle(data))
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#18181C" }}>
        <ActivityIndicator size="large" color="#FF8200" />
        <Text style={{ color: "#FF8200", fontWeight: "bold", marginTop: 20 }}>Chargement…</Text>
      </View>
    );
  }

  if (!article) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#18181C" }}>
        <Text style={{ color: "#FF8200", fontWeight: "bold", fontSize: 18 }}>Article introuvable ou supprimé 🥲</Text>
        <TouchableOpacity
          style={{
            marginTop: 18,
            paddingHorizontal: 25,
            paddingVertical: 10,
            backgroundColor: "#FF8200",
            borderRadius: 14,
          }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Retour aux actus</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const siteUrl = "https://les-comets-honfleur.vercel.app";
  const articleUrl = `${siteUrl}/actus/${article.id}`;
  const excerpt =
    typeof article.content === "string"
      ? article.content.replace(/(<([^>]+)>)/gi, "").slice(0, 120) + "…"
      : "";

  const shareLinks = [
    {
      label: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}&quote=${encodeURIComponent(article.title + " – " + excerpt)}`,
      color: "#1877F3"
    },
    {
      label: "X / Twitter",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title + " – " + excerpt)}`,
      color: "#000"
    },
    {
      label: "LinkedIn",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
      color: "#0A66C2"
    },
    {
      label: "Email",
      url: `mailto:?subject=${encodeURIComponent("À lire : " + article.title)}&body=${encodeURIComponent("Je voulais te partager cet article du club Les Comets d’Honfleur !\n\n" + article.title + "\n\n" + excerpt + "\n\nDécouvre l’article complet ici : " + articleUrl)}`,
      color: "#FF8200"
    },
  ];

  return (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" />
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
      {/* HEADER ROW : Flèche + Logo centré + Placeholder */}
      <View style={styles.logoHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.logoBackBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-back" size={30} color="#FF8200" />
        </TouchableOpacity>
        <View style={styles.logoBox}>
          <Image source={logoComets} style={styles.logo} />
        </View>
        {/* Placeholder pour équilibrer */}
        <View style={styles.logoBackBtn} />
      </View>

      {/* TITRE DE PAGE */}
      <Text style={styles.pageTitle}>Actualité du club</Text>

      {/* HERO IMAGE */}
      {article.image_url && (
        <Image
          source={{ uri: article.image_url }}
          style={styles.heroImage}
          resizeMode="cover"
        />
      )}

      {/* TITRE & DATE */}
      <View style={{ paddingHorizontal: 18, marginTop: 18 }}>
        <Text style={styles.date}>{formatDate(article.created_at)}</Text>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.content}>{article.content}</Text>
      </View>

      {/* SHARE LINKS */}
      <View style={styles.shareBox}>
        <Text style={styles.shareTitle}>📣 Partage cet article !</Text>
        <View style={styles.shareLinks}>
          {shareLinks.map(link => (
            <TouchableOpacity
              key={link.label}
              style={[styles.shareBtn, { backgroundColor: link.color }]}
              onPress={() => Linking.openURL(link.url)}
              activeOpacity={0.86}
            >
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>
                {link.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181C",
    paddingTop: 0,
  },
  logoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 32,
    marginBottom: 3,
    width: "100%",
    paddingHorizontal: 10,
  },
  logoBackBtn: {
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    borderWidth: 2.3,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    shadowColor: "#FF8200",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  pageTitle: {
    color: "#FF8200",
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 1.1,
    textAlign: "center",
    marginTop: 8,
    textShadowColor: "#FFE3B7",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
    marginBottom: 5,
  },
  heroImage: {
    width: "92%",
    alignSelf: "center",
    height: 200,
    borderRadius: 17,
    marginBottom: 0,
    marginTop: 12,
    backgroundColor: "#FFF4E6",
  },
  date: {
    color: "#FF8200",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginLeft: 2,
  },
  title: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 25,
    marginBottom: 8,
    letterSpacing: 1,
    textShadowColor: "#FFE3B7",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  content: {
    color: "#FFF",
    fontSize: 16,
    marginBottom: 22,
    marginLeft: 2,
    lineHeight: 22,
  },
  shareBox: {
    marginHorizontal: 18,
    marginBottom: 15,
    padding: 17,
    borderRadius: 17,
    backgroundColor: "#FFF4E6",
    borderColor: "#FFD197",
    borderWidth: 1.5,
    alignItems: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 2,
  },
  shareTitle: {
    color: "#E65100",
    fontWeight: "bold",
    fontSize: 17,
    marginBottom: 9,
    textAlign: "center",
  },
  shareLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  shareBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    margin: 3,
    minWidth: 60,
    alignItems: "center",
    marginBottom: 7,
  },
  backBtn: {
    marginHorizontal: 32,
    marginTop: 12,
    backgroundColor: "#FF8200",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 13,
    marginBottom: 40,
    shadowColor: "#FF8200",
    shadowOpacity: 0.13,
    shadowRadius: 9,
    elevation: 2,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16.5,
  },
});
