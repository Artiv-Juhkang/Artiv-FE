/**
 * 게시글 상세 — 본문(이미지) + 추천/비추천 + 댓글/대댓글 좋아요·싫어요 + 소유자 수정/삭제.
 * (C1 읽기 → C3 소유자 분기 → C4 수정 → C5 반응 토글 → C6 신고 누적.)
 *
 * 댓글은 백엔드가 전체 List로 내려주므로(회차 댓글과 달리 미페이징) 일반 쿼리 +
 * 공용 스레드 UI(features/comments)로 렌더한다. 좋아요↔싫어요 상호배타는 서버가
 * 강제하고 낙관 패치가 이를 미러한다(글: useToggleMutation apply, 댓글: patchReaction).
 */
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  deletePost,
  setPostCommentDislike,
  setPostCommentLike,
  writePostComment,
} from '@/api/endpoints/posts';
import type { PostComment } from '@/api/types';
import { useAuth } from '@/features/auth';
import {
  CommentThread,
  CommentsSkeleton,
  ComposeBar,
  relativeTime,
  type ReplyTarget,
} from '@/features/comments';
import { POST_CATEGORY_LABEL } from '@/features/community/categories';
import { ReportSheet } from '@/features/report/ReportSheet';
import {
  usePost,
  usePostComments,
  usePostDislikeToggle,
  usePostLikeToggle,
} from '@/features/community/hooks';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { keys } from '@/lib/query';
import { AppImage } from '@/ui/AppImage';
import {
  Button,
  Divider,
  EmptyState,
  ErrorState,
  HeaderIconButton,
  Screen,
  Skeleton,
  Text,
  useTheme,
  useToast,
} from '@/ui';

