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
const COMETS_RUN_PLAYER_STATE_PATH = "/api/comets-run/player-state";
const PUSH_COMETS_RUN_SECRET = process.env.EXPO_PUBLIC_PUSH_COMETS_RUN_SECRET || "";
const unavailableLocalApiBases = new Set<string>();
const loggedLocalApiFallbackBases = new Set<string>();

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
const OBSTACLE_PATTERN_MIN_SCORE = 900;

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
const RUN_RENDER_INTERVAL_MS = Platform.OS === "android" ? 34 : 28;
const RUN_RENDER_INTERVAL_HIGH_LOAD_MS = Platform.OS === "android" ? 46 : 36;
const RENDER_LOAD_ENTITY_THRESHOLD = 22;
const MAX_VISIBLE_POPUPS = 6;
const TRAIL_DOT_COUNT = 3;
const LETTER_RING_COLOR = "#FFD27A";

// Storage keys
const KEY_BEST = "COMETS_RUNNER_BEST";
const KEY_SETTINGS = "COMETS_RUNNER_SETTINGS";
const KEY_ACH = "COMETS_RUNNER_ACHIEVEMENTS";
const KEY_COMETS_PROGRESS = "COMETS_RUNNER_COMETS_PROGRESS"; // persistance C-O-M-E-T-S
const KEY_PAUSE_SNAPSHOT = "COMETS_RUNNER_PAUSE_SNAPSHOT";
const KEY_DAILY_MISSIONS = "COMETS_RUNNER_DAILY_MISSIONS";
const KEY_META_STATS = "COMETS_RUNNER_META_STATS";
const KEY_LOADOUT = "COMETS_RUNNER_LOADOUT";


const DOUBLEJUMP_DURATION = 10_000;
const INVINCIBLE_DURATION = 900; // post-choc court

// Rayon collectibles (coins / powerups)
const R_COLLECTIBLE = 14;
const R_POWERUP = 16;
const R_X2 = 18;

// 💥 Lettre : plus grande pour la prise — nouveau
const R_LETTER = 24;

// Durée multiplicateur (purple coin)
const SCORE_MULT_DURATION = 6_500;

// --- HUD anti-spam (toasts)
const TOAST_MIN_INTERVAL_MS = 900;

// Super shield
const SUPER_SHIELD_STACK = 3;
const SUPER_SHIELD_INVINCIBLE_MS = 3000;
const SUPER_SHIELD_GROUND_COINS = 5;
const SUPER_SHIELD_COIN_SCALE = 1.6; // pièces plus grosses

// Purple combo
const PURPLE_CHAIN_GOAL = 12;
const PURPLE_CHAIN_AIR_COINS = 8;
const PURPLE_SCORE_BASE = 90;
const PURPLE_MAX_MULT = 6;
const DOUBLEJUMP_X2_SPAWN_CHANCE = 0.42;

const NEAR_MISS_X_WINDOW = 52;
const NEAR_MISS_Y_WINDOW = 28;
const NEAR_MISS_BASE_SCORE = 150;

// COMETS (ordre strict)
const LETTERS = ["C","O","M","E","T","S"] as const;
type CometsLetter = typeof LETTERS[number];

// COMETS arrive plus vite pour creer un moment fort sur une run classique
const LETTER_THRESHOLDS = [4_000, 8_500, 14_000, 20_000, 27_500, 36_000] as const;
const LETTER_SPAWN_SCORE_BUFFER = 4_500;

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
type Obstacle = { id: number; x: number; w: number; h: number; y: number; variant: 0 | 1; grazed?: boolean };
type Collectible = { id: number; x: number; y: number; r: number };
type PlatformBlock = { id: number; x: number; y: number; w: number; h: number };
type PowerUpKind = "shield" | "doublejump" | "x2" | "letter";
type PowerUp = { id: number; x: number; y: number; r: number; kind: PowerUpKind; letter?: CometsLetter };
type GameState = "ready" | "running" | "paused" | "gameover";
type Settings = { mute: boolean; haptics: boolean; highContrast: boolean; };
type SpawnPattern = "platform_gate" | "double_trouble" | "risk_lane" | "stairway" | "rapid_triple" | "split_route" | "purple_gauntlet";

type TrailId = "classic" | "plasma" | "solar";
type ThemeId = "club" | "nebula" | "red_clay";
type TitleId = "rookie" | "risk_taker" | "all_star" | "captain";
type PerkId = "none" | "starter_shield" | "air_mastery" | "purple_open";

type Loadout = {
  trail: TrailId;
  theme: ThemeId;
  title: TitleId;
  perk: PerkId;
};

type MetaStats = {
  totalRuns: number;
  totalNearMisses: number;
  totalMissionCompletions: number;
  bestScoreEver: number;
};

type RunMeta = {
  beatBest: boolean;
  previousBest: number;
  previousWeeklyRank: number | null;
  currentWeeklyRank: number | null;
  weeklyRankGain: number;
  enteredWeeklyBoard: boolean;
};

type PlayerStateUnlockedItems = {
  trails: TrailId[];
  themes: ThemeId[];
  titles: TitleId[];
  perks: PerkId[];
};

type CloudPlayerStateRow = {
  admin_id: string;
  loadout: unknown;
  meta_stats: unknown;
  achievements: unknown;
  unlocked_items: unknown;
  updated_at?: string | null;
};

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
  { id: "coins", label: "40 pièces", target: 40, tint: "#F59E0B" },
  { id: "score", label: "Score 2500", target: 2500, tint: "#A78BFA" },
];

const DEFAULT_META_STATS: MetaStats = {
  totalRuns: 0,
  totalNearMisses: 0,
  totalMissionCompletions: 0,
  bestScoreEver: 0,
};

const DEFAULT_LOADOUT: Loadout = {
  trail: "classic",
  theme: "club",
  title: "rookie",
  perk: "none",
};

const TRAIL_OPTIONS: readonly {
  id: TrailId;
  label: string;
  accent: string;
  unlockLabel: string;
  isUnlocked: (meta: MetaStats, achievements: Record<AchievementKey, boolean>, best: number) => boolean;
}[] = [
  { id: "classic", label: "Classic", accent: "#FF8200", unlockLabel: "De base", isUnlocked: () => true },
  { id: "plasma", label: "Plasma", accent: "#67E8F9", unlockLabel: "Combo 10", isUnlocked: (_meta, achievements) => achievements.combo_10 },
  { id: "solar", label: "Solar", accent: "#FBBF24", unlockLabel: "Best 10k", isUnlocked: (_meta, _achievements, best) => best >= 10_000 },
];

const THEME_OPTIONS: readonly {
  id: ThemeId;
  label: string;
  accent: string;
  unlockLabel: string;
  isUnlocked: (meta: MetaStats, achievements: Record<AchievementKey, boolean>, best: number) => boolean;
}[] = [
  { id: "club", label: "Club", accent: "#FF8200", unlockLabel: "De base", isUnlocked: () => true },
  { id: "nebula", label: "Nebula", accent: "#7C3AED", unlockLabel: "3 missions", isUnlocked: (meta) => meta.totalMissionCompletions >= 3 },
  { id: "red_clay", label: "Red Clay", accent: "#FB7185", unlockLabel: "Best 15k", isUnlocked: (_meta, _achievements, best) => best >= 15_000 },
];

const TITLE_OPTIONS: readonly {
  id: TitleId;
  label: string;
  accent: string;
  unlockLabel: string;
  isUnlocked: (meta: MetaStats, achievements: Record<AchievementKey, boolean>, best: number) => boolean;
}[] = [
  { id: "rookie", label: "Rookie", accent: "#D1D5DB", unlockLabel: "De base", isUnlocked: () => true },
  { id: "risk_taker", label: "Risk Taker", accent: "#F97316", unlockLabel: "15 near-miss", isUnlocked: (meta) => meta.totalNearMisses >= 15 },
  { id: "all_star", label: "All-Star", accent: "#22D3EE", unlockLabel: "Best 10k", isUnlocked: (_meta, _achievements, best) => best >= 10_000 },
  { id: "captain", label: "Captain", accent: "#FACC15", unlockLabel: "6 missions", isUnlocked: (meta) => meta.totalMissionCompletions >= 6 },
];

const PERK_OPTIONS: readonly {
  id: PerkId;
  label: string;
  accent: string;
  description: string;
  unlockLabel: string;
  isUnlocked: (meta: MetaStats, achievements: Record<AchievementKey, boolean>, best: number) => boolean;
}[] = [
  { id: "none", label: "Aucun", accent: "#9CA3AF", description: "Run pure", unlockLabel: "De base", isUnlocked: () => true },
  { id: "starter_shield", label: "Shield", accent: "#22C55E", description: "Bouclier de départ", unlockLabel: "3 runs", isUnlocked: (meta) => meta.totalRuns >= 3 },
  { id: "air_mastery", label: "Air", accent: "#60A5FA", description: "Double saut au départ", unlockLabel: "Score 2000", isUnlocked: (_meta, achievements) => achievements.score_2000 },
  { id: "purple_open", label: "Purple", accent: "#C084FC", description: "x2 au lancement", unlockLabel: "Premier x2", isUnlocked: (_meta, achievements) => achievements.first_x2 },
];

const THEME_PRESETS: Record<ThemeId, { ground: string; detail: string; fence: string; scoreBg: string }> = {
  club: { ground: "#ff7a00", detail: "#402300", fence: "#1f2937", scoreBg: "rgba(11,15,23,0.72)" },
  nebula: { ground: "#7C3AED", detail: "#312E81", fence: "#3B0764", scoreBg: "rgba(23,15,38,0.74)" },
  red_clay: { ground: "#FB7185", detail: "#7F1D1D", fence: "#4B5563", scoreBg: "rgba(33,16,20,0.74)" },
};

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

function normalizeMetaStats(raw: unknown): MetaStats {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_META_STATS };
  const data = raw as Partial<MetaStats>;
  return {
    totalRuns: Number.isFinite(Number(data.totalRuns)) ? Math.max(0, Math.floor(Number(data.totalRuns))) : 0,
    totalNearMisses: Number.isFinite(Number(data.totalNearMisses)) ? Math.max(0, Math.floor(Number(data.totalNearMisses))) : 0,
    totalMissionCompletions: Number.isFinite(Number(data.totalMissionCompletions)) ? Math.max(0, Math.floor(Number(data.totalMissionCompletions))) : 0,
    bestScoreEver: Number.isFinite(Number(data.bestScoreEver)) ? Math.max(0, Math.floor(Number(data.bestScoreEver))) : 0,
  };
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

function resolveUnlockedId<T extends { id: string }>(
  preferred: string | undefined,
  items: readonly T[],
  isUnlocked: (item: T) => boolean,
) {
  const unlocked = items.filter(isUnlocked);
  const fallback = unlocked[0] ?? items[0];
  if (!preferred) return fallback.id;
  return unlocked.some((item) => item.id === preferred) ? preferred : fallback.id;
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
const MAP_MIN_DWELL_MS = 12_000;
const MINI_EVENT_FIRST_DELAY_MS = 20_000;
const MINI_EVENT_COOLDOWN_MIN_MS = 24_000;
const MINI_EVENT_COOLDOWN_MAX_MS = 34_000;
const MINI_EVENT_DURATION_MS = 5_200;
const MINI_EVENT_BURST_MS = 950;
const MARS_ASCENT_ARM_MS = 1_350;

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
type MapEffect = {
  label: string;
  subtitle: string;
  hudNote: string;
  accent: string;
  coinBonus: number;
  x2Bonus: number;
  obstacleScale: number;
  lowGravityMul: number;
  speedRush: number;
  nearMissMul: number;
  distanceScoreMul: number;
};

const MAP_EFFECTS: Record<MapName, MapEffect> = {
  base: {
    label: "Base Comets",
    subtitle: "Cadence propre, terrain stable",
    hudNote: "Équilibre",
    accent: "#FF8200",
    coinBonus: 0,
    x2Bonus: 0,
    obstacleScale: 1,
    lowGravityMul: 1,
    speedRush: 0,
    nearMissMul: 1,
    distanceScoreMul: 1,
  },
  terre: {
    label: "Terre",
    subtitle: "Lignes de pièces plus généreuses",
    hudNote: "Butin +",
    accent: "#67E8F9",
    coinBonus: 0.12,
    x2Bonus: 0.05,
    obstacleScale: 0.96,
    lowGravityMul: 1,
    speedRush: 0,
    nearMissMul: 1,
    distanceScoreMul: 1.03,
  },
  jupiter: {
    label: "Jupiter",
    subtitle: "Obstacles plus lourds, close calls mieux payés",
    hudNote: "Heavy mode",
    accent: "#F59E0B",
    coinBonus: 0.04,
    x2Bonus: 0.02,
    obstacleScale: 1.14,
    lowGravityMul: 1.06,
    speedRush: 0.03,
    nearMissMul: 1.7,
    distanceScoreMul: 1.07,
  },
  mars: {
    label: "Mars",
    subtitle: "Gravité plus légère, runs plus aériens",
    hudNote: "Float",
    accent: "#FB7185",
    coinBonus: 0.08,
    x2Bonus: 0.08,
    obstacleScale: 0.98,
    lowGravityMul: 0.84,
    speedRush: 0.04,
    nearMissMul: 1.15,
    distanceScoreMul: 1.08,
  },
  systeme_solaire: {
    label: "Système solaire",
    subtitle: "Rush cosmique, score et bonus accélèrent",
    hudNote: "Rush x",
    accent: "#A78BFA",
    coinBonus: 0.16,
    x2Bonus: 0.12,
    obstacleScale: 1.08,
    lowGravityMul: 0.92,
    speedRush: 0.08,
    nearMissMul: 1.3,
    distanceScoreMul: 1.14,
  },
};

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
  nextLetterSpawnScore: number;
  currentMapIndex: number;
  nextMapAdvanceLeftMs: number;
  nextMiniEventLeftMs: number;
  miniEvent?: {
    name: MiniEventName;
    map: MapName;
    leftMs: number;
    nextBurstLeftMs: number;
  } | null;
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

function mapIndexForScore(score: number) {
  return MAP_NAMES.indexOf(activeMapForScore(score));
}

type MiniEventName = "terre_tresor" | "jupiter_crunch" | "mars_orbit" | "solaire_storm";
type MiniEventState = {
  name: MiniEventName;
  map: MapName;
  endsAt: number;
  nextBurstAt: number;
};
type MarsAscentEventState = MiniEventState & { name: "mars_orbit"; map: "mars" };

function isMarsAscentEvent(event: MiniEventState | null | undefined): event is MarsAscentEventState {
  return !!event && event.name === "mars_orbit" && event.map === "mars";
}

function marsAscentArmsAt(event: MiniEventState) {
  return event.endsAt - Math.max(0, MINI_EVENT_DURATION_MS - MARS_ASCENT_ARM_MS);
}

function miniEventForMap(map: MapName): MiniEventName | null {
  switch (map) {
    case "terre":
      return "terre_tresor";
    case "jupiter":
      return "jupiter_crunch";
    case "mars":
      return "mars_orbit";
    case "systeme_solaire":
      return "solaire_storm";
    default:
      return null;
  }
}

const MAP_PATTERN_WEIGHTS: Record<MapName, readonly { pattern: SpawnPattern; weight: number }[]> = {
  base: [
    { pattern: "platform_gate", weight: 18 },
    { pattern: "double_trouble", weight: 18 },
    { pattern: "stairway", weight: 16 },
    { pattern: "rapid_triple", weight: 16 },
    { pattern: "split_route", weight: 12 },
    { pattern: "purple_gauntlet", weight: 8 },
    { pattern: "risk_lane", weight: 12 },
  ],
  terre: [
    { pattern: "platform_gate", weight: 22 },
    { pattern: "double_trouble", weight: 12 },
    { pattern: "stairway", weight: 18 },
    { pattern: "rapid_triple", weight: 12 },
    { pattern: "split_route", weight: 20 },
    { pattern: "purple_gauntlet", weight: 6 },
    { pattern: "risk_lane", weight: 10 },
  ],
  jupiter: [
    { pattern: "platform_gate", weight: 10 },
    { pattern: "double_trouble", weight: 24 },
    { pattern: "stairway", weight: 10 },
    { pattern: "rapid_triple", weight: 22 },
    { pattern: "split_route", weight: 10 },
    { pattern: "purple_gauntlet", weight: 8 },
    { pattern: "risk_lane", weight: 16 },
  ],
  mars: [
    { pattern: "platform_gate", weight: 24 },
    { pattern: "double_trouble", weight: 8 },
    { pattern: "stairway", weight: 28 },
    { pattern: "rapid_triple", weight: 8 },
    { pattern: "split_route", weight: 10 },
    { pattern: "purple_gauntlet", weight: 6 },
    { pattern: "risk_lane", weight: 16 },
  ],
  systeme_solaire: [
    { pattern: "platform_gate", weight: 8 },
    { pattern: "double_trouble", weight: 16 },
    { pattern: "stairway", weight: 8 },
    { pattern: "rapid_triple", weight: 24 },
    { pattern: "split_route", weight: 12 },
    { pattern: "purple_gauntlet", weight: 18 },
    { pattern: "risk_lane", weight: 14 },
  ],
};

function pickSpawnPatternForMap(map: MapName): SpawnPattern {
  const weights = MAP_PATTERN_WEIGHTS[map];
  const total = weights.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let roll = Math.random() * Math.max(1, total);
  for (const entry of weights) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.pattern;
  }
  return weights[weights.length - 1]?.pattern ?? "double_trouble";
}

function getUnlockProgressForId(
  id: TrailId | ThemeId | TitleId | PerkId,
  meta: MetaStats,
  achievements: Record<AchievementKey, boolean>,
  best: number,
) {
  switch (id) {
    case "plasma":
      return { text: achievements.combo_10 ? "Prêt" : "Faire un combo x10", ratio: achievements.combo_10 ? 1 : 0 };
    case "solar":
      return { text: `${Math.min(best, 10_000)}/10000`, ratio: clamp(best / 10_000, 0, 1) };
    case "nebula":
      return { text: `${Math.min(meta.totalMissionCompletions, 3)}/3 missions`, ratio: clamp(meta.totalMissionCompletions / 3, 0, 1) };
    case "red_clay":
      return { text: `${Math.min(best, 15_000)}/15000`, ratio: clamp(best / 15_000, 0, 1) };
    case "risk_taker":
      return { text: `${Math.min(meta.totalNearMisses, 15)}/15 near-miss`, ratio: clamp(meta.totalNearMisses / 15, 0, 1) };
    case "all_star":
      return { text: `${Math.min(best, 10_000)}/10000`, ratio: clamp(best / 10_000, 0, 1) };
    case "captain":
      return { text: `${Math.min(meta.totalMissionCompletions, 6)}/6 missions`, ratio: clamp(meta.totalMissionCompletions / 6, 0, 1) };
    case "starter_shield":
      return { text: `${Math.min(meta.totalRuns, 3)}/3 runs`, ratio: clamp(meta.totalRuns / 3, 0, 1) };
    case "air_mastery":
      return { text: achievements.score_2000 ? "Prêt" : "Atteindre 2 000", ratio: achievements.score_2000 ? 1 : 0 };
    case "purple_open":
      return { text: achievements.first_x2 ? "Prêt" : "Prendre un x2", ratio: achievements.first_x2 ? 1 : 0 };
    default:
      return { text: "Débloqué", ratio: 1 };
  }
}

