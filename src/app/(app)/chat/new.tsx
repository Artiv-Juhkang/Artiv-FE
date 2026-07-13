/**
 * 단체방 만들기 (CH4) — 친구(상호 팔로우) 체크리스트 + 제목.
 * 초대 후보는 GET /api/users/me/friends로 이미 한정돼 있어(비친구는 목록에 없음) 화면에서
 * 별도 검증 UI가 필요 없다 — 그냥 고르면 서버 규칙(친구 전원·2명 이상)을 자연히 만족한다.
 * 친구가 아예 없으면 만들 수 없다는 걸 빈 상태로 먼저 알린다(체크박스 없는 빈 화면 대신).
 */
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { resolveImageUrl } from '@/api/image';
import type { FollowUserResponse } from '@/api/types';
import { useCreateGroup, useFriends } from '@/features/chat/hooks';
import { Field } from '@/features/studio/components';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  Text,
  useTheme,
  useToast,
} from '@/ui';

const MIN_MEMBERS = 2; // 서버 규칙과 동일 — 친구 2명 이상(본인 포함 3인 이상)부터 '단체'.

export default function NewGroupChatScreen() {
  const t = useTheme();
  const toast = useToast();
  const nav = useGuardedNavigation();
  const friends = useFriends();
  const createGroup = useCreateGroup();

  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [anonymous, setAnonymous] = useState(false);

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const canSubmit = title.trim().length > 0 && selected.size >= MIN_MEMBERS && !createGroup.isPending;

  const onSubmit = () => {
    if (!canSubmit) return;
    createGroup.mutate(
      { title: title.trim(), memberIds: Array.from(selected), anonymous },
      {
        onSuccess: (conv) => {
          nav.replace({ pathname: '/chat/[id]', params: { id: conv.id!, name: title.trim(), type: 'GROUP' } });
        },
        onError: () =>
          toast.show({ tone: 'danger', message: '단체방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' }),
      },
    );
  };

  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: '단체방 만들기' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.md }}>
        <Field label="방 이름" value={title} onChangeText={setTitle} placeholder="예: 웹툰 덕질방" />

        {/* 익명 모드(CH5) — 메시지 발신자 표기가 '익명1/익명2…'로 마스킹된다. 서버는 실제
            발신자를 알고 있어 신고 시 식별 가능(신고·어드민 대응 여지 유지). */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: t.layout.minHitTarget,
          }}
        >
          <View style={{ flex: 1, paddingRight: t.space.md }}>
            <Text variant="body">익명 모드</Text>
            <Text variant="caption" color="onSurfaceMuted">
              켜면 메시지에 실명 대신 '익명1'처럼 표시돼요.
            </Text>
          </View>
          <Switch value={anonymous} onValueChange={setAnonymous} accessibilityLabel="익명 모드" />
        </View>

        <View style={{ gap: t.space.sm }}>
          <Text variant="label" color="onSurfaceSecondary">
            친구 초대 ({selected.size}명 선택 — 최소 {MIN_MEMBERS}명)
          </Text>

          {friends.isLoading ? (
            <FriendListSkeleton />
          ) : friends.isError ? (
            <ErrorState code="UNKNOWN" onRetry={() => void friends.refetch()} />
          ) : (friends.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="아직 친구가 없어요"
              description="서로 팔로우하는 사이가 되면 여기서 단체방에 초대할 수 있어요."
            />
          ) : (
            <View style={{ gap: t.space.xs }}>
              {friends.data!.map((f) => (
                <FriendRow key={f.userId} friend={f} checked={selected.has(f.userId!)} onToggle={toggle} />
              ))}
            </View>
          )}
        </View>

        <Button label="만들기" variant="primary" fullWidth loading={createGroup.isPending} disabled={!canSubmit} onPress={onSubmit} />
      </View>
    </Screen>
  );
}

function FriendRow({
  friend,
  checked,
  onToggle,
}: {
  friend: FollowUserResponse;
  checked: boolean;
  onToggle: (userId: number) => void;
}) {
  const t = useTheme();
  const nickname = friend.nickname ?? '알 수 없는 사용자';
  return (
    <Pressable
      onPress={() => onToggle(friend.userId!)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${nickname} 초대`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.sm,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.md,
        backgroundColor: checked ? t.color.accentSubtle : 'transparent',
      }}
    >
      <Avatar uri={resolveImageUrl(friend.avatarUrl)} nickname={nickname} size="sm" />
      <Text variant="body" weight={checked ? 'semibold' : 'regular'} style={{ flex: 1 }} numberOfLines={1}>
        {nickname}
      </Text>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: t.radius.pill,
          borderWidth: checked ? 0 : 1.5,
          borderColor: t.color.border,
          backgroundColor: checked ? t.color.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Text variant="micro" weight="bold" style={{ color: '#fff' }}>
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function FriendListSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.md }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: t.space.md, alignItems: 'center' }}>
          <Skeleton width={32} height={32} radius="pill" />
          <Skeleton width="50%" height={14} />
        </View>
      ))}
    </View>
  );
}
