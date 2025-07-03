import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { supabase } from '../../supabase'

type Message = {
  id: number
  name: string
  email: string
  phone?: string
  message: string
  created_at: string
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "Date inconnue"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return "Date invalide"
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
}

export default function MessagesScreen({ navigation }: any) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // Vérifie la session au mount
  useEffect(() => {
    (async () => {
      const session = await SecureStore.getItemAsync('admin_logged_in')
      if (session !== 'yes') {
        // Si on utilise expo-router v2+, router.replace sinon navigation.replace
        if (router && router.replace) {
          router.replace('/login')
        } else if (navigation && navigation.replace) {
          navigation.replace('login')
        }
      } else {
        setCheckingSession(false)
      }
    })()
  }, [])

  // Récupère les messages
  useEffect(() => {
    if (checkingSession) return
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        setMessages(data as Message[])
      }
      setLoading(false)
    }
    fetchMessages()
  }, [checkingSession])

  // Déconnexion (efface la session et redirige)
  async function handleLogout() {
    await SecureStore.deleteItemAsync('admin_logged_in')
    if (router && router.replace) {
      router.replace('/login')
    } else if (navigation && navigation.replace) {
      navigation.replace('login')
    }
  }

  // Suppression d’un message
  async function handleDelete(id: number) {
    Alert.alert(
      "Supprimer le message",
      "Tu es sûr de vouloir supprimer ce message ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive", onPress: async () => {
            setDeletingId(id)
            const { error } = await supabase
              .from('messages')
              .delete()
              .eq('id', id)
            if (!error) {
              setMessages(msgs => msgs.filter(m => m.id !== id))
            } else {
              Alert.alert("Erreur", error.message)
            }
            setDeletingId(null)
          }
        }
      ]
    )
  }

  // Attente de check session
  if (checkingSession)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F8FA", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF8200" />
      </SafeAreaView>
    )

  if (loading)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 18, color: "#999" }}>Chargement…</Text>

  if (!messages.length)
    return <Text style={{ textAlign: 'center', marginTop: 60, fontSize: 16, color: '#888' }}>
      Aucun message reçu…</Text>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F8FA" }}>
      {/* Header */}
      <View style={{
        paddingTop: 18, paddingBottom: 12, alignItems: "center",
        backgroundColor: "#FFF4E6", marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between'
      }}>
        <Text style={{
          fontSize: 26, fontWeight: "bold", color: "#FF8200", letterSpacing: 1, flex: 1, textAlign: "center"
        }}>Messages reçus</Text>
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: "#FF8200",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 8,
            marginRight: 14
          }}>
          <Text style={{ color: "#fff", fontWeight: "600", letterSpacing: 0.5 }}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 6 }}
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#FFDBB2",
            borderRadius: 16,
            padding: 16,
            marginBottom: 14,
            shadowColor: "#FFB870",
            shadowOpacity: 0.10,
            shadowRadius: 8,
            elevation: 3,
          }}>
            {/* Nom & date */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 5
            }}>
              <Text style={{ fontWeight: 'bold', color: "#d96400", fontSize: 17 }}>
                {item.name}
              </Text>
              <Text style={{ color: "#AAA", fontSize: 13 }}>{formatDate(item.created_at)}</Text>
            </View>
            {/* Email & phone */}
            <Text style={{ color: "#2d69a7", fontSize: 14, marginBottom: 3 }}>
              {item.email}
              {item.phone ? ` | ${item.phone}` : ""}
            </Text>
            {/* Message */}
            <Text style={{ color: "#3a2400", marginBottom: 10, fontSize: 16, lineHeight: 22 }}>
              {item.message}
            </Text>
            {/* Actions */}
            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${item.email}?subject=Réponse à votre message Comets Honfleur`)}
                style={{
                  backgroundColor: "#1976D2",
                  borderRadius: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  marginRight: 10,
                  shadowColor: "#1976D2",
                  shadowOpacity: 0.10,
                  shadowRadius: 4,
                  elevation: 2,
                }}>
                <Text style={{ color: "#fff", fontWeight: "600", letterSpacing: 0.5 }}>Répondre</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={deletingId === item.id}
                onPress={() => handleDelete(item.id)}
                style={{
                  backgroundColor: "#E53935",
                  borderRadius: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  opacity: deletingId === item.id ? 0.7 : 1
                }}>
                <Text style={{ color: "#fff", fontWeight: "600", letterSpacing: 0.5 }}>
                  {deletingId === item.id ? "Suppression..." : "Supprimer"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}
