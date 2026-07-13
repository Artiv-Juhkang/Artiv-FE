/**
 * 채팅 vertical 데이터 훅 (CH3) — 폴링 규율(frontend-architecture):
 * refetchInterval은 마운트된 화면에서만 돌고(언마운트 시 정지), 백그라운드 창에서는
 * react-query 기본값(refetchIntervalInBackground=false)이 폴링을 멈춘다.
 * 대화방 5s(활성 대화), 인박스·요청함·탭 뱃지 30s로 차등.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptConversation,
  createDirectConversation,
  declineConversation,
  getChatUnreadCount,
  listConversationRequests,
  listConversations,
  listMessages,
  sendMessage,
} from '@/api/endpoints/chat';
import type { ChatMessage, ConversationResponse, ConversationSummary } from '@/api/types';
import { createPageInfiniteQuery, keys } from '@/lib/query';

export const INBOX_POLL_MS = 30_000;
export const ROOM_POLL_MS = 5_000;

export function useConversations() {
  return useQuery<ConversationSummary[]>({
    queryKey: keys.conversations.list(),
    queryFn: ({ signal }) => listConversations(signal),
    refetchInterval: INBOX_POLL_MS,
  });
}

export function useConversationRequests() {
  return useQuery<ConversationSummary[]>({
    queryKey: keys.conversations.requests(),
    queryFn: ({ signal }) => listConversationRequests(signal),
    refetchInterval: INBOX_POLL_MS,
  });
}

/** 채팅 탭 뱃지 — 알림 벨과 별도 카운트(SSOT: 알림 테이블과 분리). */
export function useChatUnreadCount() {
  return useQuery({
    queryKey: keys.conversations.unreadCount(),
    queryFn: ({ signal }) => getChatUnreadCount(signal),
    refetchInterval: INBOX_POLL_MS,
  });
}

/** 대화 메시지 — Page 무한쿼리 OPTIONS(소비부에서 refetchInterval: ROOM_POLL_MS를 얹는다). */
export function useMessagesInfinite(conversationId: number) {
  return createPageInfiniteQuery<ChatMessage>({
    queryKey: keys.conversations.messages(conversationId),
    fetchPage: (page, signal) => listMessages(conversationId, page, signal),
    enabled: Number.isFinite(conversationId) && conversationId > 0,
  });
}

/** 전송 — 성공 시 대화·인박스 재동기(낙관 삽입 대신 5s 폴링과 invalidate로 수렴: 단순성). */
export function useSendMessage(conversationId: number) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, Error, string>({
    mutationFn: (content) => sendMessage(conversationId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.conversations.messages(conversationId) });
      qc.invalidateQueries({ queryKey: keys.conversations.list() });
    },
  });
}

/** 요청 수락/거절 — 요청함·인박스·뱃지 재동기. */
export function useRespondToRequest() {
  const qc = useQueryClient();
  return useMutation<ConversationResponse, Error, { id: number; accept: boolean }>({
    mutationFn: ({ id, accept }) => (accept ? acceptConversation(id) : declineConversation(id)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.conversations.all });
    },
  });
}

/** 프로필 '메시지' 버튼 — 방 개설(멱등) 후 대화방으로 이동은 호출부가 담당. */
export function useStartDirectChat() {
  const qc = useQueryClient();
  return useMutation<ConversationResponse, Error, number>({
    mutationFn: (targetUserId) => createDirectConversation(targetUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.conversations.list() });
    },
  });
}