function normalizeAchievements(raw: unknown): Record<AchievementKey, boolean> {
  const data = raw && typeof raw === "object" ? (raw as Partial<Record<AchievementKey, unknown>>) : {};
  return {
    first_x2: !!data.first_x2,
    score_2000: !!data.score_2000,
    combo_10: !!data.combo_10,
  };
}

function mergeAchievements(
  local: Record<AchievementKey, boolean>,
  cloud: Record<AchievementKey, boolean>,
): Record<AchievementKey, boolean> {
  return {
    first_x2: !!local.first_x2 || !!cloud.first_x2,
    score_2000: !!local.score_2000 || !!cloud.score_2000,
    combo_10: !!local.combo_10 || !!cloud.combo_10,
  };
}

function mergeMetaStats(local: MetaStats, cloud: MetaStats): MetaStats {
  return {
    totalRuns: Math.max(local.totalRuns, cloud.totalRuns),
    totalNearMisses: Math.max(local.totalNearMisses, cloud.totalNearMisses),
    totalMissionCompletions: Math.max(local.totalMissionCompletions, cloud.totalMissionCompletions),
    bestScoreEver: Math.max(local.bestScoreEver, cloud.bestScoreEver),
  };
}

function normalizeUnlockedItems(raw: unknown): PlayerStateUnlockedItems {
  const data = raw && typeof raw === "object" ? (raw as Partial<Record<keyof PlayerStateUnlockedItems, unknown>>) : {};
  const arr = <T extends string>(value: unknown, allowed: readonly T[]) =>
    Array.isArray(value) ? value.filter((item): item is T => allowed.includes(item as T)) : [];
  return {
    trails: arr(data.trails, TRAIL_OPTIONS.map((item) => item.id)),
    themes: arr(data.themes, THEME_OPTIONS.map((item) => item.id)),
    titles: arr(data.titles, TITLE_OPTIONS.map((item) => item.id)),
    perks: arr(data.perks, PERK_OPTIONS.map((item) => item.id)),
  };
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function isLocalApiBase(base: string) {
  try {
    const host = new URL(base).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "10.0.2.2" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

function apiCandidates(path: string) {
  return Array.from(
    new Set(
      [PRIMARY_API, FALLBACK_API]
        .map((base) => String(base ?? "").trim())
        .filter(Boolean)
        .filter((base) => !(isLocalApiBase(base) && unavailableLocalApiBases.has(base))),
    ),
  ).map((base) => ({ base, url: joinUrl(base, path) }));
}

function noteLocalApiUnavailable(base: string) {
  if (!isLocalApiBase(base)) return;
  unavailableLocalApiBases.add(base);
  if (!loggedLocalApiFallbackBases.has(base)) {
    loggedLocalApiFallbackBases.add(base);
    console.log("[CometsRun api] local API unreachable, fallback to deployed API:", base);
  }
}

async function notifyCometsRunOvertake(payload: {
  byAdminId: string;
  previousBest: number;
  newBest: number;
}) {
  const candidates = apiCandidates(COMETS_RUN_OVERTAKE_PATH);
  for (const { base, url } of candidates) {
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
      if (isLocalApiBase(base)) {
        noteLocalApiUnavailable(base);
        continue;
      }
      console.log("[CometsRun notify] network error:", url, (e as any)?.message ?? e);
    }
  }

  return false;
}

async function fetchCometsRunPlayerStateApi(sessionToken?: string | null) {
  let missingRoute = false;
  const candidates = apiCandidates(COMETS_RUN_PLAYER_STATE_PATH);
  for (const { base, url } of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          ...(sessionToken ? { "x-admin-session": sessionToken } : {}),
        },
      });

      if (res.status === 401) return { unauthorized: true as const, state: null };
      if (res.status === 404) {
        missingRoute = true;
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.log("[CometsRun player-state GET] non-ok:", url, res.status, text.slice(0, 200));
        continue;
      }

      const json = await res.json().catch(() => null);
      return { unauthorized: false as const, state: (json?.state ?? null) as CloudPlayerStateRow | null };
    } catch (e) {
      if (isLocalApiBase(base)) {
        noteLocalApiUnavailable(base);
        continue;
      }
      console.log("[CometsRun player-state GET] network error:", url, (e as any)?.message ?? e);
    }
  }

  return { unauthorized: false as const, state: null, unavailable: missingRoute as boolean };
}

async function pushCometsRunPlayerStateApi(
  sessionToken: string | null | undefined,
  payload: {
    loadout: Loadout;
    meta_stats: MetaStats;
    achievements: Record<AchievementKey, boolean>;
    unlocked_items: PlayerStateUnlockedItems;
  },
) {
  let missingRoute = false;
  const candidates = apiCandidates(COMETS_RUN_PLAYER_STATE_PATH);
  for (const { base, url } of candidates) {
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { "x-admin-session": sessionToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) return { ok: false as const, unauthorized: true as const };
      if (res.status === 404) {
        missingRoute = true;
        continue;
      }
      if (res.ok) return { ok: true as const, unauthorized: false as const };

      const text = await res.text().catch(() => "");
      console.log("[CometsRun player-state POST] non-ok:", url, res.status, text.slice(0, 200));
    } catch (e) {
      if (isLocalApiBase(base)) {
        noteLocalApiUnavailable(base);
        continue;
      }
      console.log("[CometsRun player-state POST] network error:", url, (e as any)?.message ?? e);
    }
  }

  return { ok: false as const, unauthorized: false as const, unavailable: missingRoute as boolean };
}

