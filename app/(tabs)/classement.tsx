import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  Image,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LogoutButton from '../../components/LogoutButton';
import { supabase } from '../../supabase';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const logoComets = require("../../assets/images/iconComets.png");

function getPrevRank(team: any, tabIdx: number, classement: any) {
  if (!classement.previous || !classement.previous.standings) return null;
  const prevTab = classement.previous.standings[tabIdx];
  if (!prevTab) return null;
  const prev = prevTab.find(
    (t: any) => t.abbreviation === team.abbreviation
  );
  return prev ? prev.rank : null;
}
function getRankChangeSymbol(prev: number | null, current: number) {
  if (!prev || prev === current) return null;
  if (prev > current) return { symbol: "▲", color: "#19bf52" };
  if (prev < current) return { symbol: "▼", color: "#e53935" };
  return null;
}

export default function ClassementScreen() {
  const [classement, setClassement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const fetchClassement = async () => {
      try {
        const { data, error } = await supabase
          .from('classement_normandie')
          .select('data')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          setErrorMsg('Erreur de récupération Supabase : ' + error.message);
        } else if (!data) {
          setErrorMsg('Aucun classement trouvé');
        } else {
          setClassement(data.data);
        }
      } catch (e: any) {
        setErrorMsg('Gros crash côté JS : ' + (e?.message || e));
      }
      setLoading(false);
    };

    fetchClassement();
  }, []);

  if (loading)
    return (
      <Text style={{ textAlign: 'center', marginTop: 50, color: '#aaa', fontSize: 18 }}>
        Chargement…
      </Text>
    );
  if (errorMsg)
    return (
      <Text style={{ color: 'red', marginTop: 50, textAlign: 'center', fontSize: 16 }}>
        {errorMsg}
      </Text>
    );
  if (!classement)
    return (
      <Text style={{ textAlign: 'center', marginTop: 50, color: '#888', fontSize: 16 }}>
        Aucun classement trouvé
      </Text>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101017', paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />

      {/* === Logo Comets, même style que Joueurs === */}
      <View style={styles.logoBox}>
        <Image source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>

      {/* Header : flèche + titre + bouton logout */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginRight: 14, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Classement R1 Normandie</Text>
        </View>
        <LogoutButton />
      </View>

      {/* Saison (sous-titre) */}
      <Text style={styles.seasonSubtitle}>Saison {classement.year}</Text>

      {/* Contenu classement + Scroll to top */}
      <View style={{ flex: 1, backgroundColor: "#18181C", borderTopLeftRadius: 36, borderTopRightRadius: 36 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 10, paddingBottom: 70 }}
          onScroll={e => {
            const y = e.nativeEvent.contentOffset.y;
            setShowScrollTop(y > 220);
          }}
          scrollEventThrottle={16}
        >
          {classement.standings.map((tabStandings: any[], tabIdx: number) => (
            <View
              key={tabIdx}
              style={[
                styles.tabCard,
                {
                  // PlayOff foncé pour le premier tableau
                  backgroundColor: tabIdx === 0 ? "#262235" : 'rgba(255,244,230,0.96)',
                  borderColor: '#FF8200',
                },
              ]}
            >
              <Text style={styles.tabTitle}>
                {classement.tabs[tabIdx]}
              </Text>
              {tabStandings.map((team: any, idx: number) => {
                const isFirst = idx === 0;
                const isComets =
                  team.name?.toLowerCase().includes('honfleur') ||
                  team.abbreviation === 'HON';

                const prevRank = getPrevRank(team, tabIdx, classement);
                const rankChange = getRankChangeSymbol(prevRank, team.rank);

                return (
                  <View
                    key={idx}
                    style={[
                      styles.teamRow,
                      isFirst && styles.firstRow,
                      isComets && styles.cometsRow,
                    ]}
                  >
                    {/* Rang + Flèche */}
                    <View style={styles.rankBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <Text
                          style={[
                            styles.rankText,
                            isFirst && styles.rankTextFirst,
                            isComets && styles.rankTextComets,
                          ]}
                        >
                          {isFirst ? '🥇' : team.rank}
                        </Text>
                        {rankChange && (
                          <Text style={{ fontSize: 15, marginLeft: 3, color: rankChange.color, fontWeight: "bold" }}>
                            {rankChange.symbol}
                          </Text>
                        )}
                      </View>
                    </View>
                    {/* Logo club */}
                    <Image
                      source={{ uri: team.logo }}
                      style={[
                        styles.logoTeam,
                        isComets && styles.logoComets,
                        isFirst && styles.logoFirst,
                      ]}
                    />
                    {/* Nom club */}
                    <View style={{ flex: 1, marginLeft: 2 }}>
                      <Text
                        style={[
                          styles.teamName,
                          isComets && styles.teamNameComets,
                          isFirst && styles.teamNameFirst,
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {team.name}
                        <Text style={styles.abbr}> ({team.abbreviation})</Text>
                      </Text>
                      <Text style={styles.stats}>
                        V:{team.W} D:{team.L} T:{team.T} • PCT:{team.PCT} • GB:{team.GB}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
        {showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtn}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.7}
          >
            <Icon name="chevron-up" size={31} color="#FF8200" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 20,
    backgroundColor: "#101017",
    borderRadius: 30,
    padding: 10,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "#101017",
    borderWidth: 4,
    borderColor: "#FF8200",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101017',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FF8200',
    paddingTop: Platform.OS === "ios" ? 15 : 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF8200',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  seasonSubtitle: {
    fontSize: 16,
    marginTop: 2,
    marginBottom: 14,
    color: '#bbb',
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: '600',
  },
  tabCard: {
    marginBottom: 32,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 15,
    shadowColor: '#FF8200',
    shadowOpacity: 0.10,
    shadowRadius: 13,
    elevation: 4,
  },
  tabTitle: {
    fontWeight: 'bold',
    fontSize: 19,
    color: '#FF8200',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 9,
    shadowColor: '#222',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 0,
  },
  firstRow: {
    backgroundColor: '#FFD197',
    elevation: 4,
    shadowOpacity: 0.14,
  },
  cometsRow: {
    borderWidth: 2,
    borderColor: '#FF8200',
    backgroundColor: '#FFFAF3',
    shadowColor: '#FF8200',
    shadowOpacity: 0.19,
    elevation: 4,
  },
  rankBox: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontWeight: 'bold',
    color: '#444',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  rankTextFirst: {
    color: '#B86900',
    fontSize: 21,
  },
  rankTextComets: {
    color: '#FF8200',
    fontSize: 20,
  },
  logoTeam: {
    width: 40,
    height: 40,
    borderRadius: 22,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#ECECEC',
    backgroundColor: '#fff',
  },
  logoFirst: {
    borderColor: '#FF8200',
  },
  logoComets: {
    borderColor: '#FF8200',
    borderWidth: 2.5,
  },
  teamName: {
    fontWeight: 'bold',
    fontSize: 15.5,
    color: '#292E3A',
    flexWrap: 'wrap',
    maxWidth: 190,
    marginBottom: 1,
  },
  teamNameFirst: {
    color: '#B86900',
    fontSize: 17,
  },
  teamNameComets: {
    color: '#FF8200',
    fontWeight: '900',
    fontSize: 17,
  },
  abbr: {
    color: '#aaa',
    fontWeight: 'normal',
    fontSize: 14,
  },
  stats: {
    color: '#444',
    fontSize: 13,
    marginTop: 1,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 25,
    backgroundColor: "#101017EE",
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF8200",
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#FF8200",
  },
});
