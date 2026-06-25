/**
 * 독자 서재 목록: 구독·북마크·읽기기록(모두 fixed-sort Page).
 *
 * 셋 다 고정 정렬 → buildFixedSortParams(sort 미전송).
 */
import { api } from '@/api/client';
import { buildFixedSortParams } from '@/api/paging';
import type {
  BookmarkResponse,
  ReadHistoryResponse,
  SubscriptionResponse,
} from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/** 내 구독 목록(Page, 고정 정렬). */
export async function getSubscriptions(
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<SubscriptionResponse>> {
  const { data } = await api.get<PageResponse<SubscriptionResponse>>(
    '/api/me/subscriptions',
    { params: buildFixedSortParams({ page }), signal },
  );
  return data;
}

/** 내 북마크 목록(Page, 고정 정렬). */
export async function getBookmarks(
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<BookmarkResponse>> {
  const { data } = await api.get<PageResponse<BookmarkResponse>>(
    '/api/me/bookmarks',
    { params: buildFixedSortParams({ page }), signal },
  );
  return data;
}

/** 내 열람 이력(Page, 고정 정렬). */
export async function getReadHistory(
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<ReadHistoryResponse>> {
  const { data } = await api.get<PageResponse<ReadHistoryResponse>>(
    '/api/me/read-history',
    { params: buildFixedSortParams({ page }), signal },
  );
  return data;
}

/**
 * 에피소드 북마크 토글(에피소드-스코프, 멱등). on=true → POST(201), false → DELETE(204).
 * 둘 다 무바디 → void. setEpisodeLike 와 동일 형태.
 */
export async function setEpisodeBookmark(
  seriesId: number,
  no: number,
  on: boolean,
): Promise<void> {
  const path = `/api/series/${seriesId}/episodes/${no}/bookmark`;
  if (on) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}
