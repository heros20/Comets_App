import { useNavigation } from '@react-navigation/native';
import * as Calendar from 'expo-calendar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LogoutButton from '../../components/LogoutButton';
import { supabase } from '../../supabase';

// Le logo
const logoComets = require("../../assets/images/iconComets.png");

// Mapping du nom à l’image locale
const LOGO_MAP: Record<string, any> = {
  "Caen": require('../../assets/images/Caen.png'),
  "Cherbourg": require('../../assets/images/Cherbourg.jpg'),
  "Les Andelys": require('../../assets/images/les_Andelys.png'),
  "Louviers": require('../../assets/images/Louviers.png'),
  "Le Havre": require('../../assets/images/Le_Havre.png'),
  "Rouen": require('../../assets/images/Rouen.jpg'),
  "Honfleur": require('../../assets/images/Honfleur.png'),
};

const TEAM_NAMES: Record<string, string> = {
  HON: 'Honfleur',
  LHA: 'Le Havre',
  ROU: 'Rouen',
  CAE: 'Caen',
  CHE: 'Cherbourg',
  WAL: 'Louviers',
  AND: 'Andelys',
};

type Game = {
  id: number;
  game_number: number;
  date: string;
  is_home: boolean;
  opponent_abbr: string;
  opponent_logo: string;
  team_score: number | null;
  opponent_score: number | null;
  result: string;
  boxscore_link: string;
  team_abbr?: string;
  note?: string | null;
};

type PlannedGame = {
  id: number | string;
  date: string;
  opponent: string;
  logo?: string;
  is_home: boolean;
  note?: string | null;
};

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function resultColor(result: string) {
  if (result === 'W') return '#0FE97E';
  if (result === 'L') return '#E53935';
  return '#FFD600';
}
function resultLabel(result: string) {
  if (result === 'W') return 'VICTOIRE';
  if (result === 'L') return 'DÉFAITE';
  return 'NUL';
}

const TABS = [
  { label: "Matchs à venir", key: "upcoming" },
  { label: "Matchs joués", key: "played" }
];

