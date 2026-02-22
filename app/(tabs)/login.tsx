// app/screens/LoginScreen.tsx
"use client";

// 🔕 Notifications push désactivées temporairement
// import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
// import { getApps, initializeApp } from 'firebase/app';
// import { firebaseConfig } from '../../utils/firebaseConfig';

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAdmin } from '../../contexts/AdminContext';

const logoComets = require("../../assets/images/iconComets.png");

// 🔕 Notifications — util désactivé temporairement
// async function registerForPushNotificationsAsync(...) { /* ... */ }

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const router = useRouter();
  const { login } = useAdmin();

    const handleLogin = async () => {
    setLoading(true);
    setError('');
    setDebug('');

    try {
      const success = await login(email.trim(), password);

      if (!success) {
        setError("Identifiants invalides. Essaie encore !");
        shake();
      } else {
        router.replace("/");
      }
    } catch (e: any) {
      setError("Erreur r�seau. R�essaie plus tard.");
      setDebug("Erreur r�seau: " + (e?.message || "inconnue"));
      shake();
    }

    setLoading(false);
  };
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO (style Comets) */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.9}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

        {/* ⬇️ titre adapté */}
          <Text style={styles.heroTitle}>Connexion membre</Text>

          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            {/* ⬇️ sous‑titre adapté */}
            <Text style={styles.heroName}>Comets</Text>
            <Text style={styles.heroSub}>Connecte‑toi pour accéder à ton compte.</Text>
          </View>
        </View>
      </View>

      {/* FORM */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
      >
        <ScrollView contentContainerStyle={styles.listContainer} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Se connecter</Text>

            {/* Email */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Adresse email</Text>
              <TextInput
                placeholder="email@requis.fr"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#9aa0ae"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            {/* Mot de passe */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Mot de passe</Text>
              <TextInput
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                placeholderTextColor="#9aa0ae"
                style={styles.input}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd((v) => !v)} activeOpacity={0.7}>
                <Icon name={showPwd ? "eye-off" : "eye"} size={20} color="#FF8200" />
              </TouchableOpacity>
            </View>

            {/* Erreur */}
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {/* Debug (visible) */}
            {!!debug && <Text style={styles.debugText}>{debug}</Text>}

            {/* CTA connexion */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              disabled={loading}
              onPress={handleLogin}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Icon name="log-in-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnTxt}>Se connecter</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Lien vers Inscription */}
          <TouchableOpacity onPress={() => router.push("/(tabs)/Register")} activeOpacity={0.8} style={styles.helpBox}>
            <Text style={styles.helpTxt}>Pas de compte ? C’est par ici !</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // === HERO ===
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
  heroRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
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
  heroTitle: { flex: 1, textAlign: "center", color: "#FF8200", fontSize: 20, fontWeight: "800", letterSpacing: 1.1 },
  heroProfileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  heroLogo: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: "#FF8200",
  },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },

  // === CONTENU ===
  listContainer: { paddingHorizontal: 12, paddingBottom: 34, paddingTop: 14 },
  card: {
    width: "100%", maxWidth: 460, alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: "rgba(255,130,0,0.22)",
  },
  cardTitle: { color: "#eaeef7", fontWeight: "900", fontSize: 18, marginBottom: 10, textAlign: "center" },

  inputWrap: { marginBottom: 12, position: "relative" },
  inputLabel: { color: "#c7cad1", fontWeight: "700", marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#fff", borderColor: "#FFD197", borderWidth: 1.2, borderRadius: 12,
    padding: 13, fontSize: 16, color: "#1c1c1c", fontWeight: "700", paddingRight: 40,
  },
  eyeBtn: { position: "absolute", right: 10, top: 34, padding: 4 },

  errorText: { color: "#E53935", fontWeight: "bold", fontSize: 14, marginTop: 2, marginBottom: 6, textAlign: "center" },
  debugText: { fontSize: 12, color: "#6b4900", backgroundColor: "#fffbe7", padding: 6, borderRadius: 6, marginBottom: 7 },

  primaryBtn: {
    marginTop: 4, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FF8200", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },

  // Lien register
  helpBox: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  helpTxt: { color: "#FF8200", fontSize: 14, fontWeight: "700", textAlign: "center", textDecorationLine: "underline" },
});

