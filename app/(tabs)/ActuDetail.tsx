"use client";

import { useNavigation } from "@react-navigation/native";
import { Asset } from "expo-asset";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { useAdmin } from "../../contexts/AdminContext";
import { parseNewsCategoriesWithFallback } from "../../lib/newsCategories";
import { supabase } from "../../supabase";
import { saveRemoteImage } from "../../utils/saveRemoteImage";

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
type ContentChunk =
  | { type: "text"; value: string }
  | { type: "link"; value: string };

type NewsComment = {
  id: number;
  news_id: number;
  parent_id: number | null;
  author_name: string;
  message: string;
  created_at: string;
};

type NewsCommentNode = NewsComment & { replies: NewsCommentNode[] };

function formatDateTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCommentTree(list: NewsComment[]): NewsCommentNode[] {
  const byParent = new Map<number, NewsComment[]>();
  const roots: NewsComment[] = [];

  list.forEach((comment) => {
    if (comment.parent_id == null) {
      roots.push(comment);
      return;
    }
    const arr = byParent.get(comment.parent_id) || [];
    arr.push(comment);
    byParent.set(comment.parent_id, arr);
  });

  const sortByCreatedAt = (a: NewsComment, b: NewsComment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  const attach = (comment: NewsComment): NewsCommentNode => {
    const replies = (byParent.get(comment.id) || [])
      .sort(sortByCreatedAt)
      .map(attach);
    return { ...comment, replies };
  };

  return roots.sort(sortByCreatedAt).map(attach);
}

function CommentItem({
  item,
  depth,
  replyToId,
  onReply,
}: {
  item: NewsCommentNode;
  depth: number;
  replyToId: number | null;
  onReply: (id: number) => void;
}) {
  return (
    <View style={[styles.commentCard, { marginLeft: Math.min(depth, 4) * 14 }]}>
      <View style={styles.commentHeaderRow}>
        <Text style={styles.commentAuthor}>{item.author_name || "Supporter Comets"}</Text>
        <Text style={styles.commentDate}>{formatDateTime(item.created_at)}</Text>
      </View>
      <Text style={styles.commentMessage}>{item.message}</Text>
      <TouchableOpacity
        onPress={() => onReply(item.id)}
        activeOpacity={0.85}
        style={styles.commentReplyBtn}
      >
        <Text style={styles.commentReplyBtnTxt}>
          {replyToId === item.id ? "Reponse en cours" : "Repondre"}
        </Text>
      </TouchableOpacity>

      {item.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          item={reply}
          depth={depth + 1}
          replyToId={replyToId}
          onReply={onReply}
        />
      ))}
    </View>
  );
}

function stripHtml(html = "") {
  return html.replace(/(<([^>]+)>)/gi, "").replace(/&nbsp;/g, " ").trim();
}

function trimTrailingUrlPunctuation(rawUrl: string) {
  let url = rawUrl;
  let suffix = "";

  while (/[.,!?;:]$/.test(url)) {
    suffix = url.slice(-1) + suffix;
    url = url.slice(0, -1);
  }

  while (
    url.endsWith(")") &&
    ((url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0))
  ) {
    suffix = ")" + suffix;
    url = url.slice(0, -1);
  }

  return { url, suffix };
}

