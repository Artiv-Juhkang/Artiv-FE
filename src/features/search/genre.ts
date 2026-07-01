/**
 * 장르 라벨 + 검색어 파싱.
 *
 * 백엔드 Genre enum(10종)의 한글 표시 라벨과, 검색창의 '#…' 입력을 장르/태그로
 * 해석하는 규칙을 한곳에 둔다. 백엔드는 genre·tag 모두 '정확 일치'라, 자유 태그
 * 입력은 빈약하므로 알려진 장르 라벨을 먼저 매칭하고(스릴러→THRILLER) 안 맞으면
 * 자유 태그로 폴백한다(사용자 결정: 장르 우선 → 태그 폴백).
 */
import type { Genre } from '@/api/types';

/** Genre enum → 한글 표시 라벨(프론트 매핑 — 백엔드는 라벨을 안 내려줌). */
export const GENRE_LABEL: Record<Genre, string> = {
  ROMANCE: '로맨스',
  FANTASY: '판타지',
  ACTION: '액션',
  DRAMA: '드라마',
  DAILY: '일상',
  COMEDY: '코미디',
  THRILLER: '스릴러',
  SPORTS: '스포츠',
  HORROR: '공포',
  ETC: '기타',
};

/** 칩/추천에 노출할 장르 순서(ETC는 검색 추천에서 제외 — '기타'는 탐색 가치 낮음). */
export const GENRE_SUGGESTIONS: Genre[] = [
  'ROMANCE',
  'FANTASY',
  'ACTION',
  'DRAMA',
  'DAILY',
  'COMEDY',
  'THRILLER',
  'SPORTS',
  'HORROR',
];

const LABEL_TO_GENRE: Record<string, Genre> = Object.fromEntries(
  (Object.entries(GENRE_LABEL) as [Genre, string][]).map(([g, label]) => [label, g]),
) as Record<string, Genre>;

export type ParsedSearch =
  | { mode: 'keyword'; raw: string; keyword: string }
  | { mode: 'genre'; raw: string; genre: Genre; label: string }
  | { mode: 'tag'; raw: string; tag: string }
  | { mode: 'empty'; raw: string };

/**
 * 검색어 해석:
 *  - 빈 문자열            → empty
 *  - '#' 시작 + 장르 라벨 → genre(스릴러→THRILLER)
 *  - '#' 시작 + 그 외     → tag(자유 태그 정확일치)
 *  - 그 외                → keyword(제목·작가)
 */
export function parseSearch(raw: string): ParsedSearch {
  const q = raw.trim();
  if (q.length === 0) return { mode: 'empty', raw };
  if (q.startsWith('#')) {
    const token = q.slice(1).trim();
    if (token.length === 0) return { mode: 'empty', raw };
    const genre = LABEL_TO_GENRE[token];
    if (genre) return { mode: 'genre', raw, genre, label: token };
    return { mode: 'tag', raw, tag: token };
  }
  return { mode: 'keyword', raw, keyword: q };
}
