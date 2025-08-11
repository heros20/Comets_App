// app/screens/CometsRunnerScreen.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Ionicons";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/** ------------------------------
 *  Gameplay constants (tuned to match Chrome Dino feel)
 *  ------------------------------ */
const GROUND_Y = Math.floor(SCREEN_H * 0.76); // baseline where player stands
const GROUND_HEIGHT = 2;
const PLAYER_SIZE = 64; // square mascot (rounded via style)
const PLAYER_RADIUS = PLAYER_SIZE / 2; // for roll calc
const GRAVITY = 2600; // px/s^2
const JUMP_VELOCITY = -980; // px/s single jump like Dino
const START_SPEED = 340; // px/s world scroll speed
const SPEED_GAIN_PER_SEC = 22; // speed ramp
const OBSTACLE_MIN_GAP = 320; // slightly larger to avoid "spawn on me" feel
const OBSTACLE_MAX_GAP = 560;
const OBSTACLE_MIN_W = 28;
const OBSTACLE_MAX_W = 52;
const OBSTACLE_BASE_H = 62; // typical obstacle height
const COYOTE_TIME = 0.12; // seconds after leaving ground when jump still allowed
const JUMP_BUFFER = 0.12; // seconds before landing that buffers jump
const MAX_SPAWN_ATTEMPTS = 8; // at very high speeds

// Parallax / ground visuals
const STRIPE_W = 22; // ground tick width
const STRIPE_H = 6; // ground tick height
const FAR_BG_SPEED = 0.25; // parallax ratio
const MID_BG_SPEED = 0.55; // parallax ratio
const FENCE_SPEED = 0.8; // front parallax for fence
const BG_SPEED = 0.15; // background parallax (slow)

// Assets
const logoComets = require("../../assets/images/iconComets.png");
const bgField = require("../../assets/images/bg_field.jpg"); // <-- put your full-screen field image here

// Types
type Obstacle = {
  id: number;
  x: number; // left
  w: number;
  h: number;
  y: number; // top
};

type GameState = "ready" | "running" | "paused" | "gameover";

