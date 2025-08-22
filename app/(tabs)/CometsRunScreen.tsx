// app/screens/CometsRunnerScreen.tsx
"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { Audio } from "expo-av";

import { useAdmin } from "../../contexts/AdminContext";
import { supabase } from "../../supabase";

let Haptics: any = null;
try { Haptics = require("expo-haptics"); } catch {}

import * as ScreenOrientation from "expo-screen-orientation";
let NavigationBar: any = null;
try { NavigationBar = require("expo-navigation-bar"); } catch {}

const { width: W0, height: H0 } = Dimensions.get("window");
const SCREEN_W = Math.max(W0, H0);
const SCREEN_H_INIT = Math.max(W0, H0);

// hauteur de l'image
const BG_Y_OFFSET = -60;
const BG_Y_OFFSET_PREVIEW = -60;

// Features
const ENABLE_COLLECTIBLES = true;
const ENABLE_SHIELD = true;
const ENABLE_DOUBLEJUMP = true;
const ENABLE_HAPTICS_DEFAULT = true;

// Gameplay
const makeDims = (H: number) => ({ GROUND_Y: Math.floor(H * 0.90) });
const { GROUND_Y: GROUND_Y_INIT } = makeDims(SCREEN_H_INIT);

const GROUND_HEIGHT = 2;
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

const KEY_BEST = "COMETS_RUNNER_BEST";
const KEY_SETTINGS = "COMETS_RUNNER_SETTINGS";
const KEY_ACH = "COMETS_RUNNER_ACHIEVEMENTS";

const DOUBLEJUMP_DURATION = 10_000;
const INVINCIBLE_DURATION = 900;

const R_COLLECTIBLE = 14;
// Power-ups : on garde la base à 16 mais on grossit visuellement le bouclier
const R_POWERUP = 16;
const R_X2 = 18;

const SCORE_MULT_DURATION = 10_000; // purple coin

// Assets
const logoComets   = require("../../assets/images/iconComets.png");
const imgCoin      = require("../../assets/game/coins.png");
const imgShield    = require("../../assets/game/shield.png");
const imgDouble    = require("../../assets/game/baseball-ball.jpg");
const imgX2        = require("../../assets/game/PurpleCoin.png");
const imgObs1      = require("../../assets/game/chibi_baseball.png");
const imgObs2      = require("../../assets/game/chibi_batte.png");

// Musique
const musicFile = require("../../assets/sounds/comets-song.mp3");

// Maps
const mapBaseBG           = require("../../assets/game/maps/base.jpg");
const mapTerreBG          = require("../../assets/game/maps/terre.png");
const mapJupiterBG        = require("../../assets/game/maps/jupiter.png");
const mapMarsBG           = require("../../assets/game/maps/mars.png");
const mapSystemeSolaireBG = require("../../assets/game/maps/systeme_solaire.png");

// Types
type Obstacle = { id: number; x: number; w: number; h: number; y: number; variant: 0 | 1 };
type Collectible = { id: number; x: number; y: number; r: number };
type PowerUpKind = "shield" | "doublejump" | "x2";
type PowerUp = { id: number; x: number; y: number; r: number; kind: PowerUpKind };
type GameState = "ready" | "running" | "paused" | "gameover";

type Settings = { mute: boolean; haptics: boolean; highContrast: boolean; };

type LBRow = {
  admin_id: string;
  best_score: number;
  admins?: { first_name: string | null; last_name: string | null } | null;
};

// Helpers
const randf = (min: number, max: number) => Math.random() * (max - min) + min;
const randi = (min: number, max: number) => Math.floor(randf(min, max));
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
  base: mapBaseBG, terre: mapTerreBG, jupiter: mapJupiterBG,
  mars: mapMarsBG, systeme_solaire: mapSystemeSolaireBG,
};
const MAP_SWITCH_AT = {
  base_to_terre: 10_000,
  terre_to_jupiter: 20_000,
  jupiter_to_mars: 40_000,
  mars_to_solaire: 100_000,
} as const;

function getDifficultyByMap(map: MapName) {
  switch (map) {
    case "base": return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.00, gapMul: 1.00, gravityMul: 1.00 };
    case "terre": return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.10, gapMul: 0.95, gravityMul: 1.00 };
    case "jupiter": return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.22, gapMul: 0.90, gravityMul: 1.05 };
    case "mars": return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.35, gapMul: 0.85, gravityMul: 1.05 };
    case "systeme_solaire": return { speedGain: SPEED_GAIN_PER_SEC_BASE * 1.45, gapMul: 0.82, gravityMul: 1.05 };
  }
}
function activeMapForScore(score: number): MapName {
  if (score >= MAP_SWITCH_AT.mars_to_solaire) return "systeme_solaire";
  if (score >= MAP_SWITCH_AT.jupiter_to_mars)  return "mars";
  if (score >= MAP_SWITCH_AT.terre_to_jupiter) return "jupiter";
  if (score >= MAP_SWITCH_AT.base_to_terre)    return "terre";
  return "base";
}

