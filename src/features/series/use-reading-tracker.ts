/**
 * 뷰어 열람 추적 — 진도율·체류시간을 모아 화면을 떠날 때 1회만 전송한다.
 *
 * 스크롤마다 보내면 이벤트가 100배가 된다. 정밀도를 버리고 볼륨을 얻는 의도적
 * 트레이드오프다(설계문서 §5-2). 그래서 진도는 ref에만 쌓고 리렌더를 일으키지 않는다.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { sendReadingEvent, type EntryPoint } from '@/api/endpoints/reading-events';

/** 완독 판정 기준(%). 백엔드 집계와 같은 값. */
const COMPLETED_AT = 95;

function newSessionId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // crypto가 없는 런타임 대비 폴백(RFC4122 v4 형태).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useReadingTracker(params: {
  seriesId: number;
  episodeNo: number;
  entryPoint?: EntryPoint;
}) {
  const { seriesId, episodeNo, entryPoint = 'DIRECT' } = params;

  const sessionId = useRef(newSessionId());
  const startedAt = useRef(Date.now());
  const progress = useRef(0);
  const sent = useRef(false);

  /** 스크롤할 때마다 호출. 도달한 최대값만 유지한다. */
  const reportProgress = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    if (clamped > progress.current) progress.current = clamped;
  }, []);

  const flush = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    void sendReadingEvent({
      seriesId,
      episodeNo,
      entryPoint,
      progressPct: progress.current,
      completed: progress.current >= COMPLETED_AT,
      dwellMs: Date.now() - startedAt.current,
      sessionId: sessionId.current,
    });
  }, [seriesId, episodeNo, entryPoint]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // 'inactive'는 iOS에서 알림 배너·제어센터 같은 일시적 상태에도 뜬다. 그때 flush하면
      // 읽기 시작 직후 0%로 기록되고, sent 래치 때문에 이후 실제 열람이 통째로 유실된다.
      // 'background'만 실제 이탈로 본다.
      if (s === 'background') {
        flush();
        // 재무장 — 복귀해서 계속 읽으면 그건 새 열람 세션이다(재열람을 세는 것이 설계 의도).
        sent.current = false;
        sessionId.current = newSessionId();
        startedAt.current = Date.now();
      }
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  return { reportProgress };
}
