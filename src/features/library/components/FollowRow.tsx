/**
 * FollowRow — 서재 '팔로우' 세그의 사용자 행 (아바타 + 닉네임).
 * 탭 → 작가 작품 모아보기(/authors/[id] — 기존 라우트 재사용).
 * CH1(공개 프로필 /users/[id]) 도착 시 목적지를 프로필 허브로 교체한다(§5 크로스컷).
 */
import { Pressable, View } from 'react-native';

import { resolveImageUrl } from '@/api/image';
import type { FollowUserResponse } from '@/api/types';
import { Avatar, Text, useTheme } from '@/ui';

export function FollowRow({ user, onPress }: { user: FollowUserResponse; onPress: () => void }) {
  const t = useTheme();
  const nickname = user.nickname ?? '알 수 없는 사용자';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nickname} 작품 보기`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.sm,
      }}
    >
      <Avatar uri={resolveImageUrl(user.avatarUrl)} nickname={nickname} size="md" />
      <View style={{ flex: 1 }}>
        <Text variant="headline" weight="semibold" numberOfLines={1}>
          {nickname}
        </Text>
      </View>
      <Text variant="caption" color="onSurfaceMuted">
        작품 보기 ›
      </Text>
    </Pressable>
  );
}