function splitContentWithLinks(text: string): ContentChunk[] {
  if (!text) return [];

  const chunks: ContentChunk[] = [];
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index;
    const rawUrl = match[0];

    if (start > lastIndex) {
      chunks.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const { url, suffix } = trimTrailingUrlPunctuation(rawUrl);
    if (url) {
      chunks.push({ type: "link", value: url });
    } else {
      chunks.push({ type: "text", value: rawUrl });
    }
    if (suffix) {
      chunks.push({ type: "text", value: suffix });
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) {
    chunks.push({ type: "text", value: text.slice(lastIndex) });
  }

  return chunks;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function readCategory(a: any): string {
  const raw = a?.category ?? a?.categorie ?? a?.team_category ?? "";
  return typeof raw === "string" ? raw : String(raw ?? "");
}

function getArticleCategories(article: Article): CatValue[] {
  const parsed = parseNewsCategoriesWithFallback(readCategory(article), article.title);
  return parsed.length ? parsed : ["Autres"];
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
  const { admin } = useAdmin();

  const params = useLocalSearchParams<{ articleId?: string | string[]; id?: string | string[] }>();
  const rawId = Array.isArray(params.articleId)
    ? params.articleId[0]
    : params.articleId ?? (Array.isArray(params.id) ? params.id[0] : params.id);
  const articleId = rawId ? String(rawId) : undefined;

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [savingCover, setSavingCover] = useState(false);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentMessage, setCommentMessage] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

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
  const contentChunks = useMemo(() => splitContentWithLinks(cleanContent), [cleanContent]);
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

  const currentCommentAuthor = useMemo(() => {
    const first = String(admin?.first_name ?? "").trim();
    const last = String(admin?.last_name ?? "").trim();
    const fullName = `${first} ${last}`.trim();
    if (fullName) return fullName;

    const emailPrefix = String(admin?.email ?? "").trim().split("@")[0] || "";
    if (emailPrefix) return emailPrefix;

    return "visiteur";
  }, [admin?.first_name, admin?.last_name, admin?.email]);

  const commentSessionToken = useMemo(
    () => (typeof admin?.session_token === "string" ? admin.session_token.trim() : ""),
    [admin?.session_token]
  );

  const handleSaveCover = useCallback(async () => {
    if (!article?.image_url) return;
    try {
      setSavingCover(true);
      await saveRemoteImage(article.image_url, `${article.title || "actu"}-cover`);
    } catch (error: any) {
      const detail = String(error?.message ?? "").trim();
      Alert.alert("Erreur", detail ? `Impossible d'enregistrer cette photo.\n${detail}` : "Impossible d'enregistrer cette photo.");
    } finally {
      setSavingCover(false);
    }
  }, [article?.image_url, article?.title]);

  const loadCommentsFromSupabase = useCallback(async () => {
    if (!article?.id) return;

    const { data, error } = await supabase
      .from("news_comments")
      .select("id,news_id,parent_id,author_name,message,created_at")
      .eq("news_id", article.id)
      .order("created_at", { ascending: true });

    if (error) {
      if ((error as any)?.code === "42P01") {
        throw new Error("Table news_comments manquante. Lance le script SQL de commentaires.");
      }
      throw new Error(String(error.message || "Impossible de charger les commentaires."));
    }

    setComments(Array.isArray(data) ? (data as NewsComment[]) : []);
  }, [article?.id]);

  const loadComments = useCallback(async () => {
    if (!article?.id) return;

    setCommentsLoading(true);
    setCommentsError(null);
    try {
      try {
        const res = await fetch(`${NEWS_API_BASE}/${article.id}/comments`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const detail =
            typeof (data as any)?.error === "string" && (data as any).error.trim()
              ? (data as any).error.trim()
              : `HTTP ${res.status}`;
          throw new Error(detail);
        }
        const fetchedComments = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.comments)
          ? (data as any).comments
          : [];
        setComments(fetchedComments as NewsComment[]);
      } catch (apiError: any) {
        try {
          await loadCommentsFromSupabase();
        } catch (fallbackError: any) {
          const detail =
            String(fallbackError?.message ?? "").trim() ||
            String(apiError?.message ?? "").trim() ||
            "Impossible de charger les commentaires.";
          throw new Error(detail);
        }
      }
    } catch (error: any) {
      setComments([]);
      const detail = String(error?.message ?? "").trim();
      setCommentsError(detail || "Impossible de charger les commentaires.");
    } finally {
      setCommentsLoading(false);
    }
  }, [article?.id, loadCommentsFromSupabase]);

  useEffect(() => {
    if (!article?.id) return;
    loadComments();
  }, [article?.id, loadComments]);

  const handleSubmitComment = useCallback(async () => {
    if (!article?.id) return;

    const message = commentMessage.trim();
    if (!message) {
      Alert.alert("Commentaire vide", "Ajoute un message avant de publier.");
      return;
    }

    setSubmittingComment(true);
    try {
      let inserted: NewsComment | null = null;

      try {
        const res = await fetch(`${NEWS_API_BASE}/${article.id}/comments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(commentSessionToken ? { Authorization: `Bearer ${commentSessionToken}` } : {}),
          },
          body: JSON.stringify({
            author_name: currentCommentAuthor,
            message,
            parent_id: replyToId,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail =
            typeof data?.error === "string" && data.error.trim()
              ? data.error.trim()
              : "Impossible de publier ce commentaire.";
          throw new Error(detail);
        }

        inserted = data?.comment ? (data.comment as NewsComment) : null;
      } catch (apiError: any) {
        const { data, error } = await supabase
          .from("news_comments")
          .insert([
            {
              news_id: article.id,
              parent_id: replyToId,
              author_name: currentCommentAuthor,
              message,
            },
          ])
          .select("id,news_id,parent_id,author_name,message,created_at")
          .single();

        if (error) {
          if ((error as any)?.code === "42P01") {
            throw new Error("Table news_comments manquante. Lance le script SQL de commentaires.");
          }
          const fallbackDetail = String(error.message || "").trim();
          const apiDetail = String(apiError?.message || "").trim();
          throw new Error(fallbackDetail || apiDetail || "Impossible de publier ce commentaire.");
        }

        inserted = data as NewsComment;
      }

      if (inserted) {
        setComments((prev) => [...prev, inserted as NewsComment]);
      } else {
        await loadComments();
      }

      setCommentMessage("");
      setReplyToId(null);
    } catch (error: any) {
      const detail = String(error?.message ?? "").trim();
      Alert.alert(
        "Erreur",
        detail || "Impossible de publier ce commentaire."
      );
    } finally {
      setSubmittingComment(false);
    }
  }, [article?.id, commentMessage, replyToId, currentCommentAuthor, commentSessionToken, loadComments]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

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

  const categories = getArticleCategories(article);
  const metas = categories.map((cat) => catMetaOf(cat));
  const primaryMeta = metas[0];
  const badgeBg = withAlpha(primaryMeta.color, 0.14);
  const badgeBorder = withAlpha(primaryMeta.color, 0.4);

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
              <Text style={[styles.heroCatText, { color: primaryMeta.color }]}>
                {metas.map((meta) => meta.label).join(" + ")}
              </Text>
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
        <TouchableOpacity
          style={styles.coverWrap}
          activeOpacity={1}
          onLongPress={handleSaveCover}
          delayLongPress={280}
          disabled={!article.image_url || savingCover}
        >
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
              {savingCover && (
                <View style={styles.coverSavingOverlay}>
                  <ActivityIndicator size="small" color="#111827" />
                </View>
              )}
            </>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Icon name="image-outline" size={24} color="#4B5563" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.articleCard}>
          <View style={styles.articleMetaRow}>
            {metas.map((meta) => (
              <View
                key={`${article.id}-${meta.value}`}
                style={[
                  styles.metaChip,
                  {
                    backgroundColor: withAlpha(meta.color, 0.14),
                    borderColor: withAlpha(meta.color, 0.4),
                  },
                ]}
              >
                <Text style={[styles.metaChipText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            ))}
            <View style={styles.metaDateChip}>
              <Icon name="time-outline" size={13} color="#CBD5E1" />
              <Text style={styles.metaDateText}>{formatDate(article.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.articleTitle}>{article.title}</Text>
          <Text style={styles.articleContent}>
            {contentChunks.map((chunk, index) =>
              chunk.type === "link" ? (
                <Text
                  key={`link-${index}-${chunk.value}`}
                  style={styles.articleLink}
                  onPress={() => openLink(chunk.value)}
                >
                  {chunk.value}
                </Text>
              ) : (
                <Text key={`text-${index}`}>{chunk.value}</Text>
              )
            )}
          </Text>

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

        <View style={styles.commentsBox}>
          <Text style={styles.commentsTitle}>Commentaires ({comments.length})</Text>

          <View style={styles.commentForm}>
            <Text style={styles.commentAuthorHint}>
              {`Publie en tant que ${currentCommentAuthor}`}
            </Text>

            {replyToId != null && (
              <View style={styles.replyHintRow}>
                <Text style={styles.replyHintTxt}>Reponse au commentaire #{replyToId}</Text>
                <TouchableOpacity onPress={() => setReplyToId(null)} activeOpacity={0.85}>
                  <Text style={styles.replyCancelTxt}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={[styles.commentInput, styles.commentTextarea]}
              value={commentMessage}
              onChangeText={setCommentMessage}
              placeholder="Ecrire un commentaire..."
              placeholderTextColor="#AEB8CC"
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />

            <View style={styles.commentFormActions}>
              <TouchableOpacity
                onPress={handleSubmitComment}
                activeOpacity={0.9}
                disabled={submittingComment}
                style={[styles.commentSubmitBtn, submittingComment && { opacity: 0.65 }]}
              >
                <Text style={styles.commentSubmitTxt}>
                  {submittingComment ? "Publication..." : "Publier"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {commentsLoading && (
            <ActivityIndicator size="small" color="#FF8200" style={{ marginTop: 8 }} />
          )}
          {!!commentsError && <Text style={styles.commentsErrorTxt}>{commentsError}</Text>}

          {!commentsLoading && !commentsError && commentTree.length === 0 && (
            <Text style={styles.commentsEmptyTxt}>Aucun commentaire pour le moment.</Text>
          )}

          <View style={styles.commentsList}>
            {commentTree.map((item) => (
              <CommentItem
                key={item.id}
                item={item}
                depth={0}
                replyToId={replyToId}
                onReply={setReplyToId}
              />
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
  coverHint: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,189,128,0.8)",
    backgroundColor: "rgba(8,12,20,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: "center",
    color: "#FFB366",
    fontWeight: "800",
    fontSize: 12,
  },
  coverSavingOverlay: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#FFBD80",
    backgroundColor: "#FF9E3A",
    alignItems: "center",
    justifyContent: "center",
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
  articleLink: {
    color: "#FFB366",
    textDecorationLine: "underline",
    fontWeight: "800",
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

  commentsBox: {
    marginTop: 14,
    backgroundColor: "#151C29",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    padding: 14,
  },
  commentsTitle: {
    color: "#EAEEF7",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 10,
  },
  commentForm: {
    gap: 8,
  },
  commentAuthorHint: {
    color: "#C9D5EA",
    fontSize: 12.5,
    fontWeight: "700",
  },
  commentInput: {
    backgroundColor: "#0E1625",
    borderWidth: 1,
    borderColor: "#3E4A63",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 14,
  },
  commentTextarea: {
    minHeight: 92,
  },
  replyHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.25)",
    backgroundColor: "rgba(255,130,0,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  replyHintTxt: {
    color: "#FFD8B0",
    fontSize: 12,
    fontWeight: "700",
  },
  replyCancelTxt: {
    color: "#FFB366",
    fontSize: 12,
    fontWeight: "900",
  },
  commentFormActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  commentSubmitBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFAA58",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  commentSubmitTxt: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13,
  },
  commentsErrorTxt: {
    marginTop: 8,
    color: "#FCA5A5",
    fontSize: 12.5,
  },
  commentsEmptyTxt: {
    marginTop: 8,
    color: "#9AA6BD",
    fontSize: 13,
  },
  commentsList: {
    marginTop: 10,
    gap: 8,
  },
  commentCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2B3141",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 6,
  },
  commentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  commentAuthor: {
    color: "#F9FAFB",
    fontWeight: "800",
    fontSize: 13,
    flex: 1,
  },
  commentDate: {
    color: "#9AA6BD",
    fontSize: 11.5,
  },
  commentMessage: {
    color: "#D1D5DB",
    fontSize: 13.5,
    lineHeight: 19,
  },
  commentReplyBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.45)",
    backgroundColor: "rgba(255,130,0,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  commentReplyBtnTxt: {
    color: "#FFB366",
    fontWeight: "800",
    fontSize: 11.5,
  },
});