export default function CometsRunnerScreen() {
  // World state
  const [gameState, setGameState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const speedRef = useRef(START_SPEED);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastIdRef = useRef(1);

  // Player physics
  const playerX = Math.floor(SCREEN_W * 0.18);
  const [playerY, setPlayerY] = useState(GROUND_Y - PLAYER_SIZE);
  const velYRef = useRef(0);
  const groundedRef = useRef(true);
  const lastGroundedTimeRef = useRef(0); // for coyote
  const jumpBufferRef = useRef(0);

  // Player spin for visual feedback
  const [playerAngle, setPlayerAngle] = useState(0); // radians
  const angleRef = useRef(0);

  // Parallax offsets
  const farOffsetRef = useRef(0);
  const midOffsetRef = useRef(0);
  const groundOffsetRef = useRef(0);
  const fenceOffsetRef = useRef(0);
  const bgOffsetRef = useRef(0);

  // Render ticker to keep visuals updating even when playerY & score don't change
  const [renderTick, setRenderTick] = useState(0);

  // Distance accumulator for score
  const distAccRef = useRef(0);

  // Roll control multiplier
  const ROLL_VISUAL_MULT = 0.9; // tweak to look good vs. true no-slip

  // RAF loop
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Load best score
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("COMETS_RUNNER_BEST");
        if (raw) setBest(parseInt(raw, 10) || 0);
      } catch {}
    })();
  }, []);

  const resetWorld = useCallback(() => {
    obstaclesRef.current = [];
    lastIdRef.current = 1;
    speedRef.current = START_SPEED;
    setScore(0);
    distAccRef.current = 0;

    velYRef.current = 0;
    groundedRef.current = true;
    setPlayerY(GROUND_Y - PLAYER_SIZE);
    lastGroundedTimeRef.current = 0;
    jumpBufferRef.current = 0;

    // visuals
    farOffsetRef.current = 0;
    midOffsetRef.current = 0;
    groundOffsetRef.current = 0;
    fenceOffsetRef.current = 0;
    bgOffsetRef.current = 0;
    angleRef.current = 0;
    setPlayerAngle(0);
    setRenderTick(0);

    // Pre-spawn the first obstacle sufficiently ahead so it never pops on the player
    const firstX = SCREEN_W + 260; // safe lead
    const firstW = randRange(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
    const h = OBSTACLE_BASE_H + Math.floor(Math.random() * 16) - 8;
    obstaclesRef.current.push({ id: ++lastIdRef.current, x: firstX, w: firstW, h, y: GROUND_Y - h });
  }, []);

  const startGame = useCallback(() => {
    resetWorld();
    setGameState("running");
  }, [resetWorld]);

  const pauseGame = useCallback(() => {
    setGameState((s) => (s === "running" ? "paused" : s));
  }, []);

  const resumeGame = useCallback(() => {
    if (gameState === "paused") setGameState("running");
  }, [gameState]);

  const endGame = useCallback(async () => {
    setGameState("gameover");
    try {
      if (score > best) {
        setBest(score);
        await AsyncStorage.setItem("COMETS_RUNNER_BEST", String(score));
      }
    } catch {}
  }, [score, best]);

  // Jump handling with coyote + buffer
  const tryJump = useCallback(() => {
    jumpBufferRef.current = 0.001 + JUMP_BUFFER; // mark intent
    const now = performance.now() / 1000;
    const canCoyote = now - lastGroundedTimeRef.current <= COYOTE_TIME;
    if (groundedRef.current || canCoyote) {
      velYRef.current = JUMP_VELOCITY;
      groundedRef.current = false;
      lastGroundedTimeRef.current = -999; // prevent reuse
      jumpBufferRef.current = 0; // consumed
    }
  }, []);

  // Collision helper (circle vs rect)
  const circleRectCollide = (
    cx: number,
    cy: number,
    r: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ) => {
    const testX = Math.max(rx, Math.min(cx, rx + rw));
    const testY = Math.max(ry, Math.min(cy, ry + rh));
    const distX = cx - testX;
    const distY = cy - testY;
    return distX * distX + distY * distY <= r * r;
  };

  // Spawning logic (ensures obstacles are always born off-screen with a proper gap)
  const spawnObstacle = useCallback((minGap: number) => {
    const attempts = Math.max(1, Math.min(MAX_SPAWN_ATTEMPTS, Math.floor(speedRef.current / 60)));
    for (let i = 0; i < attempts; i++) {
      const w = randRange(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
      const h = OBSTACLE_BASE_H + Math.floor(Math.random() * 16) - 8; // small variety
      const lead = Math.max(minGap, Math.floor(SCREEN_W * 0.55)); // never closer than 55% screen ahead
      const x = SCREEN_W + lead + randRange(0, OBSTACLE_MAX_GAP);
      const y = GROUND_Y - h;
      obstaclesRef.current.push({ id: ++lastIdRef.current, x, w, h, y });
      // Optional cluster
      if (Math.random() < 0.22) {
        const w2 = randRange(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
        const x2 = x + w + randRange(70, 130);
        obstaclesRef.current.push({ id: ++lastIdRef.current, x: x2, w: w2, h, y });
      }
      break;
    }
  }, []);

  // Main loop
  useEffect(() => {
    if (gameState !== "running") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(0.032, (ts - lastTsRef.current) / 1000); // clamp for safety (~31 FPS min)
      lastTsRef.current = ts;

      // speed up
      const s = (speedRef.current += SPEED_GAIN_PER_SEC * dt);

      // parallax motion
      farOffsetRef.current += s * FAR_BG_SPEED * dt;
      midOffsetRef.current += s * MID_BG_SPEED * dt;
      groundOffsetRef.current += s * dt;
      fenceOffsetRef.current += s * FENCE_SPEED * dt;
      bgOffsetRef.current += s * BG_SPEED * dt;

      // update player physics
      velYRef.current += GRAVITY * dt;
      let newY = playerY + velYRef.current * dt;
      const floorY = GROUND_Y - PLAYER_SIZE;

      if (newY >= floorY) {
        newY = floorY;
        if (!groundedRef.current) {
          groundedRef.current = true;
          lastGroundedTimeRef.current = ts / 1000;
          // buffered jump on landing
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
      // Always nudge state to force a render even if Y doesn't change
      setPlayerY((prev) => (prev === newY ? newY + 0.0001 : newY));

      // spin & roll mascot
      if (!groundedRef.current) {
        // airborne spin (extra flair)
        const rate = 8 + Math.min(10, Math.abs(velYRef.current) / 220);
        angleRef.current += rate * dt; // radians/sec
      } else {
        // roll based on ground speed (approx no-slip): omega = v / r
        const omega = (s / Math.max(1, PLAYER_RADIUS)) * ROLL_VISUAL_MULT; // rad/s
        angleRef.current += omega * dt;
      }
      setPlayerAngle(angleRef.current);

      // update obstacles
      if (obstaclesRef.current.length === 0) {
        spawnObstacle(OBSTACLE_MIN_GAP);
      }

      obstaclesRef.current = obstaclesRef.current
        .map((o) => ({ ...o, x: o.x - s * dt }))
        .filter((o) => o.x + o.w > -40);

      // ensure next spawn once the last obstacle has progressed enough
      const last = obstaclesRef.current[obstaclesRef.current.length - 1];
      if (!last || last.x < SCREEN_W - randRange(Math.floor(OBSTACLE_MIN_GAP * 0.6), OBSTACLE_MAX_GAP)) {
        spawnObstacle(randRange(OBSTACLE_MIN_GAP, OBSTACLE_MAX_GAP));
      }

      // collision check (use circle around player)
      const cx = playerX + PLAYER_SIZE / 2;
      const cy = newY + PLAYER_SIZE / 2;
      const r = PLAYER_SIZE * 0.42;
      for (const o of obstaclesRef.current) {
        if (circleRectCollide(cx, cy, r, o.x, o.y, o.w, o.h)) {
          endGame();
          break;
        }
      }

      // accumulate distance and convert to integer score (1 point per 10 px)
      distAccRef.current += s * dt;
      if (distAccRef.current >= 10) {
        const gained = Math.floor(distAccRef.current / 10);
        distAccRef.current -= gained * 10;
        setScore((prev) => prev + gained);
      }

      // tick to guarantee render
      setRenderTick((t) => (t + 1) % 1000000);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [gameState, playerY, endGame, spawnObstacle]);

  // Input: tap anywhere to jump; also handles state transitions
  const onPress = useCallback(() => {
    if (gameState === "ready") return startGame();
    if (gameState === "running") return tryJump();
    if (gameState === "paused") return resumeGame();
    if (gameState === "gameover") return startGame();
  }, [gameState, resumeGame, startGame, tryJump]);

  // UI helpers
  const topBar = (
    <View style={styles.topBar}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Image source={logoComets} style={styles.topLogo} />
        <Text style={styles.title}>Comets Run</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={styles.scorePill}>
          <Icon name="trophy-outline" size={16} color="#fff" />
          <Text style={styles.scoreText}>Best {best}</Text>
        </View>
        <View style={styles.scorePill}>
          <Icon name="flash-outline" size={16} color="#fff" />
          <Text style={styles.scoreText}>{score}</Text>
        </View>
        {gameState === "running" ? (
          <Pressable onPress={() => setGameState("paused")} style={styles.iconBtn}>
            <Icon name="pause" size={18} color="#fff" />
          </Pressable>
        ) : gameState === "paused" ? (
          <Pressable onPress={() => setGameState("running")} style={styles.iconBtn}>
            <Icon name="play" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  // Parallax stripe helpers
  const renderGroundStripes = () => {
    const stripes = [] as JSX.Element[];
    const stripeSpan = STRIPE_W * 2; // spacing between stripes
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
            backgroundColor: "#2b1900",
            borderRadius: 3,
          }}
        />
      );
    }
    return stripes;
  };

  const renderMidDots = () => {
    const dots = [] as JSX.Element[];
    const span = 28;
    const offset = -((midOffsetRef.current % span) | 0);
    for (let x = -span; x < SCREEN_W + span; x += span) {
      dots.push(
        <View
          key={`m-${x}`}
          style={{
            position: "absolute",
            left: x + offset,
            top: Math.floor(GROUND_Y * 0.65),
            width: 3,
            height: 3,
            backgroundColor: "#1e293b",
            borderRadius: 2,
            opacity: 0.7,
          }}
        />
      );
    }
    return dots;
  };

  const renderFarDots = () => {
    const dots = [] as JSX.Element[];
    const span = 36;
    const offset = -((farOffsetRef.current % span) | 0);
    for (let x = -span; x < SCREEN_W + span; x += span) {
      dots.push(
        <View
          key={`f-${x}`}
          style={{
            position: "absolute",
            left: x + offset,
            top: Math.floor(GROUND_Y * 0.5),
            width: 2,
            height: 2,
            backgroundColor: "#0f172a",
            borderRadius: 2,
            opacity: 0.5,
          }}
        />
      );
    }
    return dots;
  };

  // ===== Baseball Background (vector fallback/overlay) =====
  function renderField() {
    // Draw a stylized baseball diamond & outfield using simple Views
    const cw = SCREEN_W;
    const outfieldSize = Math.max(cw * 1.6, 520);
    const centerX = cw * 0.5 - outfieldSize / 2;
    const centerY = GROUND_Y - outfieldSize * 0.35; // arc peeking above ground

    return (
      <>
        {/* Outfield arc */}
        <View
          style={{
            position: "absolute",
            left: centerX,
            top: centerY,
            width: outfieldSize,
            height: outfieldSize,
            borderRadius: outfieldSize / 2,
            backgroundColor: "#0f3d1f", // deep grass
            opacity: 0.4, // reduced because we now have the photo bg
          }}
        />

        {/* Infield dirt circle */}
        <View
          style={{
            position: "absolute",
            left: cw * 0.5 - 140 / 2,
            top: GROUND_Y - 110,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "#744b28",
            opacity: 0.5,
          }}
        />

        {/* Diamond (rotated square) */}
        <View
          style={{
            position: "absolute",
            left: cw * 0.5 - 96 / 2,
            top: GROUND_Y - 86,
            width: 96,
            height: 96,
            backgroundColor: "#8a5a2b",
            transform: [{ rotate: "45deg" }],
            opacity: 0.5,
            borderColor: "#d9c9b3",
            borderWidth: 2,
          }}
        />

        {/* Bases */}
        {renderBase(cw * 0.5, GROUND_Y - 38)}{/* Home */}
        {renderBase(cw * 0.5 - 48, GROUND_Y - 86)}{/* 3rd */}
        {renderBase(cw * 0.5 + 48, GROUND_Y - 86)}{/* 1st */}
        {renderBase(cw * 0.5, GROUND_Y - 134)}{/* 2nd */}

        {/* Foul lines */}
        <View style={{ position: "absolute", left: cw * 0.5, top: GROUND_Y - 38, width: 2, height: 200, backgroundColor: "#f8fafc", transform: [{ rotate: "-68deg" }], opacity: 0.5 }} />
        <View style={{ position: "absolute", left: cw * 0.5, top: GROUND_Y - 38, width: 2, height: 200, backgroundColor: "#f8fafc", transform: [{ rotate: "68deg" }], opacity: 0.5 }} />

        {/* Pitcher's mound */}
        <View
          style={{
            position: "absolute",
            left: cw * 0.5 - 22,
            top: GROUND_Y - 116,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#7a4e29",
            borderColor: "#cbb79a",
            borderWidth: 2,
            opacity: 0.6,
          }}
        />
      </>
    );
  }

  function renderBase(x: number, y: number) {
    return (
      <View
        style={{
          position: "absolute",
          left: x - 8,
          top: y - 8,
          width: 16,
          height: 16,
          backgroundColor: "#ffffff",
          transform: [{ rotate: "45deg" }],
          borderColor: "#e2e8f0",
          borderWidth: 1,
          opacity: 0.8,
        }}
      />
    );
  }

  function renderFence() {
    // Scrolling fence posts to enhance motion parallax
    const posts: JSX.Element[] = [];
    const span = 36; // spacing between posts
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
            backgroundColor: "#1f2937",
            borderRadius: 3,
            opacity: 0.7,
          }}
        />
      );
    }
    // horizontal bars
    return (
      <>
        {posts}
        <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 46, height: 2, backgroundColor: "#1f2937", opacity: 0.7 }} />
        <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_Y - 32, height: 2, backgroundColor: "#1f2937", opacity: 0.7 }} />
      </>
    );
  }

  // ===== Full-screen scrolling background =====
  function renderScrollingBackground() {
    // Tile two full-screen ImageBackgrounds horizontally and shift them by bgOffsetRef
    const w = SCREEN_W;
    const o = -((bgOffsetRef.current % w) | 0);
    return (
      <>
        <ImageBackground
          source={bgField}
          style={{ position: "absolute", left: o, top: 0, width: w, height: SCREEN_H }}
          resizeMode="cover"
        />
        <ImageBackground
          source={bgField}
          style={{ position: "absolute", left: o + w, top: 0, width: w, height: SCREEN_H }}
          resizeMode="cover"
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {topBar}

      <Pressable onPress={onPress} style={styles.gameArea}>
        {/* Sky */}
        <View style={styles.sky} />

        {/* FULL-SCREEN FIELD BACKGROUND with parallax (tiled) */}
        <View style={StyleSheet.absoluteFill}>{renderScrollingBackground()}</View>

        {/* Parallax hints (optional, keep for extra depth) */}
        {renderFarDots()}
        {renderMidDots()}

        {/* Stadium fence (parallax front) */}
        {renderFence()}

        {/* Baseball field (vector fallback overlay) */}

        {/* Ground & details */}
        <View style={[styles.ground, { top: GROUND_Y }]} />
        <View style={[styles.groundDetail, { top: GROUND_Y + 8 }]} />
        {renderGroundStripes()}

        {/* Player (rounded logo + roll/spin) */}
        <Image
          source={logoComets}
          style={[
            styles.player,
            {
              left: playerX,
              top: playerY,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              borderRadius: PLAYER_RADIUS,
              transform: [{ rotate: `${playerAngle}rad` }],
            },
          ]}
        />

        {/* Obstacles */}
        {obstaclesRef.current.map((o) => (
          <View key={o.id} style={[styles.obstacle, { left: o.x, top: o.y, width: o.w, height: o.h }]} />
        ))}

        {/* State overlays */}
        {gameState === "ready" && (
          <CenterOverlay icon="play" title="Appuie pour jouer" subtitle="Saute par-dessus les bases !" />
        )}
        {gameState === "paused" && (
          <CenterOverlay icon="pause" title="Pause" subtitle="Touchez pour reprendre" />
        )}
        {gameState === "gameover" && (
          <CenterOverlay icon="reload" title="Perdu !" subtitle="Touchez pour recommencer" />
        )}
      </Pressable>
    </SafeAreaView>
  );
}