export default function PostDetailScreen() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useGuardedNavigation();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const post = usePost(postId);
  const comments = usePostComments(postId);
  const likeMut = usePostLikeToggle(postId);
  const dislikeMut = usePostDislikeToggle(postId);

  // 댓글 좋아요/싫어요 — List 캐시 낙관 패치(상호배타를 서버와 동일하게 미러).
  const commentsKey = keys.posts.comments(postId);
  const reactMut = useMutation<
    void,
    Error,
    { commentId: number; kind: 'like' | 'dislike'; on: boolean },
    { prev?: PostComment[] }
  >({
    mutationFn: ({ commentId, kind, on }) =>
      kind === 'like'
        ? setPostCommentLike(postId, commentId, on)
        : setPostCommentDislike(postId, commentId, on),
    onMutate: async ({ commentId, kind, on }) => {
      await qc.cancelQueries({ queryKey: commentsKey });
      const prev = qc.getQueryData<PostComment[]>(commentsKey);
      qc.setQueryData<PostComment[]>(commentsKey, (list) =>
        list?.map((c) => patchReaction(c, commentId, kind, on)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(commentsKey, ctx.prev);
      toast.show({ tone: 'danger', message: '잠시 후 다시 시도해 주세요.' });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: commentsKey }),
  });

  const onCommentLike = (c: PostComment) => {
    if (typeof c.id !== 'number' || reactMut.isPending) return;
    reactMut.mutate({ commentId: c.id, kind: 'like', on: !c.liked });
  };
  const onCommentDislike = (c: PostComment) => {
    if (typeof c.id !== 'number' || reactMut.isPending) return;
    reactMut.mutate({ commentId: c.id, kind: 'dislike', on: !c.disliked });
  };

  const deleteMut = useMutation<void, Error, void>({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.posts.all });
      toast.show({ message: '글을 삭제했어요.' });
      nav.back();
    },
    onError: () => toast.show({ tone: 'danger', message: '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.' }),
  });

  // react-native-web 에서 Alert.alert 은 no-op → 웹에선 window.confirm 분기(my.tsx 로그아웃과 동일).
  const confirmDelete = () => {
    if (deleteMut.isPending) return;
    if (Platform.OS === 'web') {
      if (window.confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) deleteMut.mutate();
      return;
    }
    Alert.alert('글 삭제', '이 글을 삭제할까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteMut.mutate() },
    ]);
  };

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  // 신고 대상(글/댓글) — null이면 시트 닫힘. 본인 콘텐츠는 열지 않는다.
  const [reportTarget, setReportTarget] = useState<{ type: 'POST' | 'COMMENT'; id: number } | null>(null);

  const writeMut = useMutation<PostComment, Error, { content: string; parentId?: number }>({
    mutationFn: ({ content, parentId }) => writePostComment(postId, content, parentId),
    onSuccess: () => {
      setText('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: keys.posts.comments(postId) });
    },
    onError: () => toast.show({ tone: 'danger', message: '댓글 등록에 실패했어요.' }),
  });

  const onSend = () => {
    const body = text.trim();
    if (!body || writeMut.isPending) return;
    writeMut.mutate({ content: body, parentId: replyTo?.id });
  };

  const onReply = (c: PostComment) => {
    if (typeof c.id !== 'number') return;
    setReplyTo({ id: c.id, nickname: c.authorNickname ?? '작성자' });
  };

  if (post.isLoading) {
    return (
      <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '게시글' }}>
        <View style={{ gap: t.space.md, padding: t.space.lg }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="90%" height={22} />
          <Skeleton width="100%" height={160} radius="lg" />
        </View>
      </Screen>
    );
  }
  if (post.isError || !post.data) {
    // 블라인드/삭제 글은 404(존재 숨김) — 피드 캐시에 남아 있다 눌렀을 때의 안착 지점.
    return (
      <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '게시글' }}>
        <ErrorState
          code="ENTITY_NOT_FOUND"
          message="글이 삭제됐거나 볼 수 없는 상태예요."
          onRetry={() => void post.refetch()}
        />
      </Screen>
    );
  }

  const p = post.data;
  const label = p.category ? POST_CATEGORY_LABEL[p.category] : '';
  const liked = p.liked === true;
  const disliked = p.disliked === true;
  const commentList = comments.data ?? [];
  // 소유자 분기 — C2가 노출한 authorId와 내 프로필 id 비교(관리자 삭제는 어드민 콘솔 소관).
  const isOwner = user?.id != null && p.authorId != null && user.id === p.authorId;

  return (
    <Screen
      surface="ambient"
      header={{
        variant: 'ambient',
        back: true,
        title: '게시글',
        right: isOwner ? (
          <View style={{ flexDirection: 'row' }}>
            <HeaderIconButton
              name="square.and.pencil"
              fallback="✏️"
              accessibilityLabel="글 수정"
              onPress={() => nav.push({ pathname: '/posts/[id]/edit', params: { id: postId } })}
            />
            <HeaderIconButton
              name="trash"
              fallback="🗑"
              accessibilityLabel="글 삭제"
              onPress={confirmDelete}
            />
          </View>
        ) : (
          <HeaderIconButton
            name="exclamationmark.bubble"
            fallback="🚨"
            accessibilityLabel="글 신고"
            onPress={() => setReportTarget({ type: 'POST', id: postId })}
          />
        ),
      }}
      disableKeyboardAvoiding
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 본문+댓글을 한 리스트로 — 헤더 영역(본문)은 ListHeaderComponent가 소유. */}
        <FlatList
          style={{ flex: 1 }}
          data={commentList}
          keyExtractor={(c) => String(c.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: t.space.xl }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.md, gap: t.space.md }}>
              <View style={{ gap: t.space.xs }}>
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
                    {relativeTime(p.createdAt)}
                  </Text>
                </View>
                <Text variant="title" weight="bold">
                  {p.title ?? ''}
                </Text>
                {/* 작성자 → 공개 프로필 허브(CH1). 탈퇴 작성자는 진입 없음. */}
                {typeof p.authorId === 'number' && p.authorNickname ? (
                  <Text
                    variant="caption"
                    color="onSurfaceSecondary"
                    onPress={() => nav.push({ pathname: '/users/[id]', params: { id: p.authorId! } })}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.authorNickname} 프로필 보기`}
                    style={{ textDecorationLine: 'underline', alignSelf: 'flex-start' }}
                  >
                    {p.authorNickname}
                  </Text>
                ) : (
                  <Text variant="caption" color="onSurfaceSecondary">
                    {p.authorNickname ?? '(탈퇴)'}
                  </Text>
                )}
              </View>

              {(p.images ?? []).map((im) => {
                const w = im.width ?? 1;
                const h = im.height ?? 1;
                return (
                  <AppImage
                    key={`${im.sortOrder}-${im.url}`}
                    url={im.url}
                    recyclingKey={im.url ?? undefined}
                    style={{
                      width: '100%',
                      aspectRatio: w > 0 && h > 0 ? w / h : 1,
                      borderRadius: t.radius.lg,
                    }}
                  />
                );
              })}

              <Text variant="body" color="onSurface">
                {p.content ?? ''}
              </Text>

              {/* 추천/비추천 토글 — 낙관 patch, 무바디 멱등, 서버 상호배타 미러. */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: t.space.md,
                  paddingVertical: t.space.sm,
                }}
              >
                <Button
                  label={`${liked ? '♥' : '♡'} 추천 ${p.likeCount ?? 0}`}
                  variant={liked ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => likeMut.mutate(!liked)}
                />
                <Button
                  label={`${disliked ? '▼' : '▽'} 비추천 ${p.dislikeCount ?? 0}`}
                  variant={disliked ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => dislikeMut.mutate(!disliked)}
                />
              </View>

              <Divider />
              <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
                댓글 {countComments(commentList)}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CommentThread
              comment={item}
              onLike={onCommentLike}
              onDislike={onCommentDislike}
              onReport={(c) => {
                // 본인 댓글은 신고 대상에서 제외.
                if (typeof c.id === 'number' && c.authorId !== user?.id) {
                  setReportTarget({ type: 'COMMENT', id: c.id });
                }
              }}
              onReply={onReply}
            />
          )}
          ListEmptyComponent={
            comments.isLoading ? (
              <CommentsSkeleton />
            ) : comments.isError ? (
              <ErrorState code="UNKNOWN" onRetry={() => void comments.refetch()} />
            ) : (
              <EmptyState title="아직 댓글이 없어요" description="이 글에 첫 댓글을 남겨보세요." />
            )
          }
        />

        <ComposeBar
          text={text}
          onChangeText={setText}
          onSend={onSend}
          sending={writeMut.isPending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />

        <ReportSheet
          visible={reportTarget != null}
          targetType={reportTarget?.type ?? 'POST'}
          targetId={reportTarget?.id ?? null}
          onClose={() => setReportTarget(null)}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** 대댓글 포함 총 댓글 수. */
function countComments(list: PostComment[]): number {
  return list.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);
}

/** 댓글 트리에서 해당 댓글의 좋아요/싫어요를 낙관적으로 뒤집는다(상호배타 미러). */
function patchReaction(
  c: PostComment,
  commentId: number,
  kind: 'like' | 'dislike',
  on: boolean,
): PostComment {
  if (c.id === commentId) {
    const like = c.likeCount ?? 0;
    const dislike = c.dislikeCount ?? 0;
    if (kind === 'like') {
      return {
        ...c,
        liked: on,
        likeCount: Math.max(0, like + (on ? 1 : -1)),
        disliked: on ? false : c.disliked,
        dislikeCount: on && c.disliked ? Math.max(0, dislike - 1) : c.dislikeCount,
      };
    }
    return {
      ...c,
      disliked: on,
      dislikeCount: Math.max(0, dislike + (on ? 1 : -1)),
      liked: on ? false : c.liked,
      likeCount: on && c.liked ? Math.max(0, like - 1) : c.likeCount,
    };
  }
  if (c.replies?.length) {
    return { ...c, replies: c.replies.map((r) => patchReaction(r, commentId, kind, on)) };
  }
  return c;
}
