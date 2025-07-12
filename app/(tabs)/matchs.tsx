import React, { useEffect, useState } from 'react'
import { FlatList, Image, Linking, SafeAreaView, Text, TouchableOpacity, View } from 'react-native'
import LogoutButton from '../../components/LogoutButton'
import { supabase } from '../../supabase'

const TEAM_NAMES: Record<string, string> = {
  "HON": "Honfleur",
  "LHA": "Le Havre",
  "ROU": "Rouen",
  "CAE": "Caen",
  "CHE": "Cherbourg",
  "WAL": "Val-de-Reuil",
  "AND": "Andelys",
  // Ajoute ici si tu as d'autres abréviations d'équipe
}

type Game = {
  id: number
  game_number: number
  date: string
  is_home: boolean
  opponent_abbr: string
  opponent_logo: string
  team_score: number
  opponent_score: number
  result: string
  boxscore_link: string
  team_abbr?: string // Ajouté au cas où besoin
}

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
}

function resultColor(result: string) {
  if (result === "W") return "#2CB23C" // victoire vert
  if (result === "L") return "#E53935" // défaite rouge
  return "#888" // nul ou autre
}

export default function MatchsScreen() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .order('date', { ascending: true })

        if (error) {
          setErrorMsg("Erreur Supabase : " + error.message)
        } else if (!data) {
          setErrorMsg("Aucun match à afficher.")
        } else {
          setGames(data as Game[])
        }
      } catch (e: any) {
        setErrorMsg("Gros crash côté JS : " + (e?.message || e))
      }
      setLoading(false)
    }

    fetchGames()
  }, [])

  if (loading)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 18, color: "#999" }}>Chargement…</Text>

  if (errorMsg)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 16, color: "red" }}>
      {errorMsg}</Text>

  if (!games.length)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 16, color: "#888" }}>
      Aucun match à afficher.</Text>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7FAFC" }}>
      <View style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 4,
        paddingHorizontal: 8,
        backgroundColor: "#E3F6FF",
        borderBottomWidth: 1,
        borderBottomColor: "#B4E1FA"
      }}>
        <LogoutButton />
      </View>
      <View style={{
        alignItems: "center",
        backgroundColor: "#E3F6FF",
        marginBottom: 8,
        paddingTop: 4,
        paddingBottom: 12
      }}>
        <Text style={{
          fontSize: 26, fontWeight: "bold", color: "#2196F3", letterSpacing: 1
        }}>Calendrier & Résultats</Text>
        <Text style={{ color: "#777", fontSize: 13 }}>Saison 2025 – Comets Honfleur</Text>
      </View>
      <FlatList
        data={games}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        renderItem={({ item }) => {
          // On affiche notre équipe (HON) et l’adversaire côte à côte
          const teamAbbr = item.team_abbr || "HON"
          const homeTeam = item.is_home ? teamAbbr : item.opponent_abbr
          const awayTeam = item.is_home ? item.opponent_abbr : teamAbbr

          return (
            <View style={{
              backgroundColor: "#fff",
              borderRadius: 15,
              marginBottom: 12,
              padding: 15,
              shadowColor: "#1976D2",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
              borderWidth: 1,
              borderColor: "#B6E4FC"
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Text style={{
                  fontWeight: "bold",
                  fontSize: 16,
                  color: "#FF8200",
                  marginRight: 10
                }}>
                  Match #{item.game_number}
                </Text>
                <Text style={{ color: "#888", fontSize: 14 }}>
                  {formatDate(item.date)}
                </Text>
              </View>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
                justifyContent: "space-between"
              }}>
                <Text style={{
                  fontWeight: "bold",
                  color: item.is_home ? "#25ad51" : "#0b65c2",
                  fontSize: 14,
                  marginRight: 7
                }}>
                  {item.is_home ? "À Domicile" : "Extérieur"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "center" }}>
                  {/* Home team */}
                  <Text style={{
                    fontWeight: "bold",
                    fontSize: 15,
                    color: "#2196F3",
                    marginRight: 5,
                  }}>
                    {TEAM_NAMES[homeTeam] || homeTeam}
                  </Text>
                  <Text style={{
                    fontWeight: "bold",
                    fontSize: 15,
                    color: "#2196F3",
                  }}>
                    {item.is_home ? item.team_score : item.opponent_score}
                  </Text>
                  <Text style={{ color: "#aaa", fontSize: 16, marginHorizontal: 7 }}>–</Text>
                  <Text style={{
                    fontWeight: "bold",
                    fontSize: 15,
                    color: "#FF8200"
                  }}>
                    {item.is_home ? item.opponent_score : item.team_score}
                  </Text>
                  <Text style={{
                    fontWeight: "bold",
                    fontSize: 15,
                    color: "#FF8200",
                    marginLeft: 5
                  }}>
                    {TEAM_NAMES[awayTeam] || awayTeam}
                  </Text>
                  <Image
                    source={{ uri: item.opponent_logo }}
                    style={{
                      width: 32, height: 32, borderRadius: 16,
                      marginLeft: 10, borderWidth: 1.5, borderColor: "#EEE"
                    }}
                  />
                </View>
              </View>
              {/* Résultat */}
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
                justifyContent: "flex-start"
              }}>
                <Text style={{
                  fontWeight: "bold",
                  fontSize: 15,
                  color: resultColor(item.result),
                  marginLeft: 4,
                  textTransform: "uppercase"
                }}>
                  {item.result === "W" ? "Victoire" : item.result === "L" ? "Défaite" : item.result}
                </Text>
              </View>
              {item.boxscore_link ?
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.boxscore_link)}
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: "#FF8200",
                    borderRadius: 7,
                    paddingHorizontal: 13,
                    paddingVertical: 6,
                    marginTop: 2
                  }}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Boxscore FFBS</Text>
                </TouchableOpacity>
                : null
              }
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}
