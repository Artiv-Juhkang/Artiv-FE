/**
 * 알림함 — 종류별 분류 + 읽음 처리.
 * ------------------------------------------------------------------
 * 헤더 벨(창작 홈)에서 push. 백엔드 알림 도메인은 이미 완성(V20 + fan-out) → 프론트만.
 *
 * 그룹 칩(전체/창작물/커뮤니티/소식/문의)으로 거른다. 각 칩은 미읽음 집계 배지를 단다
 * (unread-summary). 데이터가 실제로 도는 그룹만 둔다(사용자 결정) — 채팅 도메인이 없어
 * 채팅 탭은 없고, 매체 서브칩도 없다. 채팅이 생기면 그룹만 추가하면 자동으로 켜진다.
 *
 * 한 건을 누르면 읽음 처리(PATCH read) 후 라우팅 신호(targetType,targetId)로 이동한다.
 * 창작물(새 회차) 알림은 targetType=SERIES라 작품 상세로 이동한다(거기서 새 회차를 바로 본다).
 * 그 외(커뮤니티 글·팔로우·문의)는 목적지 화면이 아직 없어 읽음 처리만 하고 머문다(graceful
 * degrade). 목적지가 생기면 분기만 추가한다.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getUnreadSummary,
  listNotifications,
  readAllNotifications,
  readNotification,
} from '@/api/endpoints/notifications';
import type { NotificationResponse, NotificationType } from '@/api/types';
import { keys } from '@/lib/query';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { EmptyState, ErrorState, Screen, Text, useTheme } from '@/ui';

/* -------------------------------------------------------------------------- */
/*  그룹 정의 — 데이터가 실제로 도는 종류만(채팅·매체서브칩 제외).                  */
/* -------------------------------------------------------------------------- */

type Group = { key: string; label: string; types: NotificationType[] | null };

const GROUPS: Group[] = [
  { key: 'ALL', label: '전체', types: null },
  { key: 'CREATIVITY', label: '창작물', types: ['EPISODE_PUBLISHED'] },
  { key: 'COMMUNITY', label: '커뮤니티', types: ['POST_COMMENT', 'COMMENT_REPLY', 'POST_MENTIONED'] },
  { key: 'NEWS', label: '소식', types: ['FOLLOWED'] },
  { key: 'CHAT', label: '채팅', types: ['DM_REQUEST'] },
  { key: 'INQUIRY', label: '문의', types: ['INQUIRY_ANSWERED'] },
];

const SUMMARY_KEY = ['notifications', 'unread-summary'] as const;

/* -------------------------------------------------------------------------- */
/*  화면                                                                         */
/* -------------------------------------------------------------------------- */

