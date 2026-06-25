/**
 * Root layout — the single decision tree for the whole app.
 *
 * Responsibilities (app-shell, frontend-architecture §7):
 *  1. Provider order (정본):
 *       GlobalErrorBoundary > SafeAreaProvider > NetworkProvider >
 *       QueryProvider > ToastProvider > AuthProvider > ThemeProvider >
 *       Stack + <OfflineBanner/>
 *     Rationale: AuthProvider calls useQueryClient (needs QueryProvider above)
 *     and shows a logout toast (needs ToastProvider above). GlobalErrorBoundary
 *     sits outermost so even a provider crash is caught.
 *  2. Splash + font gate so Stack.Protected has a SETTLED guard before first
 *     paint (no auth-stack flash). preventAutoHideAsync()/setOptions at module
 *     scope; the gate logic lives in an inner component MOUNTED UNDER
 *     AuthProvider because it reads useAuth().status.
 *  3. Stack.Protected drives the auth redirect — never hand-navigate after
 *     login (expo #30700 race); let the guard flip.
 *  4. A NAMED `ErrorBoundary` export = the last-resort route boundary catching
 *     any unhandled error bubbling up from child routes (expo-router error
 *     handling). It is NOT the default export.
 *
 * NOTE: `unstable_settings` is intentionally NOT exported — exporting it (even
 * `{}`) has been reported to break foreground deep linking (expo/router #818).
 *
 * Glass Stack / 체계 틀 additions (integration module owns these):
 *   - GestureHandlerRootView is the TRUE outermost wrapper (even outside
 *     GlobalErrorBoundary) so gestures work everywhere — including the error
 *     screen and any modal/gesture-back transition. style={{flex:1}} is
 *     mandatory or the gesture area collapses to 0 height. We do NOT call
 *     enableScreens(): react-native-screens is auto-enabled by expo-router on
 *     SDK 56.
 *   - ThemeModeProvider owns the user's light/dark/system override and is
 *     mounted UNDER AuthProvider and ABOVE the Gate, so the Gate can read
 *     useThemeMode().hasLoaded and the protected stack lives under the theme.
 *   - The Gate now also waits on theme-mode hydration (themeReady) so the
 *     first paint already has the persisted scheme — no light→dark flash.
 *   - The root Stack applies chromeStackScreenOptions(reduced) for consistent,
 *     reduced-motion-aware horizontal pushes + gesture-back.
 */
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/feedback';
import { AuthProvider, useAuth } from '@/features/auth';
import { chromeStackScreenOptions } from '@/lib/navigation/transitions';
import { QueryProvider } from '@/lib/query';
import { GlobalErrorBoundary } from '@/providers/GlobalErrorBoundary';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { Button, Text, ThemeModeProvider, ToastProvider, useTheme, useThemeMode } from '@/ui';

// Keep the native splash up until fonts + auth bootstrap settle (see Gate).
// Called at module scope (not awaited, not inside a component) per the
// verified expo-splash-screen pattern.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

/**
 * Last-resort route ErrorBoundary. Must be a NAMED export called
 * `ErrorBoundary` (expo-router convention), never the default. Catches errors
 * from any child route that lacks its own boundary. `retry` re-renders the
 * segment and returns a Promise.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <RootErrorFallback error={error} retry={retry} />
    </SafeAreaProvider>
  );
}

function RootErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.color.bg,
        paddingHorizontal: t.space['3xl'],
        gap: t.space.md,
      }}
    >
      <Text variant="headline" weight="semibold" style={{ textAlign: 'center' }}>
        문제가 발생했어요
      </Text>
      <Text variant="body" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
        화면을 그리는 중 오류가 났어요. 다시 시도하면 대부분 해결돼요.
      </Text>
      {__DEV__ ? (
        <Text variant="caption" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
          {error.message}
        </Text>
      ) : null}
      <View style={{ marginTop: t.space.md }}>
        <Button label="다시 시도" variant="secondary" onPress={() => void retry()} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    // GestureHandlerRootView is the TRUE root — outside GlobalErrorBoundary so
    // even the error fallback (and any gesture-back/modal) receives gestures.
    // flex:1 is required or the gesture area has zero height.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GlobalErrorBoundary>
        <SafeAreaProvider>
          <NetworkProvider>
            <QueryProvider>
              <ToastProvider>
                <AuthProvider>
                  {/* ThemeModeProvider sits UNDER AuthProvider and ABOVE the
                      Gate: it owns the persisted light/dark/system override and
                      app-wide default StatusBar. The Gate reads
                      useThemeMode().hasLoaded so first paint already has the
                      stored scheme. The root ErrorBoundary renders OUTSIDE this
                      provider; useTheme() there falls back to the OS scheme via
                      the non-throwing optional accessor. */}
                  <ThemeModeProvider>
                    {/* Gate is mounted UNDER AuthProvider + ThemeModeProvider so
                        it can read useAuth().status and useThemeMode().hasLoaded
                        alongside useFonts() (contract). */}
                    <Gate />
                  </ThemeModeProvider>
                </AuthProvider>
              </ToastProvider>
            </QueryProvider>
          </NetworkProvider>
        </SafeAreaProvider>
      </GlobalErrorBoundary>
    </GestureHandlerRootView>
  );
}

/**
 * Splash/font/auth/theme gate + the protected navigation tree.
 *
 * `ready = (fontsLoaded || fontError) && status !== 'loading' && themeReady`.
 * Returning null (not a spinner) keeps the native splash as the only thing on
 * screen — rendering anything dismisses it. We gate on:
 *   - `fontError` so a missing/failed font never deadlocks the splash;
 *   - `status !== 'loading'` so Stack.Protected has a SETTLED auth guard before
 *     first paint (no auth-stack flash);
 *   - `hasLoaded` (theme-mode hydration) so the persisted light/dark scheme is
 *     applied on the very first frame — no light→dark flash. ThemeModeProvider
 *     ALWAYS resolves hasLoaded (even on AsyncStorage failure), so this can
 *     never deadlock the splash either.
 */
function Gate() {
  // NOTE: no Pretendard asset is bundled yet, so we load an empty font map —
  // this resolves immediately ([true, null]) and exercises the same gate path.
  // Drop the .ttf into assets and add it here when available; the gate already
  // tolerates fontError so a missing file can never deadlock the splash.
  const [fontsLoaded, fontError] = useFonts({});
  const { status } = useAuth();
  const { hasLoaded: themeReady } = useThemeMode();
  // Reduced-motion is read once here and baked into the navigator options: the
  // native stack can't consult a JS signal mid-transition, so the boolean must
  // be in the options at build time (see lib/navigation/transitions).
  const reducedMotion = useReducedMotion();

  const ready =
    (fontsLoaded || !!fontError) && status !== 'loading' && themeReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null; // splash stays visible — no auth/stack/theme flash

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          // Consistent, reduced-motion-aware horizontal push + gesture-back for
          // every chrome route (the gesture relies on the root GHRootView).
          ...chromeStackScreenOptions(reducedMotion),
        }}
      >
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'unauthenticated'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
      <OfflineBanner />
    </>
  );
}
