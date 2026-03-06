"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { AdminHero } from "../../components/admin/AdminHero";
import { useAdmin } from "../../contexts/AdminContext";
import { parseNewsCategoriesWithFallback } from "../../lib/newsCategories";
import { supabase } from "../../supabase";

type ModerationCategory = "12U" | "15U" | "Seniors" | "Autres";

type ModerationComment = {
  id: number;
  news_id: number;
  parent_id: number | null;
  author_name: string;
  message: string;
  created_at: string;
};

type ModerationArticle = {
  id: number;
  title: string;
  category: string | null;
  categories: ModerationCategory[];
  primary_category: ModerationCategory;
  created_at: string | null;
  comment_count: number;
  comments: ModerationComment[];
};

type ModerationGroup = {
  category: ModerationCategory;
  total_articles: number;
  total_comments: number;
  articles: ModerationArticle[];
};

type ModerationPayload = {
  total_categories: number;
  total_articles: number;
  total_comments: number;
  groups: ModerationGroup[];
};

type NewsRow = {
  id: number;
  title: string;
  category: string | null;
  created_at: string | null;
};

const PRIMARY_API =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "https://les-comets-honfleur.vercel.app";
const FALLBACK_API = "https://les-comets-honfleur.vercel.app";
const API_PATH = "/api/admin/news-comments";
const CATEGORY_ORDER: ModerationCategory[] = ["12U", "15U", "Seniors", "Autres"];

