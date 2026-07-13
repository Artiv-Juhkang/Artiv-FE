/** 게시글 카테고리 등록제(C7) — 이름 자체가 표시 라벨. 삭제 없음(가산 전용). */
import { api } from '@/api/client';
import type { PostCategoryResponse } from '@/api/types';

export async function listPostCategories(signal?: AbortSignal): Promise<PostCategoryResponse[]> {
  const { data } = await api.get<PostCategoryResponse[]>('/api/post-categories', { signal });
  return data;
}

/** 새 카테고리 등록(중복 409). */
export async function createPostCategory(name: string): Promise<PostCategoryResponse> {
  const { data } = await api.post<PostCategoryResponse>('/api/post-categories', { name });
  return data;
}