// ================= Component =================
export default function CometsRunnerScreen() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isReadyCompact = viewportHeight < 470;
  const isReadyTight = viewportHeight < 420;
  const isReadyShort = viewportHeight < 560;
  const isReadyViewportScroll = viewportHeight < 540;
  const isReadyDense = viewportHeight < 520 || viewportWidth < 1180;

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
  const runNearMissesRef = useRef(0);

  // 🎉 Ultra visuel 20k — overlay éphémère (déclenché plus tard)
  const [bigEventUntil, setBigEventUntil] = useState<number>(0);
  const [runBanner, setRunBanner] = useState<{ label: string; subtitle?: string; accent: string; until: number } | null>(null);
  const [hudFlash, setHudFlash] = useState<{ accent: string; until: number } | null>(null);
  const [lastRunMeta, setLastRunMeta] = useState<RunMeta | null>(null);
  const [metaStats, setMetaStats] = useState<MetaStats>(DEFAULT_META_STATS);
  const metaStatsRef = useRef<MetaStats>(DEFAULT_META_STATS);
  const [loadout, setLoadout] = useState<Loadout>(DEFAULT_LOADOUT);

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
  const cloudPlayerStateReadyRef = useRef(false);
  const cloudPlayerStateUnavailableRef = useRef(false);
  const lastCloudPlayerStateHashRef = useRef("");

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

  const unlockedTrails = useMemo(
    () => TRAIL_OPTIONS.filter((item) => item.isUnlocked(metaStats, achievements, best)),
    [achievements, best, metaStats],
  );
  const unlockedThemes = useMemo(
    () => THEME_OPTIONS.filter((item) => item.isUnlocked(metaStats, achievements, best)),
    [achievements, best, metaStats],
  );
  const unlockedTitles = useMemo(
    () => TITLE_OPTIONS.filter((item) => item.isUnlocked(metaStats, achievements, best)),
    [achievements, best, metaStats],
  );
  const unlockedPerks = useMemo(
    () => PERK_OPTIONS.filter((item) => item.isUnlocked(metaStats, achievements, best)),
    [achievements, best, metaStats],
  );

  const persistMetaStats = useCallback((next: MetaStats) => {
    metaStatsRef.current = next;
    setMetaStats(next);
    AsyncStorage.setItem(KEY_META_STATS, JSON.stringify(next)).catch(() => {});
  }, []);

  const updateMetaStats = useCallback((updater: (prev: MetaStats) => MetaStats) => {
    const next = updater(metaStatsRef.current);
    persistMetaStats(next);
  }, [persistMetaStats]);

  const persistAchievements = useCallback((next: Record<AchievementKey, boolean>) => {
    achievementsRef.current = next;
    setAchievements(next);
    AsyncStorage.setItem(KEY_ACH, JSON.stringify(next)).catch(() => {});
  }, []);

  const normalizeLoadout = useCallback((raw: unknown): Loadout => {
    const data = raw && typeof raw === "object" ? (raw as Partial<Loadout>) : {};
    return {
      trail: resolveUnlockedId(data.trail, TRAIL_OPTIONS, (item) => item.isUnlocked(metaStatsRef.current, achievementsRef.current, bestRef.current)) as TrailId,
      theme: resolveUnlockedId(data.theme, THEME_OPTIONS, (item) => item.isUnlocked(metaStatsRef.current, achievementsRef.current, bestRef.current)) as ThemeId,
      title: resolveUnlockedId(data.title, TITLE_OPTIONS, (item) => item.isUnlocked(metaStatsRef.current, achievementsRef.current, bestRef.current)) as TitleId,
      perk: resolveUnlockedId(data.perk, PERK_OPTIONS, (item) => item.isUnlocked(metaStatsRef.current, achievementsRef.current, bestRef.current)) as PerkId,
    };
  }, []);

  const persistLoadout = useCallback((next: Loadout) => {
    setLoadout(next);
    AsyncStorage.setItem(KEY_LOADOUT, JSON.stringify(next)).catch(() => {});
  }, []);

  const buildUnlockedItems = useCallback(
    (meta: MetaStats, ach: Record<AchievementKey, boolean>, bestScore: number): PlayerStateUnlockedItems => ({
      trails: TRAIL_OPTIONS.filter((item) => item.isUnlocked(meta, ach, bestScore)).map((item) => item.id),
      themes: THEME_OPTIONS.filter((item) => item.isUnlocked(meta, ach, bestScore)).map((item) => item.id),
      titles: TITLE_OPTIONS.filter((item) => item.isUnlocked(meta, ach, bestScore)).map((item) => item.id),
      perks: PERK_OPTIONS.filter((item) => item.isUnlocked(meta, ach, bestScore)).map((item) => item.id),
    }),
    [],
  );

  const cycleLoadout = useCallback((key: keyof Loadout) => {
    const pools = {
      trail: unlockedTrails.map((item) => item.id),
      theme: unlockedThemes.map((item) => item.id),
      title: unlockedTitles.map((item) => item.id),
      perk: unlockedPerks.map((item) => item.id),
    } as const;
    const pool = pools[key];
    if (!pool.length) return;
    const currentIdx = Math.max(0, pool.indexOf(loadout[key] as never));
    const next = { ...loadout, [key]: pool[(currentIdx + 1) % pool.length] } as Loadout;
    persistLoadout(next);
  }, [loadout, persistLoadout, unlockedPerks, unlockedThemes, unlockedTitles, unlockedTrails]);

  const [toast, setToast] = useState<string | null>(null);
  const lastToastAtRef = useRef(0);
  const showToast = useCallback((msg: string) => {
    const now = Date.now();
    if (now - lastToastAtRef.current < TOAST_MIN_INTERVAL_MS) return;
    lastToastAtRef.current = now;
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1200);
  }, []);

  const flashHud = useCallback((accent: string, duration = 360) => {
    setHudFlash({ accent, until: Date.now() + duration });
  }, []);

  const triggerRunBanner = useCallback((label: string, accent: string, subtitle?: string, duration = 1000) => {
    setRunBanner({ label, subtitle, accent, until: Date.now() + duration });
    flashHud(accent, Math.min(duration, 520));
  }, [flashHud]);

  const unlock = useCallback((key: AchievementKey) => {
    if (achievementsRef.current[key]) return;
    const next = { ...achievementsRef.current, [key]: true };
    persistAchievements(next);
    showToast(`🏅 ${ACH_LABEL[key]}`);
  }, [persistAchievements, showToast]);

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
        updateMetaStats((current) => ({
          ...current,
          totalMissionCompletions: current.totalMissionCompletions + unlocked.length,
        }));
      }
      if (unlocked.length > 0) {
        showToast(`Mission : ${unlocked[0].label}`);
      }
    },
    [persistDailyMissions, showToast, updateMetaStats],
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
  useEffect(() => {
    if (best > metaStatsRef.current.bestScoreEver) {
      updateMetaStats((current) => ({ ...current, bestScoreEver: best }));
    }
  }, [best, updateMetaStats]);

  useEffect(() => {
    const normalized = normalizeLoadout(loadout);
    if (JSON.stringify(normalized) !== JSON.stringify(loadout)) {
      persistLoadout(normalized);
    }
  }, [achievements, best, loadout, metaStats, normalizeLoadout, persistLoadout]);

  // === COMETS persistant (ordre strict) ===
  const persistentLettersRef = useRef<Set<CometsLetter>>(new Set());
  const [, setLettersTick] = useState(0);

  // indices 0..5 spawnés durant CE run
  const spawnedLetterIdxThisRunRef = useRef<Set<number>>(new Set());
  const nextLetterSpawnScoreRef = useRef(0);

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
  const currentMapIndexRef = useRef(0);
  const nextMapAdvanceAtRef = useRef(0);
  const currentMiniEventRef = useRef<MiniEventState | null>(null);
  const nextMiniEventAtRef = useRef(0);
  const MAP_FADE_SECS = 1.4;

  // Loop
  const [frameTick, setFrameTick] = useState(0);
  const distAccRef = useRef(0);
  const ROLL_VISUAL_MULT = 0.9;
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastRenderCommitAtRef = useRef(0);

  // FX
  const shake = useRef(new Animated.Value(0)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;

  // Admin/Supabase
  const { admin } = useAdmin();
  const adminId = (admin?.id ?? null) as any as string | null;
  const adminSessionToken = typeof admin?.session_token === "string" ? admin.session_token : null;
  const adminFirst = (admin as any)?.first_name ?? null;
  const adminLast = (admin as any)?.last_name ?? null;
  const adminEmail = admin?.email ?? null;
  const adminName =
    [adminFirst, adminLast].filter(Boolean).join(" ").trim() ||
    adminEmail || "Anonyme";

  const ensureProfile = useCallback(async () => {
    if (!adminId) return;
    const { error } = await supabase.from("game_profiles").upsert(
      [{
        admin_id: adminId,
        display_name: adminName,
        equipped_title: loadout.title,
        equipped_trail: loadout.trail,
        equipped_theme: loadout.theme,
        public_near_misses: metaStatsRef.current.totalNearMisses,
        public_missions_done: metaStatsRef.current.totalMissionCompletions,
      }],
      { onConflict: "admin_id", ignoreDuplicates: false }
    );
    if (error) console.log("ensureProfile error:", error.message);
  }, [adminId, adminName, loadout.theme, loadout.title, loadout.trail]);

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
      bestRef.current = data.best_score;
      setBest(data.best_score);
      AsyncStorage.setItem(KEY_BEST, String(data.best_score)).catch(() => {});
    }
  }, [adminId]);

  const loadPlayerStateFromCloud = useCallback(async () => {
    if (!adminId) return;
    const { state, unauthorized, unavailable } = await fetchCometsRunPlayerStateApi(adminSessionToken);
    if (unauthorized) {
      console.log("loadPlayerStateFromCloud error: session API unauthorized");
      cloudPlayerStateReadyRef.current = true;
      return;
    }
    if (unavailable) {
      cloudPlayerStateUnavailableRef.current = true;
      cloudPlayerStateReadyRef.current = true;
      lastCloudPlayerStateHashRef.current = "";
      console.log("loadPlayerStateFromCloud: player-state API unavailable, cloud sync disabled for this session");
      return;
    }

    if (!state) {
      cloudPlayerStateReadyRef.current = true;
      lastCloudPlayerStateHashRef.current = "";
      return;
    }

    const row = state as CloudPlayerStateRow;
    const cloudMeta = normalizeMetaStats(row.meta_stats);
    const mergedMeta = mergeMetaStats(metaStatsRef.current, cloudMeta);
    persistMetaStats(mergedMeta);

    const cloudAchievements = normalizeAchievements(row.achievements);
    const mergedAchievements = mergeAchievements(achievementsRef.current, cloudAchievements);
    persistAchievements(mergedAchievements);

    const cloudLoadout = normalizeLoadout(row.loadout);
    const mergedBest = Math.max(bestRef.current, mergedMeta.bestScoreEver);
    const normalizedCloudLoadout = normalizeLoadout(cloudLoadout);
    const unlockedItems = normalizeUnlockedItems(row.unlocked_items);
    const hasCloudUnlocks =
      unlockedItems.trails.length + unlockedItems.themes.length + unlockedItems.titles.length + unlockedItems.perks.length > 0;
    const nextLoadout = hasCloudUnlocks
      ? normalizeLoadout({
          trail: unlockedItems.trails.includes(normalizedCloudLoadout.trail) ? normalizedCloudLoadout.trail : loadout.trail,
          theme: unlockedItems.themes.includes(normalizedCloudLoadout.theme) ? normalizedCloudLoadout.theme : loadout.theme,
          title: unlockedItems.titles.includes(normalizedCloudLoadout.title) ? normalizedCloudLoadout.title : loadout.title,
          perk: unlockedItems.perks.includes(normalizedCloudLoadout.perk) ? normalizedCloudLoadout.perk : loadout.perk,
        })
      : normalizedCloudLoadout;

    if (mergedBest > bestRef.current) {
      bestRef.current = mergedBest;
      setBest(mergedBest);
      AsyncStorage.setItem(KEY_BEST, String(mergedBest)).catch(() => {});
    }

    persistLoadout(nextLoadout);

    const syncedHash = JSON.stringify({
      loadout: nextLoadout,
      meta_stats: mergedMeta,
      achievements: mergedAchievements,
      unlocked_items: buildUnlockedItems(mergedMeta, mergedAchievements, Math.max(bestRef.current, mergedBest)),
    });
    lastCloudPlayerStateHashRef.current = syncedHash;
    cloudPlayerStateReadyRef.current = true;
  }, [adminId, adminSessionToken, buildUnlockedItems, loadout.perk, loadout.theme, loadout.title, loadout.trail, normalizeLoadout, persistAchievements, persistLoadout, persistMetaStats]);

  const syncPlayerStateToCloud = useCallback(async () => {
    if (!adminId || !cloudPlayerStateReadyRef.current || cloudPlayerStateUnavailableRef.current) return;

    const syncedBest = Math.max(bestRef.current, metaStatsRef.current.bestScoreEver);
    const payload = {
      loadout,
      meta_stats: metaStats,
      achievements,
      unlocked_items: buildUnlockedItems(metaStats, achievements, syncedBest),
    };
    const payloadHash = JSON.stringify({
      loadout: payload.loadout,
      meta_stats: payload.meta_stats,
      achievements: payload.achievements,
      unlocked_items: payload.unlocked_items,
    });
    if (payloadHash === lastCloudPlayerStateHashRef.current) return;

    const previousHash = lastCloudPlayerStateHashRef.current;
    lastCloudPlayerStateHashRef.current = payloadHash;

    const result = await pushCometsRunPlayerStateApi(adminSessionToken, payload);
    if (!result.ok) {
      lastCloudPlayerStateHashRef.current = previousHash;
      if (result.unavailable) {
        cloudPlayerStateUnavailableRef.current = true;
        console.log("syncPlayerStateToCloud: player-state API unavailable, cloud sync disabled for this session");
        return;
      }
      console.log(
        "syncPlayerStateToCloud state error:",
        result.unauthorized ? "session API unauthorized" : "request failed",
      );
      return;
    }
  }, [achievements, adminId, adminSessionToken, buildUnlockedItems, loadout, metaStats]);

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

  const loadWeeklyRankContext = useCallback(async (candidateScore: number) => {
    if (!adminId) return null;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from("game_runs")
      .select("admin_id, score, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(4000);

    if (error) {
      console.log("weekly rank context error:", error.message);
      return null;
    }

    const byAdmin = new Map<string, { admin_id: string; best_score: number; last_run_at: string | null }>();
    const toTs = (input: string | null) => {
      const t = input ? Date.parse(input) : 0;
      return Number.isFinite(t) ? t : 0;
    };

    for (const raw of (data ?? []) as LBWeeklyRunRow[]) {
      const key = String(raw.admin_id ?? "").trim();
      if (!key) continue;
      const score = Math.max(0, Math.floor(Number(raw.score ?? 0)));
      const createdAt = typeof raw.created_at === "string" ? raw.created_at : null;
      const existing = byAdmin.get(key);
      if (!existing) {
        byAdmin.set(key, { admin_id: key, best_score: score, last_run_at: createdAt });
        continue;
      }
      existing.best_score = Math.max(existing.best_score, score);
      if (toTs(createdAt) > toTs(existing.last_run_at)) existing.last_run_at = createdAt;
    }

    const previousWeeklyBest = byAdmin.get(adminId)?.best_score ?? 0;
    const rankForScore = (score: number) => {
      const injected = new Map(byAdmin);
      injected.set(adminId, {
        admin_id: adminId,
        best_score: score,
        last_run_at: new Date().toISOString(),
      });
      const ranked = Array.from(injected.values()).sort((a, b) => {
        if (b.best_score !== a.best_score) return b.best_score - a.best_score;
        return toTs(b.last_run_at) - toTs(a.last_run_at);
      });
      const index = ranked.findIndex((item) => item.admin_id === adminId);
      return index >= 0 ? index + 1 : null;
    };

    const previousRank = previousWeeklyBest > 0 ? rankForScore(previousWeeklyBest) : null;
    const currentRank = rankForScore(Math.max(previousWeeklyBest, candidateScore));
    return {
      previousWeeklyBest,
      previousWeeklyRank: previousRank,
      currentWeeklyRank: currentRank,
      weeklyRankGain:
        previousRank != null && currentRank != null ? Math.max(0, previousRank - currentRank) : 0,
      enteredWeeklyBoard: previousRank == null && currentRank != null,
    };
  }, [adminId]);

  const saveRunToCloud = useCallback(async (finalScore: number): Promise<RunMeta | null> => {
    if (!adminId) return null;
    const weeklyRankContext = await loadWeeklyRankContext(finalScore);
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
      equipped_title: loadout.title,
      equipped_trail: loadout.trail,
      equipped_theme: loadout.theme,
      public_near_misses: metaStatsRef.current.totalNearMisses,
      public_missions_done: metaStatsRef.current.totalMissionCompletions,
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
      bestRef.current = newBest;
      setBest(newBest);
      AsyncStorage.setItem(KEY_BEST, String(newBest)).catch(() => {});
    }
    await loadTop5();
    return {
      beatBest: newBest > previousBest,
      previousBest,
      previousWeeklyRank: weeklyRankContext?.previousWeeklyRank ?? null,
      currentWeeklyRank: weeklyRankContext?.currentWeeklyRank ?? null,
      weeklyRankGain: weeklyRankContext?.weeklyRankGain ?? 0,
      enteredWeeklyBoard: weeklyRankContext?.enteredWeeklyBoard ?? false,
    };
  }, [adminId, adminName, best, loadTop5, loadWeeklyRankContext, loadout.theme, loadout.title, loadout.trail]);

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
    const miniEvent = currentMiniEventRef.current;
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
      nextLetterSpawnScore: nextLetterSpawnScoreRef.current,
      currentMapIndex: currentMapIndexRef.current,
      nextMapAdvanceLeftMs: Math.max(0, nextMapAdvanceAtRef.current - now),
      nextMiniEventLeftMs: Math.max(0, nextMiniEventAtRef.current - now),
      miniEvent: miniEvent
        ? {
            name: miniEvent.name,
            map: miniEvent.map,
            leftMs: Math.max(0, miniEvent.endsAt - now),
            nextBurstLeftMs: Math.max(0, miniEvent.nextBurstAt - now),
          }
        : null,
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
      try {
        const rawA = await AsyncStorage.getItem(KEY_ACH);
        if (rawA) persistAchievements(mergeAchievements(achievementsRef.current, normalizeAchievements(JSON.parse(rawA))));
      } catch {}
      try { const raw = await AsyncStorage.getItem(KEY_BEST); if (raw) setBest(parseInt(raw, 10) || 0); } catch {}
      try {
        const rawMeta = await AsyncStorage.getItem(KEY_META_STATS);
        if (rawMeta) persistMetaStats(normalizeMetaStats(JSON.parse(rawMeta)));
      } catch {}
      try {
        const rawLoadout = await AsyncStorage.getItem(KEY_LOADOUT);
        if (rawLoadout) setLoadout(normalizeLoadout(JSON.parse(rawLoadout)));
      } catch {}
      await loadDailyMissions();
      // précharge le pool coin pour éliminer le "vide" initial
      try { await ensureCoinPool(); } catch {}
      // progression COMETS chargée ailleurs
    })();
  }, [ensureCoinPool, loadDailyMissions, normalizeLoadout, persistAchievements, persistMetaStats]);

  useEffect(() => {
    (async () => {
      cloudPlayerStateReadyRef.current = false;
      cloudPlayerStateUnavailableRef.current = false;
      if (!adminId) {
        lastCloudPlayerStateHashRef.current = "";
        await loadTop5();
        return;
      }
      await ensureProfile();
      await loadBestFromCloud();
      await loadPlayerStateFromCloud();
      await loadTop5();
    })();
  }, [adminId, ensureProfile, loadBestFromCloud, loadPlayerStateFromCloud, loadTop5]);

  useEffect(() => {
    if (!adminId || !cloudPlayerStateReadyRef.current) return;
    syncPlayerStateToCloud().catch((e) => {
      console.log("syncPlayerStateToCloud catch:", (e as any)?.message ?? e);
    });
  }, [adminId, achievements, loadout, metaStats, syncPlayerStateToCloud]);

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
    setRunBanner(null);
    setHudFlash(null);
    setLastRunMeta(null);

    const assist = 1 - Math.min(0.12, failStreakRef.current * 0.04);
    targetSpeedRef.current = Math.max(START_SPEED * 0.82, START_SPEED * assist);
    speedRef.current = targetSpeedRef.current;

    scoreRef.current = 0;
    setScore(0);
    runCoinsCollectedRef.current = 0;
    runNearMissesRef.current = 0;
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
    nextLetterSpawnScoreRef.current = 0;

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
    currentMapIndexRef.current = 0;
    nextMapAdvanceAtRef.current = Date.now() + MAP_MIN_DWELL_MS;
    currentMiniEventRef.current = null;
    nextMiniEventAtRef.current = Date.now() + MINI_EVENT_FIRST_DELAY_MS;

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

    if (loadout.perk === "starter_shield") {
      setHasShieldSync(true);
    } else if (loadout.perk === "air_mastery") {
      setDoubleJumpUntilSync(Date.now() + 8_000);
      airJumpsLeftRef.current = 1;
    } else if (loadout.perk === "purple_open") {
      scoreMultLevelRef.current = 2;
      scoreMultUntilRef.current = Date.now() + 6_000;
      setPurpleChainSync(1);
      purpleChainExpiresAtRef.current = scoreMultUntilRef.current;
    }
  }, [
    GROUND_Y,
    H_STAR_MIN,
    H_STAR_MAX,
    clampYCenter,
    yForHeight,
    loadout.perk,
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
    if (loadout.perk !== "none") {
      const perkInfo = PERK_OPTIONS.find((item) => item.id === loadout.perk);
      if (perkInfo) {
        triggerRunBanner(perkInfo.label, perkInfo.accent, perkInfo.description, 950);
      }
    }
    setGameState("running");
    setPlayingStatusBar(true);
  }, [loadout.perk, resetWorld, setPlayingStatusBar, triggerRunBanner]);

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
    nextLetterSpawnScoreRef.current = Math.max(0, Number(snap.nextLetterSpawnScore ?? 0));
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
      const fallbackMapIndex = Math.max(0, MAP_NAMES.indexOf(mapFadeRef.current > 0 ? mapB : mapA));
      currentMapIndexRef.current = clamp(
        Math.floor(toNum(snap.currentMapIndex, fallbackMapIndex)),
        0,
        MAP_NAMES.length - 1,
      );
      nextMapAdvanceAtRef.current = now + Math.max(0, toNum(snap.nextMapAdvanceLeftMs, 0));
      nextMiniEventAtRef.current = now + Math.max(0, toNum(snap.nextMiniEventLeftMs, 0));
      currentMiniEventRef.current =
        snap.miniEvent && miniEventForMap(snap.miniEvent.map) === snap.miniEvent.name
          ? {
              name: snap.miniEvent.name,
              map: snap.miniEvent.map,
              endsAt: now + Math.max(0, toNum(snap.miniEvent.leftMs, 0)),
              nextBurstAt: now + Math.max(0, toNum(snap.miniEvent.nextBurstLeftMs, 0)),
            }
          : null;
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
            grazed: !!o?.grazed,
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
      currentMapIndexRef.current = clamp(
        Math.floor(Number(snap.currentMapIndex ?? MAP_NAMES.indexOf(mapARef.current))),
        0,
        MAP_NAMES.length - 1,
      );
      nextMapAdvanceAtRef.current = now + Math.max(0, Number(snap.nextMapAdvanceLeftMs ?? 0));
      nextMiniEventAtRef.current = now + Math.max(0, Number(snap.nextMiniEventLeftMs ?? 0));
      currentMiniEventRef.current =
        snap.miniEvent && miniEventForMap(snap.miniEvent.map) === snap.miniEvent.name
          ? {
              name: snap.miniEvent.name,
              map: snap.miniEvent.map,
              endsAt: now + Math.max(0, Number(snap.miniEvent.leftMs ?? 0)),
              nextBurstAt: now + Math.max(0, Number(snap.miniEvent.nextBurstLeftMs ?? 0)),
            }
          : null;
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
    const previousBestLocal = bestRef.current;
    setLastRunMeta({
      beatBest: finalScore > previousBestLocal,
      previousBest: previousBestLocal,
      previousWeeklyRank: null,
      currentWeeklyRank: null,
      weeklyRankGain: 0,
      enteredWeeklyBoard: false,
    });
    updateMetaStats((current) => ({
      ...current,
      totalRuns: current.totalRuns + 1,
      totalNearMisses: current.totalNearMisses + runNearMissesRef.current,
      bestScoreEver: Math.max(current.bestScoreEver, finalScore, previousBestLocal),
    }));
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
        const cloudMeta = await saveRunToCloud(finalScore);
        if (cloudMeta) setLastRunMeta(cloudMeta);
      } else if (finalScore > bestRef.current) {
        setBest(finalScore);
        bestRef.current = finalScore;
        await AsyncStorage.setItem(KEY_BEST, String(finalScore));
        await loadTop5();
        setLastRunMeta((prev) => prev ? { ...prev, beatBest: true, previousBest: previousBestLocal } : prev);
      } else {
        await loadTop5();
      }
    } catch (e) {
      console.log("endGame error:", (e as any)?.message);
    }
  }, [adminId, applyRunToDailyMissions, saveRunToCloud, loadTop5, resetPersistentLetters, setPlayingStatusBar, updateMetaStats]);

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

  const spawnPurpleLine = useCallback((startX: number, count: number, y: number, gap = 46) => {
    for (let i = 0; i < count; i++) {
      powerUpsRef.current.push({
        id: ++lastIdRef.current,
        x: startX + i * gap,
        y,
        r: R_X2,
        kind: "x2",
      });
    }
  }, []);

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

    const mapFx = MAP_EFFECTS[mapARef.current];
    const harden = clamp(0.2 * (scoreNow / 120000), 0, 0.2);
    const localGapMul = gapMul * (1 - harden);
    const baseLead = Math.max(minGap, Math.floor(SCREEN_W * 0.78));
    const lead = Math.floor(baseLead * localGapMul);
    const extraLead = Math.max(1, Math.floor(OBSTACLE_MAX_GAP_BASE * localGapMul));
    const anchorX = SCREEN_W + lead + randi(20, extraLead);

    const pattern = pickSpawnPatternForMap(mapARef.current);

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

    if (pattern === "stairway") {
      const entryW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const entryH = OBSTACLE_BASE_H + randi(-8, 8);
      const entryX = anchorX + randi(0, 40);
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: entryX,
        w: entryW,
        h: entryH,
        y: GROUND_Y - entryH,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      const firstPlatform = spawnPlatformBlock(
        entryX + entryW + randi(84, 126),
        GROUND_Y - randf(H_SINGLE * 0.56, H_SINGLE * 0.76) - PLATFORM_H,
        randi(118, 170),
      );
      const secondPlatform = spawnPlatformBlock(
        firstPlatform.x + firstPlatform.w + randi(72, 118),
        GROUND_Y - randf(H_SINGLE * 0.9, Math.min(H_DOUBLE * 0.82, H_SINGLE * 1.02)) - PLATFORM_H,
        randi(110, 156),
      );

      const trailCount = mapFx.coinBonus >= 0.12 ? 6 : 5;
      for (let i = 0; i < trailCount; i++) {
        const t = i / Math.max(1, trailCount - 1);
        const fromX = firstPlatform.x + firstPlatform.w * 0.35;
        const toX = secondPlatform.x + secondPlatform.w * 0.5;
        const x = fromX + (toX - fromX) * t;
        const y = clampYCenter(firstPlatform.y - 18 - (firstPlatform.y - secondPlatform.y) * t, R_COLLECTIBLE);
        collectiblesRef.current.push({
          id: ++lastIdRef.current,
          x,
          y,
          r: R_COLLECTIBLE,
        });
      }

      if (Math.random() < clamp(0.32 + mapFx.x2Bonus * 0.4, 0, 0.52)) {
        powerUpsRef.current.push({
          id: ++lastIdRef.current,
          x: secondPlatform.x + secondPlatform.w * 0.55,
          y: clampYCenter(secondPlatform.y - 24, R_X2),
          r: R_X2,
          kind: "x2",
        });
      }

      if (Math.random() < 0.38) {
        const exitW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
        const exitH = OBSTACLE_BASE_H + randi(-6, 8);
        obstaclesRef.current.push({
          id: ++lastIdRef.current,
          x: secondPlatform.x + secondPlatform.w + randi(76, 118),
          w: exitW,
          h: exitH,
          y: GROUND_Y - exitH,
          variant: Math.random() < 0.5 ? 0 : 1,
        });
      }

      patternCooldownDistRef.current = randi(PLATFORM_PATTERN_COOLDOWN_MIN, PLATFORM_PATTERN_COOLDOWN_MAX);
      return true;
    }

    if (pattern === "rapid_triple") {
      let cursorX = anchorX;
      for (let step = 0; step < 3; step++) {
        const w = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
        const h = OBSTACLE_BASE_H + randi(-10, 10);
        obstaclesRef.current.push({
          id: ++lastIdRef.current,
          x: cursorX,
          w,
          h,
          y: GROUND_Y - h,
          variant: Math.random() < 0.5 ? 0 : 1,
        });
        cursorX += w + randi(118, 170);
      }

      const rewardY = clampYCenter(yForHeight(randf(H_SINGLE * 0.6, H_SINGLE * 0.92)), R_COLLECTIBLE);
      const rewardCount = mapFx.coinBonus >= 0.12 ? 6 : 4;
      for (let i = 0; i < rewardCount; i++) {
        collectiblesRef.current.push({
          id: ++lastIdRef.current,
          x: anchorX + 80 + i * 54,
          y: rewardY - (i % 2 === 0 ? 0 : 12),
          r: R_COLLECTIBLE,
        });
      }

      if (Math.random() < 0.34) {
        powerUpsRef.current.push({
          id: ++lastIdRef.current,
          x: cursorX - randi(42, 80),
          y: clampYCenter(rewardY - 22, R_POWERUP),
          r: R_POWERUP,
          kind: "doublejump",
        });
      }

      patternCooldownDistRef.current = randi(PLATFORM_PATTERN_COOLDOWN_MIN, PLATFORM_PATTERN_COOLDOWN_MAX);
      return true;
    }

    if (pattern === "split_route") {
      const groundW = randi(OBSTACLE_MIN_W + 4, OBSTACLE_MAX_W + 6);
      const groundH = OBSTACLE_BASE_H + randi(-6, 8);
      const groundX = anchorX + randi(0, 60);
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: groundX,
        w: groundW,
        h: groundH,
        y: GROUND_Y - groundH,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      const safeCoinY = GROUND_Y - R_COLLECTIBLE - 4;
      for (let i = 0; i < 3; i++) {
        collectiblesRef.current.push({
          id: ++lastIdRef.current,
          x: groundX + groundW + 48 + i * 34,
          y: safeCoinY,
          r: R_COLLECTIBLE,
        });
      }

      const riskPlatform = spawnPlatformBlock(
        groundX + groundW + randi(92, 124),
        GROUND_Y - randf(H_SINGLE * 0.76, Math.min(H_DOUBLE * 0.88, H_SINGLE * 1.06)) - PLATFORM_H,
        randi(128, 178),
      );
      spawnPurpleLine(riskPlatform.x + 18, mapFx.x2Bonus >= 0.12 ? 3 : 2, clampYCenter(riskPlatform.y - 22, R_X2), 44);

      if (Math.random() < 0.48) {
        const exitW = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
        const exitH = OBSTACLE_BASE_H + randi(-8, 8);
        obstaclesRef.current.push({
          id: ++lastIdRef.current,
          x: riskPlatform.x + riskPlatform.w + randi(64, 108),
          w: exitW,
          h: exitH,
          y: GROUND_Y - exitH,
          variant: Math.random() < 0.5 ? 0 : 1,
        });
      }

      patternCooldownDistRef.current = randi(PLATFORM_PATTERN_COOLDOWN_MIN, PLATFORM_PATTERN_COOLDOWN_MAX);
      return true;
    }

    if (pattern === "purple_gauntlet") {
      const w1 = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h1 = OBSTACLE_BASE_H + randi(-6, 8);
      const x1 = anchorX + randi(0, 32);
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: x1,
        w: w1,
        h: h1,
        y: GROUND_Y - h1,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      const x2 = x1 + w1 + randi(170, 220);
      const w2 = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h2 = OBSTACLE_BASE_H + randi(-6, 10);
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x: x2,
        w: w2,
        h: h2,
        y: GROUND_Y - h2,
        variant: Math.random() < 0.5 ? 0 : 1,
      });

      const purpleY = clampYCenter(yForHeight(randf(H_SINGLE * 0.84, H_DOUBLE * 0.92)), R_X2);
      spawnPurpleLine(x1 + w1 + 38, mapFx.x2Bonus >= 0.12 ? 3 : 2, purpleY, 48);
      collectiblesRef.current.push({
        id: ++lastIdRef.current,
        x: x2 + w2 + 60,
        y: clampYCenter(purpleY + 18, R_COLLECTIBLE),
        r: R_COLLECTIBLE,
      });

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
    if (Math.random() < clamp(0.24 + mapFx.x2Bonus * 0.5, 0, 0.42)) {
      const purpleCount = mapFx.x2Bonus >= 0.1 ? 2 : 1;
      spawnPurpleLine(platform.x + 18, purpleCount, rewardY, 42);
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
    spawnPurpleLine,
    spawnPlatformBlock,
    spawnPlatformGatedCoins,
    yForHeight,
  ]);

  // Spawn d'une lettre au palier désiré (0..5)
  const spawnLetterAtIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= LETTERS.length) return;
    if (spawnedLetterIdxThisRunRef.current.has(idx)) return; // déjà spawn pendant ce run
    if (powerUpsRef.current.some((powerUp) => powerUp.kind === "letter")) return;
    const letter = LETTERS[idx];
    if (persistentLettersRef.current.has(letter)) return;     // déjà possédée

    spawnedLetterIdxThisRunRef.current.add(idx);
    nextLetterSpawnScoreRef.current = Math.max(nextLetterSpawnScoreRef.current, scoreRef.current + LETTER_SPAWN_SCORE_BUFFER);

    const s = speedRef.current;
    const x = SCREEN_W + Math.max(420, Math.min(1200, s * 1.4));
    const h = randf(H_STAR_MIN, H_STAR_MAX);
    const y = clampYCenter(yForHeight(h), R_LETTER); // ← lettre plus grande
    powerUpsRef.current.push({ id: ++lastIdRef.current, x, y, r: R_LETTER, kind: "letter", letter });
  }, [H_STAR_MIN, H_STAR_MAX, clampYCenter, yForHeight]);

  const spawnObstacle = useCallback((minGap: number, gapMul: number, scoreNow: number) => {
    const mapFx = MAP_EFFECTS[mapARef.current];
    const harden = clamp(0.25 * (scoreNow / 120000), 0, 0.25);
    const localGapMul = gapMul * (1 - harden);
    const attempts = Math.max(1, Math.min(MAX_SPAWN_ATTEMPTS, Math.floor(speedRef.current / 60)));
    const obstacleScale = mapFx.obstacleScale;

    for (let i = 0; i < attempts; i++) {
      const w = Math.round(clamp(randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W) * obstacleScale, OBSTACLE_MIN_W, OBSTACLE_MAX_W * 1.35));
      const h = Math.round(clamp((OBSTACLE_BASE_H + randi(-8, 8)) * (0.96 + (obstacleScale - 1) * 0.75), OBSTACLE_BASE_H - 12, OBSTACLE_BASE_H + 18));
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
      if (ENABLE_COLLECTIBLES && Math.random() < clamp(0.45 + mapFx.coinBonus, 0, 0.8)) {
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
      if (Math.random() < mapFx.x2Bonus * 0.4) {
        const hX2 = randf(H_STAR_MIN, H_STAR_MAX);
        const yX2 = clampYCenter(yForHeight(hX2), R_X2);
        powerUpsRef.current.push({ id: ++lastIdRef.current, x: x + randi(120, 240), y: yX2, r: R_X2, kind: "x2" });
      }
      return;
    }

    // Fallback sécurité si aucune tentative n'a passé le filtre "tooClose"
    const w = Math.round(clamp(randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W) * obstacleScale, OBSTACLE_MIN_W, OBSTACLE_MAX_W * 1.35));
    const h = Math.round(clamp((OBSTACLE_BASE_H + randi(-8, 8)) * (0.96 + (obstacleScale - 1) * 0.75), OBSTACLE_BASE_H - 12, OBSTACLE_BASE_H + 18));
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
    if (Math.random() > DOUBLEJUMP_X2_SPAWN_CHANCE) return;
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

  const triggerMapArrival = useCallback((map: MapName) => {
    const mapFx = MAP_EFFECTS[map];
    triggerRunBanner(mapFx.label, mapFx.accent, mapFx.subtitle, 1450);

    if (map === "terre") {
      spawnCoinsAirLine(6);
      return;
    }
    if (map === "jupiter") {
      spawnCoinsGround(4, undefined, true);
      return;
    }
    if (map === "mars") {
      if (Math.random() < 0.45) spawnX2BonusForDoubleJump();
      return;
    }
    if (map === "systeme_solaire") {
      spawnCoinsAirLine(8);
      if (Math.random() < 0.55) spawnX2BonusForDoubleJump();
    }
  }, [spawnCoinsAirLine, spawnCoinsGround, spawnX2BonusForDoubleJump, triggerRunBanner]);

  const scheduleNextMiniEvent = useCallback((from = Date.now()) => {
    nextMiniEventAtRef.current = from + randi(MINI_EVENT_COOLDOWN_MIN_MS, MINI_EVENT_COOLDOWN_MAX_MS);
  }, []);

  const spawnMiniEventBurst = useCallback((event: MiniEventState) => {
    const lead = Math.max(260, Math.min(820, speedRef.current * 1.1));
    const anchorX = SCREEN_W + lead + randi(0, 110);
    const pushCoinLine = (startX: number, count: number, y: number, gap = 34) => {
      for (let i = 0; i < count; i++) {
        collectiblesRef.current.push({
          id: ++lastIdRef.current,
          x: startX + i * gap,
          y,
          r: R_COLLECTIBLE,
        });
      }
    };
    const pushObstacle = (x: number, w: number, h: number) => {
      obstaclesRef.current.push({
        id: ++lastIdRef.current,
        x,
        w,
        h,
        y: GROUND_Y - h,
        variant: Math.random() < 0.5 ? 0 : 1,
      });
    };

    if (event.name === "terre_tresor") {
      spawnCoinsGround(6, anchorX);
      const platform = spawnPlatformBlock(
        anchorX + randi(70, 130),
        GROUND_Y - randf(H_SINGLE * 0.68, H_SINGLE * 0.94) - PLATFORM_H,
        randi(150, 210),
      );
      pushObstacle(platform.x - randi(92, 128), randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W), OBSTACLE_BASE_H + randi(-4, 8));
      spawnPurpleLine(platform.x + 18, 2, clampYCenter(platform.y - 22, R_X2), 42);
      return;
    }

    if (event.name === "jupiter_crunch") {
      const w1 = Math.round(randi(OBSTACLE_MIN_W + 4, OBSTACLE_MAX_W + 12) * 1.2);
      const h1 = Math.round((OBSTACLE_BASE_H + randi(2, 14)) * 1.12);
      const x1 = anchorX;
      pushObstacle(x1, w1, h1);

      const w2 = Math.round(randi(OBSTACLE_MIN_W + 6, OBSTACLE_MAX_W + 14) * 1.24);
      const h2 = Math.round((OBSTACLE_BASE_H + randi(4, 16)) * 1.14);
      const gap = randi(150, 188);
      const x2 = x1 + w1 + gap;
      pushObstacle(x2, w2, h2);

      const rewardY = clampYCenter(yForHeight(randf(H_SINGLE * 0.72, H_SINGLE * 0.96)), R_COLLECTIBLE);
      pushCoinLine(x1 + w1 + 26, 4, rewardY, 30);
      if (Math.random() < 0.55) {
        powerUpsRef.current.push({
          id: ++lastIdRef.current,
          x: x2 + w2 + randi(36, 64),
          y: clampYCenter(rewardY - 22, R_X2),
          r: R_X2,
          kind: "x2",
        });
      }
      return;
    }

    if (event.name === "mars_orbit") {
      const ascentAnchorX = SCREEN_W + Math.max(150, Math.min(360, speedRef.current * 0.55));
      const firstPlatform = spawnPlatformBlock(
        ascentAnchorX + randi(0, 18),
        GROUND_Y - randf(H_SINGLE * 0.34, H_SINGLE * 0.48) - PLATFORM_H,
        randi(190, 236),
      );
      const secondPlatform = spawnPlatformBlock(
        firstPlatform.x + firstPlatform.w + randi(42, 60),
        firstPlatform.y - randi(34, 50),
        randi(168, 214),
      );
      const thirdPlatform = spawnPlatformBlock(
        secondPlatform.x + secondPlatform.w + randi(46, 68),
        secondPlatform.y - randi(24, 40),
        randi(150, 190),
      );
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        collectiblesRef.current.push({
          id: ++lastIdRef.current,
          x: firstPlatform.x + firstPlatform.w - 12 + t * (thirdPlatform.x - firstPlatform.x - firstPlatform.w + 28),
          y: clampYCenter(firstPlatform.y - 14 - (firstPlatform.y - thirdPlatform.y) * t, R_COLLECTIBLE),
          r: R_COLLECTIBLE,
        });
      }
      if (Math.random() < 0.28) {
        spawnPurpleLine(thirdPlatform.x + 20, 1, clampYCenter(thirdPlatform.y - 20, R_X2), 40);
      }
      return;
    }

    if (event.name === "solaire_storm") {
      const stormY = clampYCenter(yForHeight(randf(H_SINGLE * 0.84, H_DOUBLE * 0.96)), R_X2);
      spawnPurpleLine(anchorX, 3, stormY, 40);
      pushCoinLine(anchorX + 10, 5, clampYCenter(stormY + 18, R_COLLECTIBLE), 38);
      if (Math.random() < 0.32) {
        spawnX2BonusForDoubleJump();
      }
    }
  }, [
    GROUND_Y,
    H_DOUBLE,
    H_SINGLE,
    clampYCenter,
    spawnCoinsGround,
    spawnPlatformBlock,
    spawnPurpleLine,
    spawnX2BonusForDoubleJump,
    yForHeight,
  ]);

  const triggerMiniEvent = useCallback((map: MapName) => {
    const eventName = miniEventForMap(map);
    if (!eventName) return;

    const now = Date.now();
    currentMiniEventRef.current = {
      name: eventName,
      map,
      endsAt: now + MINI_EVENT_DURATION_MS,
      nextBurstAt: now,
    };
    scheduleNextMiniEvent(now);

    if (eventName === "terre_tresor") {
      triggerRunBanner("Tresor terrestre", "#67E8F9", "Route riche, execution propre", 1150);
    } else if (eventName === "jupiter_crunch") {
      triggerRunBanner("Jupiter crunch", "#F59E0B", "Fenetre serree, gros payoff", 1150);
    } else if (eventName === "mars_orbit") {
      triggerRunBanner("Mars ascent", "#FB7185", "Plateformes obligatoires", 1150);
    } else {
      triggerRunBanner("Solar storm", "#A78BFA", "Burst cosmique", 1150);
    }
    flashHud(MAP_EFFECTS[map].accent, 420);
  }, [flashHud, scheduleNextMiniEvent, triggerRunBanner]);

  // ====== Main loop ======
  useEffect(() => {
    if (gameState !== "running") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      lastRenderCommitAtRef.current = 0;
      return;
    }

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = clamp((ts - lastTsRef.current) / 1000, 0, 0.05);
      lastTsRef.current = ts;
      const nowMs = Date.now();

      if (
        currentMiniEventRef.current &&
        (nowMs >= currentMiniEventRef.current.endsAt || currentMiniEventRef.current.map !== mapARef.current)
      ) {
        currentMiniEventRef.current = null;
      }

      // Map & diff: progression sequentielle avec temps minimum passe dans chaque monde.
      const unlockedMapIndex = mapIndexForScore(scoreRef.current);
      if (
        !currentMiniEventRef.current &&
        mapFadeRef.current <= 0 &&
        unlockedMapIndex > currentMapIndexRef.current &&
        nowMs >= nextMapAdvanceAtRef.current
      ) {
        const nextMapIndex = Math.min(currentMapIndexRef.current + 1, MAP_NAMES.length - 1);
        const nextMap = MAP_NAMES[nextMapIndex];
        mapARef.current = mapBRef.current;
        mapBRef.current = nextMap;
        mapFadeRef.current = 0;
        nextMapAdvanceAtRef.current = nowMs + MAP_MIN_DWELL_MS;
        currentMiniEventRef.current = null;
        nextMiniEventAtRef.current = nowMs + MINI_EVENT_FIRST_DELAY_MS;
        triggerMapArrival(nextMap);
      }
      if (mapFadeRef.current < 1) {
        mapFadeRef.current = clamp(mapFadeRef.current + dt / MAP_FADE_SECS, 0, 1);
        if (mapFadeRef.current >= 1) {
          mapARef.current = mapBRef.current;
          currentMapIndexRef.current = Math.max(0, MAP_NAMES.indexOf(mapARef.current));
          mapFadeRef.current = 0;
        }
      }
      const diff = getDifficultyByMap(mapARef.current);
      const mapFx = MAP_EFFECTS[mapARef.current];

      if (
        !currentMiniEventRef.current &&
        mapFadeRef.current <= 0 &&
        miniEventForMap(mapARef.current) &&
        nowMs >= nextMiniEventAtRef.current
      ) {
        triggerMiniEvent(mapARef.current);
      }
      if (currentMiniEventRef.current && nowMs >= currentMiniEventRef.current.nextBurstAt) {
        spawnMiniEventBurst(currentMiniEventRef.current);
        currentMiniEventRef.current.nextBurstAt = nowMs + MINI_EVENT_BURST_MS;
      }
      const isMiniEventActive = !!currentMiniEventRef.current;
      const activeEntityCount =
        obstaclesRef.current.length +
        platformsRef.current.length +
        collectiblesRef.current.length +
        powerUpsRef.current.length;
      const renderIntervalMs =
        isMiniEventActive || activeEntityCount >= RENDER_LOAD_ENTITY_THRESHOLD
          ? RUN_RENDER_INTERVAL_HIGH_LOAD_MS
          : RUN_RENDER_INTERVAL_MS;

      // Vitesse
      targetSpeedRef.current += diff.speedGain * (1 + mapFx.speedRush) * dt;
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
      const gravityBase = GRAVITY_BASE * diff.gravityMul * mapFx.lowGravityMul;
      const gravityNow = (velYRef.current < 0 && holdingJumpRef.current) ? gravityBase * HOLD_GRAVITY_SCALE : gravityBase;
      velYRef.current += gravityNow * dt;

      let newY = yRef.current + velYRef.current * dt;
      const floorY = GROUND_Y - PLAYER_SIZE;
      let landingY = floorY;
      const activeMiniEvent = currentMiniEventRef.current;
      const marsAscentRouteReady =
        isMarsAscentEvent(activeMiniEvent) &&
        platformsRef.current.some((platform) => platform.x + platform.w > playerX + 8 && platform.y < floorY - 20);
      const marsAscentArmed =
        isMarsAscentEvent(activeMiniEvent) &&
        marsAscentRouteReady &&
        nowMs >= marsAscentArmsAt(activeMiniEvent);

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
        if (marsAscentArmed && landingY >= floorY) {
          if (settings.haptics && Haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          endGame();
          return;
        }
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
      if (!isMiniEventActive && obstaclesRef.current.length === 0) {
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

      if (!isMiniEventActive) {
        const last = obstaclesRef.current[obstaclesRef.current.length - 1];
        if (!last || last.x < SCREEN_W - randi(Math.floor(OBSTACLE_MIN_GAP_BASE * 0.7), OBSTACLE_MAX_GAP_BASE)) {
          const nextMinGap = randi(OBSTACLE_MIN_GAP_BASE, OBSTACLE_MAX_GAP_BASE);
          if (!spawnPattern(nextMinGap, diff.gapMul, scoreRef.current)) {
            spawnObstacle(nextMinGap, diff.gapMul, scoreRef.current);
          }
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
          if (comboRef.current === 5) {
            triggerRunBanner("Combo x5", "#FBBF24", "La run chauffe", 820);
          } else if (comboRef.current === 10) {
            triggerRunBanner("Serie parfaite", "#F97316", "Tu tiens la cadence", 980);
          }

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
            // Bonus violet reduit pour garder la mecanique forte sans casser le score.
            const plus = applyScoreGain(PURPLE_SCORE_BASE);
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
              scoreMultLevelRef.current = clamp(scoreMultLevelRef.current + 1, 2, PURPLE_MAX_MULT);
              scoreMultUntilRef.current = now + SCORE_MULT_DURATION;
            } else {
              scoreMultLevelRef.current = 2;
              scoreMultUntilRef.current = now + SCORE_MULT_DURATION;
              if (!achievementsRef.current.first_x2) unlock("first_x2");
            }

            if ([2,4,6].includes(scoreMultLevelRef.current)) {
              showToast(`💜 ×${scoreMultLevelRef.current}`);
              triggerRunBanner(`Multiplicateur x${scoreMultLevelRef.current}`, "#C084FC", "Continue la chaine", 900);
            }
            if (nextPurpleChain >= PURPLE_CHAIN_GOAL) {
              spawnCoinsAirLine(PURPLE_CHAIN_AIR_COINS);
              showToast(`💜 Série ×${PURPLE_CHAIN_GOAL} !`);
              playApplauseSfx();
              triggerRunBanner("Purple chain", "#A78BFA", "Pluie de pièces", 1050);
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

            const lettersOwned = persistentLettersRef.current.size;
            if (lettersOwned === 2 || lettersOwned === 4) {
              const chainBonus = applyScoreGain(lettersOwned === 2 ? 1500 : 2500);
              setScore((prev) => {
                const next = prev + chainBonus;
                scoreRef.current = next;
                checkMilestones(next);
                return next;
              });
              popupsRef.current.push({
                id: ++lastIdRef.current,
                x: playerX + 40,
                y: yRef.current,
                born: Date.now(),
                text: lettersOwned === 2 ? `COM +${chainBonus}` : `COME +${chainBonus}`,
              });
              spawnCoinsAirLine(lettersOwned === 2 ? 5 : 7);
              if (lettersOwned === 4) {
                spawnX2BonusForDoubleJump();
              }
              showToast(lettersOwned === 2 ? "COM active !" : "COME boost !");
            }

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

      for (const o of obstaclesRef.current) {
        if (o.grazed) continue;

        const obstacleRight = o.x + o.w;
        if (obstacleRight > cx) continue;

        o.grazed = true;

        const horizontalGap = cx - obstacleRight;
        const verticalGap = o.y - (yRef.current + PLAYER_SIZE);
        const isNearMiss =
          horizontalGap >= 0 &&
          horizontalGap <= NEAR_MISS_X_WINDOW &&
          verticalGap >= 0 &&
          verticalGap <= NEAR_MISS_Y_WINDOW;

        if (!isNearMiss) continue;

        runNearMissesRef.current += 1;
        const grazeScore = applyScoreGain(Math.floor(NEAR_MISS_BASE_SCORE * getSpeedMultiplier(s) * mapFx.nearMissMul));
        setScore((prev) => {
          const next = prev + grazeScore;
          scoreRef.current = next;
          checkMilestones(next);
          return next;
        });
        popupsRef.current.push({
          id: ++lastIdRef.current,
          x: playerX + PLAYER_SIZE + 4,
          y: yRef.current + 8,
          born: Date.now(),
          text: `Close +${grazeScore}`,
        });
        if (runNearMissesRef.current === 3 || runNearMissesRef.current === 6) {
          triggerRunBanner(
            runNearMissesRef.current === 3 ? "Dare streak" : "Risk addict",
            "#F97316",
            runNearMissesRef.current === 3 ? "Les close calls paient" : "Tu joues vraiment au bord",
            950,
          );
        }
        flashHud(mapFx.accent, 260);
        if (settings.haptics && Haptics) Haptics.selectionAsync?.().catch(() => {});
      }

      // ===== Score distance =====
      distAccRef.current += s * dt;
      if (distAccRef.current >= 10) {
        const gainedUnits = Math.floor(distAccRef.current / 10);
        distAccRef.current -= gainedUnits * 10;

        setScore((prev) => {
          const base = Math.floor(gainedUnits * getSpeedMultiplier(s) * mapFx.distanceScoreMul);
          const added = applyScoreGain(base);
          const next = prev + added;
          scoreRef.current = next;

          if (next >= 2000) unlock("score_2000");
          checkMilestones(next);

          // Paliers de lettres: une seule lettre a la fois, avec un vrai ecart de score entre deux apparitions.
          if (
            next >= nextLetterSpawnScoreRef.current &&
            !powerUpsRef.current.some((powerUp) => powerUp.kind === "letter")
          ) {
            const nextLetterIdx = LETTER_THRESHOLDS.findIndex((threshold, idx) => (
              next >= threshold &&
              !spawnedLetterIdxThisRunRef.current.has(idx) &&
              !persistentLettersRef.current.has(LETTERS[idx])
            ));
            if (nextLetterIdx >= 0) {
              spawnLetterAtIndex(nextLetterIdx);
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
      if (popupsRef.current.length > MAX_VISIBLE_POPUPS) {
        popupsRef.current = popupsRef.current.slice(popupsRef.current.length - MAX_VISIBLE_POPUPS);
      }

      // Render tick
      if (
        lastRenderCommitAtRef.current === 0 ||
        nowMs - lastRenderCommitAtRef.current >= renderIntervalMs
      ) {
        lastRenderCommitAtRef.current = nowMs;
        setFrameTick((t) => (t + 1) % 1_000_000);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [
    gameState,
    endGame,
    spawnObstacle,
    spawnPattern,
    spawnMiniEventBurst,
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
    triggerMapArrival,
    triggerMiniEvent,
    triggerRunBanner,
    flashHud,
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
  const showHeroHeader = gameState !== "running" && gameState !== "ready";
  const activeMapEffect = MAP_EFFECTS[mapNow];
  const activeRunBanner = runBanner && Date.now() < runBanner.until ? runBanner : null;
  const activeHudFlash = hudFlash && Date.now() < hudFlash.until ? hudFlash : null;
  const activeTheme = THEME_PRESETS[loadout.theme];
  const activeThemeOption = THEME_OPTIONS.find((item) => item.id === loadout.theme) ?? THEME_OPTIONS[0];
  const activeTrail = TRAIL_OPTIONS.find((item) => item.id === loadout.trail) ?? TRAIL_OPTIONS[0];
  const activeTitle = TITLE_OPTIONS.find((item) => item.id === loadout.title) ?? TITLE_OPTIONS[0];
  const activePerk = PERK_OPTIONS.find((item) => item.id === loadout.perk) ?? PERK_OPTIONS[0];
  const isReadyStacked = viewportWidth < 620 || isReadyShort;
  const activeMiniEventState = currentMiniEventRef.current;
  const marsAscentActive = gameState === "running" && isMarsAscentEvent(activeMiniEventState);
  const marsAscentArmed =
    isMarsAscentEvent(activeMiniEventState) &&
    platformsRef.current.some((platform) => platform.x + platform.w > playerX + 8 && platform.y < GROUND_Y - PLAYER_SIZE - 20) &&
    Date.now() >= marsAscentArmsAt(activeMiniEventState);
  const liveEntityCount =
    obstaclesRef.current.length +
    platformsRef.current.length +
    collectiblesRef.current.length +
    powerUpsRef.current.length;
  const highLoadVisuals =
    gameState === "running" &&
    (Boolean(activeMiniEventState) || liveEntityCount >= RENDER_LOAD_ENTITY_THRESHOLD);
  const visibleTrailDots = highLoadVisuals ? 2 : TRAIL_DOT_COUNT;

  const speedMult = Math.min(MULT_MAX, MULT_MIN + Math.max(0, speedRef.current - START_SPEED) / MULT_SCALE).toFixed(1);
  const scoreBuff = getActiveScoreMult();
  const dailyMissionDoneCount = useMemo(() => getDailyMissionDoneCount(dailyMissions), [dailyMissions]);
  const playerVisual = useMemo(() => {
    const absVy = Math.abs(velYRef.current);
    const stretch = clamp(absVy / 1200, 0, 0.14);
    if (gameState !== "running") {
      return { scaleX: 1, scaleY: 1, translateY: 0, trailBoost: 0.9 };
    }
    if (groundedRef.current) {
      return { scaleX: 1.04, scaleY: 0.96, translateY: 1, trailBoost: 0.92 };
    }
    if (velYRef.current < -40) {
      return { scaleX: 1 - stretch * 0.55, scaleY: 1 + stretch, translateY: -2, trailBoost: 1.18 };
    }
    return { scaleX: 1 + stretch * 0.42, scaleY: 1 - stretch * 0.3, translateY: 0, trailBoost: 1.04 };
  }, [frameTick, gameState]);

  const nextUnlockHints = useMemo(() => {
    const groups = [
      { group: "Trail", option: TRAIL_OPTIONS.find((item) => !item.isUnlocked(metaStats, achievements, best)) },
      { group: "Theme", option: THEME_OPTIONS.find((item) => !item.isUnlocked(metaStats, achievements, best)) },
      { group: "Titre", option: TITLE_OPTIONS.find((item) => !item.isUnlocked(metaStats, achievements, best)) },
      { group: "Perk", option: PERK_OPTIONS.find((item) => !item.isUnlocked(metaStats, achievements, best)) },
    ];
    const hints: {
      group: string;
      label: string;
      accent: string;
      unlockLabel: string;
      text: string;
      ratio: number;
    }[] = [];
    for (const entry of groups) {
      if (!entry.option) continue;
      hints.push({
        group: entry.group,
        label: entry.option.label,
        accent: entry.option.accent,
        unlockLabel: entry.option.unlockLabel,
        ...getUnlockProgressForId(entry.option.id, metaStats, achievements, best),
      });
    }
    return hints.slice(0, 3);
  }, [achievements, best, metaStats]);
  const primaryUnlockHint = nextUnlockHints[0] ?? null;
  const missionRatio = DAILY_MISSIONS.length > 0 ? dailyMissionDoneCount / DAILY_MISSIONS.length : 0;
  const missionStatusText =
    dailyMissionDoneCount >= DAILY_MISSIONS.length
      ? "Briefing termine"
      : `${Math.max(0, DAILY_MISSIONS.length - dailyMissionDoneCount)} mission${DAILY_MISSIONS.length - dailyMissionDoneCount > 1 ? "s" : ""} restante${DAILY_MISSIONS.length - dailyMissionDoneCount > 1 ? "s" : ""}`;
  const routeStops = useMemo(
    () => [
      { key: "base", label: "Base", threshold: 0, accent: MAP_EFFECTS.base.accent },
      { key: "terre", label: "Terre", threshold: MAP_SWITCH_AT.base_to_terre, accent: MAP_EFFECTS.terre.accent },
      { key: "jupiter", label: "Jupiter", threshold: MAP_SWITCH_AT.terre_to_jupiter, accent: MAP_EFFECTS.jupiter.accent },
      { key: "mars", label: "Mars", threshold: MAP_SWITCH_AT.jupiter_to_mars, accent: MAP_EFFECTS.mars.accent },
      { key: "solaire", label: "Solaire", threshold: MAP_SWITCH_AT.mars_to_solaire, accent: MAP_EFFECTS.systeme_solaire.accent },
    ],
    []
  );
  const routeProgress = clamp(best / MAP_SWITCH_AT.mars_to_solaire, 0, 1);
  const nextRouteStop = routeStops.find((stop) => best < stop.threshold) ?? routeStops[routeStops.length - 1];
  const readyLoadoutCards = [
    {
      key: "perk",
      label: "Bonus",
      value: activePerk.label,
      hint: activePerk.description,
      accent: activePerk.accent,
      icon: "sparkles-outline" as const,
      onPress: () => cycleLoadout("perk"),
    },
    {
      key: "title",
      label: "Titre",
      value: activeTitle.label,
      hint: `Signature ${activeTitle.label.toLowerCase()}`,
      accent: activeTitle.accent,
      icon: "ribbon-outline" as const,
      onPress: () => cycleLoadout("title"),
    },
    {
      key: "trail",
      label: "Trace",
      value: activeTrail.label,
      hint: `Sillage ${activeTrail.label.toLowerCase()}`,
      accent: activeTrail.accent,
      icon: "flash-outline" as const,
      onPress: () => cycleLoadout("trail"),
    },
    {
      key: "theme",
      label: "Style",
      value: activeThemeOption.label,
      hint: `Palette ${activeThemeOption.label.toLowerCase()}`,
      accent: activeThemeOption.accent,
      icon: "color-palette-outline" as const,
      onPress: () => cycleLoadout("theme"),
    },
  ];
  const readyBriefingRows = [
    { key: "coin", icon: "ellipse-outline" as const, title: "Ligne propre", body: "Les pièces et la route de vol doivent rester lisibles au premier coup d'œil." },
    { key: "perk", icon: "shield-checkmark-outline" as const, title: "Ouverture forte", body: "Ton bonus décide le tempo du début de run, pas seulement une ligne de texte." },
    { key: "goal", icon: "rocket-outline" as const, title: "Objectif visible", body: nextRouteStop.threshold > 0 ? `Cap sur ${nextRouteStop.label} à ${Math.round(nextRouteStop.threshold / 1000)}k.` : "Cap sur le premier secteur." },
  ];

  const weeklyChallenge = useMemo(() => {
    const safeBest = Math.max(0, best);
    const displayName = (row: LBRow) => {
      const first = row.admins?.first_name?.trim() || "";
      const last = row.admins?.last_name?.trim() || "";
      return `${first} ${last}`.trim() || "le top 5";
    };
    if (!top5 || top5.length === 0) {
      return {
        title: "Objectif hebdo",
        body: "Pose le premier gros score de la semaine",
        accent: "#FBBF24",
      };
    }
    const others = top5
      .filter((row) => !adminId || row.admin_id !== adminId)
      .sort((a, b) => a.best_score - b.best_score);
    const next = others.find((row) => row.best_score > safeBest);
    if (next) {
      return {
        title: "Objectif hebdo",
        body: `${Math.max(1, next.best_score - safeBest)} pts pour passer ${displayName(next)}`,
        accent: "#67E8F9",
      };
    }
    return {
      title: "Objectif hebdo",
      body: "Tu tiens le top 5 cette semaine. Défends ton score.",
      accent: "#FACC15",
    };
  }, [adminId, best, top5]);

  const activeEventHud = useMemo(() => {
    const now = Date.now();
    if (gameState !== "running") return null;
    if (activeMiniEventState) {
      const left = Math.max(0, Math.ceil((activeMiniEventState.endsAt - now) / 1000));
      if (isMarsAscentEvent(activeMiniEventState)) {
        return {
          title: marsAscentArmed ? "Faille active" : "Faille en place",
          subtitle: marsAscentArmed ? `Reste sur les plateformes · ${left}s` : `Montée sécurisée · ${left}s`,
          accent: marsAscentArmed ? "#FB7185" : "#FDBA74",
        };
      }
      if (activeMiniEventState.name === "terre_tresor") {
        return { title: "Trésor terrestre", subtitle: `Fenêtre de loot · ${left}s`, accent: "#67E8F9" };
      }
      if (activeMiniEventState.name === "jupiter_crunch") {
        return { title: "Jupiter crunch", subtitle: `Section lourde · ${left}s`, accent: "#F59E0B" };
      }
      return { title: "Solar storm", subtitle: `Burst cosmique · ${left}s`, accent: "#A78BFA" };
    }
    const nextMiniLeftMs = nextMiniEventAtRef.current - now;
    if (mapNow !== "base" && mapFadeRef.current <= 0 && nextMiniLeftMs > 0 && nextMiniLeftMs <= 4_000) {
      return {
        title: "Moment spécial",
        subtitle: `${Math.max(1, Math.ceil(nextMiniLeftMs / 1000))}s`,
        accent: activeMapEffect.accent,
      };
    }
    return null;
  }, [activeMapEffect.accent, activeMiniEventState, frameTick, gameState, mapNow, marsAscentArmed]);

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
        <Text style={styles.titleSubSlim}>{activeTitle.label} · {activePerk.label}</Text>
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
      {gameState !== "ready" && (
        <View pointerEvents="none" style={styles.scoreBigWrap}>
          <Text
            style={[
              styles.scoreBig,
              { backgroundColor: activeTheme.scoreBg },
              activeHudFlash
                ? {
                    borderColor: activeHudFlash.accent,
                    color: activeHudFlash.accent,
                    backgroundColor: "rgba(11,15,23,0.84)",
                  }
                : null,
            ]}
          >
            {score}
          </Text>
        </View>
      )}

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

      {gameState === "running" && (
        <View
          pointerEvents="none"
          style={[
            styles.mapHudWrap,
            compactBadges.length > 0 ? styles.mapHudWrapWithBadges : styles.mapHudWrapSolo,
          ]}
        >
          <View
            style={[
              styles.mapPill,
              {
                borderColor: activeMapEffect.accent,
                backgroundColor: activeHudFlash ? "rgba(7,10,17,0.94)" : "rgba(7,10,17,0.74)",
              },
            ]}
          >
            <Text style={[styles.mapPillTitle, { color: activeMapEffect.accent }]}>{activeMapEffect.label}</Text>
            <Text style={styles.mapPillTxt}>{activeMapEffect.hudNote}</Text>
          </View>
          {activeEventHud && (
            <View style={[styles.eventPill, { borderColor: activeEventHud.accent }]}>
              <Text style={[styles.eventPillTitle, { color: activeEventHud.accent }]}>{activeEventHud.title}</Text>
              <Text style={styles.eventPillTxt}>{activeEventHud.subtitle}</Text>
            </View>
          )}
        </View>
      )}

      {/* GAME AREA */}
      <Pressable
        onLayout={onGameAreaLayout}
        onPressIn={gameState === "ready" ? undefined : handlePressIn}
        onPressOut={gameState === "ready" ? undefined : handlePressOut}
        pointerEvents={gameState === "ready" ? "box-none" : "auto"}
        style={styles.gameArea}
        android_disableSound
        android_ripple={{ color: "transparent" }}
      >
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
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

          {activeHudFlash && (
            <View
              pointerEvents="none"
              style={[styles.hudFlashOverlay, { backgroundColor: activeHudFlash.accent }]}
            />
          )}

          {(!highLoadVisuals || gameState !== "running") &&
            renderFence({ SCREEN_W, GROUND_Y, fenceOffsetRef, settings: { ...settings, fenceColor: activeTheme.fence } })}

          {/* Sol */}
          {showGround && (
            <>
              <View
                style={[
                  styles.ground,
                  { top: GROUND_Y, backgroundColor: settings.highContrast ? "#fff" : activeTheme.ground },
                ]}
              />
              <View
                style={[
                  styles.groundDetail,
                  { top: GROUND_Y + 8, backgroundColor: settings.highContrast ? "#aaa" : activeTheme.detail },
                ]}
              />
              {(!highLoadVisuals || gameState !== "running") &&
                renderGroundStripes({ SCREEN_W, GROUND_Y, groundOffsetRef, settings: { ...settings, stripeColor: activeTheme.detail } })}
              {marsAscentActive && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.marsHazardBand,
                    {
                      top: GROUND_Y - 2,
                      backgroundColor: marsAscentArmed ? "rgba(153,27,27,0.48)" : "rgba(190,24,93,0.22)",
                      borderColor: marsAscentArmed ? "rgba(251,113,133,0.92)" : "rgba(251,113,133,0.42)",
                    },
                  ]}
                />
              )}
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

          {gameState === "running" && (
            <>
              {Array.from({ length: visibleTrailDots }, (_, idx) => idx).map((idx) => (
                <View
                  key={`trail-${idx}`}
                  pointerEvents="none"
                  style={[
                    styles.trailDot,
                    {
                      left: playerX - 8 - idx * 13,
                      top: yRef.current + 18 + idx * 2,
                      backgroundColor: activeTrail.accent,
                      opacity: 0.46 - idx * 0.09,
                      transform: [{ scale: (1 - idx * 0.16) * playerVisual.trailBoost }],
                    },
                  ]}
                />
              ))}
            </>
          )}

          {gameState === "running" && (
            !highLoadVisuals ? (
              <View
                pointerEvents="none"
                style={[
                  styles.playerCoreAura,
                  {
                    left: playerX - 7,
                    top: yRef.current - 7,
                    borderColor: activeMapEffect.accent,
                    backgroundColor: `${activeMapEffect.accent}22`,
                    transform: [{ scale: 1 + Math.min(0.16, Math.abs(velYRef.current) / 1800) }],
                  },
                ]}
              />
            ) : null
          )}

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
                top: yRef.current + playerVisual.translateY,
                width: PLAYER_SIZE,
                height: PLAYER_SIZE,
                borderRadius: PLAYER_RADIUS,
                transform: [
                  { rotate: `${angleRef.current}rad` },
                  { scaleX: playerVisual.scaleX },
                  { scaleY: playerVisual.scaleY },
                ],
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
                    borderColor: `${activeMapEffect.accent}55`,
                  },
                ]}
              >
                <View style={[styles.platformTop, { backgroundColor: activeMapEffect.accent }]} />
              </View>
            ))}

          {/* Obstacles */}
          {obstaclesRef.current.map((o) => (
            <React.Fragment key={o.id}>
              {!highLoadVisuals && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.obstacleGlow,
                    {
                      left: o.x - 4,
                      top: o.y - 4,
                      width: o.w + 8,
                      height: o.h + 8,
                      borderColor: `${activeMapEffect.accent}55`,
                      backgroundColor: `${activeMapEffect.accent}18`,
                    },
                  ]}
                />
              )}
              <Image
                source={o.variant === 0 ? imgObs1 : imgObs2}
                style={[
                  styles.obstacleImg,
                  { left: o.x, top: o.y, width: o.w, height: o.h, opacity: mapNow === "systeme_solaire" ? 0.95 : 1 },
                ]}
                resizeMode="cover"
              />
            </React.Fragment>
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
            borderColor: LETTER_RING_COLOR,
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
            <Modal
              transparent
              animationType="fade"
              visible
              statusBarTranslucent
              navigationBarTranslucent
              onRequestClose={() => router.back()}
            >
            <View
              style={[
                styles.readyOverlayShell,
                isReadyCompact ? styles.readyOverlayShellCompact : null,
                isReadyShort ? styles.readyOverlayShellShort : null,
              ]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(1,4,10,0.94)", "rgba(4,8,16,0.88)", "rgba(2,6,12,0.96)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.readyOverlayScrim}
              />
              <View pointerEvents="none" style={[styles.readyBackdropGlow, { backgroundColor: `${activeThemeOption.accent}18` }]} />
              <View pointerEvents="none" style={[styles.readyBackdropGlowSecondary, { backgroundColor: `${activeMapEffect.accent}18` }]} />
              <ScrollView
                style={styles.readyOverlayScrollView}
                contentContainerStyle={[
                  styles.readyOverlayScrollContent,
                  isReadyViewportScroll ? styles.readyOverlayScrollContentScrollable : null,
                ]}
                scrollEnabled={isReadyViewportScroll}
                showsVerticalScrollIndicator={isReadyViewportScroll}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
              <View
                style={[
                  styles.readyTopBar,
                  isReadyCompact ? styles.readyTopBarCompact : null,
                  isReadyShort ? styles.readyTopBarShort : null,
                ]}
              >
                <View style={styles.readyTopBarBrand}>
                  <Pressable
                    onPress={() => router.back()}
                    style={[styles.iconBtnSlim, styles.readyTopActionBtn]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="chevron-back" size={18} color={HOME_UI.accent} />
                  </Pressable>
                  <View style={styles.titleRowSlim}>
                    <Image source={logoComets} style={styles.logoSlim} resizeMode="contain" />
                    <View>
                      <Text style={styles.titleSlim}>Comets Run</Text>
                      <Text style={styles.readyTopBarSub}>{activeTitle.label} / {activePerk.label}</Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.readyLaunchStatusPill,
                    isReadyShort ? styles.readyLaunchStatusPillShort : null,
                    { borderColor: `${activeMapEffect.accent}66` },
                  ]}
                >
                  <Text style={[styles.readyLaunchStatusLabel, { color: activeMapEffect.accent }]}>Secteur</Text>
                  <Text style={styles.readyLaunchStatusValue}>{activeMapEffect.label}</Text>
                </View>

                <View style={styles.readyTopBarActions}>
                  <Pressable
                    onPress={() => router.push("/CometsLeaderboardScreen" as any)}
                    style={[styles.iconBtnSlim, styles.readyTopActionBtn]}
                  >
                    <Icon name="trophy-outline" size={18} color={HOME_UI.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => setShowHelp((value) => !value)}
                    style={[styles.iconBtnSlim, styles.readyTopActionBtn]}
                  >
                    <Icon name={showHelp ? "information-circle" : "help-circle-outline"} size={18} color={HOME_UI.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSetting("mute")}
                    style={[styles.iconBtnSlim, styles.readyTopActionBtn]}
                  >
                    <Icon
                      name={settings.mute ? "volume-mute" : "volume-high"}
                      size={18}
                      color={settings.mute ? HOME_UI.muted : HOME_UI.accent}
                    />
                  </Pressable>
                </View>
              </View>

              <View
                style={[
                  styles.readyLaunchLayout,
                  isReadyViewportScroll ? styles.readyLaunchLayoutScrollable : null,
                  isReadyShort ? styles.readyLaunchLayoutShort : null,
                  isReadyStacked ? styles.readyLaunchLayoutStacked : null,
                ]}
              >
                <LinearGradient
                  colors={["rgba(7,12,21,0.88)", "rgba(10,20,36,0.82)", `${activeThemeOption.accent}20`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.readyHeroStage,
                    isReadyDense ? styles.readyHeroStageDense : null,
                    isReadyShort ? styles.readyHeroStageShort : null,
                    isReadyStacked ? styles.readyHeroStageStacked : null,
                    isReadyShort ? styles.readyHeroStageStackedShort : null,
                    isReadyViewportScroll ? styles.readyHeroStageScrollable : null,
                    isReadyViewportScroll ? styles.readyHeroStageStackedScrollable : null,
                  ]}
                >
                  <View pointerEvents="none" style={[styles.readyHeroGlow, { backgroundColor: `${activeMapEffect.accent}22` }]} />
                  <View style={styles.readyHeroTopline}>
                    <View>
                      <Text style={styles.readyHeroEyebrow}>Pre-launch</Text>
                      <Text style={[styles.readyHeroTitle, isReadyCompact ? styles.readyHeroTitleCompact : null]}>
                        Sas orbital Comets
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.readyHeroBadge,
                        isReadyShort ? styles.readyHeroBadgeShort : null,
                        { borderColor: `${activeThemeOption.accent}66` },
                      ]}
                    >
                      <Text style={[styles.readyHeroBadgeLabel, { color: activeThemeOption.accent }]}>Style</Text>
                      <Text style={styles.readyHeroBadgeValue}>{activeThemeOption.label}</Text>
                    </View>
                  </View>

                  <Text
                    numberOfLines={isReadyDense || isReadyShort ? 2 : undefined}
                    style={[
                      styles.readyHeroBody,
                      isReadyCompact ? styles.readyHeroBodyCompact : null,
                      isReadyShort ? styles.readyHeroBodyShort : null,
                    ]}
                  >
                    Prépare ta run comme une mise à feu : lecture claire, configuration visible et objectif de progression immédiat.
                  </Text>

                  <View
                    style={[
                      styles.readyHeroVisual,
                      isReadyDense ? styles.readyHeroVisualDense : null,
                      isReadyShort ? styles.readyHeroVisualShort : null,
                      isReadyStacked ? styles.readyHeroVisualStacked : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.readyHeroOrbit,
                        isReadyShort ? styles.readyHeroOrbitShort : null,
                        { borderColor: `${activeMapEffect.accent}55` },
                      ]}
                    />
                    <View
                      style={[
                        styles.readyHeroOrbitInner,
                        isReadyShort ? styles.readyHeroOrbitInnerShort : null,
                        { borderColor: `${activeThemeOption.accent}55` },
                      ]}
                    />
                    <View
                      style={[
                        styles.readyHeroLogoFrame,
                        isReadyDense ? styles.readyHeroLogoFrameDense : null,
                        isReadyShort ? styles.readyHeroLogoFrameShort : null,
                        { borderColor: `${activeMapEffect.accent}88` },
                      ]}
                    >
                      <Image
                        source={logoComets}
                        style={[styles.readyHeroLogo, isReadyShort ? styles.readyHeroLogoShort : null]}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={[styles.readyHeroTrailRow, isReadyShort ? styles.readyHeroTrailRowShort : null]}>
                      {[0, 1, 2, 3].map((idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.readyHeroTrailDot,
                            isReadyShort ? styles.readyHeroTrailDotShort : null,
                            {
                              backgroundColor: activeTrail.accent,
                              opacity: 0.85 - idx * 0.16,
                              transform: [{ scale: 1 - idx * 0.12 }],
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.readyHeroStatRow,
                      isReadyCompact ? styles.readyHeroStatRowCompact : null,
                      isReadyDense ? styles.readyHeroStatRowDense : null,
                      isReadyShort ? styles.readyHeroStatRowShort : null,
                    ]}
                  >
                    <View style={[styles.readyHeroStatCard, styles.readyHeroStatCardAccent, isReadyShort ? styles.readyHeroStatCardShort : null]}>
                      <Text style={[styles.readyHeroStatLabel, isReadyShort ? styles.readyHeroStatLabelShort : null]}>Record</Text>
                      <Text style={[styles.readyHeroStatValue, isReadyShort ? styles.readyHeroStatValueShort : null]}>{best}</Text>
                    </View>
                    <View style={[styles.readyHeroStatCard, isReadyShort ? styles.readyHeroStatCardShort : null]}>
                      <Text style={[styles.readyHeroStatLabel, isReadyShort ? styles.readyHeroStatLabelShort : null]}>Missions</Text>
                      <Text style={[styles.readyHeroStatValue, isReadyShort ? styles.readyHeroStatValueShort : null]}>
                        {dailyMissionDoneCount}/{DAILY_MISSIONS.length}
                      </Text>
                    </View>
                    <View style={[styles.readyHeroStatCard, isReadyShort ? styles.readyHeroStatCardShort : null]}>
                      <Text style={[styles.readyHeroStatLabel, isReadyShort ? styles.readyHeroStatLabelShort : null]}>Cap suivant</Text>
                      <Text style={[styles.readyHeroStatValue, isReadyShort ? styles.readyHeroStatValueShort : null]}>{nextRouteStop.label}</Text>
                    </View>
                  </View>

                  {isReadyDense ? (
                    <View style={[styles.readyRouteCompact, isReadyShort ? styles.readyRouteCompactShort : null]}>
                      <Text style={styles.readyRoutePanelEyebrow}>Route</Text>
                      <Text style={styles.readyRouteCompactText}>
                        {Math.round(routeProgress * 100)} % complété · prochain cap {nextRouteStop.label}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.readyRoutePanel, isReadyShort ? styles.readyRoutePanelShort : null]}>
                      <View style={styles.readyRoutePanelHeader}>
                        <View>
                          <Text style={styles.readyRoutePanelEyebrow}>Route de vol</Text>
                          <Text style={styles.readyRoutePanelTitle}>Base vers système solaire</Text>
                        </View>
                        <Text style={styles.readyRoutePanelMeta}>{Math.round(routeProgress * 100)}%</Text>
                      </View>
                      <View style={styles.readyRouteTrack}>
                        <View style={[styles.readyRouteFill, { width: `${Math.max(10, Math.round(routeProgress * 100))}%` }]} />
                      </View>
                      <View style={styles.readyRouteStops}>
                        {routeStops.map((stop) => {
                          const unlocked = best >= stop.threshold;
                          const isUpcoming = nextRouteStop.key === stop.key && !unlocked;
                          return (
                            <View key={stop.key} style={styles.readyRouteStop}>
                              <View
                                style={[
                                  styles.readyRouteNode,
                                  unlocked ? { backgroundColor: stop.accent, borderColor: stop.accent } : null,
                                  isUpcoming ? styles.readyRouteNodeUpcoming : null,
                                ]}
                              />
                              <Text style={[styles.readyRouteStopLabel, unlocked ? styles.readyRouteStopLabelActive : null]}>
                                {stop.label}
                              </Text>
                              <Text style={styles.readyRouteStopMeta}>
                                {stop.threshold === 0 ? "Start" : `${Math.round(stop.threshold / 1000)}k`}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </LinearGradient>

                <View
                  style={[
                    styles.readyControlPanel,
                    isReadyCompact ? styles.readyControlPanelCompact : null,
                    isReadyDense ? styles.readyControlPanelDense : null,
                    isReadyShort ? styles.readyControlPanelShort : null,
                    isReadyStacked ? styles.readyControlPanelStacked : null,
                    isReadyViewportScroll ? styles.readyControlPanelScrollable : null,
                  ]}
                >
                  <View
                    style={[
                      styles.readyControlShell,
                      isReadyDense ? styles.readyControlShellDense : null,
                      isReadyShort ? styles.readyControlShellShort : null,
                      isReadyViewportScroll ? styles.readyControlShellScrollable : null,
                    ]}
                  >
                    <View style={[styles.readyControlHeader, isReadyShort ? styles.readyControlHeaderShort : null]}>
                      <Text style={styles.readyDockEyebrow}>Mission control</Text>
                      <Text
                        style={[
                          styles.readyDockTitle,
                          isReadyCompact ? styles.readyDockTitleCompact : null,
                          isReadyShort ? styles.readyDockTitleShort : null,
                        ]}
                      >
                        Configuration de la run
                      </Text>
                      <Text
                        style={[
                          styles.readyDockBody,
                          isReadyCompact ? styles.readyDockBodyCompact : null,
                          isReadyShort ? styles.readyDockBodyShort : null,
                        ]}
                      >
                        Toute la configuration est visible ici. Tu ajustes, puis tu lances.
                      </Text>
                    </View>

                    <ScrollView
                      style={[
                        styles.readyControlScrollView,
                        isReadyViewportScroll ? styles.readyControlScrollViewStatic : null,
                      ]}
                      contentContainerStyle={styles.readyControlScrollContent}
                      showsVerticalScrollIndicator={!isReadyViewportScroll}
                      nestedScrollEnabled={!isReadyViewportScroll}
                      scrollEnabled={!isReadyViewportScroll}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={styles.readyControlBody}>
                        <View style={styles.readyControlSummaryCol}>
                          <View style={styles.readyPrepGrid}>
                            <View style={[styles.readyPrepCard, styles.readyPrepCardWide, styles.readyPrepCardAccent]}>
                              <Text style={styles.readyMetaLabel}>Challenge</Text>
                              <Text numberOfLines={3} style={styles.readyPrepValue}>{weeklyChallenge.body}</Text>
                            </View>
                            <View style={styles.readyPrepCard}>
                              <Text style={styles.readyMetaLabel}>Missions</Text>
                              <Text style={styles.readyPrepValue}>{dailyMissionDoneCount}/{DAILY_MISSIONS.length}</Text>
                              <Text numberOfLines={1} style={styles.readyPrepMeta}>{missionStatusText}</Text>
                            </View>
                            <View style={styles.readyPrepCard}>
                              <Text style={styles.readyMetaLabel}>Secteur</Text>
                              <Text style={styles.readyPrepValue}>{activeMapEffect.label}</Text>
                              <Text numberOfLines={1} style={styles.readyPrepMeta}>{activeMapEffect.hudNote}</Text>
                            </View>
                            {primaryUnlockHint && (
                              <View style={styles.readyPrepCard}>
                                <Text style={styles.readyMetaLabel}>Prochain unlock</Text>
                                <Text numberOfLines={1} style={[styles.readyPrepValue, { color: primaryUnlockHint.accent }]}>
                                  {primaryUnlockHint.label}
                                </Text>
                                <Text numberOfLines={1} style={styles.readyPrepMeta}>{primaryUnlockHint.unlockLabel}</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.readyMissionCompactPanel}>
                            <View style={styles.readyMissionCompactHeader}>
                              <Text style={styles.readyMissionEyebrow}>Missions du jour</Text>
                              <Text style={styles.readyMissionCompactMeta}>{Math.round(missionRatio * 100)}%</Text>
                            </View>
                            <View style={styles.unlockTrackBar}>
                              <View
                                style={[
                                  styles.unlockTrackFill,
                                  {
                                    width: `${Math.max(10, Math.round(missionRatio * 100))}%`,
                                    backgroundColor: "#67E8F9",
                                  },
                                ]}
                              />
                            </View>
                            <View style={styles.readyMissionCompactList}>
                              {DAILY_MISSIONS.map((mission) => {
                                const value = getDailyMissionValue(dailyMissions, mission.id);
                                const done = value >= mission.target;
                                return (
                                  <View key={mission.id} style={styles.readyMissionCompactRow}>
                                    <View
                                      style={[
                                        styles.readyMissionDot,
                                        { backgroundColor: done ? "#22C55E" : mission.tint },
                                      ]}
                                    />
                                    <Text numberOfLines={1} style={styles.readyMissionCompactLabel}>{mission.label}</Text>
                                    <Text style={[styles.readyMissionValue, done ? styles.readyMissionValueDone : null]}>
                                      {Math.min(value, mission.target)}/{mission.target}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>

                          {showHelp && (
                            <View style={styles.readyBriefingCompactCard}>
                              <Text style={styles.readySectionTitle}>Aide rapide</Text>
                              <View style={styles.readyBriefingCompactList}>
                                {readyBriefingRows.map((item) => (
                                  <View key={item.key} style={styles.readyBriefingCompactRow}>
                                    <View style={styles.readyBriefingIconWrapCompact}>
                                      <Icon name={item.icon} size={15} color={HOME_UI.accent} />
                                    </View>
                                    <Text numberOfLines={2} style={styles.readyBriefingCompactText}>
                                      <Text style={styles.readyBriefingCompactLabel}>{item.title}: </Text>
                                      {item.body}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>

                        <View style={styles.readyControlLoadoutCol}>
                          <View style={styles.readyLoadoutSection}>
                            <Text style={styles.readySectionTitle}>Loadout actif</Text>
                            <Text style={styles.readySectionSub}>Les 4 réglages sont visibles ici.</Text>
                            <View style={styles.readyLoadoutList}>
                              {readyLoadoutCards.map((card) => (
                                <Pressable
                                  key={card.key}
                                  style={[styles.readyLoadoutListItem, { borderColor: `${card.accent}44` }]}
                                  onPress={card.onPress}
                                >
                                  <View style={styles.readyLoadoutListItemMain}>
                                    <View style={[styles.readyLoadoutCardIcon, { backgroundColor: `${card.accent}22`, borderColor: `${card.accent}55` }]}>
                                      <Icon name={card.icon} size={15} color={card.accent} />
                                    </View>
                                    <View style={styles.readyLoadoutListItemCopy}>
                                      <Text style={styles.readyQuickLabel}>{card.label}</Text>
                                      <Text numberOfLines={1} style={[styles.readyLoadoutListItemValue, { color: card.accent }]}>
                                        {card.value}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={styles.readyLoadoutListItemAction}>Changer</Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        </View>
                      </View>
                    </ScrollView>

                    <View style={[styles.readyLaunchFooter, isReadyDense ? styles.readyLaunchFooterCompact : null]}>
                      {!isReadyTight && (
                        <View style={styles.readyLaunchFooterIntro}>
                          <Text style={styles.readyLaunchFooterEyebrow}>Action</Text>
                          <Text
                            style={[
                              styles.readyLaunchFooterTitle,
                              isReadyDense ? styles.readyLaunchFooterTitleCompact : null,
                            ]}
                          >
                            Le bouton principal lance directement la partie
                          </Text>
                        </View>
                      )}
                      {pendingSnapshot && (
                        <TouchableOpacity
                          onPress={() => {
                            resumeFromSnapshot().catch(() => {});
                          }}
                          activeOpacity={0.9}
                          style={[
                            styles.readySecondaryButton,
                            isReadyDense ? styles.readySecondaryButtonCompact : null,
                          ]}
                          testID="resume-snapshot-button"
                        >
                          <Icon name="play-circle" size={18} color={HOME_UI.text} />
                          <Text
                            style={[
                              styles.readySecondaryButtonText,
                              isReadyDense ? styles.readySecondaryButtonTextCompact : null,
                            ]}
                          >
                            Reprendre la partie
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={startGame}
                        activeOpacity={0.92}
                        style={[
                          styles.readyPrimaryButton,
                          !isReadyDense ? styles.readyPrimaryButtonHero : null,
                          isReadyCompact ? styles.readyPrimaryButtonCompact : null,
                          { backgroundColor: activeMapEffect.accent, borderColor: activeThemeOption.accent },
                        ]}
                        testID="play-button"
                      >
                        <View style={styles.readyPrimaryButtonCore}>
                          <Icon name="rocket" size={20} color="#0a0a0a" />
                          <View>
                            <Text style={styles.readyPrimaryButtonKicker}>Launch</Text>
                            <Text
                              style={[
                                styles.readyPrimaryButtonText,
                                isReadyCompact ? styles.readyPrimaryButtonTextCompact : null,
                              ]}
                            >
                              {pendingSnapshot ? "Nouvelle partie" : "Lancer la run"}
                            </Text>
                          </View>
                        </View>
                        {!isReadyTight && (
                          <Text style={styles.readyPrimaryButtonAside}>Base vers {nextRouteStop.label}</Text>
                        )}
                      </TouchableOpacity>

                      {!isReadyDense && (
                        <Text style={styles.readyHintText}>
                          Objectif du moment : {weeklyChallenge.body}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
              </ScrollView>
            </View>
            </Modal>
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
        <View style={[styles.toast, activeRunBanner ? styles.toastWithBanner : null]}>
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      )}

      {activeRunBanner && gameState === "running" && (
        <View pointerEvents="none" style={styles.runBannerWrap}>
          <View style={[styles.runBannerCard, { borderColor: activeRunBanner.accent }]}>
            <Text style={[styles.runBannerTitle, { color: activeRunBanner.accent }]}>{activeRunBanner.label}</Text>
            {!!activeRunBanner.subtitle && <Text style={styles.runBannerSubtitle}>{activeRunBanner.subtitle}</Text>}
          </View>
        </View>
      )}

      {/* Game Over (le modal responsive sera ajusté en Partie 4) */}
      {gameState === "gameover" && (
        <GameOverArcadeModal
          visible
          onRestart={() => {
            if (Date.now() >= restartAllowedAtRef.current) startGame();
          }}
          onLeaderboard={() => router.push("/CometsLeaderboardScreen" as any)}
          onHome={() => router.replace("/")}
          top5={top5}
          myId={adminId || ""}
          myScore={score}
          runMeta={lastRunMeta}
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
          backgroundColor: settings.highContrast ? "#fff" : settings.stripeColor || "#2b1900",
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
  const fenceColor = settings.highContrast ? "#fff" : settings.fenceColor || "#1f2937";
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
          backgroundColor: fenceColor,
          borderRadius: 3,
          opacity: 0.7,
        }}
      />
    );
  }
  return (
    <>
      {posts}
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 46, height: 2, backgroundColor: fenceColor, opacity: 0.7 }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 32, height: 2, backgroundColor: fenceColor, opacity: 0.7 }} />
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
  runMeta,
  dailyMissions,
}: {
  visible: boolean;
  onRestart: () => void;
  onLeaderboard: () => void;
  top5: LBRow[] | null;
  myId: string;
  myScore: number;
  runMeta: RunMeta | null;
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

  const nextRival = useMemo(() => {
    if (!top5 || top5.length === 0) return null;
    const candidates = [...top5]
      .filter((row) => row.best_score > myScore)
      .sort((a, b) => a.best_score - b.best_score);
    return candidates[0] ?? null;
  }, [myScore, top5]);

  const nextRivalLabel = useMemo(() => {
    if (!nextRival) return null;
    const first = nextRival.admins?.first_name?.trim() || "";
    const last = nextRival.admins?.last_name?.trim() || "";
    return `${first} ${last}`.trim() || "le top 5";
  }, [nextRival]);

  const gameOverTitle = runMeta?.beatBest ? "Nouveau record !" : "Crash !";
  const gameOverSubtitle = runMeta?.beatBest
    ? `+${Math.max(1, myScore - runMeta.previousBest)} sur ton ancien record`
    : runMeta
      ? `Encore ${Math.max(1, runMeta.previousBest - myScore)} pts pour ton record perso`
      : "Relance pour remonter";
  const weeklyRaceLabel =
    runMeta?.weeklyRankGain && runMeta.weeklyRankGain > 0
      ? `+${runMeta.weeklyRankGain} places cette semaine`
      : runMeta?.enteredWeeklyBoard && runMeta.currentWeeklyRank
        ? `Entrée hebdo : #${runMeta.currentWeeklyRank}`
        : runMeta?.currentWeeklyRank
          ? `Classement 7j: #${runMeta.currentWeeklyRank}`
          : null;

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
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent navigationBarTranslucent onRequestClose={onRestart}>
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
            <View
              style={{
                alignSelf: "stretch",
                marginBottom: ms(10),
                paddingVertical: ms(10),
                paddingHorizontal: ms(12),
                borderRadius: ms(12),
                borderWidth: 1,
                borderColor: runMeta?.beatBest ? "rgba(134,239,172,0.45)" : "rgba(251,113,133,0.32)",
                backgroundColor: runMeta?.beatBest ? "rgba(20,83,45,0.32)" : "rgba(69,10,10,0.26)",
              }}
            >
              <Text
                style={{
                  color: runMeta?.beatBest ? "#bbf7d0" : "#fecdd3",
                  fontWeight: "900",
                  textAlign: "center",
                  fontSize: ms(18),
                }}
              >
                {gameOverTitle}
              </Text>
              <Text
                style={{
                  marginTop: ms(4),
                  color: "#e5edf7",
                  fontWeight: "700",
                  textAlign: "center",
                  fontSize: ms(12),
                }}
              >
                {gameOverSubtitle}
              </Text>
            </View>

            {!!weeklyRaceLabel && (
              <View
                style={{
                  alignSelf: "stretch",
                  marginBottom: ms(10),
                  paddingVertical: ms(8),
                  paddingHorizontal: ms(10),
                  borderRadius: ms(10),
                  borderWidth: 1,
                  borderColor: "rgba(103,232,249,0.28)",
                  backgroundColor: "rgba(8,47,73,0.28)",
                }}
              >
                <Text
                  style={{
                    color: "#c7f9ff",
                    fontWeight: "800",
                    textAlign: "center",
                    fontSize: ms(12.5),
                  }}
                >
                  {weeklyRaceLabel}
                </Text>
              </View>
            )}

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

            {nextRival && nextRivalLabel && (
              <View
                style={{
                  alignSelf: "stretch",
                  marginTop: ms(8),
                  padding: ms(10),
                  borderRadius: ms(12),
                  borderWidth: 1,
                  borderColor: "rgba(103,232,249,0.28)",
                  backgroundColor: "rgba(8,47,73,0.32)",
                }}
              >
                <Text
                  style={{
                    color: "#c7f9ff",
                    fontWeight: "800",
                    textAlign: "center",
                    fontSize: ms(13),
                  }}
                >
                  Encore {Math.max(1, nextRival.best_score - myScore)} pts pour passer {nextRivalLabel}
                </Text>
              </View>
            )}

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

function GameOverArcadeModal({
  visible,
  onRestart,
  onLeaderboard,
  onHome,
  top5,
  myId,
  myScore,
  runMeta,
  dailyMissions,
}: {
  visible: boolean;
  onRestart: () => void;
  onLeaderboard: () => void;
  onHome: () => void;
  top5: LBRow[] | null;
  myId: string;
  myScore: number;
  runMeta: RunMeta | null;
  dailyMissions: DailyMissionState;
}) {
  const { width, height } = useWindowDimensions();
  const overlayHPad = 12;
  const overlayVPad = 16;
  const sysTop = getSystemTopInset();
  const safetyBottom = 20;
  const usableH = Math.max(320, height - (sysTop + overlayVPad * 2 + safetyBottom));
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const maxW = Math.min(560, shortSide - overlayHPad * 2);
  const maxH = Math.min(Math.floor(longSide * 0.92), Math.floor(usableH));
  const cardH = Math.min(maxH, Math.max(360, Math.floor(usableH * 0.78)));
  const scale = Math.max(0.84, Math.min(1, maxH / 540));
  const ms = (value: number) => Math.round(value * scale);
  const compactActions = maxW < 420 || maxH < 470;
  const isMeInTop5 = !!myId && !!top5?.some((row) => row.admin_id === myId);

  const nextRival = useMemo(() => {
    if (!top5 || top5.length === 0) return null;
    const candidates = [...top5]
      .filter((row) => row.best_score > myScore)
      .sort((a, b) => a.best_score - b.best_score);
    return candidates[0] ?? null;
  }, [myScore, top5]);

  const nextRivalLabel = useMemo(() => {
    if (!nextRival) return null;
    const first = nextRival.admins?.first_name?.trim() || "";
    const last = nextRival.admins?.last_name?.trim() || "";
    return `${first} ${last}`.trim() || "le top 5";
  }, [nextRival]);

  const missionDoneCount = useMemo(() => getDailyMissionDoneCount(dailyMissions), [dailyMissions]);
  const nextMission = useMemo(
    () => DAILY_MISSIONS.find((mission) => getDailyMissionValue(dailyMissions, mission.id) < mission.target) ?? null,
    [dailyMissions],
  );
  const nextMissionValue = nextMission ? getDailyMissionValue(dailyMissions, nextMission.id) : 0;
  const personalBest = Math.max(myScore, runMeta?.previousBest ?? 0);
  const recordLabel = runMeta?.beatBest ? "Nouveau record" : "Record perso";
  const recordSub = runMeta?.beatBest
    ? `+${Math.max(1, myScore - (runMeta?.previousBest ?? 0))} sur ton meilleur score`
    : `À battre : ${personalBest}`;
  const weeklyLabel = runMeta?.currentWeeklyRank
    ? `#${runMeta.currentWeeklyRank} cette semaine`
    : isMeInTop5
      ? "Top 5 cette semaine"
      : "Pas de rang hebdo";
  const weeklySub =
    runMeta?.weeklyRankGain && runMeta.weeklyRankGain > 0
      ? `+${runMeta.weeklyRankGain} place${runMeta.weeklyRankGain > 1 ? "s" : ""}`
      : runMeta?.enteredWeeklyBoard
        ? "Entrée dans le classement"
        : nextRival && nextRivalLabel
          ? `Encore ${Math.max(1, nextRival.best_score - myScore)} pts pour passer ${nextRivalLabel}`
          : "Relance pour remonter";
  const missionLabel = `${missionDoneCount}/${DAILY_MISSIONS.length} missions`;
  const missionSub = nextMission
    ? `${Math.min(nextMissionValue, nextMission.target)}/${nextMission.target} ${nextMission.label}`
    : "Toutes les missions du jour sont bouclées";

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent navigationBarTranslucent onRequestClose={onRestart}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(4,8,16,0.82)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: overlayHPad,
          paddingVertical: overlayVPad,
          paddingTop: overlayVPad + Math.max(0, sysTop - 6),
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: shortSide * 0.92,
            height: shortSide * 0.92,
            borderRadius: 999,
            backgroundColor: "rgba(255,130,0,0.12)",
            top: "16%",
            alignSelf: "center",
          }}
        />

        <View
          style={{
            width: maxW,
            height: cardH,
            maxHeight: maxH,
            borderRadius: ms(24),
            borderWidth: 1,
            borderColor: "rgba(255,170,88,0.26)",
            overflow: "hidden",
            backgroundColor: "rgba(5,9,18,0.98)",
            shadowColor: "#000",
            shadowOpacity: 0.42,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 16,
          }}
        >
          <LinearGradient
            colors={["rgba(255,130,0,0.18)", "rgba(16,22,37,0.98)", "rgba(7,11,20,1)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, width: "100%" }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: ms(18),
                paddingBottom: ms(20),
              }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  borderRadius: ms(20),
                  borderWidth: 1,
                  borderColor: runMeta?.beatBest ? "rgba(134,239,172,0.42)" : "rgba(255,170,88,0.22)",
                  backgroundColor: "rgba(8,12,21,0.9)",
                  paddingHorizontal: ms(16),
                  paddingTop: ms(16),
                  paddingBottom: ms(18),
                  overflow: "hidden",
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: ms(180),
                    height: ms(180),
                    borderRadius: 999,
                    backgroundColor: runMeta?.beatBest ? "rgba(34,197,94,0.18)" : "rgba(255,130,0,0.14)",
                    right: -ms(40),
                    top: -ms(70),
                  }}
                />

                <Text
                  style={{
                    color: HOME_UI.accentSoft,
                    fontWeight: "900",
                    fontSize: ms(11),
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                  }}
                >
                  Game Over
                </Text>
                <Text
                  style={{
                    marginTop: ms(6),
                    color: HOME_UI.text,
                    fontWeight: "900",
                    fontSize: ms(26),
                    lineHeight: ms(28),
                  }}
                >
                  {runMeta?.beatBest ? "Run légendaire" : "Run terminée"}
                </Text>
                <Text
                  style={{
                    marginTop: ms(6),
                    color: "#D7E0EB",
                    fontWeight: "700",
                    fontSize: ms(12),
                    lineHeight: ms(16),
                  }}
                >
                  {runMeta?.beatBest
                    ? `+${Math.max(1, myScore - (runMeta?.previousBest ?? 0))} sur ton meilleur score`
                    : "Recharge, recale ta ligne et repars plus haut."}
                </Text>

                <View
                  style={{
                    marginTop: ms(14),
                    flexDirection: compactActions ? "column" : "row",
                    gap: ms(10),
                  }}
                >
                  <TouchableOpacity
                    onPress={onRestart}
                    activeOpacity={0.9}
                    style={{
                      flex: compactActions ? 0 : 1.15,
                      minHeight: ms(54),
                      borderRadius: ms(16),
                      backgroundColor: HOME_UI.accent,
                      borderWidth: 1,
                      borderColor: HOME_UI.accentSoft,
                      shadowColor: "#000",
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: ms(16),
                    }}
                    testID="restart-button"
                  >
                    <Icon name="reload" size={ms(18)} color="#111827" />
                    <Text style={{ marginLeft: ms(8), color: "#111827", fontSize: ms(16), fontWeight: "900" }}>
                      Relancer
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onLeaderboard}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      minHeight: ms(54),
                      borderRadius: ms(16),
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.14)",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: ms(16),
                    }}
                    testID="go-to-leaderboard"
                  >
                    <Icon name="trophy-outline" size={ms(18)} color="#FFD27A" />
                    <Text style={{ marginLeft: ms(8), color: HOME_UI.text, fontSize: ms(14), fontWeight: "800" }}>
                      Classement
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onHome}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      minHeight: ms(54),
                      borderRadius: ms(16),
                      backgroundColor: "rgba(103,232,249,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(103,232,249,0.24)",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: ms(16),
                    }}
                    testID="go-home-button"
                  >
                    <Icon name="home-outline" size={ms(18)} color="#91DFFF" />
                    <Text style={{ marginLeft: ms(8), color: "#DFF8FF", fontSize: ms(14), fontWeight: "800" }}>
                      Accueil
                    </Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    marginTop: ms(18),
                    alignSelf: "stretch",
                    paddingVertical: ms(14),
                    paddingHorizontal: ms(14),
                    borderRadius: ms(18),
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Text
                    style={{
                      color: "#8EA0B8",
                      fontWeight: "800",
                      fontSize: ms(11),
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      textAlign: "center",
                    }}
                  >
                    Score final
                  </Text>
                  <Text
                    style={{
                      marginTop: ms(6),
                      color: HOME_UI.text,
                      textAlign: "center",
                      fontWeight: "900",
                      fontSize: ms(42),
                      lineHeight: ms(44),
                    }}
                  >
                    {myScore}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: ms(14),
                  flexDirection: compactActions ? "column" : "row",
                  gap: ms(10),
                }}
              >
                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: ms(12),
                    paddingVertical: ms(12),
                    borderRadius: ms(16),
                    borderWidth: 1,
                    borderColor: runMeta?.beatBest ? "rgba(134,239,172,0.26)" : "rgba(255,255,255,0.09)",
                    backgroundColor: "rgba(13,19,32,0.9)",
                  }}
                >
                  <Text style={{ color: "#92A4BB", fontSize: ms(10.5), fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {recordLabel}
                  </Text>
                  <Text style={{ marginTop: ms(5), color: HOME_UI.text, fontSize: ms(20), fontWeight: "900" }}>
                    {personalBest}
                  </Text>
                  <Text style={{ marginTop: ms(4), color: "#D7E0EB", fontSize: ms(11), fontWeight: "700", lineHeight: ms(14) }}>
                    {recordSub}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: ms(12),
                    paddingVertical: ms(12),
                    borderRadius: ms(16),
                    borderWidth: 1,
                    borderColor: "rgba(103,232,249,0.24)",
                    backgroundColor: "rgba(8,25,40,0.88)",
                  }}
                >
                  <Text style={{ color: "#91DFFF", fontSize: ms(10.5), fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Semaine
                  </Text>
                  <Text style={{ marginTop: ms(5), color: HOME_UI.text, fontSize: ms(20), fontWeight: "900" }}>
                    {weeklyLabel}
                  </Text>
                  <Text style={{ marginTop: ms(4), color: "#D7E0EB", fontSize: ms(11), fontWeight: "700", lineHeight: ms(14) }}>
                    {weeklySub}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: ms(10),
                  paddingHorizontal: ms(12),
                  paddingVertical: ms(12),
                  borderRadius: ms(16),
                  borderWidth: 1,
                  borderColor: missionDoneCount >= DAILY_MISSIONS.length ? "rgba(134,239,172,0.26)" : "rgba(255,255,255,0.09)",
                  backgroundColor: "rgba(13,19,32,0.9)",
                }}
              >
                <Text
                  style={{
                    color: HOME_UI.text,
                    fontSize: ms(10.5),
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Missions du jour
                </Text>
                <Text style={{ marginTop: ms(6), color: HOME_UI.text, fontSize: ms(22), fontWeight: "900" }}>
                  {missionLabel}
                </Text>
                <Text
                  style={{
                    marginTop: ms(4),
                    color: missionDoneCount >= DAILY_MISSIONS.length ? "#BBF7D0" : "#D7E0EB",
                    fontSize: ms(11.5),
                    fontWeight: "700",
                    lineHeight: ms(15),
                  }}
                >
                  {missionSub}
                </Text>
              </View>

              <View
                style={{
                  marginTop: ms(14),
                }}
              />
            </ScrollView>
          </LinearGradient>
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
  mapHudWrap: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    alignItems: "flex-start",
  },
  mapHudWrapSolo: {
    top: Platform.OS === "android" ? 64 : 70,
  },
  mapHudWrapWithBadges: {
    top: Platform.OS === "android" ? 100 : 106,
  },
  eventPill: {
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "rgba(8,12,19,0.9)",
    minWidth: 118,
  },
  eventPillTitle: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  eventPillTxt: {
    marginTop: 1,
    color: "#d8dfec",
    fontSize: 9.5,
    fontWeight: "700",
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
  marsHazardBand: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 26,
    borderTopWidth: 2,
    opacity: 0.95,
  },
  player: {
    position: "absolute",
    backgroundColor: "transparent",
    backfaceVisibility: "hidden",
  },
  playerCoreAura: {
    position: "absolute",
    width: PLAYER_SIZE + 14,
    height: PLAYER_SIZE + 14,
    borderRadius: (PLAYER_SIZE + 14) / 2,
    borderWidth: 1.5,
    opacity: 0.9,
  },
  trailDot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  obstacleGlow: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 1,
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
    top: Platform.OS === "android" ? 120 : 126,
    right: 12,
    maxWidth: 204,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(19,27,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.42)",
    zIndex: 16,
  },
  toastWithBanner: {
    top: Platform.OS === "android" ? 152 : 158,
  },
  toastTxt: {
    color: "#FFD27A",
    fontWeight: "800",
    fontSize: 12,
  },

  hudFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
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
  mapPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
    minWidth: 112,
  },
  mapPillTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  mapPillTxt: {
    marginTop: 1,
    color: "#dbe4f1",
    fontSize: 10,
    fontWeight: "700",
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
    top: Platform.OS === "android" ? 88 : 96,
    alignItems: "center",
    justifyContent: "flex-start",
    pointerEvents: "none",
  },
  bigEventText: {
    color: "#FFD27A",
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  bigEventSub: {
    marginTop: 4,
    color: HOME_UI.text,
    fontSize: 13,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  runBannerWrap: {
    position: "absolute",
    top: Platform.OS === "android" ? 64 : 70,
    right: 12,
    left: 148,
    alignItems: "flex-end",
    zIndex: 15,
  },
  runBannerCard: {
    minWidth: 144,
    maxWidth: 204,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: "rgba(7,10,17,0.9)",
    alignItems: "flex-start",
  },
  runBannerTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  runBannerSubtitle: {
    marginTop: 3,
    color: "#edf3fb",
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "left",
  },
  readyOverlayShell: {
    position: "absolute",
    inset: 0,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 18,
    paddingBottom: 16,
    backgroundColor: "rgba(2,6,12,0.72)",
    zIndex: 12,
    overflow: "hidden",
  },
  readyOverlayShellCompact: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "android" ? 12 : 14,
    paddingBottom: 12,
  },
  readyOverlayShellShort: {
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "android" ? 10 : 12,
    paddingBottom: 10,
  },
  readyOverlayScrollView: {
    flex: 1,
    minHeight: 0,
    zIndex: 2,
  },
  readyOverlayScrollContent: {
    flexGrow: 1,
  },
  readyOverlayScrollContentScrollable: {
    paddingBottom: 6,
  },
  readyTopBar: {
    width: "100%",
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,12,21,0.96)",
    zIndex: 2,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  readyTopBarCompact: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readyTopBarShort: {
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    gap: 8,
  },
  readyTopBarBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  readyTopBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readyTopActionBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  readyTopBarSub: {
    marginTop: 2,
    color: "#C8D2E3",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  readyDockWrap: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 18,
  },
  readyDock: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 1060,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,12,21,0.84)",
  },
  readyDockCompact: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  readyDockEyebrow: {
    color: HOME_UI.accentSoft,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  readyDockTitle: {
    marginTop: 6,
    color: HOME_UI.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  readyDockTitleCompact: {
    fontSize: 22,
    lineHeight: 25,
  },
  readyDockTitleShort: {
    fontSize: 19,
    lineHeight: 22,
  },
  readyDockBody: {
    marginTop: 6,
    color: "#cdd8e6",
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },
  readyDockBodyCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  readyDockBodyShort: {
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 14,
  },
  readyMetaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  readyMetaRowCompact: {
    gap: 8,
    marginTop: 12,
  },
  readyMetaChip: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  readyMetaChipAccent: {
    backgroundColor: "rgba(255,130,0,0.15)",
    borderColor: "rgba(255,170,88,0.3)",
  },
  readyMetaLabel: {
    color: "#9CA8BA",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  readyMetaValue: {
    marginTop: 4,
    color: HOME_UI.text,
    fontSize: 14.5,
    fontWeight: "900",
  },
  readyQuickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  readyQuickGridCompact: {
    gap: 8,
    marginTop: 12,
  },
  readyQuickAction: {
    width: "48%",
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(17,25,39,0.92)",
  },
  readyQuickLabel: {
    color: "#9CA8BA",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  readyQuickValue: {
    marginTop: 4,
    fontSize: 13.5,
    fontWeight: "900",
  },
  readyProgressInline: {
    marginTop: 12,
  },
  readyProgressText: {
    color: "#cdd8e6",
    fontSize: 11,
    fontWeight: "800",
  },
  readyLayout: {
    width: "100%",
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 14,
  },
  readyLayoutStacked: {
    flexDirection: "column",
  },
  readyHeroCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(6,10,17,0.82)",
  },
  readyMainCard: {
    justifyContent: "flex-start",
  },
  readyHeroCardCompact: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  readyHeroEyebrow: {
    color: HOME_UI.accentSoft,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  readyHeroTitle: {
    marginTop: 6,
    color: HOME_UI.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
  },
  readyHeroTitleCompact: {
    fontSize: 23,
    lineHeight: 27,
  },
  readyHeroBody: {
    marginTop: 10,
    color: "#cdd8e6",
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "700",
    maxWidth: 520,
  },
  readyHeroBodyCompact: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 16,
  },
  readyHeroBodyShort: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
  },
  readyStatsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  readyStatsRowCompact: {
    gap: 8,
    marginTop: 12,
  },
  readyStatCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  readyStatCardAccent: {
    backgroundColor: "rgba(255,130,0,0.14)",
    borderColor: "rgba(255,170,88,0.3)",
  },
  readyStatLabel: {
    color: "#9CA8BA",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  readyStatValue: {
    marginTop: 4,
    color: HOME_UI.text,
    fontSize: 16,
    fontWeight: "900",
  },
  readyStatusCard: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  readyStatusTitle: {
    color: HOME_UI.accentSoft,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyStatusValue: {
    color: HOME_UI.text,
    fontSize: 16,
    fontWeight: "900",
  },
  readyStatusCopy: {
    color: "#cdd8e6",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 15,
  },
  readyCtaStack: {
    width: "100%",
    gap: 10,
    marginTop: 2,
  },
  readyCtaStackCompact: {
    gap: 8,
    marginTop: 0,
  },
  readyOverlayScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  readyBackdropGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 999,
    top: -120,
    left: -90,
  },
  readyBackdropGlowSecondary: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    right: -100,
    bottom: 24,
  },
  readyLaunchStatusPill: {
    minWidth: 124,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(11,18,31,0.84)",
  },
  readyLaunchStatusPillShort: {
    minWidth: 108,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  readyLaunchStatusLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyLaunchStatusValue: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 12.5,
    fontWeight: "900",
  },
  readyLaunchLayout: {
    flex: 1,
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    minHeight: 0,
    zIndex: 2,
  },
  readyLaunchLayoutScrollable: {
    flex: 0,
  },
  readyLaunchLayoutShort: {
    gap: 10,
    marginTop: 10,
  },
  readyLaunchLayoutStacked: {
    flexDirection: "column",
    gap: 12,
  },
  readyHeroTopline: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  readyHeroStage: {
    flex: 1.06,
    minWidth: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 20,
    paddingVertical: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  readyHeroStageDense: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
  },
  readyHeroStageShort: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 14,
    borderRadius: 20,
  },
  readyHeroStageStacked: {
    flex: 0.66,
    minHeight: 0,
    maxHeight: 252,
  },
  readyHeroStageStackedShort: {
    maxHeight: 320,
  },
  readyHeroStageScrollable: {
    flex: 0,
  },
  readyHeroStageStackedScrollable: {
    maxHeight: 380,
    paddingBottom: 18,
  },
  readyHeroBadge: {
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(8,14,24,0.86)",
  },
  readyHeroBadgeShort: {
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
  },
  readyHeroBadgeLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyHeroBadgeValue: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 13,
    fontWeight: "900",
  },
  readyHeroVisual: {
    flex: 1,
    minHeight: 176,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  readyHeroVisualDense: {
    minHeight: 126,
    marginTop: 4,
  },
  readyHeroVisualShort: {
    minHeight: 88,
    marginTop: 2,
  },
  readyHeroVisualStacked: {
    minHeight: 96,
    marginTop: 2,
  },
  readyHeroGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    right: -60,
    top: -80,
  },
  readyHeroOrbit: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    borderWidth: 1,
  },
  readyHeroOrbitShort: {
    width: 166,
    height: 166,
  },
  readyHeroOrbitInner: {
    position: "absolute",
    width: 158,
    height: 158,
    borderRadius: 999,
    borderWidth: 1,
  },
  readyHeroOrbitInnerShort: {
    width: 118,
    height: 118,
  },
  readyHeroLogoFrame: {
    width: 108,
    height: 108,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  readyHeroLogoFrameDense: {
    width: 86,
    height: 86,
    borderRadius: 20,
  },
  readyHeroLogoFrameShort: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  readyHeroLogo: {
    width: 74,
    height: 74,
  },
  readyHeroLogoShort: {
    width: 52,
    height: 52,
  },
  readyHeroTrailRow: {
    position: "absolute",
    left: "50%",
    marginLeft: -112,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  readyHeroTrailRowShort: {
    marginLeft: -86,
    gap: 8,
  },
  readyHeroTrailDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
  },
  readyHeroTrailDotShort: {
    width: 16,
    height: 16,
  },
  readyHeroStatRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  readyHeroStatRowCompact: {
    gap: 8,
  },
  readyHeroStatRowDense: {
    marginTop: 2,
  },
  readyHeroStatRowShort: {
    gap: 6,
    marginTop: 0,
    marginBottom: 10,
    zIndex: 2,
  },
  readyHeroStatCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(10,16,28,0.84)",
  },
  readyHeroStatCardShort: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  readyHeroStatCardAccent: {
    backgroundColor: "rgba(255,130,0,0.14)",
    borderColor: "rgba(255,170,88,0.3)",
  },
  readyHeroStatLabel: {
    color: "#9CA8BA",
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyHeroStatLabelShort: {
    fontSize: 8.5,
  },
  readyHeroStatValue: {
    marginTop: 4,
    color: HOME_UI.text,
    fontSize: 15.5,
    fontWeight: "900",
  },
  readyHeroStatValueShort: {
    marginTop: 3,
    fontSize: 13,
  },
  readyRoutePanel: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(7,12,21,0.94)",
  },
  readyRoutePanelShort: {
    marginTop: 14,
  },
  readyRoutePanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  readyRoutePanelEyebrow: {
    color: "#A5B4C7",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyRoutePanelTitle: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 15,
    fontWeight: "900",
  },
  readyRoutePanelMeta: {
    color: HOME_UI.accentSoft,
    fontSize: 18,
    fontWeight: "900",
  },
  readyRouteTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  readyRouteFill: {
    height: "100%",
    minWidth: 8,
    borderRadius: 999,
    backgroundColor: HOME_UI.accent,
  },
  readyRouteStops: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  readyRouteStop: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  readyRouteNode: {
    width: 13,
    height: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  readyRouteNodeUpcoming: {
    transform: [{ scale: 1.16 }],
    borderColor: HOME_UI.text,
  },
  readyRouteStopLabel: {
    color: "#AEB9CA",
    fontSize: 10.5,
    fontWeight: "800",
  },
  readyRouteStopLabelActive: {
    color: HOME_UI.text,
  },
  readyRouteStopMeta: {
    color: "#7F8DA3",
    fontSize: 9.5,
    fontWeight: "700",
  },
  readyRouteCompact: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(7,12,21,0.92)",
  },
  readyRouteCompactShort: {
    marginTop: 12,
  },
  readyRouteCompactText: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 11.5,
    fontWeight: "800",
  },
  readyControlPanel: {
    width: 406,
    minWidth: 0,
    minHeight: 0,
    flexShrink: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,12,21,0.96)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  readyControlPanelCompact: {
    width: "100%",
    borderRadius: 22,
  },
  readyControlPanelDense: {
    width: 374,
    borderRadius: 22,
  },
  readyControlPanelShort: {
    borderRadius: 20,
  },
  readyControlPanelStacked: {
    width: "100%",
    flex: 1.42,
    minHeight: 0,
  },
  readyControlPanelScrollable: {
    flex: 0,
  },
  readyControlShell: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "flex-start",
    gap: 14,
  },
  readyControlShellShort: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  readyControlShellScrollable: {
    flex: 0,
  },
  readyControlShellDense: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  readyControlBody: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  readyControlSummaryCol: {
    flex: 1.04,
    gap: 10,
    minWidth: 0,
  },
  readyControlLoadoutCol: {
    flex: 0.96,
    gap: 10,
    minWidth: 0,
  },
  readyControlScrollView: {
    flex: 1,
    minHeight: 0,
  },
  readyControlScrollViewStatic: {
    flex: 0,
  },
  readyControlScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  readyControlScrollContent: {
    paddingBottom: 12,
  },
  readyControlHeader: {
    gap: 4,
  },
  readyControlHeaderShort: {
    gap: 2,
  },
  readyPrepGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  readyPrepCard: {
    width: "48%",
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  readyPrepCardWide: {
    width: "100%",
  },
  readyPrepCardAccent: {
    backgroundColor: "rgba(255,130,0,0.15)",
    borderColor: "rgba(255,170,88,0.3)",
  },
  readyPrepValue: {
    marginTop: 5,
    color: HOME_UI.text,
    fontSize: 11.5,
    fontWeight: "900",
    lineHeight: 15,
  },
  readyPrepMeta: {
    marginTop: 4,
    color: "#9FB0C5",
    fontSize: 9.5,
    fontWeight: "700",
  },
  readyMissionCompactPanel: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  readyMissionCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  readyMissionCompactMeta: {
    color: "#67E8F9",
    fontSize: 12,
    fontWeight: "900",
  },
  readyMissionCompactList: {
    marginTop: 10,
    gap: 7,
  },
  readyMissionCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readyMissionCompactLabel: {
    flex: 1,
    color: HOME_UI.text,
    fontSize: 10.5,
    fontWeight: "700",
  },
  readyMissionPanel: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  readyMissionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  readyMissionEyebrow: {
    color: "#9CA8BA",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyMissionTitle: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 16,
    fontWeight: "900",
  },
  readyMissionCount: {
    alignItems: "flex-end",
  },
  readyMissionCountValue: {
    color: HOME_UI.text,
    fontSize: 18,
    fontWeight: "900",
  },
  readyMissionCountLabel: {
    marginTop: 2,
    color: "#93A2B8",
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  readyMissionList: {
    marginTop: 10,
    gap: 8,
  },
  readyMissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readyMissionDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  readyMissionLabel: {
    flex: 1,
    color: HOME_UI.text,
    fontSize: 12.5,
    fontWeight: "700",
  },
  readyMissionValue: {
    color: "#D6E0EC",
    fontSize: 11.5,
    fontWeight: "900",
  },
  readyMissionValueDone: {
    color: "#86EFAC",
  },
  readySectionTitle: {
    color: HOME_UI.text,
    fontSize: 13.5,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  readySectionSub: {
    marginTop: 4,
    color: "#9FB0C5",
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  readyLoadoutSection: {
    gap: 0,
  },
  readyLoadoutList: {
    marginTop: 8,
    gap: 8,
  },
  readyLoadoutListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(12,18,31,0.96)",
  },
  readyLoadoutListItemMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  readyLoadoutListItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  readyLoadoutListItemValue: {
    marginTop: 3,
    fontSize: 12.5,
    fontWeight: "900",
  },
  readyLoadoutListItemAction: {
    color: "#8FA0B6",
    fontSize: 9.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  readyLoadoutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  readyLoadoutCard: {
    width: "48%",
    minWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "rgba(12,18,31,0.96)",
  },
  readyLoadoutCardCompact: {
    minWidth: 138,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  readyLoadoutCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readyLoadoutCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  readyLoadoutCardValue: {
    marginTop: 7,
    fontSize: 14,
    fontWeight: "900",
  },
  readyLoadoutCardHint: {
    marginTop: 3,
    color: "#D0D9E5",
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 13,
  },
  readyLoadoutCardAction: {
    marginTop: 6,
    color: "#8FA0B6",
    fontSize: 9.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyUnlockPanel: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(8,14,24,0.96)",
  },
  readyUnlockHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  readyUnlockTitle: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 16,
    fontWeight: "900",
  },
  readyUnlockTag: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
  },
  readyUnlockBody: {
    marginTop: 6,
    color: "#CDD8E6",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 16,
  },
  readyUnlockMiniGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  readyUnlockMiniCard: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  readyUnlockMiniGroup: {
    fontSize: 9.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  readyUnlockMiniLabel: {
    marginTop: 3,
    color: HOME_UI.text,
    fontSize: 12,
    fontWeight: "900",
  },
  readyUnlockMiniMeta: {
    marginTop: 3,
    color: "#C8D2E3",
    fontSize: 10,
    fontWeight: "700",
  },
  readyBriefingCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  readyBriefingList: {
    marginTop: 10,
    gap: 10,
  },
  readyBriefingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  readyBriefingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,130,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,170,88,0.28)",
  },
  readyBriefingCopy: {
    flex: 1,
  },
  readyBriefingLabel: {
    color: HOME_UI.text,
    fontSize: 12,
    fontWeight: "900",
  },
  readyBriefingText: {
    marginTop: 2,
    color: "#C9D4E2",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  readyBriefingCompactCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  readyBriefingCompactList: {
    marginTop: 8,
    gap: 8,
  },
  readyBriefingCompactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  readyBriefingIconWrapCompact: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,130,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,170,88,0.28)",
  },
  readyBriefingCompactText: {
    flex: 1,
    color: "#C9D4E2",
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  readyBriefingCompactLabel: {
    color: HOME_UI.text,
    fontWeight: "900",
  },
  readyLaunchFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 10,
    backgroundColor: "rgba(7,12,21,0.98)",
  },
  readyLaunchFooterCompact: {
    marginTop: 6,
    paddingTop: 8,
    gap: 8,
  },
  readyLaunchFooterIntro: {
    gap: 2,
  },
  readyLaunchFooterEyebrow: {
    color: HOME_UI.accentSoft,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  readyLaunchFooterTitle: {
    color: HOME_UI.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  readyLaunchFooterTitleCompact: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  readySideRail: {
    width: 340,
    minWidth: 0,
    alignSelf: "flex-start",
  },
  readySideRailStacked: {
    width: "100%",
  },
  loadoutPanel: {
    marginTop: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(8,12,19,0.84)",
  },
  loadoutPanelSide: {
    marginTop: 0,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(8,12,19,0.88)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  loadoutPanelCompact: {
    marginTop: 4,
    padding: 7,
    borderRadius: 12,
  },
  loadoutTitle: {
    color: HOME_UI.text,
    fontSize: 12.5,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  loadoutTitleCompact: {
    fontSize: 11.5,
    marginBottom: 4,
  },
  loadoutTitleSide: {
    textAlign: "left",
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  readyProgressStack: {
    gap: 8,
    marginBottom: 10,
  },
  readyInfoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  readyInfoRowCompact: {
    marginBottom: 5,
  },
  challengeCardCompact: {
    flex: 1.1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(12,18,31,0.92)",
  },
  challengeCardSide: {
    flex: 0,
  },
  challengeTitle: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  challengeTextCompact: {
    marginTop: 2,
    color: "#eef2f8",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 15,
  },
  challengeTextCompactSmall: {
    fontSize: 10.5,
    lineHeight: 13,
  },
  loadoutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  loadoutGridCompact: {
    gap: 4,
  },
  loadoutMenuList: {
    gap: 8,
  },
  loadoutMenuItem: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(17,25,39,0.92)",
  },
  loadoutMenuItemCompact: {
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  loadoutMenuText: {
    flex: 1,
    paddingRight: 10,
  },
  loadoutMenuValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "900",
  },
  loadoutMenuHint: {
    marginTop: 2,
    color: "#d8dfec",
    fontSize: 10.5,
    fontWeight: "700",
  },
  loadoutChip: {
    width: "48%",
    minWidth: 136,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(19,27,42,0.94)",
  },
  loadoutChipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  loadoutChipLabel: {
    color: "#9ca3af",
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  loadoutChipLabelCompact: {
    fontSize: 9.5,
    letterSpacing: 0.45,
  },
  loadoutChipValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "900",
  },
  loadoutChipValueCompact: {
    fontSize: 12,
  },
  loadoutChipHint: {
    marginTop: 3,
    color: "#d8dfec",
    fontSize: 10.5,
    fontWeight: "700",
  },
  loadoutChipHintCompact: {
    marginTop: 2,
    fontSize: 9.5,
  },
  unlockMiniCard: {
    flex: 0.95,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(14,20,33,0.9)",
  },
  unlockMiniCardSide: {
    flex: 0,
  },
  unlockMiniGroup: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  unlockMiniLabel: {
    marginTop: 2,
    color: "#eef2f8",
    fontSize: 12.5,
    fontWeight: "800",
  },
  unlockMiniMeta: {
    marginTop: 3,
    color: "#c8d2e3",
    fontSize: 10.5,
    fontWeight: "700",
  },
  unlockTrackBar: {
    marginTop: 6,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  unlockTrackFill: {
    height: "100%",
    borderRadius: 999,
    minWidth: 10,
  },
  readySetupCard: {
    flexShrink: 1,
  },
  readySetupIntro: {
    marginTop: -2,
    marginBottom: 12,
    color: "#cdd8e6",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 16,
  },
  readySetupIntroCompact: {
    marginBottom: 10,
    fontSize: 10.5,
    lineHeight: 14,
  },
  readyLoadoutScroll: {
    maxHeight: 320,
  },
  readyLoadoutScrollCompact: {
    maxHeight: 220,
  },
  readyPrimaryButton: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: HOME_UI.accent,
    borderWidth: 1,
    borderColor: HOME_UI.accentSoft,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  readyPrimaryButtonHero: {
    minHeight: 84,
    borderWidth: 2,
    shadowOpacity: 0.48,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 12,
  },
  readyPrimaryButtonCompact: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  readyPrimaryButtonCore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  readyPrimaryButtonKicker: {
    color: "rgba(17,24,39,0.72)",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  readyPrimaryButtonText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  readyPrimaryButtonTextCompact: {
    fontSize: 16,
  },
  readyPrimaryButtonAside: {
    color: "rgba(17,24,39,0.82)",
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  readySecondaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  readySecondaryButtonCompact: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  readySecondaryButtonText: {
    color: HOME_UI.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  readySecondaryButtonTextCompact: {
    fontSize: 13.5,
  },
  readyHintText: {
    marginTop: 12,
    color: "#9CA8BA",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
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


