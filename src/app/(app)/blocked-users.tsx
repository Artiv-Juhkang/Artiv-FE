/**
 * 차단 목록 (CB) — 내가 차단한 사용자 관리. my 탭 계정 섹션에서 진입.
 */
import { FlatList, View } from 'react-native';

import { resolveImageUrl } from '@/api/image';
import type { BlockedUserResponse } from '@/api/types';
import { useBlockToggle, useMyBlocks } from '@/features/users/hooks';
import { Avatar, Button, EmptyState, ErrorState, Screen, Skeleton, Text, useTheme } from '@/ui';

export default function BlockedUsersScreen() {
  const t = useTheme();
  const blocks = useMyBlocks();
  const blockMut = useBlockToggle();

  return (
    <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '차단 목록' }}>
      {blocks.isLoading ? (
        <View style={{ gap: t.space.lg, paddingTop: t.space.sm }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: t.space.md, alignItems: 'center' }}>
              <Skeleton width={40} height={40} radius="pill" />
              <Skeleton width="40%" height={16} />
            </View>
          ))}
        </View>
      ) : blocks.isError ? (
        <ErrorState code="UNKNOWN" onRetry={() => void blocks.refetch()} />
      ) : (blocks.data?.length ?? 0) === 0 ? (
        <EmptyState title="차단한 사용자가 없어요" description="차단하면 서로 메시지를 주고받을 수 없어요." />
      ) : (
        <FlatList
          data={blocks.data!}
          keyExtractor={(b) => String(b.userId)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: t.space.xl, gap: t.space.sm }}
          renderItem={({ item }) => <BlockedRow user={item} onUnblock={() => blockMut.mutate({ userId: item.userId!, on: false })} />}
        />
      )}
    </Screen>
  );
}

function BlockedRow({ user, onUnblock }: { user: BlockedUserResponse; onUnblock: () => void }) {
  const t = useTheme();
  const nickname = user.nickname ?? '사용자';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.sm,
      }}
    >
      <Avatar uri={resolveImageUrl(user.avatarUrl)} nickname={nickname} size="md" />
      <Text variant="body" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
        {nickname}
      </Text>
      <Button label="차단 해제" variant="secondary" size="sm" onPress={onUnblock} />
    </View>
  );
}
