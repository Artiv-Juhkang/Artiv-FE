/**
 * 사용자 프로필 vertical 데이터 훅 (CH1) — features/series/hooks.ts 패턴 복제.
 *
 *  - useUserProfile: 공개 프로필(비공개면 bio·가입일 null로 온다).
 *  - useFollowStats: 팔로워/팔로잉 수 + 나와의 관계(isFollowing/isFollowedBy/isMutual).
 *  - useFollowToggle: 멱등 무바디 토글 — stats 캐시 낙관 patch + 서재 팔로우 목록 재동기.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getFollowStats, getMyBlocks, getUserProfile, setBlock, setFollow } from '@/api/endpoints/users';
import type { BlockedUserResponse, FollowStatsResponse, UserProfileResponse } from '@/api/types';
import { keys, useToggleMutation } from '@/lib/query';

export function useUserProfile(userId: number) {
  return useQuery<UserProfileResponse>({
    queryKey: keys.users.profile(userId),
    queryFn: () => getUserProfile(userId),
    enabled: Number.isFinite(userId) && userId > 0,
  });
}

export function useFollowStats(userId: number) {
  return useQuery<FollowStatsResponse>({
    queryKey: keys.users.followStats(userId),
    queryFn: () => getFollowStats(userId),
    enabled: Number.isFinite(userId) && userId > 0,
  });
}

/**
 * 팔로우 토글 — followStats 캐시에 isFollowing·followerCount·isMutual 낙관 patch.
 * onSettled에서 서재 팔로우 목록(keys.me.following())도 invalidate(§L1 정합 규칙).
 */
export function useFollowToggle(userId: number) {
  return useToggleMutation<FollowStatsResponse>({
    targetKey: keys.users.followStats(userId),
    mutationFn: (next: boolean) => setFollow(userId, next),
    apply: (prev, next) =>
      prev
        ? {
            ...prev,
            isFollowing: next,
            followerCount: Math.max(0, (prev.followerCount ?? 0) + (next ? 1 : -1)),
            isMutual: next && prev.isFollowedBy === true,
          }
        : prev,
    invalidate: [keys.me.following()],
  });
}

/** 내가 차단한 사용자 목록(CB) — 프로필의 차단 여부는 이 목록 멤버십으로 판단(별도 stats 필드 없음). */
export function useMyBlocks() {
  return useQuery<BlockedUserResponse[]>({
    queryKey: keys.me.blocks(),
    queryFn: ({ signal }) => getMyBlocks(signal),
  });
}

/** 차단 토글 — 성공 시 차단 목록만 재동기(팔로우처럼 낙관 patch할 stats가 없다). */
export function useBlockToggle() {
  const qc = useQueryClient();
  return useMutation<void, Error, { userId: number; on: boolean }>({
    mutationFn: ({ userId, on }) => setBlock(userId, on),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me.blocks() }),
  });
}
