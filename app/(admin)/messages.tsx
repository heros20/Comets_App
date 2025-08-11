// app/screens/MessagesScreen.tsx
"use client";

import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../supabase';

const logoComets = require("../../assets/images/iconComets.png");

type Message = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  created_at: string;
};

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Date inconnue';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Date invalide';
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function MessagesScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Session check (admin only)
  useEffect(() => {
    (async () => {
      const sessionStr = await SecureStore.getItemAsync('session');
      if (!sessionStr) return router.replace('/login');
      try {
        const session = JSON.parse(sessionStr);
        if (session.role !== 'admin') return router.replace('/login');
        setCheckingSession(false);
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  // Fetch messages
  useEffect(() => {
    if (checkingSession) return;
    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setMessages((data as Message[]) || []);
      setLoading(false);
    })();
  }, [checkingSession]);

  async function handleLogout() {
    await SecureStore.deleteItemAsync('session');
    router.replace('/login');
  }

  function confirmDelete(id: number) {
    Alert.alert(
      'Supprimer le message',
      'Tu es sûr de vouloir supprimer ce message ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => handleDelete(id),
        },
      ]
    );
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014", alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FF8200" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
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
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.9}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Messages reçus</Text>

          {/* espace symétrique */}
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Contact site officiel</Text>
            <Text style={styles.heroSub}>Réponds, gère et supprime les messages entrants</Text>
          </View>

          <TouchableOpacity style={styles.logoutPill} onPress={handleLogout} activeOpacity={0.9}>
            <Icon name="log-out-outline" size={16} color="#fff" />
            <Text style={styles.logoutPillTxt}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LISTE */}
      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={styles.loaderTxt}>Chargement…</Text>
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
                {/* Top row: name + date */}
                <View style={styles.cardTopRow}>
                  <Text style={styles.nameTxt} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.dateTxt}>{formatDate(item.created_at)}</Text>
                </View>

                {/* Contact line */}
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${item.email}?subject=Réponse à votre message – Les Comets`)}
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

                {/* Body */}
                <Text style={styles.bodyTxt}>{item.message}</Text>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:${item.email}?subject=Réponse à votre message – Les Comets`)}
                    style={[styles.actionBtn, { backgroundColor: "#FF8200" }]}
                    activeOpacity={0.9}
                  >
                    <Icon name="send" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Répondre</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => confirmDelete(item.id)}
                    disabled={deletingId === item.id}
                    style={[styles.actionBtn, { backgroundColor: "#E53935" }, deletingId === item.id && { opacity: 0.7 }]}
                    activeOpacity={0.9}
                  >
                    <Icon name="trash" size={16} color="#fff" />
                    <Text style={styles.actionTxt}>{deletingId === item.id ? "Suppression…" : "Supprimer"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* Scroll-to-top */}
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
  // HERO
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
  logoutPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF8200",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logoutPillTxt: { color: "#fff", fontWeight: "900", fontSize: 12.5 },

  // Loader / Empty
  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderTxt: { color: "#FF8200", marginTop: 10, fontWeight: "bold", fontSize: 16 },
  emptyBox: { padding: 16, margin: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,130,0,0.22)", backgroundColor: "rgba(255,255,255,0.06)" },
  emptyTxt: { color: "#cfd3db", fontSize: 15, textAlign: "center" },

  // Cards
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
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

  // Scroll to top
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
