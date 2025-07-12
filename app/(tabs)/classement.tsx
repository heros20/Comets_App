import React, { useEffect, useState } from 'react'
import { Image, SafeAreaView, ScrollView, Text, View } from 'react-native'
import LogoutButton from '../../components/LogoutButton'
import { supabase } from '../../supabase'

const colors = ["#FFF4E6", "#E3F6FF", "#F1E9FF"]

export default function ClassementScreen() {
  const [classement, setClassement] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const fetchClassement = async () => {
      try {
        const { data, error } = await supabase
          .from('classement_normandie')
          .select('data')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error) {
          setErrorMsg("Erreur de récupération Supabase : " + error.message)
        } else if (!data) {
          setErrorMsg("Aucun classement trouvé")
        } else {
          setClassement(data.data)
        }
      } catch (e: any) {
        setErrorMsg("Gros crash côté JS : " + (e?.message || e))
      }
      setLoading(false)
    }

    fetchClassement()
  }, [])

  if (loading) return <Text style={{ textAlign: "center", marginTop: 50 }}>Chargement…</Text>
  if (errorMsg) return <Text style={{ color: "red", marginTop: 50, textAlign: "center" }}>{errorMsg}</Text>
  if (!classement) return <Text style={{ textAlign: "center", marginTop: 50 }}>Aucun classement trouvé</Text>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7FAFC" }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 10, backgroundColor: "#FFF4E6" }}>
        <LogoutButton />
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 10 }}>
        <Text style={{
          fontWeight: 'bold',
          fontSize: 28,
          color: "#FF8200",
          letterSpacing: 1,
          marginBottom: 2,
          textAlign: "center",
          textShadowColor: "#FFE3B7",
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 4,
        }}>
          Classement R1 Normandie
        </Text>
        <Text style={{
          fontSize: 16,
          marginBottom: 18,
          color: "#999",
          textAlign: "center",
          letterSpacing: 1
        }}>
          Saison {classement.year}
        </Text>

        {classement.standings.map((tabStandings: any[], tabIdx: number) => (
          <View
            key={tabIdx}
            style={{
              marginBottom: 32,
              backgroundColor: colors[tabIdx % colors.length],
              borderRadius: 18,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text style={{
              fontWeight: 'bold',
              fontSize: 20,
              color: "#0B294B",
              marginBottom: 12,
              textAlign: "center",
              letterSpacing: 0.5,
              textTransform: "uppercase"
            }}>
              {classement.tabs[tabIdx]}
            </Text>
            {tabStandings.map((team: any, idx: number) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: idx === 0 ? "#FFD197" : "#FFF",
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  marginBottom: 8,
                  shadowColor: idx === 0 ? "#FFB600" : "#000",
                  shadowOpacity: idx === 0 ? 0.12 : 0.05,
                  shadowRadius: 4,
                  elevation: idx === 0 ? 4 : 2,
                }}
              >
                <Text style={{
                  width: 28,
                  fontWeight: idx === 0 ? "bold" : "600",
                  color: idx === 0 ? "#B86900" : "#555",
                  fontSize: 18,
                  textAlign: "center",
                  letterSpacing: 0.5
                }}>
                  {team.rank}
                </Text>
                <Image
                  source={{ uri: team.logo }}
                  style={{
                    width: 38, height: 38, borderRadius: 19, marginRight: 10,
                    borderWidth: 1.5, borderColor: idx === 0 ? "#FF8200" : "#ECECEC",
                    backgroundColor: "#fff"
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontWeight: idx === 0 ? "bold" : "600",
                    fontSize: 16,
                    color: idx === 0 ? "#B86900" : "#222"
                  }}>
                    {team.name}
                    <Text style={{ color: "#888", fontWeight: "normal" }}> ({team.abbreviation})</Text>
                  </Text>
                  <Text style={{ color: "#555", fontSize: 13, marginTop: 2 }}>
                    V:{team.W} D:{team.L} T:{team.T} • PCT:{team.PCT} • GB:{team.GB}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
