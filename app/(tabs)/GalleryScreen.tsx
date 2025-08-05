import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
const logoComets = require("../../assets/images/iconComets.png");

const GALLERY_API = "https://les-comets-honfleur.vercel.app/api/gallery";

export default function GalleryScreen() {
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImgIdx, setModalImgIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    fetch(GALLERY_API)
      .then(res => res.json())
      .then(data => setGallery(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const windowWidth = Dimensions.get("window").width;
  const colCount = windowWidth > 600 ? 3 : 2;
  const imgWidth = (windowWidth - 48 - (colCount - 1) * 10) / colCount;

  if (loading) {
    return (
      <SafeAreaView style={styles.bgWrapper}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#FF8200" />
          <Text style={{ color: "#FF8200", fontWeight: "bold", marginTop: 22 }}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!gallery.length) {
    return (
      <SafeAreaView style={styles.bgWrapper}>
        <StatusBar barStyle="light-content" />
        {/* Header */}
        <Header navigation={navigation} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#aaa", fontSize: 20, fontWeight: "bold", marginTop: 30 }}>
            Aucune image n’a encore été publiée.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const visibleImages = showAll ? gallery : gallery.slice(0, 8);

  // PATCH : composant header stylé réutilisable
  function Header({ navigation }: { navigation: any }) {
    return (
      <>
      <View style={styles.logoBox}>
          <Image source={logoComets} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="chevron-back" size={28} color="#FF8200" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Galerie</Text>
          <View style={{ width: 32 }} />
        </View>
        
      </>
    );
  }

  // PATCH : swipe entre les images dans la modal
  function ModalImageGallery() {
    if (modalImgIdx === null) return null;
    const img = gallery[modalImgIdx];
    if (!img) return null;
    return (
      <Modal
        visible={true}
        transparent
        animationType="fade"
        onRequestClose={() => setModalImgIdx(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setModalImgIdx(null)} />
          <View style={styles.modalContent}>
            <Image
              source={{ uri: img.url }}
              style={styles.modalImg}
              resizeMode="contain"
            />
            {img.legend ? (
              <Text style={styles.modalLegend}>{img.legend}</Text>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalImgIdx(null)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            {/* Flèches navigation */}
            {modalImgIdx > 0 && (
              <TouchableOpacity
                style={[styles.navArrow, { left: 10 }]}
                onPress={() => setModalImgIdx(idx => (idx! > 0 ? idx! - 1 : idx))}
              >
                <Icon name="chevron-back" size={32} color="#FF8200" />
              </TouchableOpacity>
            )}
            {modalImgIdx < gallery.length - 1 && (
              <TouchableOpacity
                style={[styles.navArrow, { right: 10 }]}
                onPress={() => setModalImgIdx(idx => (idx! < gallery.length - 1 ? idx! + 1 : idx))}
              >
                <Icon name="chevron-forward" size={32} color="#FF8200" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <SafeAreaView style={styles.bgWrapper}>
      <StatusBar barStyle="light-content" />
      <Header navigation={navigation} />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Intro */}
        <Text style={styles.intro}>
          Plonge dans la galerie officielle des Comets :{"\n"}
          matchs, moments forts, souvenirs…{"\n"}
          L’âme du baseball normand, capturée en images.
        </Text>

        {/* Grille Images */}
        <View style={[styles.grid, { gap: 10 }]}>
          {visibleImages.map((img, i) => (
            <TouchableOpacity
              key={img.id || i}
              style={[styles.imgCard, { width: imgWidth, height: imgWidth * 1.13 }]}
              activeOpacity={0.88}
              onPress={() => setModalImgIdx(showAll ? i : i)}
              onLongPress={() => setModalImgIdx(showAll ? i : i)}
            >
              <Image
                source={{ uri: img.url }}
                style={styles.img}
                resizeMode="cover"
              />
              {img.legend ? (
                <View style={styles.legendBox}>
                  <Text style={styles.legend}>{img.legend}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Voir plus/moins */}
        {gallery.length > 8 && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => setShowAll((v) => !v)}
          >
            <Text style={styles.moreBtnText}>{showAll ? "Voir moins" : "Voir plus"}</Text>
          </TouchableOpacity>
        )}

        <ModalImageGallery />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bgWrapper: {
    flex: 1,
    backgroundColor: "#18181C",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181C",
    borderBottomColor: "#FF8200",
    borderBottomWidth: 1.2,
    paddingTop: Platform.OS === "ios" ? 15 : 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    marginBottom: 0,
  },
  backBtn: {
    padding: 4,
    borderRadius: 30,
    marginRight: 10,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 23,
    fontWeight: "bold",
    color: "#FF8200",
    textAlign: "center",
    letterSpacing: 1.2,
  },
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 16,
    backgroundColor: "#18181C",
    borderRadius: 26,
    padding: 8,
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 2,
  },
  container: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 12,
    minHeight: Dimensions.get("window").height - 60,
  },
  intro: {
    color: "#FFE2C1",
    backgroundColor: "#292E3A",
    borderRadius: 16,
    padding: 16,
    textAlign: "center",
    fontSize: 16.5,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 6,
    lineHeight: 23,
    shadowColor: "#FF8200",
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 1,
    width: "100%",
    maxWidth: 500,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 15,
    width: "100%",
    minHeight: 80,
  },
  imgCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#FF8200",
    shadowColor: "#FF8200",
    shadowOpacity: 0.10,
    shadowRadius: 7,
    elevation: 2,
    position: "relative",
  },
  img: {
    width: "100%",
    height: "100%",
  },
  legendBox: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,130,0,0.84)",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  legend: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    textAlign: "center",
    textShadowColor: "#1a1926",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  moreBtn: {
    backgroundColor: "#FF8200",
    borderRadius: 21,
    paddingVertical: 14,
    paddingHorizontal: 44,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#FF8200",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  moreBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17.5,
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22, 22, 32, 0.97)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBg: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 30,
    position: "relative",
    width: "100%",
    height: "100%",
  },
  modalImg: {
    width: Dimensions.get("window").width - 40,
    height: Dimensions.get("window").height * 0.58,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  modalLegend: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
    marginTop: 6,
    textShadowColor: "#FF8200",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  closeBtn: {
    position: "absolute",
    top: 15,
    right: 18,
    backgroundColor: "#18181C",
    borderRadius: 19,
    padding: 9,
    zIndex: 4,
    borderWidth: 1.5,
    borderColor: "#FF8200",
  },
  closeBtnText: {
    color: "#FF8200",
    fontWeight: "bold",
    fontSize: 23,
    textAlign: "center",
  },
  navArrow: {
    position: "absolute",
    top: "45%",
    padding: 12,
    backgroundColor: "#23222bAA",
    borderRadius: 23,
    zIndex: 10,
  },
});
