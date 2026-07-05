/**
 * 공개 프로필 허브 (CH1) — "작가의 명함".
 * ------------------------------------------------------------------
 * 진입: 창작물 상세 작가명 · 서재 팔로우 행 · 게시글 작성자. 유일한 사용자 프로필
 * 화면(§5 크로스컷 — /authors/[id]는 '작품 모아보기' 그리드로 존속, 여기서 진입).
 *
 * 디자인: 로그인 화면과 수미상관 — 영속 ambient 위에 GlassCard 명함 하나(시그니처는
 * 이 카드 한 곳, 나머지는 조용하게). 비공개 프로필은 bio·가입일 자리에 담담한 안내 한 줄.
 * '메시지' 진입은 CH3(채팅 FE)에서 이 카드에 얹는다 — 죽은 버튼을 미리 두지 않는다.
 */
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { resolveImageUrl } from '@/api/image';
import { useAuth } from '@/features/auth';
import { useFollowStats, useFollowToggle, useUserProfile } from '@/features/users/hooks';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  Avatar,
  Button,
  ErrorState,
  GlassCard,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from '@/ui';

export default function UserProfileScreen() {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const { user: me } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);

  const profile = useUserProfile(userId);
  const stats = useFollowStats(userId);
  const followMut = useFollowToggle(userId);

  const isMe = me?.id != null && me.id === userId;

  if (profile.isLoading) {
    return (
      <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '프로필' }}>
        <View style={{ paddingTop: t.space.xl, alignItems: 'center' }}>
          <GlassCard radius="xl">
            <View style={{ width: 320, padding: t.space.xl, alignItems: 'center', gap: t.space.md }}>
              <Skeleton width={64} height={64} radius="pill" />
              <Skeleton width="50%" height={20} />
              <Skeleton width="70%" height={14} />
            </View>
          </GlassCard>
        </View>
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '프로필' }}>
        <ErrorState
          code="ENTITY_NOT_FOUND"
          message="없는 사용자이거나 탈퇴한 계정이에요."
          onRetry={() => void profile.refetch()}
        />
      </Screen>
    );
  }

  const p = profile.data;
  const s = stats.data;
  const nickname = p.nickname ?? '사용자';
  const isCreatorProfile = p.role === 'CREATOR';
  const following = s?.isFollowing === true;
  const joined = p.createdAt ? joinedLabel(p.createdAt) : null;

  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: '프로필' }}>
      <View style={{ paddingTop: t.space.xl, alignItems: 'center' }}>
        {/* 명함 — 이 화면의 시그니처. 오로라가 카드 뒤로 비친다(로그인 카드와 같은 문법). */}
        <GlassCard radius="xl">
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              padding: t.space.xl,
              alignItems: 'center',
              gap: t.space.sm,
            }}
          >
            <Avatar uri={resolveImageUrl(p.avatarUrl)} nickname={nickname} size="lg" />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <Text variant="title" weight="bold" numberOfLines={1}>
                {nickname}
              </Text>
              {isCreatorProfile ? (
                <View
                  style={{
                    paddingHorizontal: t.space.sm,
                    paddingVertical: 2,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.color.accentSubtle,
                  }}
                >
                  <Text variant="micro" weight="semibold" style={{ color: t.color.accent }}>
                    작가
                  </Text>
                </View>
              ) : null}
            </View>

            {/* 팔로워 · 팔로잉 — 조용한 한 줄(카운터는 tabular-nums로 정렬 유지). */}
            <View style={{ flexDirection: 'row', gap: t.space.md }}>
              <Text variant="caption" color="onSurfaceSecondary" style={{ fontVariant: ['tabular-nums'] }}>
                팔로워 {s?.followerCount ?? 0}
              </Text>
              <Text variant="caption" color="onSurfaceMuted">
                ·
              </Text>
              <Text variant="caption" color="onSurfaceSecondary" style={{ fontVariant: ['tabular-nums'] }}>
                팔로잉 {s?.followingCount ?? 0}
              </Text>
            </View>

            {p.profilePublic ? (
              <>
                {p.bio ? (
                  <Text
                    variant="body"
                    color="onSurfaceSecondary"
                    numberOfLines={3}
                    style={{ textAlign: 'center', marginTop: t.space.xs }}
                  >
                    {p.bio}
                  </Text>
                ) : null}
                {joined ? (
                  <Text variant="micro" color="onSurfaceMuted">
                    {joined}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text variant="micro" color="onSurfaceMuted" style={{ marginTop: t.space.xs }}>
                비공개 프로필이에요
              </Text>
            )}

            {!isMe ? (
              <View style={{ width: '100%', gap: t.space.sm, marginTop: t.space.md }}>
                <Button
                  label={following ? '팔로잉' : '팔로우'}
                  variant={following ? 'secondary' : 'primary'}
                  fullWidth
                  onPress={() => followMut.mutate(!following)}
                />
                {s?.isMutual ? (
                  <Text variant="micro" style={{ color: t.color.accent, textAlign: 'center' }}>
                    서로 팔로우하는 사이예요
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isCreatorProfile ? (
              <Button
                label="작품 모아보기"
                variant="secondary"
                fullWidth
                onPress={() =>
                  nav.push({
                    pathname: '/authors/[id]',
                    params: { id: userId, nickname },
                  })
                }
              />
            ) : null}
          </View>
        </GlassCard>
      </View>
    </Screen>
  );
}

/** '2026년 6월부터 함께했어요' — 가입 시점을 담담한 문장으로. */
function joinedLabel(iso: string): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월부터 함께했어요`;
}
