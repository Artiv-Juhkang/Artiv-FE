/**
 * 커뮤니티 게시글/좋아요.
 *
 * listPosts 는 정렬 가능(category/sort) → buildPageParams.
 * setPostLike 는 200 + PostDetail 바디 반환 → 훅 onSuccess 에서 liked/likeCount reconcile.
 */
import { api } from '@/api/client';
import { buildPageParams } from '@/api/paging';
import type { PostCategory, PostDetail, PostResponse, PostSort } from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/** 게시글 목록(Page, 정렬 가능). 목록 PostResponse 엔 liked 없음(상세에만). */
export async function listPosts(
  params: { page: number; category?: PostCategory; sort?: PostSort },
  signal?: AbortSignal,
): Promise<PageResponse<PostResponse>> {
  const { data } = await api.get<PageResponse<PostResponse>>('/api/posts', {
    params: {
      ...buildPageParams({ page: params.page, sort: params.sort }),
      category: params.category,
    },
    signal,
  });
  return data;
}

/** 게시글 상세(liked/likeCount/images 포함). */
export async function getPost(id: number): Promise<PostDetail> {
  const { data } = await api.get<PostDetail>(`/api/posts/${id}`);
  return data;
}

/**
 * 게시글 좋아요 토글(멱등). on=true POST / false DELETE.
 * 200 + 갱신된 PostDetail 반환 → 호출부에서 liked/likeCount 정합.
 */
export async function setPostLike(id: number, on: boolean): Promise<PostDetail> {
  const path = `/api/posts/${id}/like`;
  const { data } = on
    ? await api.post<PostDetail>(path)
    : await api.delete<PostDetail>(path);
  return data;
}
