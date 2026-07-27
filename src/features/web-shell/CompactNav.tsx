/**
 * CompactNav — 좁은 브라우저 창에서 쓰는 하단 내비게이션(웹 전용).
 *
 * 240px 레일은 모바일 브라우저(390px)에서 화면의 60%를 먹어 콘텐츠를 150px로 짓눌렀다.
 * 그렇다고 레일만 숨기면 웹에는 탭바가 없어(=(tabs)/_layout.web.tsx가 bare Slot) 이동
 * 수단이 통째로 사라진다 — 그래서 좁을 때는 이 바가 레일을 대신한다.
 *
 * 레일과 달리 '내 정보'까지 포함한다: 레일에서는 계정 메뉴가 그 역할을 하지만 좁은 화면엔
 * 계정 메뉴를 띄울 자리가 없어, 여기서 빠지면 프로필·설정에 닿을 방법이 사라진다.
 */
import { Link, usePathname, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DESTINATIONS } from './LeftRail';
import { Text, useTheme } from '@/ui';

const MY: { href: Href; label: string; match: (p: string) => boolean } = {
  href: '/my' as Href,
  label: '내 정보',
  match: (p) => p.startsWith('/my'),
};

export function CompactNav() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const items = [...DESTINATIONS, MY];

  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: t.color.border,
        backgroundColor: t.color.surface,
        paddingBottom: insets.bottom,
      }}
    >
      {items.map((d) => {
        const active = d.match(pathname);
        return (
          <Link key={d.label} href={d.href} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                minHeight: t.layout.minHitTarget,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: t.space.sm,
                cursor: 'pointer',
              } as object}
            >
              <Text
                variant="caption"
                weight={active ? 'semibold' : 'regular'}
                style={{ color: active ? t.color.accent : t.color.onSurfaceSecondary }}
              >
                {d.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
