/**
 * Theme + motion access for primitives.
 * ------------------------------------------------------------------
 * The SINGLE READ PATH for the active theme. Resolution order:
 *   1. the user override from <ThemeModeProvider> (system/light/dark),
 *      read via the NON-THROWING optional accessor; if absent or set to
 *      'system' we fall through to —
 *   2. the OS color scheme (`@/hooks/use-color-scheme`).
 *
 * The optional accessor is deliberate: the root ErrorBoundary renders
 * OUTSIDE the provider, so `useTheme()` there must still return a valid
 * theme (OS fallback) instead of throwing — the error screen has to paint.
 *
 * React-Compiler / rules-of-hooks safety: BOTH hooks are called
 * unconditionally every render; only the resulting VALUE is branched.
 *
 * No import cycle: this module imports `theme-mode`, but `theme-mode` does
 * NOT import this module (it reads OS scheme + `themes` directly).
 */
import { useMemo } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeModeContextOptional } from './theme-mode';
import { type Theme, themes } from './theme';

/**
 * Resolve the active theme object.
 * Override (when present and not 'system') wins; otherwise OS scheme;
 * defaults to light. Both hooks run every render — only the value branches.
 */
export function useTheme(): Theme {
  const ctx = useThemeModeContextOptional();
  const osScheme = useColorScheme();
  const resolved =
    ctx != null
      ? ctx.resolvedScheme
      : osScheme === 'dark'
        ? 'dark'
        : 'light';
  return themes[resolved];
}

/**
 * Motion helper. Returns durations already collapsed to 0 when the OS
 * "Reduce Motion" setting is on, so callers never branch by hand:
 *   const { duration } = useMotion();  // duration.base === 0 if reduced
 */
export function useMotion() {
  const reduced = useReducedMotion();
  const base = themes.light.motion; // motion tokens are mode-independent
  return useMemo(() => {
    if (!reduced) return base;
    return {
      ...base,
      duration: { instant: 0, fast: 0, base: 0, slow: 0 },
      unlockPulseScale: 1, // no celebratory scale under reduced motion
    };
  }, [reduced, base]);
}

/** Imperative reduced-motion check for non-hook contexts (e.g. worklets setup). */
export const isReduceMotionEnabled = AccessibilityInfo.isReduceMotionEnabled;

export type { Theme };
