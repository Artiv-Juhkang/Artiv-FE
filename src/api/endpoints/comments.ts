/**
 * 회차 댓글 엔드포인트 (대댓글 중첩 + 좋아요).
 *
 * 목록은 최상위 댓글 Page(각 항목에 replies 대댓글 중첩) — 서버 고정 최신순이라 ?sort 미전송.
 * 좋아요는 멱등 POST(201)/DELETE(204) 무바디.
 */
import { api } from '@/api/client';
import { buildFixedSortParams } from '@/api/paging';
import type { EpisodeComment } from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

export async function listEpisodeComments(
  seriesId: number,
  no: number,
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<EpisodeComment>> {
  const { data } = await api.get<PageResponse<EpisodeComment>>(
    `/api/series/${seriesId}/episodes/${no}/comments`,
    { params: buildFixedSortParams({ page }), signal },
  );
  return data;
}

/** 댓글/대댓글 작성. parentId 지정 시 대댓글(서버가 최상위 부모로 평탄화). → 생성 id. */
export async function writeEpisodeComment(
  seriesId: number,
  no: number,
  content: string,
  parentId?: number,
): Promise<{ id: number }> {
  const { data } = await api.post<{ id: number }>(
    `/api/series/${seriesId}/episodes/${no}/comments`,
    { content, parentId },
  );
  return data;
}

/** 댓글/대댓글 삭제(작성자·ADMIN). 부모 삭제 시 서버가 대댓글·좋아요까지 연쇄 삭제. */
export async function deleteEpisodeComment(
  seriesId: number,
  no: number,
  commentId: number,
): Promise<void> {
  await api.delete(`/api/series/${seriesId}/episodes/${no}/comments/${commentId}`);
}

/** 댓글/대댓글 좋아요 토글(멱등). on=true→POST, false→DELETE. 무바디. */
export async function setEpisodeCommentLike(
  seriesId: number,
  no: number,
  commentId: number,
  on: boolean,
): Promise<void> {
  const path = `/api/series/${seriesId}/episodes/${no}/comments/${commentId}/like`;
  if (on) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}
