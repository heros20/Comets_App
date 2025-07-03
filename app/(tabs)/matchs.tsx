import React, { useEffect, useState } from 'react'
import { FlatList, Linking, SafeAreaView, Text, TouchableOpacity, View } from 'react-native'
import LogoutButton from '../../components/LogoutButton'; // <-- Ajoute l'import ici
import { supabase } from '../../supabase'

type Player = {
  id: number
  last_name: string
  first_name: string
  number: number
  pos: string
  bt: string
  yob: number
  player_link: string
  team_abbr: string
}

export default function JoueursScreen() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, last_name, first_name, number, pos, bt, yob, player_link, team_abbr')
        .order('number', { ascending: true })

      if (error) {
        console.error(error)
      } else {
        setPlayers(data as Player[])
      }
      setLoading(false)
    }

    fetchPlayers()
  }, [])

  if (loading)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 18, color: "#999" }}>Chargement…</Text>

  if (!players.length)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 16, color: "#888" }}>
      Aucun joueur à afficher.</Text>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FB" }}>
      {/* Header avec Déconnexion */}
      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#E3F6FF",
        borderBottomWidth: 1, borderBottomColor: "#B4E1FA",
        paddingTop: 18, paddingBottom: 10, paddingHorizontal: 8, marginBottom: 8
      }}>
        <View>
          <Text style={{
            fontSize: 26, fontWeight: "bold", color: "#2196F3", letterSpacing: 1
          }}>Les Comets – Effectif</Text>
          <Text style={{ color: "#777", fontSize: 13 }}>Joueurs 2025</Text>
        </View>
        <LogoutButton />
      </View>

      <FlatList
        data={players}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ padding: 8, paddingBottom: 18 }}
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: "#fff",
            borderRadius: 15,
            marginBottom: 12,
            padding: 18,
            shadowColor: "#2196F3",
            shadowOpacity: 0.09,
            shadowRadius: 8,
            elevation: 3,
            borderWidth: 1,
            borderColor: "#B6E4FC"
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
              <Text style={{
                backgroundColor: "#2196F3",
                color: "#fff",
                fontWeight: "bold",
                fontSize: 19,
                borderRadius: 9,
                width: 38, height: 38,
                textAlign: "center", textAlignVertical: "center",
                lineHeight: 38, marginRight: 12
              }}>
                {item.number}
              </Text>
              <Text style={{
                fontWeight: "bold",
                fontSize: 18,
                color: "#1A2636"
              }}>
                {item.first_name} {item.last_name}
              </Text>
            </View>
            <Text style={{ color: "#444", fontSize: 15, marginBottom: 1 }}>
              Poste : <Text style={{ fontWeight: "bold" }}>{item.pos}</Text> | Année : <Text style={{ fontWeight: "bold" }}>{item.yob}</Text>
            </Text>
            <Text style={{ color: "#777", fontSize: 14, marginBottom: 4 }}>
              B/T : {item.bt} | Team : {item.team_abbr}
            </Text>
            {item.player_link ?
              <TouchableOpacity
                onPress={() => Linking.openURL(item.player_link)}
                style={{
                  marginTop: 2,
                  alignSelf: "flex-start",
                  paddingHorizontal: 13,
                  paddingVertical: 5,
                  backgroundColor: "#FF8200",
                  borderRadius: 7
                }}>
                <Text style={{ color: "#fff", fontWeight: "bold" }}>Fiche FFBS</Text>
              </TouchableOpacity>
              : null
            }
          </View>
        )}
      />
    </SafeAreaView>
  )
}