function CenterOverlay({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <Icon name={icon as any} size={28} color="#fff" />
        <Text style={styles.overlayTitle}>{title}</Text>
        {subtitle ? <Text style={styles.overlaySub}>{subtitle}</Text> : null}
        <Text style={styles.overlayHint}>Appuie n'importe où</Text>
      </View>
    </View>
  );
}

function randRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    backgroundColor: "#0f0f10",
  },
  topLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  title: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
    letterSpacing: 0.5,
  },
  scorePill: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#111",
    borderColor: "#2a2a2a",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scoreText: { color: "#fff", fontWeight: "700" },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  gameArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0b0e14",
  },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    height: GROUND_HEIGHT,
    backgroundColor: "#ff7a00",
  },
  groundDetail: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#402300",
  },
  player: {
    position: "absolute",
    backgroundColor: "#1a1a1a", // fallback if image not loaded
  },
  obstacle: {
    position: "absolute",
    backgroundColor: "#ff9c3a",
    borderColor: "#ffc38f",
    borderWidth: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayCard: {
    width: Math.min(420, SCREEN_W - 48),
    backgroundColor: "rgba(0,0,0,0.6)",
    borderColor: "#2a2a2a",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  overlayTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  overlaySub: { color: "#ddd" },
  overlayHint: { color: "#aaa", fontSize: 12 },
});
