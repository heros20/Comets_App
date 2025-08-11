// app/screens/GalleryScreen.tsx
"use client";

import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
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

type GalleryItem = {
  id?: number | string;
  url: string;
  legend?: string | null;
  created_at?: string;
};

export default function GalleryScreen() {
  const navigation = useNavigation();
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Voir plus / pagination simple
  const [showAll, setShowAll] = useState(false);

  // Modal & swipe
  const [modalIdx, setModalIdx] = useState<number | null>(null);
  const pagerRef = useRef<ScrollView>(null);

  // Grille responsive
  const window = Dimensions.get("window");
  const colCount = window.width >= 680 ? 3 : 2;
  const gap = 10;
  const horizontalPadding = 12 * 2; // listContainer paddingHorizontal = 12
  const cardW = useMemo(
    () => (window.width - horizontalPadding - gap * (colCount - 1)) / colCount,
    [window.width, colCount]
  );
  const cardH = Math.round(cardW * 1.15);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(GALLERY_API);
        const data = await r.json();
        setGallery(Array.isArray(data) ? data : []);
      } catch (e) {
        setGallery([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Liste visible
  const visible = showAll ? gallery : gallery.slice(0, 12);

  // Helpers modal
  const openModalAt = (idx: number) => {
    setModalIdx(idx);
    // léger délai pour laisser le Modal s'ouvrir avant le scroll initial
    setTimeout(() => {
      pagerRef.current?.scrollTo({ x: idx * window.width, animated: false });
    }, 10);
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / window.width);
    setModalIdx(page);
  };
  const goPrev = () => {
    if (modalIdx === null) return;
    const next = Math.max(0, modalIdx - 1);
    pagerRef.current?.scrollTo({ x: next * window.width, animated: true });
    setModalIdx(next);
  };
  const goNext = () => {
    if (modalIdx === null) return;
    const next = Math.min(gallery.length - 1, modalIdx + 1);
    pagerRef.current?.scrollTo({ x: next * window.width, animated: true });
    setModalIdx(next);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f1014", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FF8200" />
        <Text style={{ color: "#FF8200", marginTop: 16, fontWeight: "bold" }}>Chargement…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1014" }}>
      <StatusBar barStyle="light-content" />

      {/* HERO (mêmes codes que ActusScreen) */}
      <View
        style={[
          styles.hero,
          { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 },
        ]}
      >
        <View style={styles.heroStripe} />

        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() =>
              // @ts-ignore
              (navigation as any).canGoBack()
                ? // @ts-ignore
                  (navigation as any).goBack()
                : // @ts-ignore
                  (navigation as any).navigate("Home")
            }
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="chevron-back" size={24} color="#FF8200" />
          </TouchableOpacity>

          <Text style={styles.heroTitle}>Galerie des Comets</Text>

          {/* espace symétrique */}
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.heroProfileRow}>
          <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>Moments forts & souvenirs</Text>
            <Text style={styles.heroSub}>Matchs, entraînements, vie du club — en images</Text>
          </View>
        </View>
      </View>

      {/* CONTENU */}
      {!gallery.length ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <Text style={{ color: "#9aa0ae", fontSize: 16, textAlign: "center" }}>
            Aucune image n’a encore été publiée.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {/* Intro card (glass) */}
          <View style={styles.introCard}>
            <Text style={styles.introTxt}>
              Plonge dans la galerie officielle des Comets : moments clés, sourires d’équipe,
              et l’âme du baseball normand capturée en images.
            </Text>
          </View>

          {/* Grille */}
          <View style={[styles.grid, { gap }]}>
            {visible.map((img, i) => (
              <TouchableOpacity
                key={(img.id ?? i).toString()}
                style={[styles.card, { width: cardW, height: cardH }]}
                activeOpacity={0.92}
                onPress={() => openModalAt(showAll ? i : i)}
                onLongPress={() => openModalAt(showAll ? i : i)}
              >
                <Image source={{ uri: img.url }} style={styles.cardImg} />
                {!!img.legend && (
                  <View style={styles.legendBar}>
                    <Text style={styles.legendTxt} numberOfLines={2}>
                      {img.legend}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Voir plus */}
          {gallery.length > 12 && (
            <TouchableOpacity style={styles.moreBtn} onPress={() => setShowAll((v) => !v)} activeOpacity={0.9}>
              <Text style={styles.moreBtnTxt}>{showAll ? "Voir moins" : "Voir plus"}</Text>
              <Icon
                name={showAll ? "chevron-up" : "chevron-down"}
                size={18}
                color="#fff"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* MODAL SWIPE VIEWER */}
      <Modal
        visible={modalIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalIdx(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setModalIdx(null)} />
          <View style={styles.modalShell}>
            {/* Close */}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalIdx(null)} activeOpacity={0.9}>
              <Icon name="close" size={22} color="#FF8200" />
            </TouchableOpacity>

            {/* Pager */}
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onMomentumEnd}
              contentOffset={{ x: Math.max(0, (modalIdx ?? 0) * window.width), y: 0 }}
            >
              {gallery.map((img, idx) => (
                <View key={(img.id ?? idx).toString()} style={{ width: window.width, alignItems: "center" }}>
                  <Image
                    source={{ uri: img.url }}
                    style={[styles.modalImg, { width: window.width * 0.92, height: window.height * 0.6 }]}
                    resizeMode="contain"
                  />
                  {!!img.legend && <Text style={styles.modalLegend}>{img.legend}</Text>}
                </View>
              ))}
            </ScrollView>

            {/* Arrows */}
            {modalIdx !== null && modalIdx > 0 && (
              <TouchableOpacity style={[styles.navArrow, { left: 12 }]} onPress={goPrev} activeOpacity={0.9}>
                <Icon name="chevron-back" size={34} color="#FF8200" />
              </TouchableOpacity>
            )}
            {modalIdx !== null && modalIdx < gallery.length - 1 && (
              <TouchableOpacity style={[styles.navArrow, { right: 12 }]} onPress={goNext} activeOpacity={0.9}>
                <Icon name="chevron-forward" size={34} color="#FF8200" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // === HERO (identiques au style Actus) ===
  hero: {
    backgroundColor: "#11131a",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2230",
    paddingBottom: 10,
  },
  heroStripe: {
    position: "absolute",
    right: -60,
    top: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,130,0,0.10)",
    transform: [{ rotate: "18deg" }],
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1b1e27",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a2f3d",
  },
  heroTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FF8200",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  heroProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },

  // === LISTE / INTRO ===
  listContainer: { paddingHorizontal: 12, paddingBottom: 34, paddingTop: 12 },
  introCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    padding: 14,
    marginBottom: 12,
  },
  introTxt: { color: "#cfd3db", fontSize: 14.5, lineHeight: 20, textAlign: "center" },

  // === GRID ===
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  // Card image (glass + bord orange soft)
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    position: "relative",
  },
  cardImg: { width: "100%", height: "100%", backgroundColor: "#141821" },

  legendBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(15,16,20,0.72)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,130,0,0.22)",
  },
  legendTxt: { color: "#eaeef7", fontWeight: "700", fontSize: 12.5, textAlign: "center" },

  // Voir plus
  moreBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8200",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 6,
  },
  moreBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },

  // === MODAL ===
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(12,12,18,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBg: { ...StyleSheet.absoluteFillObject },
  modalShell: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 22,
  },
  modalImg: {
    borderRadius: 16,
    backgroundColor: "#0f1014",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },
  modalLegend: {
    marginTop: 10,
    color: "#eaeef7",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 18,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 16,
    backgroundColor: "#1b1e27",
    borderWidth: 1,
    borderColor: "#2a2f3d",
    borderRadius: 18,
    padding: 8,
    zIndex: 10,
  },
  navArrow: {
    position: "absolute",
    top: "45%",
    backgroundColor: "rgba(35,34,43,0.72)",
    borderRadius: 24,
    padding: 10,
  },
});
