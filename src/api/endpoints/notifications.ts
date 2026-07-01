/**
 * 알림 목록/미읽음수/읽음.
 *
 * listNotifications 는 고정 정렬 → buildFixedSortParams.
 * PATCH read 는 NotificationResponse(read + 라우팅 정보) 반환 → "읽음 후 이동" 1콜.
 */
import { api } from '@/api/client';
import { buildFixedSortParams } from '@/api/paging';
import type {
  NotificationResponse,
  NotificationType,
  UnreadCountResponse,
  UnreadSummaryResponse,
} from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/** 미읽음 알림 수(헤더 벨 배지 폴링). */
export async function getUnreadCount(): Promise<{ count: number }> {
  const { data } = await api.get<UnreadCountResponse>(
    '/api/me/notifications/unread-count',
  );
  return { count: data.count ?? 0 };
}

/** 미읽음 종류별 집계(알림함 그룹 칩 배지). */
export async function getUnreadSummary(): Promise<UnreadSummaryResponse> {
  const { data } = await api.get<UnreadSummaryResponse>(
    '/api/me/notifications/unread-summary',
  );
  return data;
}

/** 알림 목록(Page, 고정 정렬). type 지정 시 해당 종류만(단일 종류 필터, 백엔드 지원). */
export async function listNotifications(
  page: number,
  type?: NotificationType,
  signal?: AbortSignal,
): Promise<PageResponse<NotificationResponse>> {
  const { data } = await api.get<PageResponse<NotificationResponse>>(
    '/api/me/notifications',
    { params: { ...buildFixedSortParams({ page }), type }, signal },
  );
  return data;
}

/** 모두 읽음 처리(PATCH read-all, 무바디 204). */
export async function readAllNotifications(): Promise<void> {
  await api.patch('/api/me/notifications/read-all');
}

/**
 * 알림 읽음 처리(PATCH). 갱신된 NotificationResponse(read=true + targetType/targetId) 반환
 * → 호출부에서 라우팅까지 한 번에.
 */
export async function readNotification(
  id: number,
): Promise<NotificationResponse> {
  const { data } = await api.patch<NotificationResponse>(
    `/api/me/notifications/${id}/read`,
  );
  return data;
}
