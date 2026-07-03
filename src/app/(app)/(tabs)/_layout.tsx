/**
 * Tabs layout. Five tabs — 창작물 (요일별 그리드) · 커뮤니티 (플레이스홀더) · 채팅
 * (플레이스홀더) · 서재 (관심/열람) · 내 정보 (프로필 + 테마 + 로그아웃). Colors come from
 * the design tokens via useTheme so the bar matches the chrome surface in both
 * light and dark.
 *
 * Glass Stack / 체계 틀 additions (integration module owns these):
 *   - tabsScreenOptions(reduced) is spread onto screenOptions for a consistent
 *     cross-fade tab transition that collapses to 'none' under reduced motion.
 *   - The tab bar carries the BOTTOM safe-area inset (useSafeAreaInsets) in its
 *     paddingBottom + height. On SDK 56 Android edge-to-edge the tab bar would
 *     otherwise draw BEHIND the gesture/3-button OS navigation bar, swallowing
 *     the tab targets. We floor it at 0 extra on devices with no bottom inset so
 *     the default bar height is preserved. iOS home-indicator gets the same
 *     treatment for free.
 */
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabsScreenOptions } from '@/lib/navigation/transitions';
import { Text, useTheme } from '@/ui';

// Base tab-bar height (content area, above the safe-area inset). The OS nav-bar
// inset is ADDED to this so the bar's tappable row always clears the system bar.
const TAB_BAR_BASE_HEIGHT = 56;

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  return (
    <Tabs
      screenOptions={{
        // Animation subset (cross-fade / none) — reduced-motion aware.
        ...tabsScreenOptions(reducedMotion),
        headerShown: false,
        // §12.3: transparent scene container so a surface="ambient" tab (the
        // home) reveals the persistent CoverWall backdrop owned by (app)/_layout.
        // Opaque tabs (surface="chrome") still paint over it — no change there.
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: t.color.accent,
        tabBarInactiveTintColor: t.color.onSurfaceSecondary,
        tabBarStyle: {
          backgroundColor: t.color.surface,
          borderTopColor: t.color.border,
          // Lift the bar above the Android OS navigation bar / iOS home
          // indicator. Without this the tappable row sits UNDER the system bar
          // in SDK 56 edge-to-edge. Math.max keeps the default look on devices
          // that report a zero bottom inset.
          paddingBottom: insets.bottom,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
        },
        // Korean tab labels via the typographic primitive for Hangul-safe metrics.
        tabBarLabel: undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '창작물',
          tabBarLabel: ({ color }) => (
            <Text variant="micro" weight="medium" style={{ color }}>
              창작물
            </Text>
          ),
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="square.grid.2x2.fill" size={size ?? 24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          tabBarLabel: ({ color }) => (
            <Text variant="micro" weight="medium" style={{ color }}>
              커뮤니티
            </Text>
          ),
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="bubble.left.and.bubble.right.fill" size={size ?? 24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '채팅',
          tabBarLabel: ({ color }) => (
            <Text variant="micro" weight="medium" style={{ color }}>
              채팅
            </Text>
          ),
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="paperplane.fill" size={size ?? 24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: '서재',
          tabBarLabel: ({ color }) => (
            <Text variant="micro" weight="medium" style={{ color }}>
              서재
            </Text>
          ),
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="books.vertical.fill" size={size ?? 24} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: '내 정보',
          tabBarLabel: ({ color }) => (
            <Text variant="micro" weight="medium" style={{ color }}>
              내 정보
            </Text>
          ),
          tabBarIcon: ({ color, size }) => (
            <SymbolView name="person.crop.circle.fill" size={size ?? 24} tintColor={color} />
          ),
        }}
      />
    </Tabs>
  );
}
