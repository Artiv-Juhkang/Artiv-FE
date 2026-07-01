/**
 * 창작물 타입 레지스트리 훅 — GET /api/creativity/types.
 *
 * 타입 메타는 거의 정적이라 길게 캐시한다. 창작 탭의 타입 칩과 뷰어 분기가 이걸 소비 →
 * 백엔드에 ContentType 값을 추가하면 프론트 코드 변경 없이 새 타입이 자동 노출(타입=데이터).
 */
import { useQueries, useQuery } from '@tanstack/react-query';

import {
  getContentTypes,
  type ContentTypeMeta,
} from '@/api/endpoints/creativity';
import { listSeries } from '@/api/endpoints/series';
import type { SeriesSummary } from '@/api/types';
import { keys } from '@/lib/query';

export function useContentTypes() {
  return useQuery<ContentTypeMeta[]>({
    queryKey: keys.creativity.types(),
    queryFn: getContentTypes,
    staleTime: 1000 * 60 * 60, // 1h — 타입은 거의 바뀌지 않음
  });
}

/** 디스커버 '전체' 레일 한 줄. */
export interface DiscoverRail {
  type: ContentTypeMeta;
  series: SeriesSummary[];
  isLoading: boolean;
}

/** 레일당 미리보기 개수. */
const RAIL_SIZE = 8;

/**
 * 디스커버 '전체' — 매체 타입별 가로 레일 데이터.
 *
 * 레지스트리(useContentTypes)를 돌며 매체당 page-0 단건 쿼리를 useQueries 로 병렬 발사한다
 * (타입=데이터: 백엔드에 ContentType 추가 시 레일도 자동 등장). 무한쿼리(useSeriesList)와
 * 캐시키(keys.creativity.rail)를 분리해 그리드 데이터와 섞이지 않게 한다. 백엔드 변경 없이
 * GET /api/series 의 contentType+size 필터만 사용한다.
 */
export function useDiscoverRails(): DiscoverRail[] {
  const { data: types } = useContentTypes();
  const list = types ?? [];

  const results = useQueries({
    queries: list.map((ct) => ({
      queryKey: keys.creativity.rail(ct.key),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listSeries({ page: 0, sort: 'UPDATED', contentType: ct.key, size: RAIL_SIZE }, signal),
      staleTime: 1000 * 60 * 5, // 5m — 레일 미리보기
    })),
  });

  return list.map((ct, i) => ({
    type: ct,
    series: (results[i]?.data?.content ?? []).slice(0, RAIL_SIZE),
    isLoading: results[i]?.isLoading ?? true,
  }));
}
