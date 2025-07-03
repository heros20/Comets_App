import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native'
import { useAdmin } from '../../contexts/AdminContext'; // adapte le chemin selon ton arbo

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shakeAnim] = useState(new Animated.Value(0))
  const router = useRouter()
  const { checkAdmin } = useAdmin() // <-- on récupère le contexte

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('https://les-comets-honfleur.vercel.app/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json.success) {
        await SecureStore.setItemAsync('admin_logged_in', 'yes')
        await checkAdmin()         // <-- on synchronise le contexte tout de suite
        router.replace('/')        // <-- puis on revient à l'accueil
      } else {
        setError('Identifiants invalides. Essaie encore !')
        shake()
      }
    } catch (e) {
      console.log("LOGIN ERROR", e)
      setError('Erreur réseau. Réessaie plus tard.')
      shake()
    }
    setLoading(false)
  }

  // Animation de secousse si erreur de login
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFAF3' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{
          fontSize: 34,
          fontWeight: "900",
          color: "#FF8200",
          marginBottom: 10,
          letterSpacing: 1.5,
        }}>
          Comets Honfleur
        </Text>
        <Text style={{
          fontSize: 18,
          fontWeight: "600",
          color: "#222",
          marginBottom: 36,
          letterSpacing: 0.5
        }}>
          Connexion admin ⚾️
        </Text>
        <Animated.View style={{ width: 280, transform: [{ translateX: shakeAnim }] }}>
          <TextInput
            placeholder="Nom d'utilisateur"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholderTextColor="#FFA94D"
            style={{
              backgroundColor: "#FFF",
              padding: 15,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#FFD7A1",
              fontSize: 16,
              marginBottom: 16,
              fontWeight: "bold",
              color: "#FF8200",
              shadowColor: "#F6B98C",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
          />
          <TextInput
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor="#FFA94D"
            style={{
              backgroundColor: "#FFF",
              padding: 15,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#FFD7A1",
              fontSize: 16,
              marginBottom: 12,
              fontWeight: "bold",
              color: "#FF8200",
              shadowColor: "#F6B98C",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
            onSubmitEditing={handleLogin}
          />
        </Animated.View>
        {error ?
          <Text style={{ color: "#E53935", fontWeight: "bold", marginBottom: 10 }}>{error}</Text>
          : null}
        <TouchableOpacity
          style={{
            backgroundColor: "#FF8200",
            paddingVertical: 15,
            paddingHorizontal: 60,
            borderRadius: 18,
            marginTop: 10,
            shadowColor: "#FF8200",
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 2,
            opacity: loading ? 0.7 : 1
          }}
          disabled={loading}
          onPress={handleLogin}
        >
          {loading ?
            <ActivityIndicator color="#FFF" /> :
            <Text style={{
              color: "#FFF",
              fontWeight: "bold",
              fontSize: 18,
              letterSpacing: 1.2
            }}>
              Se connecter
            </Text>
          }
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
