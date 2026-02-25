// app/screens/MessagesScreen.tsx
"use client";

import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { AdminHero } from "../../components/admin/AdminHero";
import { supabase } from "../../supabase";

type Message = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  created_at: string;
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "Date inconnue";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date invalide";
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function MessagesScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const sessionStr = await SecureStore.getItemAsync("session");
      if (!sessionStr) return router.replace("/login");
      try {
        const session = JSON.parse(sessionStr);
        if (session.role !== "admin") return router.replace("/login");
        setCheckingSession(false);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (checkingSession) return;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setMessages((data as Message[]) || []);
      setLoading(false);
    })();
  }, [checkingSession]);

  async function handleLogout() {
    await SecureStore.deleteItemAsync("session");
    router.replace("/login");
  }

  function confirmDelete(id: number) {
    Alert.alert("Supprimer le message", "Tu es sur de vouloir supprimer ce message ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => handleDelete(id),
      },
    ]);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FF8200" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      <AdminHero
        title="Messages recus"
        subtitle="Reponds, gere et supprime les messages entrants"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        rightSlot={
          <TouchableOpacity style={styles.logoutPill} onPress={handleLogout} activeOpacity={0.9}>
            <Icon name="log-out-outline" size={16} color="#fff" />
            <Text style={styles.logoutPillTxt}>Deconnexion</Text>
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.loaderTxt}>Chargement...</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTxt}>Aucun message pour le moment.</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 36 }}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              setShowScrollTop(y > 260);
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.nameTxt} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.dateTxt}>{formatDate(item.created_at)}</Text>
                </View>

                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${item.email}?subject=Reponse a votre message - Les Comets`)}
                    activeOpacity={0.9}
                    style={[styles.chip, { backgroundColor: "rgba(255,130,0,0.12)", borderColor: "rgba(255,130,0,0.35)" }]}
                  >
                    <Icon name="mail-outline" size={14} color="#FF8200" />
                    <Text style={[styles.chipTxt, { color: "#FF8200" }]} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </TouchableOpacity>

                  {item.phone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                      activeOpacity={0.9}
                      style={[styles.chip, { backgroundColor: "rgba(33,150,243,0.12)", borderColor: "rgba(33,150,243,0.35)" }]}
                    >
                      <Icon name="call-outline" size={14} color="#2196F3" />
                      <Text style={[styles.chipTxt, { color: "#2196F3" }]} numberOfLines={1}>
                        {item.phone}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.bodyTxt}>{item.message}</Text>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${item.email}?subject=Reponse a votre message - Les Comets`)}
                    style={[styles.actionBtn, { backgroundColor: "#FF8200" }]}
                    activeOpacity={0.9}
                  >
                    <Icon name="send" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Repondre</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => confirmDelete(item.id)}
                    disabled={deletingId === item.id}
                    style={[styles.actionBtn, { backgroundColor: "#E53935" }, deletingId === item.id && { opacity: 0.7 }]}
                    activeOpacity={0.9}
                  >
                    <Icon name="trash" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>{deletingId === item.id ? "Suppression..." : "Supprimer"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {showScrollTop && (
            <TouchableOpacity
              style={styles.scrollTopBtn}
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              activeOpacity={0.85}
            >
              <Icon name="chevron-up" size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logoutPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#B91C1C",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logoutPillTxt: { color: "#fff", fontWeight: "900", fontSize: 12.5 },

  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", marginTop: 10, fontWeight: "bold", fontSize: 16 },
  emptyBox: {
    padding: 16,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "#151925",
  },
  emptyTxt: { color: "#cfd3db", fontSize: 15, textAlign: "center" },

  card: {
    backgroundColor: "#151925",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  nameTxt: { color: "#eaeef7", fontWeight: "900", fontSize: 17, flexShrink: 1, maxWidth: "60%" },
  dateTxt: { color: "#9aa0ae", fontSize: 12.5, fontWeight: "700" },

  chipsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipTxt: { fontWeight: "800", fontSize: 12.5 },

  bodyTxt: { color: "#e6e7eb", fontSize: 15, lineHeight: 21, marginTop: 10 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  actionTxt: { color: "#fff", fontWeight: "900", fontSize: 13.5, letterSpacing: 0.3 },

  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF8200",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#FF8200",
  },
});
