/**
 * 서재 '커뮤니티' 그룹의 행들 (L2) — 내 글 / 내 댓글 / 추천한 글.
 * 카테고리는 등록제(C7)라 이름 자체가 표시 라벨 — 별도 매핑 없이 그대로 렌더.
 * 행 탭 → 게시글 상세(/posts/[id]). 블라인드·삭제 원글은 상세가 404 ErrorState로 안착.
 */
import { Pressable, View } from 'react-native';

import type { MyCommentResponse, MyPostResponse, PostCategory, PostResponse } from '@/api/types';
import { relativeTime } from '@/features/comments';
import { Text, useTheme } from '@/ui';

function CategoryPill({ category }: { category?: PostCategory }) {
  const t = useTheme();
  if (!category) return null;
  return (
    <View
      style={{
        paddingHorizontal: t.space.sm,
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.accentSubtle,
      }}
    >
      <Text variant="micro" weight="semibold" style={{ color: t.color.accent }}>
        {category}
      </Text>
    </View>
  );
}

function BlindPill() {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: t.space.sm,
        paddingVertical: 2,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surfaceSunken,
      }}
    >
      <Text variant="micro" weight="semibold" color="danger">
        블라인드
      </Text>
    </View>
  );
}

/** 내 글 / 추천한 글 공용 행 — 두 DTO 모두 {category,title,likeCount,createdAt(,blinded)} 표시분을 공유. */
export function MyPostRow({
  post,
  onPress,
}: {
  post: MyPostResponse | PostResponse;
  onPress: () => void;
}) {
  const t = useTheme();
  const blinded = 'blinded' in post && post.blinded === true;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={post.title ?? '게시글'}
      style={{ paddingVertical: t.space.sm, gap: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <CategoryPill category={post.category} />
        {blinded ? <BlindPill /> : null}
        <Text variant="micro" color="onSurfaceMuted">
          {relativeTime(post.createdAt)}
        </Text>
      </View>
      <Text variant="headline" weight="semibold" numberOfLines={1}>
        {post.title ?? ''}
      </Text>
      <Text variant="caption" color="onSurfaceMuted">
        ♥ {post.likeCount ?? 0}
      </Text>
    </Pressable>
  );
}

/** 내 댓글 행 — 댓글 1줄 + 원글 제목 메타. 원글로 라우팅(postId). */
export function MyCommentRow({
  comment,
  onPress,
}: {
  comment: MyCommentResponse;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="내 댓글의 원글 보기"
      style={{ paddingVertical: t.space.sm, gap: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        {comment.blinded ? <BlindPill /> : null}
        <Text variant="micro" color="onSurfaceMuted">
          {relativeTime(comment.createdAt)}
        </Text>
      </View>
      <Text variant="body" numberOfLines={1}>
        {comment.content ?? ''}
      </Text>
      <Text variant="caption" color="onSurfaceMuted" numberOfLines={1}>
        {comment.postBlinded ? '블라인드된 글' : (comment.postTitle ?? '원글')}에 남긴 댓글
      </Text>
    </Pressable>
  );
}