// ================= Component =================
export default function CometsRunnerScreen() {
  // Lock paysage + NavBar Android visible/transparente/icônes blanches
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    (async () => {
      try {
        if (Platform.OS === "android" && NavigationBar?.setBackgroundColorAsync) {
          await NavigationBar.setBackgroundColorAsync("#00000000"); // transparent
          await NavigationBar.setButtonStyleAsync("light");          // icônes blanches
          await NavigationBar.setVisibilityAsync("visible");         // visible
        }
      } catch {}
    })();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      (async () => {
        try {
          if (Platform.OS === "android" && NavigationBar?.setBackgroundColorAsync) {
            await NavigationBar.setBackgroundColorAsync("#000000");  // état neutre
            await NavigationBar.setButtonStyleAsync("light");
            await NavigationBar.setVisibilityAsync("visible");
          }
        } catch {}
      })();
    };
  }, []);
  const setPlayingStatusBar = (b: boolean) => { try { /* @ts-ignore */ StatusBar.setHidden(b, "fade"); } catch {} };

  // Taille réelle de l’aire de jeu
  const [screenH, setScreenH] = useState(SCREEN_H_INIT);
  const [GROUND_Y, setGROUND_Y] = useState(GROUND_Y_INIT);
  const onGameAreaLayout = useCallback((e: any) => {
    const h = Math.max(1, Math.floor(e?.nativeEvent?.layout?.height ?? SCREEN_H_INIT));
    if (h !== screenH) { setScreenH(h); setGROUND_Y(makeDims(h).GROUND_Y); }
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
  const H_SINGLE = useMemo(() => singleJumpH(), [screenH]);
  const H_DOUBLE_ONLY = useMemo(() => doubleJumpExtraH(), [screenH]);
  const H_DOUBLE = H_SINGLE + H_DOUBLE_ONLY;
  const CY_GROUND = useMemo(() => GROUND_Y - PLAYER_SIZE / 2, [GROUND_Y]);
  const yForHeight = useCallback((h: number) => CY_GROUND - h, [CY_GROUND]);
  const clampYCenter = useCallback((y: number, r: number) => Math.max(r + 8, Math.min(y, GROUND_Y - r - 4)), [GROUND_Y]);
  const H_STAR_MIN = H_SINGLE * 0.45;
  const H_STAR_MAX = H_SINGLE * 0.85;

  // Game/UI
  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [showHelp, setShowHelp] = useState(true);

  // restart lockout (2s après game over)
  const restartAllowedAtRef = useRef<number>(0);

  // Settings
  const [settings, setSettings] = useState<Settings>({ mute: false, haptics: ENABLE_HAPTICS_DEFAULT, highContrast: false });
  const toggleSetting = (k: keyof Settings) => setSettings((s) => {
    const next = { ...s, [k]: !s[k] }; AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(next)).catch(() => {}); return next;
  });

  // Achievements
  const [achievements, setAchievements] = useState<Record<AchievementKey, boolean>>({ first_x2: false, score_2000: false, combo_10: false });
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? null : t)), 1400); }, []);
  const unlock = useCallback((key: AchievementKey) => {
    setAchievements((prev) => { if (prev[key]) return prev; const next = { ...prev, ...{ [key]: true } };
      AsyncStorage.setItem(KEY_ACH, JSON.stringify(next)).catch(() => {}); showToast(`🏅 ${ACH_LABEL[key]}`); return next; });
  }, [showToast]);

  // Milestones (goals) unique
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

  // Buffs / état temporaire
  const [hasShield, setHasShield] = useState(false);
  const [doubleJumpUntil, setDoubleJumpUntil] = useState<number>(0);
  const [invincibleUntil, setInvincibleUntil] = useState<number>(0);
  const comboRef = useRef(0);

  // Purple coin: multiplicateur temporaire — jusqu’à ×10
  const scoreMultLevelRef = useRef<number>(1);
  const scoreMultUntilRef = useRef<number>(0);
  const getActiveScoreMult = () => (Date.now() < scoreMultUntilRef.current ? scoreMultLevelRef.current : 1);
  const applyScoreGain = (base: number) => {
    const mult = getActiveScoreMult();
    return Math.floor(base * mult);
  };

  // Monde
  const playerX = Math.floor(SCREEN_W * 0.08);
  const speedRef = useRef(START_SPEED);
  const targetSpeedRef = useRef(START_SPEED);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const lastIdRef = useRef(1);

  // Popups localisées +pts
  const popupsRef = useRef<Array<{ id:number; x:number; y:number; born:number; text:string }>>([]);

  // Physique joueur
  const yRef = useRef(GROUND_Y_INIT - PLAYER_SIZE);
  const velYRef = useRef(0);
  const groundedRef = useRef(true);
  const lastGroundedTimeRef = useRef(0);
  const jumpBufferRef = useRef(0);
  const airJumpsLeftRef = useRef(0);
  const holdingJumpRef = useRef(false);

  // Parallax + transition de map douce
  const angleRef = useRef(0);
  const groundOffsetRef = useRef(0);
  const fenceOffsetRef = useRef(0);

  // Deux pistes d’arrière-plan pour fondu
  const mapARef = useRef<MapName>("base");            // carte affichée
  const mapBRef = useRef<MapName>("base");            // carte cible
  const mapFadeRef = useRef(0);                       // 0..1 alpha vers B
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

  // (Plus de debug togglable au long press)
  const [fps, setFps] = useState(60);
  const fpsBuf = useRef<number[]>([]);
  let fpsLastUpdate = useRef(0);

  // Admin/Supabase
  const { admin } = useAdmin();
  const adminId = (admin?.id ?? null) as any as string | null;
  const adminFirst = (admin as any)?.first_name ?? null;
  const adminLast = (admin as any)?.last_name ?? null;
  const adminEmail = admin?.email ?? null;
  const adminName = [adminFirst, adminLast].filter(Boolean).join(" ").trim() || adminEmail || "Anonyme";

  const ensureProfile = useCallback(async () => {
    if (!adminId) return;
    const { error } = await supabase.from("game_profiles").upsert([{ admin_id: adminId, display_name: adminName }],
      { onConflict: "admin_id", ignoreDuplicates: false });
    if (error) console.log("ensureProfile error:", error.message);
  }, [adminId, adminName]);

  const loadBestFromCloud = useCallback(async () => {
    if (!adminId) return;
    const { data, error } = await supabase.from("game_profiles").select("best_score").eq("admin_id", adminId).maybeSingle();
    if (error) { console.log("loadBestFromCloud error:", error.message); return; }
    if (data?.best_score != null && Number.isFinite(data.best_score)) {
      setBest(data.best_score);
      AsyncStorage.setItem(KEY_BEST, String(data.best_score)).catch(() => {});
    }
  }, [adminId]);

  const [top5, setTop5] = useState<LBRow[] | null>(null);
  const loadTop5 = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("game_profiles")
        .select("admin_id,best_score,admins(first_name,last_name)")
        .order("best_score", { ascending: false })
        .limit(5);
      if (error) { console.log("loadTop5 error:", error.message); setTop5([]); return; }
      setTop5((data as any as LBRow[]) ?? []);
    } catch (e) { console.log("loadTop5 catch:", (e as any)?.message); setTop5([]); }
  }, []);

  const saveRunToCloud = useCallback(async (finalScore: number) => {
    if (!adminId) return;
    const { error: errRun } = await supabase.from("game_runs").insert({
      admin_id: adminId, score: finalScore,
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

    const newBest = Math.max(finalScore, current?.best_score ?? 0);
    const { error: errUp } = await supabase.from("game_profiles").upsert({
      admin_id: adminId, display_name: adminName, best_score: newBest,
      total_runs: (current?.total_runs ?? 0) + 1, last_run_at: new Date().toISOString(),
    });
    if (errUp) console.log("upsert profile error:", errUp.message);

    if (newBest > (best || 0)) {
      setBest(newBest);
      AsyncStorage.setItem(KEY_BEST, String(newBest)).catch(() => {});
    }
    await loadTop5();
  }, [adminId, adminName, best, loadTop5]);

  // Preload & settings
  useEffect(() => {
    (async () => {
      try {
        [imgObs1, imgObs2, imgCoin, imgShield, imgDouble, imgX2,
         mapBaseBG, mapTerreBG, mapJupiterBG, mapMarsBG, mapSystemeSolaireBG]
         .forEach(a => { try { Image.prefetch(Image.resolveAssetSource(a).uri); } catch {} });
      } catch {}
      try { const rawS = await AsyncStorage.getItem(KEY_SETTINGS); if (rawS) setSettings(s => ({ ...s, ...JSON.parse(rawS) })); } catch {}
      try { const rawA = await AsyncStorage.getItem(KEY_ACH); if (rawA) setAchievements(prev => ({ ...prev, ...JSON.parse(rawA) })); } catch {}
      try { const raw = await AsyncStorage.getItem(KEY_BEST); if (raw) setBest(parseInt(raw, 10) || 0); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!adminId) { await loadTop5(); return; }
      await ensureProfile();
      await loadBestFromCloud();
      await loadTop5();
    })();
  }, [adminId, ensureProfile, loadBestFromCloud, loadTop5]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") setGameState(s => (s === "running" ? "paused" : s));
    });
    return () => sub.remove();
  }, []);

  // === Alignement si hauteur de sol change ===
  const prevGroundYRef = useRef(GROUND_Y);
  useEffect(() => {
    const prev = prevGroundYRef.current;
    if (prev === GROUND_Y) return;

    const dy = GROUND_Y - prev;

    // 1) Joueur
    yRef.current = Math.min(yRef.current + dy, GROUND_Y - PLAYER_SIZE);

    // 2) Obstacles : recoller sur le sol
    obstaclesRef.current = obstaclesRef.current.map(o => ({ ...o, y: GROUND_Y - o.h }));

    // 3) Collectibles / power-ups : conserver altitude relative et re-clamper
    const clampCenter = (y: number, r: number) =>
      Math.max(r + 8, Math.min(y, GROUND_Y - r - 4));

    collectiblesRef.current = collectiblesRef.current.map(c => ({
      ...c, y: clampCenter(c.y + dy, c.r),
    }));
    powerUpsRef.current = powerUpsRef.current.map(p => ({
      ...p, y: clampCenter(p.y + dy, p.r),
    }));

    prevGroundYRef.current = GROUND_Y;
    setFrameTick(t => t + 1);
  }, [GROUND_Y]);

  // Son
  const musicRef = useRef<Audio.Sound | null>(null);
  const ensureMusic = useCallback(async () => {
    if (musicRef.current) return musicRef.current;
    const { sound } = await Audio.Sound.createAsync(musicFile, { isLooping: true, volume: settings.mute ? 0 : 1 });
    musicRef.current = sound;
    return sound;
  }, [settings.mute]);
  const playMusic = useCallback(async () => {
    try {
      const sound = await ensureMusic();
      await sound.setIsLoopingAsync(true);
      await sound.setVolumeAsync(settings.mute ? 0 : 1);
      await sound.playAsync();
    } catch {}
  }, [ensureMusic, settings.mute]);
  const stopMusic = useCallback(async () => {
    try { await musicRef.current?.stopAsync(); } catch {}
  }, []);
  const unloadMusic = useCallback(async () => {
    try { await musicRef.current?.unloadAsync(); musicRef.current = null; } catch {}
  }, []);
  // réagir au mute en direct
  useEffect(() => { (async () => { try { await musicRef.current?.setVolumeAsync(settings.mute ? 0 : 1); } catch {} })(); }, [settings.mute]);

  // Transitions d’état jeu -> musique
  useEffect(() => {
    (async () => {
      if (gameState === "running") { await playMusic(); }
      else { await stopMusic(); }
    })();
    return () => {};
  }, [gameState, playMusic, stopMusic]);
  useEffect(() => { return () => { unloadMusic(); }; }, [unloadMusic]);

  const resetWorld = useCallback(() => {
    obstaclesRef.current = [];
    collectiblesRef.current = [];
    powerUpsRef.current = [];
    popupsRef.current = [];
    lastIdRef.current = 1;
    targetSpeedRef.current = START_SPEED;
    speedRef.current = START_SPEED;
    setScore(0);
    milestonesRef.current.clear();
    comboRef.current = 0;
    setHasShield(false);
    setDoubleJumpUntil(0);
    setInvincibleUntil(0);
    scoreMultLevelRef.current = 1;
    scoreMultUntilRef.current = 0;
    airJumpsLeftRef.current = 0;
    distAccRef.current = 0;
    velYRef.current = 0;
    groundedRef.current = true;
    yRef.current = GROUND_Y - PLAYER_SIZE;
    lastGroundedTimeRef.current = 0;
    jumpBufferRef.current = 0;
    holdingJumpRef.current = false;

    // reset parallax
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
    obstaclesRef.current.push({ id: ++lastIdRef.current, x: firstX, w: firstW, h, y: GROUND_Y - h, variant: Math.random() < 0.5 ? 0 : 1 });

    if (ENABLE_COLLECTIBLES) {
      const hStar = randf(H_STAR_MIN, H_STAR_MAX);
      const yStar = clampYCenter(yForHeight(hStar), R_COLLECTIBLE);
      collectiblesRef.current.push({ id: ++lastIdRef.current, x: firstX + 180, y: yStar, r: R_COLLECTIBLE });
    }
  }, [GROUND_Y, H_STAR_MIN, H_STAR_MAX, clampYCenter, yForHeight]);

  const startGame = useCallback(() => {
    setShowHelp(false);
    resetWorld();
    setGameState("running");
    setPlayingStatusBar(true);
  }, [resetWorld]);

  const pauseGame = useCallback(() => {
    setGameState(s => { const next = s === "running" ? "paused" : s; if (next === "paused") setPlayingStatusBar(false); return next; });
  }, []);
  const resumeGame = useCallback(() => {
    setGameState(s => { const next = s === "paused" ? "running" : s; if (next === "running") setPlayingStatusBar(true); return next; });
  }, []);

  const endGame = useCallback(async () => {
    setGameState("gameover");
    restartAllowedAtRef.current = Date.now() + 2000; // lock 2s
    setPlayingStatusBar(false);
    try {
      if (adminId) {
        await saveRunToCloud(score);
      } else if (score > best) {
        setBest(score);
        await AsyncStorage.setItem(KEY_BEST, String(score));
        await loadTop5();
      } else {
        await loadTop5();
      }
    } catch (e) { console.log("endGame error:", (e as any)?.message); }
  }, [score, best, adminId, saveRunToCloud, loadTop5]);

  // helpers
  const doubleJumpActive = () => ENABLE_DOUBLEJUMP && doubleJumpUntil > Date.now();
  const invincibleActive = () => Date.now() < invincibleUntil;
  const getSpeedMultiplier = (s: number) => Math.min(MULT_MAX, MULT_MIN + Math.max(0, s - START_SPEED) / MULT_SCALE);
  const getComboMultiplier = () => Math.min(2.0, 1 + 0.25 * Math.max(0, comboRef.current - 1));

  // Spawner
  const spawnObstacle = useCallback((minGap: number, gapMul: number, scoreNow: number) => {
    // difficulté progressive selon score
    const harden = clamp(0.25 * (scoreNow / 120000), 0, 0.25); // jusqu’à -25% de gap
    const localGapMul = gapMul * (1 - harden);                  // rétrécit un peu les espaces

    const attempts = Math.max(1, Math.min(MAX_SPAWN_ATTEMPTS, Math.floor(speedRef.current / 60)));
    for (let i = 0; i < attempts; i++) {
      const w = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h = OBSTACLE_BASE_H + randi(-8, 8);
      const baseLead = Math.max(minGap, Math.floor(SCREEN_W * 0.75));
      const lead = Math.floor(baseLead * localGapMul);
      const x = SCREEN_W + lead + randi(0, Math.floor(OBSTACLE_MAX_GAP_BASE * localGapMul));
      const y = GROUND_Y - h;
      obstaclesRef.current.push({ id: ++lastIdRef.current, x, w, h, y, variant: Math.random() < 0.5 ? 0 : 1 });

      // chance de double obstacle augmente légèrement avec le score
      const extraChance = 0.18 + clamp(scoreNow / 150000, 0, 0.12); // max ~0.30
      if (Math.random() < extraChance) {
        const w2 = randi(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
        const x2 = x + w + randi(90, 150);
        obstaclesRef.current.push({ id: ++lastIdRef.current, x: x2, w: w2, h, y, variant: Math.random() < 0.5 ? 0 : 1 });
      }
      if (ENABLE_COLLECTIBLES && Math.random() < 0.45) {
        const hStar = randf(H_STAR_MIN, H_STAR_MAX);
        const yStar = clampYCenter(yForHeight(hStar), R_COLLECTIBLE);
        collectiblesRef.current.push({ id: ++lastIdRef.current, x: x + Math.max(80, w + 40), y: yStar, r: R_COLLECTIBLE });
      }
      if (ENABLE_SHIELD && Math.random() < 0.15) {
        const hShield = randf(H_STAR_MIN, H_STAR_MAX);
        const yShield = clampYCenter(yForHeight(hShield), R_POWERUP);
        powerUpsRef.current.push({ id: ++lastIdRef.current, x: x + randi(140, 240), y: yShield, r: R_POWERUP, kind: "shield" });
      }
      if (ENABLE_DOUBLEJUMP && Math.random() < 0.1) {
        const hDJ = randf(H_STAR_MIN, H_STAR_MAX);
        const yDJ = clampYCenter(yForHeight(hDJ), R_POWERUP);
        powerUpsRef.current.push({ id: ++lastIdRef.current, x: x + randi(180, 280), y: yDJ, r: R_POWERUP, kind: "doublejump" });
      }
      break;
    }
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

  // Main loop
  useEffect(() => {
    if (gameState !== "running") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; lastTsRef.current = null; return;
    }

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = clamp((ts - lastTsRef.current) / 1000, 0, 0.05);
      lastTsRef.current = ts;

      // FPS
      fpsBuf.current.push(1 / Math.max(dt, 1e-3));
      if (fpsBuf.current.length > 30) fpsBuf.current.shift();
      if (ts - fpsLastUpdate.current > 500) {
        fpsLastUpdate.current = ts;
        const avg = fpsBuf.current.reduce((a, b) => a + b, 0) / Math.max(1, fpsBuf.current.length);
        setFps(Math.round(avg));
      }

      // Map & diff
      const desiredMap = activeMapForScore(score);
      if (desiredMap !== mapBRef.current) {
        mapARef.current = mapFadeRef.current >= 0.99 ? mapBRef.current : mapARef.current;
        mapBRef.current = desiredMap;
        mapFadeRef.current = 0;
      }

      // Fondu entre A et B
      if (mapFadeRef.current < 1) {
        mapFadeRef.current = clamp(mapFadeRef.current + dt / MAP_FADE_SECS, 0, 1);
        if (mapFadeRef.current >= 1) {
          mapARef.current = mapBRef.current;
          mapFadeRef.current = 0;
        }
      }

      const diff = getDifficultyByMap(mapARef.current);
      // Vitesse
      const targetGain = diff.speedGain;
      targetSpeedRef.current += targetGain * dt;
      const alphaSmooth = 1 - Math.exp(-SPEED_SMOOTHING * dt);
      speedRef.current = speedRef.current + (targetSpeedRef.current - speedRef.current) * alphaSmooth;
      const s = speedRef.current;

      // Parallax
      const parallaxMul = 1;
      groundOffsetRef.current += s * dt * parallaxMul;
      fenceOffsetRef.current  += s * FENCE_SPEED  * dt * parallaxMul;
      mapAOffsetRef.current   += s * BG_SPEED     * dt * parallaxMul;
      mapBOffsetRef.current   += s * BG_SPEED     * dt * parallaxMul;

      // Gravité
      const gravityBase = GRAVITY_BASE * diff.gravityMul;
      const gravityNow = (velYRef.current < 0 && holdingJumpRef.current)
        ? gravityBase * HOLD_GRAVITY_SCALE
        : gravityBase;

      velYRef.current += gravityNow * dt;
      let newY = yRef.current + velYRef.current * dt;
      const floorY = GROUND_Y - PLAYER_SIZE;

      if (newY >= floorY) {
        newY = floorY;
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
        }
      } else {
        groundedRef.current = false;
        jumpBufferRef.current = Math.max(0, jumpBufferRef.current - dt);
      }
      yRef.current = newY;

      // Spin
      if (!groundedRef.current) {
        const rate = 8 + Math.min(10, Math.abs(velYRef.current) / 220);
        angleRef.current += rate * dt;
      } else {
        const omega = (s / Math.max(1, PLAYER_RADIUS)) * ROLL_VISUAL_MULT;
        angleRef.current += omega * dt;
      }

      // Monde actif
      if (obstaclesRef.current.length === 0) spawnObstacle(OBSTACLE_MIN_GAP_BASE, diff.gapMul, score);

      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const o = obstaclesRef.current[i];
        o.x -= s * dt;
        if (o.x + o.w <= -40) obstaclesRef.current.splice(i, 1);
      }
      const last = obstaclesRef.current[obstaclesRef.current.length - 1];
      if (!last || last.x < SCREEN_W - randi(Math.floor(OBSTACLE_MIN_GAP_BASE * 0.7), OBSTACLE_MAX_GAP_BASE)) {
        spawnObstacle(randi(OBSTACLE_MIN_GAP_BASE, OBSTACLE_MAX_GAP_BASE), diff.gapMul, score);
      }

      for (let i = collectiblesRef.current.length - 1; i >= 0; i--) {
        const c = collectiblesRef.current[i];
        c.x -= s * dt;
        const cx = playerX + PLAYER_SIZE / 2;
        const cy = yRef.current + PLAYER_SIZE / 2;
        if (circleCircleCollide(cx, cy, PLAYER_SIZE * 0.38, c.x, c.y, c.r)) {
          comboRef.current = Math.min(10, comboRef.current + 1);
          if (comboRef.current >= 10) unlock("combo_10");
          const base = Math.floor(100 * getSpeedMultiplier(s) * getComboMultiplier());
          const gained = applyScoreGain(base);
          setScore((prev) => {
            const next = prev + gained;
            checkMilestones(next);
            return next;
          });

          // popup localisé au point de ramassage
          popupsRef.current.push({
            id: ++lastIdRef.current,
            x: c.x,
            y: c.y,
            born: Date.now(),
            text: `+${gained}`,
          });

          collectiblesRef.current.splice(i, 1);

          // petit effet/pulse et haptics
          heroPulse.setValue(0);
          Animated.timing(heroPulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
          if (settings.haptics && Haptics) Haptics.selectionAsync?.().catch(() => {});
          continue;
        }
        if (c.x + c.r < -20) { comboRef.current = 0; collectiblesRef.current.splice(i, 1); }
      }

      for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
        const p = powerUpsRef.current[i];
        p.x -= s * dt;
        const cx = playerX + PLAYER_SIZE / 2;
        const cy = yRef.current + PLAYER_SIZE / 2;
        if (circleCircleCollide(cx, cy, PLAYER_SIZE * 0.38, p.x, p.y, p.r)) {
          if (p.kind === "shield") {
            setHasShield(true);
            showToast("🛡️ Protection !");
            if (settings.haptics && Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          } else if (p.kind === "doublejump") {
            const until = Date.now() + DOUBLEJUMP_DURATION;
            setDoubleJumpUntil(until);
            showToast("⛓️ Double saut !");
            airJumpsLeftRef.current = 1;
            spawnX2BonusForDoubleJump();
          } else if (p.kind === "x2") {
            const now = Date.now();
            if (now < scoreMultUntilRef.current) {
              // Empile jusqu’à ×10
              scoreMultLevelRef.current = clamp(scoreMultLevelRef.current + 1, 2, 10);
              scoreMultUntilRef.current = now + SCORE_MULT_DURATION;
              showToast(`💜 ×${scoreMultLevelRef.current} pendant 10s !`);
            } else {
              scoreMultLevelRef.current = 2;
              scoreMultUntilRef.current = now + SCORE_MULT_DURATION;
              if (!achievements.first_x2) unlock("first_x2");
              showToast("💜 ×2 pendant 10s !");
            }
          }
          powerUpsRef.current.splice(i, 1);
          continue;
        }
        if (p.x + p.r < -20) powerUpsRef.current.splice(i, 1);
      }

      // Collisions
      const cx = playerX + PLAYER_SIZE / 2;
      const cy = yRef.current + PLAYER_SIZE / 2;
      const r = PLAYER_SIZE * 0.42;
      if (!invincibleActive()) {
        for (let i = 0; i < obstaclesRef.current.length; i++) {
          const o = obstaclesRef.current[i];
          if (circleRectCollide(cx, cy, r, o.x, o.y, o.w, o.h)) {
            if (hasShield) {
              setHasShield(false);
              setInvincibleUntil(Date.now() + INVINCIBLE_DURATION);
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

      // Score distance
      distAccRef.current += s * dt;
      if (distAccRef.current >= 10) {
        const gainedUnits = Math.floor(distAccRef.current / 10);
        distAccRef.current -= gainedUnits * 10;
        setScore((prev) => {
          const base = Math.floor(gainedUnits * getSpeedMultiplier(s));
          const added = applyScoreGain(base);
          const next = prev + added;
          if (next >= 2000) unlock("score_2000");
          checkMilestones(next);
          return next;
        });
      }

      // Popups (+pts) : durée ~900ms
      popupsRef.current = popupsRef.current.filter(p => Date.now() - p.born < 900);

      // Render tick
      setFrameTick((t) => (t + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [gameState, endGame, spawnObstacle, doubleJumpUntil, invincibleUntil, spawnX2BonusForDoubleJump, settings.haptics, GROUND_Y, unlock, score, checkMilestones]);

  // Input
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
  }, [doubleJumpUntil, settings.haptics]);

  const handlePressIn = useCallback(() => {
    if (gameState === "ready") { startGame(); return; }
    if (gameState === "paused") { resumeGame(); return; }
    if (gameState === "gameover") {
      if (Date.now() >= restartAllowedAtRef.current) startGame();
      return;
    }
    if (gameState === "running") { holdingJumpRef.current = true; tryJump(); }
  }, [gameState, startGame, resumeGame, tryJump]);
  const handlePressOut = useCallback(() => {
    holdingJumpRef.current = false;
    if (gameState === "running" && velYRef.current < 0) velYRef.current *= JUMP_CUT_MULT;
  }, [gameState]);

  const mapNow = mapARef.current;
  const mapAlpha = mapFadeRef.current; // 0..1 vers B
  const showGround = mapNow !== "systeme_solaire";

  const showHeroHeader = gameState !== "running";

  // Mult affiché (lié à la vitesse)
  const speedMult = Math.min(MULT_MAX, MULT_MIN + Math.max(0, speedRef.current - START_SPEED) / MULT_SCALE).toFixed(1);
  const scoreBuff = getActiveScoreMult();

  // Seconds left helpers
  const secsLeft = (ms: number) => Math.max(0, Math.ceil((ms - Date.now()) / 1000));

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header (caché en jeu) */}
      {showHeroHeader && (
        <View style={[styles.hero, { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 26 }]}>
          <View style={styles.heroStripe} />
          <View style={styles.heroRow}>
            <Pressable onPress={() => (gameState === "running" ? pauseGame() : routerBack())} style={styles.backBtnHero} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name={gameState === "running" ? "pause" : "chevron-back"} size={22} color="#FF8200" />
            </Pressable>
            <Text style={styles.heroTitle}>Comets Run</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.heroProfileRow}>
            <Image source={logoComets} style={styles.heroLogo} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>Comets</Text>
              <Text style={styles.heroSub}>Terre → Mars → Espace… en continu !</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setShowHelp((v) => !v)} style={styles.iconBtnHero}><Icon name="help-circle-outline" size={18} color="#FF8200" /></Pressable>
              <Pressable onPress={() => pushTo("/CometsLeaderboardScreen")} style={styles.iconBtnHero}><Icon name="trophy-outline" size={18} color="#FF8200" /></Pressable>
              <Pressable onPress={() => toggleSetting("mute")} style={styles.iconBtnHero}><Icon name={settings.mute ? "volume-mute" : "volume-high"} size={18} color={settings.mute ? "#aaa" : "#FF8200"} /></Pressable>
              <Pressable onPress={() => toggleSetting("haptics")} style={styles.iconBtnHero}><Icon name="sparkles-outline" size={18} color={settings.haptics ? "#10b981" : "#777"} /></Pressable>
              <Pressable onPress={() => toggleSetting("highContrast")} style={styles.iconBtnHero}><Icon name="contrast" size={18} color={settings.highContrast ? "#f59e0b" : "#777"} /></Pressable>
            </View>
          </View>

          <View style={[styles.heroChips, { paddingHorizontal: 12, marginTop: 8 }]}>
            <View style={[styles.chip, { backgroundColor: "#D1F3FF" }]}><Text style={[styles.chipTxt, { color: "#0C7499" }]}>🏆 {best}</Text></View>
            <Animated.View style={{ transform: [{ scale: heroPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
              <View style={[styles.chip, { backgroundColor: hasShield ? "#86efac" : "#E5E7EB" }]}><Text style={[styles.chipTxt, { color: hasShield ? "#064e3b" : "#111827" }]}>{hasShield ? "🛡️" : `⚡ ${score}`}</Text></View>
            </Animated.View>
            <View style={[styles.chip, { backgroundColor: "#fde68a" }]}><Text style={[styles.chipTxt, { color: "#7c2d12" }]}>×{speedMult}</Text></View>
            {ENABLE_DOUBLEJUMP && doubleJumpUntil > Date.now() && (<View style={[styles.chip, { backgroundColor: "#bfdbfe" }]}><Text style={[styles.chipTxt, { color: "#1e3a8a" }]}>⛓️ {secsLeft(doubleJumpUntil)}s</Text></View>)}
            {Date.now() < invincibleUntil && (<View style={[styles.chip, { backgroundColor: "#FFE4C7" }]}><Text style={[styles.chipTxt, { color: "#7a2e0e" }]}>✨ invincible</Text></View>)}
            {scoreBuff > 1 && (
              <View style={[styles.chip, { backgroundColor: "#e9d5ff" }]}>
                <Text style={[styles.chipTxt, { color: "#4c1d95" }]}>💜 ×{scoreBuff} {secsLeft(scoreMultUntilRef.current)}s</Text>
              </View>
            )}
          </View>

          {!showHelp ? null : (
            <View style={styles.legendWrap}>
              <LegendItem image={imgCoin}   size={18} label="Pièce : +100 (combo jusqu’à ×2)" />
              <LegendItem image={imgShield} size={22} label="Bouclier : ignore 1 choc" />
              <LegendItem image={imgDouble} size={20} label="Double saut : 10s" />
              <LegendItem image={imgX2}     size={20} label="Purple Coin : ×2 → ×10 (10s, refresh)" />
            </View>
          )}
        </View>
      )}

      {/* Score centré style Comets */}
      <View pointerEvents="none" style={styles.scoreBigWrap}>
        <Text style={styles.scoreBig}>{score}</Text>
      </View>

      {/* Bouton pause seul en jeu, plus gros et décollé */}
      {gameState === "running" && (
        <View pointerEvents="box-none" style={styles.hudWrap}>
          <Pressable onPress={pauseGame} style={styles.hudBtn}><Icon name="pause" size={22} color="#FF8200" /></Pressable>
        </View>
      )}

      {/* Rappels bonus à gauche */}
      {gameState === "running" && (
        <View pointerEvents="none" style={styles.leftReminders}>
          {hasShield && (
            <ReminderBadge image={imgShield} text="Bouclier actif" />
          )}
          {doubleJumpActive() && (
            <ReminderBadge image={imgDouble} text={`Double saut  ${secsLeft(doubleJumpUntil)}s`} />
          )}
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
        <Animated.View style={{ transform: [{ translateY: shake.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }] }}>
          <View style={styles.sky} pointerEvents="none" />

          {/* BACKGROUNDS avec fondu A→B */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {renderMapBackground({
              screenH,
              bg: MAP_BG[mapARef.current],
              offsetRef: mapAOffsetRef,
              overlayDark: settings.highContrast ? 0.08 : 0.20,
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
              <View style={[styles.ground, { top: GROUND_Y, backgroundColor: settings.highContrast ? "#fff" : "#ff7a00" }]} />
              <View style={[styles.groundDetail, { top: GROUND_Y + 8, backgroundColor: settings.highContrast ? "#aaa" : "#402300" }]} />
              {renderGroundStripes({ SCREEN_W, GROUND_Y, groundOffsetRef, settings })}
            </>
          )}

          {/* Ombre joueur */}
          <View style={{ position: "absolute", left: playerX + PLAYER_RADIUS - 18, top: GROUND_Y - 10, width: 36, height: 10, backgroundColor: "#000", borderRadius: 6, opacity: showGround ? 0.25 : 0.08, transform: [{ scaleX: 1.1 }] }} pointerEvents="none" />

          {/* Aura double saut (derrière le joueur) */}
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
                borderWidth: 3,
                borderColor: "#60a5fa",
                backgroundColor: "rgba(96,165,250,0.12)",
                transform: [{ rotate: `${angleRef.current}rad` }],
              }}
            />
          )}

          {/* Halo bouclier (anneau SEUL, pas de fond, un peu plus petit) — derrière le joueur */}
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
                borderColor: "rgba(34,197,94,0.55)",
              }}
            />
          )}

          {/* Joueur */}
          <Image
            source={logoComets}
            style={[styles.player, {
              left: playerX, top: yRef.current, width: PLAYER_SIZE, height: PLAYER_SIZE, borderRadius: PLAYER_RADIUS,
              transform: [{ rotate: `${angleRef.current}rad` }],
              // Teinte uniquement en invincibilité (après un choc)
              tintColor: Date.now() < invincibleUntil ? "#ffbb6b" : undefined,
            }]}
            resizeMode="contain"
          />

          {/* Obstacles */}
          {obstaclesRef.current.map((o) => (
            <Image key={o.id} source={o.variant === 0 ? imgObs1 : imgObs2}
              style={[styles.obstacleImg, { left: o.x, top: o.y, width: o.w, height: o.h, opacity: mapNow === "systeme_solaire" ? 0.95 : 1 }]} resizeMode="cover" />
          ))}

          {/* Collectibles */}
          {ENABLE_COLLECTIBLES && collectiblesRef.current.map((c) => (
            <Image key={`c-${c.id}`} source={imgCoin}
              style={{ position: "absolute", left: c.x - R_COLLECTIBLE, top: c.y - R_COLLECTIBLE, width: R_COLLECTIBLE * 2, height: R_COLLECTIBLE * 2 }}
              resizeMode="contain" />
          ))}

          {/* Power-ups */}
          {powerUpsRef.current.map((p) => {
            const src = p.kind === "shield" ? imgShield : p.kind === "doublejump" ? imgDouble : imgX2;
            // ↗️ bouclier plus gros et plus visible
            const scale = p.kind === "shield" ? 1.45 : 1.0;
            const size = (p.kind === "x2" ? R_X2 * 2 : R_POWERUP * 2) * scale;
            const r = (p.kind === "x2" ? R_X2 : R_POWERUP) * scale;
            return (
              <View key={`p-${p.id}`} style={{ position: "absolute", left: p.x - r, top: p.y - r }}>
                {p.kind === "shield" && (
                  <View style={{
                    position: "absolute", left: -6, top: -6, right: -6, bottom: -6,
                    borderRadius: (size + 12) / 2, backgroundColor: "rgba(34,197,94,0.18)", borderWidth: 2, borderColor: "rgba(34,197,94,0.7)"
                  }}/>
                )}
                <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />
              </View>
            );
          })}

          {/* Popups +pts (flottants) */}
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
                style={{
                  position: "absolute",
                  left: p.x - 8,
                  top: p.y - 22 + dy,
                  transform: [{ scale }],
                  opacity: op,
                }}
              >
                <Text style={styles.popupPts}>{p.text}</Text>
              </View>
            );
          })}

          {/* Overlays */}
          {gameState === "ready" && <CenterOverlay icon="play" title="Appuie pour jouer" subtitle="Mode infini — va le plus loin possible !" />}
          {gameState === "paused" && <CenterOverlay icon="pause" title="Pause" subtitle="Touchez pour reprendre" />}
        </Animated.View>
      </Pressable>

      {/* Toast global */}
      {toast && (<View style={styles.toast}><Text style={styles.toastTxt}>{toast}</Text></View>)}

      {/* Game Over */}
      {gameState === "gameover" && (
        <GameOverModal
          visible
          onRestart={() => { if (Date.now() >= restartAllowedAtRef.current) startGame(); }}
          onLeaderboard={() => pushTo("/CometsLeaderboardScreen")}
          top5={top5}
          myId={adminId || ""}
          myScore={score}
        />
      )}
    </SafeAreaView>
  );
}

