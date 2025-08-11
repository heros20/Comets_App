// app/screens/RegisterScreen.tsx
"use client";

import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Image,
  StyleSheet,
  StatusBar,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

const logoComets = require("../../assets/images/iconComets.png");

export default function RegisterScreen() {
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [birthdateFR, setBirthdateFR] = useState(""); // JJ/MM/AAAA (avec masque)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shakeAnim] = useState(new Animated.Value(0));
  const router = useRouter();

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const validateEmail = (mail: string) => /^\S+@\S+\.\S+$/.test(mail);

  // ===== Helpers date FR <-> ISO =====
  const maskBirthdateFR = (raw: string) => {
    // supprime tout sauf chiffres
    const digits = raw.replace(/[^\d]/g, "").slice(0, 8); // max 8 chiffres
    const parts = [];
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
  };

  const isValidFRDate = (s: string) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
    const [day, month, year] = s.split("/").map(Number);
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  };

  const frToISO = (s: string) => {
    const [day, month, year] = s.split("/").map(Number);
    const yyyy = year.toString().padStart(4, "0");
    const mm = month.toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const computeAgeFromFR = (s: string) => {
    const [day, month, year] = s.split("/").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const m = (today.getMonth() + 1) - month;
    if (m < 0 || (m === 0 && today.getDate() < day)) age--;
    return age;
  };
  // ====================================

  const handleRegister = async () => {
    setError("");

    const first = first_name.trim();
    const last = last_name.trim();
    const mail = email.trim().toLowerCase();
    const birthFR = birthdateFR.trim();

    // Champs requis (trim)
    if (!first || !last || !birthFR || !mail || !password || !confirm) {
      setError("Tous les champs sont obligatoires.");
      shake();
      return;
    }
    if (!validateEmail(mail)) {
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
      setError("Le mot de passe doit faire au moins 8 caractères.");
      shake();
      return;
    }
    if (!isValidFRDate(birthFR)) {
      setError("Merci d’entrer une date valide au format JJ/MM/AAAA (ex. 17/08/1992).");
      shake();
      return;
    }
    // Pas dans le futur
    {
      const [d, m, y] = birthFR.split("/").map(Number);
      const dob = new Date(y, m - 1, d);
      if (dob > new Date()) {
        setError("La date de naissance ne peut pas être dans le futur.");
        shake();
        return;
      }
    }
    // Âge minimum
    const ageComputed = computeAgeFromFR(birthFR);
    if (ageComputed < 4) {
      setError("L’âge minimum est de 4 ans.");
      shake();
      return;
    }

    const birthISO = frToISO(birthFR);

    setLoading(true);
    try {
      const res = await fetch("https://les-comets-honfleur.vercel.app/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first,
          last_name: last,
          date_naissance: birthISO, // 👈 ISO pour l’API
          email: mail,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription.");
        shake();
      } else {
        Alert.alert(
          "Inscription réussie !",
          "Ton compte membre a été créé. Tu peux te connecter dès maintenant.",
          [{ text: "OK", onPress: () => router.replace("/login") }]
        );
      }
    } catch {
      setError("Erreur réseau. Réessaie plus tard.");
      shake();
    }
    setLoading(false);
  };

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
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.9}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Inscription membre</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Rejoins les Comets</Text>
            <Text style={styles.heroSub}>Crée ton compte pour accéder à l’espace membre</Text>
          </View>
        </View>
      </View>

      {/* FORM */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
      >
        <ScrollView contentContainerStyle={styles.listContainer} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>

            {/* Prénom */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Prénom</Text>
              <TextInput
                placeholder="Ex. Kevin"
                value={first_name}
                onChangeText={setFirstName}
                autoCapitalize="words"
                placeholderTextColor="#9aa0ae"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            {/* Nom */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Nom</Text>
              <TextInput
                placeholder="Ex. Dupont"
                value={last_name}
                onChangeText={setLastName}
                autoCapitalize="words"
                placeholderTextColor="#9aa0ae"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            {/* Date de naissance (FR avec masque) */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Date de naissance (JJ/MM/AAAA)</Text>
              <TextInput
                placeholder="Ex. 17/08/1992"
                value={birthdateFR}
                onChangeText={(txt) => setBirthdateFR(maskBirthdateFR(txt))}
                autoCapitalize="none"
                keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "number-pad"}
                maxLength={10} // JJ/MM/AAAA
                placeholderTextColor="#9aa0ae"
                style={styles.input}
                returnKeyType="next"
              />
            </View>

            {/* Email */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Adresse email</Text>
              <TextInput
                placeholder="nom@domaine.fr"
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
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPwd((v) => !v)}
                activeOpacity={0.7}
              >
                <Icon name={showPwd ? "eye-off" : "eye"} size={20} color="#FF8200" />
              </TouchableOpacity>
            </View>

            {/* Confirmation */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Confirmation du mot de passe</Text>
              <TextInput
                placeholder="••••••••"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                placeholderTextColor="#9aa0ae"
                style={styles.input}
                onSubmitEditing={handleRegister}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm((v) => !v)}
                activeOpacity={0.7}
              >
                <Icon name={showConfirm ? "eye-off" : "eye"} size={20} color="#FF8200" />
              </TouchableOpacity>
            </View>

            {/* Erreur */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              disabled={loading}
              onPress={handleRegister}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Icon name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnTxt}>S’inscrire</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Lien retour Login */}
            <TouchableOpacity onPress={() => router.push("/login")} activeOpacity={0.8} style={styles.helpBox}>
              <Text style={styles.helpTxt}>Déjà un compte ? Connecte‑toi !</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  listContainer: { paddingHorizontal: 12, paddingBottom: 34, paddingTop: 14 },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },

  inputWrap: { marginBottom: 12, position: "relative" },
  inputLabel: { color: "#c7cad1", fontWeight: "700", marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#fff",
    borderColor: "#FFD197",
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    color: "#1c1c1c",
    fontWeight: "700",
    paddingRight: 40,
  },
  eyeBtn: { position: "absolute", right: 10, top: 34, padding: 4 },

  errorText: {
    color: "#E53935",
    fontWeight: "bold",
    fontSize: 14,
    marginTop: 2,
    marginBottom: 6,
    textAlign: "center",
  },

  primaryBtn: {
    marginTop: 4,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF8200",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },

  helpBox: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  helpTxt: {
    color: "#FF8200",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
