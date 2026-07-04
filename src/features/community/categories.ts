/**
 * 게시글 카테고리 한글 라벨 — 커뮤니티 피드 칩·PostCard 배지·서재 커뮤니티 기록(L2)이 공유.
 * (백엔드 PostCategory enum 4종 미러. D1=B 등록제 도입(C7) 시 이 상수는 레지스트리 조회로 대체.)
 */
import type { PostCategory } from '@/api/types';

export const POST_CATEGORY_LABEL: Record<PostCategory, string> = {
  RECOMMEND: '추천',
  FREE: '자유',
  FANART: '팬아트',
  QUESTION: '질문',
};

export const POST_CATEGORIES: readonly PostCategory[] = [
  'RECOMMEND',
  'FREE',
  'FANART',
  'QUESTION',
] as const;
