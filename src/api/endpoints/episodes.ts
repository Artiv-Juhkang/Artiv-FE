/**
 * 에피소드 엔드포인트(목록은 Slice + fixed-sort).
 *
 * listEpisodes 는 고정 정렬 → buildFixedSortParams(sort 미전송).
 * markRead 는 호출부(hook)에서 locked 면 미호출(잠긴 회차는 읽음 처리 금지).
 */
import { api } from '@/api/client';
import { buildFixedSortParams } from '@/api/paging';
import type { EpisodeDetail, EpisodeSummary } from '@/api/types';
import type { SliceResponse } from '@/lib/query/infinite';

/** 회차 목록(Slice, 고정 정렬). 항목에 locked/freeAt 포함(자물쇠 배지용). */
export async function listEpisodes(
  seriesId: number,
  page: number,
  signal?: AbortSignal,
): Promise<SliceResponse<EpisodeSummary>> {
  const { data } = await api.get<SliceResponse<EpisodeSummary>>(
    `/api/series/${seriesId}/episodes`,
    {
      params: buildFixedSortParams({ page }),
      signal,
    },
  );
  return data;
}

/**
 * 회차 상세. 잠긴 회차는 에러가 아니라 200 + { locked:true, lockReason:'WAIT', freeAt, images:[] }.
 * 19금 + 미성년 → ADULT_ONLY(403)는 호출부 처리.
 */
export async function getEpisode(
  seriesId: number,
  no: number,
): Promise<EpisodeDetail> {
  const { data } = await api.get<EpisodeDetail>(
    `/api/series/${seriesId}/episodes/${no}`,
  );
  return data;
}

/** 회차 좋아요 토글(멱등). on=true POST / false DELETE. 무바디. */
export async function setEpisodeLike(
  seriesId: number,
  no: number,
  on: boolean,
): Promise<void> {
  const path = `/api/series/${seriesId}/episodes/${no}/like`;
  if (on) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}

/** 읽음 처리(멱등 POST). 잠긴 회차에는 호출하지 말 것(hook 가드). */
export async function markRead(seriesId: number, no: number): Promise<void> {
  await api.post(`/api/series/${seriesId}/episodes/${no}/read`);
}
