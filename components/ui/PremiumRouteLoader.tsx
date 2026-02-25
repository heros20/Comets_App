import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

type PremiumRouteLoaderProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  fullscreen?: boolean;
};

export default function PremiumRouteLoader({
  visible,
  title = "Chargement",
  subtitle = "Ouverture de la page...",
  fullscreen = false,
}: PremiumRouteLoaderProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.86)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) {
      spinLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
      return;
    }

    spin.setValue(0);
    pulse.setValue(0.86);

    spinLoopRef.current = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 540,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.86,
          duration: 540,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    spinLoopRef.current.start();
    pulseLoopRef.current.start();

    return () => {
      spinLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
    };
  }, [visible, pulse, spin]);

  if (!visible) return null;

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.overlay, fullscreen ? styles.fullscreen : null]} pointerEvents="auto">
      <LinearGradient
        colors={["rgba(3,7,18,0.78)", "rgba(8,13,24,0.92)", "rgba(3,7,18,0.84)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdrop}
      />

      <Animated.View style={[styles.card, { transform: [{ scale: pulse }] }]}>
        <View style={styles.spinnerRing}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Icon name="baseball-outline" size={30} color="#FB923C" />
          </Animated.View>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  fullscreen: {
    position: "absolute",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: 240,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.42)",
    backgroundColor: "rgba(13,23,37,0.86)",
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  spinnerRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.35)",
    backgroundColor: "rgba(15,23,42,0.62)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginTop: 12,
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 5,
    color: "#CBD5E1",
    fontSize: 12.5,
    textAlign: "center",
  },
});

