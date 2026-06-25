/**
 * Episode viewer — FUTURE STUB (pushed chrome screen).
 * ------------------------------------------------------------------
 * The immersive vertical-scroll reader (true-black Screen, episode images,
 * locked-episode countdown, comments/like) is a later phase. This placeholder
 * exists so the 첫화 보기 / 이어보기 CTAs and unlocked episode-row taps land on a
 * clean screen instead of +not-found, and so typedRoutes accepts the
 * /series/[id]/[episodeNo] href used across the detail screen. Replace this file
 * with the real viewer when that phase lands — the route shape stays the same.
 *
 * HEADER SEAM: as a STUB this is a normal pushed chrome screen, so it wears the
 * standard solid header (‹ back + 'N화' title). When the real immersive reader
 * lands it will flip to `variant:'hidden'` (true-black, edge-to-edge art) and a
 * modal presentation — the route shape and back convention stay the same.
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { guardedBack } from '@/lib/navigation/useGuardedNavigation';
import { Button, Screen, Text, useTheme } from '@/ui';

export default function EpisodeViewerScreen() {
  const t = useTheme();
  const { episodeNo } = useLocalSearchParams<{ id: string; episodeNo: string }>();

  // episodeNo arrives as a route string; show 'N화' only for a real number so a
  // missing/garbage param never renders 'undefined화'.
  const epNum = Number(episodeNo);
  const title = episodeNo && Number.isFinite(epNum) ? `${epNum}화` : '회차';

  return (
    <Screen center header={{ variant: 'solid', back: true, title }}>
      <View style={{ gap: t.space.lg, alignItems: 'center' }}>
        <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
          {title}
        </Text>
        <Text variant="display" weight="bold" style={{ textAlign: 'center' }}>
          회차 뷰어는 곧 제공돼요
        </Text>
        <Text variant="body" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
          세로 스크롤 뷰어를 준비하고 있어요. 지금은 작품과 회차 목록을 둘러볼 수 있어요.
        </Text>
        <View style={{ marginTop: t.space.sm }}>
          {/* guardedBack = canGoBack guard + module-level double-back gate. */}
          <Button label="목록으로 돌아가기" variant="secondary" onPress={() => guardedBack()} />
        </View>
      </View>
    </Screen>
  );
}
