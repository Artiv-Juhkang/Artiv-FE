/**
 * 게시글 상세 — 본문(이미지 포함) + 추천 토글 + 댓글/대댓글 (C1).
 *
 * 댓글은 백엔드가 전체 List로 내려주므로(회차 댓글과 달리 미페이징) 일반 쿼리 +
 * 공용 스레드 UI(features/comments)로 렌더한다. 게시글 댓글 좋아요/싫어요는 C5에서
 * 연결(D3 확정) — 지금은 onLike 미전달로 하트가 렌더되지 않는다.
 * 소유자(수정·삭제)·신고 UI는 C3·C6 슬라이스.
 */
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deletePost, writePostComment } from '@/api/endpoints/posts';
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
import { usePost, usePostComments, usePostLikeToggle } from '@/features/community/hooks';
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
          <HeaderIconButton
            name="trash"
            fallback="🗑"
            accessibilityLabel="글 삭제"
            onPress={confirmDelete}
          />
        ) : undefined,
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
                <Text variant="caption" color="onSurfaceSecondary">
                  {p.authorNickname ?? '(탈퇴)'}
                </Text>
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

              {/* 추천 토글 — 낙관 patch(usePostLikeToggle), 무바디 멱등. */}
              <View style={{ alignItems: 'center', paddingVertical: t.space.sm }}>
                <Button
                  label={`${liked ? '♥' : '♡'} 추천 ${p.likeCount ?? 0}`}
                  variant={liked ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => likeMut.mutate(!liked)}
                />
              </View>

              <Divider />
              <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
                댓글 {countComments(commentList)}
              </Text>
            </View>
          }
          renderItem={({ item }) => <CommentThread comment={item} onReply={onReply} />}
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
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** 대댓글 포함 총 댓글 수. */
function countComments(list: PostComment[]): number {
  return list.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);
}
