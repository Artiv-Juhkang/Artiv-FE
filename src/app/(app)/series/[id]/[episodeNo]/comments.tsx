/**
 * 회차 댓글 화면 — 댓글/대댓글 확인 + 추천(좋아요) + 답글 작성.
 * ------------------------------------------------------------------
 * 회차 뷰어의 리모컨에서 댓글 아이콘을 누르면 이 화면으로 온다(해당 회차 스코프).
 * 목록은 최상위 댓글 Page 무한쿼리, 각 댓글에 대댓글(replies)이 중첩돼 내려온다.
 * 좋아요는 낙관적 캐시 패치(댓글/대댓글 모두), 답글은 부모 지정 후 작성(서버가 1-depth로 평탄화).
 *
 * 스레드/입력바 UI는 features/comments 공용 컴포넌트를 사용한다(게시글 댓글과 공유).
 * 삭제 UI는 이번 범위 밖 — CommentResponse에 소유자 식별자가 없어 '내 댓글만 삭제' 표시를
 * 신뢰성 있게 못 한다(후속: DTO에 소유 플래그 추가). 백엔드 삭제 API는 이미 있음.
 */
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  listEpisodeComments,
  setEpisodeCommentLike,
  writeEpisodeComment,
} from '@/api/endpoints/comments';
import type { EpisodeComment } from '@/api/types';
import { keys } from '@/lib/query';
import {
  createPageInfiniteQuery,
  flattenInfinite,
  useInfiniteQuery,
  type PageResponse,
} from '@/lib/query/infinite';
import {
  CommentThread,
  CommentsSkeleton,
  ComposeBar,
  type ReplyTarget,
} from '@/features/comments';
import { EmptyState, ErrorState, Screen, Text, useTheme, useToast } from '@/ui';

type CommentsData = InfiniteData<PageResponse<EpisodeComment>, number>;

/** 낙관적 좋아요 패치 — 최상위/대댓글 어디에 있든 해당 댓글의 liked/likeCount 를 뒤집는다. */
function patchLike(
  data: CommentsData | undefined,
  commentId: number,
  on: boolean,
): CommentsData | undefined {
  if (!data) return data;
  const patchOne = (c: EpisodeComment): EpisodeComment => {
    if (c.id === commentId) {
      const base = c.likeCount ?? 0;
      return { ...c, liked: on, likeCount: Math.max(0, base + (on ? 1 : -1)) };
    }
    if (c.replies?.length) {
      return { ...c, replies: c.replies.map(patchOne) };
    }
    return c;
  };
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, content: p.content.map(patchOne) })),
  };
}

export default function EpisodeCommentsScreen() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { id, episodeNo } = useLocalSearchParams<{ id: string; episodeNo: string }>();
  const seriesId = Number(id);
  const no = Number(episodeNo);
  const valid = Number.isFinite(seriesId) && seriesId > 0 && Number.isFinite(no) && no > 0;

  const queryKey = keys.episodes.comments(seriesId, no);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  const q = useInfiniteQuery(
    createPageInfiniteQuery<EpisodeComment>({
      queryKey,
      fetchPage: (page, signal) => listEpisodeComments(seriesId, no, page, signal),
      enabled: valid,
    }),
  );

  const comments = useMemo(
    () => flattenInfinite(q.data, (c) => c.id ?? -1),
    [q.data],
  );

  const likeMut = useMutation<unknown, Error, { id: number; on: boolean }, { prev?: CommentsData }>({
    mutationFn: ({ id: cid, on }) => setEpisodeCommentLike(seriesId, no, cid, on),
    onMutate: async ({ id: cid, on }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<CommentsData>(queryKey);
      qc.setQueryData<CommentsData>(queryKey, (d) => patchLike(d, cid, on));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.show({ tone: 'danger', message: '잠시 후 다시 시도해 주세요.' });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const writeMut = useMutation<{ id: number }, Error, { content: string; parentId?: number }>({
    mutationFn: ({ content, parentId }) => writeEpisodeComment(seriesId, no, content, parentId),
    onSuccess: () => {
      setText('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey });
      // 뷰어 리모컨 댓글수 배지 갱신.
      qc.invalidateQueries({ queryKey: keys.episodes.detail(seriesId, no) });
    },
    onError: () => toast.show({ tone: 'danger', message: '댓글 등록에 실패했어요.' }),
  });

  const onSend = () => {
    const body = text.trim();
    if (!body || writeMut.isPending) return;
    writeMut.mutate({ content: body, parentId: replyTo?.id });
  };

  const onToggleLike = (c: EpisodeComment) => {
    if (typeof c.id !== 'number') return;
    likeMut.mutate({ id: c.id, on: !c.liked });
  };

  const onReply = (c: EpisodeComment) => {
    if (typeof c.id !== 'number') return;
    setReplyTo({ id: c.id, nickname: c.authorNickname ?? '작성자' });
  };

  return (
    // Screen 내장 KAV 대신 이 화면이 직접 KAV 소유(하단 입력 바가 키보드 위로 뜨도록).
    // 중첩 KAV(이중 패딩) 방지를 위해 Screen 쪽은 비활성화한다.
    <Screen header={{ back: true, title: '댓글', titleAlign: 'center' }} disableKeyboardAvoiding>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1 }}>
        {q.isLoading ? (
          <CommentsSkeleton />
        ) : q.isError ? (
          <ErrorState code="UNKNOWN" onRetry={() => void q.refetch()} />
        ) : comments.length === 0 ? (
          <EmptyState
            title="아직 댓글이 없어요"
            description="이 회차에 첫 댓글을 남겨보세요."
          />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={comments}
            keyExtractor={(c) => String(c.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: t.space.sm }}
            renderItem={({ item }) => (
              <CommentThread comment={item} onLike={onToggleLike} onReply={onReply} />
            )}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
            }}
            ListFooterComponent={
              q.isFetchingNextPage ? (
                <View style={{ paddingVertical: t.space.md, alignItems: 'center' }}>
                  <Text variant="caption" color="onSurfaceMuted">
                    더 불러오는 중…
                  </Text>
                </View>
              ) : null
            }
          />
        )}
        </View>

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
