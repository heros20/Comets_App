import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
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

const logoComets = require("../../assets/images/iconComets.png");

type Admin = {
  id: number;
  first_name: string;
  last_name: string;
  age: number | null;
  categorie: string | null;
  email: string | null;
};
type Player = {
  id: number;
  last_name: string;
  first_name: string;
  number: number;
  yob: number | null;
  player_link: string | null;
  team_abbr: string | null;
};

const CATEGORIES = ["Senior", "15U", "12U"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function JoueursScreen() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<string>("Senior");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | null>(null); // Lettre filtrée
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data: adminsData, error: errorAdmins } = await supabase
          .from('admins')
          .select('id, first_name, last_name, age, categorie, email');
        const { data: playersData, error: errorPlayers } = await supabase
          .from('players')
          .select('id, last_name, first_name, number, yob, player_link, team_abbr');

        if (errorAdmins) {
          setErrorMsg('Erreur Supabase Admins : ' + errorAdmins.message);
        } else if (errorPlayers) {
          setErrorMsg('Erreur Supabase Players : ' + errorPlayers.message);
        } else {
          setAdmins(adminsData as Admin[]);
          setPlayers(playersData as Player[]);
        }
      } catch (e: any) {
        setErrorMsg('Gros crash côté JS : ' + (e?.message || e));
      }
      setLoading(false);
    };

    fetchAll();
  }, []);

  // On prépare la data globale, avant filtrage alphabétique
  const allData = (() => {
    if (selectedCat === "Senior") {
      return players
        .sort((a, b) =>
          a.last_name.localeCompare(b.last_name) ||
          a.first_name.localeCompare(b.first_name)
        )
        .map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          year: p.yob || "--",
          link: p.player_link || "",
        }));
    } else {
      return admins
        .filter(
          a =>
            a.categorie &&
            a.categorie.toUpperCase() === selectedCat.toUpperCase()
        )
        .sort((a, b) =>
          (a.last_name || '').localeCompare(b.last_name || '') ||
          (a.first_name || '').localeCompare(b.first_name || '')
        )
        .map(a => ({
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          year: a.age ? new Date().getFullYear() - a.age : "--",
          link: "",
        }));
    }
  })();

  // Puis on filtre par lettre si besoin
const dataToShow = activeLetter
  ? allData.filter(item =>
      (item.last_name || "").toUpperCase().startsWith(activeLetter) ||
      (item.first_name || "").toUpperCase().startsWith(activeLetter)
    )
  : allData;


  // --- UI ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#101017' }}>
      <StatusBar barStyle="light-content" />
      {/* Logo Comets bien centré, espacé du top */}
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
          <Text style={styles.headerTitle}>Les Comets – Effectif</Text>
          <Text style={styles.headerSubtitle}>Joueurs 2025</Text>
        </View>
        <LogoutButton />
      </View>
      {/* Onglets catégories */}
      <View style={styles.tabRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.tabBtn,
              selectedCat === cat && styles.tabBtnActive
            ]}
            onPress={() => {
              setSelectedCat(cat);
              setActiveLetter(null); // Reset filtre sur changement catégorie
            }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                selectedCat === cat && styles.tabBtnTextActive
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bandeau alphabétique */}
      <View style={styles.alphaRow}>
        <TouchableOpacity
          style={[
            styles.alphaBtn,
            !activeLetter && styles.alphaBtnActive
          ]}
          onPress={() => setActiveLetter(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.alphaBtnText, !activeLetter && styles.alphaBtnTextActive]}>TOUT</Text>
        </TouchableOpacity>
        {ALPHABET.map(letter => (
          <TouchableOpacity
            key={letter}
            style={[
              styles.alphaBtn,
              activeLetter === letter && styles.alphaBtnActive
            ]}
            onPress={() => setActiveLetter(letter)}
            activeOpacity={0.7}
          >
            <Text style={[styles.alphaBtnText, activeLetter === letter && styles.alphaBtnTextActive]}>{letter}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1, backgroundColor: "#18181C", borderTopLeftRadius: 36, borderTopRightRadius: 36 }}>
        {loading ? (
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
              getItemLayout={(_, index) => ({
                length: 105,
                offset: 105 * index,
                index,
              })}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginTop: 60, fontSize: 16, color: '#888' }}>
                  Aucun joueur à afficher dans cette catégorie.
                </Text>
              }
              contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.first_name?.[0] || ""}
                        {item.last_name?.[0] || ""}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text
                        style={styles.nameText}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {`${item.first_name || ""} ${item.last_name || ""}`}
                      </Text>
                      <Text style={styles.yearText}>
                        {item.year}
                      </Text>
                    </View>
                  </View>
                  {item.link ? (
                    <TouchableOpacity
                      onPress={() => item.link && Linking.openURL(item.link)}
                      style={styles.ffbsBtn}
                    >
                      <Text style={styles.ffbsBtnText}>Fiche FFBS</Text>
                      <Icon name="open-outline" size={17} color="#fff" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
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
  // ===== A-Z row =====
  alphaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 9,
    marginTop: 2,
    gap: 3,
  },
  alphaBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    marginHorizontal: 2,
    backgroundColor: "#fff6ee",
    borderWidth: 1.3,
    borderColor: "#FF8200",
    marginBottom: 2,
    marginTop: 2,
    minWidth: 23,
    alignItems: "center",
  },
  alphaBtnActive: {
    backgroundColor: "#FF8200",
  },
  alphaBtnText: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  alphaBtnTextActive: {
    color: "#fff",
  },
  // ==== Cartes joueurs ====
  card: {
    backgroundColor: 'rgba(255,244,230,0.97)',
    borderRadius: 30,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#FF8200',
    shadowOpacity: 0.11,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1.8,
    borderColor: '#FF8200',
    flexDirection: 'column',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181C',
    borderWidth: 2.5,
    borderColor: '#FF8200',
    marginRight: 14,
    shadowColor: '#FF8200',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarText: {
    color: '#FF8200',
    fontWeight: '900',
    fontSize: 27,
    letterSpacing: 2,
  },
  infoCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#18181C',
    letterSpacing: 0.7,
    marginBottom: 1,
    flexWrap: 'wrap',
    maxWidth: 230,
  },
  yearText: {
    color: '#FF8200',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  ffbsBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8200',
    borderRadius: 9,
    paddingHorizontal: 17,
    paddingVertical: 8,
    shadowColor: '#FF8200',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  ffbsBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // === Scroll-to-top ===
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
