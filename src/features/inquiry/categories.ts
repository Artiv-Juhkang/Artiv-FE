/**
 * 문의 유형 한글 라벨 — 작성 화면 ChipSelect·목록/상세 배지가 공유.
 * (백엔드 InquiryType enum 6종 미러 — 백엔드 주석대로 라벨 매핑은 프론트 소관.)
 */
import type { InquiryType } from '@/api/types';

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  ACCOUNT: '계정/로그인',
  PAYMENT: '결제/환불',
  CONTENT: '콘텐츠/신고',
  CREATOR: '작가/작품 운영',
  BUG: '오류',
  ETC: '기타',
};

export const INQUIRY_TYPES: readonly InquiryType[] = [
  'ACCOUNT',
  'PAYMENT',
  'CONTENT',
  'CREATOR',
  'BUG',
  'ETC',
] as const;
