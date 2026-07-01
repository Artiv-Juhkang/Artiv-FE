/**
 * (app) group shell — the AUTHENTICATED area. Holds (tabs), the series detail
 * (`series/[id]`), the multimedia viewer (`series/[id]/[episodeNo]`), 작가 스튜디오
 * (`studio/*`) and 작가 전환 신청(`creator-request`). The root Stack.Protected
 * guard={status === 'authenticated'} already gates this whole group.
 *
 * `series/[id]` is registered as a SIBLING of `(tabs)` so it is push-navigated
 * as a full screen OVER the tab bar (immersive art-led hero + back). We keep
 * `headerShown: false`: the detail is an art-driven full-bleed hero and the
 * custom <Screen> already owns the top safe-area inset, so a native (large-
 * title) header would both fight the art and double-pad the top. The hero
 * carries its own back affordance. The viewer route is a follow-up; its
 * Stack.Screen is seeded as a comment so this file stays the single owner of
 * the (app) Stack wiring without claiming an unimplemented screen.
 */
import { Stack } from 'expo-router';

import { AmbientProvider } from '@/ui';

export default function AppGroupLayout() {
  return (
    // §12.3 영속 ambient — CoverWall 루트 레이어를 이 그룹 전체 뒤에 깔고 Stack은
    // contentStyle 투명으로 올린다 → 페이지 이동에도 배경이 안 사라지고 화면만 전환.
    // surface="ambient" 화면만 배경을 드러내고, 그 외(chrome)는 위에 불투명하게 덮는다.
    <AmbientProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="series/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="series/[id]/[episodeNo]" options={{ headerShown: false }} />
        <Stack.Screen name="series/[id]/[episodeNo]/comments" options={{ headerShown: false }} />
        {/* 작가 작품 모아보기 — 창작물 상세의 작가 이름 탭으로 진입. */}
        <Stack.Screen name="authors/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        {/* 작가 스튜디오(작품 생성·회차 업로드) + 작가 전환 신청 — my 탭에서 진입. */}
        <Stack.Screen name="studio/index" options={{ headerShown: false }} />
        <Stack.Screen name="studio/new" options={{ headerShown: false }} />
        <Stack.Screen name="studio/[id]/upload" options={{ headerShown: false }} />
        <Stack.Screen name="creator-request" options={{ headerShown: false }} />
      </Stack>
    </AmbientProvider>
  );
}
