/**
 * Ambient — the persistent, color-shifting backdrop (frontend-design-system §12.3).
 * ==================================================================
 * One CoverWall aurora lives at the ROOT of the authenticated area and never
 * unmounts: navigating between screens swaps only the foreground, so the
 * backdrop stays put (no flash, no re-mount). A low-opacity media-color WASH
 * sits on top of the aurora and CROSS-FADES (Reanimated) whenever a screen calls
 * `setAmbient(color)` — "작품의 매체색이 무대를 물들이는" ambient.
 *
 * WIRING (the §12.3 contract — all three layers must be transparent):
 *   (app)/_layout  -> <AmbientProvider> wraps the Stack; Stack contentStyle
 *                     background:'transparent' so the navigator never paints over
 *                     the aurora.
 *   (tabs)/_layout -> Tabs sceneContainerStyle background:'transparent'.
 *   each screen    -> <Screen surface="ambient"> (transparent root) reveals it;
 *                     a screen that calls setAmbient on its media color drives
 *                     the tint. Screens that stay surface="chrome" simply paint
 *                     over the (still-persistent) backdrop.
 *
 * WEB NOTE: the aurora gradients are New-Arch `experimental_backgroundImage`
 * (native only) — on react-native-web only the solid base + the flat media WASH
 * render. So the color shift still reads on web, but the soft aurora is a
 * native-only payoff (verify on a simulator/device).
 *
 * Layering: imports CoverWall by relative path (the '@/ui' barrel re-exports
 * THIS module, so going through it would be circular).
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CoverWall } from './primitives/CoverWall';
import { mediaColor } from './tokens';

// Seed the backdrop with the first screen's media (the home opens on 웹툰), so
// the very first paint already matches before any setAmbient lands.
const DEFAULT_AMBIENT = mediaColor('webtoon');

// How strongly the media color tints the stage. Kept low — it must read as an
// ambient cast, never a flat color block over the content.
const WASH_OPACITY = 0.16;

type AmbientContextValue = { setAmbient: (color: string) => void };

const AmbientContext = createContext<AmbientContextValue>({ setAmbient: () => {} });

/**
 * Drive the persistent backdrop's tint. Call from a screen (effect/focus) with
 * the media color of what's on screen — `setAmbient(mediaColor(type))`. Safe to
 * call when no provider is mounted (no-op default).
 */
export function useAmbient(): AmbientContextValue {
  return useContext(AmbientContext);
}

export function AmbientProvider({ children }: { children: ReactNode }) {
  // withTiming animates NUMBERS only, so we animate a 0→1 `progress` and blend
  // `from`→`to` colors with interpolateColor. setAmbient runs on the JS thread
  // (reads/writes shared values + kicks the timing) — no worklet needed.
  const progress = useSharedValue(1);
  const from = useSharedValue(DEFAULT_AMBIENT);
  const to = useSharedValue(DEFAULT_AMBIENT);

  const setAmbient = useCallback(
    (next: string) => {
      if (!next || next === to.value) return;
      from.value = to.value;
      to.value = next;
      progress.value = 0;
      progress.value = withTiming(1, { duration: 480 });
    },
    [from, to, progress],
  );

  const washStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [from.value, to.value]),
  }));

  const value = useMemo(() => ({ setAmbient }), [setAmbient]);

  return (
    <AmbientContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {/* Persistent root layer — rendered behind `children`, never unmounts. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CoverWall />
          <Animated.View style={[StyleSheet.absoluteFill, washStyle, { opacity: WASH_OPACITY }]} />
        </View>
        {children}
      </View>
    </AmbientContext.Provider>
  );
}
