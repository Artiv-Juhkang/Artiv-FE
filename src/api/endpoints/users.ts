/**
 * 사용자/팔로우.
 *
 * 본인 팔로우는 UI 에서 차단(여기선 막지 않음).
 */
import { api } from '@/api/client';
import type { FollowStatsResponse } from '@/api/types';

/** 특정 사용자 팔로우 통계(팔로워/팔로잉 수 + 내 팔로우 여부). */
export async function getFollowStats(
  userId: number,
): Promise<FollowStatsResponse> {
  const { data } = await api.get<FollowStatsResponse>(
    `/api/users/${userId}/follow-stats`,
  );
  return data;
}

/** 팔로우 토글(멱등). on=true POST / false DELETE. 무바디. */
export async function setFollow(userId: number, on: boolean): Promise<void> {
  const path = `/api/users/${userId}/follow`;
  if (on) {
    await api.post(path);
  } else {
    await api.delete(path);
  }
}
