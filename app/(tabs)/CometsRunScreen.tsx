// app/screens/CometsRunnerScreen.tsx
"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as NavigationBar from "expo-navigation-bar";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
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

import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

const PRIMARY_API =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? "http://10.0.2.2:3000" : "https://les-comets-honfleur.vercel.app");
const FALLBACK_API = "https://les-comets-honfleur.vercel.app";
const COMETS_RUN_OVERTAKE_PATH = "/api/notifications/comets-run-overtake";
const PUSH_COMETS_RUN_SECRET = process.env.EXPO_PUBLIC_PUSH_COMETS_RUN_SECRET || "";

const HOME_UI = {
  bg: "#0B0F17",
  panel: "#131B2A",
  panelSoft: "#151E2F",
  panelAlt: "#141D2C",
  text: "#F3F4F6",
  muted: "#AAB2C2",
  accent: "#FF8200",
  accentSoft: "#FFAA58",
} as const;

const { width: W0, height: H0 } = Dimensions.get("window");
const SCREEN_W = Math.max(W0, H0);
const SCREEN_H_INIT = Math.max(W0, H0);

// Décalages de fond
const BG_Y_OFFSET = -60;
const BG_Y_OFFSET_PREVIEW = -60;

// Features
const ENABLE_COLLECTIBLES = true;
const ENABLE_SHIELD = true;
const ENABLE_DOUBLEJUMP = true;
const ENABLE_PLATFORMS = true;
const ENABLE_HAPTICS_DEFAULT = true;

// Gameplay
const makeDims = (H: number) => ({ GROUND_Y: Math.floor(H * 0.90) });
const { GROUND_Y: GROUND_Y_INIT } = makeDims(SCREEN_H_INIT);

const PLAYER_SIZE = 52;
const PLAYER_RADIUS = PLAYER_SIZE / 2;

const GRAVITY_BASE = 2400;
const JUMP_VELOCITY = -920;
const AIR_JUMP_FACTOR = 0.94;
const HOLD_GRAVITY_SCALE = 0.72;
const JUMP_CUT_MULT = 0.45;

const START_SPEED = 290;
const SPEED_GAIN_PER_SEC_BASE = 14;
const SPEED_SMOOTHING = 10;

const OBSTACLE_MIN_GAP_BASE = 480;
const OBSTACLE_MAX_GAP_BASE = 820;
const OBSTACLE_MIN_W = 26;
const OBSTACLE_MAX_W = 50;
const OBSTACLE_BASE_H = 58;
const OBSTACLE_PATTERN_MIN_SCORE = 1800;

const PLATFORM_H = 16;
const PLATFORM_MIN_W = 150;
const PLATFORM_MAX_W = 230;
const PLATFORM_MAX_OFFSCREEN = 40;
const PLATFORM_PATTERN_COOLDOWN_MIN = 720;
const PLATFORM_PATTERN_COOLDOWN_MAX = 1120;
const PLATFORM_GATE_COIN_COUNT = 7;

const COYOTE_TIME = 0.14;
const JUMP_BUFFER = 0.14;
const MAX_SPAWN_ATTEMPTS = 8;

const STRIPE_W = 22;
const STRIPE_H = 6;
const FENCE_SPEED = 0.8;
const BG_SPEED = 0.1;

const MULT_MIN = 1.0;
const MULT_MAX = 3.0;
const MULT_SCALE = 260;

// Storage keys
const KEY_BEST = "COMETS_RUNNER_BEST";
const KEY_SETTINGS = "COMETS_RUNNER_SETTINGS";
const KEY_ACH = "COMETS_RUNNER_ACHIEVEMENTS";
const KEY_COMETS_PROGRESS = "COMETS_RUNNER_COMETS_PROGRESS"; // persistance C-O-M-E-T-S
const KEY_PAUSE_SNAPSHOT = "COMETS_RUNNER_PAUSE_SNAPSHOT";
const KEY_DAILY_MISSIONS = "COMETS_RUNNER_DAILY_MISSIONS";


const DOUBLEJUMP_DURATION = 10_000;
const INVINCIBLE_DURATION = 900; // post-choc court

// Rayon collectibles (coins / powerups)
const R_COLLECTIBLE = 14;
const R_POWERUP = 16;
const R_X2 = 18;

// 💥 Lettre : plus grande pour la prise — nouveau
const R_LETTER = 24;

// Durée multiplicateur (purple coin)
const SCORE_MULT_DURATION = 10_000;

// --- HUD anti-spam (toasts)
const TOAST_MIN_INTERVAL_MS = 900;

// Super shield
const SUPER_SHIELD_STACK = 3;
const SUPER_SHIELD_INVINCIBLE_MS = 3000;
const SUPER_SHIELD_GROUND_COINS = 5;
const SUPER_SHIELD_COIN_SCALE = 1.6; // pièces plus grosses

// Purple combo
const PURPLE_CHAIN_GOAL = 10;
const PURPLE_CHAIN_AIR_COINS = 10;

// COMETS (ordre strict)
const LETTERS = ["C","O","M","E","T","S"] as const;
type CometsLetter = typeof LETTERS[number];

// PALMIERS SCORE (une lettre tous les 10k entre 10k et 60k)
const LETTER_THRESHOLDS = [10_000, 20_000, 30_000, 40_000, 50_000, 60_000] as const;

// Assets
const logoComets = require("../../assets/images/iconComets.png");
const imgCoin = require("../../assets/game/coins.png");
const imgShield = require("../../assets/game/shield.png");
const imgDouble = require("../../assets/game/baseball-ball.jpg");
const imgX2 = require("../../assets/game/PurpleCoin.png");
const imgObs1 = require("../../assets/game/chibi_baseball.png");
const imgObs2 = require("../../assets/game/chibi_batte.png");

// Musique & SFX
const musicFile = require("../../assets/sounds/comets-song.mp3");
const sfxCoinFile = require("../../assets/sounds/coin.mp3");       // ← coin/pickup
const sfxApplauseFile = require("../../assets/sounds/applause.mp3"); // ← COMETS + x10

// Maps
const mapBaseBG = require("../../assets/game/maps/base.jpg");
const mapTerreBG = require("../../assets/game/maps/terre.png");
const mapJupiterBG = require("../../assets/game/maps/jupiter.png");
const mapMarsBG = require("../../assets/game/maps/mars.png");
const mapSystemeSolaireBG = require("../../assets/game/maps/systeme_solaire.png");

// Types
type Obstacle = { id: number; x: number; w: number; h: number; y: number; variant: 0 | 1 };
type Collectible = { id: number; x: number; y: number; r: number };
type PlatformBlock = { id: number; x: number; y: number; w: number; h: number };
type PowerUpKind = "shield" | "doublejump" | "x2" | "letter";
type PowerUp = { id: number; x: number; y: number; r: number; kind: PowerUpKind; letter?: CometsLetter };
type GameState = "ready" | "running" | "paused" | "gameover";
type Settings = { mute: boolean; haptics: boolean; highContrast: boolean; };
type SpawnPattern = "platform_gate" | "double_trouble" | "risk_lane";

type LBRow = {
  admin_id: string;
  best_score: number;
  admins?: { first_name: string | null; last_name: string | null } | null;
};
type LBAdminJoin = { first_name: string | null; last_name: string | null };
type LBWeeklyRunRow = { admin_id: string | null; score: number | null; created_at: string | null };
type LBProfileJoinRow = { admin_id: string; admins: LBAdminJoin | LBAdminJoin[] | null };

type DailyMissionId = "runs" | "coins" | "score";
type DailyMissionState = {
  dateKey: string;
  runs: number;
  coins: number;
  bestScore: number;
};

const DAILY_MISSIONS: readonly {
  id: DailyMissionId;
  label: string;
  target: number;
  tint: string;
}[] = [
  { id: "runs", label: "3 parties", target: 3, tint: "#60A5FA" },
  { id: "coins", label: "40 pieces", target: 40, tint: "#F59E0B" },
  { id: "score", label: "Score 2500", target: 2500, tint: "#A78BFA" },
];

// Helpers
const randf = (min: number, max: number) => Math.random() * (max - min) + min;
const randi = (min: number, max: number) => Math.floor(randf(min, max));
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function getDailyMissionDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createDailyMissionState(dateKey = getDailyMissionDateKey()): DailyMissionState {
  return { dateKey, runs: 0, coins: 0, bestScore: 0 };
}

function normalizeDailyMissionState(raw: unknown, todayKey = getDailyMissionDateKey()): DailyMissionState {
  if (!raw || typeof raw !== "object") return createDailyMissionState(todayKey);

  const data = raw as Partial<DailyMissionState>;
  if (typeof data.dateKey !== "string" || data.dateKey !== todayKey) {
    return createDailyMissionState(todayKey);
  }

  const runs = Number.isFinite(Number(data.runs)) ? Math.max(0, Math.floor(Number(data.runs))) : 0;
  const coins = Number.isFinite(Number(data.coins)) ? Math.max(0, Math.floor(Number(data.coins))) : 0;
  const bestScore =
    Number.isFinite(Number(data.bestScore)) ? Math.max(0, Math.floor(Number(data.bestScore))) : 0;

  return { dateKey: todayKey, runs, coins, bestScore };
}

function getDailyMissionValue(state: DailyMissionState, missionId: DailyMissionId) {
  switch (missionId) {
    case "runs":
      return state.runs;
    case "coins":
      return state.coins;
    case "score":
      return state.bestScore;
  }
}

function getDailyMissionDoneCount(state: DailyMissionState) {
  return DAILY_MISSIONS.reduce(
    (acc, mission) => (getDailyMissionValue(state, mission.id) >= mission.target ? acc + 1 : acc),
    0,
  );
}

function circleRectCollide(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const testX = Math.max(rx, Math.min(cx, rx + rw));
  const testY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - testX;
  const distY = cy - testY;
  return distX * distX + distY * distY <= r * r;
}

function circleCircleCollide(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

// Jumps
const V0 = Math.abs(JUMP_VELOCITY);
const singleJumpH = () => (V0 * V0) / (2 * GRAVITY_BASE);
const doubleJumpExtraH = () => (V0 * AIR_JUMP_FACTOR) ** 2 / (2 * GRAVITY_BASE);

// Achievements
type AchievementKey = "first_x2" | "score_2000" | "combo_10";
const ACH_LABEL: Record<AchievementKey, string> = {
  first_x2: "Premier ×2 !",
  score_2000: "Score 2 000",
  combo_10: "Série de 10 🔥",
};

// Maps / difficulty
type MapName = "base" | "terre" | "jupiter" | "mars" | "systeme_solaire";
const MAP_BG: Record<MapName, any> = {
  base: mapBaseBG,
  terre: mapTerreBG,
  jupiter: mapJupiterBG,
  mars: mapMarsBG,
  systeme_solaire: mapSystemeSolaireBG,
};

const MAP_SWITCH_AT = {
  base_to_terre: 10_000,
  terre_to_jupiter: 20_000,
  jupiter_to_mars: 40_000,
  mars_to_solaire: 100_000,
} as const;

const MAP_NAMES: MapName[] = ["base", "terre", "jupiter", "mars", "systeme_solaire"];
const POWERUP_KINDS: PowerUpKind[] = ["shield", "doublejump", "x2", "letter"];

function getDifficultyByMap(map: MapName) {
  switch (map) {
    case "base":            return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.00, gapMul: 1.00, gravityMul: 1.00 };
    case "terre":           return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.10, gapMul: 0.95, gravityMul: 1.00 };
    case "jupiter":         return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.22, gapMul: 0.90, gravityMul: 1.05 };
    case "mars":            return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.35, gapMul: 0.85, gravityMul: 1.05 };
    case "systeme_solaire": return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.45, gapMul: 0.82, gravityMul: 1.05 };
  }
}
type PauseSnapshot = {
  ts: number;
  score: number;
  hasShield: boolean;
  shieldStacks: number;
  superShieldLeftMs: number;
  invincibleLeftMs: number;
  doubleJumpLeftMs: number;
  scoreMultLevel: number;
  scoreMultLeftMs: number;
  purpleChain: number;
  persistentLetters: CometsLetter[]; // progression C-O-M-E-T-S
  mapName: MapName;
  speed: number;
  world?: {
    y: number;
    velY: number;
    grounded: boolean;
    lastGroundedTime: number;
    jumpBuffer: number;
    airJumpsLeft: number;
    distAcc: number;
    combo: number;
    angle: number;
    groundOffset: number;
    fenceOffset: number;
    mapAOffset: number;
    mapBOffset: number;
    mapFade: number;
    mapA: MapName;
    mapB: MapName;
    obstacles: Obstacle[];
    platforms: PlatformBlock[];
    collectibles: Collectible[];
    powerUps: PowerUp[];
    lastId: number;
    spawnedLetterIdx: number[];
    patternCooldownDist: number;
  };
};

async function savePauseSnapshot(s: PauseSnapshot) {
  try { await AsyncStorage.setItem(KEY_PAUSE_SNAPSHOT, JSON.stringify(s)); } catch {}
}
async function loadPauseSnapshot(): Promise<PauseSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PAUSE_SNAPSHOT);
    return raw ? (JSON.parse(raw) as PauseSnapshot) : null;
  } catch { return null; }
}
async function clearPauseSnapshot() {
  try { await AsyncStorage.removeItem(KEY_PAUSE_SNAPSHOT); } catch {}
}

function activeMapForScore(score: number): MapName {
  if (score >= MAP_SWITCH_AT.mars_to_solaire) return "systeme_solaire";
  if (score >= MAP_SWITCH_AT.jupiter_to_mars) return "mars";
  if (score >= MAP_SWITCH_AT.terre_to_jupiter) return "jupiter";
  if (score >= MAP_SWITCH_AT.base_to_terre) return "terre";
  return "base";
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function notifyCometsRunOvertake(payload: {
  byAdminId: string;
  previousBest: number;
  newBest: number;
}) {
  const urls = Array.from(
    new Set(
      [PRIMARY_API, FALLBACK_API]
        .map((base) => String(base ?? "").trim())
        .filter(Boolean)
        .map((base) => joinUrl(base, COMETS_RUN_OVERTAKE_PATH)),
    ),
  );

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(PUSH_COMETS_RUN_SECRET ? { "x-hook-secret": PUSH_COMETS_RUN_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) return true;

      const text = await res.text().catch(() => "");
      console.log("[CometsRun notify] non-ok:", url, res.status, text.slice(0, 200));
    } catch (e) {
      console.log("[CometsRun notify] network error:", url, (e as any)?.message ?? e);
    }
  }

  return false;
}