export default function NotificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const nav = useGuardedNavigation();
  const [group, setGroup] = useState<Group>(GROUPS[0]);

  const list = useQuery({
    queryKey: keys.notifications.list(),
    queryFn: ({ signal }) => listNotifications(0, undefined, signal),
  });
  const summary = useQuery({ queryKey: SUMMARY_KEY, queryFn: getUnreadSummary });

  // 알림 관련 캐시(목록·집계·헤더 벨 카운트)를 한 번에 새로고침.
  const refreshAll = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const readOne = useMutation({
    mutationFn: (id: number) => readNotification(id),
    onSuccess: (updated) => {
      refreshAll();
      if (!updated.targetId) return;
      if (updated.targetType === 'SERIES') {
        nav.push({ pathname: '/series/[id]', params: { id: updated.targetId } });
      } else if (updated.targetType === 'POST') {
        nav.push({ pathname: '/posts/[id]', params: { id: updated.targetId } });
      } else if (updated.targetType === 'USER') {
        nav.push({ pathname: '/users/[id]', params: { id: updated.targetId } });
      } else if (updated.targetType === 'CONVERSATION') {
        // DM_REQUEST는 항상 수신자에게만 발송되므로(ChatService.createDirectInternal),
        // 이 알림을 탭한 사람은 늘 '받은 요청'의 당사자다 — 대화방(아직 수락 전이라 텅 빈
        // 화면)이 아니라 수락/거절이 가능한 요청함으로 보낸다.
        nav.push({ pathname: '/chat', params: { tab: 'requests' } });
      } else if (updated.targetType === 'INQUIRY') {
        nav.push({ pathname: '/inquiries/[id]', params: { id: updated.targetId } });
      }
      // COMMENT는 원글 id를 모르므로 읽음 처리만(후속: targetId에 postId 동봉 검토).
    },
  });

  const readAll = useMutation({
    mutationFn: readAllNotifications,
    onSuccess: refreshAll,
  });

  const items = list.data?.content ?? [];
  const filtered = useMemo(
    () => (group.types ? items.filter((n) => !!n.type && group.types!.includes(n.type)) : items),
    [items, group],
  );

  const groupUnread = (g: Group): number => {
    const s = summary.data;
    if (!s) return 0;
    if (!g.types) return s.total ?? 0;
    return g.types.reduce((acc, ty) => acc + (s.byType?.[ty] ?? 0), 0);
  };

  const hasUnread = (summary.data?.total ?? 0) > 0;

  return (
    <Screen
      surface="ambient"
      edges={['top']}
      header={{
        // surface='ambient'와 일관 — 기본 variant는 흰 surface 밴드라 배경과 어긋난다.
        // ambient는 밴드를 투명 처리해 루트 CoverWall이 헤더 뒤로 비친다(홈과 동일).
        variant: 'ambient',
        back: true,
        title: '알림',
        titleAlign: 'center',
        right: hasUnread ? (
          <Pressable
            onPress={() => readAll.mutate()}
            accessibilityRole="button"
            accessibilityLabel="모두 읽음"
            hitSlop={8}
            style={{ paddingHorizontal: t.space.sm, justifyContent: 'center' }}
          >
            <Text variant="caption" color="accent" weight="semibold">
              모두 읽음
            </Text>
          </Pressable>
        ) : undefined,
      }}
    >
      {/* 그룹 칩 — 미읽음 배지. */}
      <GroupChips
        groups={GROUPS}
        selected={group}
        onSelect={setGroup}
        unreadFor={groupUnread}
      />

      {list.isLoading ? (
        <View style={{ paddingTop: t.space.xl, alignItems: 'center' }}>
          <ActivityIndicator color={t.color.onSurfaceMuted} />
        </View>
      ) : list.isError ? (
        <ErrorState code="UNKNOWN" onRetry={() => void list.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="알림이 없어요"
          description={
            group.key === 'ALL'
              ? '구독한 작품의 새 회차나 활동 소식이 여기에 모여요.'
              : `${group.label} 알림이 아직 없어요.`
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => String(n.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: t.space.sm }}
          renderItem={({ item }) => (
            <NotificationRow
              n={item}
              onPress={() => readOne.mutate(item.id!)}
            />
          )}
        />
      )}
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  그룹 칩                                                                      */
/* -------------------------------------------------------------------------- */

function GroupChips({
  groups,
  selected,
  onSelect,
  unreadFor,
}: {
  groups: Group[];
  selected: Group;
  onSelect: (g: Group) => void;
  unreadFor: (g: Group) => number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: t.space.lg,
        paddingTop: t.space.sm,
        paddingBottom: t.space.md,
      }}
    >
      {groups.map((g) => {
        const active = g.key === selected.key;
        const unread = unreadFor(g);
        return (
          <Pressable
            key={g.key}
            onPress={() => onSelect(g)}
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
              borderColor: active ? t.color.accent : t.color.border,
              backgroundColor: active ? `${t.color.accent}22` : t.color.surface,
            }}
          >
            <Text
              variant="caption"
              weight={active ? 'bold' : 'medium'}
              style={{ color: active ? t.color.accent : t.color.onSurfaceSecondary, lineHeight: 18 }}
            >
              {g.label}
            </Text>
            {unread > 0 ? (
              <View
                style={{
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 4,
                  borderRadius: t.radius.pill,
                  backgroundColor: t.color.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  variant="micro"
                  weight="bold"
                  maxFontSizeMultiplier={1}
                  style={{ color: t.color.onAccent, lineHeight: 12 }}
                >
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  알림 행                                                                      */
/* -------------------------------------------------------------------------- */

function NotificationRow({
  n,
  onPress,
}: {
  n: NotificationResponse;
  onPress: () => void;
}) {
  const t = useTheme();
  const unread = !n.read;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.title ?? ''}. ${n.message ?? ''}${unread ? '. 안 읽음' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: t.space.md,
        paddingHorizontal: t.space.lg,
        paddingVertical: t.space.md,
        backgroundColor: pressed
          ? t.color.surfaceSunken
          : unread
            ? `${t.color.accent}14`
            : 'transparent',
      })}
    >
      {/* 안읽음 점 — 읽으면 사라진다. */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginTop: 6,
          backgroundColor: unread ? t.color.accent : 'transparent',
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight={unread ? 'bold' : 'medium'} numberOfLines={1}>
          {n.title ?? '알림'}
        </Text>
        {n.message ? (
          <Text variant="caption" color="onSurfaceSecondary" numberOfLines={2}>
            {n.message}
          </Text>
        ) : null}
        <Text variant="micro" color="onSurfaceMuted">
          {relativeTime(n.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */

/** 짧은 한국어 상대시간('방금 전' / 'N분 전' / 'N일 전' / 'YYYY.MM.DD'). */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return '';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  const d = new Date(then);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
