/**
 * 서재(라이브러리) 데이터 레이어.
 * ------------------------------------------------------------------
 * 사용자 모델(improvement §3 확정 — 2계층): 1차 분류 창작물|커뮤니티, 창작물 하위:
 *   - 관심  = SUBSCRIPTION (작품 단위 personalization, /api/me/subscriptions).
 *            ※ "구독"이라는 단어는 쓰지 않는다 — 작품 관심 = subscription 엔드포인트.
 *   - 열람  = READ-HISTORY (/api/me/read-history) — useReadHistory를 재노출.
 *   - 팔로우 = FOLLOWING (/api/users/me/following, 비페이지 List) — 작가 축 기록.
 *            친구(상호 팔로우)는 별개 개념으로 탭3(채팅) 소관.
 * 커뮤니티 하위(내 글/내 댓글/추천)는 L2에서 배선. 회차 단위 북마크는 모델 밖(비노출).
 *
 * hooks.ts(시리즈) 패턴 미러: 무한쿼리는 OPTIONS 빌더만 반환(조건부 훅 호출 방지,
 * react-compiler 안전). 소비부에서 useInfiniteQuery로 실행한다.
 */
import { useQuery } from '@tanstack/react-query';

import { getSubscriptions } from '@/api/endpoints/personalization';
import { getMyFollowing } from '@/api/endpoints/users';
import type { FollowUserResponse, SubscriptionResponse } from '@/api/types';
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

/**
 * 팔로우한 사용자 목록 — 비페이지 List 일반 쿼리.
 * 팔로우 토글이 배선되는 화면(CH1 프로필 등)은 onSettled에서 keys.me.following()을
 * invalidate해 이 목록을 재동기해야 한다(현재 setFollow 소비처 없음 — 휴면).
 */
export function useMyFollowing() {
  return useQuery<FollowUserResponse[]>({
    queryKey: keys.me.following(),
    queryFn: ({ signal }) => getMyFollowing(signal),
  });
}
