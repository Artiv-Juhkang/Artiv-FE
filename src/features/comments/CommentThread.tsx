/**
 * 공용 댓글 스레드 UI — 회차 댓글·게시글 댓글이 함께 쓴다.
 * ------------------------------------------------------------------
 * 회차 댓글 화면에서 추출(사용처가 2곳이 되는 시점의 공용화 — design-2026-07-04 §5).
 * 데이터 레이어(쿼리·낙관 패치)는 각 화면이 소유하고, 여기는 표시만 담당한다.
 *
 * 반응 버튼은 핸들러가 주어질 때만 렌더 — 회차 댓글은 onLike(좋아요)만,
 * 게시글 댓글은 onLike+onDislike(좋아요/싫어요, D3 확정)를 전달한다.
 * 싫어요는 ▼/▽(Placard의 ▲추천과 대칭 글리프), 활성 시 danger 톤.
 */
import { Pressable, View } from 'react-native';

import { Skeleton, Text, useTheme } from '@/ui';

import { relativeTime } from './relativeTime';

/** 두 도메인 댓글(회차 EpisodeComment / 게시글 PostComment)의 공통 표시 형태. */
export type CommentShape = {
  id?: number | null;
  authorNickname?: string | null;
  content?: string | null;
  createdAt?: string | null;
  liked?: boolean | null;
  likeCount?: number | null;
  disliked?: boolean | null;
  dislikeCount?: number | null;
  replies?: CommentShape[] | null;
};

export type CommentThreadProps<T extends CommentShape> = {
  comment: T;
  /** 주어지면 ♥ 좋아요 버튼 렌더(회차·게시글 댓글). */
  onLike?: (c: T) => void;
  /** 주어지면 ▼ 싫어요 버튼 렌더(게시글 댓글 전용 — 회차 댓글은 미전달). */
  onDislike?: (c: T) => void;
  onReply: (c: T) => void;
};

/** 한 스레드: 최상위 댓글 + 대댓글(들여쓰기). */
export function CommentThread<T extends CommentShape>({
  comment,
  onLike,
  onDislike,
  onReply,
}: CommentThreadProps<T>) {
  const t = useTheme();
  // 서버가 1-depth로 평탄화하므로 replies의 원소도 같은 도메인 타입이다.
  const replies = (comment.replies ?? []) as T[];
  return (
    <View style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.sm }}>
      <CommentRow comment={comment} onLike={onLike} onDislike={onDislike} onReply={onReply} />
      {replies.length > 0 ? (
        <View
          style={{
            marginTop: t.space.sm,
            marginLeft: t.space.lg,
            gap: t.space.sm,
            borderLeftWidth: 2,
            borderLeftColor: t.color.border,
            paddingLeft: t.space.md,
          }}
        >
          {replies.map((r) => (
            <CommentRow key={r.id} comment={r} onLike={onLike} onDislike={onDislike} onReply={onReply} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function CommentRow<T extends CommentShape>({
  comment,
  onLike,
  onDislike,
  onReply,
}: CommentThreadProps<T>) {
  const t = useTheme();
  const liked = comment.liked === true;
  const likeCount = comment.likeCount ?? 0;
  const disliked = comment.disliked === true;
  const dislikeCount = comment.dislikeCount ?? 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {comment.authorNickname ?? '익명'}
        </Text>
        <Text variant="micro" color="onSurfaceMuted">
          {relativeTime(comment.createdAt)}
        </Text>
      </View>

      <Text variant="body" color="onSurface">
        {comment.content ?? ''}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.lg }}>
        {onLike ? (
          <Pressable
            onPress={() => onLike(comment)}
            accessibilityRole="button"
            accessibilityLabel={liked ? '추천 취소' : '추천'}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text variant="caption" style={{ color: liked ? t.color.accent : t.color.onSurfaceMuted }}>
              {liked ? '♥' : '♡'}
            </Text>
            <Text
              variant="caption"
              style={{ color: liked ? t.color.accent : t.color.onSurfaceMuted }}
            >
              {likeCount}
            </Text>
          </Pressable>
        ) : null}

        {onDislike ? (
          <Pressable
            onPress={() => onDislike(comment)}
            accessibilityRole="button"
            accessibilityLabel={disliked ? '싫어요 취소' : '싫어요'}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text variant="caption" style={{ color: disliked ? t.color.danger : t.color.onSurfaceMuted }}>
              {disliked ? '▼' : '▽'}
            </Text>
            <Text
              variant="caption"
              style={{ color: disliked ? t.color.danger : t.color.onSurfaceMuted }}
            >
              {dislikeCount}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => onReply(comment)}
          accessibilityRole="button"
          accessibilityLabel="답글 달기"
          hitSlop={8}
        >
          <Text variant="caption" color="onSurfaceMuted">
            답글
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CommentsSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.lg, padding: t.space.lg }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ gap: t.space.xs }}>
          <Skeleton width="30%" height={12} />
          <Skeleton width="90%" height={16} />
        </View>
      ))}
    </View>
  );
}
