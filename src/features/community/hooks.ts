/**
 * 커뮤니티 vertical 데이터 훅 — features/series/hooks.ts 패턴 복제.
 *
 *  - usePostsInfinite: 피드 목록(카테고리·정렬 필터, Page 무한쿼리).
 *  - usePost:          게시글 상세(좋아요 토글의 낙관 patch 대상 캐시).
 *  - usePostComments:  댓글 전체 목록(List — 백엔드 미페이징이라 일반 쿼리).
 *  - usePostLikeToggle: 멱등 무바디 토글 → PostDetail.liked/likeCount 낙관 patch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createPostCategory, listPostCategories } from '@/api/endpoints/postCategories';
import {
  getPost,
  listPostComments,
  listPosts,
  setPostDislike,
  setPostLike,
} from '@/api/endpoints/posts';
import type { PostCategory, PostCategoryResponse, PostComment, PostDetail, PostSort } from '@/api/types';
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

/** 카테고리 목록(C7, 등록제) — 시드 4종 + 사용자 등록분. 이름 자체가 표시 라벨. */
export function usePostCategories() {
  return useQuery<PostCategoryResponse[]>({
    queryKey: keys.postCategories.list(),
    queryFn: ({ signal }) => listPostCategories(signal),
  });
}

/** 새 카테고리 등록 — 성공 시 목록 재동기(방금 등록한 것을 바로 선택할 수 있게). */
export function useCreatePostCategory() {
  const qc = useQueryClient();
  return useMutation<PostCategoryResponse, Error, string>({
    mutationFn: (name) => createPostCategory(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.postCategories.list() }),
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
 * 상세 캐시에 liked/likeCount 낙관 patch(비추천 중이었다면 서버 상호배타를 미러해
 * disliked도 함께 해제), 정착 후 피드 목록도 invalidate.
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
            // 추천 켜짐 → 서버가 비추천을 자동 해제(상호배타) — 낙관 patch도 미러.
            disliked: next ? false : prev.disliked,
            dislikeCount:
              next && prev.disliked ? Math.max(0, (prev.dislikeCount ?? 0) - 1) : prev.dislikeCount,
          }
        : prev,
    invalidate: [keys.posts.all],
  });
}

/** 게시글 비추천 토글 — 추천 토글과 대칭(상호배타 미러). */
export function usePostDislikeToggle(postId: number) {
  return useToggleMutation<PostDetail>({
    targetKey: keys.posts.detail(postId),
    mutationFn: (next: boolean) => setPostDislike(postId, next),
    apply: (prev, next) =>
      prev
        ? {
            ...prev,
            disliked: next,
            dislikeCount: Math.max(0, (prev.dislikeCount ?? 0) + (next ? 1 : -1)),
            liked: next ? false : prev.liked,
            likeCount:
              next && prev.liked ? Math.max(0, (prev.likeCount ?? 0) - 1) : prev.likeCount,
          }
        : prev,
    invalidate: [keys.posts.all],
  });
}
