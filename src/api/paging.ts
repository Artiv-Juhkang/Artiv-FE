/**
 * Spring Pageable 쿼리 파라미터 빌더 + fixed-sort 가드.
 *
 * 백엔드는 page/size/sort 쿼리를 받는다(Pageable). 배열 sort 는 반복 sort= 로 직렬화한다
 * (axios 기본 paramsSerializer 가 배열을 repeat 모드로 처리).
 *
 * 고정 정렬 목록(회차·내 글·내 댓글·추천·열람이력·소식피드 등)은 ?sort= 를 보내면
 * 서버가 무시하거나 400 → buildFixedSortParams 로 sort 를 strip(dev 는 throw 로 오용 감지).
 */

const DEFAULT_PAGE_SIZE = 20;

/**
 * 정렬 가능한 목록(탐색/관리자)용 page params.
 * sort 는 문자열 또는 문자열 배열(예: 'createdAt,desc' 또는 ['a,asc','b,desc']).
 */
export function buildPageParams(p: {
  page: number;
  size?: number;
  sort?: string | string[];
}): Record<string, unknown> {
  const params: Record<string, unknown> = {
    page: p.page,
    size: p.size ?? DEFAULT_PAGE_SIZE,
  };
  if (p.sort !== undefined) {
    // 빈 배열/빈 문자열은 전송하지 않음.
    if (Array.isArray(p.sort)) {
      if (p.sort.length > 0) params.sort = p.sort;
    } else if (p.sort.length > 0) {
      params.sort = p.sort;
    }
  }
  return params;
}

/**
 * 고정 정렬 목록용 page params. sort 를 절대 전송하지 않는다.
 * 호출부가 실수로 sort 를 넘기면 __DEV__ 에서 throw(버그 조기 발견), prod 에선 strip.
 */
export function buildFixedSortParams(p: {
  page: number;
  size?: number;
  // 타입상으론 막지만, 런타임 오용도 방어.
  sort?: never;
}): Record<string, unknown> {
  if ((p as { sort?: unknown }).sort !== undefined) {
    const msg =
      '[paging] 고정 정렬 목록에는 sort 를 전달할 수 없습니다. ' +
      '서버 정렬이 고정이라 ?sort= 가 무시되거나 400 을 유발합니다.';
    // __DEV__ 는 RN 글로벌. 미정의 환경 대비 typeof 가드.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      throw new Error(msg);
    }
  }
  return {
    page: p.page,
    size: p.size ?? DEFAULT_PAGE_SIZE,
  };
}
