/**
 * FollowRow — 서재 '팔로우' 세그의 사용자 행 (아바타 + 닉네임).
 * 탭 → 공개 프로필 허브(/users/[id], CH1). 작품 모아보기는 프로필 안에서 진입.
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
      accessibilityLabel={`${nickname} 프로필 보기`}
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
        프로필 ›
      </Text>
    </Pressable>
  );
}
