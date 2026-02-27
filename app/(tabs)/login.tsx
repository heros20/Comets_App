"use client";

import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { useAdmin } from "../../contexts/AdminContext";

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAdmin, isMember } = useAdmin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isAdmin || isMember) {
      setLoading(false);
      router.replace("/");
    }
  }, [isAdmin, isMember, router]);

  const canSubmit = useMemo(() => {
    return !loading && email.trim().length > 4 && password.length > 2;
  }, [email, loading, password]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleLogin = useCallback(async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Renseigne ton email et ton mot de passe.");
      setDebug("");
      shake();
      return;
    }

    setLoading(true);
    setError("");
    setDebug("");

    try {
      const result = await Promise.race<
        { ok: boolean; timeout: false } | { ok: false; timeout: true }
      >([
        login(cleanEmail, password).then((ok) => ({ ok, timeout: false as const })),
        new Promise<{ ok: false; timeout: true }>((resolve) =>
          setTimeout(() => resolve({ ok: false, timeout: true }), 12000),
        ),
      ]);

      if (!result.ok) {
        setError(
          result.timeout
            ? "Connexion trop longue. Verifie le reseau puis reessaie."
            : "Identifiants invalides. Reessaie.",
        );
        shake();
        return;
      }
      router.replace("/");
    } catch (e: any) {
      setError("Erreur reseau. Reessaie plus tard.");
      setDebug(`Detail: ${e?.message || "inconnu"}`);
      shake();
    } finally {
      setLoading(false);
    }
  }, [email, login, password, router, shake]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            {
              paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10,
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroShine}
          />

          <View style={styles.heroTopRow}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              style={styles.backBtn}
              activeOpacity={0.9}
            >
              <Icon name="chevron-back" size={22} color="#F3F4F6" />
            </TouchableOpacity>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Connexion Comets</Text>
              <Text style={styles.heroSub}>Acces membre securise</Text>
            </View>

            <View style={styles.heroPill}>
              <Icon name="shield-checkmark-outline" size={14} color="#FFDDBA" />
              <Text style={styles.heroPillText}>Secure</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Icon name="person-outline" size={14} color="#FFB366" />
              <Text style={styles.metaText}>Espace membre</Text>
            </View>
            <View style={styles.metaPill}>
              <Icon name="flash-outline" size={14} color="#FFB366" />
              <Text style={styles.metaText}>Connexion rapide</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 18}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Se connecter</Text>
            <Text style={styles.cardSub}>
              Utilise tes identifiants pour acceder a ton espace et aux outils du club.
            </Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Adresse email</Text>
              <View style={styles.inputShell}>
                <Icon name="mail-outline" size={18} color="#9FB0C8" />
                <TextInput
                  placeholder="email@requis.fr"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Mot de passe</Text>
              <View style={styles.inputShell}>
                <Icon name="lock-closed-outline" size={18} color="#9FB0C8" />
                <TextInput
                  ref={passwordRef}
                  placeholder="********"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="done"
                  editable={!loading}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPwd((v) => !v)}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <Icon name={showPwd ? "eye-off-outline" : "eye-outline"} size={19} color="#FF9E3A" />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && (
              <View style={styles.errorCard}>
                <Icon name="alert-circle-outline" size={16} color="#FCA5A5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!!debug && __DEV__ && <Text style={styles.debugText}>{debug}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              disabled={!canSubmit}
              onPress={handleLogin}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="log-in-outline" size={18} color="#111827" />
                  <Text style={styles.primaryBtnTxt}>Se connecter</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/Register")}
            activeOpacity={0.85}
            style={styles.helpBox}
          >
            <Icon name="person-add-outline" size={16} color="#FF9E3A" />
            <Text style={styles.helpText}>Pas de compte ? Creer un compte membre</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: "#0B0F17",
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
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroPillText: {
    color: "#FFDDBA",
    fontWeight: "700",
    fontSize: 11,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  metaPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  metaText: {
    color: "#E5E7EB",
    fontSize: 11.5,
    fontWeight: "700",
  },

  content: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 28,
  },
  card: {
    width: "100%",
    maxWidth: 470,
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
    backgroundColor: "#111827",
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    color: "#F3F4F6",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  cardSub: {
    marginTop: 5,
    marginBottom: 12,
    color: "#AAB2C2",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  fieldWrap: {
    marginBottom: 11,
  },
  inputLabel: {
    color: "#C7CEDA",
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 12.5,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    backgroundColor: "#0F1726",
    paddingHorizontal: 10,
    minHeight: 47,
  },
  input: {
    flex: 1,
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 10,
  },
  eyeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,158,58,0.12)",
  },

  errorCard: {
    marginTop: 2,
    marginBottom: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.45)",
    backgroundColor: "rgba(248,113,113,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  errorText: {
    flex: 1,
    color: "#FCA5A5",
    fontSize: 12.5,
    fontWeight: "700",
  },
  debugText: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.12)",
    color: "#FDE68A",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  primaryBtn: {
    alignSelf: "center",
    minHeight: 44,
    minWidth: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFBD80",
    backgroundColor: "#FF9E3A",
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnTxt: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },

  helpBox: {
    marginTop: 12,
    alignSelf: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  helpText: {
    color: "#FFB366",
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
});
