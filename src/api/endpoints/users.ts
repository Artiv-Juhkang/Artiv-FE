/**
 * 사용자/팔로우.
 *
 * 본인 팔로우는 UI 에서 차단(여기선 막지 않음).
 */
import { api } from '@/api/client';
import type {
  FollowStatsResponse,
  FollowUserResponse,
  MyProfileResponse,
  UserProfileResponse,
} from '@/api/types';

/** 공개 프로필(타인 열람) — 비공개면 bio·가입일이 null로 온다(닉네임·아바타·역할은 항상 공개). */
export async function getUserProfile(userId: number): Promise<UserProfileResponse> {
  const { data } = await api.get<UserProfileResponse>(`/api/users/${userId}`);
  return data;
}

/** 내 프로필 공개 설정 변경 — 갱신된 내 프로필 반환. */
export async function setProfileVisibility(profilePublic: boolean): Promise<MyProfileResponse> {
  const { data } = await api.patch<MyProfileResponse>('/api/users/me/profile-visibility', {
    profilePublic,
  });
  return data;
}

/** 특정 사용자 팔로우 통계(팔로워/팔로잉 수 + 내 팔로우 여부). */
export async function getFollowStats(
  userId: number,
): Promise<FollowStatsResponse> {
  const { data } = await api.get<FollowStatsResponse>(
    `/api/users/${userId}/follow-stats`,
  );
  return data;
}

/** 내가 팔로우한 사용자 목록(비페이지 List — MVP 규모 허용, 임계 시 BE 페이지화). */
export async function getMyFollowing(signal?: AbortSignal): Promise<FollowUserResponse[]> {
  const { data } = await api.get<FollowUserResponse[]>('/api/users/me/following', { signal });
  return data;
}

/** 친구(상호 팔로우) 목록 — 단체방 초대 후보(CH4). */
export async function getMyFriends(signal?: AbortSignal): Promise<FollowUserResponse[]> {
  const { data } = await api.get<FollowUserResponse[]>('/api/users/me/friends', { signal });
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

/** 회원 탈퇴(M5) — 비번 확인 204. 실패(400=비번 불일치)면 세션 그대로 유지. */
export async function withdrawAccount(password: string): Promise<void> {
  await api.delete('/api/users/me', { data: { password } });
}