export default function MatchsScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [plannedGames, setPlannedGames] = useState<PlannedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlanned, setLoadingPlanned] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("upcoming");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .order('date', { ascending: true });
        if (error) setErrorMsg('Erreur Supabase (joués) : ' + error.message);
        else setGames(data as Game[] ?? []);
      } catch (e: any) {
        setErrorMsg('Crash côté JS (joués) : ' + (e?.message || e));
      }
      setLoading(false);
    };
    fetchGames();
  }, []);

  useEffect(() => {
    const fetchPlanned = async () => {
      try {
        const { data, error } = await supabase
          .from('matches_planned')
          .select('*')
          .order('date', { ascending: true });
        if (error) setErrorMsg('Erreur Supabase (à venir) : ' + error.message);
        else setPlannedGames(data as PlannedGame[] ?? []);
      } catch (e: any) {
        setErrorMsg('Crash côté JS (à venir) : ' + (e?.message || e));
      }
      setLoadingPlanned(false);
    };
    fetchPlanned();
  }, []);

  // Matchs à venir filtrés par date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const playedGames = games.filter(g => g.result);
  const dataToShow = selectedTab === "played"
    ? playedGames
    : plannedGames.filter(pg => {
        const d = new Date(pg.date);
        return d >= today;
      });

  // Ajout calendrier natif (11h - 17h)
  async function addMatchToCalendar(match: PlannedGame) {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l’accès au calendrier.');
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCal = calendars.find(cal => cal.allowsModifications);

      if (!defaultCal) {
        Alert.alert('Erreur', 'Aucun calendrier modifiable trouvé.');
        return;
      }

      // Créneau 11h-17h
      const baseDate = new Date(match.date);
      baseDate.setHours(11, 0, 0, 0);
      const endDate = new Date(baseDate.getTime() + 6 * 60 * 60 * 1000); // +6h

      await Calendar.createEventAsync(defaultCal.id, {
        title: `Match Comets vs ${match.opponent}`,
        startDate: baseDate,
        endDate,
        location: match.is_home ? "Stade de Honfleur" : `Déplacement - ${match.opponent}`,
        notes: match.note || "",
        alarms: [{ relativeOffset: -60 }], // rappel 1h avant
        timeZone: "Europe/Paris",
      });

      Alert.alert('Ajouté !', 'Le match a été ajouté dans votre calendrier.');
    } catch (e: any) {
      Alert.alert('Erreur calendrier', e?.message || 'Erreur inconnue.');
    }
  }

  // Logo selon adversaire (PlannedGame)
  function getOpponentLogo(opponent: string): any {
    return LOGO_MAP[opponent] || null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101017' }}>
      <StatusBar barStyle="light-content" />
      {/* Logo Comets */}
      <View style={styles.logoBox}>
        <Image source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginRight: 14, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Calendrier & Résultats</Text>
          <Text style={styles.headerSubtitle}>Saison 2025 – Comets Honfleur</Text>
        </View>
        <LogoutButton />
      </View>
      {/* Onglets */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabBtn,
              selectedTab === tab.key && styles.tabBtnActive
            ]}
            onPress={() => setSelectedTab(tab.key)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                selectedTab === tab.key && styles.tabBtnTextActive
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Liste */}
      <View style={{ flex: 1, backgroundColor: "#18181C", borderTopLeftRadius: 36, borderTopRightRadius: 36 }}>
        {(loading && selectedTab === "played") || (loadingPlanned && selectedTab === "upcoming") ? (
          <Text style={{ textAlign: 'center', marginTop: 60, fontSize: 18, color: '#999' }}>
            Chargement…
          </Text>
        ) : errorMsg ? (
          <Text style={{ textAlign: 'center', marginTop: 60, fontSize: 16, color: 'red' }}>
            {errorMsg}
          </Text>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={dataToShow}
              keyExtractor={item => item.id.toString()}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginTop: 60, fontSize: 16, color: '#888' }}>
                  Aucun match à afficher.
                </Text>
              }
              contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
 renderItem={({ item }) => {
  if (selectedTab === "upcoming") {
    // Affichage matchs à venir (PlannedGame)
    return (
      <View style={[styles.card, { borderColor: "#52b6fa" }]}>
        {/* Date et adversaire */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={styles.matchNumber}>
            Match à venir
          </Text>
          <Text style={styles.matchDate}>{formatDate(item.date)}</Text>
        </View>
        {/* Lieu */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Icon
            name={item.is_home ? 'home' : 'airplane-outline'}
            size={20}
            color={item.is_home ? '#FF8200' : '#54b0f9'}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.lieuText}>
            {item.is_home ? 'À Domicile' : 'Extérieur'}
          </Text>
        </View>
        {/* Honfleur vs Adversaire */}
        <View style={styles.scoreRow}>
          <View style={styles.teamBox}>
            <Text style={[styles.teamName, { color: '#FF8200' }]}>
              Honfleur
            </Text>
            <Image source={LOGO_MAP["Honfleur"]} style={styles.logoOpp} />
          </View>
          <Text style={styles.scoreDash}>–</Text>
          <View style={styles.teamBox}>
            <Text style={[styles.teamName, { color: '#2196F3' }]}>
              {item.opponent}
            </Text>
            {getOpponentLogo(item.opponent) ? (
              <Image source={getOpponentLogo(item.opponent)} style={styles.logoOpp} />
            ) : null}
          </View>
        </View>
        {/* Note */}
        {item.note ? (
          <Text style={{
            color: '#FF8200', fontWeight: 'bold',
            fontSize: 13, marginTop: 7, textAlign: "center"
          }}>
            {item.note}
          </Text>
        ) : null}
        {/* BOUTON AJOUT CALENDRIER */}
        <TouchableOpacity
          style={styles.calBtn}
          activeOpacity={0.87}
          onPress={() => {
            Alert.alert(
              'Ajouter au calendrier',
              `Voulez-vous ajouter ce match à votre calendrier ?`,
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Oui', onPress: () => addMatchToCalendar(item) },
              ]
            );
          }}
        >
          <Icon name="calendar-outline" size={18} color="#fff" style={{ marginRight: 7 }} />
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Ajouter au calendrier</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    // Affichage matchs joués (Game)
    // On calcule qui est à gauche/droite et on affiche les bons logos et noms
    const teamAbbr = item.team_abbr || 'HON';
    const homeTeam = item.is_home ? teamAbbr : item.opponent_abbr;
    const awayTeam = item.is_home ? item.opponent_abbr : teamAbbr;
    const homeIsHonfleur = homeTeam === 'HON' || TEAM_NAMES[homeTeam] === "Honfleur";
    // Pour le logo : si c'est Honfleur, logo local, sinon logo map selon nom
    const leftName = TEAM_NAMES[homeTeam] || homeTeam;
    const rightName = TEAM_NAMES[awayTeam] || awayTeam;
    const leftLogo = homeIsHonfleur
      ? LOGO_MAP["Honfleur"]
      : getOpponentLogo(leftName);
    const rightLogo = !homeIsHonfleur
      ? LOGO_MAP["Honfleur"]
      : getOpponentLogo(rightName);
    // Scores à afficher
    const leftScore = item.is_home ? (item.team_score ?? "--") : (item.opponent_score ?? "--");
    const rightScore = item.is_home ? (item.opponent_score ?? "--") : (item.team_score ?? "--");

    return (
      <View style={styles.card}>
        {/* Match # et date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={styles.matchNumber}>Match #{item.game_number}</Text>
          <Text style={styles.matchDate}>{formatDate(item.date)}</Text>
        </View>
        {/* Lieu */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Icon
            name={item.is_home ? 'home' : 'airplane-outline'}
            size={20}
            color={item.is_home ? '#FF8200' : '#54b0f9'}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.lieuText}>
            {item.is_home ? 'À Domicile' : 'Extérieur'}
          </Text>
        </View>
        {/* Equipes, logos, scores */}
        <View style={styles.scoreRow}>
          <View style={styles.teamBox}>
            <Text style={[
              styles.teamName,
              { color: homeIsHonfleur ? '#FF8200' : '#2196F3' }
            ]}>
              {leftName}
            </Text>
            <Text style={styles.scoreDigit}>{leftScore}</Text>
            {leftLogo && <Image source={leftLogo} style={styles.logoOpp} />}
          </View>
          <Text style={styles.scoreDash}>–</Text>
          <View style={styles.teamBox}>
            <Text style={[
              styles.teamName,
              { color: !homeIsHonfleur ? '#FF8200' : '#2196F3' }
            ]}>
              {rightName}
            </Text>
            <Text style={styles.scoreDigit}>{rightScore}</Text>
            {rightLogo && <Image source={rightLogo} style={styles.logoOpp} />}
          </View>
        </View>
        {/* Badge résultat */}
        <View style={styles.resultRow}>
          <View
            style={[
              styles.resultBadge,
              { backgroundColor: resultColor(item.result) },
            ]}
          >
            <Text style={styles.resultBadgeText}>
              {resultLabel(item.result)}
            </Text>
          </View>
          {item.boxscore_link ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.boxscore_link)}
              style={styles.boxscoreBtn}
            >
              <Text style={styles.boxscoreBtnText}>Boxscore FFBS</Text>
              <Icon
                name="open-outline"
                size={18}
                color="#fff"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }
}}

              onScroll={e => {
                const y = e.nativeEvent.contentOffset.y;
                setShowScrollTop(y > 240);
              }}
              scrollEventThrottle={16}
            />
            {showScrollTop && (
              <TouchableOpacity
                style={styles.scrollTopBtn}
                onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                activeOpacity={0.7}
              >
                <Icon name="chevron-up" size={31} color="#FF8200" />
              </TouchableOpacity>
            )}
          </>
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
  headerSubtitle: {
    color: '#bbb',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 13,
    marginBottom: 10,
    marginTop: 7,
  },
  tabBtn: {
    paddingHorizontal: 21,
    paddingVertical: 7,
    backgroundColor: "#18181C",
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#FF8200",
    marginHorizontal: 2,
  },
  tabBtnActive: {
    backgroundColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBtnText: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  tabBtnTextActive: {
    color: "#fff",
  },
  card: {
    backgroundColor: 'rgba(255,244,230,0.93)',
    borderRadius: 25,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#FF8200',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#FF8200',
  },
  matchNumber: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#FF8200',
    marginRight: 16,
  },
  matchDate: {
    color: '#292E3A',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  lieuText: {
    fontWeight: 'bold',
    color: '#18181C',
    fontSize: 14.2,
    letterSpacing: 0.2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  teamBox: {
    alignItems: 'center',
    flexDirection: 'row',
    marginHorizontal: 7,
  },
  teamName: {
    fontWeight: '900',
    fontSize: 16,
    marginRight: 4,
    letterSpacing: 0.5,
    textShadowColor: '#fff',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  scoreDigit: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#18181C',
    marginHorizontal: 1,
    textShadowColor: '#fff8',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 5,
  },
  scoreDash: {
    fontWeight: '900',
    fontSize: 22,
    color: '#FF8200',
    marginHorizontal: 8,
    letterSpacing: 1,
  },
  logoOpp: {
    width: 36,
    height: 36,
    borderRadius: 19,
    marginLeft: 6,
    borderWidth: 2,
    borderColor: '#FF8200',
    backgroundColor: '#fff',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    gap: 11,
  },
  resultBadge: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 7,
    alignItems: 'center',
    shadowColor: '#333',
    shadowOpacity: 0.11,
    shadowRadius: 7,
    elevation: 2,
  },
  resultBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15.5,
    letterSpacing: 1,
  },
  boxscoreBtn: {
    marginLeft: 13,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8200',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 7,
    shadowColor: '#FF8200',
    shadowOpacity: 0.11,
    shadowRadius: 4,
    elevation: 1,
  },
  boxscoreBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  scrollTopBtn: {
    position: "absolute",
    right: 18,
    bottom: 22,
    backgroundColor: "#101017cc",
    borderRadius: 40,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.2,
    borderColor: "#FF8200",
    zIndex: 22,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 11,
    elevation: 7,
  },
  calBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    backgroundColor: "#FF8200",
    borderRadius: 14,
    paddingVertical: 10,
    shadowColor: "#FF8200",
    shadowOpacity: 0.11,
    shadowRadius: 4,
    elevation: 2,
  },
});
