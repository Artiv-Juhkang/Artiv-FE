/**
 * 커뮤니티 vertical 데이터 훅 — features/series/hooks.ts 패턴 복제.
 *
 *  - usePostsInfinite: 피드 목록(카테고리·정렬 필터, Page 무한쿼리).
 *  - usePost:          게시글 상세(좋아요 토글의 낙관 patch 대상 캐시).
 *  - usePostComments:  댓글 전체 목록(List — 백엔드 미페이징이라 일반 쿼리).
 *  - usePostLikeToggle: 멱등 무바디 토글 → PostDetail.liked/likeCount 낙관 patch.
 */
import { useQuery } from '@tanstack/react-query';

import { getPost, listPostComments, listPosts, setPostLike } from '@/api/endpoints/posts';
import type { PostCategory, PostComment, PostDetail, PostSort } from '@/api/types';
import { createPageInfiniteQuery, keys, useToggleMutation } from '@/lib/query';

export interface PostsListParams {
  category?: PostCategory;
  sort?: PostSort;
}

/** 커뮤니티 피드 — Page 기반 무한쿼리(필터는 쿼리키에 정규화 내장). */
export function usePostsInfinite(params: PostsListParams = {}) {
  const { category, sort } = params;
  return createPageInfiniteQuery({
    queryKey: keys.posts.list({ category, sort }),
    fetchPage: (page, signal) => listPosts({ page, category, sort }, signal),
  });
}

/** 게시글 단건 상세 — usePostLikeToggle의 낙관 업데이트 타깃. */
export function usePost(id: number) {
  return useQuery<PostDetail>({
    queryKey: keys.posts.detail(id),
    queryFn: () => getPost(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** 게시글 댓글 목록(전체 List, 대댓글 중첩). */
export function usePostComments(id: number) {
  return useQuery<PostComment[]>({
    queryKey: keys.posts.comments(id),
    queryFn: ({ signal }) => listPostComments(id, signal),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/**
 * 게시글 추천 토글 — 멱등 POST/DELETE 무바디.
 * 상세 캐시에 liked/likeCount 낙관 patch, 정착 후 피드 목록도 invalidate
 * (BEST 정렬·목록 likeCount가 서버 진실과 재동기).
 */
export function usePostLikeToggle(postId: number) {
  return useToggleMutation<PostDetail>({
    targetKey: keys.posts.detail(postId),
    mutationFn: (next: boolean) => setPostLike(postId, next),
    apply: (prev, next) =>
      prev
        ? {
            ...prev,
            liked: next,
            likeCount: Math.max(0, (prev.likeCount ?? 0) + (next ? 1 : -1)),
          }
        : prev,
    invalidate: [keys.posts.all],
  });
}
