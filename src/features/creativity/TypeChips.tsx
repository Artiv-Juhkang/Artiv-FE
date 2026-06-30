/**
 * TypeChips — 창작 탭 상단 매체 타입 칩(가로 스크롤).
 *
 * GET /api/creativity/types 레지스트리로 동적 렌더(타입=데이터): 백엔드에 ContentType 값을
 * 추가하면 칩이 자동 등장한다(프론트 코드 변경 0). 활성 칩은 매체색(mediaColor)으로 틱·라벨을
 * 칠해 매체를 신호한다 — 로고 아래 헤어라인·Placard와 같은 색 언어.
 */
import { Pressable, ScrollView, View } from 'react-native';

import { Text, useTheme } from '@/ui';
import { mediaColor } from '@/ui/tokens';

import { useContentTypes } from './hooks';

export type TypeChipsProps = {
  /** 선택된 ContentType 키(예: 'WEBTOON'). */
  value: string;
  onChange: (key: string) => void;
};

export function TypeChips({ value, onChange }: TypeChipsProps) {
  const t = useTheme();
  const { data: types } = useContentTypes();
  if (!types || types.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: t.space.sm,
        paddingHorizontal: t.space.lg,
        paddingVertical: t.space.sm,
      }}
    >
      {types.map((ct) => {
        const active = ct.key === value;
        const mc = mediaColor(ct.key.toLowerCase());
        return (
          <Pressable
            key={ct.key}
            onPress={() => onChange(ct.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: t.space.md,
              paddingVertical: t.space.sm,
              borderRadius: t.radius.pill,
              borderWidth: 1,
              borderColor: active ? mc : t.color.border,
              backgroundColor: active ? `${mc}22` : t.color.surface,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: active ? mc : t.color.onSurfaceMuted,
              }}
            />
            <Text
              variant="caption"
              weight={active ? 'bold' : 'medium'}
              style={{ color: active ? mc : t.color.onSurfaceSecondary }}
            >
              {ct.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
