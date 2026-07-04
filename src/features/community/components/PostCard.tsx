/**
 * PostCard — 커뮤니티 피드의 게시글 행.
 * GlassCard 위에 [카테고리 필 · 상대시간 / 제목 / 작성자 · ♥추천수].
 * (Badge 프리미티브는 웹툰 어휘(UP·19·BEST) 전용이라 카테고리는 자체 필로 표기.)
 */
import { Pressable, View } from 'react-native';

import type { PostResponse } from '@/api/types';
import { relativeTime } from '@/features/comments';
import { GlassCard, Text, useTheme } from '@/ui';

import { POST_CATEGORY_LABEL } from '../categories';

export function PostCard({ post, onPress }: { post: PostResponse; onPress: () => void }) {
  const t = useTheme();
  const label = post.category ? POST_CATEGORY_LABEL[post.category] : '';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={post.title ?? '게시글'}>
      <GlassCard radius="lg">
        <View style={{ padding: t.space.lg, gap: t.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            {label ? (
              <View
                style={{
                  paddingHorizontal: t.space.sm,
                  paddingVertical: 2,
                  borderRadius: t.radius.pill,
                  backgroundColor: t.color.accentSubtle,
                }}
              >
                <Text variant="micro" weight="semibold" style={{ color: t.color.accent }}>
                  {label}
                </Text>
              </View>
            ) : null}
            <Text variant="micro" color="onSurfaceMuted">
              {relativeTime(post.createdAt)}
            </Text>
          </View>
          <Text variant="headline" weight="semibold" numberOfLines={2}>
            {post.title ?? ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
            <Text variant="caption" color="onSurfaceSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {post.authorNickname ?? '(탈퇴)'}
            </Text>
            <Text variant="caption" color="onSurfaceMuted">
              ♥ {post.likeCount ?? 0}
            </Text>
            <Text variant="caption" color="onSurfaceMuted">
              ▽ {post.dislikeCount ?? 0}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}