// ================= Component =================
export default function CometsRunnerScreen() {
  // Lock paysage + nav bar
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    (async () => {
      try {
        if (Platform.OS === "android") {
          await NavigationBar.setButtonStyleAsync("light");
          await NavigationBar.setVisibilityAsync("visible");
        }
      } catch {}
    })();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      (async () => {
        try {
          if (Platform.OS === "android") {
            await NavigationBar.setButtonStyleAsync("light");
            await NavigationBar.setVisibilityAsync("visible");
          }
        } catch {}
      })();
    };
  }, []);

  const setPlayingStatusBar = useCallback((b: boolean) => {
    try {
      /* @ts-ignore */
      StatusBar.setHidden(b, "fade");
    } catch {}
  }, []);

  // 🔊 Mode audio (iOS silencieux + latence min)
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: "duckOthers",
          shouldRouteThroughEarpiece: false,
        });
      } catch {}
    })();
  }, []);

  // Taille aire de jeu
  const [screenH, setScreenH] = useState(SCREEN_H_INIT);
  const [GROUND_Y, setGROUND_Y] = useState(GROUND_Y_INIT);
  const onGameAreaLayout = useCallback((e: any) => {
    const h = Math.max(1, Math.floor(e?.nativeEvent?.layout?.height ?? SCREEN_H_INIT));
    if (h !== screenH) {
      setScreenH(h);
      setGROUND_Y(makeDims(h).GROUND_Y);
    }
  }, [screenH]);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      const logicalH = Math.max(window.width, window.height);
      setScreenH((prev) => (prev === logicalH ? prev : logicalH));
      setGROUND_Y(makeDims(logicalH).GROUND_Y);
    });
    return () => sub.remove?.();
  }, []);

  // Hauteurs dépendantes
  const H_SINGLE = singleJumpH();
  const H_DOUBLE_ONLY = doubleJumpExtraH();
  const H_DOUBLE = H_SINGLE + H_DOUBLE_ONLY;
  const CY_GROUND = useMemo(() => GROUND_Y - PLAYER_SIZE / 2, [GROUND_Y]);
  const yForHeight = useCallback((h: number) => CY_GROUND - h, [CY_GROUND]);
  const clampYCenter = useCallback(
    (y: number, r: number) => Math.max(r + 8, Math.min(y, GROUND_Y - r - 4)),
    [GROUND_Y]
  );
  const H_STAR_MIN = H_SINGLE * 0.45;
  const H_STAR_MAX = H_SINGLE * 0.85;

  // Game/UI
  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<PauseSnapshot | null>(null);
  const [dailyMissions, setDailyMissions] = useState<DailyMissionState>(() => createDailyMissionState());
  const dailyMissionsRef = useRef<DailyMissionState>(createDailyMissionState());
  const runCoinsCollectedRef = useRef(0);

  // 🎉 Ultra visuel 20k — overlay éphémère (déclenché plus tard)
  const [bigEventUntil, setBigEventUntil] = useState<number>(0);

  // restart lockout
  const restartAllowedAtRef = useRef<number>(0);
  const failStreakRef = useRef(0);

  // Settings
  const [settings, setSettings] = useState<Settings>({
    mute: false,
    haptics: ENABLE_HAPTICS_DEFAULT,
    highContrast: false
  });
  const toggleSetting = (k: keyof Settings) =>
    setSettings((s) => {
      const next = { ...s, [k]: !s[k] };
      AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(next)).catch(() => {});
      return next;
    });

  // Achievements
  const [achievements, setAchievements] = useState<Record<AchievementKey, boolean>>({
    first_x2: false, score_2000: false, combo_10: false
  });

  const scoreRef = useRef(score);
  const bestRef = useRef(best);
  const gameStateRef = useRef<GameState>(gameState);
  const hasShieldRef = useRef(false);
  const shieldStacksRef = useRef(0);
  const superShieldUntilRef = useRef(0);
  const doubleJumpUntilRef = useRef<number>(0);
  const invincibleUntilRef = useRef<number>(0);
  const purpleChainRef = useRef(0);
  const achievementsRef = useRef(achievements);

  const [toast, setToast] = useState<string | null>(null);
  const lastToastAtRef = useRef(0);
  const showToast = useCallback((msg: string) => {
    const now = Date.now();
    if (now - lastToastAtRef.current < TOAST_MIN_INTERVAL_MS) return;
    lastToastAtRef.current = now;
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1200);
  }, []);

  const unlock = useCallback((key: AchievementKey) => {
    setAchievements((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, ...{ [key]: true } };
      AsyncStorage.setItem(KEY_ACH, JSON.stringify(next)).catch(() => {});
      showToast(`🏅 ${ACH_LABEL[key]}`);
      return next;
    });
  }, [showToast]);

  // Milestones
  const milestonesRef = useRef(new Set<number>());
  const checkMilestones = useCallback((val: number) => {
    const goals = [2000, 10000, 50000, 100000];
    for (const g of goals) {
      if (val >= g && !milestonesRef.current.has(g)) {
        milestonesRef.current.add(g);
        const label = g >= 10000 ? `${(g/1000)|0}k atteint` : `${g} atteint`;
        showToast(`🏆 ${label} !`);
      }
    }
  }, [showToast]);

  const persistDailyMissions = useCallback((next: DailyMissionState) => {
    dailyMissionsRef.current = next;
    setDailyMissions(next);
    AsyncStorage.setItem(KEY_DAILY_MISSIONS, JSON.stringify(next)).catch(() => {});
  }, []);

  const loadDailyMissions = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_DAILY_MISSIONS);
      const parsed = raw ? JSON.parse(raw) : null;
      const normalized = normalizeDailyMissionState(parsed);
      persistDailyMissions(normalized);
    } catch {
      const fallback = createDailyMissionState();
      persistDailyMissions(fallback);
    }
  }, [persistDailyMissions]);

  const applyRunToDailyMissions = useCallback(
    (finalScore: number) => {
      const prev = normalizeDailyMissionState(dailyMissionsRef.current);
      const next: DailyMissionState = {
        dateKey: prev.dateKey,
        runs: prev.runs + 1,
        coins: prev.coins + Math.max(0, Math.floor(runCoinsCollectedRef.current)),
        bestScore: Math.max(prev.bestScore, Math.max(0, Math.floor(finalScore))),
      };

      runCoinsCollectedRef.current = 0;
      persistDailyMissions(next);

      const unlocked = DAILY_MISSIONS.filter(
        (mission) =>
          getDailyMissionValue(prev, mission.id) < mission.target &&
          getDailyMissionValue(next, mission.id) >= mission.target,
      );
      if (unlocked.length > 0) {
        showToast(`Mission: ${unlocked[0].label}`);
      }
    },
    [persistDailyMissions, showToast],
  );

  // Buffs
  const [hasShield, setHasShield] = useState(false);
  const [shieldStacks, setShieldStacks] = useState(0); // vers super shield
  const [superShieldUntil, setSuperShieldUntil] = useState(0); // invincibilité super shield
  const [doubleJumpUntil, setDoubleJumpUntil] = useState<number>(0);
  const [invincibleUntil, setInvincibleUntil] = useState<number>(0);
  const [purpleChain, setPurpleChain] = useState(0);

  useEffect(() => { hasShieldRef.current = hasShield; }, [hasShield]);
  useEffect(() => { shieldStacksRef.current = shieldStacks; }, [shieldStacks]);
  useEffect(() => { superShieldUntilRef.current = superShieldUntil; }, [superShieldUntil]);
  useEffect(() => { doubleJumpUntilRef.current = doubleJumpUntil; }, [doubleJumpUntil]);
  useEffect(() => { invincibleUntilRef.current = invincibleUntil; }, [invincibleUntil]);
  useEffect(() => { purpleChainRef.current = purpleChain; }, [purpleChain]);

  const setHasShieldSync = useCallback((value: boolean) => {
    hasShieldRef.current = value;
    setHasShield(value);
  }, []);
  const setShieldStacksSync = useCallback((value: number) => {
    shieldStacksRef.current = value;
    setShieldStacks(value);
  }, []);
  const setSuperShieldUntilSync = useCallback((value: number) => {
    superShieldUntilRef.current = value;
    setSuperShieldUntil(value);
  }, []);
  const setDoubleJumpUntilSync = useCallback((value: number) => {
    doubleJumpUntilRef.current = value;
    setDoubleJumpUntil(value);
  }, []);
  const setInvincibleUntilSync = useCallback((value: number) => {
    invincibleUntilRef.current = value;
    setInvincibleUntil(value);
  }, []);
  const setPurpleChainSync = useCallback((value: number) => {
    purpleChainRef.current = value;
    setPurpleChain(value);
  }, []);

  // Multiplicateur Purple
  const comboRef = useRef(0);
  const scoreMultLevelRef = useRef<number>(1);
  const scoreMultUntilRef = useRef<number>(0);
  const getActiveScoreMult = useCallback(
    () => (Date.now() < scoreMultUntilRef.current ? scoreMultLevelRef.current : 1),
    []
  );
  const applyScoreGain = useCallback((base: number) => Math.floor(base * getActiveScoreMult()), [getActiveScoreMult]);

  // Chaîne Purple
  const purpleChainExpiresAtRef = useRef<number>(0);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { bestRef.current = best; }, [best]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { achievementsRef.current = achievements; }, [achievements]);

  // === COMETS persistant (ordre strict) ===
  const persistentLettersRef = useRef<Set<CometsLetter>>(new Set());
  const [, setLettersTick] = useState(0);

  // indices 0..5 spawnés durant CE run
  const spawnedLetterIdxThisRunRef = useRef<Set<number>>(new Set());

  const loadCometsProgress = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_COMETS_PROGRESS);
      if (raw) {
        const arr: CometsLetter[] = JSON.parse(raw);
        persistentLettersRef.current = new Set(arr);
        setLettersTick(t => t + 1);
      }
    } catch {}
  }, []);
  const saveCometsProgress = useCallback(() => {
    try {
      const arr = Array.from(persistentLettersRef.current);
      AsyncStorage.setItem(KEY_COMETS_PROGRESS, JSON.stringify(arr)).catch(() => {});
    } catch {}
  }, []);
  useEffect(() => { loadCometsProgress(); }, [loadCometsProgress]);

  const haveAllLetters = useCallback(() => LETTERS.every(L => persistentLettersRef.current.has(L)), []);
  const addPersistentLetter = useCallback((L: CometsLetter) => {
    persistentLettersRef.current.add(L);
    saveCometsProgress();
    setLettersTick(t => t + 1);
  }, [saveCometsProgress]);
  const resetPersistentLetters = useCallback(() => {
    persistentLettersRef.current.clear();
    saveCometsProgress();
    setLettersTick(t => t + 1);
  }, [saveCometsProgress]);

  // Monde
  const playerX = Math.floor(SCREEN_W * 0.08);
  const speedRef = useRef(START_SPEED);
  const targetSpeedRef = useRef(START_SPEED);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const platformsRef = useRef<PlatformBlock[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const patternCooldownDistRef = useRef(0);
  const lastIdRef = useRef(1);

  // Popups points (+xxx)
  const popupsRef = useRef<{ id:number; x:number; y:number; born:number; text:string }[]>([]);

  // Physique joueur
  const yRef = useRef(GROUND_Y_INIT - PLAYER_SIZE);
  const velYRef = useRef(0);
  const groundedRef = useRef(true);
  const lastGroundedTimeRef = useRef(0);
  const jumpBufferRef = useRef(0);
  const airJumpsLeftRef = useRef(0);
  const holdingJumpRef = useRef(false);

  // Parallax
  const angleRef = useRef(0);
  const groundOffsetRef = useRef(0);
  const fenceOffsetRef = useRef(0);

  // BG double
  const mapARef = useRef<MapName>("base");
  const mapBRef = useRef<MapName>("base");
  const mapFadeRef = useRef(0);
  const mapAOffsetRef = useRef(0);
  const mapBOffsetRef = useRef(0);
  const MAP_FADE_SECS = 1.4;

  // Loop
  const [, setFrameTick] = useState(0);
  const distAccRef = useRef(0);
  const ROLL_VISUAL_MULT = 0.9;
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // FX
  const shake = useRef(new Animated.Value(0)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;

  // Admin/Supabase
  const { admin } = useAdmin();
  const adminId = (admin?.id ?? null) as any as string | null;
  const adminFirst = (admin as any)?.first_name ?? null;
  const adminLast = (admin as any)?.last_name ?? null;
  const adminEmail = admin?.email ?? null;
  const adminName =
    [adminFirst, adminLast].filter(Boolean).join(" ").trim() ||
    adminEmail || "Anonyme";

  const ensureProfile = useCallback(async () => {
    if (!adminId) return;
    const { error } = await supabase.from("game_profiles").upsert(
      [{ admin_id: adminId, display_name: adminName }],
      { onConflict: "admin_id", ignoreDuplicates: false }
    );
    if (error) console.log("ensureProfile error:", error.message);
  }, [adminId, adminName]);

  const loadBestFromCloud = useCallback(async () => {
    if (!adminId) return;
    const { data, error } = await supabase
      .from("game_profiles")
      .select("best_score")
      .eq("admin_id", adminId)
      .maybeSingle();
    if (error) {
      console.log("loadBestFromCloud error:", error.message);
      return;
    }
    if (data?.best_score != null && Number.isFinite(data.best_score)) {
      setBest(data.best_score);
      AsyncStorage.setItem(KEY_BEST, String(data.best_score)).catch(() => {});
    }
  }, [adminId]);

  const [top5, setTop5] = useState<LBRow[] | null>(null);
  const loadTop5 = useCallback(async () => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data: runs, error: runsError } = await supabase
        .from("game_runs")
        .select("admin_id,score,created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(3000);
      if (runsError) {
        console.log("loadTop5 weekly runs error:", runsError.message);
        setTop5([]);
        return;
      }

      const toTs = (input: string | null) => {
        const t = input ? Date.parse(input) : 0;
        return Number.isFinite(t) ? t : 0;
      };

      const byAdmin = new Map<
        string,
        { admin_id: string; best_score: number; last_run_at: string | null; admins: LBAdminJoin | null }
      >();

      for (const run of (runs ?? []) as LBWeeklyRunRow[]) {
        const adminKey = String(run.admin_id ?? "").trim();
        if (!adminKey) continue;

        const score = Math.max(0, Math.floor(Number(run.score ?? 0)));
        const createdAt = typeof run.created_at === "string" ? run.created_at : null;
        const existing = byAdmin.get(adminKey);
        if (!existing) {
          byAdmin.set(adminKey, {
            admin_id: adminKey,
            best_score: score,
            last_run_at: createdAt,
            admins: null,
          });
          continue;
        }

        existing.best_score = Math.max(existing.best_score, score);
        if (toTs(createdAt) > toTs(existing.last_run_at)) {
          existing.last_run_at = createdAt;
        }
      }

      const adminIds = Array.from(byAdmin.keys());
      if (adminIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("game_profiles")
          .select("admin_id,admins(first_name,last_name)")
          .in("admin_id", adminIds);
        if (profilesError) {
          console.log("loadTop5 weekly profiles error:", profilesError.message);
        } else {
          for (const profile of (profiles ?? []) as LBProfileJoinRow[]) {
            const target = byAdmin.get(profile.admin_id);
            if (!target) continue;
            target.admins = Array.isArray(profile.admins) ? (profile.admins[0] ?? null) : (profile.admins ?? null);
          }
        }
      }

      const weeklyTop5: LBRow[] = Array.from(byAdmin.values())
        .sort((a, b) => {
          if (b.best_score !== a.best_score) return b.best_score - a.best_score;
          return toTs(b.last_run_at) - toTs(a.last_run_at);
        })
        .slice(0, 5)
        .map((row) => ({
          admin_id: row.admin_id,
          best_score: row.best_score,
          admins: row.admins,
        }));

      setTop5(weeklyTop5);
    } catch (e) {
      console.log("loadTop5 catch:", (e as any)?.message);
      setTop5([]);
    }
  }, []);

  const saveRunToCloud = useCallback(async (finalScore: number) => {
    if (!adminId) return;
    const { error: errRun } = await supabase.from("game_runs").insert({
      admin_id: adminId,
      score: finalScore,
      device_id: (Constants as any)?.deviceName ?? (Constants as any)?.deviceId ?? null,
      app_version: Constants.expoConfig?.version ?? null,
    });
    if (errRun) console.log("insert run error:", errRun.message);

    const { data: current, error: errGet } = await supabase
      .from("game_profiles")
      .select("best_score, total_runs")
      .eq("admin_id", adminId)
      .maybeSingle();
    if (errGet) console.log("get profile error:", errGet.message);

    const previousBest = Math.max(0, Math.floor(Number(current?.best_score ?? 0)));
    const newBest = Math.max(finalScore, previousBest);
    const { error: errUp } = await supabase.from("game_profiles").upsert({
      admin_id: adminId,
      display_name: adminName,
      best_score: newBest,
      total_runs: (current?.total_runs ?? 0) + 1,
      last_run_at: new Date().toISOString(),
    });
    if (errUp) console.log("upsert profile error:", errUp.message);

    if (!errUp && !errGet && newBest > previousBest) {
      notifyCometsRunOvertake({
        byAdminId: adminId,
        previousBest,
        newBest,
      }).catch((e) => {
        console.log("notify overtake error:", (e as any)?.message ?? e);
      });
    }

    if (newBest > (best || 0)) {
      setBest(newBest);
      AsyncStorage.setItem(KEY_BEST, String(newBest)).catch(() => {});
    }
    await loadTop5();
  }, [adminId, adminName, best, loadTop5]);

  // 🔊 Refs & helpers audio
  const musicRef = useRef<AudioPlayer | null>(null);
  const sfxApplauseRef = useRef<AudioPlayer | null>(null);

  // Pool pour COINS (superposition)
  const COIN_POOL_SIZE = 8;
  const coinPoolRef = useRef<AudioPlayer[]>([]);
  const coinPoolIdxRef = useRef(0);

  const ensureMusic = useCallback(async () => {
    if (musicRef.current) return musicRef.current;
    const player = createAudioPlayer(musicFile, { keepAudioSessionActive: true });
    player.loop = true;
    player.volume = settings.mute ? 0 : 1;
    musicRef.current = player;
    return player;
  }, [settings.mute]);

  const ensureCoinPool = useCallback(async () => {
    if (coinPoolRef.current.length > 0) return coinPoolRef.current;
    const arr: AudioPlayer[] = [];
    for (let i = 0; i < COIN_POOL_SIZE; i++) {
      const player = createAudioPlayer(sfxCoinFile, { keepAudioSessionActive: true });
      player.loop = false;
      player.volume = settings.mute ? 0 : 1;
      arr.push(player);
    }
    coinPoolRef.current = arr;
    return arr;
  }, [settings.mute]);

  const playCoinSfx = useCallback(async () => {
    try {
      const pool = await ensureCoinPool();
      const s = pool[coinPoolIdxRef.current];
      coinPoolIdxRef.current = (coinPoolIdxRef.current + 1) % pool.length;
      await s.seekTo(0);
      s.play();
    } catch {}
  }, [ensureCoinPool]);

  const ensureSfxApplause = useCallback(async () => {
    if (sfxApplauseRef.current) return sfxApplauseRef.current;
    const player = createAudioPlayer(sfxApplauseFile, { keepAudioSessionActive: true });
    player.loop = false;
    player.volume = settings.mute ? 0 : 1;
    sfxApplauseRef.current = player;
    return player;
  }, [settings.mute]);

  const playApplauseSfx = useCallback(async () => {
    try {
      const snd = await ensureSfxApplause();
      await snd.seekTo(0);
      snd.play();
    } catch {}
  }, [ensureSfxApplause]);

  const playMusic = useCallback(async () => {
    try {
      const sound = await ensureMusic();
      sound.loop = true;
      sound.volume = settings.mute ? 0 : 1;
      sound.play();
    } catch {}
  }, [ensureMusic, settings.mute]);
