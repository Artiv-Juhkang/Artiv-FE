/**
 * 채팅 (CH2/CH3) — DIRECT 대화·DM 요청·메시지·읽음·탭 뱃지.
 * 폴링 MVP: 대화방 5s(첫 페이지), 인박스·뱃지 30s — 화면 포커스 시만(훅에서 게이트).
 */
import { api } from '@/api/client';
import { buildFixedSortParams } from '@/api/paging';
import type {
  ChatMessage,
  ChatUnreadCountResponse,
  ConversationResponse,
  ConversationSummary,
} from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/** DIRECT 대화 시작(멱등 — 같은 상대는 기존 방 반환). 친구가 아니면 PENDING 요청. */
export async function createDirectConversation(targetUserId: number): Promise<ConversationResponse> {
  const { data } = await api.post<ConversationResponse>('/api/conversations', {
    type: 'DIRECT',
    targetUserId,
  });
  return data;
}

/**
 * 단체방 생성 — 멤버 전원이 친구(상호 팔로우)여야 하며 요청 없이 즉시 열린다.
 * anonymous(CH5)면 메시지의 발신자 표기가 '익명N'으로 마스킹된다(서버는 실제 발신자를 안다).
 */
export async function createGroupConversation(
  title: string,
  memberIds: number[],
  anonymous: boolean,
): Promise<ConversationResponse> {
  const { data } = await api.post<ConversationResponse>('/api/conversations', {
    type: 'GROUP',
    title,
    memberIds,
    anonymous,
  });
  return data;
}

/** 인박스 — ACCEPTED + 내가 보낸 PENDING(응답 대기). 서버가 표시명·미리보기·미읽음 파생. */
export async function listConversations(signal?: AbortSignal): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>('/api/me/conversations', { signal });
  return data;
}

/** 요청함 — 내가 받은 PENDING. */
export async function listConversationRequests(signal?: AbortSignal): Promise<ConversationSummary[]> {
  const { data } = await api.get<ConversationSummary[]>('/api/me/conversations/requests', { signal });
  return data;
}

/** 채팅 탭 뱃지 카운트(알림 unread와 별도 집계). */
export async function getChatUnreadCount(signal?: AbortSignal): Promise<ChatUnreadCountResponse> {
  const { data } = await api.get<ChatUnreadCountResponse>('/api/me/conversations/unread-count', { signal });
  return data;
}

/** DM 요청 수락(수신자만). */
export async function acceptConversation(id: number): Promise<ConversationResponse> {
  const { data } = await api.post<ConversationResponse>(`/api/conversations/${id}/accept`);
  return data;
}

/** DM 요청 거절(수신자만, 영구 — 조용한 거절). */
export async function declineConversation(id: number): Promise<ConversationResponse> {
  const { data } = await api.post<ConversationResponse>(`/api/conversations/${id}/decline`);
  return data;
}

/** 대화 메시지(최신순 Page, 멤버만). */
export async function listMessages(
  conversationId: number,
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<ChatMessage>> {
  const { data } = await api.get<PageResponse<ChatMessage>>(
    `/api/conversations/${conversationId}/messages`,
    { params: buildFixedSortParams({ page }), signal },
  );
  return data;
}

/** 메시지 전송(201 + 생성 메시지). PENDING이면 요청자만 가능. */
export async function sendMessage(conversationId: number, content: string): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(
    `/api/conversations/${conversationId}/messages`,
    { content },
  );
  return data;
}

/** 읽음 포인터 전진(high-water-mark, 후퇴 없음). */
export async function readConversation(conversationId: number, lastReadMessageId: number): Promise<void> {
  await api.patch(`/api/conversations/${conversationId}/read`, { lastReadMessageId });
}
