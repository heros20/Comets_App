"use client";

import { usePathname, useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/Ionicons";

import { useAdmin } from "../../contexts/AdminContext";

const logoComets = require("../../assets/images/iconComets.png");

type DrawerRoute =
  | "/"
  | "/matchs"
  | "/actus"
  | "/GalleryScreen"
  | "/CometsRunScreen"
  | "/classement"
  | "/joueurs"
  | "/profil"
  | "/login"
  | "/(tabs)/Register"
  | "/admin";

type DrawerItem = {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  route: DrawerRoute;
  tone: string;
};

type DrawerContextValue = {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue>({
  isOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
});

function normalizeRoute(input: string) {
  return input
    .replace(/^\/\(tabs\)/i, "")
    .replace(/^\/\(admin\)/i, "")
    .replace(/\/+$/, "") || "/";
}

export function AppDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = useCallback(() => setIsOpen(true), []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);
  const toggleDrawer = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({
      isOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [closeDrawer, isOpen, openDrawer, toggleDrawer],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useAppDrawer() {
  return useContext(DrawerContext);
}

export function DrawerMenuButton({
  style,
  iconColor = "#F3F4F6",
  iconSize = 22,
  activeOpacity = 0.9,
}: {
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  iconSize?: number;
  activeOpacity?: number;
}) {
  const { openDrawer } = useAppDrawer();

  return (
    <TouchableOpacity onPress={openDrawer} style={style} activeOpacity={activeOpacity}>
      <Icon name="menu" size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

export function GlobalAppDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isOpen, closeDrawer } = useAppDrawer();
  const { isAdmin, isMember, logout } = useAdmin();

  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      closeDrawer();
      previousPathRef.current = pathname;
    }
  }, [closeDrawer, pathname]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [isOpen, progress]);

  const isLoggedIn = isAdmin || isMember;
  const statusLabel = isAdmin ? "Admin" : isMember ? "Membre" : "Visiteur";

  const sections = useMemo(
    () => [
      {
        id: "feed",
        title: "À la une",
        items: [
          {
            id: "home",
            label: "Accueil",
            subtitle: "Le feed du club",
            icon: "home-outline",
            route: "/" as DrawerRoute,
            tone: "#FF8200",
          },
          {
            id: "news",
            label: "Actualités",
            subtitle: "Toutes les publications",
            icon: "newspaper-outline",
            route: "/actus" as DrawerRoute,
            tone: "#3B82F6",
          },
          {
            id: "matches",
            label: "Matchs",
            subtitle: "Calendrier et résultats",
            icon: "baseball-outline",
            route: "/matchs" as DrawerRoute,
            tone: "#F59E0B",
          },
          {
            id: "gallery",
            label: "Galerie",
            subtitle: "Photos et souvenirs",
            icon: "images-outline",
            route: "/GalleryScreen" as DrawerRoute,
            tone: "#8B5CF6",
          },
        ] satisfies DrawerItem[],
      },
      {
        id: "club",
        title: "Club",
        items: [
          {
            id: "standings",
            label: "Classement",
            subtitle: "Suivre la saison",
            icon: "trophy-outline",
            route: "/classement" as DrawerRoute,
            tone: "#10B981",
          },
          {
            id: "comets-run",
            label: "Comets Run",
            subtitle: "Mode arcade du club",
            icon: "game-controller-outline",
            route: "/CometsRunScreen" as DrawerRoute,
            tone: "#22D3EE",
          },
          {
            id: "players",
            label: "Joueurs",
            subtitle: "Effectif et categories",
            icon: "people-outline",
            route: "/joueurs" as DrawerRoute,
            tone: "#F97316",
          },
        ] satisfies DrawerItem[],
      },
      {
        id: "account",
        title: "Compte",
        items: isLoggedIn
          ? [
              {
                id: "profile",
                label: "Mon profil",
                subtitle: "Infos personnelles",
                icon: "person-circle-outline",
                route: "/profil" as DrawerRoute,
                tone: "#22C55E",
              },
            ]
          : [
              {
                id: "login",
                label: "Connexion",
                subtitle: "Accéder à l'espace membre",
                icon: "log-in-outline",
                route: "/login" as DrawerRoute,
                tone: "#38BDF8",
              },
              {
                id: "register",
                label: "Inscription",
                subtitle: "Créer un compte",
                icon: "person-add-outline",
                route: "/(tabs)/Register" as DrawerRoute,
                tone: "#22C55E",
              },
            ],
      },
      ...(isAdmin
        ? [
            {
              id: "admin",
              title: "Admin",
              items: [
                {
                  id: "admin-home",
                  label: "Panel admin",
                  subtitle: "Gestion du club",
                  icon: "construct-outline",
                  route: "/admin" as DrawerRoute,
                  tone: "#EAB308",
                },
              ] satisfies DrawerItem[],
            },
          ]
        : []),
    ],
    [isAdmin, isLoggedIn],
  );

  const panelTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-42, 0],
  });

  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const navigateTo = useCallback(
    (route: DrawerRoute) => {
      closeDrawer();
      requestAnimationFrame(() => {
        router.push(route as any);
      });
    },
    [closeDrawer, router],
  );

  const handleLogout = useCallback(async () => {
    closeDrawer();
    await logout();
    router.replace("/");
  }, [closeDrawer, logout, router]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={closeDrawer}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              transform: [{ translateX: panelTranslateX }],
            },
          ]}
        >
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={[
              styles.panelContent,
              {
                paddingTop: Math.max(insets.top, 14),
                paddingBottom: Math.max(insets.bottom, 18),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.panelHeader}>
              <View style={styles.brandRow}>
                <Image source={logoComets} style={styles.brandLogo} contentFit="cover" />
                <View style={styles.brandTextWrap}>
                  <Text style={styles.brandTitle}>Comets d&apos;Honfleur</Text>
                  <Text style={styles.brandSub}>Navigation rapide du club</Text>
                </View>
              </View>

              <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn} activeOpacity={0.9}>
                <Icon name="close" size={18} color="#E5E7EB" />
              </TouchableOpacity>
            </View>

            <View style={styles.statusCard}>
              <View>
                <Text style={styles.statusLabel}>Session</Text>
                <Text style={styles.statusValue}>{statusLabel}</Text>
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusBadgeTxt}>{normalizeRoute(pathname)}</Text>
              </View>
            </View>

            {sections.map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map((item) => {
                  const active = normalizeRoute(pathname).toLowerCase() === normalizeRoute(item.route).toLowerCase();

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.linkCard,
                        active && styles.linkCardActive,
                        { borderColor: `${item.tone}${active ? "88" : "44"}` },
                      ]}
                      activeOpacity={0.9}
                      onPress={() => navigateTo(item.route)}
                    >
                      <View style={[styles.linkIcon, { backgroundColor: `${item.tone}20` }]}>
                        <Icon name={item.icon as any} size={18} color={item.tone} />
                      </View>

                      <View style={styles.linkTextWrap}>
                        <Text style={styles.linkLabel}>{item.label}</Text>
                        <Text style={styles.linkSub}>{item.subtitle}</Text>
                      </View>

                      <Icon name="chevron-forward" size={18} color="#AAB2C2" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <View style={styles.footerBlock}>
              {isLoggedIn ? (
                <TouchableOpacity
                  style={[styles.footerBtn, styles.footerBtnDanger]}
                  activeOpacity={0.9}
                  onPress={handleLogout}
                >
                  <Icon name="log-out-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.footerBtnDangerTxt}>Déconnexion</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.footerBtn, styles.footerBtnPrimary]}
                  activeOpacity={0.9}
                  onPress={() => navigateTo("/login")}
                >
                  <Icon name="log-in-outline" size={16} color="#111827" />
                  <Text style={styles.footerBtnPrimaryTxt}>Se connecter</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-start",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,10,18,0.62)",
  },
  panel: {
    width: "84%",
    maxWidth: 380,
    minHeight: "100%",
    backgroundColor: "#0D1421",
    borderRightWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  brandLogo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#FF8200",
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTitle: {
    color: "#F9FAFB",
    fontSize: 16.5,
    fontWeight: "900",
  },
  brandSub: {
    marginTop: 2,
    color: "#AAB2C2",
    fontSize: 12.2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.22)",
    backgroundColor: "#121B2B",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusLabel: {
    color: "#8FA2BE",
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
  },
  statusValue: {
    marginTop: 4,
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "900",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  statusBadgeTxt: {
    color: "#D4DBE5",
    fontSize: 11,
    fontWeight: "800",
  },
  sectionBlock: {
    marginTop: 18,
  },
  sectionTitle: {
    color: "#E5E7EB",
    fontSize: 12.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  linkCard: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#121B2B",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  linkCardActive: {
    backgroundColor: "#182438",
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTextWrap: {
    flex: 1,
  },
  linkLabel: {
    color: "#F8FAFC",
    fontSize: 14.5,
    fontWeight: "900",
  },
  linkSub: {
    marginTop: 2,
    color: "#9CA9BC",
    fontSize: 12.2,
    lineHeight: 17,
  },
  footerBlock: {
    marginTop: "auto",
    paddingTop: 8,
  },
  footerBtn: {
    minHeight: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
  },
  footerBtnPrimary: {
    backgroundColor: "#F9FAFB",
    borderColor: "#FFFFFF",
  },
  footerBtnDanger: {
    backgroundColor: "#B91C1C",
    borderColor: "#DC2626",
  },
  footerBtnPrimaryTxt: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13.5,
  },
  footerBtnDangerTxt: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13.5,
  },
});
