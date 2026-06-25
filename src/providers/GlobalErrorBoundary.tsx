/**
 * GlobalErrorBoundary — the LAST-RESORT crash catcher.
 *
 * Sits at the very OUTSIDE of the provider tree (above SafeAreaProvider /
 * QueryProvider / ThemeProvider in src/app/_layout.tsx), so it catches render
 * crashes that happen *before or inside* those providers — the place
 * expo-router's per-route <ErrorBoundary> can't reach. For per-feature /
 * per-route recovery use components/feedback/FeatureErrorBoundary instead;
 * this one is the bottom of the net.
 *
 * Because it renders ABOVE SafeAreaProvider, the fallback deliberately does
 * NOT use the Screen primitive (which needs SafeAreaProvider). It uses a
 * plain View + the theme tokens, which resolve per-render with no context.
 *
 * Recovery: reload the JS bundle. expo-updates (production OTA) gives a real
 * reload; in dev we fall back to DevSettings.reload(); otherwise the button
 * just resets boundary state as a best-effort retry.
 */
import { Component, type ReactNode } from 'react';
import { DevSettings, View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Logging hook — wire to Sentry/Crashlytics here later. For now,
    // console.error keeps the crash visible in dev + native logs.
    console.error('[GlobalErrorBoundary] uncaught render error', error, info?.componentStack);
  }

  private handleReload = () => {
    // 1) Try a real bundle reload via expo-updates if it's installed.
    //    Resolved lazily so the app doesn't hard-depend on the module.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Updates = require('expo-updates') as { reloadAsync?: () => Promise<void> };
      if (typeof Updates?.reloadAsync === 'function') {
        Updates.reloadAsync().catch(() => this.reset());
        return;
      }
    } catch {
      // expo-updates not installed — fall through.
    }

    // 2) Dev: reload the JS bundle through the dev menu bridge.
    if (__DEV__ && typeof DevSettings?.reload === 'function') {
      DevSettings.reload('GlobalErrorBoundary recovery');
      return;
    }

    // 3) Best-effort: clear the boundary so React re-renders the subtree.
    this.reset();
  };

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <FatalFallback error={this.state.error} onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}

function FatalFallback({ error, onReload }: { error: Error; onReload: () => void }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        backgroundColor: t.color.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: t.space['3xl'],
        gap: t.space.md,
      }}
    >
      <Text variant="title" weight="bold" style={{ textAlign: 'center' }}>
        앱에 문제가 생겼어요
      </Text>
      <Text variant="body" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
        예상치 못한 오류로 화면을 표시할 수 없어요. 앱을 다시 시작하면 대부분 해결돼요.
      </Text>
      {__DEV__ ? (
        <Text variant="caption" color="onSurfaceMuted" style={{ textAlign: 'center' }}>
          {error.message}
        </Text>
      ) : null}
      <View style={{ marginTop: t.space.md }}>
        <Button label="앱 다시 시작" onPress={onReload} variant="primary" />
      </View>
    </View>
  );
}
