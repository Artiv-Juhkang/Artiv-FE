/**
 * 창작물 타입 레지스트리 훅 — GET /api/creativity/types.
 *
 * 타입 메타는 거의 정적이라 길게 캐시한다. 창작 탭의 타입 칩과 뷰어 분기가 이걸 소비 →
 * 백엔드에 ContentType 값을 추가하면 프론트 코드 변경 없이 새 타입이 자동 노출(타입=데이터).
 */
import { useQuery } from '@tanstack/react-query';

import {
  getContentTypes,
  type ContentTypeMeta,
} from '@/api/endpoints/creativity';
import { keys } from '@/lib/query';

export function useContentTypes() {
  return useQuery<ContentTypeMeta[]>({
    queryKey: keys.creativity.types(),
    queryFn: getContentTypes,
    staleTime: 1000 * 60 * 60, // 1h — 타입은 거의 바뀌지 않음
  });
}
