/**
 * 에피소드 데이터 레이어 — 시리즈 상세의 회차 영역 전용 훅들.
 *
 * 데이터 응집을 위해 에피소드 훅은 hooks.ts(시리즈)와 분리해 이 파일이 단독 소유한다.
 *
 *  - useEpisodeList:           회차 Slice 무한쿼리 OPTIONS(소비부 useInfiniteQuery).
 *  - useEpisodeBookmarkToggle: 에피소드-스코프 북마크 낙관 토글(detail 캐시 없음 → plain).
 *  - useReadHistory:           read-history Page 무한쿼리 OPTIONS(서재와 캐시 공유).
 *  - useReadState:             read-history 에서 한 시리즈의 lastReadEpisodeNo 셀렉트.
 *
 * hooks.ts 패턴 미러: 무한쿼리는 OPTIONS 빌더만 반환(조건부 훅 호출 방지, react-compiler 안전).
 * useReadState 만 파생값을 직접 반환(셀렉터).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getReadHistory,
  setEpisodeBookmark,
} from '@/api/endpoints/personalization';
import { listEpisodes, setEpisodeLike } from '@/api/endpoints/episodes';
import type {
  EpisodeDetail,
  EpisodeSummary,
  ReadHistoryResponse,
} from '@/api/types';
import {
  createPageInfiniteQuery,
  createSliceInfiniteQuery,
  keys,
  useToggleMutation,
} from '@/lib/query';

/**
 * 회차 목록 — Slice 기반 무한쿼리 OPTIONS.
 *
 * listEpisodes 는 (seriesId, page, signal) 위치인자(파라미터 객체 아님)이며 fixed-sort 라
 * ?sort 를 절대 전송하지 않는다(buildFixedSortParams, DEV throw). enabled 로 seriesId 가
 * settle 되기 전 헛 요청을 막는다.
 *
 * 소비: const q = useInfiniteQuery(useEpisodeList(seriesId));
 *       const eps = flattenInfinite(q.data, e => e.episodeNo!); // 페이지 경계 꼬리 중복 de-dupe
 * 1↔N 정렬 토글은 flatten 결과를 컴포넌트가 클라이언트 reverse(쿼리키/요청 불변).
 */
export function useEpisodeList(seriesId: number) {
  return createSliceInfiniteQuery<EpisodeSummary>({
    queryKey: keys.episodes.list(seriesId),
    fetchPage: (page, signal) => listEpisodes(seriesId, page, signal),
    enabled: Number.isFinite(seriesId) && seriesId > 0,
  });
}

/**
 * 에피소드 북마크 토글 — 에피소드-스코프 멱등 POST(201)/DELETE(204) 무바디.
 *
 * 구독과 달리 patch 할 detail 캐시가 없다(에피소드 북마크 상태는 단건 캐시 없음) →
 * useToggleMutation(detail patch) 대신 plain optimistic useMutation.
 * 낙관 상태는 호출부(EpisodeRow)가 로컬로 들고, onSettled 에서 서재 북마크 목록을
 * invalidate 해 서버 진실과 재동기한다.
 *
 * 사용: const bm = useEpisodeBookmarkToggle(seriesId, episodeNo); bm.mutate(next);
 */
export function useEpisodeBookmarkToggle(seriesId: number, episodeNo: number) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, boolean>({
    mutationFn: (next: boolean) =>
      setEpisodeBookmark(seriesId, episodeNo, next),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.me.bookmarks() });
    },
  });
}

/**
 * 회차 좋아요(추천) 토글 — 회차-스코프 멱등 POST(201)/DELETE(204) 무바디.
 *
 * 구독과 동일하게 patch 대상 detail 캐시(keys.episodes.detail)가 있으므로
 * useToggleMutation 팩토리를 그대로 쓴다. onMutate 에서 liked 를 뒤집고 likeCount 를
 * ±1(음수 방지), 실패 시 스냅샷 롤백, onSettled 에서 detail 을 invalidate 해 서버값과 재동기.
 *
 * 사용: const like = useEpisodeLikeToggle(seriesId, no); like.mutate(next);
 */
export function useEpisodeLikeToggle(seriesId: number, episodeNo: number) {
  return useToggleMutation<EpisodeDetail>({
    targetKey: keys.episodes.detail(seriesId, episodeNo),
    mutationFn: (next: boolean) => setEpisodeLike(seriesId, episodeNo, next),
    apply: (prev, next) =>
      prev
        ? {
            ...prev,
            liked: next,
            likeCount: Math.max(0, (prev.likeCount ?? 0) + (next ? 1 : -1)),
          }
        : prev,
  });
}

/**
 * read-history 무한쿼리 OPTIONS — 서재(라이브러리)와 동일 캐시 키를 공유한다.
 *
 * fixed-sort Page. keys.me.readHistory() 단일 정본 — useResumePoint(상세 CTA)/useReadState
 * (회차 행 읽음·이어보기 마커)가 같은 캐시를 읽는다(새 쿼리키 추가 금지).
 *
 * 소비: const q = useInfiniteQuery(useReadHistory());
 */
export function useReadHistory() {
  return createPageInfiniteQuery<ReadHistoryResponse>({
    queryKey: keys.me.readHistory(),
    fetchPage: getReadHistory,
  });
}

/** 한 시리즈의 읽음 경계. 회차 행이 isRead(no <= lastRead)/continue(boundary)를 도출. */
export interface ReadState {
  lastReadEpisodeNo: number | undefined;
}

/**
 * 회차 행 읽음/이어보기 셀렉터 — read-history 페이지 0 에서 seriesId 의 lastReadEpisodeNo 셀렉트.
 *
 * useResumePoint 와 동일 캐시(keys.me.readHistory(), 페이지 0)를 읽는다.
 *  - isRead   = (episodeNo <= lastReadEpisodeNo)
 *  - continue = lastReadEpisodeNo + 1 경계 행
 * read-history 비었음/이 시리즈 미존재 → lastReadEpisodeNo undefined(읽음 표시 없음).
 */
export function useReadState(seriesId: number): ReadState {
  const { data } = useQuery({
    queryKey: keys.me.readHistory(),
    queryFn: ({ signal }) => getReadHistory(0, signal),
    enabled: Number.isFinite(seriesId) && seriesId > 0,
  });

  const entry = data?.content.find(
    (h: ReadHistoryResponse) => h.seriesId === seriesId,
  );
  return { lastReadEpisodeNo: entry?.lastReadEpisodeNo ?? undefined };
}
