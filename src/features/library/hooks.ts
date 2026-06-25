/**
 * 서재(라이브러리) 데이터 레이어.
 * ------------------------------------------------------------------
 * 사용자 모델(확정): 팔로우(작가) / 관심(작품) / 열람(자동 기록). 서재는 그중
 * 작품 단위 둘을 모은다:
 *   - 관심  = SUBSCRIPTION (작품 단위 personalization, /api/me/subscriptions).
 *            ※ "구독"이라는 단어는 쓰지 않는다 — 작품 관심 = subscription 엔드포인트.
 *   - 열람  = READ-HISTORY (/api/me/read-history) — useReadHistory를 재노출.
 * 회차 단위 북마크(/me/bookmarks)는 이 모델에 없으므로 서재에 노출하지 않는다.
 *
 * hooks.ts(시리즈) 패턴 미러: 무한쿼리는 OPTIONS 빌더만 반환(조건부 훅 호출 방지,
 * react-compiler 안전). 소비부에서 useInfiniteQuery로 실행한다.
 */
import { getSubscriptions } from '@/api/endpoints/personalization';
import type { SubscriptionResponse } from '@/api/types';
import { createPageInfiniteQuery, keys } from '@/lib/query';

// 열람 탭은 read-history와 동일 캐시를 쓰므로 시리즈 쪽 정본을 재노출(중복 키 금지).
export { useReadHistory } from '@/features/series/episode-hooks';

/**
 * 관심 목록(= 구독 엔드포인트) — fixed-sort Page 무한쿼리 OPTIONS.
 * keys.me.subscriptions() 단일 정본 — useSubscribeToggle가 onSettled에서 이 키를
 * invalidate하므로, 상세에서 ♥ 관심을 누르면 서재 관심 목록이 자동 갱신된다.
 *
 * 소비: const q = useInfiniteQuery(useSubscriptions());
 */
export function useSubscriptions() {
  return createPageInfiniteQuery<SubscriptionResponse>({
    queryKey: keys.me.subscriptions(),
    fetchPage: getSubscriptions,
  });
}
