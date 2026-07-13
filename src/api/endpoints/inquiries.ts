/**
 * 내 문의 — 목록/상세/작성/삭제 (M2). 백엔드 완비, 프론트만 신규.
 *
 * 작성은 글쓰기(createPost)와 동일 계약: 스칼라는 query, 이미지는 parts(≤5장).
 * 목록은 buildFixedSortParams(page만, 정렬 불가 — 서버가 최신순 고정).
 */
import { api } from '@/api/client';
import { uploadMultipart, type RNFilePart } from '@/api/multipart';
import { buildFixedSortParams } from '@/api/paging';
import type { InquiryDetailResponse, InquiryResponse, InquiryType } from '@/api/types';
import type { PageResponse } from '@/lib/query/infinite';

/** 내 문의 목록(Page, 최신순 고정). */
export async function listMyInquiries(
  page: number,
  signal?: AbortSignal,
): Promise<PageResponse<InquiryResponse>> {
  const { data } = await api.get<PageResponse<InquiryResponse>>('/api/me/inquiries', {
    params: buildFixedSortParams({ page }),
    signal,
  });
  return data;
}

/** 내 문의 상세(답변 포함, 소유자 전용 — 타인 문의는 403). */
export async function getMyInquiry(
  inquiryId: number,
  signal?: AbortSignal,
): Promise<InquiryDetailResponse> {
  const { data } = await api.get<InquiryDetailResponse>(`/api/me/inquiries/${inquiryId}`, {
    signal,
  });
  return data;
}

/** 문의 작성(멀티파트 — 스칼라는 query, 이미지는 parts ≤5장). 201 + {id}. */
export async function createInquiry(params: {
  type: InquiryType;
  title: string;
  content: string;
  images?: RNFilePart[];
}): Promise<{ id: number }> {
  return uploadMultipart<{ id: number }>('/api/me/inquiries', {
    query: { type: params.type, title: params.title, content: params.content },
    files: params.images?.length ? { images: params.images } : {},
  });
}

/** 내 문의 삭제(작성자 전용, 204). */
export async function deleteMyInquiry(inquiryId: number): Promise<void> {
  await api.delete(`/api/me/inquiries/${inquiryId}`);
}
