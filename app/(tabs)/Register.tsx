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
const logoComets = require("../../assets/images/iconComets.png"); // Mets le bon chemin

export default function RegisterScreen() {
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [age, setAge] = useState("");
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

  function validateEmail(mail: string) {
    return /^\S+@\S+\.\S+$/.test(mail);
  }

  const handleRegister = async () => {
    setError("");
    if (!first_name || !last_name || !age || !email || !password || !confirm) {
      setError("Tous les champs sont obligatoires.");
      shake();
      return;
    }
    if (!validateEmail(email)) {
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
    if (isNaN(Number(age)) || Number(age) < 4) {
      setError("Merci d’entrer un âge valide.");
      shake();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://les-comets-honfleur.vercel.app/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          age: Number(age),
          email: email.trim().toLowerCase(),
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
          "Ton compte a été créé. Tu peux te connecter dès maintenant.",
          [{ text: "OK", onPress: () => router.replace("/login") }]
        );
      }
    } catch (e) {
      setError("Erreur réseau. Réessaie plus tard.");
      shake();
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#191A23" }}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 7 }}>
          <Icon name="chevron-back" size={29} color="#FF8200" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Image source={logoComets} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Inscription</Text>
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Prénom */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Prénom"
                value={first_name}
                onChangeText={setFirstName}
                autoCapitalize="words"
                placeholderTextColor="#FFB870"
                style={styles.input}
                returnKeyType="next"
              />
            </View>
            {/* Nom */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Nom"
                value={last_name}
                onChangeText={setLastName}
                autoCapitalize="words"
                placeholderTextColor="#FFB870"
                style={styles.input}
                returnKeyType="next"
              />
            </View>
            {/* Âge */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Âge"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={3}
                placeholderTextColor="#FFB870"
                style={styles.input}
                returnKeyType="next"
              />
            </View>
            {/* Email */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Adresse email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#FFB870"
                style={styles.input}
                returnKeyType="next"
              />
            </View>
            {/* Mot de passe */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                placeholderTextColor="#FFB870"
                style={styles.input}
                returnKeyType="next"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPwd(v => !v)}
                activeOpacity={0.7}
              >
                <Icon name={showPwd ? "eye-off" : "eye"} size={22} color="#FF8200" />
              </TouchableOpacity>
            </View>
            {/* Confirmation */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Confirmer le mot de passe"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                placeholderTextColor="#FFB870"
                style={styles.input}
                onSubmitEditing={handleRegister}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm(v => !v)}
                activeOpacity={0.7}
              >
                <Icon name={showConfirm ? "eye-off" : "eye"} size={22} color="#FF8200" />
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              disabled={loading}
              onPress={handleRegister}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginBtnText}>
                  S'inscrire
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101017",
    borderBottomWidth: 1.5,
    borderBottomColor: "#FF8200",
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 10,
    marginBottom: 0,
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FF8200",
    backgroundColor: "#fff",
    alignSelf: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 25,
    fontWeight: "900",
    color: "#FF8200",
    marginBottom: 38,
    textAlign: "center",
    letterSpacing: 1.2,
    textShadowColor: "#FFE3B7",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  formCard: {
    width: 320,
    backgroundColor: "rgba(255,244,230,0.98)",
    borderRadius: 27,
    padding: 26,
    marginBottom: 12,
    shadowColor: "#FF8200",
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1.7,
    borderColor: "#FF8200",
    alignItems: "center",
  },
  inputWrap: {
    width: "100%",
    position: "relative",
    marginBottom: 18,
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#FFD7A1",
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF8200",
    shadowColor: "#F6B98C",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    letterSpacing: 0.3,
    paddingRight: 44, // espace œil
  },
  eyeBtn: {
    position: "absolute",
    right: 11,
    top: 12,
    padding: 2,
    zIndex: 10,
  },
  errorText: {
    color: "#E53935",
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center"
  },
  loginBtn: {
    backgroundColor: "#FF8200",
    paddingVertical: 15,
    paddingHorizontal: 58,
    borderRadius: 18,
    marginTop: 6,
    shadowColor: "#FF8200",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  loginBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 1.2,
  }
});