// ===== helpers =====
function circleRectCollide(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number) {
  const testX = Math.max(rx, Math.min(cx, rx + rw));
  const testY = Math.max(ry, Math.min(cy, ry + rh));
  const distX = cx - testX, distY = cy - testY;
  return distX * distX + distY * distY <= r * r;
}
function circleCircleCollide(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx, dy = ay - by; const rr = ar + br; return dx * dx + dy * dy <= rr * rr;
}

// ---- Render subparts
function renderGroundStripes({ SCREEN_W, GROUND_Y, groundOffsetRef, settings }: any) {
  const stripes: JSX.Element[] = [];
  const stripeSpan = STRIPE_W * 3;
  const offset = -((groundOffsetRef.current % stripeSpan) | 0);
  for (let x = -stripeSpan; x < SCREEN_W + stripeSpan; x += stripeSpan) {
    stripes.push(<View key={`g-${x}`} style={{
      position: "absolute", left: x + offset, top: GROUND_Y - STRIPE_H - 2,
      width: STRIPE_W, height: STRIPE_H, backgroundColor: settings.highContrast ? "#fff" : "#2b1900",
      borderRadius: 3, opacity: settings.highContrast ? 0.7 : 1,
    }} />);
  }
  return stripes;
}
function renderFence({ SCREEN_W, GROUND_Y, fenceOffsetRef, settings }: any) {
  const posts: JSX.Element[] = [];
  const span = 52;
  const offset = -((fenceOffsetRef.current % span) | 0);
  for (let x = -span; x < SCREEN_W + span; x += span) {
    posts.push(<View key={`p-${x}`} style={{
      position: "absolute", left: x + offset, top: GROUND_Y - 54, width: 6, height: 48,
      backgroundColor: settings.highContrast ? "#fff" : "#1f2937", borderRadius: 3, opacity: 0.7,
    }} />);
  }
  return (
    <>
      {posts}
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 46, height: 2, backgroundColor: settings.highContrast ? "#fff" : "#1f2937", opacity: 0.7 }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 32, height: 2, backgroundColor: settings.highContrast ? "#fff" : "#1f2937", opacity: 0.7 }} />
    </>
  );
}

