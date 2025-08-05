import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Linking,
  StatusBar,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { supabase } from '../../supabase';

const logoComets = require("../../assets/images/iconComets.png");

type Message = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  created_at: string;
};

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return 'Date inconnue';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Date invalide';
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function MessagesScreen({ navigation }: any) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const sessionStr = await SecureStore.getItemAsync('session');
      if (!sessionStr) return router.replace('/login');
      try {
        const session = JSON.parse(sessionStr);
        if (session.role !== 'admin') return router.replace('/login');
        setCheckingSession(false);
      } catch {
        router.replace('/login');
      }
    })();
  }, [router, navigation]);

  useEffect(() => {
    if (checkingSession) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setMessages(data as Message[]);
      setLoading(false);
    };
    fetchMessages();
  }, [checkingSession]);

  async function handleLogout() {
    await SecureStore.deleteItemAsync('session');
    router.replace('/login');
  }

  async function handleDelete(id: number) {
    Alert.alert(
      'Supprimer le message',
      'Tu es sûr de vouloir supprimer ce message ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            setDeletingId(id);
            const { error } = await supabase
              .from('messages')
              .delete()
              .eq('id', id);
            if (!error) setMessages(msgs => msgs.filter(m => m.id !== id));
            setDeletingId(null);
          }
        }
      ]
    );
  }

  if (checkingSession)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#18181C", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF8200" />
      </SafeAreaView>
    );

  if (loading)
    return <Text style={{ textAlign: "center", marginTop: 60, fontSize: 18, color: "#999" }}>Chargement…</Text>;

  if (!messages.length)
    return <Text style={{ textAlign: 'center', marginTop: 60, fontSize: 16, color: '#888' }}>
      Aucun message reçu…</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#101017" }}>
      <StatusBar barStyle="light-content" />
      {/* Logo Comets bien centré, espacé du top */}
      <View style={styles.logoBox}>
        <Image source={logoComets} style={styles.logo} resizeMode="contain" />
      </View>
      {/* Header : flèche + titre + logout */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router && router.canGoBack && router.canGoBack()) {
              router.back();
            } else if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }}
          style={{ marginRight: 14, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="chevron-back" size={28} color="#FF8200" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Messages reçus</Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}>
          <Text style={styles.logoutBtnText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {/* List & ScrollToTop */}
      <View style={{ flex: 1, backgroundColor: "#18181C", borderTopLeftRadius: 36, borderTopRightRadius: 36 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.msgCard}>
              {/* Nom/date */}
              <View style={styles.row}>
                <Text style={styles.nameText} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
              </View>
              {/* Email & phone */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => Linking.openURL(`mailto:${item.email}?subject=Réponse à votre message Comets Honfleur`)}
                style={styles.emailRow}
              >
                <Icon name="mail" size={18} color="#FF8200" style={{ marginRight: 6 }} />
                <Text style={styles.emailText}>{item.email}</Text>
                {item.phone && (
                  <>
                    <Icon name="call" size={16} color="#1976D2" style={{ marginHorizontal: 7 }} />
                    <Text style={styles.phoneText}>{item.phone}</Text>
                  </>
                )}
              </TouchableOpacity>
              {/* Message */}
              <View style={styles.msgBody}>
                <Text style={styles.messageText}>{item.message}</Text>
              </View>
              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 12, marginTop: 7 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`mailto:${item.email}?subject=Réponse à votre message Comets Honfleur`)}
                  style={styles.replyBtn}
                >
                  <Icon name="mail-outline" size={17} color="#fff" style={{ marginRight: 7 }} />
                  <Text style={styles.replyBtnText}>Répondre</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={deletingId === item.id}
                  onPress={() => handleDelete(item.id)}
                  style={[
                    styles.deleteBtn,
                    deletingId === item.id && { opacity: 0.7 }
                  ]}
                >
                  <Icon name="trash" size={17} color="#fff" style={{ marginRight: 7 }} />
                  <Text style={styles.deleteBtnText}>
                    {deletingId === item.id ? "Suppression..." : "Supprimer"}
                  </Text>
                </TouchableOpacity>
              </View>
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
  logoutBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 9,
    paddingHorizontal: 17,
    paddingVertical: 7,
    minWidth: 32,
    alignItems: 'center'
  },
  logoutBtnText: {
    color: "#fff",
    fontWeight: "600",
    letterSpacing: 0.5
  },
  msgCard: {
    backgroundColor: 'rgba(255,244,230,0.99)',
    borderRadius: 28,
    padding: 19,
    marginBottom: 19,
    shadowColor: '#FF8200',
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1.7,
    borderColor: "#FF8200",
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    gap: 7,
  },
  nameText: {
    fontWeight: '900',
    color: "#19141a",
    fontSize: 18,
    maxWidth: 175,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  dateText: {
    color: "#AAA",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    marginTop: 2,
    flexWrap: "wrap"
  },
  emailText: {
    color: "#FF8200",
    fontSize: 15,
    fontWeight: "bold",
    textDecorationLine: "underline",
    marginRight: 2,
  },
  phoneText: {
    color: "#1976D2",
    fontSize: 14,
    fontWeight: "700"
  },
  msgBody: {
    backgroundColor: '#fff8ee',
    borderRadius: 13,
    marginTop: 10,
    marginBottom: 5,
    padding: 12,
    shadowColor: '#f7b981',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    color: "#1A2636",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500"
  },
  replyBtn: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 15,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  replyBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15.3,
    letterSpacing: 0.3
  },
  deleteBtn: {
    backgroundColor: "#E53935",
    borderRadius: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 15,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  deleteBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15.3,
    letterSpacing: 0.3
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
