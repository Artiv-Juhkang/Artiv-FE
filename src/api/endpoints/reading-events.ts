/**
 * 열람 계측 전송 (창작자 온톨로지).
 *
 * fire-and-forget — 실패해도 뷰어 동작에 영향을 주지 않고 재시도하지 않는다.
 * 분석 이벤트는 결제가 아니므로 at-most-once로 충분하다.
 */
import { api } from '@/api/client';

export type EntryPoint =
  | 'DISCOVER'
  | 'SEARCH'
  | 'NOTIFICATION'
  | 'SUBSCRIPTION'
  | 'AUTHOR'
  | 'LIBRARY'
  | 'DIRECT';

export interface ReadingEventInput {
  seriesId: number;
  episodeNo: number;
  entryPoint: EntryPoint;
  progressPct: number;
  completed: boolean;
  dwellMs: number;
  sessionId: string;
}

export async function sendReadingEvent(input: ReadingEventInput): Promise<void> {
  try {
    await api.post('/api/reading-events', input);
  } catch {
    // 계측 실패는 조용히 무시한다.
  }
}
