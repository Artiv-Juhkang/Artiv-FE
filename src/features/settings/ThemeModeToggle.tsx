/**
 * ThemeModeToggle — 4-segment 라이트/다크/시스템/추천 모드 선택 컨트롤.
 * ------------------------------------------------------------------
 * 시스템 / 라이트 / 다크 / 추천 중 하나를 고르는 세그먼트 컨트롤. 선택 결과는
 * ThemeModeProvider가 AsyncStorage에 영속하고, 'system'이면 OS 테마를
 * 실시간으로 따라갑니다. '추천'은 맥락 적응(감상=다크, 읽기·쓰기=라이트).
 *
 * 접근성:
 *   - 컨테이너는 accessibilityRole='radiogroup'.
 *   - 각 세그먼트는 role='button' + accessibilityState.selected (RN의
 *     'radio' role 지원이 플랫폼별로 불완전해, 선택 상태를 state로 전달).
 *   - hit target은 t.layout.minHitTarget(44pt) 이상.
 * 선택된 세그먼트: 배경 accent(인디고), 텍스트 onAccent(흰색).
 */
import type React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/ui/primitives/Text';
import { useThemeMode, type ThemeMode } from '@/ui/theme-mode';
import { useTheme } from '@/ui/use-theme';

type Segment = { value: ThemeMode; label: string; a11y: string };

const SEGMENTS: readonly Segment[] = [
  { value: 'system', label: '시스템', a11y: '시스템 설정 따르기' },
  { value: 'light', label: '라이트', a11y: '라이트 모드' },
  { value: 'dark', label: '다크', a11y: '다크 모드' },
  { value: 'recommended', label: '추천', a11y: '추천 모드 — 감상은 다크, 읽기·쓰기는 라이트' },
];

export function ThemeModeToggle(): React.JSX.Element {
  const { mode, setMode } = useThemeMode();
  const t = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="화면 테마 선택"
      style={[
        styles.group,
        {
          backgroundColor: t.color.glassField,
          borderColor: t.color.glassFieldBorder,
          borderRadius: t.radius.md,
          padding: t.space.xs,
          gap: t.space.xs,
        },
      ]}>
      {SEGMENTS.map((segment) => {
        const selected = mode === segment.value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => setMode(segment.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.a11y}
            hitSlop={t.space.xs}
            style={({ pressed }) => [
              styles.segment,
              {
                minHeight: t.layout.minHitTarget,
                borderRadius: t.radius.sm,
                paddingHorizontal: t.space.sm,
                backgroundColor: selected ? t.color.accent : 'transparent',
                opacity: pressed && !selected ? t.opacity.pressed : 1,
              },
            ]}>
            <Text
              variant="label"
              weight={selected ? 'semibold' : 'medium'}
              color={selected ? 'onAccent' : 'onSurfaceSecondary'}
              numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  segment: {
    flex: 1,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ThemeModeToggle;
