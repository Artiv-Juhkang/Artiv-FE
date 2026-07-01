/**
 * 시리즈 엔드포인트.
 *
 * listSeries 는 탐색 목록이라 sort 허용(buildPageParams).
 * 구독은 멱등 POST(201)/DELETE(204) 무바디.
 */
import { api } from '@/api/client';
import { buildPageParams } from '@/api/paging';
import { uploadMultipart, type RNFilePart } from '@/api/multipart';
import type {
  AgeRating,
  DayOfWeek,
  Genre,
  SeriesDetail,
  SeriesSort,
  SeriesStatus,
  SeriesSummary,
} from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/** 작품 생성 요청 바디(백엔드 SeriesCreateRequest 미러). contentType/publishDays 는 매체별 선택. */
export interface CreateSeriesBody {
  title: string;
  description?: string;
  ageRating: AgeRating;
  status: SeriesStatus;
  contentType?: string; // ContentType 키. 미지정 시 백엔드가 WEBTOON.
  publishDays?: DayOfWeek[]; // 웹툰 연재요일
  adultOnly?: boolean;
  genre?: Genre;
  tags?: string[];
}

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
    /** 태그 정확일치 필터(검색 #태그 모드). 백엔드 :tag member of s.tags. */
    tag?: string;
    /** Page size override (디스커버 레일은 매체당 소량만 미리보기). 기본 20. */
    size?: number;
  },
  signal?: AbortSignal,
): Promise<PageResponse<SeriesSummary>> {
  const { data } = await api.get<PageResponse<SeriesSummary>>('/api/series', {
    params: {
      ...buildPageParams({ page: params.page, size: params.size, sort: params.sort }),
      genre: params.genre,
      keyword: params.keyword,
      day: params.day,
      contentType: params.contentType,
      tag: params.tag,
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

/** 작품 생성(작가). JSON 바디 → 생성된 작품 id. */
export async function createSeries(body: CreateSeriesBody): Promise<{ id: number }> {
  const { data } = await api.post<{ id: number }>('/api/series', body);
  return data;
}

/** 내 작품 목록(작가 본인). 페이지네이션 없는 배열. */
export async function getMySeries(): Promise<SeriesSummary[]> {
  const { data } = await api.get<SeriesSummary[]>('/api/series/mine');
  return data;
}

/** 작가 공개 프로필 — 특정 작가의 공개 작품 목록(비공개 제외). 배열. */
export async function getAuthorSeries(authorId: number): Promise<SeriesSummary[]> {
  const { data } = await api.get<SeriesSummary[]>(`/api/authors/${authorId}/series`);
  return data;
}

/** 커버 이미지 업로드(작가 본인) → 설정된 공개 URL. */
export async function uploadCover(
  seriesId: number,
  file: RNFilePart,
): Promise<{ coverUrl: string }> {
  return uploadMultipart<{ coverUrl: string }>(`/api/series/${seriesId}/cover`, {
    files: { cover: file },
  });
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
