/**
 * 채팅 탭 — 인박스(대화)와 요청함 (CH3).
 *
 * 대화: ACCEPTED + 내가 보낸 대기 중 요청. 행 = 아바타·상대 이름·마지막 말 한 줄·시각·미읽음 pill.
 * 요청: 받은 PENDING — 수락하면 대화로, 거절은 조용히 사라진다(상대에게 알리지 않음).
 * 폴링 30s — useIsFocused()로 이 탭이 실제로 보일 때만(다른 탭으로 이동하면 정지, 리뷰로
 * 발견된 갭 수정: expo-router 탭은 blur돼도 언마운트하지 않는다).
 * `?tab=requests`로 진입하면 요청함이 기본 세그(DM_REQUEST 알림 탭 시 사용).
 */
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useIsFocused, useLocalSearchParams } from 'expo-router';

import { resolveImageUrl } from '@/api/image';
import type { ConversationSummary } from '@/api/types';
import { relativeTime } from '@/features/comments';
import {
  useConversationRequests,
  useConversations,
  useRespondToRequest,
} from '@/features/chat/hooks';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  HeaderIconButton,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from '@/ui';

type ChatTab = 'inbox' | 'requests';

export default function ChatScreen() {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const isFocused = useIsFocused();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<ChatTab>(initialTab === 'requests' ? 'requests' : 'inbox');
  const requests = useConversationRequests(isFocused);
  const requestCount = requests.data?.length ?? 0;

  return (
    <Screen
      surface="ambient"
      header={{
        variant: 'ambient',
        back: false,
        title: '채팅',
        right: (
          <HeaderIconButton
            name="person.2.badge.plus"
            fallback="＋"
            accessibilityLabel="단체방 만들기"
            onPress={() => nav.push({ pathname: '/chat/new' })}
          />
        ),
      }}
    >
      <View style={{ flex: 1 }}>
        {/* 세그 — 요청함에 대기 건수가 있으면 라벨에 조용히 표기. */}
        <View style={{ flexDirection: 'row', gap: t.space.sm, paddingVertical: t.space.sm }}>
          {([
            ['inbox', '대화'],
            ['requests', requestCount > 0 ? `요청 ${requestCount}` : '요청'],
          ] as const).map(([key, label]) => {
            const on = tab === key;
            return (
              <Text
                key={key}
                variant="label"
                weight={on ? 'bold' : 'medium'}
                onPress={() => setTab(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  color: on ? t.color.accent : t.color.onSurfaceSecondary,
                  backgroundColor: on ? t.color.accentSubtle : 'transparent',
                  paddingVertical: t.space.xs,
                  paddingHorizontal: t.space.md,
                  borderRadius: t.radius.pill,
                  overflow: 'hidden',
                }}
              >
                {label}
              </Text>
            );
          })}
        </View>
        {tab === 'inbox' ? <InboxList isFocused={isFocused} /> : <RequestList requests={requests} />}
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

function InboxList({ isFocused }: { isFocused: boolean }) {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const q = useConversations(isFocused);

  if (q.isLoading) return <ChatSkeleton />;
  if (q.isError) return <ErrorState code="UNKNOWN" onRetry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="아직 대화가 없어요"
        description="마음이 닿은 사람의 프로필에서 '메시지'를 눌러 시작해 보세요."
      />
    );
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(c) => String(c.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: t.space.xl }}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      renderItem={({ item }) => (
        <ConversationRow
          conv={item}
          onPress={() =>
            nav.push({
              pathname: '/chat/[id]',
              params: { id: item.id!, name: item.displayName ?? '', type: item.type ?? 'DIRECT' },
            })
          }
        />
      )}
    />
  );
}

function ConversationRow({ conv, onPress }: { conv: ConversationSummary; onPress: () => void }) {
  const t = useTheme();
  const name = conv.displayName ?? '(탈퇴)';
  const waiting = conv.status === 'PENDING'; // 내가 보낸 요청 — 상대 응답 대기
  const unread = conv.unreadCount ?? 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}와의 대화`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        paddingVertical: t.space.md,
      }}
    >
      <Avatar uri={resolveImageUrl(conv.partnerAvatarUrl)} nickname={name} size="md" />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <Text variant="headline" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          <Text variant="micro" color="onSurfaceMuted">
            {relativeTime(conv.lastMessageAt)}
          </Text>
        </View>
        <Text variant="caption" color={unread > 0 ? 'onSurface' : 'onSurfaceMuted'} numberOfLines={1}>
          {waiting ? '수락을 기다리고 있어요' : (conv.lastMessage ?? '대화를 시작해 보세요')}
        </Text>
      </View>
      {unread > 0 ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            paddingHorizontal: 6,
            borderRadius: 10,
            backgroundColor: t.color.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="micro" weight="bold" style={{ color: '#fff' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */

function RequestList({ requests }: { requests: ReturnType<typeof useConversationRequests> }) {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const respond = useRespondToRequest();

  if (requests.isLoading) return <ChatSkeleton />;
  if (requests.isError) return <ErrorState code="UNKNOWN" onRetry={() => void requests.refetch()} />;
  const rows = requests.data ?? [];
  if (rows.length === 0) {
    return <EmptyState title="받은 요청이 없어요" description="새 메시지 요청이 오면 여기에 모여요." />;
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(c) => String(c.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: t.space.xl, gap: t.space.sm }}
      renderItem={({ item }) => {
        const name = item.displayName ?? '(탈퇴)';
        return (
          <View style={{ gap: t.space.sm, paddingVertical: t.space.sm }}>
            <Pressable
              // 이름 영역 탭 → 보낸 사람 프로필에서 확인 후 결정할 수 있게.
              onPress={() =>
                typeof item.partnerId === 'number'
                  ? nav.push({ pathname: '/users/[id]', params: { id: item.partnerId } })
                  : undefined
              }
              accessibilityRole="button"
              accessibilityLabel={`${name} 프로필 보기`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}
            >
              <Avatar uri={resolveImageUrl(item.partnerAvatarUrl)} nickname={name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="headline" weight="semibold" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="caption" color="onSurfaceMuted" numberOfLines={1}>
                  {item.lastMessage ?? '대화를 요청했어요'}
                </Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="수락"
                  size="sm"
                  fullWidth
                  loading={respond.isPending}
                  onPress={() =>
                    respond.mutate(
                      { id: item.id!, accept: true },
                      {
                        onSuccess: () =>
                          nav.push({
                            pathname: '/chat/[id]',
                            params: { id: item.id!, name, type: 'DIRECT' }, // 요청함은 항상 DIRECT(GROUP은 요청 없이 즉시 ACCEPTED)
                          }),
                      },
                    )
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="거절"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  disabled={respond.isPending}
                  onPress={() => respond.mutate({ id: item.id!, accept: false })}
                />
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

function ChatSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.lg, paddingTop: t.space.sm }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: t.space.md, alignItems: 'center' }}>
          <Skeleton width={40} height={40} radius="pill" />
          <View style={{ flex: 1, gap: t.space.xs }}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="70%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
