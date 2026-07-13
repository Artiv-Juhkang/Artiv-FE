/**
 * 문의 데이터 레이어 (M2). library/hooks.ts 패턴 미러: 무한쿼리는 OPTIONS만
 * 반환(조건부 훅 호출 방지), 소비부에서 useInfiniteQuery로 실행한다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createInquiry, deleteMyInquiry, getMyInquiry, listMyInquiries } from '@/api/endpoints/inquiries';
import type { RNFilePart } from '@/api/multipart';
import type { InquiryDetailResponse, InquiryResponse, InquiryType } from '@/api/types';
import { createPageInfiniteQuery, keys } from '@/lib/query';

/** 내 문의 목록 — fixed-sort Page 무한쿼리 OPTIONS. */
export function useMyInquiries() {
  return createPageInfiniteQuery<InquiryResponse>({
    queryKey: keys.inquiries.list(),
    fetchPage: listMyInquiries,
  });
}

export function useMyInquiry(inquiryId: number) {
  return useQuery<InquiryDetailResponse>({
    queryKey: keys.inquiries.detail(inquiryId),
    queryFn: ({ signal }) => getMyInquiry(inquiryId, signal),
    enabled: Number.isFinite(inquiryId) && inquiryId > 0,
  });
}

export function useCreateInquiry() {
  const qc = useQueryClient();
  return useMutation<
    { id: number },
    Error,
    { type: InquiryType; title: string; content: string; images?: RNFilePart[] }
  >({
    mutationFn: (params) => createInquiry(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inquiries.list() }),
  });
}

export function useDeleteInquiry() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => deleteMyInquiry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.inquiries.list() }),
  });
}
