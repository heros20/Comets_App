"use client";

import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const { requestPasswordReset } = useAdmin();
  const seededRef = useRef(false);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (seededRef.current) return;

    const rawEmail = Array.isArray(params.email) ? params.email[0] : params.email;
    if (typeof rawEmail === "string" && rawEmail.trim()) {
      setEmail(rawEmail.trim().toLowerCase());
    }
    seededRef.current = true;
  }, [params.email]);

  const handleSubmit = useCallback(async () => {
    const cleanEmail = email.trim().toLowerCase();

    setError("");
    setNotice("");

    if (!cleanEmail) {
      setError("Renseigne ton adresse email.");
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(cleanEmail);
      if (!result.ok) {
        setError(result.error || "Impossible d'envoyer l'e-mail de réinitialisation.");
        return;
      }

      setNotice("Un e-mail de réinitialisation vient d'être envoyé.");
    } finally {
      setLoading(false);
    }
  }, [email, requestPasswordReset]);

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
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))}
              style={styles.backBtn}
              activeOpacity={0.9}
            >
              <Icon name="chevron-back" size={22} color="#F3F4F6" />
            </TouchableOpacity>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Mot de passe oublié</Text>
              <Text style={styles.heroSub}>Réinitialisation sécurisée</Text>
            </View>

            <View style={styles.heroPill}>
              <Icon name="mail-unread-outline" size={14} color="#FFDDBA" />
              <Text style={styles.heroPillText}>Email</Text>
            </View>
          </View>

          <Text style={styles.heroInfo}>
            Saisis ton adresse email pour recevoir un lien de réinitialisation.
          </Text>
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recevoir le lien</Text>
            <Text style={styles.cardSub}>
              Le lien envoyé est temporaire. Ouvre ensuite l'e-mail sur ton téléphone ou sur le site.
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
                  returnKeyType="send"
                  editable={!loading}
                  onSubmitEditing={handleSubmit}
                />
              </View>
            </View>

            {!!error && (
              <View style={styles.errorCard}>
                <Icon name="alert-circle-outline" size={16} color="#FCA5A5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!!notice && (
              <View style={styles.noticeCard}>
                <Icon name="mail-open-outline" size={16} color="#86EFAC" />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              disabled={loading}
              onPress={handleSubmit}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="paper-plane-outline" size={18} color="#111827" />
                  <Text style={styles.primaryBtnTxt}>Envoyer le lien</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/login")}
              activeOpacity={0.85}
              style={styles.secondaryBtn}
            >
              <Icon name="log-in-outline" size={16} color="#FFB366" />
              <Text style={styles.secondaryBtnText}>Retour à la connexion</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 12,
  },
  heroShine: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: "56%",
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
  heroInfo: {
    marginTop: 10,
    color: "#E5E7EB",
    fontSize: 12.5,
    lineHeight: 18,
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
    marginBottom: 12,
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
  errorCard: {
    marginBottom: 8,
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
  noticeCard: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(134,239,172,0.35)",
    backgroundColor: "rgba(34,197,94,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  noticeText: {
    flex: 1,
    color: "#BBF7D0",
    fontSize: 12.5,
    fontWeight: "700",
  },
  primaryBtn: {
    alignSelf: "center",
    minHeight: 44,
    minWidth: 190,
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
  secondaryBtn: {
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
  secondaryBtnText: {
    color: "#FFB366",
    fontSize: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
});
