/**
 * 대화방 (CH3) — 말풍선 1:1 대화. 폴링 5s(화면에 있을 때만, 전송층은 후일 WebSocket 교체).
 *
 * 디자인: 말풍선이 이 화면의 문법 전부 — 내 말은 accentSubtle(우측), 상대는 surfaceSunken(좌측),
 * 모서리 한 곳만 잘라 방향을 신호(발화의 '꼬리'). 배경은 영속 ambient가 그대로 비친다.
 * inverted FlatList(최신이 바닥) + 공용 ComposeBar. 새 메시지가 보이면 읽음 포인터를 전진.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { readConversation } from '@/api/endpoints/chat';
import type { ChatMessage } from '@/api/types';
import { useAuth } from '@/features/auth';
import { ComposeBar } from '@/features/comments';
import { ROOM_POLL_MS, useMessagesInfinite, useSendMessage } from '@/features/chat/hooks';
import { useQueryClient } from '@tanstack/react-query';

import { isAppError } from '@/lib/errors';
import { flattenInfinite, keys, useInfiniteQuery } from '@/lib/query';
import { EmptyState, ErrorState, Screen, Skeleton, Text, useTheme, useToast } from '@/ui';

export default function ChatRoomScreen() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const conversationId = Number(id);

  const q = useInfiniteQuery({
    ...useMessagesInfinite(conversationId),
    // 활성 대화만 5s — 언마운트 시 정지. 에러가 지속되는 동안(예: FORBIDDEN인 대화,
    // 오프라인)에는 5s마다 실패를 반복하지 않도록 끈다 — 사용자가 화면을 벗어나거나
    // 재진입해야 재시도(react-query 기본 재시도 정책이 그 사이를 담당).
    refetchInterval: (query) => (query.state.error ? false : ROOM_POLL_MS),
  });
  // 최신순(id desc) 페이지를 그대로 inverted 리스트에 — 화면상 최신이 바닥에 앉는다.
  const messages = useMemo(() => flattenInfinite(q.data, (m) => m.id ?? -1), [q.data]);

  const sendMut = useSendMessage(conversationId);
  const [text, setText] = useState('');

  // 읽음 포인터 전진 — 보이는 최신 메시지 id가 바뀔 때마다(본인 발신 포함 무해: 서버가 max 유지).
  const latestId = messages[0]?.id;
  const lastMarked = useRef<number | null>(null);
  useEffect(() => {
    if (typeof latestId !== 'number' || lastMarked.current === latestId) return;
    lastMarked.current = latestId;
    readConversation(conversationId, latestId)
      .then(() => {
        qc.invalidateQueries({ queryKey: keys.conversations.unreadCount() });
        qc.invalidateQueries({ queryKey: keys.conversations.list() });
      })
      .catch(() => {}); // 읽음 실패는 조용히 — 다음 전진에서 재시도된다
  }, [latestId, conversationId, qc]);

  const onSend = () => {
    const body = text.trim();
    if (!body || sendMut.isPending) return;
    sendMut.mutate(body, {
      onSuccess: () => setText(''),
      onError: (e) => {
        const blocked = isAppError(e) && e.code === 'FORBIDDEN';
        // 이 방이 왜 막혔는지(수락 대기중 vs 영구 거절) 서버가 구분해 주지 않는다 — 거절은
        // 조용히 처리되는 게 설계 의도(D-확4)라 "수락하면 보낼 수 있다"처럼 단정하지 않는다.
        toast.show({
          tone: 'danger',
          message: blocked
            ? '지금은 메시지를 보낼 수 없어요.'
            : '전송에 실패했어요. 잠시 후 다시 시도해 주세요.',
        });
      },
    });
  };

  return (
    <Screen
      surface="ambient"
      header={{ variant: 'ambient', back: true, title: name || '대화' }}
      disableKeyboardAvoiding
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {q.isLoading ? (
          <RoomSkeleton />
        ) : q.isError ? (
          <ErrorState
            code={isAppError(q.error) && q.error.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNKNOWN'}
            onRetry={() => void q.refetch()}
          />
        ) : messages.length === 0 ? (
          <View style={{ flex: 1 }}>
            <EmptyState title="첫 인사를 건네보세요" description="대화는 여기서 시작돼요." />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            inverted
            data={messages}
            keyExtractor={(m) => String(m.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: t.space.md, gap: t.space.xs }}
            renderItem={({ item }) => <Bubble message={item} mine={item.senderId === me?.id} />}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
            }}
            ListFooterComponent={
              q.isFetchingNextPage ? (
                <View style={{ paddingVertical: t.space.sm, alignItems: 'center' }}>
                  <Text variant="micro" color="onSurfaceMuted">
                    이전 대화 불러오는 중…
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        <ComposeBar
          text={text}
          onChangeText={setText}
          onSend={onSend}
          sending={sendMut.isPending}
          replyTo={null}
          onCancelReply={() => {}}
          placeholder="메시지를 입력하세요"
          sendLabel="보내기"
          maxLength={2000}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

/** 말풍선 — 방향은 모서리 하나로 신호(내 말: 우하단 각짐 / 상대: 좌하단 각짐). */
function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: t.space.xs,
      }}
    >
      {mine ? <Time at={message.createdAt} /> : null}
      <View
        style={{
          maxWidth: '76%',
          paddingHorizontal: t.space.md,
          paddingVertical: t.space.sm,
          backgroundColor: mine ? t.color.accentSubtle : t.color.surfaceSunken,
          borderRadius: t.radius.lg,
          borderBottomRightRadius: mine ? 4 : t.radius.lg,
          borderBottomLeftRadius: mine ? t.radius.lg : 4,
          borderCurve: 'continuous',
        }}
      >
        <Text variant="body" color="onSurface">
          {message.content ?? ''}
        </Text>
      </View>
      {mine ? null : <Time at={message.createdAt} />}
    </View>
  );
}

/** 말풍선 옆 시각 — 'HH:MM' 고정폭. */
function Time({ at }: { at?: string | null }) {
  if (!at) return null;
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <Text variant="micro" color="onSurfaceMuted" style={{ fontVariant: ['tabular-nums'] }}>
      {pad(d.getHours())}:{pad(d.getMinutes())}
    </Text>
  );
}

function RoomSkeleton() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', gap: t.space.sm, paddingBottom: t.space.md }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <Skeleton width={180} height={36} radius="lg" />
      </View>
      <View style={{ alignSelf: 'flex-end' }}>
        <Skeleton width={140} height={36} radius="lg" />
      </View>
      <View style={{ alignSelf: 'flex-start' }}>
        <Skeleton width={220} height={36} radius="lg" />
      </View>
    </View>
  );
}
