"use client";

import { Asset } from "expo-asset";
import { useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const logoComets = require("../../assets/images/iconComets.png");
const REGISTER_API = "https://les-comets-honfleur.vercel.app/api/register";

function maskBirthdateFR(raw: string) {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 8);
  const parts: string[] = [];

  if (digits.length >= 2) {
    parts.push(digits.slice(0, 2));
    if (digits.length >= 4) {
      parts.push(digits.slice(2, 4));
      if (digits.length > 4) parts.push(digits.slice(4));
    } else {
      parts.push(digits.slice(2));
    }
  } else if (digits.length > 0) {
    parts.push(digits);
  }

  return parts.join("/");
}

function isValidFRDate(s: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const [day, month, year] = s.split("/").map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function frToISO(s: string) {
  const [day, month, year] = s.split("/").map(Number);
  const yyyy = year.toString().padStart(4, "0");
  const mm = month.toString().padStart(2, "0");
  const dd = day.toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeAgeFromFR(s: string) {
  const [day, month, year] = s.split("/").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age--;
  return age;
}

function isValidEmail(mail: string) {
  return /^\S+@\S+\.\S+$/.test(mail);
}

export default function RegisterScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdateFR, setBirthdateFR] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lastNameRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    Asset.loadAsync([logoComets]).catch(() => {});
  }, []);

  const canSubmit = useMemo(() => {
    return (
      !loading &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      birthdateFR.trim().length === 10 &&
      email.trim().length > 4 &&
      password.length > 0 &&
      confirm.length > 0
    );
  }, [loading, firstName, lastName, birthdateFR, email, password, confirm]);

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleRegister = useCallback(async () => {
    setError("");

    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim().toLowerCase();
    const birthFR = birthdateFR.trim();

    if (!first || !last || !birthFR || !mail || !password || !confirm) {
      setError("Tous les champs sont obligatoires.");
      shake();
      return;
    }

    if (!isValidEmail(mail)) {
      setError("Adresse email invalide.");
      shake();
      return;
    }

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      shake();
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caracteres.");
      shake();
      return;
    }

    if (!isValidFRDate(birthFR)) {
      setError("Date invalide. Utilise le format JJ/MM/AAAA.");
      shake();
      return;
    }

    {
      const [d, m, y] = birthFR.split("/").map(Number);
      const dob = new Date(y, m - 1, d);
      if (dob > new Date()) {
        setError("La date de naissance ne peut pas etre dans le futur.");
        shake();
        return;
      }
    }

    const ageComputed = computeAgeFromFR(birthFR);
    if (ageComputed < 4) {
      setError("L age minimum est de 4 ans.");
      shake();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(REGISTER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          date_naissance: frToISO(birthFR),
          email: mail,
          password,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Erreur lors de l inscription.");
        shake();
        return;
      }

      Alert.alert(
        "Inscription reussie",
        "Ton compte membre a ete cree. Tu peux maintenant te connecter.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)/login") }]
      );
    } catch {
      setError("Erreur reseau. Reessaie plus tard.");
      shake();
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, email, birthdateFR, password, confirm, router, shake]);

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
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
              style={styles.backBtn}
              activeOpacity={0.9}
            >
              <Icon name="chevron-back" size={22} color="#F3F4F6" />
            </TouchableOpacity>

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Inscription Comets</Text>
              <Text style={styles.heroSub}>Creation de compte membre</Text>
            </View>

            <View style={styles.heroPill}>
              <Icon name="person-add-outline" size={14} color="#FFDDBA" />
              <Text style={styles.heroPillText}>Nouveau</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Icon name="document-text-outline" size={13} color="#FFDDBA" />
              <Text style={styles.heroMetaPillText}>Formulaire officiel</Text>
            </View>

            <View style={styles.heroMetaPill}>
              <Icon name="flash-outline" size={13} color="#FFDDBA" />
              <Text style={styles.heroMetaPillText}>Temps moyen 2 min</Text>
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
            <View style={styles.cardBrandRow}>
              <ExpoImage
                source={logoComets}
                cachePolicy="memory-disk"
                transition={120}
                contentFit="contain"
                style={styles.cardLogo}
              />
              <Text style={styles.cardBrandText}>Comets Honfleur</Text>
            </View>

            <Text style={styles.cardTitle}>Creer un compte</Text>
            <Text style={styles.cardSub}>Renseigne tes informations pour finaliser ton inscription.</Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Prenom</Text>
              <View style={styles.inputShell}>
                <Icon name="person-outline" size={18} color="#9FB0C8" />
                <TextInput
                  placeholder="Ex. Kevin"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Nom</Text>
              <View style={styles.inputShell}>
                <Icon name="id-card-outline" size={18} color="#9FB0C8" />
                <TextInput
                  ref={lastNameRef}
                  placeholder="Ex. Dupont"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => birthRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Date de naissance (JJ/MM/AAAA)</Text>
              <View style={styles.inputShell}>
                <Icon name="calendar-outline" size={18} color="#9FB0C8" />
                <TextInput
                  ref={birthRef}
                  placeholder="Ex. 17/08/1992"
                  value={birthdateFR}
                  onChangeText={(txt) => setBirthdateFR(maskBirthdateFR(txt))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "number-pad"}
                  maxLength={10}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Adresse email</Text>
              <View style={styles.inputShell}>
                <Icon name="mail-outline" size={18} color="#9FB0C8" />
                <TextInput
                  ref={emailRef}
                  placeholder="nom@domaine.fr"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => pwdRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Mot de passe</Text>
              <View style={styles.inputShell}>
                <Icon name="lock-closed-outline" size={18} color="#9FB0C8" />
                <TextInput
                  ref={pwdRef}
                  placeholder="********"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => confirmRef.current?.focus()}
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

            <View style={styles.fieldWrap}>
              <Text style={styles.inputLabel}>Confirmation du mot de passe</Text>
              <View style={styles.inputShell}>
                <Icon name="shield-checkmark-outline" size={18} color="#9FB0C8" />
                <TextInput
                  ref={confirmRef}
                  placeholder="********"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#8EA0BB"
                  style={styles.input}
                  returnKeyType="done"
                  editable={!loading}
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm((v) => !v)}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <Icon
                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                    size={19}
                    color="#FF9E3A"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && (
              <View style={styles.errorCard}>
                <Icon name="alert-circle-outline" size={16} color="#FCA5A5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              disabled={!canSubmit}
              onPress={handleRegister}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="person-add-outline" size={18} color="#111827" />
                  <Text style={styles.primaryBtnText}>S inscrire</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/login")}
            activeOpacity={0.85}
            style={styles.helpBox}
          >
            <Icon name="log-in-outline" size={16} color="#FF9E3A" />
            <Text style={styles.helpText}>Deja un compte ? Connecte toi</Text>
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
  heroMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroMetaPill: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroMetaPillText: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 11,
  },

  content: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 28,
  },
  card: {
    width: "100%",
    maxWidth: 520,
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
  cardBrandRow: {
    alignSelf: "center",
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.24)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  cardBrandText: {
    color: "#FFDDBA",
    fontSize: 11.5,
    fontWeight: "700",
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
  primaryBtnText: {
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
