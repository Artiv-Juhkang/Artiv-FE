/**
 * WebShell — the desktop-web chrome frame (web-only). Wraps the SHARED (app)
 * <Stack> so every authenticated screen renders unchanged inside it; only the
 * surrounding chrome is web-specific. Two modes, chosen by the active route:
 *
 *   - 'shell'  (browse: 창작물/커뮤니티/채팅/서재, 서재, series detail, search,
 *              notifications, author) → 넓은 창은 좌측 레일, 좁은 창은 하단 CompactNav.
 *   - 'bare'   (immersive: the episode VIEWER and the creator STUDIO) → full
 *              window, no rail — "viewer/studio are modes, not destinations."
 *
 * The rail is opaque; the content region stays transparent so the persistent
 * ambient aurora (AmbientProvider, one level up) shows through browse screens.
 */
import type { ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';

import { CompactNav } from './CompactNav';
import { LeftRail, RAIL_WIDTH } from './LeftRail';
import { ContentWidthProvider } from '@/ui';

/** Routes that take over the whole window (no rail). */
function isBareRoute(segments: string[]): boolean {
  // Creator studio is its own workspace mode; the viewer is immersive reading.
  if (segments.includes('studio')) return true;
  if (segments.includes('[episodeNo]')) return true; // series/[id]/[episodeNo]
  return false;
}

/**
 * 레일을 띄울 최소 창 폭. 이 아래에서는 레일이 콘텐츠보다 넓어져 배보다 배꼽이 커진다
 * (390px 창이면 레일이 62%를 먹는다). 판정은 '창' 폭으로 한다 — 콘텐츠 폭은 레일 여부에
 * 따라 정해지므로 그걸로 판정하면 순환이다.
 */
const RAIL_MIN_WINDOW_WIDTH = 600;

export function WebShell({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const bare = isBareRoute(segments as string[]);
  const { width } = useWindowDimensions();

  if (bare) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  if (width < RAIL_MIN_WINDOW_WIDTH) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        <CompactNav />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <LeftRail />
      {/* minWidth:0 lets the content column shrink instead of overflowing the row. */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* 레일이 떼어 간 만큼을 빼고 알려야 브레이크포인트·컬럼·캡이 실제 폭에 맞는다. */}
        <ContentWidthProvider width={width - RAIL_WIDTH}>{children}</ContentWidthProvider>
      </View>
    </View>
  );
}
