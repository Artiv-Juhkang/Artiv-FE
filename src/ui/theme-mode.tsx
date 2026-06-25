/**
 * ThemeMode — persistent light/dark/system selection (Glass Stack).
 * ------------------------------------------------------------------
 * This provider owns the USER OVERRIDE for color scheme. Three modes:
 *   - 'system' : follow the OS appearance (default; live-follows changes)
 *   - 'light'  : force the light theme
 *   - 'dark'   : force the dark theme
 *
 * The selected `mode` is persisted to AsyncStorage (only the mode — never
 * the resolved scheme, which is always derived from mode + OS so that a
 * device theme change is picked up immediately while in 'system'). The
 * resolved scheme is recomputed every render, so switching the OS theme
 * while in 'system' follows instantly with no listener wiring.
 *
 * Read path (single source of truth):
 *   - components inside the provider read `useThemeMode()` (throws if the
 *     provider is missing — it is required app-wide);
 *   - `src/ui/use-theme.ts` reads `useThemeModeContextOptional()`, which
 *     NEVER throws, so the root ErrorBoundary (which renders OUTSIDE this
 *     provider) still gets a valid theme via the OS fallback.
 *
 * IMPORTANT: this file must NOT import `./use-theme` — `use-theme` imports
 * THIS module, so importing back would create a cycle. We read raw OS
 * scheme from `@/hooks/use-color-scheme` and raw `themes` from `./theme`.
 *
 * Side effects driven here (app-wide defaults, not per-screen):
 *   - <StatusBar style={inverse}/> : sets the system status-bar CONTENT
 *     color (inverse of the scheme: a dark scheme wants LIGHT icons). This
 *     is the default for screens that don't render their own Screen bar
 *     (splash/error). On routed screens, the Screen primitive's own
 *     SystemBars wins by mount order — documented contract.
 *   - SystemUI.setBackgroundColorAsync(bg) : paints the native WINDOW
 *     background so there's no white flash behind transparent areas / on
 *     orientation change. It does NOT color the system bars (those stay
 *     transparent under edge-to-edge).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { type ColorScheme, themes } from './theme';

export type ThemeMode = 'system' | 'light' | 'dark';

/** AsyncStorage key for the persisted user override (mode only). */
export const THEME_MODE_STORAGE_KEY = '@apptoon/theme-mode';

const VALID_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (VALID_MODES as readonly string[]).includes(value);
}

type ThemeModeContextValue = {
  /** The user's chosen mode (persisted). */
  mode: ThemeMode;
  /** Update + persist the mode. State is synchronous; the write is fire-and-forget. */
  setMode: (mode: ThemeMode) => void;
  /** The effective light/dark scheme after resolving mode against the OS. */
  resolvedScheme: ColorScheme;
  /** False until the persisted mode has been read (used to gate first paint). */
  hasLoaded: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

/**
 * Resolve an OS color-scheme signal (which may be null/'unspecified' on
 * some platforms) down to our closed light|dark union. Anything that
 * isn't explicitly 'dark' falls back to 'light'.
 */
function resolveOsScheme(os: string | null | undefined): ColorScheme {
  return os === 'dark' ? 'dark' : 'light';
}

export function ThemeModeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const osScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [hasLoaded, setHasLoaded] = useState(false);

  // Guard against StrictMode double-mount and late async resolution writing
  // back after a faster user choice or after unmount.
  const startedRef = useRef(false);

  // Hydrate the persisted mode once on mount (client only — AsyncStorage is
  // a no-op-ish shim on web/SSR until mount, so this runs after hydration).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
        if (cancelled) return;
        if (isThemeMode(stored)) {
          setModeState(stored);
        }
        // garbage / unknown value → leave default 'system'
      } catch {
        // AsyncStorage read failed → keep default 'system' (no deadlock).
      } finally {
        // ALWAYS release the gate, even on failure, or the splash never hides.
        if (!cancelled) setHasLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    // State first (synchronous, optimistic) so the UI flips immediately.
    setModeState(next);
    // Persist last-write-wins; rapid toggles just settle on the final value.
    AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, next).catch(() => {
      // Persist failure is non-fatal — the in-memory choice still applies
      // for this session; we just won't remember it next launch.
    });
  }, []);

  // Recompute every render so a 'system' user follows OS theme changes live.
  const resolvedScheme: ColorScheme =
    mode === 'system' ? resolveOsScheme(osScheme) : mode;

  // Paint the native window background to match the active scheme. This
  // kills white-flash behind transparent surfaces / during rotation. It is
  // NOT a system-bar tint (bars stay transparent under edge-to-edge).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(themes[resolvedScheme].color.bg).catch(() => {
      // best-effort; web / unsupported platforms simply ignore this.
    });
  }, [resolvedScheme]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, setMode, resolvedScheme, hasLoaded }),
    [mode, setMode, resolvedScheme, hasLoaded],
  );

  // App-wide DEFAULT status-bar content color. Icons must contrast the
  // background, so we invert: dark scheme → 'light' icons, light → 'dark'.
  // Routed screens that render their own bar (via Screen) override this by
  // mount order; this default covers splash/error/bare screens.
  const statusBarStyle = resolvedScheme === 'dark' ? 'light' : 'dark';

  return (
    <ThemeModeContext.Provider value={value}>
      <StatusBar style={statusBarStyle} />
      {children}
    </ThemeModeContext.Provider>
  );
}

/**
 * Throwing accessor — use inside the app where the provider is guaranteed
 * (everything under ThemeModeProvider). Fails loudly if mis-mounted.
 */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (ctx == null) {
    throw new Error(
      'useThemeMode must be used within a <ThemeModeProvider>. ' +
        'Mount it in src/app/_layout.tsx above the routed screens.',
    );
  }
  return ctx;
}

/**
 * Non-throwing accessor — ONLY for `src/ui/use-theme.ts`, so primitives
 * rendered outside the provider (e.g. the root ErrorBoundary fallback)
 * can still resolve a theme via the OS scheme instead of crashing.
 */
export function useThemeModeContextOptional(): ThemeModeContextValue | null {
  return useContext(ThemeModeContext);
}
