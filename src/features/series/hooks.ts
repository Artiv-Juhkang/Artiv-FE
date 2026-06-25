/**
 * 참조 vertical 데이터 훅 — 시리즈 목록(무한쿼리) / 상세 / 구독 낙관 토글.
 *
 * 이 모듈은 "한 도메인을 React Query로 어떻게 배선하는가"의 레퍼런스다.
 * 다른 vertical(에피소드·커뮤니티·알림 등)은 이 파일의 패턴을 그대로 복제한다.
 *
 *  - useSeriesList:   탐색 목록. 정렬·장르·키워드 필터를 받아 Page 기반 무한쿼리.
 *  - useSeriesDetail: 단건 상세. 구독 토글 낙관 업데이트가 patch하는 캐시.
 *  - useSubscribeToggle: 멱등 구독 POST/DELETE → SeriesDetail.isSubscribed 낙관 토글.
 */
import { useQuery } from '@tanstack/react-query';

import { getReadHistory } from '@/api/endpoints/personalization';
import { getSeries, listSeries, setSubscription } from '@/api/endpoints/series';
import type {
  DayOfWeek,
  Genre,
  ReadHistoryResponse,
  SeriesDetail,
  SeriesSort,
} from '@/api/types';
import { createPageInfiniteQuery, keys, useToggleMutation } from '@/lib/query';

/** 목록 필터 파라미터. 모두 선택적 — 미지정 시 서버 기본(LATEST, 전체 장르, 요일 무관). */
export interface SeriesListParams {
  sort?: SeriesSort;
  genre?: Genre;
  keyword?: string;
  day?: DayOfWeek;
}

/**
 * 시리즈 탐색 목록 — Page 기반 무한쿼리.
 *
 * 정렬 가능한 탐색 목록이므로 sort/genre/keyword를 쿼리키에 정규화해 내장한다
 * (keys.series.list가 처리). 필터가 바뀌면 별도 캐시 엔트리가 생기고,
 * 같은 필터 조합은 캐시를 공유한다.
 *
 * createPageInfiniteQuery는 그 자체가 훅이므로 항상 무조건 호출한다
 * (react-compiler / hooks 규칙). fetchPage에 signal을 그대로 넘겨
 * 페이지 취소(언마운트·필터 변경)를 지원한다.
 */
export function useSeriesList(params: SeriesListParams = {}) {
  const { sort, genre, keyword, day } = params;
  return createPageInfiniteQuery({
    queryKey: keys.series.list({ sort, genre, keyword, day }),
    fetchPage: (page, signal) =>
      listSeries({ page, sort, genre, keyword, day }, signal),
  });
}

/**
 * 시리즈 단건 상세.
 *
 * id가 유효(> 0)할 때만 enabled — 라우트 파라미터가 settle되기 전이나
 * 잘못된 값에서 헛 요청을 막는다. 이 쿼리의 캐시(keys.series.detail(id))가
 * useSubscribeToggle의 낙관 업데이트 타깃이다.
 */
export function useSeriesDetail(id: number) {
  return useQuery<SeriesDetail>({
    queryKey: keys.series.detail(id),
    queryFn: () => getSeries(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/**
 * 구독 토글 — 멱등 POST(201)/DELETE(204) 무바디.
 *
 * 서버가 바디를 안 주므로 토글 결과는 SeriesDetail 캐시에 직접 patch한다
 * (apply). onMutate에서 즉시 isSubscribed를 뒤집고, 실패하면 useToggleMutation이
 * 스냅샷으로 롤백한다. onSettled에서 상세 + 내 구독 목록(서재)을 invalidate해
 * 서버 진실과 재동기화한다.
 *
 * 사용: const sub = useSubscribeToggle(seriesId); sub.mutate(nextBoolean);
 */
export function useSubscribeToggle(seriesId: number) {
  return useToggleMutation<SeriesDetail>({
    targetKey: keys.series.detail(seriesId),
    mutationFn: (next: boolean) => setSubscription(seriesId, next),
    apply: (prev, next) => (prev ? { ...prev, isSubscribed: next } : prev),
    invalidate: [keys.me.subscriptions()],
  });
}

/** 첫화/이어보기 CTA 결정 결과. episodeNo 는 시작 회차(1-기반). */
export interface ResumePoint {
  mode: 'first' | 'resume';
  episodeNo: number;
}

/**
 * 첫화 보기 / 이어보기 CTA 셀렉터 — read-history 기반.
 *
 * 정본은 read-history(서재와 동일 캐시 keys.me.readHistory() — 새 쿼리키 추가 금지).
 * 페이지 0만 조회해 seriesId 항목을 찾는다:
 *  - lastReadEpisodeNo 있음 → mode:'resume', episodeNo: lastReadEpisodeNo + 1 (다음 화).
 *  - 없음/로딩 중/이 시리즈가 페이지 0 밖 → mode:'first', episodeNo: 1 (안전 기본, 블로킹 없음).
 *
 * latest 클램프(min(lastRead+1, latestEpisodeNo))는 호출부(상세 CTA)가 SeriesDetail.latestEpisodeNo로
 * 수행한다 — read-history 엔 latest 가 없다. 페이지 0 밖으로 밀린 경우의 폴백(SubscriptionResponse.
 * lastReadEpisodeNo)도 호출부 선택 사항이다.
 */
export function useResumePoint(seriesId: number): ResumePoint {
  const { data } = useQuery({
    queryKey: keys.me.readHistory(),
    queryFn: ({ signal }) => getReadHistory(0, signal),
    enabled: Number.isFinite(seriesId) && seriesId > 0,
  });

  const entry = data?.content.find(
    (h: ReadHistoryResponse) => h.seriesId === seriesId,
  );
  const lastRead = entry?.lastReadEpisodeNo;
  if (lastRead !== undefined && lastRead !== null) {
    return { mode: 'resume', episodeNo: lastRead + 1 };
  }
  return { mode: 'first', episodeNo: 1 };
}
