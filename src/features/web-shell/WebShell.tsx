/**
 * WebShell — the desktop-web chrome frame (web-only). Wraps the SHARED (app)
 * <Stack> so every authenticated screen renders unchanged inside it; only the
 * surrounding chrome is web-specific. Two modes, chosen by the active route:
 *
 *   - 'shell'  (browse: 창작물/커뮤니티/채팅/서재, 서재, series detail, search,
 *              notifications, author) → fixed LeftRail beside the content.
 *   - 'bare'   (immersive: the episode VIEWER and the creator STUDIO) → full
 *              window, no rail — "viewer/studio are modes, not destinations."
 *
 * The rail is opaque; the content region stays transparent so the persistent
 * ambient aurora (AmbientProvider, one level up) shows through browse screens.
 */
import type { ReactNode } from 'react';
import { useSegments } from 'expo-router';
import { View } from 'react-native';

import { LeftRail } from './LeftRail';

/** Routes that take over the whole window (no rail). */
function isBareRoute(segments: string[]): boolean {
  // Creator studio is its own workspace mode; the viewer is immersive reading.
  if (segments.includes('studio')) return true;
  if (segments.includes('[episodeNo]')) return true; // series/[id]/[episodeNo]
  return false;
}

export function WebShell({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const bare = isBareRoute(segments as string[]);

  if (bare) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <LeftRail />
      {/* minWidth:0 lets the content column shrink instead of overflowing the row. */}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}