const pauseMusic = useCallback(async () => {
  try { musicRef.current?.pause(); } catch {}
}, []);
  const stopMusic = useCallback(async () => {
    try {
      const player = musicRef.current;
      if (!player) return;
      player.pause();
      await player.seekTo(0);
    } catch {}
  }, []);
  const unloadMusic = useCallback(async () => {
    try {
      musicRef.current?.remove();
      musicRef.current = null;
    } catch {}
  }, []);

  // réagir au mute en direct
  useEffect(() => {
    (async () => {
      try {
        if (musicRef.current) musicRef.current.volume = settings.mute ? 0 : 1;
        if (sfxApplauseRef.current) sfxApplauseRef.current.volume = settings.mute ? 0 : 1;
        for (const s of coinPoolRef.current) {
          try { s.volume = settings.mute ? 0 : 1; } catch {}
        }
      } catch {}
    })();
  }, [settings.mute]);

// Transitions d’état jeu -> musique
useEffect(() => {
  (async () => {
    if (gameState === "running") {
      await playMusic();       // reprend depuis la position actuelle
    } else if (gameState === "paused") {
      await pauseMusic();      // ne remet PAS à zéro
    } else {
      await stopMusic();       // ready / gameover => reset à 0
    }
  })();
}, [gameState, playMusic, pauseMusic, stopMusic]);

  const buildPauseSnapshot = useCallback((now: number): PauseSnapshot => {
    return {
      ts: now,
      score: scoreRef.current,
      hasShield: hasShieldRef.current,
      shieldStacks: shieldStacksRef.current,
      superShieldLeftMs: Math.max(0, superShieldUntilRef.current - now),
      invincibleLeftMs: Math.max(0, invincibleUntilRef.current - now),
      doubleJumpLeftMs: Math.max(0, doubleJumpUntilRef.current - now),
      scoreMultLevel: scoreMultLevelRef.current,
      scoreMultLeftMs: Math.max(0, scoreMultUntilRef.current - now),
      purpleChain: purpleChainRef.current,
      persistentLetters: Array.from(persistentLettersRef.current),
      mapName: mapARef.current,
      speed: speedRef.current,
      world: {
        y: yRef.current,
        velY: velYRef.current,
        grounded: groundedRef.current,
        lastGroundedTime: lastGroundedTimeRef.current,
        jumpBuffer: jumpBufferRef.current,
        airJumpsLeft: airJumpsLeftRef.current,
        distAcc: distAccRef.current,
        combo: comboRef.current,
        angle: angleRef.current,
        groundOffset: groundOffsetRef.current,
        fenceOffset: fenceOffsetRef.current,
        mapAOffset: mapAOffsetRef.current,
        mapBOffset: mapBOffsetRef.current,
        mapFade: mapFadeRef.current,
        mapA: mapARef.current,
        mapB: mapBRef.current,
        obstacles: obstaclesRef.current.map((o) => ({ ...o })),
        platforms: platformsRef.current.map((p) => ({ ...p })),
        collectibles: collectiblesRef.current.map((c) => ({ ...c })),
        powerUps: powerUpsRef.current.map((p) => ({ ...p })),
        lastId: lastIdRef.current,
        spawnedLetterIdx: Array.from(spawnedLetterIdxThisRunRef.current),
        patternCooldownDist: patternCooldownDistRef.current,
      },
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        const wasRunning = gameStateRef.current === "running";
        if (wasRunning) {
          gameStateRef.current = "paused";
          setGameState("paused");
        }
        setPlayingStatusBar(false);
        holdingJumpRef.current = false;

        pauseMusic().catch(() => {});

        if (!wasRunning) return;
        const now = Date.now();
        savePauseSnapshot(buildPauseSnapshot(now)).catch(() => {});
      };
    }, [buildPauseSnapshot, pauseMusic, setPlayingStatusBar]),
  );


  // Cleanup audio
  useEffect(() => {
    return () => {
      unloadMusic();
      try {
        sfxApplauseRef.current?.remove();
        sfxApplauseRef.current = null;
      } catch {}
      try {
        for (const s of coinPoolRef.current) {
          try { s.remove(); } catch {}
        }
        coinPoolRef.current = [];
      } catch {}
    };
  }, [unloadMusic]);

  // Preload & settings
  useEffect(() => {
    (async () => {
      try {
        [imgObs1, imgObs2, imgCoin, imgShield, imgDouble, imgX2, mapBaseBG, mapTerreBG, mapJupiterBG, mapMarsBG, mapSystemeSolaireBG]
          .forEach(a => { try { Image.prefetch(Image.resolveAssetSource(a).uri); } catch {} });
      } catch {}
      try { const rawS = await AsyncStorage.getItem(KEY_SETTINGS); if (rawS) setSettings(s => ({ ...s, ...JSON.parse(rawS) })); } catch {}
      try { const rawA = await AsyncStorage.getItem(KEY_ACH); if (rawA) setAchievements(prev => ({ ...prev, ...JSON.parse(rawA) })); } catch {}
      try { const raw = await AsyncStorage.getItem(KEY_BEST); if (raw) setBest(parseInt(raw, 10) || 0); } catch {}
      await loadDailyMissions();
      // précharge le pool coin pour éliminer le "vide" initial
      try { await ensureCoinPool(); } catch {}
      // progression COMETS chargée ailleurs
    })();
  }, [ensureCoinPool, loadDailyMissions]);

  useEffect(() => {
    (async () => {
      if (!adminId) { await loadTop5(); return; }
      await ensureProfile();
      await loadBestFromCloud();
      await loadTop5();
    })();
  }, [adminId, ensureProfile, loadBestFromCloud, loadTop5]);

  useEffect(() => {
    (async () => {
      const snap = await loadPauseSnapshot();
      if (!snap) return;
      // snapshot périmé : on ignore après 6h
      if (Date.now() - snap.ts > 6 * 60 * 60 * 1000) {
        await clearPauseSnapshot();
        return;
      }
      setPendingSnapshot(snap);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await loadDailyMissions();
        return;
      }
      if (gameStateRef.current !== "running") return;

      setGameState("paused");
      setPlayingStatusBar(false);

      const now = Date.now();
      await savePauseSnapshot(buildPauseSnapshot(now));
    });
    return () => sub.remove();
  }, [buildPauseSnapshot, loadDailyMissions, setPlayingStatusBar]);


  // === alignement si sol change
  const prevGroundYRef = useRef(GROUND_Y);
  useEffect(() => {
    const prev = prevGroundYRef.current;
    if (prev === GROUND_Y) return;
    const dy = GROUND_Y - prev;

    // joueur
    yRef.current = Math.min(yRef.current + dy, GROUND_Y - PLAYER_SIZE);

    // obstacles
    obstaclesRef.current = obstaclesRef.current.map(o => ({ ...o, y: GROUND_Y - o.h }));
    platformsRef.current = platformsRef.current.map((p) => ({
      ...p,
      y: clamp(p.y + dy, 20, GROUND_Y - p.h - 40),
    }));

    // collectibles / power-ups
    const clampCenter = (y: number, r: number) => Math.max(r + 8, Math.min(y, GROUND_Y - r - 4));
    collectiblesRef.current = collectiblesRef.current.map(c => ({ ...c, y: clampCenter(c.y + dy, c.r), }));
    powerUpsRef.current = powerUpsRef.current.map(p => ({ ...p, y: clampCenter(p.y + dy, p.r), }));

    prevGroundYRef.current = GROUND_Y;
    setFrameTick(t => t + 1);
  }, [GROUND_Y]);

  // Reset monde
  const resetWorld = useCallback(() => {
    obstaclesRef.current = [];
    platformsRef.current = [];
    collectiblesRef.current = [];
    powerUpsRef.current = [];
    popupsRef.current = [];
    patternCooldownDistRef.current = 0;
    lastIdRef.current = 1;

    const assist = 1 - Math.min(0.12, failStreakRef.current * 0.04);
    targetSpeedRef.current = Math.max(START_SPEED * 0.82, START_SPEED * assist);
    speedRef.current = targetSpeedRef.current;

    scoreRef.current = 0;
    setScore(0);
    runCoinsCollectedRef.current = 0;
    milestonesRef.current.clear();
    comboRef.current = 0;

    setHasShieldSync(false);
    setShieldStacksSync(0);
    setSuperShieldUntilSync(0);
    setDoubleJumpUntilSync(0);
    setInvincibleUntilSync(0);

    scoreMultLevelRef.current = 1;
    scoreMultUntilRef.current = 0;
    setPurpleChainSync(0);
    purpleChainExpiresAtRef.current = 0;

    // reset des lettres spawnées pour CE run
    spawnedLetterIdxThisRunRef.current.clear();

    distAccRef.current = 0;
    velYRef.current = 0;
    groundedRef.current = true;
    yRef.current = GROUND_Y - PLAYER_SIZE;
    lastGroundedTimeRef.current = 0;
    jumpBufferRef.current = 0;
    holdingJumpRef.current = false;

    // parallax
    groundOffsetRef.current = 0;
    fenceOffsetRef.current = 0;
    mapAOffsetRef.current = 0;
    mapBOffsetRef.current = 0;

    mapARef.current = activeMapForScore(0);
    mapBRef.current = mapARef.current;
    mapFadeRef.current = 0;

    setFrameTick(t => t + 1);

    const firstX = SCREEN_W + 420;
    const firstW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
    const h = OBSTACLE_BASE_H + randi(-8, 8);
    obstaclesRef.current.push({
      id: ++lastIdRef.current, x: firstX, w: firstW, h, y: GROUND_Y - h, variant: Math.random() < 0.5 ? 0 : 1
    });

    if (ENABLE_COLLECTIBLES) {
      const hStar = randf(H_STAR_MIN, H_STAR_MAX);
      const yStar = clampYCenter(yForHeight(hStar), R_COLLECTIBLE);
      collectiblesRef.current.push({ id: ++lastIdRef.current, x: firstX + 180, y: yStar, r: R_COLLECTIBLE });
    }
  }, [
    GROUND_Y,
    H_STAR_MIN,
    H_STAR_MAX,
    clampYCenter,
    yForHeight,
    setHasShieldSync,
    setShieldStacksSync,
    setSuperShieldUntilSync,
    setDoubleJumpUntilSync,
    setInvincibleUntilSync,
    setPurpleChainSync,
  ]);

  const startGame = useCallback(() => {
    setShowHelp(false);
    resetWorld();
    setPendingSnapshot(null);
    clearPauseSnapshot().catch(() => {});
    setGameState("running");
    setPlayingStatusBar(true);
  }, [resetWorld, setPlayingStatusBar]);

  const resumeFromSnapshot = useCallback(async () => {
    if (!pendingSnapshot) return;
    const snap = pendingSnapshot;
    const now = Date.now();

    setShowHelp(false);
    resetWorld();

    scoreRef.current = Math.max(0, Math.floor(snap.score));
    setScore(scoreRef.current);
    setHasShieldSync(!!snap.hasShield);
    setShieldStacksSync(Math.max(0, Math.floor(snap.shieldStacks)));
    setSuperShieldUntilSync(now + Math.max(0, snap.superShieldLeftMs));
    setInvincibleUntilSync(now + Math.max(0, snap.invincibleLeftMs));
    setDoubleJumpUntilSync(now + Math.max(0, snap.doubleJumpLeftMs));
    scoreMultLevelRef.current = Math.max(1, Math.floor(snap.scoreMultLevel || 1));
    scoreMultUntilRef.current = now + Math.max(0, snap.scoreMultLeftMs || 0);
    setPurpleChainSync(Math.max(0, Math.floor(snap.purpleChain || 0)));
    purpleChainExpiresAtRef.current = scoreMultUntilRef.current;
    persistentLettersRef.current = new Set(snap.persistentLetters ?? []);
    setLettersTick((t) => t + 1);

    const resumedSpeed = Math.max(START_SPEED * 0.82, Math.floor(snap.speed || START_SPEED));
    speedRef.current = resumedSpeed;
    targetSpeedRef.current = resumedSpeed;

    const world = snap.world;
    if (world) {
      const toNum = (v: unknown, fallback = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      const asMapName = (v: unknown): MapName | null => {
        return MAP_NAMES.includes(v as MapName) ? (v as MapName) : null;
      };
      const mapA = asMapName(world.mapA) ?? asMapName(snap.mapName) ?? activeMapForScore(scoreRef.current);
      const mapB = asMapName(world.mapB) ?? mapA;

      mapARef.current = mapA;
      mapBRef.current = mapB;
      mapFadeRef.current = clamp(toNum(world.mapFade, 0), 0, 1);
      mapAOffsetRef.current = toNum(world.mapAOffset, 0);
      mapBOffsetRef.current = toNum(world.mapBOffset, 0);
      groundOffsetRef.current = toNum(world.groundOffset, 0);
      fenceOffsetRef.current = toNum(world.fenceOffset, 0);
      angleRef.current = toNum(world.angle, 0);
      distAccRef.current = Math.max(0, toNum(world.distAcc, 0));
      comboRef.current = clamp(Math.floor(toNum(world.combo, 0)), 0, 10);

      const floorY = GROUND_Y - PLAYER_SIZE;
      yRef.current = clamp(toNum(world.y, floorY), 0, floorY);
      velYRef.current = toNum(world.velY, 0);
      groundedRef.current = !!world.grounded;
      lastGroundedTimeRef.current = toNum(world.lastGroundedTime, 0);
      jumpBufferRef.current = Math.max(0, toNum(world.jumpBuffer, 0));
      airJumpsLeftRef.current = Math.max(0, Math.floor(toNum(world.airJumpsLeft, 0)));

      const normalizedObstacles: Obstacle[] = (Array.isArray(world.obstacles) ? world.obstacles : [])
        .map((o: any): Obstacle | null => {
          const id = Math.floor(toNum(o?.id, NaN));
          const x = toNum(o?.x, NaN);
          const w = toNum(o?.w, NaN);
          const h = toNum(o?.h, NaN);
          const y = toNum(o?.y, NaN);
          if (![id, x, w, h, y].every(Number.isFinite)) return null;
          return {
            id: Math.max(1, id),
            x,
            w: Math.max(6, w),
            h: Math.max(6, h),
            y,
            variant: o?.variant === 1 ? 1 : 0,
          };
        })
        .filter((o): o is Obstacle => !!o);
      const normalizedPlatforms: PlatformBlock[] = (Array.isArray(world.platforms) ? world.platforms : [])
        .map((p: any): PlatformBlock | null => {
          const id = Math.floor(toNum(p?.id, NaN));
          const x = toNum(p?.x, NaN);
          const y = toNum(p?.y, NaN);
          const w = toNum(p?.w, NaN);
          const h = toNum(p?.h, NaN);
          if (![id, x, y, w, h].every(Number.isFinite)) return null;
          return {
            id: Math.max(1, id),
            x,
            y: clamp(y, 20, GROUND_Y - 16),
            w: Math.max(40, w),
            h: Math.max(6, h),
          };
        })
        .filter((p): p is PlatformBlock => !!p);
      const normalizedCollectibles: Collectible[] = (Array.isArray(world.collectibles) ? world.collectibles : [])
        .map((c: any): Collectible | null => {
          const id = Math.floor(toNum(c?.id, NaN));
          const x = toNum(c?.x, NaN);
          const y = toNum(c?.y, NaN);
          const r = toNum(c?.r, NaN);
          if (![id, x, y, r].every(Number.isFinite)) return null;
          return { id: Math.max(1, id), x, y, r: Math.max(2, r) };
        })
        .filter((c): c is Collectible => !!c);
      const normalizedPowerUps: PowerUp[] = (Array.isArray(world.powerUps) ? world.powerUps : [])
        .map((p: any): PowerUp | null => {
          const id = Math.floor(toNum(p?.id, NaN));
          const x = toNum(p?.x, NaN);
          const y = toNum(p?.y, NaN);
          const r = toNum(p?.r, NaN);
          const kind = POWERUP_KINDS.includes(p?.kind as PowerUpKind) ? (p.kind as PowerUpKind) : null;
          if (![id, x, y, r].every(Number.isFinite) || !kind) return null;
          const maybeLetter =
            kind === "letter" && LETTERS.includes(p?.letter as CometsLetter)
              ? (p.letter as CometsLetter)
              : undefined;
          return { id: Math.max(1, id), x, y, r: Math.max(2, r), kind, letter: maybeLetter };
        })
        .filter((p): p is PowerUp => !!p);

      obstaclesRef.current = normalizedObstacles;
      platformsRef.current = normalizedPlatforms;
      collectiblesRef.current = normalizedCollectibles;
      powerUpsRef.current = normalizedPowerUps;
      patternCooldownDistRef.current = Math.max(0, toNum(world.patternCooldownDist, 0));

      const restoredIdx = (Array.isArray(world.spawnedLetterIdx) ? world.spawnedLetterIdx : [])
        .map((idx) => Math.floor(toNum(idx, NaN)))
        .filter((idx) => Number.isFinite(idx) && idx >= 0 && idx < LETTERS.length);
      spawnedLetterIdxThisRunRef.current = new Set(restoredIdx);

      const maxEntityId = Math.max(
        0,
        ...normalizedObstacles.map((o) => o.id),
        ...normalizedPlatforms.map((p) => p.id),
        ...normalizedCollectibles.map((c) => c.id),
        ...normalizedPowerUps.map((p) => p.id),
      );
      lastIdRef.current = Math.max(
        1,
        Math.floor(toNum(world.lastId, 1)),
        maxEntityId + 1,
      );
    } else {
      mapARef.current = snap.mapName ?? activeMapForScore(scoreRef.current);
      mapBRef.current = mapARef.current;
      mapFadeRef.current = 0;
      platformsRef.current = [];
      patternCooldownDistRef.current = 0;
    }

    setPendingSnapshot(null);
    await clearPauseSnapshot();
    setFrameTick((t) => t + 1);
    setGameState("running");
    setPlayingStatusBar(true);
  }, [
    GROUND_Y,
    pendingSnapshot,
    resetWorld,
    setHasShieldSync,
    setShieldStacksSync,
    setSuperShieldUntilSync,
    setInvincibleUntilSync,
    setDoubleJumpUntilSync,
    setPurpleChainSync,
    setPlayingStatusBar,
  ]);

  const pauseGame = useCallback(() => {
    setGameState(s => {
      const next = s === "running" ? "paused" : s;
      if (next === "paused") setPlayingStatusBar(false);
      return next;
    });
  }, [setPlayingStatusBar]);

  const resumeGame = useCallback(() => {
    setGameState(s => {
      const next = s === "paused" ? "running" : s;
      if (next === "running") setPlayingStatusBar(true);
      return next;
    });
  }, [setPlayingStatusBar]);

  const endGame = useCallback(async () => {
    if (gameStateRef.current === "gameover") return;
    gameStateRef.current = "gameover";
    const finalScore = scoreRef.current;
    applyRunToDailyMissions(finalScore);
    setGameState("gameover");
    restartAllowedAtRef.current = Date.now() + 2000;
    setPlayingStatusBar(false);
    // ✨ RESET de la progression des lettres à la fin de la partie
    resetPersistentLetters();

    if (finalScore < 1200) failStreakRef.current = Math.min(3, failStreakRef.current + 1);
    else failStreakRef.current = 0;

    try {
      if (adminId) {
        await saveRunToCloud(finalScore);
      } else if (finalScore > bestRef.current) {
        setBest(finalScore);
        bestRef.current = finalScore;
        await AsyncStorage.setItem(KEY_BEST, String(finalScore));
        await loadTop5();
      } else {
        await loadTop5();
      }
    } catch (e) {
      console.log("endGame error:", (e as any)?.message);
    }
  }, [adminId, applyRunToDailyMissions, saveRunToCloud, loadTop5, resetPersistentLetters, setPlayingStatusBar]);

  // helpers
  const doubleJumpActive = useCallback(
    () => ENABLE_DOUBLEJUMP && doubleJumpUntilRef.current > Date.now(),
    []
  );

  const getSpeedMultiplier = useCallback(
    (s: number) => Math.min(MULT_MAX, MULT_MIN + Math.max(0, s - START_SPEED) / MULT_SCALE),
    []
  );
  const getComboMultiplier = useCallback(
    () => Math.min(2.0, 1 + 0.25 * Math.max(0, comboRef.current - 1)),
    []
  );

  
  // ====== Spawner & utils ======
  const spawnCoinsGround = useCallback((count: number, startX?: number, big = false) => {
    const s = speedRef.current;
    const lead = Math.max(220, Math.min(880, s * 1.0));
    const x0 = (startX ?? SCREEN_W + lead);
    const gap = 36;
    for (let i = 0; i < count; i++) {
      const x = x0 + i * gap;
      const y = GROUND_Y - (big ? R_COLLECTIBLE*SUPER_SHIELD_COIN_SCALE : R_COLLECTIBLE) - 4;
      collectiblesRef.current.push({
        id: ++lastIdRef.current,
        x, y,
        r: big ? R_COLLECTIBLE*SUPER_SHIELD_COIN_SCALE : R_COLLECTIBLE
      });
    }
  }, [GROUND_Y]);

  const spawnCoinsAirLine = useCallback((count: number) => {
    const s = speedRef.current;
    const lead = Math.max(320, Math.min(1100, s * 1.4));
    const x0 = SCREEN_W + lead;
    const gap = 34;
    const h = clamp(H_SINGLE * 0.85, H_STAR_MIN, H_DOUBLE * 0.95);
    const y = clampYCenter(yForHeight(h), R_COLLECTIBLE);
    for (let i = 0; i < count; i++) {
      const x = x0 + i * gap;
      collectiblesRef.current.push({ id: ++lastIdRef.current, x, y, r: R_COLLECTIBLE });
    }
  }, [H_SINGLE, H_DOUBLE, H_STAR_MIN, clampYCenter, yForHeight]);

  const spawnPlatformBlock = useCallback((x: number, y: number, w: number, h = PLATFORM_H) => {
    const platform: PlatformBlock = {
      id: ++lastIdRef.current,
      x,
      y: clamp(y, 24, GROUND_Y - h - 40),
      w: Math.max(90, w),
      h: Math.max(8, h),
    };
    platformsRef.current.push(platform);
    return platform;
  }, [GROUND_Y]);

  const spawnPlatformGatedCoins = useCallback((platform: PlatformBlock) => {
    const platformRise = Math.max(40, GROUND_Y - platform.y - platform.h);
    const gatedRise = Math.max(H_DOUBLE * 1.08, platformRise + H_SINGLE * 0.88);
    const y = clampYCenter(GROUND_Y - gatedRise, R_COLLECTIBLE);
    const releaseOffset = clamp(speedRef.current * 0.14, 28, 64);
    const startX = platform.x + platform.w + releaseOffset;
    const count = PLATFORM_GATE_COIN_COUNT;
    const gap = 30;
    for (let i = 0; i < count; i++) {
      collectiblesRef.current.push({
        id: ++lastIdRef.current,
        x: startX + i * gap,
        y,
        r: R_COLLECTIBLE,
      });
    }
  }, [GROUND_Y, H_DOUBLE, H_SINGLE, clampYCenter]);

  const spawnPattern = useCallback((minGap: number, gapMul: number, scoreNow: number): boolean => {
    if (!ENABLE_PLATFORMS) return false;
    if (scoreNow < OBSTACLE_PATTERN_MIN_SCORE) return false;
    if (patternCooldownDistRef.current > 0) return false;

    const harden = clamp(0.2 * (scoreNow / 120000), 0, 0.2);
    const localGapMul = gapMul * (1 - harden);
    const baseLead = Math.max(minGap, Math.floor(SCREEN_W * 0.78));
    const lead = Math.floor(baseLead * localGapMul);
    const extraLead = Math.max(1, Math.floor(OBSTACLE_MAX_GAP_BASE * localGapMul));
    const anchorX = SCREEN_W + lead + randi(20, extraLead);

    const roll = Math.random();
    const pattern: SpawnPattern =
      roll < 0.42 ? "platform_gate" : roll < 0.74 ? "double_trouble" : "risk_lane";

    if (pattern === "platform_gate") {
      const platformW = randi(PLATFORM_MIN_W, PLATFORM_MAX_W);
      const platformRise = randf(H_SINGLE * 0.72, Math.min(H_DOUBLE * 0.86, H_SINGLE * 1.08));
      const platformX = anchorX + randi(40, 160);
      const platformY = GROUND_Y - platformRise - PLATFORM_H;
      const platform = spawnPlatformBlock(platformX, platformY, platformW);

      const entryW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const entryH = OBSTACLE_BASE_H + randi(-6, 6);
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: platformX - randi(95, 145),
        w: entryW,
        h: entryH,
        y: GROUND_Y - entryH,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      if (Math.random() < 0.62) {
        const exitW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
        const exitH = OBSTACLE_BASE_H + randi(-8, 8);
        obstaclesRef.current.push({
          id: ++lastIdRef.current,
          x: platformX + platformW + randi(70, 140),
          w: exitW,
          h: exitH,
          y: GROUND_Y - exitH,
          variant: Math.random() < 0.5 ? 0 : 1,
        });
      }

      spawnPlatformGatedCoins(platform);
      patternCooldownDistRef.current = randi(PLATFORM_PATTERN_COOLDOWN_MIN, PLATFORM_PATTERN_COOLDOWN_MAX);
      return true;
    }

    if (pattern === "double_trouble") {
      const w1 = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h1 = OBSTACLE_BASE_H + randi(-8, 8);
      const x1 = anchorX;
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: x1,
        w: w1,
        h: h1,
        y: GROUND_Y - h1,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      const w2 = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h2 = OBSTACLE_BASE_H + randi(-8, 8);
      const gap = randi(170, 250);
      const x2 = x1 + w1 + gap;
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: x2,
        w: w2,
        h: h2,
        y: GROUND_Y - h2,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      if (ENABLE_COLLECTIBLES) {
        const y = clampYCenter(yForHeight(randf(H_SINGLE * 0.56, H_SINGLE * 0.92)), R_COLLECTIBLE);
        const coinGap = 34;
        const coinX = x1 + w1 + Math.max(26, (gap - coinGap * 2) / 2);
        for (let i = 0; i < 3; i++) {
          collectiblesRef.current.push({
            id: ++lastIdRef.current,
            x: coinX + i * coinGap,
            y,
            r: R_COLLECTIBLE,
          });
        }
      }

      patternCooldownDistRef.current = randi(PLATFORM_PATTERN_COOLDOWN_MIN, PLATFORM_PATTERN_COOLDOWN_MAX);
      return true;
    }

    const primaryW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W + 10);
    const primaryH = OBSTACLE_BASE_H + randi(-4, 10);
    const primaryX = anchorX + randi(0, 80);
    obstaclesRef.current.push({
      id: ++lastIdRef.current,
      x: primaryX,
      w: primaryW,
      h: primaryH,
      y: GROUND_Y - primaryH,
      variant: Math.random() < 0.5 ? 0 : 1,
    });

    const platformW = randi(120, 180);
    const platformRise = randf(H_SINGLE * 0.66, Math.min(H_DOUBLE * 0.82, H_SINGLE * 1.02));
    const platformX = primaryX + primaryW + randi(84, 140);
    const platformY = GROUND_Y - platformRise - PLATFORM_H;
    const platform = spawnPlatformBlock(platformX, platformY, platformW);

    const rewardY = clampYCenter(platform.y - 24, R_X2);
    if (Math.random() < 0.55) {
      powerUpsRef.current.push({
        id: ++lastIdRef.current,
        x: platform.x + platform.w * 0.5,
        y: rewardY,
        r: R_X2,
        kind: "x2",
      });
    } else {
      collectiblesRef.current.push({
        id: ++lastIdRef.current,
        x: platform.x + platform.w * 0.5,
        y: rewardY,
        r: R_COLLECTIBLE,
      });
    }

    patternCooldownDistRef.current = randi(PLATFORM_PATTERN_COOLDOWN_MIN, PLATFORM_PATTERN_COOLDOWN_MAX);
    return true;
  }, [
    GROUND_Y,
    H_DOUBLE,
    H_SINGLE,
    clampYCenter,
    spawnPlatformBlock,
    spawnPlatformGatedCoins,
    yForHeight,
  ]);

  // Spawn d'une lettre au palier désiré (0..5)
  const spawnLetterAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= LETTERS.length) return;
    if (spawnedLetterIdxThisRunRef.current.has(idx)) return; // déjà spawn pendant ce run
    const letter = LETTERS[idx];
    if (persistentLettersRef.current.has(letter)) return;     // déjà possédée

    spawnedLetterIdxThisRunRef.current.add(idx);

    const s = speedRef.current;
    const x = SCREEN_W + Math.max(420, Math.min(1200, s * 1.4));
    const h = randf(H_STAR_MIN, H_STAR_MAX);
    const y = clampYCenter(yForHeight(h), R_LETTER); // ← lettre plus grande
    powerUpsRef.current.push({ id: ++lastIdRef.current, x, y, r: R_LETTER, kind: "letter", letter });
  }, [H_STAR_MIN, H_STAR_MAX, clampYCenter, yForHeight]);

  const spawnObstacle = useCallback((minGap: number, gapMul: number, scoreNow: number) => {
    const harden = clamp(0.25 * (scoreNow / 120000), 0, 0.25);
    const localGapMul = gapMul * (1 - harden);
    const attempts = Math.max(1, Math.min(MAX_SPAWN_ATTEMPTS, Math.floor(speedRef.current / 60)));

    for (let i = 0; i < attempts; i++) {
      const w = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h = OBSTACLE_BASE_H + randi(-8, 8);
      const baseLead = Math.max(minGap, Math.floor(SCREEN_W * 0.75));
      const lead = Math.floor(baseLead * localGapMul);
      const x = SCREEN_W + lead + randi(0, Math.floor(OBSTACLE_MAX_GAP_BASE * localGapMul));
      const y = GROUND_Y - h;

      const candidateCenter = x + w / 2;
      const tooClose = obstaclesRef.current.some((o) => {
        const oCenter = o.x + o.w / 2;
        return Math.abs(oCenter - candidateCenter) < Math.max(minGap * 0.55, 190);
      });
      if (tooClose) continue;

      obstaclesRef.current.push({
        id: ++lastIdRef.current, x, w, h, y, variant: Math.random() < 0.5 ? 0 : 1
      });

      // pièces volantes
      if (ENABLE_COLLECTIBLES && Math.random() < 0.45) {
        const hStar = randf(H_STAR_MIN, H_STAR_MAX);
        const yStar = clampYCenter(yForHeight(hStar), R_COLLECTIBLE);
        collectiblesRef.current.push({ id: ++lastIdRef.current, x: x + Math.max(80, w + 40), y: yStar, r: R_COLLECTIBLE });
      }
      // bouclier
      if (ENABLE_SHIELD && Math.random() < 0.15) {
        const hShield = randf(H_STAR_MIN, H_STAR_MAX);
        const yShield = clampYCenter(yForHeight(hShield), R_POWERUP);
        powerUpsRef.current.push({ id: ++lastIdRef.current, x: x + randi(140, 240), y: yShield, r: R_POWERUP, kind: "shield" });
      }
      // double saut
      if (ENABLE_DOUBLEJUMP && Math.random() < 0.1) {
        const hDJ = randf(H_STAR_MIN, H_STAR_MAX);
        const yDJ = clampYCenter(yForHeight(hDJ), R_POWERUP);
        powerUpsRef.current.push({ id: ++lastIdRef.current, x: x + randi(180, 280), y: yDJ, r: R_POWERUP, kind: "doublejump" });
      }
      return;
    }

    // Fallback sécurité si aucune tentative n'a passé le filtre "tooClose"
    const w = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
    const h = OBSTACLE_BASE_H + randi(-8, 8);
    const baseLead = Math.max(minGap, Math.floor(SCREEN_W * 0.75));
    const lead = Math.floor(baseLead * localGapMul);
    const x = SCREEN_W + lead;
    obstaclesRef.current.push({
      id: ++lastIdRef.current,
      x,
      w,
      h,
      y: GROUND_Y - h,
      variant: Math.random() < 0.5 ? 0 : 1,
    });
  }, [GROUND_Y, H_STAR_MIN, H_STAR_MAX, clampYCenter, yForHeight]);

  const spawnX2BonusForDoubleJump = useCallback(() => {
    const s = speedRef.current;
    const leadTime = randf(1.1, 1.6);
    const leadPx = Math.max(260, Math.min(980, s * leadTime));
    const x = SCREEN_W + leadPx;
    const margin = 24;
    const hMin = Math.min(H_DOUBLE * 0.92, H_SINGLE + margin);
    const hMax = H_DOUBLE * 0.98;
    const h = randf(hMin, hMax);
    const y = clampYCenter(yForHeight(h), R_X2);
    powerUpsRef.current.push({ id: ++lastIdRef.current, x, y, r: R_X2, kind: "x2" });
  }, [H_DOUBLE, H_SINGLE, clampYCenter, yForHeight]);

  // ====== Main loop ======
  useEffect(() => {
    if (gameState !== "running") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = clamp((ts - lastTsRef.current) / 1000, 0, 0.05);
      lastTsRef.current = ts;

      // Map & diff
      const desiredMap = activeMapForScore(scoreRef.current);
      if (desiredMap !== mapBRef.current) {
        mapARef.current = mapFadeRef.current >= 0.99 ? mapBRef.current : mapARef.current;
        mapBRef.current = desiredMap;
        mapFadeRef.current = 0;
      }
      if (mapFadeRef.current < 1) {
        mapFadeRef.current = clamp(mapFadeRef.current + dt / MAP_FADE_SECS, 0, 1);
        if (mapFadeRef.current >= 1) {
          mapARef.current = mapBRef.current;
          mapFadeRef.current = 0;
        }
      }
      const diff = getDifficultyByMap(mapARef.current);

      // Vitesse
      targetSpeedRef.current += diff.speedGain * dt;
      const alphaSmooth = 1 - Math.exp(-SPEED_SMOOTHING * dt);
      speedRef.current = speedRef.current + (targetSpeedRef.current - speedRef.current) * alphaSmooth;
      const s = speedRef.current;

      // Parallax
      groundOffsetRef.current += s * dt;
      fenceOffsetRef.current += s * FENCE_SPEED * dt;
      mapAOffsetRef.current += s * BG_SPEED * dt;
      mapBOffsetRef.current += s * BG_SPEED * dt;
      patternCooldownDistRef.current = Math.max(0, patternCooldownDistRef.current - s * dt);

      // Gravité & saut
      const gravityBase = GRAVITY_BASE * diff.gravityMul;
      const gravityNow = (velYRef.current < 0 && holdingJumpRef.current) ? gravityBase * HOLD_GRAVITY_SCALE : gravityBase;
      velYRef.current += gravityNow * dt;

      let newY = yRef.current + velYRef.current * dt;
      const floorY = GROUND_Y - PLAYER_SIZE;
      let landingY = floorY;

      if (ENABLE_PLATFORMS && velYRef.current >= 0 && platformsRef.current.length > 0) {
        const prevBottom = yRef.current + PLAYER_SIZE;
        const nextBottom = newY + PLAYER_SIZE;
        const playerLeft = playerX + 6;
        const playerRight = playerX + PLAYER_SIZE - 6;

        for (const p of platformsRef.current) {
          const overlapX = playerRight > p.x + 8 && playerLeft < p.x + p.w - 8;
          if (!overlapX) continue;
          const crossedTop = prevBottom <= p.y + 6 && nextBottom >= p.y;
          if (!crossedTop) continue;
          landingY = Math.min(landingY, p.y - PLAYER_SIZE);
        }
      }

      if (newY >= landingY) {
        newY = landingY;
        if (!groundedRef.current) {
          groundedRef.current = true;
          lastGroundedTimeRef.current = ts / 1000;
          airJumpsLeftRef.current = doubleJumpActive() ? 1 : 0;

          if (jumpBufferRef.current > 0) {
            velYRef.current = JUMP_VELOCITY;
            groundedRef.current = false;
            jumpBufferRef.current = 0;
          } else {
            velYRef.current = 0;
          }
        } else {
          velYRef.current = 0;
        }
      } else {
        groundedRef.current = false;
        jumpBufferRef.current = Math.max(0, jumpBufferRef.current - dt);
      }
      yRef.current = newY;

      // Spin/roulis
      if (!groundedRef.current) {
        const rate = 8 + Math.min(10, Math.abs(velYRef.current) / 220);
        angleRef.current += rate * dt;
      } else {
        const omega = (s / Math.max(1, PLAYER_RADIUS)) * ROLL_VISUAL_MULT;
        angleRef.current += omega * dt;
      }

      // Monde actif
      if (obstaclesRef.current.length === 0) {
        if (!spawnPattern(OBSTACLE_MIN_GAP_BASE, diff.gapMul, scoreRef.current)) {
          spawnObstacle(OBSTACLE_MIN_GAP_BASE, diff.gapMul, scoreRef.current);
        }
      }

      for (let i = platformsRef.current.length - 1; i >= 0; i--) {
        const p = platformsRef.current[i];
        p.x -= s * dt;
        if (p.x + p.w <= -PLATFORM_MAX_OFFSCREEN) platformsRef.current.splice(i, 1);
      }

      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const o = obstaclesRef.current[i];
        o.x -= s * dt;
        if (o.x + o.w <= -40) obstaclesRef.current.splice(i, 1);
      }

      const last = obstaclesRef.current[obstaclesRef.current.length - 1];
      if (!last || last.x < SCREEN_W - randi(Math.floor(OBSTACLE_MIN_GAP_BASE * 0.7), OBSTACLE_MAX_GAP_BASE)) {
        const nextMinGap = randi(OBSTACLE_MIN_GAP_BASE, OBSTACLE_MAX_GAP_BASE);
        if (!spawnPattern(nextMinGap, diff.gapMul, scoreRef.current)) {
          spawnObstacle(nextMinGap, diff.gapMul, scoreRef.current);
        }
      }

      // ===== Collectibles (coins) =====
      for (let i = collectiblesRef.current.length - 1; i >= 0; i--) {
        const c = collectiblesRef.current[i];
        c.x -= s * dt;

        const cx = playerX + PLAYER_SIZE / 2;
        const cy = yRef.current + PLAYER_SIZE / 2;

        if (circleCircleCollide(cx, cy, PLAYER_SIZE * 0.38, c.x, c.y, c.r)) {
          runCoinsCollectedRef.current += 1;
          comboRef.current = Math.min(10, comboRef.current + 1);
          if (comboRef.current >= 10) unlock("combo_10");

          const base = Math.floor(100 * getSpeedMultiplier(s) * getComboMultiplier());
          const gained = applyScoreGain(base);

          setScore((prev) => {
            const next = prev + gained;
            scoreRef.current = next;
            checkMilestones(next);
            return next;
          });

          // SFX & popup
          playCoinSfx();
          popupsRef.current.push({ id: ++lastIdRef.current, x: c.x, y: c.y, born: Date.now(), text: `+${gained}` });

          collectiblesRef.current.splice(i, 1);

          heroPulse.setValue(0);
          Animated.timing(heroPulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
          if (settings.haptics && Haptics) Haptics.selectionAsync?.().catch(() => {});
          continue;
        }
        if (c.x + c.r < -20) {
          comboRef.current = 0;
          collectiblesRef.current.splice(i, 1);
        }
      }

      // ===== Power-ups (shield / doublejump / x2 / letter) =====
      for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
        const p = powerUpsRef.current[i];
        p.x -= s * dt;

        const cx = playerX + PLAYER_SIZE / 2;
        const cy = yRef.current + PLAYER_SIZE / 2;

        if (circleCircleCollide(cx, cy, PLAYER_SIZE * 0.38, p.x, p.y, p.r)) {
          if (p.kind === "shield") {
            // +100 points pour un bouclier
            const gained = applyScoreGain(100);
            setScore((prev) => {
              const next = prev + gained;
              scoreRef.current = next;
              checkMilestones(next);
              return next;
            });
            popupsRef.current.push({ id: ++lastIdRef.current, x: p.x, y: p.y, born: Date.now(), text: `+${gained}` });

            const newStacks = shieldStacksRef.current + 1;
            setShieldStacksSync(newStacks);
            setHasShieldSync(true); // ← on garde le shield actif

            if (newStacks >= SUPER_SHIELD_STACK) {
              // ⚡ Super Shield : on **ne retire plus** le bouclier normal !
              setShieldStacksSync(0);         // compteur reset
              // hasShield reste TRUE (on garde la protection à la fin du super)
              const until = Date.now() + SUPER_SHIELD_INVINCIBLE_MS;
              setSuperShieldUntilSync(until);
              setInvincibleUntilSync(until);

              // bonus visuel
              spawnCoinsGround(SUPER_SHIELD_GROUND_COINS, undefined, true);
              showToast("✨ Super Shield");
              if (settings.haptics && Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } else {
              showToast(`🛡️ ${newStacks}/${SUPER_SHIELD_STACK}`);
              if (settings.haptics && Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }

          } else if (p.kind === "doublejump") {
            const until = Date.now() + DOUBLEJUMP_DURATION;
            setDoubleJumpUntilSync(until);
            showToast("⛓️ Double saut");
            airJumpsLeftRef.current = 1;
            spawnX2BonusForDoubleJump();

          } else if (p.kind === "x2") {
            // +200 points pour une purple coin
            const plus = applyScoreGain(200);
            setScore(prev => {
              const next = prev + plus;
              scoreRef.current = next;
              checkMilestones(next);
              return next;
            });
            popupsRef.current.push({ id: ++lastIdRef.current, x: p.x, y: p.y, born: Date.now(), text: `+${plus}` });

            const now = Date.now();
            let nextPurpleChain = 1;
            if (now <= scoreMultUntilRef.current) {
              nextPurpleChain = Math.min(PURPLE_CHAIN_GOAL, purpleChainRef.current + 1);
            } else {
              nextPurpleChain = 1;
            }
            setPurpleChainSync(nextPurpleChain);
            purpleChainExpiresAtRef.current = now + SCORE_MULT_DURATION;

            if (now < scoreMultUntilRef.current) {
              scoreMultLevelRef.current = clamp(scoreMultLevelRef.current + 1, 2, 10);
              scoreMultUntilRef.current = now + SCORE_MULT_DURATION;
            } else {
              scoreMultLevelRef.current = 2;
              scoreMultUntilRef.current = now + SCORE_MULT_DURATION;
              if (!achievementsRef.current.first_x2) unlock("first_x2");
            }

            if ([2,5,10].includes(scoreMultLevelRef.current)) {
              showToast(`💜 ×${scoreMultLevelRef.current}`);
            }
            if (nextPurpleChain >= PURPLE_CHAIN_GOAL) {
              spawnCoinsAirLine(PURPLE_CHAIN_AIR_COINS);
              showToast("💜 Série ×10 !");
              playApplauseSfx();
              setPurpleChainSync(0);
              purpleChainExpiresAtRef.current = 0;
            }

          } else if (p.kind === "letter" && p.letter) {
            // Lettre : +1000 points (popup comme coins) + progression persistante
            addPersistentLetter(p.letter);
            const gained = applyScoreGain(1000);
            setScore(prev => {
              const next = prev + gained;
              scoreRef.current = next;
              checkMilestones(next);
              return next;
            });
            popupsRef.current.push({ id: ++lastIdRef.current, x: p.x, y: p.y, born: Date.now(), text: `+${gained}` });

            // Supprime le mini “badge” / carré : (rendu ajusté en Partie 3)
            showToast(`🔤 ${p.letter}`);

            if (haveAllLetters()) {
              // Jackpot 20k + overlay ultra visuel
              const bonus = applyScoreGain(20_000);
              setScore(prev => {
                const next = prev + bonus;
                scoreRef.current = next;
                checkMilestones(next);
                return next;
              });
              popupsRef.current.push({ id: ++lastIdRef.current, x: playerX + 40, y: yRef.current, born: Date.now(), text: `+${bonus}` });

              playApplauseSfx();
              showToast("🚀 COMETS !");
              setBigEventUntil(Date.now() + 2200); // ← affichage overlay (Partie 3)
            }
          }

          powerUpsRef.current.splice(i, 1);
          continue;
        }

        if (p.x + p.r < -20) {
          powerUpsRef.current.splice(i, 1); // raté
        }
      }

      // ===== Collisions avec obstacles =====
      const cx = playerX + PLAYER_SIZE / 2;
      const cy = yRef.current + PLAYER_SIZE / 2;
      const r = PLAYER_SIZE * 0.42;

      if (!(Date.now() < invincibleUntilRef.current || Date.now() < superShieldUntilRef.current)) {
        for (let i = 0; i < obstaclesRef.current.length; i++) {
          const o = obstaclesRef.current[i];
          if (circleRectCollide(cx, cy, r, o.x, o.y, o.w, o.h)) {
            if (hasShieldRef.current) {
              // Consomme la protection normale (OK)
              setHasShieldSync(false);
              setShieldStacksSync(0);
              setInvincibleUntilSync(Date.now() + INVINCIBLE_DURATION);
              velYRef.current = JUMP_VELOCITY * 0.7;
              obstaclesRef.current.splice(i, 1);
              shake.setValue(1);
              Animated.timing(shake, { toValue: 0, duration: 220, useNativeDriver: true }).start();
              if (settings.haptics && Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              break;
            } else {
              if (settings.haptics && Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
              endGame();
              break;
            }
          }
        }
      }

      // ===== Score distance =====
      distAccRef.current += s * dt;
      if (distAccRef.current >= 10) {
        const gainedUnits = Math.floor(distAccRef.current / 10);
        distAccRef.current -= gainedUnits * 10;

        setScore((prev) => {
          const base = Math.floor(gainedUnits * getSpeedMultiplier(s));
          const added = applyScoreGain(base);
          const next = prev + added;
          scoreRef.current = next;

          if (next >= 2000) unlock("score_2000");
          checkMilestones(next);

          // Paliers de lettres
          for (let i = 0; i < LETTER_THRESHOLDS.length; i++) {
            const threshold = LETTER_THRESHOLDS[i];
            if (next >= threshold && !spawnedLetterIdxThisRunRef.current.has(i) && !persistentLettersRef.current.has(LETTERS[i])) {
              spawnLetterAtIndex(i);
            }
          }
          return next;
        });
      }

      // Expiration chaîne purple
      if (purpleChainRef.current > 0 && Date.now() > purpleChainExpiresAtRef.current) {
        setPurpleChainSync(0);
      }

      // Popups (+pts)
      popupsRef.current = popupsRef.current.filter(p => Date.now() - p.born < 900);

      // Render tick
      setFrameTick((t) => (t + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [
    gameState,
    endGame,
    spawnObstacle,
    spawnPattern,
    spawnX2BonusForDoubleJump,
    settings.haptics,
    GROUND_Y,
    unlock,
    checkMilestones,
    spawnCoinsAirLine,
    spawnCoinsGround,
    playCoinSfx,
    playApplauseSfx,
    spawnLetterAtIndex,
    addPersistentLetter,
    applyScoreGain,
    haveAllLetters,
    heroPulse,
    playerX,
    shake,
    showToast,
    getSpeedMultiplier,
    getComboMultiplier,
    doubleJumpActive,
    setDoubleJumpUntilSync,
    setHasShieldSync,
    setInvincibleUntilSync,
    setPurpleChainSync,
    setShieldStacksSync,
    setSuperShieldUntilSync,
  ]);

  // ===== Input =====
  const tryJump = useCallback(() => {
    jumpBufferRef.current = 0.001 + JUMP_BUFFER;
    const now = performance.now() / 1000;
    const canCoyote = now - lastGroundedTimeRef.current <= COYOTE_TIME;

    if (groundedRef.current || canCoyote) {
      velYRef.current = JUMP_VELOCITY;
      groundedRef.current = false;
      lastGroundedTimeRef.current = -999;
      jumpBufferRef.current = 0;
      airJumpsLeftRef.current = doubleJumpActive() ? 1 : 0;
      if (settings.haptics && Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    if (doubleJumpActive() && airJumpsLeftRef.current > 0) {
      airJumpsLeftRef.current -= 1;
      velYRef.current = JUMP_VELOCITY * AIR_JUMP_FACTOR;
      if (settings.haptics && Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }
  }, [doubleJumpActive, settings.haptics]);

  const handlePressIn = useCallback(() => {
    if (gameState === "ready") {
      if (pendingSnapshot) return;
      startGame();
      return;
    }
    if (gameState === "paused") { resumeGame(); return; }
    if (gameState === "gameover") { if (Date.now() >= restartAllowedAtRef.current) startGame(); return; }
    if (gameState === "running") { holdingJumpRef.current = true; tryJump(); }
  }, [gameState, pendingSnapshot, startGame, resumeGame, tryJump]);

  const handlePressOut = useCallback(() => {
    holdingJumpRef.current = false;
    if (gameState === "running" && velYRef.current < 0) velYRef.current *= JUMP_CUT_MULT;
  }, [gameState]);

  // ===== Infos pour le rendu (Partie 3) =====
  const mapNow = mapARef.current;
  const mapAlpha = mapFadeRef.current;
  const showGround = mapNow !== "systeme_solaire";
  const showHeroHeader = gameState !== "running";

  const speedMult = Math.min(MULT_MAX, MULT_MIN + Math.max(0, speedRef.current - START_SPEED) / MULT_SCALE).toFixed(1);
  const scoreBuff = getActiveScoreMult();
  const dailyMissionDoneCount = useMemo(() => getDailyMissionDoneCount(dailyMissions), [dailyMissions]);

  const secsLeft = (ms: number) => Math.max(0, Math.ceil((ms - Date.now()) / 1000));
  const invBarInfo = () => {
    const now = Date.now();
    if (now < superShieldUntil) {
      const total = SUPER_SHIELD_INVINCIBLE_MS;
      const left = superShieldUntil - now;
      return { ratio: clamp(left / total, 0, 1), kind: "super" as const };
    } else if (now < invincibleUntil) {
      const total = INVINCIBLE_DURATION;
      const left = invincibleUntil - now;
      return { ratio: clamp(left / total, 0, 1), kind: "hit" as const };
    }
    return null;
  };

  const cometsFillArray = LETTERS.map(L => (persistentLettersRef.current.has(L) ? L : " "));
  const badges: { key: string; text: string; image?: any }[] = [];

  const superShieldActive = () => Date.now() < superShieldUntil;
  const doubleJumpActiveView = () => ENABLE_DOUBLEJUMP && doubleJumpUntil > Date.now();

  if (superShieldActive()) badges.push({ key: "super", text: `Super Shield ${secsLeft(superShieldUntil)}s`, image: imgShield });
  else if (hasShield)       badges.push({ key: "shield", text: "Bouclier actif", image: imgShield });

  if (shieldStacks > 0 && !superShieldActive() && !hasShield)
    badges.push({ key: "stack", text: `Stacks ${shieldStacks}/${SUPER_SHIELD_STACK}`, image: imgShield });

  if (doubleJumpActiveView()) badges.push({ key: "dj", text: `Double saut ${secsLeft(doubleJumpUntil)}s`, image: imgDouble });
  if (scoreBuff > 1)          badges.push({ key: "x2", text: `×${scoreBuff} ${Math.max(0, Math.ceil((scoreMultUntilRef.current - Date.now())/1000))}s`, image: imgX2 });

  const compactBadges = badges.slice(0, 3);
 // === Rendu ===
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header (caché en jeu) */}
      {showHeroHeader && (
        <LinearGradient
          colors={["#18253A", "#101A2C", HOME_UI.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.headerSlim,
            { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 8 : 12 },
          ]}
        >
  <View pointerEvents="none" style={styles.headerGlow} />
  {/* 1. Barre compacte */}
  <View style={styles.headerSlimRow}>
    <Pressable
      onPress={() => router.back()}
      style={styles.iconBtnSlim}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name="chevron-back" size={18} color={HOME_UI.accent} />
    </Pressable>

    <View style={styles.titleRowSlim}>
      <Image source={logoComets} style={styles.logoSlim} resizeMode="contain" />
      <View>
        <Text style={styles.titleSlim}>Comets Run</Text>
        <Text style={styles.titleSubSlim}>Mode arcade du club</Text>
      </View>
    </View>

    <View style={styles.headerActions}>
      <Pressable onPress={() => setShowHelp((v) => !v)} style={styles.iconBtnSlim}>
        <Icon name={showHelp ? "information" : "help-circle-outline"} size={18} color={HOME_UI.accent} />
      </Pressable>
      <Pressable onPress={() => router.push("/CometsLeaderboardScreen" as any)} style={styles.iconBtnSlim}>
        <Icon name="trophy-outline" size={18} color={HOME_UI.accent} />
      </Pressable>
      <Pressable onPress={() => toggleSetting("mute")} style={styles.iconBtnSlim}>
        <Icon
          name={settings.mute ? "volume-mute" : "volume-high"}
          size={18}
          color={settings.mute ? HOME_UI.muted : HOME_UI.accent}
        />
      </Pressable>
      <Pressable onPress={() => toggleSetting("haptics")} style={styles.iconBtnSlim}>
        <Icon name="sparkles-outline" size={18} color={settings.haptics ? "#10b981" : "#777"} />
      </Pressable>
      <Pressable onPress={() => toggleSetting("highContrast")} style={styles.iconBtnSlim}>
        <Icon name="contrast" size={18} color={settings.highContrast ? "#f59e0b" : "#777"} />
      </Pressable>
    </View>
  </View>

  {/* 2. Petites pastilles score */}
  <View style={styles.chipsSlimRow}>
    <View style={[styles.pill, styles.pillBest]}>
      <Text style={[styles.pillTxt, { color: "#0C7499" }]}>🏆 {best}</Text>
    </View>

    <Animated.View
      style={{
        transform: [{ scale: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
      }}
    >
      <View style={[styles.pill, styles.pillScore]}>
        <Text style={[styles.pillTxt, { color: "#111827" }]}>⚡ {score}</Text>
      </View>
    </Animated.View>

    <View style={[styles.pill, styles.pillSpeed]}>
      <Text style={[styles.pillTxt, { color: "#7c2d12" }]}>×{speedMult}</Text>
    </View>

    {scoreBuff > 1 && (
      <View style={[styles.pill, styles.pillBuff]}>
        <Text style={[styles.pillTxt, { color: "#4c1d95" }]}>💜 ×{scoreBuff}</Text>
      </View>
    )}
  </View>

  {/* 3. Bulle d’aide claire sur les bonus */}
  <View style={styles.missionHudWrap}>
    <View style={styles.missionHudHeader}>
      <Text style={styles.missionHudTitle}>Missions du jour</Text>
      <Text style={styles.missionHudCount}>
        {dailyMissionDoneCount}/{DAILY_MISSIONS.length}
      </Text>
    </View>
    {DAILY_MISSIONS.map((mission) => {
      const value = getDailyMissionValue(dailyMissions, mission.id);
      const done = value >= mission.target;
      return (
        <View key={mission.id} style={styles.missionHudRow}>
          <View style={[styles.missionHudDot, { backgroundColor: done ? "#22c55e" : mission.tint }]} />
          <Text style={styles.missionHudLabel}>{mission.label}</Text>
          <Text style={[styles.missionHudValue, done && styles.missionHudValueDone]}>
            {Math.min(value, mission.target)}/{mission.target}
          </Text>
        </View>
      );
    })}
  </View>

  {showHelp && (
    <View style={styles.helpPanel}>
      <Text style={styles.helpTitle}>À quoi servent les bonus ?</Text>

      <View style={styles.helpItem}>
        <Image source={imgCoin} style={styles.helpIcon} resizeMode="contain" />
        <Text style={styles.helpText}>
        <Text>
          <Text style={styles.helpStrong}>Pièce</Text>
          {" "}— +100 pts. Ramasse plusieurs de suite pour un{" "}
        </Text>
          <Text style={styles.helpStrong}>combo jusqu’à ×2</Text> (le combo se remet à 0 si tu en rates une).
        </Text>
      </View> 

      <View style={styles.helpItem}>
        <Image source={imgShield} style={styles.helpIcon} resizeMode="contain" />
        <Text style={styles.helpText}>
          <Text style={styles.helpStrong}>Bouclier</Text> — annule 1 choc. À{" "}
          <Text style={styles.helpStrong}>3 boucliers</Text>, tu actives un{" "}
          <Text style={styles.helpStrong}>Super Shield</Text> de 3s (invincibilité) <Text>(tu gardes le bouclier normal après).</Text>
        </Text>
      </View>

      <View style={styles.helpItem}>
        <Image source={imgDouble} style={styles.helpIcon} resizeMode="contain" />
        <Text style={styles.helpText}>
          <Text style={styles.helpStrong}>Double saut</Text> — pendant 10s, tu peux sauter une 2ᵉ fois en l’air.{" "}
          Juste après, un bonus <Text style={styles.helpStrong}>×2</Text> a souvent une trajectoire atteignable.
        </Text>
      </View>

      <View style={styles.helpItem}>
        <Image source={imgX2} style={styles.helpIcon} resizeMode="contain" />
        <Text style={styles.helpText}>
          <Text style={styles.helpStrong}>Pièce violette (×2)</Text> — active un multiplicateur{" "}
          <Text style={styles.helpStrong}>10s</Text>. Si tu en reprends avant la fin, il monte jusqu’à{" "}
          <Text style={styles.helpStrong}>×10</Text>. Une{" "}
          <Text style={styles.helpStrong}>série de 10</Text> déclenche <Text style={styles.helpStrong}>10 pièces</Text> en l’air.
        </Text>
      </View>
    </View>
  )}
</LinearGradient>
      )}

      {/* Score centré */}
      <View pointerEvents="none" style={styles.scoreBigWrap}>
        <Text style={styles.scoreBig}>{score}</Text>
      </View>

      {/* Bandeau COMETS (descendu un peu) */}
      {gameState === "running" && (
        <View pointerEvents="none" style={styles.cometsBannerWrap}>
          <Text style={styles.cometsBannerFill}>
            {cometsFillArray.map((ch, i) => (
              <Text key={i} style={{ opacity: ch === " " ? 0.1 : 1 }}>
                {ch}
              </Text>
            ))}
          </Text>
        </View>
      )}

      {/* Bouton pause */}
      {gameState === "running" && (
        <View pointerEvents="box-none" style={styles.hudWrap}>
          <Pressable onPress={pauseGame} style={styles.hudBtn}>
            <Icon name="pause" size={22} color={HOME_UI.accent} />
          </Pressable>
        </View>
      )}

      {/* Rappels compacts (max 3) */}
      {gameState === "running" && compactBadges.length > 0 && (
        <View pointerEvents="none" style={styles.leftRemindersRow}>
          {compactBadges.map((b) => (
            <View key={b.key} style={styles.reminderBadgeRow}>
              {b.image ? <Image source={b.image} style={styles.reminderIcon} resizeMode="contain" /> : null}
              <Text style={styles.reminderText}>{b.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* GAME AREA */}
      <Pressable
        onLayout={onGameAreaLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.gameArea}
        android_disableSound
        android_ripple={{ color: "transparent" }}
      >
        <Animated.View
          style={{
            transform: [
              {
                translateY: shake.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
            ],
          }}
        >
          <View style={styles.sky} pointerEvents="none" />

          {/* BACKGROUNDS A→B */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {renderMapBackground({
              screenH,
              bg: MAP_BG[mapARef.current],
              offsetRef: mapAOffsetRef,
              overlayDark: settings.highContrast ? 0.08 : 0.2,
              opacity: 1.0 - mapAlpha,
              yOffset: BG_Y_OFFSET,
            })}
            {renderMapBackground({
              screenH,
              bg: MAP_BG[mapBRef.current],
              offsetRef: mapBOffsetRef,
              overlayDark: settings.highContrast ? 0.05 : 0.12,
              opacity: mapFadeRef.current,
              yOffset: BG_Y_OFFSET_PREVIEW,
            })}
          </View>

          {renderFence({ SCREEN_W, GROUND_Y, fenceOffsetRef, settings })}

          {/* Sol */}
          {showGround && (
            <>
              <View
                style={[
                  styles.ground,
                  { top: GROUND_Y, backgroundColor: settings.highContrast ? "#fff" : "#ff7a00" },
                ]}
              />
              <View
                style={[
                  styles.groundDetail,
                  { top: GROUND_Y + 8, backgroundColor: settings.highContrast ? "#aaa" : "#402300" },
                ]}
              />
              {renderGroundStripes({ SCREEN_W, GROUND_Y, groundOffsetRef, settings })}
            </>
          )}

          {/* Ombre joueur */}
          <View
            style={{
              position: "absolute",
              left: playerX + PLAYER_RADIUS - 18,
              top: GROUND_Y - 10,
              width: 36,
              height: 10,
              backgroundColor: "#000",
              borderRadius: 6,
              opacity: showGround ? 0.25 : 0.08,
              transform: [{ scaleX: 1.1 }],
            }}
            pointerEvents="none"
          />

          {/* Aura double saut */}
          {ENABLE_DOUBLEJUMP && doubleJumpUntil > Date.now() && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: playerX - 6,
                top: yRef.current - 6,
                width: PLAYER_SIZE + 12,
                height: PLAYER_SIZE + 12,
                borderRadius: (PLAYER_SIZE + 12) / 2,
                borderWidth: 2,
                borderColor: "rgba(96,165,250,0.6)",
                backgroundColor: "rgba(96,165,250,0.10)",
                transform: [{ rotate: `${angleRef.current}rad` }],
              }}
            />
          )}

          {/* Halo bouclier */}
          {hasShield && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: playerX - 4,
                top: yRef.current - 4,
                width: PLAYER_SIZE + 8,
                height: PLAYER_SIZE + 8,
                borderRadius: (PLAYER_SIZE + 8) / 2,
                borderWidth: 2,
                borderColor: "rgba(34,197,94,0.5)",
              }}
            />
          )}

          {/* Halo Super Shield */}
          {Date.now() < superShieldUntil && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: playerX - 8,
                top: yRef.current - 8,
                width: PLAYER_SIZE + 16,
                height: PLAYER_SIZE + 16,
                borderRadius: (PLAYER_SIZE + 16) / 2,
                borderWidth: 3,
                borderColor: "rgba(255,215,0,0.8)",
              }}
            />
          )}

          {/* Joueur */}
          <Image
            source={logoComets}
            style={[
              styles.player,
              {
                left: playerX,
                top: yRef.current,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE,
                borderRadius: PLAYER_RADIUS,
                transform: [{ rotate: `${angleRef.current}rad` }],
                tintColor: (Date.now() < invincibleUntil || Date.now() < superShieldUntil)
                  ? "rgba(255,187,107,0.9)"
                  : undefined,
              },
            ]}
            resizeMode="contain"
          />

          {/* Barre-timer invincibilité */}
          {(() => {
            const info = invBarInfo();
            if (!info) return null;
            const W = 40, H = 4;
            const filled = Math.max(2, Math.floor(W * info.ratio));
            const top = yRef.current - 12;
            return (
              <View pointerEvents="none" style={{ position: "absolute", left: playerX + PLAYER_RADIUS - W / 2, top }}>
                <View style={{ width: W, height: H, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }} />
                <View style={{ position: "absolute", left: 0, top: 0, width: filled, height: H, borderRadius: 3, backgroundColor: info.kind === "super" ? "rgba(255,215,0,0.9)" : "rgba(255,255,255,0.85)" }} />
              </View>
            );
          })()}

          {/* Platforms */}
          {ENABLE_PLATFORMS &&
            platformsRef.current.map((p) => (
              <View
                key={`pl-${p.id}`}
                style={[
                  styles.platformBlock,
                  {
                    left: p.x,
                    top: p.y,
                    width: p.w,
                    height: p.h,
                    opacity: mapNow === "systeme_solaire" ? 0.94 : 1,
                  },
                ]}
              >
                <View style={styles.platformTop} />
              </View>
            ))}

          {/* Obstacles */}
          {obstaclesRef.current.map((o) => (
            <Image
              key={o.id}
              source={o.variant === 0 ? imgObs1 : imgObs2}
              style={[
                styles.obstacleImg,
                { left: o.x, top: o.y, width: o.w, height: o.h, opacity: mapNow === "systeme_solaire" ? 0.95 : 1 },
              ]}
              resizeMode="cover"
            />
          ))}

          {/* Collectibles */}
          {ENABLE_COLLECTIBLES &&
            collectiblesRef.current.map((c) => {
              const r = c.r ?? R_COLLECTIBLE;
              return (
                <Image
                  key={`c-${c.id}`}
                  source={imgCoin}
                  style={{ position: "absolute", left: c.x - r, top: c.y - r, width: r * 2, height: r * 2 }}
                  resizeMode="contain"
                />
              );
            })}

          {/* Power-ups */}
{powerUpsRef.current.map((p) => {
  if (p.kind === "letter") {
    const r = R_LETTER;
    const LETTER_COLOR = (StyleSheet.flatten(styles.letterManga).color as string) ?? "#ffd166";
             // rayon de ta zone lettre
    const ringR = Math.round(r * 1.15); // rayon visuel du cercle autour
    return (
      <View
        key={`p-${p.id}`}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: p.x - ringR,
          top:  p.y - ringR,
          width: ringR * 2,
          height: ringR * 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Cercle même couleur que la lettre */}
        <View
          style={{
            position: "absolute",
            left: 0, top: 0, right: 0, bottom: 0,
            borderRadius: ringR,
            borderWidth: 3,
            borderColor: LETTER_COLOR,
            backgroundColor: "rgba(255,209,102,0.12)", // léger fill
          }}
        />
        {/* Lettre en style manga */}
        <Text style={styles.letterManga}>{p.letter}</Text>
      </View>
    );
  }

            const src = p.kind === "shield" ? imgShield : p.kind === "doublejump" ? imgDouble : imgX2;
            const scale = p.kind === "shield" ? 1.45 : 1.0;
            const size = (p.kind === "x2" ? R_X2 * 2 : R_POWERUP * 2) * scale;
            const r = (p.kind === "x2" ? R_X2 : R_POWERUP) * scale;

            return (
              <View key={`p-${p.id}`} style={{ position: "absolute", left: p.x - r, top: p.y - r }}>
                {p.kind === "shield" && (
                  <View
                    style={{
                      position: "absolute",
                      left: -6,
                      top: -6,
                      right: -6,
                      bottom: -6,
                      borderRadius: (size + 12) / 2,
                      backgroundColor: "rgba(34,197,94,0.18)",
                      borderWidth: 2,
                      borderColor: "rgba(34,197,94,0.7)",
                    }}
                  />
                )}
                <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />
              </View>
            );
          })}

          {/* Popups +pts */}
          {popupsRef.current.map((p) => {
            const age = Date.now() - p.born;
            const t = Math.min(1, age / 900);
            const dy = -28 * t;
            const op = 1 - t;
            const scale = 1 + 0.1 * (1 - t);
            return (
              <View
                key={`pop-${p.id}`}
                pointerEvents="none"
                style={{ position: "absolute", left: p.x - 8, top: p.y - 22 + dy, transform: [{ scale }], opacity: op }}
              >
                <Text style={styles.popupPts}>{p.text}</Text>
              </View>
            );
          })}

          {/* Overlays (Ready / Pause) */}
          {gameState === "ready" && (
            <View pointerEvents="box-none" style={styles.playCtaWrap}>
              {pendingSnapshot && (
                <TouchableOpacity
                  onPress={() => {
                    resumeFromSnapshot().catch(() => {});
                  }}
                  activeOpacity={0.9}
                  style={styles.resumeSavedCtaBtn}
                  testID="resume-snapshot-button"
                >
                  <Icon name="play-circle" size={20} color="#0a0a0a" />
                  <Text style={styles.resumeSavedCtaTxt}>Reprendre la partie</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={startGame}
                activeOpacity={0.9}
                style={pendingSnapshot ? styles.playCtaBtnSecondary : styles.playCtaBtn}
                testID="play-button"
              >
                <Text style={pendingSnapshot ? styles.playCtaTxtSecondary : styles.playCtaTxt}>
                  {pendingSnapshot ? "Nouvelle partie" : "Jouez !"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

{gameState === "paused" && (
  <View pointerEvents="box-none" style={styles.resumeCtaWrap}>
    <TouchableOpacity
      onPress={resumeGame}
      activeOpacity={0.9}
      style={styles.resumeCtaBtn}
      testID="resume-button"
    >
      <Icon name="play" size={20} color="#0a0a0a" />
      <Text style={styles.resumeCtaTxt}>Reprendre</Text>
    </TouchableOpacity>
  </View>
)}


          {/* 🎉 Overlay “20 000” ultra-visuel */}
          {Date.now() < bigEventUntil && (
            <View style={styles.bigEventWrap}>
              <Text style={styles.bigEventText}>20 000 !</Text>
              <Text style={styles.bigEventSub}>COMETS complété — exceptionnel ✨</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {/* Toast global */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      )}

      {/* Game Over (le modal responsive sera ajusté en Partie 4) */}
      {gameState === "gameover" && (
        <GameOverModal
          visible
          onRestart={() => {
            if (Date.now() >= restartAllowedAtRef.current) startGame();
          }}
          onLeaderboard={() => router.push("/CometsLeaderboardScreen" as any)}
          top5={top5}
          myId={adminId || ""}
          myScore={score}
          dailyMissions={dailyMissions}
        />
      )}
    </SafeAreaView>
  );
} // ← fin du composant

// ---- Helpers de rendu (hors composant) ----
function renderGroundStripes({ SCREEN_W, GROUND_Y, groundOffsetRef, settings }: any) {
  const stripes: React.ReactElement[] = [];
  const stripeSpan = STRIPE_W * 3;
  const offset = -((groundOffsetRef.current % stripeSpan) | 0);
  for (let x = -stripeSpan; x < SCREEN_W + stripeSpan; x += stripeSpan) {
    stripes.push(
      <View
        key={`g-${x}`}
        style={{
          position: "absolute",
          left: x + offset,
          top: GROUND_Y - STRIPE_H - 2,
          width: STRIPE_W,
          height: STRIPE_H,
          backgroundColor: settings.highContrast ? "#fff" : "#2b1900",
          borderRadius: 3,
          opacity: settings.highContrast ? 0.7 : 1,
        }}
      />
    );
  }
  return stripes;
}

function renderFence({ SCREEN_W, GROUND_Y, fenceOffsetRef, settings }: any) {
  const posts: React.ReactElement[] = [];
  const span = 52;
  const offset = -((fenceOffsetRef.current % span) | 0);
  for (let x = -span; x < SCREEN_W + span; x += span) {
    posts.push(
      <View
        key={`p-${x}`}
        style={{
          position: "absolute",
          left: x + offset,
          top: GROUND_Y - 54,
          width: 6,
          height: 48,
          backgroundColor: settings.highContrast ? "#fff" : "#1f2937",
          borderRadius: 3,
          opacity: 0.7,
        }}
      />
    );
  }
  return (
    <>
      {posts}
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 46, height: 2, backgroundColor: settings.highContrast ? "#fff" : "#1f2937", opacity: 0.7 }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 32, height: 2, backgroundColor: settings.highContrast ? "#fff" : "#1f2937", opacity: 0.7 }} />
    </>
  );
}

function renderMapBackground({
  screenH,
  bg,
  offsetRef,
  overlayDark,
  opacity,
  yOffset = 0,
}: {
  screenH: number;
  bg: any;
  offsetRef: React.MutableRefObject<number>;
  overlayDark: number;
  opacity: number;
  yOffset?: number;
}) {
  const w = SCREEN_W;
  const o = -((offsetRef.current % w) | 0);
  return (
    <View style={{ ...StyleSheet.absoluteFillObject, opacity }} pointerEvents="none">
      <ImageBackground
        source={bg}
        style={{ position: "absolute", left: o, top: 0, width: w, height: screenH }}
        imageStyle={{ transform: [{ translateY: yOffset }] }}
        resizeMode="cover"
      />
      <ImageBackground
        source={bg}
        style={{ position: "absolute", left: o + w, top: 0, width: w, height: screenH }}
        imageStyle={{ transform: [{ translateY: yOffset }] }}
        resizeMode="cover"
      />
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: `rgba(0,0,0,${overlayDark})` }} />
    </View>
  );
}

function getSystemTopInset() {
  return Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
}
// Game Over modal (ultra responsive, sans dépassement)
function GameOverModal({
  visible,
  onRestart,
  onLeaderboard,
  top5,
  myId,
  myScore,
  dailyMissions,
}: {
  visible: boolean;
  onRestart: () => void;
  onLeaderboard: () => void;
  top5: LBRow[] | null;
  myId: string;
  myScore: number;
  dailyMissions: DailyMissionState;
}) {
  const { width, height } = useWindowDimensions();

  // Backdrop paddings pour éviter la gesture bar et coller aux bords
  const overlayHPad = 12;
  const overlayVPad = 16;
  const sysTop = getSystemTopInset();
  const safetyBottom = 20;

  // Dimensions dispo réelles
  const usableH = Math.max(
    240,
    height - (sysTop + overlayVPad * 2 + safetyBottom)
  );
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  const maxW = Math.min(480, shortSide - overlayHPad * 2);
  const maxH = Math.min(Math.floor(longSide * 0.9), Math.floor(usableH));

  // --- Autoscale du contenu selon la place ---
  // Baseline visuelle du design (valeur empirique)
  const BASE_H = 560;
  const scale = Math.max(0.82, Math.min(1, maxH / BASE_H)); // clamp 0.82 → 1

  const ms = (v: number) => Math.round(v * scale); // helper "moderate scale"

  // Sur très petit écran, on limite à 3 entrées + “+N autres”
  const maxRows = scale < 0.92 ? 3 : 5;

  const extraCount = useMemo(() => {
    if (!top5 || !Array.isArray(top5)) return 0;
    return Math.max(0, top5.length - maxRows);
  }, [top5, maxRows]);

  const cardStyle = {
    width: maxW,
    maxHeight: maxH,
    backgroundColor: HOME_UI.panel,
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.34)",
    overflow: "hidden" as const,
    alignSelf: "center" as const,
    flexShrink: 1 as const,
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onRestart}>
      {/* Backdrop neutre pour éviter un restart accidentel */}
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(7,10,17,0.72)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: overlayHPad,
          paddingVertical: overlayVPad,
          paddingTop: overlayVPad + sysTop + -100, // petit bonus pour le notch
        }}
      >
        {/* Carte (stop propagation) */}
        <View style={cardStyle}>
          <ScrollView
            style={{ maxHeight: maxH }}
            contentContainerStyle={{
              padding: ms(12),
              paddingBottom: ms(36), // pour ne jamais couper le bas
              alignItems: "center",
            }}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
{/* Bouton Rejouez */}
<TouchableOpacity
  onPress={onRestart}
  activeOpacity={0.9}
  style={{
    marginTop: ms(4),
    paddingHorizontal: ms(28),
    paddingVertical: ms(14),
    borderRadius: ms(14),
    backgroundColor: HOME_UI.accent,
    borderWidth: 1,
    borderColor: HOME_UI.accentSoft,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <Icon name="reload" size={ms(20)} color="#111827" />
  <Text style={{ color: "#111827", fontSize: ms(18), fontWeight: "900", marginLeft: ms(8) }}>
    Rejouez !
  </Text>
</TouchableOpacity>


            {/* Top */}
            <View style={{ alignSelf: "stretch", marginTop: ms(12) }}>
              <Text
                style={{
                  color: HOME_UI.text,
                  fontWeight: "800",
                  marginBottom: ms(6),
                  textAlign: "center",
                  fontSize: ms(14),
                }}
              >
                Top scores (7 jours)
              </Text>

              {top5 === null ? (
                <Text style={{ color: HOME_UI.muted, textAlign: "center", fontSize: ms(12) }}>
                  Chargement…
                </Text>
              ) : top5.length === 0 ? (
                <Text style={{ color: HOME_UI.muted, textAlign: "center", fontSize: ms(12) }}>
                  Aucun score sur 7 jours
                </Text>
              ) : (
                <>
                  {top5.slice(0, maxRows).map((row, idx) => {
                    const isMe = !!row.admin_id && !!myId && row.admin_id === myId;
                    const first = row.admins?.first_name ?? "";
                    const last = row.admins?.last_name ?? "";
                    const display = (first || last) ? `${first} ${last}`.trim() : "Anonyme";
                    return (
                      <View
                        key={(row.admin_id ?? "anon") + String(idx)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: ms(6),
                          paddingHorizontal: ms(10),
                          borderRadius: ms(10),
                          marginBottom: ms(6),
                          backgroundColor: isMe ? "rgba(255,130,0,0.22)" : "rgba(20,29,44,0.86)",
                          borderWidth: 1,
                          borderColor: isMe ? "rgba(255,170,88,0.95)" : "rgba(255,255,255,0.12)",
                        }}
                      >
                        <Text
                          style={{
                            width: ms(22),
                            color: isMe ? "#111827" : HOME_UI.text,
                            fontWeight: "800",
                            backgroundColor: isMe ? HOME_UI.accent : "transparent",
                            textAlign: "center",
                            borderRadius: ms(6),
                            fontSize: ms(12),
                            paddingVertical: ms(1),
                          }}
                        >
                          {idx + 1}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            marginLeft: ms(10),
                            color: HOME_UI.text,
                            fontWeight: isMe ? "800" : "600",
                            fontSize: ms(13),
                          }}
                        >
                          {display}
                          {isMe ? " (vous)" : ""}
                        </Text>
                        <Text style={{ color: "#9ED4FF", fontWeight: "800", fontSize: ms(13) }}>
                          {row.best_score}
                        </Text>
                      </View>
                    );
                  })}
                  {extraCount > 0 && (
                    <Text
                      style={{
                        color: HOME_UI.muted,
                        textAlign: "center",
                        marginTop: ms(2),
                        fontSize: ms(12),
                      }}
                    >
                      +{extraCount} autres joueurs
                    </Text>
                  )}
                </>
              )}
            </View>

            {/* Score joueur */}
            <View
              style={{
                alignSelf: "stretch",
                marginTop: ms(8),
                padding: ms(10),
                borderRadius: ms(12),
                borderWidth: 1,
                borderColor: "rgba(255,130,0,0.45)",
                backgroundColor: "rgba(255,130,0,0.14)",
              }}
            >
              <Text
                style={{
                  color: "#FFE2BF",
                  fontWeight: "900",
                  textAlign: "center",
                  fontSize: ms(15),
                }}
              >
                Ton score : {myScore}
              </Text>
            </View>

            <View
              style={{
                alignSelf: "stretch",
                marginTop: ms(8),
                padding: ms(10),
                borderRadius: ms(12),
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                backgroundColor: "rgba(20,29,44,0.86)",
              }}
            >
              <Text
                style={{
                  color: HOME_UI.text,
                  fontWeight: "900",
                  textAlign: "center",
                  fontSize: ms(13),
                  marginBottom: ms(6),
                }}
              >
                Missions: {getDailyMissionDoneCount(dailyMissions)}/{DAILY_MISSIONS.length}
              </Text>
              {DAILY_MISSIONS.map((mission) => {
                const value = getDailyMissionValue(dailyMissions, mission.id);
                const done = value >= mission.target;
                return (
                  <View
                    key={`go-${mission.id}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: ms(4),
                    }}
                  >
                    <Text style={{ color: "#d8dfec", fontSize: ms(12), fontWeight: "700" }}>
                      {mission.label}
                    </Text>
                    <Text
                      style={{
                        color: done ? "#86efac" : "#bec8d8",
                        fontSize: ms(12),
                        fontWeight: "800",
                      }}
                    >
                      {Math.min(value, mission.target)}/{mission.target}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Bouton leaderboard */}
            <TouchableOpacity
              onPress={onLeaderboard}
              activeOpacity={0.8}
              style={{
                marginTop: ms(12),
                marginBottom: ms(4),
                paddingHorizontal: ms(14),
                paddingVertical: ms(10),
                borderRadius: ms(10),
                backgroundColor: HOME_UI.panelSoft,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
                alignSelf: "center",
              }}
              testID="go-to-leaderboard"
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <Icon name="trophy-outline" size={ms(16)} color="#FFD27A" />
                <Text style={{ marginLeft: ms(8), color: HOME_UI.text, fontWeight: "800", fontSize: ms(14) }}>
                  Voir le classement 🏆
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// --- Styles (ajouts : styleLettreManga, bigEventOverlay, etc.)
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: HOME_UI.bg,
  },
  gameArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#09101B",
  },

  leftRemindersRow: {
    position: "absolute",
    left: 12,
    top: Platform.OS === "android" ? 64 : 70,
    zIndex: 10,
    flexDirection: "row",
    gap: 6,
  },
  reminderBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(19,27,42,0.92)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  reminderIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  reminderText: {
    color: HOME_UI.text,
    fontWeight: "800",
    fontSize: 12,
  },

  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
  },
  groundDetail: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
  },
  player: {
    position: "absolute",
    backgroundColor: "transparent",
    backfaceVisibility: "hidden",
  },
  obstacleImg: {
    position: "absolute",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  platformBlock: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(19,27,42,0.92)",
    overflow: "hidden",
  },
  platformTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 5,
    backgroundColor: "rgba(255,130,0,0.9)",
  },

  toast: {
    position: "absolute",
    top: Platform.OS === "android" ? 64 : 72,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(19,27,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.42)",
  },
  toastTxt: {
    color: "#FFD27A",
    fontWeight: "800",
  },

  hudWrap: {
    position: "absolute",
    left: 16,
    top: Platform.OS === "android" ? 12 : 16,
    zIndex: 10,
  },
  hudBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.34)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
  },

  scoreBigWrap: {
    position: "absolute",
    top: Platform.OS === "android" ? 6 : 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9,
  },
  scoreBig: {
    color: HOME_UI.accent,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1.2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    backgroundColor: "rgba(11,15,23,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.42)",
  },

  popupPts: {
    color: "#FFD27A",
    fontSize: 14,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    backgroundColor: "rgba(11,15,23,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,209,102,0.38)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  cometsBannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: Platform.OS === "android" ? 68 : 76,
    alignItems: "center",
    zIndex: 1,
  },
  cometsBannerFill: {
    color: "#FFD27A",
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: 8,
    opacity: 0.22,
  },
  letterManga: {
    color: "#FFD27A",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  bigEventWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  bigEventText: {
    color: "#FFD27A",
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  bigEventSub: {
    marginTop: 6,
    color: HOME_UI.text,
    fontSize: 16,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  playCtaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    alignItems: "center",
    gap: 10,
    zIndex: 12,
  },
  playCtaBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: HOME_UI.accent,
    borderWidth: 1,
    borderColor: HOME_UI.accentSoft,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  playCtaTxt: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  playCtaBtnSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  playCtaTxtSecondary: {
    color: HOME_UI.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  resumeSavedCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: HOME_UI.accent,
    borderWidth: 1,
    borderColor: HOME_UI.accentSoft,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  resumeSavedCtaTxt: {
    marginLeft: 8,
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  resumeCtaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    alignItems: "center",
    zIndex: 12,
  },
  resumeCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: HOME_UI.accent,
    borderWidth: 1,
    borderColor: HOME_UI.accentSoft,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  resumeCtaTxt: {
    marginLeft: 8,
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  headerSlim: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,130,0,0.34)",
    paddingBottom: 8,
    overflow: "hidden",
  },
  headerGlow: {
    position: "absolute",
    right: -90,
    top: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,130,0,0.18)",
  },
  headerSlimRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtnSlim: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.34)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
  },
  titleRowSlim: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  logoSlim: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: HOME_UI.accent,
  },
  titleSlim: {
    color: HOME_UI.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  titleSubSlim: {
    marginTop: 1,
    color: "#D4D8E0",
    fontSize: 11.5,
    fontWeight: "700",
  },

  chipsSlimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  pillBest: {
    backgroundColor: "rgba(209,243,255,0.95)",
    borderColor: "rgba(146,204,226,0.95)",
  },
  pillScore: {
    backgroundColor: "rgba(229,231,235,0.95)",
    borderColor: "rgba(255,255,255,0.92)",
  },
  pillSpeed: {
    backgroundColor: "rgba(253,230,138,0.95)",
    borderColor: "rgba(255,205,95,0.95)",
  },
  pillBuff: {
    backgroundColor: "rgba(233,213,255,0.95)",
    borderColor: "rgba(196,167,238,0.95)",
  },
  pillTxt: {
    fontWeight: "800",
    fontSize: 12.5,
  },
  missionHudWrap: {
    marginTop: 8,
    marginHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.35)",
    backgroundColor: "rgba(10,16,28,0.86)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  missionHudHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  missionHudTitle: {
    color: HOME_UI.text,
    fontWeight: "900",
    fontSize: 12,
  },
  missionHudCount: {
    color: "#86efac",
    fontWeight: "900",
    fontSize: 11.5,
  },
  missionHudRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  missionHudDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  missionHudLabel: {
    flex: 1,
    color: "#d8dfec",
    fontSize: 11.5,
    fontWeight: "700",
  },
  missionHudValue: {
    color: "#bec8d8",
    fontSize: 11,
    fontWeight: "800",
  },
  missionHudValueDone: {
    color: "#86efac",
  },

  helpPanel: {
    marginTop: 8,
    marginHorizontal: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.34)",
    backgroundColor: "rgba(19,27,42,0.94)",
  },
  helpTitle: {
    color: HOME_UI.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 6,
  },
  helpItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  helpIcon: {
    width: 18,
    height: 18,
    marginTop: 2,
  },
  helpText: {
    flex: 1,
    color: "#E4EAF4",
    fontSize: 12.5,
    lineHeight: 18,
  },
  helpStrong: {
    fontWeight: "800",
    color: "#FFD27A",
  },
});


