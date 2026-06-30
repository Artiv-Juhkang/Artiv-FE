/**
 * 시리즈 엔드포인트.
 *
 * listSeries 는 탐색 목록이라 sort 허용(buildPageParams).
 * 구독은 멱등 POST(201)/DELETE(204) 무바디.
 */
import { api } from '@/api/client';
import { buildPageParams } from '@/api/paging';
import type {
  DayOfWeek,
  Genre,
  SeriesDetail,
  SeriesSort,
  SeriesSummary,
} from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/**
 * 시리즈 목록(Page, 정렬 가능).
 *
 * buildPageParams 는 page+sort 만 처리한다(정렬 가능 목록). day/genre/keyword 는
 * 별도 필드로 넘기며, undefined 면 axios 가 쿼리에서 자동 생략한다(요일 무관 전체 목록).
 * @param signal AbortSignal — 무한쿼리 취소용.
 */
export async function listSeries(
  params: {
    page: number;
    sort?: SeriesSort;
    genre?: Genre;
    keyword?: string;
    day?: DayOfWeek;
    contentType?: string;
  },
  signal?: AbortSignal,
): Promise<PageResponse<SeriesSummary>> {
  const { data } = await api.get<PageResponse<SeriesSummary>>('/api/series', {
    params: {
      ...buildPageParams({ page: params.page, sort: params.sort }),
      genre: params.genre,
      keyword: params.keyword,
      day: params.day,
      contentType: params.contentType,
    },
    signal,
  });
  return data;
}

/** 시리즈 상세(구독 상태/공개정책 포함). 19금 + 미성년 → ADULT_ONLY(403)는 호출부 처리. */
export async function getSeries(id: number): Promise<SeriesDetail> {
  const { data } = await api.get<SeriesDetail>(`/api/series/${id}`);
  return data;
}

/**
 * 구독 토글(멱등). on=true → POST(구독), false → DELETE(해제). 무바디.
 */
export async function setSubscription(
  seriesId: number,
  on: boolean,
): Promise<void> {
  const path = `/api/series/${seriesId}/subscription`;
  if (on) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}
