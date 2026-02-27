"use client";

import { useLocalSearchParams } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { DrawerMenuButton } from "../../components/navigation/AppDrawer";
import { sortGalleryNewest } from "../../lib/gallerySort";

const GALLERY_API = "https://les-comets-honfleur.vercel.app/api/gallery";
const INITIAL_BATCH = 18;
const LOAD_STEP = 18;

type GalleryItem = {
  id?: number | string;
  url: string;
  legend?: string | null;
  created_at?: string | null;
};

type GalleryTileProps = {
  item: GalleryItem;
  index: number;
  width: number;
  height: number;
  marginRight: number;
  onOpen: (index: number) => void;
};

const GalleryTile = React.memo(function GalleryTile({
  item,
  index,
  width,
  height,
  marginRight,
  onOpen,
}: GalleryTileProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
  }, [item.url]);

  return (
    <TouchableOpacity
      style={[styles.tile, { width, height, marginRight }]}
      activeOpacity={0.9}
      onPress={() => onOpen(index)}
      onLongPress={() => onOpen(index)}
    >
      <ExpoImage
        source={{ uri: item.url, cacheKey: String(item.id ?? item.url) }}
        recyclingKey={String(item.id ?? item.url)}
        cachePolicy="memory-disk"
        priority={index < 8 ? "high" : "normal"}
        transition={180}
        contentFit="cover"
        style={styles.tileImage}
        onLoad={() => setIsReady(true)}
        onError={() => setIsReady(true)}
      />

      {!isReady && (
        <View style={styles.tileLoader}>
          <ActivityIndicator size="small" color="#FF9E3A" />
        </View>
      )}

      {!!item.legend && (
        <View style={styles.legendBar}>
          <Text style={styles.legendText} numberOfLines={2}>
            {item.legend}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

function formatDateLabel(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function GalleryScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ photoId?: string | string[] }>();
  const rawPhotoId = Array.isArray(params.photoId) ? params.photoId[0] : params.photoId;
  const targetPhotoId = rawPhotoId ? String(rawPhotoId) : "";

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlowLoading, setShowSlowLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);

  const [modalIdx, setModalIdx] = useState<number | null>(null);
  const pagerRef = useRef<ScrollView>(null);
  const focusedPhotoIdRef = useRef<string | null>(null);

  const colCount = windowWidth >= 900 ? 4 : windowWidth >= 640 ? 3 : 2;
  const gap = 10;
  const horizontalPadding = 24;
  const tileW = useMemo(() => {
    return Math.floor((windowWidth - horizontalPadding - gap * (colCount - 1)) / colCount);
  }, [windowWidth, colCount]);
  const tileH = Math.round(tileW * 1.14);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const loadGallery = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(GALLERY_API, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;

        const rows = Array.isArray(data) ? sortGalleryNewest(data as GalleryItem[]) : [];
        setGallery(rows);
        setVisibleCount(Math.min(INITIAL_BATCH, rows.length || INITIAL_BATCH));
      } catch (e: any) {
        if (!mounted || e?.name === "AbortError") return;
        setGallery([]);
        setErrorMsg("Impossible de charger la galerie.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadGallery();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    if (!gallery.length) return;
    const seed = gallery
      .slice(0, Math.min(gallery.length, 20))
      .map((item) => item.url)
      .filter((url) => typeof url === "string" && !!url);
    if (!seed.length) return;
    ExpoImage.prefetch(seed, "memory-disk").catch(() => {});
  }, [gallery]);

  useEffect(() => {
    if (!gallery.length) return;
    const start = Math.max(0, visibleCount - 4);
    const around = gallery
      .slice(start, start + 16)
      .map((item) => item.url)
      .filter((url) => typeof url === "string" && !!url);
    if (!around.length) return;
    ExpoImage.prefetch(around, "memory-disk").catch(() => {});
  }, [gallery, visibleCount]);

  useEffect(() => {
    if (modalIdx === null || !gallery.length) return;
    const near = gallery
      .slice(Math.max(0, modalIdx - 1), modalIdx + 3)
      .map((item) => item.url)
      .filter((url) => typeof url === "string" && !!url);
    if (!near.length) return;
    ExpoImage.prefetch(near, "memory-disk").catch(() => {});
  }, [gallery, modalIdx]);

  useEffect(() => {
    if (modalIdx === null) return;
    const id = setTimeout(() => {
      pagerRef.current?.scrollTo({ x: modalIdx * windowWidth, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [windowWidth, modalIdx]);

  useEffect(() => {
    if (!loading) {
      setShowSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowLoading(true), 650);
    return () => clearTimeout(timer);
  }, [loading]);

  const visible = useMemo(() => gallery.slice(0, visibleCount), [gallery, visibleCount]);
  const canLoadMore = visible.length < gallery.length;
  const latestLabel = formatDateLabel(gallery[0]?.created_at);
  const loadingPlaceholderCount = useMemo(() => Math.max(colCount * 3, 6), [colCount]);
  const loadingPlaceholders = useMemo(
    () => Array.from({ length: loadingPlaceholderCount }, (_, i) => i),
    [loadingPlaceholderCount]
  );

  const openModalAt = useCallback(
    (index: number) => {
      setModalIdx(index);
      setTimeout(() => {
        pagerRef.current?.scrollTo({ x: index * windowWidth, animated: false });
      }, 10);
    },
    [windowWidth]
  );

  useEffect(() => {
    if (!targetPhotoId || !gallery.length) return;
    if (focusedPhotoIdRef.current === targetPhotoId) return;

    const photoIndex = gallery.findIndex((item) => String(item.id ?? "") === targetPhotoId);
    if (photoIndex < 0) return;

    focusedPhotoIdRef.current = targetPhotoId;
    openModalAt(photoIndex);
  }, [gallery, openModalAt, targetPhotoId]);

  useEffect(() => {
    if (targetPhotoId) return;
    focusedPhotoIdRef.current = null;
  }, [targetPhotoId]);

  const closeModal = useCallback(() => setModalIdx(null), []);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
      setModalIdx(page);
    },
    [windowWidth]
  );

  const goPrev = useCallback(() => {
    if (modalIdx === null) return;
    const next = Math.max(0, modalIdx - 1);
    pagerRef.current?.scrollTo({ x: next * windowWidth, animated: true });
    setModalIdx(next);
  }, [modalIdx, windowWidth]);

  const goNext = useCallback(() => {
    if (modalIdx === null) return;
    const next = Math.min(gallery.length - 1, modalIdx + 1);
    pagerRef.current?.scrollTo({ x: next * windowWidth, animated: true });
    setModalIdx(next);
  }, [gallery.length, modalIdx, windowWidth]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + LOAD_STEP, gallery.length));
  }, [gallery.length]);

  const keyExtractor = useCallback(
    (item: GalleryItem, index: number) => String(item.id ?? `${item.url}-${index}`),
    []
  );

  const renderItem = useCallback(
    ({ item, index }: { item: GalleryItem; index: number }) => {
      const marginRight = (index + 1) % colCount === 0 ? 0 : gap;
      return (
        <GalleryTile
          item={item}
          index={index}
          width={tileW}
          height={tileH}
          marginRight={marginRight}
          onOpen={openModalAt}
        />
      );
    },
    [colCount, gap, openModalAt, tileH, tileW]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrap}>
        <LinearGradient
          colors={["#17263D", "#101A2A", "#0B101A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroGradient,
            { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 10 },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.24)", "rgba(255,130,0,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroShine}
          />

          <View style={styles.heroTopRow}>
            <DrawerMenuButton style={styles.backBtn} />

            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroTitle}>Galerie Comets</Text>
              <Text style={styles.heroSub}>Moments du club en images</Text>
            </View>

            <View style={styles.heroCountPill}>
              <Icon name="images-outline" size={13} color="#FFDDBA" />
              <Text style={styles.heroCountText}>{gallery.length}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Icon name="sparkles-outline" size={14} color="#FFB366" />
              <Text style={styles.metaText}>Recente: {latestLabel}</Text>
            </View>
            <View style={styles.metaPill}>
              <Icon name="grid-outline" size={14} color="#FFB366" />
              <Text style={styles.metaText}>
                Affichees: {Math.min(visible.length, gallery.length)}/{gallery.length}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {loading && showSlowLoading ? (
        <View style={styles.loadingWrap}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#FF9E3A" />
            <Text style={styles.loadingText}>Chargement de la galerie...</Text>
          </View>

          <View style={styles.placeholderGrid}>
            {loadingPlaceholders.map((idx) => {
              const marginRight = (idx + 1) % colCount === 0 ? 0 : gap;
              return (
                <View key={`ph-${idx}`} style={[styles.placeholderTile, { width: tileW, height: tileH, marginRight }]}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0.08)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : loading ? (
        <View style={styles.loadingBuffer} />
      ) : !gallery.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Aucune image publiee</Text>
          <Text style={styles.emptyText}>
            Ajoute des photos depuis la section admin pour alimenter la galerie.
          </Text>
          {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </View>
      ) : (
        <FlatList
          key={`gallery-${colCount}`}
          data={visible}
          numColumns={colCount}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {!!errorMsg && (
                <View style={styles.warningCard}>
                  <Icon name="alert-circle-outline" size={16} color="#F59E0B" />
                  <Text style={styles.warningText}>{errorMsg}</Text>
                </View>
              )}
              <View style={styles.introCard}>
                <Text style={styles.introTitle}>Dernieres photos</Text>
                <Text style={styles.introText}>
                  Tape une image pour ouvrir le mode plein ecran et faire defiler la galerie.
                </Text>
              </View>
            </View>
          }
          ListFooterComponent={
            canLoadMore ? (
              <TouchableOpacity style={styles.moreBtn} onPress={loadMore} activeOpacity={0.9}>
                <Text style={styles.moreBtnText}>Charger plus</Text>
                <Icon name="add-outline" size={18} color="#111827" />
              </TouchableOpacity>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={9}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}

      <Modal visible={modalIdx !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />

          <View style={styles.modalShell}>
            <TouchableOpacity style={styles.closeBtn} onPress={closeModal} activeOpacity={0.9}>
              <Icon name="close" size={22} color="#FF9E3A" />
            </TouchableOpacity>

            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onMomentumEnd}
              contentOffset={{ x: Math.max(0, (modalIdx ?? 0) * windowWidth), y: 0 }}
              scrollEventThrottle={16}
            >
              {gallery.map((item, idx) => {
                const shouldRenderImage = modalIdx === null || Math.abs(idx - modalIdx) <= 1;
                const imageWidth = windowWidth * 0.92;
                const imageHeight = windowHeight * 0.62;

                return (
                  <View key={String(item.id ?? idx)} style={[styles.modalPage, { width: windowWidth }]}>
                    {shouldRenderImage ? (
                      <ExpoImage
                        source={{ uri: item.url, cacheKey: String(item.id ?? item.url) }}
                        recyclingKey={`modal-${String(item.id ?? item.url)}`}
                        cachePolicy="memory-disk"
                        priority="high"
                        transition={140}
                        contentFit="contain"
                        style={[styles.modalImage, { width: imageWidth, height: imageHeight }]}
                      />
                    ) : (
                      <View style={[styles.modalImagePlaceholder, { width: imageWidth, height: imageHeight }]}>
                        <ActivityIndicator size="small" color="#FF9E3A" />
                      </View>
                    )}

                    {!!item.legend && (
                      <Text style={styles.modalLegend} numberOfLines={3}>
                        {item.legend}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {modalIdx !== null && modalIdx > 0 && (
              <TouchableOpacity
                style={[styles.navArrow, styles.navArrowLeft]}
                onPress={goPrev}
                activeOpacity={0.9}
              >
                <Icon name="chevron-back" size={30} color="#FFB366" />
              </TouchableOpacity>
            )}

            {modalIdx !== null && modalIdx < gallery.length - 1 && (
              <TouchableOpacity
                style={[styles.navArrow, styles.navArrowRight]}
                onPress={goNext}
                activeOpacity={0.9}
              >
                <Icon name="chevron-forward" size={30} color="#FFB366" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },

  heroWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "#0E1524",
  },
  heroGradient: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  heroShine: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: "58%",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "800",
  },
  heroSub: {
    marginTop: 1,
    color: "#BEC8DB",
    fontSize: 12,
  },
  heroCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroCountText: {
    color: "#FFDDBA",
    fontWeight: "700",
    fontSize: 11.5,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  metaPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  metaText: {
    color: "#E5E7EB",
    fontSize: 11.5,
    fontWeight: "700",
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 20,
  },
  loadingWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 20,
  },
  loadingBuffer: {
    flex: 1,
  },
  loadingCard: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.3)",
    backgroundColor: "rgba(12,18,30,0.84)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#FFDDBA",
    fontSize: 12.8,
    fontWeight: "700",
  },
  placeholderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  placeholderTile: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.18)",
    backgroundColor: "#111827",
  },
  listHeader: {
    marginBottom: 10,
  },
  warningCard: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 12.5,
    lineHeight: 18,
  },
  introCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(12,18,30,0.82)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  introTitle: {
    color: "#F3F4F6",
    fontSize: 14.5,
    fontWeight: "800",
  },
  introText: {
    marginTop: 3,
    color: "#AAB2C2",
    fontSize: 12.5,
    lineHeight: 18,
  },

  tile: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.24)",
    backgroundColor: "#111827",
    position: "relative",
  },
  tileImage: {
    ...StyleSheet.absoluteFillObject,
  },
  tileLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9,13,20,0.55)",
  },
  legendBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,130,0,0.2)",
    backgroundColor: "rgba(10,14,22,0.74)",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  legendText: {
    color: "#E5E7EB",
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  moreBtn: {
    alignSelf: "center",
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#FF9E3A",
    borderWidth: 1,
    borderColor: "#FFBD80",
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  moreBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  footerSpacer: {
    height: 20,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#F3F4F6",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    color: "#AAB2C2",
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    marginTop: 10,
    color: "#FCA5A5",
    fontSize: 12.5,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(8,10,14,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalShell: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1A2334",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modalPage: {
    alignItems: "center",
    justifyContent: "center",
  },
  modalImage: {
    borderRadius: 14,
    backgroundColor: "#0E1524",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
  },
  modalImagePlaceholder: {
    borderRadius: 14,
    backgroundColor: "#0E1524",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalLegend: {
    marginTop: 10,
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 22,
    lineHeight: 19,
  },
  navArrow: {
    position: "absolute",
    top: "45%",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(18,26,40,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  navArrowLeft: {
    left: 12,
  },
  navArrowRight: {
    right: 12,
  },
});
