/**
 * +not-found — catch-all for URLs / deep links that match no route
 * (scheme artiv://). This is distinct from a code-level ENTITY_NOT_FOUND
 * (a real resource that 404'd) — this is a BAD path. We show the not-found
 * ErrorState plus a single CTA back to a safe place: home if signed in,
 * sign-in otherwise. router.replace (not push) so Back doesn't return here.
 */
import { type Href, router, Stack } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '@/features/auth';
import { Button, Screen, Text, useTheme } from '@/ui';

export default function NotFoundScreen() {
  const t = useTheme();
  const { status } = useAuth();

  const goHome = () => {
    // Let the route resolve against the active stack; replace avoids leaving a
    // dangling not-found entry in the back stack. The destinations ('/' tabs
    // home, '/sign-in') are real routes; the cast bridges the gap until
    // typedRoutes regenerates expo-env.d.ts (it's empty before the dev server
    // first runs, and the leftover template routes are cleaned up).
    const href = (status === 'authenticated' ? '/' : '/sign-in') as Href;
    router.replace(href);
  };

  return (
    <>
      {/* Native header stays OFF — our custom solid header (below) owns the top
          region. onBack=goHome overrides guardedBack so the ‹ is NEVER dead on a
          deep-link first entry (canGoBack=false): it always escapes to a safe
          route (home if signed in, sign-in otherwise). The in-body CTA below is
          the primary recovery; the header ‹ is the secondary, always-live one. */}
      <Stack.Screen options={{ title: '페이지를 찾을 수 없어요', headerShown: false }} />
      <Screen
        header={{
          variant: 'solid',
          back: true,
          onBack: goHome,
          title: '페이지를 찾을 수 없어요',
        }}
      >
        <View
          accessibilityRole="alert"
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.space.md,
          }}
        >
          <Text variant="display" style={{ textAlign: 'center' }}>
            페이지를 찾을 수 없어요
          </Text>
          <Text variant="body" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
            주소가 잘못되었거나 삭제된 화면이에요. 홈으로 돌아가 다시 시도해 주세요.
          </Text>
          <View style={{ marginTop: t.space.md }}>
            <Button
              label={status === 'authenticated' ? '홈으로 가기' : '로그인하러 가기'}
              onPress={goHome}
            />
          </View>
        </View>
      </Screen>
    </>
  );
}
