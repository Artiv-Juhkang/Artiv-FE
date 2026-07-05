/**
 * 정본 쿼리키 팩토리 (계층형).
 *
 * 원칙:
 *  - 헤드 세그먼트(['series'], ['posts'] …)로 광역 invalidate가 가능하다.
 *  - list 키에는 정규화된 params를 내장한다 → 필터/정렬이 바뀌면 별도 캐시 엔트리.
 *    (정규화하지 않으면 키 순서/undefined 차이로 캐시 미스가 난다.)
 *  - 모든 키는 readonly tuple → @tanstack/react-query의 구조적 비교와 일치.
 *
 * 다른 곳에서 키를 직접 문자열로 쓰지 말 것 — 정본은 여기뿐.
 */

/**
 * params 객체를 키-순서 안정적인 정규화 형태로 변환.
 * undefined/null/'' 값은 제거해 "필터 없음"과 "빈 필터"가 같은 캐시를 쓰게 한다.
 * 키는 알파벳 정렬해 {a,b}와 {b,a}가 동일 키가 되도록 한다.
 */
function normalizeParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!params) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export const keys = {
  series: {
    all: ['series'] as const,
    list: (params?: Record<string, unknown>) =>
      ['series', 'list', normalizeParams(params)] as const,
    detail: (id: number) => ['series', 'detail', id] as const,
    mine: () => ['series', 'mine'] as const,
  },
  creativity: {
    all: ['creativity'] as const,
    types: () => ['creativity', 'types'] as const,
    // 디스커버 '전체' 레일 — 매체 타입별 page-0 미리보기(그리드 무한쿼리와 별도 캐시).
    rail: (typeKey: string) => ['creativity', 'rail', typeKey] as const,
  },
  episodes: {
    all: ['episodes'] as const,
    list: (seriesId: number) => ['episodes', 'list', seriesId] as const,
    detail: (seriesId: number, no: number) =>
      ['episodes', 'detail', seriesId, no] as const,
    comments: (seriesId: number, no: number) =>
      ['episodes', 'comments', seriesId, no] as const,
  },
  authors: {
    all: ['authors'] as const,
    series: (id: number) => ['authors', 'series', id] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: (params?: Record<string, unknown>) =>
      ['posts', 'list', normalizeParams(params)] as const,
    detail: (id: number) => ['posts', 'detail', id] as const,
    comments: (id: number) => ['posts', 'comments', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },
  me: {
    all: ['me'] as const,
    profile: () => ['me', 'profile'] as const,
    subscriptions: () => ['me', 'subscriptions'] as const,
    following: () => ['me', 'following'] as const,
    bookmarks: () => ['me', 'bookmarks'] as const,
    readHistory: () => ['me', 'readHistory'] as const,
  },
  users: {
    all: ['users'] as const,
    followStats: (id: number) => ['users', 'followStats', id] as const,
  },
} as const;
