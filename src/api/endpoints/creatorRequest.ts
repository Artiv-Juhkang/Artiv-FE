/**
 * 작가 전환 신청 엔드포인트(독자 → 작가).
 *
 * 독자가 신청서(reason)를 제출하면 관리자 승인 시 CREATOR 로 승격된다.
 * 미신청 상태는 백엔드가 404(ENTITY_NOT_FOUND)로 응답 → getMine 은 null 로 정규화한다.
 */
import { api } from '@/api/client';
import { isAppError } from '@/lib/errors';

export type CreatorRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreatorRequestResponse {
  id: number;
  status: CreatorRequestStatus;
  requestReason: string;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

/** 작가 전환 신청 제출. */
export async function submitCreatorRequest(reason: string): Promise<CreatorRequestResponse> {
  const { data } = await api.post<CreatorRequestResponse>('/api/users/me/creator-request', { reason });
  return data;
}

/** 내 최근 신청 상태. 신청 이력이 없으면 null. */
export async function getMyCreatorRequest(): Promise<CreatorRequestResponse | null> {
  try {
    const { data } = await api.get<CreatorRequestResponse>('/api/users/me/creator-request');
    return data;
  } catch (e) {
    if (isAppError(e) && e.code === 'ENTITY_NOT_FOUND') return null;
    throw e;
  }
}
