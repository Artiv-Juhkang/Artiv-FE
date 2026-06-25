/**
 * Page/Slice 무한쿼리 헬퍼 + 평탄화.
 *
 * 백엔드 페이징 두 형태:
 *  - Page  {content,page,size,totalElements,totalPages,last}  — 목록/댓글/활동 (전체 개수 필요)
 *    next = last ? 끝 : page+1
 *  - Slice {content,page,size,hasNext}                         — 에피소드 목록 전용 (무한스크롤)
 *    next = hasNext ? page+1 : 끝
 *
 * 두 헬퍼 모두 initialPageParam:0. reactCompiler 환경이므로 헬퍼 자체가 훅을
 * 호출하지 않고, 호출부에서 useInfiniteQuery(options)로 무조건 호출하도록
 * 타입이 맞는 "options 빌더"를 반환한다(조건부 훅 호출 방지).
 *
 * 빌더는 v5 infiniteQueryOptions로 만들어 TData(=InfiniteData<page>) 추론을
 * 정확히 위임한다 — 수기 제네릭 mismatch 방지.
 */
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import { DEFAULT_STALE_TIME } from './queryClient';

/** Page<T>: totalElements/totalPages가 있는 전체-카운트 페이징. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** Slice<T>: hasNext만 있는 무한스크롤용 경량 페이징 (에피소드 목록). */
export interface SliceResponse<T> {
  content: T[];
  page: number;
  size: number;
  hasNext: boolean;
}

interface InfiniteQueryFactoryOpts<TPage> {
  queryKey: readonly unknown[];
  /** page 번호와 AbortSignal을 받아 한 페이지를 가져온다. */
  fetchPage: (page: number, signal: AbortSignal) => Promise<TPage>;
  staleTime?: number;
  enabled?: boolean;
}

/**
 * Page 페이징 무한쿼리 옵션 빌더.
 * getNextPageParam: last면 undefined(끝), 아니면 page+1.
 *
 * 사용: const q = useInfiniteQuery(createPageInfiniteQuery({...}));
 *       const items = flattenInfinite(q.data);
 */
export function createPageInfiniteQuery<T>(
  opts: InfiniteQueryFactoryOpts<PageResponse<T>>,
) {
  return infiniteQueryOptions<
    PageResponse<T>,
    Error,
    InfiniteData<PageResponse<T>, number>,
    readonly unknown[],
    number
  >({
    queryKey: opts.queryKey,
    queryFn: ({ pageParam, signal }) => opts.fetchPage(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.last ? undefined : lastPage.page + 1,
    staleTime: opts.staleTime ?? DEFAULT_STALE_TIME,
    enabled: opts.enabled,
  });
}

/**
 * Slice 페이징 무한쿼리 옵션 빌더 (에피소드 목록).
 * getNextPageParam: hasNext면 page+1, 아니면 undefined(끝).
 */
export function createSliceInfiniteQuery<T>(
  opts: InfiniteQueryFactoryOpts<SliceResponse<T>>,
) {
  return infiniteQueryOptions<
    SliceResponse<T>,
    Error,
    InfiniteData<SliceResponse<T>, number>,
    readonly unknown[],
    number
  >({
    queryKey: opts.queryKey,
    queryFn: ({ pageParam, signal }) => opts.fetchPage(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
    staleTime: opts.staleTime ?? DEFAULT_STALE_TIME,
    enabled: opts.enabled,
  });
}

/**
 * 무한쿼리 data를 단일 배열로 평탄화.
 * keyOf가 주어지면 중복 항목을 제거한다 — Slice 페이징은 새 항목이 끼어들면
 * 페이지 경계에서 같은 항목이 두 번 올 수 있어(꼬리 중복) de-dupe가 필요.
 *
 * 가드: data가 undefined면 [] 반환(로딩 중 안전).
 */
export function flattenInfinite<T>(
  data: { pages: { content: T[] }[] } | undefined,
  keyOf?: (item: T) => string | number,
): T[] {
  if (!data) return [];
  const flat = data.pages.flatMap((p) => p.content);
  if (!keyOf) return flat;
  const seen = new Set<string | number>();
  const out: T[] = [];
  for (const item of flat) {
    const k = keyOf(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** infinite 헬퍼와 함께 자주 쓰는 useInfiniteQuery 재노출(소비부 import 1줄). */
export { useInfiniteQuery };
