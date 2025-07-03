import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useAdmin } from '../contexts/AdminContext'; // Ajuste si besoin !

export default function LogoutButton() {
  const router = useRouter()
  const { isAdmin, logout } = useAdmin()

  if (!isAdmin) return null; // Affiche rien si pas connecté

  const handleLogout = async () => {
    await logout()
    router.replace('/') // Redirige vers l’accueil
  }

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={{
        backgroundColor: "#FF8200",
        borderRadius: 8,
        paddingHorizontal: 18,
        paddingVertical: 8,
        marginRight: 14,
        alignSelf: "flex-end"
      }}>
      <Text style={{ color: "#fff", fontWeight: "600", letterSpacing: 0.5 }}>Déconnexion</Text>
    </TouchableOpacity>
  )
}