// Maps
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

// Nav utils
function routerBack() { try { const { router } = require("expo-router"); router.back(); } catch {} }
function pushTo(path: string) { try { const { router } = require("expo-router"); router.push(path as any); } catch {} }

// UI helpers
function CenterOverlay({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string; }) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.overlayCard}>
        <Icon name={icon as any} size={24} color="#fff" />
        <Text style={[styles.overlayTitle, { marginTop: 6 }]}>{title}</Text>
        {subtitle ? <Text style={[styles.overlaySub, { marginTop: 4 }]}>{subtitle}</Text> : null}
        <Text style={[styles.overlayHint, { marginTop: 4 }]}>Appuie n'importe où</Text>
      </View>
    </View>
  );
}

function LegendItem({ image, label, size = 18 }: { image: any; label: string; size?: number; }) {
  return (
    <View style={styles.legend}>
      <Image source={image} style={{ width: size, height: size, marginRight: 8 }} resizeMode="contain" />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function ReminderBadge({ image, text }: { image: any; text: string; }) {
  return (
    <View style={styles.reminderBadge} pointerEvents="none">
      <Image source={image} style={styles.reminderIcon} resizeMode="contain" />
      <Text style={styles.reminderText}>{text}</Text>
    </View>
  );
}

// Game Over modal
function GameOverModal({
  visible, onRestart, onLeaderboard, top5, myId, myScore,
}: { visible: boolean; onRestart: () => void; onLeaderboard: () => void; top5: LBRow[] | null; myId: string; myScore: number; }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onRestart}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }} onPress={onRestart}>
        <Pressable onPress={() => {}} style={{ minWidth: 280, maxWidth: SCREEN_W - 32, backgroundColor: "#0b0b0b", borderRadius: 14, borderWidth: 1, borderColor: "#2a2a2a", padding: 12, alignItems: "center" }}>
          <Icon name="reload" size={24} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 6 }}>Perdu !</Text>
          <Text style={{ color: "#ddd", fontSize: 12, marginTop: 4 }}>Touchez pour recommencer</Text>
          <Text style={{ color: "#aaa", fontSize: 11, marginTop: 4 }}>Appuie n'importe où</Text>

          <View style={{ alignSelf: "stretch", marginTop: 12 }}>
            <Text style={{ color: "#ffd166", fontWeight: "800", marginBottom: 6, textAlign: "center" }}>Top 5</Text>
            {top5 === null ? (
              <Text style={{ color: "#bbb", textAlign: "center" }}>Chargement…</Text>
            ) : top5.length === 0 ? (
              <Text style={{ color: "#bbb", textAlign: "center" }}>Aucun score pour le moment</Text>
            ) : (
              top5.map((row, idx) => {
                const isMe = row.admin_id && myId && row.admin_id === myId;
                const first = row.admins?.first_name ?? "";
                const last  = row.admins?.last_name ?? "";
                const display = (first || last) ? `${first} ${last}`.trim() : "Anonyme";
                return (
                  <View key={row.admin_id + String(idx)} style={{
                    flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, marginBottom: 6,
                    backgroundColor: isMe ? "rgba(255,209,102,0.20)" : "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: isMe ? "#ffd166" : "#2a2aa",
                  }}>
                    <Text style={{ width: 22, color: isMe ? "#111" : "#fff", fontWeight: "800", backgroundColor: isMe ? "#ffd166" : "transparent", textAlign: "center", borderRadius: 6 }}>
                      {idx + 1}
                    </Text>
                    <Text numberOfLines={1} style={{ flex: 1, marginLeft: 10, color: "#e5e7eb", fontWeight: isMe ? "800" : "600" }}>
                      {display}{isMe ? "  (vous)" : ""}
                    </Text>
                    <Text style={{ color: "#93c5fd", fontWeight: "800" }}>{row.best_score}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ alignSelf: "stretch", marginTop: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#3a2a00", backgroundColor: "rgba(255,180,0,0.09)" }}>
            <Text style={{ color: "#ffd166", fontWeight: "900", textAlign: "center", fontSize: 15 }}>Ton score : {myScore}</Text>
          </View>

          <TouchableOpacity onPress={onLeaderboard} activeOpacity={0.8} style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#111", borderWidth: 1, borderColor: "#333", alignSelf: "center" }} testID="go-to-leaderboard">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
              <Icon name="trophy-outline" size={16} color="#ffd166" />
              <Text style={{ marginLeft: 8, color: "#ffd166", fontWeight: "800", fontSize: 14 }}>Voir le classement 🏆</Text>
            </View>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Styles
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0a0a" },

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
  heroRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 },
  backBtnHero: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#1b1e27",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2f3d",
  },
  heroTitle: { flex: 1, textAlign: "center", color: "#FF8200", fontSize: 20, fontWeight: "800", letterSpacing: 1.1 },
  heroProfileRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  heroLogo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: "#FF8200" },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#c7cad1", fontSize: 12.5, marginTop: 2 },
  iconBtnHero: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#1b1e27",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2f3d",
  },

  heroChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  chipTxt: { fontWeight: "800", fontSize: 12.5 },

  legendWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, marginTop: 8 },
  legend: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)"
  },
  legendText: { color: "#eaeef7", fontWeight: "700", fontSize: 12.5 },

  gameArea: { flex: 1, position: "relative", overflow: "hidden" },
  sky: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0b0e14" },

  // Rappels bonus à gauche
  leftReminders: {
    position: "absolute",
    left: 16,
    top: Platform.OS === "android" ? 60 : 70,
    zIndex: 10,
    gap: 8,
  },
  reminderBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reminderIcon: { width: 18, height: 18, marginRight: 8 },
  reminderText: { color: "#e5e7eb", fontWeight: "800", fontSize: 12.5 },

  ground: { position: "absolute", left: 0, right: 0, height: GROUND_HEIGHT },
  groundDetail: { position: "absolute", left: 0, right: 0, height: 2 },

  player: { position: "absolute", backgroundColor: "transparent", backfaceVisibility: "hidden" },
  obstacleImg: { position: "absolute", borderTopLeftRadius: 6, borderTopRightRadius: 6 },

  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  overlayCard: {
    width: Math.min(360, SCREEN_W - 32),
    backgroundColor: "rgba(0,0,0,0.55)",
    borderColor: "#2a2a2a",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  overlayTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  overlaySub: { color: "#ddd", fontSize: 12 },
  overlayHint: { color: "#aaa", fontSize: 11 },

  toast: {
    position: "absolute",
    top: Platform.OS === "android" ? 64 : 72, // sous le score
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(17,17,17,0.85)",
    borderWidth: 1,
    borderColor: "#333",
  },
  toastTxt: { color: "#ffd166", fontWeight: "800" },

  // HUD (pause seul) — plus gros et décollé
  hudWrap: { position: "absolute", left: 16, top: Platform.OS === "android" ? 12 : 16, zIndex: 10 },
  hudBtn: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: "#1b1e27",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2f3d",
  },

  // Score centré
  scoreBigWrap: {
    position: "absolute",
    top: Platform.OS === "android" ? 6 : 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9,
  },
  scoreBig: {
    color: "#FF8200",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1.2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,130,0,0.25)",
  },

  // Popups +pts
  popupPts: {
    color: "#ffd166",
    fontSize: 14,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,209,102,0.35)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
});
