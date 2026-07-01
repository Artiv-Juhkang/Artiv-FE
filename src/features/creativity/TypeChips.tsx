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

  // '전체'(ALL) 칩을 맨 앞에 붙인다 — 기본 진입점(매체별 레일 미리보기).
  // 활성 'ALL'은 mediaColor('all')→인디고 fallback이라 매체색 언어와 자연스럽게 어울린다.
  const chips: { key: string; label: string }[] = [
    { key: 'ALL', label: '전체' },
    ...types.map((ct) => ({ key: ct.key, label: ct.label })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // RN's ScrollView base style ships BOTH flexGrow:1 and flexShrink:1, and in
      // the home's flex column the chip band must do neither. flexGrow:1 would
      // balloon it into giant pills when the grid below is short/empty;
      // flexShrink:1 would squeeze it BELOW its content height when the grid is
      // tall enough to overflow the column — and with alignItems:'center' that
      // clips the labels top & bottom ('웹툰'→'웨트', the 받침 cut). Pin both to 0
      // so the band is always exactly its intrinsic content height. (WeekdayTabs
      // sidesteps this by wrapping its ScrollView in a plain View, flexShrink:0.)
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        gap: t.space.sm,
        paddingHorizontal: t.space.lg,
        paddingVertical: t.space.sm,
        // Center on one baseline so active/inactive chips share a height
        // (without this the default 'stretch' makes them inconsistent).
        alignItems: 'center',
      }}
    >
      {chips.map((ct) => {
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
              // caption's lineHeight (16 for 12px) is too tight for bold Hangul —
              // iOS clips the 받침 ('웹툰'→'웨트'). Give the chip label headroom
              // locally (≈1.5 ratio) without touching the global caption token.
              style={{ color: active ? mc : t.color.onSurfaceSecondary, lineHeight: 18 }}
            >
              {ct.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
