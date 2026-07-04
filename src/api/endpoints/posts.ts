/**
 * 커뮤니티 게시글/댓글/좋아요.
 *
 * listPosts 는 정렬 가능(category/sort) → buildPageParams.
 * setPostLike 는 멱등 무바디(200) — 낙관 토글은 useToggleMutation으로(회차 좋아요와 동일).
 * 댓글 목록은 Page가 아닌 전체 List(회차 댓글과 달리 백엔드가 페이징하지 않음).
 */
import { api } from '@/api/client';
import { uploadMultipart, type RNFilePart } from '@/api/multipart';
import { buildPageParams } from '@/api/paging';
import type { PostCategory, PostComment, PostDetail, PostResponse, PostSort } from '@/api/types';
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

/** 글 작성(멀티파트 — 스칼라는 query, 이미지는 parts ≤5장 jpeg/png). 201 + {id}. */
export async function createPost(params: {
  category: PostCategory;
  title: string;
  content: string;
  images?: RNFilePart[];
}): Promise<{ id: number }> {
  return uploadMultipart<{ id: number }>('/api/posts', {
    query: { category: params.category, title: params.title, content: params.content },
    files: params.images?.length ? { images: params.images } : {},
  });
}

/** 글 삭제(작성자∥ADMIN, 204). */
export async function deletePost(id: number): Promise<void> {
  await api.delete(`/api/posts/${id}`);
}

/**
 * 게시글 좋아요 토글(멱등, 무바디 200). on=true POST / false DELETE.
 * (기존 'PostDetail 바디 반환' 기대는 백엔드 계약과 불일치했던 휴면 오류 — F9 정정.)
 */
export async function setPostLike(id: number, on: boolean): Promise<void> {
  const path = `/api/posts/${id}/like`;
  if (on) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}

/** 게시글 댓글 전체 목록(List — 대댓글은 replies로 중첩). */
export async function listPostComments(
  postId: number,
  signal?: AbortSignal,
): Promise<PostComment[]> {
  const { data } = await api.get<PostComment[]>(`/api/posts/${postId}/comments`, { signal });
  return data;
}

/** 게시글 댓글/대댓글 작성(201 + 생성 댓글 반환). parentId 지정 시 서버가 1-depth로 평탄화. */
export async function writePostComment(
  postId: number,
  content: string,
  parentId?: number,
): Promise<PostComment> {
  const { data } = await api.post<PostComment>(`/api/posts/${postId}/comments`, {
    content,
    parentId,
  });
  return data;
}
