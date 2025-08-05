import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
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
import { supabase } from '../../supabase'; // 👈 importe bien supabase ICI !

const logoComets = require("../../assets/images/iconComets.png");

// --- UTILITAIRE : Demander la permission et envoyer le push token ---
// --- UTILITAIRE : Demander la permission et envoyer le push token ---
async function registerForPushNotificationsAsync(email: string, access_token?: string) {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    token = (await Notifications.getExpoPushTokenAsync()).data;
    try {
      // PATCH le token côté API avec le Bearer token !
      await fetch("https://les-comets-honfleur.vercel.app/api/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
        },
        body: JSON.stringify({ email, expo_push_token: token }),
      });
    } catch (err) {
      console.warn("Erreur enregistrement push token", err);
    }
  }
  return token;
}


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const router = useRouter();
  const { login } = useAdmin();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // LOGIN sur route API pour poser le cookie
      const res = await fetch('https://les-comets-honfleur.vercel.app/api/login', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Identifiants invalides. Essaie encore !");
        shake();
      } else {
        // LOGIN sur contexte Supabase (côté mobile)
       const success = await login(email.trim(), password);
        if (success) {
          // Récupère le Bearer token mobile Supabase
          const { data: { session } } = await supabase.auth.getSession();
          const access_token = session?.access_token;
          // 🔔 Demande permission et envoie le push token AVEC LE TOKEN AUTH
          await registerForPushNotificationsAsync(email.trim(), access_token);
          router.replace("/");
        }
        else {
          setError("Erreur lors de la connexion.");
          shake();
        }
      }
    } catch (e) {
      setError("Erreur réseau. Réessaie plus tard.");
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#191A23" }}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerBox}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: 7 }}
        >
          <Icon name="chevron-back" size={29} color="#FF8200" />
        </TouchableOpacity>
        <View style={styles.logoBox}>
          <Image source={logoComets} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Connexion Admin</Text>
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
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
            {/* Mot de passe + bouton eye */}
            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                placeholderTextColor="#FFB870"
                style={styles.input}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPwd(v => !v)}
                activeOpacity={0.7}
              >
                <Icon name={showPwd ? "eye-off" : "eye"} size={22} color="#FF8200" />
              </TouchableOpacity>
            </View>
            {/* Erreur */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
            {/* Bouton login */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              disabled={loading}
              onPress={handleLogin}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginBtnText}>
                  Se connecter
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

//styles


const styles = StyleSheet.create({
  headerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101017",
    borderBottomWidth: 1.5,
    borderBottomColor: "#FF8200",
    paddingTop: 24,
    paddingBottom: 14,
    paddingHorizontal: 10,
    marginBottom: 0,
    gap: 12,
    justifyContent: "space-between",
  },
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101017",
    borderRadius: 30,
    padding: 10,
    marginHorizontal: 5,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: "#101017",
    borderWidth: 4,
    borderColor: "#FF8200",
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
    paddingRight: 44, // Espace pour l'œil
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
