/**
 * LeftRail — the desktop-web primary navigation (web-only; the mobile app keeps
 * its bottom <Tabs>). A fixed rail that replaces the phone tab bar with the four
 * browse DESTINATIONS, a creator-only Studio entry, and — at the bottom, where a
 * desktop user reaches for their account — the avatar with a theme + logout menu.
 * The mobile 내정보 tab dissolves into this account block.
 *
 * Presentation only: it drives navigation via expo-router <Link>, reads
 * useAuth()/useTheme() from the shared stack, and paints with the existing
 * Inkwell & Ember tokens. It is opaque (color.surface) so it sits cleanly over
 * the persistent ambient aurora that fills the content region.
 */
import { useState } from 'react';
import { Link, usePathname, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { resolveImageUrl } from '@/api/image';
import { useAuth, isCreator } from '@/features/auth';
import { ThemeModeToggle } from '@/features/settings/ThemeModeToggle';
import { Avatar, Text, useTheme } from '@/ui';

export const RAIL_WIDTH = 240;

type Dest = { href: Href; label: string; match: (path: string) => boolean };

const DESTINATIONS: Dest[] = [
  { href: '/' as Href, label: '창작물', match: (p) => p === '/' },
  { href: '/community' as Href, label: '커뮤니티', match: (p) => p.startsWith('/community') },
  { href: '/chat' as Href, label: '채팅', match: (p) => p.startsWith('/chat') },
  { href: '/library' as Href, label: '서재', match: (p) => p.startsWith('/library') },
];

function NavItem({ label, href, active }: { label: string; href: Href; active: boolean }) {
  const t = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        style={({ hovered }: { hovered?: boolean }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.sm,
            height: 44,
            paddingHorizontal: t.space.md,
            borderRadius: t.radius.md,
            backgroundColor: active
              ? t.color.accentSubtle
              : hovered
                ? t.color.surfaceSunken
                : 'transparent',
          },
          // web cursor affordance
          { cursor: 'pointer' } as object,
        ]}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: active ? t.color.accent : 'transparent',
          }}
        />
        <Text
          variant="callout"
          weight={active ? 'semibold' : 'medium'}
          style={{ color: active ? t.color.accent : t.color.onSurface }}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function LeftRail() {
  const t = useTheme();
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = () => {
    if (typeof window !== 'undefined' && window.confirm('로그아웃할까요?')) {
      void logout();
    }
  };

  const studioActive = pathname.startsWith('/studio');

  return (
    <View
      style={{
        width: RAIL_WIDTH,
        alignSelf: 'stretch',
        backgroundColor: t.color.surface,
        borderRightWidth: 1,
        borderRightColor: t.color.border,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.lg,
        gap: t.space.xs,
      }}
    >
      {/* Wordmark — the nav anchor. */}
      <View style={{ paddingHorizontal: t.space.md, paddingBottom: t.space.md }}>
        <Text variant="title" weight="bold">
          Artiv
        </Text>
      </View>

      {DESTINATIONS.map((d) => (
        <NavItem key={d.label} label={d.label} href={d.href} active={d.match(pathname)} />
      ))}

      {isCreator(role) ? (
        <>
          <View style={{ height: 1, backgroundColor: t.color.border, marginVertical: t.space.sm }} />
          <NavItem label="작가 스튜디오" href={'/studio' as Href} active={studioActive} />
        </>
      ) : null}

      {/* Spacer pushes the account block to the bottom. */}
      <View style={{ flex: 1 }} />

      {/* Account block — where a desktop user reaches for their profile. */}
      {menuOpen ? (
        <View
          style={{
            gap: t.space.sm,
            padding: t.space.md,
            marginBottom: t.space.sm,
            borderRadius: t.radius.lg,
            backgroundColor: t.color.surfaceSunken,
          }}
        >
          <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
            화면 테마
          </Text>
          <ThemeModeToggle />
          <Link href={'/my' as Href} asChild>
            <Pressable style={{ cursor: 'pointer' } as object}>
              <Text variant="callout" style={{ color: t.color.accent }}>
                프로필 전체 보기
              </Text>
            </Pressable>
          </Link>
          <Pressable onPress={onLogout} style={{ cursor: 'pointer' } as object}>
            <Text variant="callout" color="danger">
              로그아웃
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={() => setMenuOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="계정 메뉴"
        style={({ hovered }: { hovered?: boolean }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.sm,
            padding: t.space.sm,
            borderRadius: t.radius.md,
            backgroundColor: hovered ? t.color.surfaceSunken : 'transparent',
          },
          { cursor: 'pointer' } as object,
        ]}
      >
        <Avatar uri={resolveImageUrl(user?.avatarUrl)} nickname={user?.nickname ?? '사용자'} size="sm" />
        <View style={{ flex: 1 }}>
          <Text variant="callout" weight="semibold" numberOfLines={1}>
            {user?.nickname ?? '사용자'}
          </Text>
          <Text variant="caption" color="onSurfaceMuted" numberOfLines={1}>
            {isCreator(role) ? '작가' : '독자'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
