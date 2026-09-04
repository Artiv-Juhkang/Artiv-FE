/**
 * 유입 경로(EntryPoint) 세션 스코프 저장소.
 *
 * 작가가 "유입 경로"에서 알고 싶은 것은 **독자가 이 작품에 어떻게 도달했나**이지
 * 회차에 어떻게 도달했나가 아니다. 그래서 값을 잡는 곳은 회차가 아니라 **작품 진입**이고,
 * 그 방문 동안의 회차 열람 전부가 같은 경로로 귀속된다.
 *
 * **seriesId를 함께 들고 일치할 때만 쓴다.** 딥링크(artiv://series/N/M)로 다른 작품의
 * 뷰어에 바로 들어가면 직전 작품의 경로가 새어 조용히 틀린 값이 기록되는데,
 * 그건 DIRECT로 떨어지는 것보다 나쁘다 — 틀린 데이터가 없는 데이터보다 해롭다.
 *
 * 모듈 싱글톤인 이유: 값이 하나뿐이고 렌더에 관여하지 않아 Context가 줄 게 없다.
 */
import type { EntryPoint } from '@/api/endpoints/reading-events';

let last: { seriesId: number; entryPoint: EntryPoint } | null = null;

/** 작품으로 이동하기 직전에 호출. 서재 이어보기처럼 뷰어로 직행하는 경로도 포함한다. */
export function markSeriesEntry(seriesId: number, entryPoint: EntryPoint): void {
  if (!Number.isFinite(seriesId)) return;
  last = { seriesId, entryPoint };
}

/** 이 작품에 대해 기록된 경로. 다른 작품의 값이거나 없으면 DIRECT. */
export function entryPointFor(seriesId: number): EntryPoint {
  return last && last.seriesId === seriesId ? last.entryPoint : 'DIRECT';
}