const CATEGORY_COLORS: Record<ModerationCategory, string> = {
  "12U": "#10B981",
  "15U": "#3B82F6",
  Seniors: "#F59E0B",
  Autres: "#FF8200",
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Date inconnue";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Date invalide";
  return date.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function sanitizePayload(raw: any): ModerationPayload {
  const inputGroups = Array.isArray(raw?.groups) ? raw.groups : [];
  const groups: ModerationGroup[] = inputGroups
    .map((group: any) => {
      const category = CATEGORY_ORDER.includes(group?.category) ? group.category : "Autres";
      const inputArticles = Array.isArray(group?.articles) ? group.articles : [];
      const articles: ModerationArticle[] = inputArticles.map((article: any) => {
        const inputComments = Array.isArray(article?.comments) ? article.comments : [];
        const comments: ModerationComment[] = inputComments.map((comment: any) => ({
          id: Number(comment?.id ?? 0),
          news_id: Number(comment?.news_id ?? 0),
          parent_id: comment?.parent_id == null ? null : Number(comment.parent_id),
          author_name: String(comment?.author_name ?? "").trim() || "visiteur",
          message: String(comment?.message ?? ""),
          created_at: String(comment?.created_at ?? ""),
        }));

        const categories = Array.isArray(article?.categories)
          ? article.categories.filter((cat: any) => CATEGORY_ORDER.includes(cat))
          : [];

        return {
          id: Number(article?.id ?? 0),
          title: String(article?.title ?? "").trim() || `Article #${String(article?.id ?? "?")}`,
          category: typeof article?.category === "string" ? article.category : null,
          categories: categories.length > 0 ? categories : ["Autres"],
          primary_category: CATEGORY_ORDER.includes(article?.primary_category) ? article.primary_category : "Autres",
          created_at: typeof article?.created_at === "string" ? article.created_at : null,
          comment_count: Number(article?.comment_count ?? comments.length),
          comments,
        };
      });

      return {
        category,
        total_articles: Number(group?.total_articles ?? articles.length),
        total_comments: Number(group?.total_comments ?? articles.reduce((sum, article) => sum + article.comment_count, 0)),
        articles,
      };
    })
    .filter((group: ModerationGroup) => group.articles.length > 0);

  return {
    total_categories: Number(raw?.total_categories ?? groups.length),
    total_articles: Number(raw?.total_articles ?? groups.reduce((sum, group) => sum + group.total_articles, 0)),
    total_comments: Number(raw?.total_comments ?? groups.reduce((sum, group) => sum + group.total_comments, 0)),
    groups,
  };
}

function normalizeApiBase(base: string) {
  let out = String(base ?? "").trim().replace(/\/+$/, "");
  if (!out) return "";
  out = out.replace(/\/api$/i, "");
  return out;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function buildHostCandidates() {
  const list = [PRIMARY_API, FALLBACK_API]
    .map((host) => normalizeApiBase(host))
    .filter(Boolean);
  return Array.from(new Set(list));
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 5500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(init ?? {}), signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sortByDateDesc(a?: string | null, b?: string | null) {
  const left = a ? new Date(a).getTime() : 0;
  const right = b ? new Date(b).getTime() : 0;
  return right - left;
}

function categoryRank(category: ModerationCategory) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index >= 0 ? index : CATEGORY_ORDER.length;
}

function buildModerationPayload(newsRows: NewsRow[], commentsRows: ModerationComment[]): ModerationPayload {
  const commentsByNews = new Map<number, ModerationComment[]>();
  commentsRows.forEach((comment) => {
    if (!comment.id || !comment.news_id) return;
    const list = commentsByNews.get(comment.news_id) ?? [];
    list.push(comment);
    commentsByNews.set(comment.news_id, list);
  });

  const articles: ModerationArticle[] = [];
  newsRows.forEach((news) => {
    const comments = commentsByNews.get(Number(news.id)) ?? [];
    if (!comments.length) return;

    const parsed = parseNewsCategoriesWithFallback(news.category, news.title);
    const categories: ModerationCategory[] = parsed.length
      ? (parsed as ModerationCategory[])
      : ["Autres"];
    const primary = categories[0] ?? "Autres";

    const sortedComments = [...comments].sort((a, b) => sortByDateDesc(a.created_at, b.created_at));

    articles.push({
      id: Number(news.id),
      title: String(news.title ?? "").trim() || `Article #${String(news.id)}`,
      category: news.category,
      categories,
      primary_category: primary,
      created_at: news.created_at,
      comment_count: sortedComments.length,
      comments: sortedComments,
    });
  });

  articles.sort((a, b) => {
    const byCategory = categoryRank(a.primary_category) - categoryRank(b.primary_category);
    if (byCategory !== 0) return byCategory;

    const byDate = sortByDateDesc(a.created_at, b.created_at);
    if (byDate !== 0) return byDate;

    return b.id - a.id;
  });

  const groupsMap = new Map<ModerationCategory, ModerationArticle[]>();
  articles.forEach((article) => {
    const list = groupsMap.get(article.primary_category) ?? [];
    list.push(article);
    groupsMap.set(article.primary_category, list);
  });

  const groups: ModerationGroup[] = CATEGORY_ORDER
    .filter((category) => (groupsMap.get(category)?.length ?? 0) > 0)
    .map((category) => {
      const groupArticles = groupsMap.get(category) ?? [];
      return {
        category,
        total_articles: groupArticles.length,
        total_comments: groupArticles.reduce((sum, article) => sum + article.comment_count, 0),
        articles: groupArticles,
      };
    });

  return {
    total_categories: groups.length,
    total_articles: articles.length,
    total_comments: commentsRows.length,
    groups,
  };
}

async function fetchModerationFromSupabase() {
  const [newsRes, commentsRes] = await Promise.all([
    supabase
      .from("news")
      .select("id,title,category,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("news_comments")
      .select("id,news_id,parent_id,author_name,message,created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (newsRes.error) {
    throw new Error(String(newsRes.error.message || "Impossible de charger les articles."));
  }

  if (commentsRes.error) {
    if ((commentsRes.error as any)?.code === "42P01") {
      throw new Error("Table news_comments manquante. Lance le script SQL des commentaires.");
    }
    throw new Error(String(commentsRes.error.message || "Impossible de charger les commentaires."));
  }

  const newsRows: NewsRow[] = Array.isArray(newsRes.data)
    ? (newsRes.data as any[]).map((row) => ({
        id: Number(row?.id ?? 0),
        title: String(row?.title ?? ""),
        category: typeof row?.category === "string" ? row.category : null,
        created_at: typeof row?.created_at === "string" ? row.created_at : null,
      }))
    : [];

  const commentsRows: ModerationComment[] = Array.isArray(commentsRes.data)
    ? (commentsRes.data as any[]).map((row) => ({
        id: Number(row?.id ?? 0),
        news_id: Number(row?.news_id ?? 0),
        parent_id: row?.parent_id == null ? null : Number(row.parent_id),
        author_name: String(row?.author_name ?? "").trim() || "visiteur",
        message: String(row?.message ?? ""),
        created_at: String(row?.created_at ?? ""),
      }))
    : [];

  return buildModerationPayload(newsRows, commentsRows);
}

export default function CommentsModerationScreen() {
  const navigation = useNavigation();
  const { isAdmin, admin } = useAdmin();

  const [data, setData] = useState<ModerationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ModerationCategory | null>(null);

  const sessionToken = useMemo(() => {
    return typeof admin?.session_token === "string" ? admin.session_token.trim() : "";
  }, [admin?.session_token]);

  const fetchModeration = useCallback(async () => {
    const hosts = buildHostCandidates();
    let lastError = "Impossible de charger la moderation.";
    let saw404 = false;

    if (sessionToken) {
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
      };

      for (const host of hosts) {
        const url = joinUrl(host, API_PATH);
        try {
          const res = await fetchWithTimeout(url, { method: "GET", headers }, 6000);
          const body = await res.json().catch(() => ({}));

          if (res.status === 404) {
            saw404 = true;
            continue;
          }

          if (!res.ok) {
            const detail =
              typeof body?.error === "string" && body.error.trim() ? body.error.trim() : `HTTP ${res.status}`;
            throw new Error(detail);
          }
          return sanitizePayload(body);
        } catch (error: any) {
          lastError = String(error?.message ?? lastError);
        }
      }
    }

    try {
      return await fetchModerationFromSupabase();
    } catch (fallbackError: any) {
      const fallbackDetail = String(fallbackError?.message ?? "").trim();
      if (saw404) {
        throw new Error(fallbackDetail || "Route API de moderation introuvable (HTTP 404).");
      }
      throw new Error(fallbackDetail || lastError);
    }
  }, [sessionToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = await fetchModeration();
      setData(payload);
    } catch (error: any) {
      setData(null);
      setErrorMsg(String(error?.message ?? "Impossible de charger la moderation."));
    } finally {
      setLoading(false);
    }
  }, [fetchModeration]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setErrorMsg(null);
    try {
      const payload = await fetchModeration();
      setData(payload);
    } catch (error: any) {
      setErrorMsg(String(error?.message ?? "Impossible de charger la moderation."));
    } finally {
      setRefreshing(false);
    }
  }, [fetchModeration]);

  const handleDelete = useCallback(
    (commentId: number) => {
      Alert.alert(
        "Supprimer ce commentaire ?",
        "Les reponses liees seront aussi supprimees.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: async () => {
              setDeletingId(commentId);
              setErrorMsg(null);
              try {
                let deleted = false;
                let lastError = "Impossible de supprimer ce commentaire.";
                let saw404 = false;

                if (sessionToken) {
                  const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionToken}`,
                  };
                  const hosts = buildHostCandidates();

                  for (const host of hosts) {
                    const url = joinUrl(host, API_PATH);
                    try {
                      const res = await fetchWithTimeout(
                        url,
                        {
                          method: "DELETE",
                          headers,
                          body: JSON.stringify({ id: commentId }),
                        },
                        6000,
                      );
                      const body = await res.json().catch(() => ({}));

                      if (res.status === 404) {
                        saw404 = true;
                        continue;
                      }

                      if (!res.ok) {
                        const detail =
                          typeof body?.error === "string" && body.error.trim()
                            ? body.error.trim()
                            : `HTTP ${res.status}`;
                        throw new Error(detail);
                      }
                      deleted = true;
                      break;
                    } catch (error: any) {
                      lastError = String(error?.message ?? lastError);
                    }
                  }
                }

                if (!deleted) {
                  const { error } = await supabase.from("news_comments").delete().eq("id", commentId);
                  if (error) {
                    if ((error as any)?.code === "42P01") {
                      throw new Error("Table news_comments manquante. Lance le script SQL des commentaires.");
                    }
                    const detail = String(error.message || "").trim();
                    throw new Error(detail || (saw404 ? "Route API de moderation introuvable (HTTP 404)." : lastError));
                  }
                }

                const refreshed = await fetchModeration();
                setData(refreshed);
              } catch (error: any) {
                setErrorMsg(String(error?.message ?? "Impossible de supprimer ce commentaire."));
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [fetchModeration, sessionToken],
  );

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const activeGroup = useMemo(() => {
    if (!groups.length) return null;
    return groups.find((group) => group.category === activeCategory) ?? groups[0];
  }, [activeCategory, groups]);

  useEffect(() => {
    if (!groups.length) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || !groups.some((group) => group.category === activeCategory)) {
      setActiveCategory(groups[0].category);
    }
  }, [activeCategory, groups]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Acces reserve aux admins.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const summary = {
    categories: Number(data?.total_categories ?? 0),
    articles: Number(data?.total_articles ?? 0),
    comments: Number(data?.total_comments ?? 0),
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8200" />}
      >
        <AdminHero
          title="Moderation commentaires"
          subtitle="Tri categorie puis article"
          onBack={() => (navigation as any)?.canGoBack?.() ? (navigation as any).goBack() : null}
        />

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Categories</Text>
            <Text style={styles.statValue}>{summary.categories}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Articles</Text>
            <Text style={styles.statValue}>{summary.articles}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Commentaires</Text>
            <Text style={styles.statValue}>{summary.comments}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="large" color="#FF8200" />
            <Text style={styles.stateHint}>Chargement des commentaires...</Text>
          </View>
        ) : (
          <>
            {!!errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTxt}>{errorMsg}</Text>
              </View>
            )}

            {!errorMsg && (!groups.length || summary.comments === 0) && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTxt}>Aucun commentaire a moderer.</Text>
              </View>
            )}

            {!errorMsg && groups.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsRow}
              >
                {groups.map((group) => {
                  const isActive = group.category === activeGroup?.category;
                  return (
                    <TouchableOpacity
                      key={`tab-${group.category}`}
                      onPress={() => setActiveCategory(group.category)}
                      activeOpacity={0.9}
                      style={[
                        styles.tabBtn,
                        { borderColor: `${CATEGORY_COLORS[group.category]}88` },
                        isActive && {
                          borderColor: CATEGORY_COLORS[group.category],
                          backgroundColor: CATEGORY_COLORS[group.category],
                        },
                      ]}
                    >
                      <Text style={[styles.tabBtnTxt, isActive && { color: "#FFFFFF" }]}>
                        {group.category} ({group.total_comments})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ gap: 14 }}>
              {activeGroup && (
                <View key={activeGroup.category} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <View
                      style={[
                        styles.groupBadge,
                        {
                          borderColor: `${CATEGORY_COLORS[activeGroup.category]}88`,
                          backgroundColor: `${CATEGORY_COLORS[activeGroup.category]}22`,
                        },
                      ]}
                    >
                      <Text style={[styles.groupBadgeTxt, { color: CATEGORY_COLORS[activeGroup.category] }]}>
                        {activeGroup.category}
                      </Text>
                    </View>
                    <Text style={styles.groupMeta}>
                      {activeGroup.total_articles} article(s) - {activeGroup.total_comments} commentaire(s)
                    </Text>
                  </View>

                  {activeGroup.articles.map((article) => (
                    <View key={article.id} style={styles.articleCard}>
                      <View style={styles.articleHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.articleTitle}>{article.title}</Text>
                          <Text style={styles.articleMeta}>
                            ID #{article.id} - {formatDate(article.created_at)} - {article.comment_count} commentaire(s)
                          </Text>
                        </View>
                      </View>

                      <View style={styles.articleCategoryRow}>
                        {article.categories.map((category) => (
                          <View
                            key={`${article.id}-${category}`}
                            style={[
                              styles.categoryPill,
                              {
                                borderColor: `${CATEGORY_COLORS[category]}88`,
                                backgroundColor: `${CATEGORY_COLORS[category]}20`,
                              },
                            ]}
                          >
                            <Text style={[styles.categoryPillTxt, { color: CATEGORY_COLORS[category] }]}>{category}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={{ gap: 8 }}>
                        {article.comments.map((comment) => (
                          <View key={comment.id} style={styles.commentCard}>
                            <View style={styles.commentHeader}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.commentAuthor}>{comment.author_name || "visiteur"}</Text>
                                <Text style={styles.commentMeta}>
                                  #{comment.id} - {formatDate(comment.created_at)}
                                  {comment.parent_id != null ? ` - reponse a #${comment.parent_id}` : ""}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => handleDelete(comment.id)}
                                disabled={deletingId === comment.id}
                                activeOpacity={0.9}
                                style={[styles.deleteBtn, deletingId === comment.id && { opacity: 0.65 }]}
                              >
                                <Icon name="trash-outline" size={14} color="#FEE2E2" />
                                <Text style={styles.deleteBtnTxt}>{deletingId === comment.id ? "Supp..." : "Supprimer"}</Text>
                              </TouchableOpacity>
                            </View>
                            <Text style={styles.commentBody}>{comment.message}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F1014",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  statsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.35)",
    borderRadius: 12,
    backgroundColor: "#151925",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  statValue: {
    marginTop: 2,
    color: "#F3F4F6",
    fontSize: 20,
    fontWeight: "900",
  },
  stateWrap: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  stateTitle: {
    color: "#FF8200",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  stateHint: {
    color: "#D1D5DB",
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  errorBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
    borderRadius: 12,
    backgroundColor: "rgba(127,29,29,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorTxt: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.3)",
    borderRadius: 12,
    backgroundColor: "#151925",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyTxt: {
    color: "#D1D5DB",
    fontSize: 14,
    textAlign: "center",
  },
  tabsRow: {
    marginTop: 12,
    gap: 8,
    paddingRight: 8,
  },
  tabBtn: {
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: "#10151F",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabBtnTxt: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
  },
  groupCard: {
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.3)",
    borderRadius: 14,
    backgroundColor: "#141923",
    padding: 12,
    gap: 10,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  groupBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  groupBadgeTxt: {
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  groupMeta: {
    color: "#A9B2C4",
    fontSize: 12,
    fontWeight: "700",
  },
  articleCard: {
    borderWidth: 1,
    borderColor: "#273144",
    borderRadius: 12,
    backgroundColor: "#10151F",
    padding: 10,
    gap: 8,
  },
  articleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  articleTitle: {
    color: "#F3F4F6",
    fontSize: 14.5,
    fontWeight: "900",
  },
  articleMeta: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 11.5,
    fontWeight: "600",
  },
  articleCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillTxt: {
    fontSize: 11,
    fontWeight: "800",
  },
  commentCard: {
    borderWidth: 1,
    borderColor: "#2E3A50",
    borderRadius: 10,
    backgroundColor: "#1A2232",
    padding: 9,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  commentAuthor: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 13,
  },
  commentMeta: {
    marginTop: 1,
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  commentBody: {
    marginTop: 6,
    color: "#E5E7EB",
    fontSize: 13.5,
    lineHeight: 19,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.45)",
    backgroundColor: "rgba(239,68,68,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  deleteBtnTxt: {
    color: "#FEE2E2",
    fontSize: 11.5,
    fontWeight: "900",
  },
});
