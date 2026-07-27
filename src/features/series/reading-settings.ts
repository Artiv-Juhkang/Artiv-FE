/**
 * 소설 읽기 설정 — 글자 크기 저장/복원.
 * ------------------------------------------------------------------
 * 소설은 오래 붙잡고 읽는 화면이라 "내 눈에 맞는 크기"가 곧 사용성이다. 앱을 껐다 켜도
 * 유지돼야 의미가 있으므로 테마 모드와 같은 방식(AsyncStorage)으로 영속한다.
 *
 * 읽기 폭(measure)은 설정 대상이 아니다 — 한 줄이 너무 길면 다음 줄을 찾는 눈의 이동이
 * 커져서 읽기가 힘들어지는데, 그 적정선은 취향이 아니라 활자 크기에서 따라 나온다.
 * 그래서 폭은 NovelReader가 글자 크기로부터 계산한다.
 *
 * 세피아·줄간격은 아직 넣지 않았다: 세피아는 확정 대기 중인 accent 팔레트와 같이 정해야
 * 색이 두 번 바뀌지 않고, 줄간격은 크기와 함께 움직이는 편이 조작할 것이 적다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** 본문 글자 크기 단계. 기본은 17(기존 하드코딩 값과 동일 — 쓰던 사람의 화면이 안 바뀐다). */
export const READER_FONT_SIZES = [15, 17, 19, 22] as const;
export type ReaderFontSize = (typeof READER_FONT_SIZES)[number];

export const DEFAULT_READER_FONT_SIZE: ReaderFontSize = 17;

/** 테마 모드 키와 같은 네임스페이스(리네임은 P3에서 일괄). */
export const READER_FONT_SIZE_STORAGE_KEY = '@apptoon/reader-font-size';

/** 한글 본문에 편한 배수. 크게 볼수록 행간 배수는 살짝 줄여야 덩어리져 보이지 않는다. */
export function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * (fontSize >= 22 ? 1.65 : 1.76));
}

/**
 * 읽기 폭(dp) — 한 줄에 대략 34~40자가 오도록 글자 크기에서 끌어낸다.
 * 넓은 화면에서 본문이 화면 끝까지 늘어나면 줄을 놓치기 쉬워진다.
 */
export function readingWidthFor(fontSize: number): number {
  return Math.round(fontSize * 36);
}

function parseSize(raw: string | null): ReaderFontSize | null {
  const n = Number(raw);
  return (READER_FONT_SIZES as readonly number[]).includes(n) ? (n as ReaderFontSize) : null;
}

/**
 * 저장된 글자 크기를 읽고 바꾼다. 하이드레이션 전에는 기본값을 쓴다 — 본문이 잠깐 뜬 뒤
 * 크기가 바뀌는 것보다, 기본값으로 그렸다가 저장값으로 한 번 맞추는 쪽이 덜 거슬린다.
 */
export function useReaderFontSize() {
  const [fontSize, setFontSizeState] = useState<ReaderFontSize>(DEFAULT_READER_FONT_SIZE);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(READER_FONT_SIZE_STORAGE_KEY)
      .then((raw) => {
        const stored = parseSize(raw);
        if (alive && stored) setFontSizeState(stored);
      })
      .catch(() => {
        // 저장소를 못 읽어도 읽기는 계속돼야 한다 — 기본값으로 둔다.
      });
    return () => {
      alive = false;
    };
  }, []);

  const setFontSize = useCallback((next: ReaderFontSize) => {
    setFontSizeState(next);
    AsyncStorage.setItem(READER_FONT_SIZE_STORAGE_KEY, String(next)).catch(() => {
      // 저장 실패는 이번 세션 동안만 적용되는 것으로 감수한다.
    });
  }, []);

  return { fontSize, setFontSize };
}
