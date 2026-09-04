/**
 * 온톨로지 훅.
 *
 * 세 조회 훅 모두 throwOnError: false다 — **이 화면의 실패 모드는 사실상 이것 하나다.**
 * errorCatalog에서 FORBIDDEN·ENTITY_NOT_FOUND는 recoverable:false → isFatal이라
 * 전역 정책이 GlobalErrorBoundary로 throw해 앱이 통째로 붕괴한다. 개발 중에는 본인 작품만
 * 보므로 끝까지 드러나지 않다가 잘못된 링크 한 번에 터진다(features/chat/hooks.ts와 같은 계열).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getOntologySchema,
  getSharedAudience,
  getWorkInsights,
  nudgeLapsedAudience,
  type OntologySchema,
  type SharedAudience,
  type WorkInsights,
} from '@/api/endpoints/ontology';
import { keys } from '@/lib/query';

export function useWorkInsights(seriesId: number) {
  return useQuery<WorkInsights>({
    queryKey: keys.ontology.insights(seriesId),
    queryFn: () => getWorkInsights(seriesId),
    throwOnError: false,
    enabled: Number.isFinite(seriesId) && seriesId > 0,
  });
}

export function useSharedAudience(seriesId: number) {
  return useQuery<SharedAudience>({
    queryKey: keys.ontology.sharedAudience(seriesId),
    queryFn: () => getSharedAudience(seriesId),
    throwOnError: false,
    enabled: Number.isFinite(seriesId) && seriesId > 0,
  });
}

/** 액션 라벨의 정본. applicableActions는 enum 이름 문자열뿐이라 이 스키마와 조인해야 한다. */
export function useOntologySchema() {
  return useQuery<OntologySchema>({
    queryKey: keys.ontology.schema(),
    queryFn: getOntologySchema,
    throwOnError: false,
    staleTime: Infinity, // 서버 배포 전까지 불변인 레지스트리
  });
}

/**
 * 이탈 독자 알림.
 *
 * 실패 문구는 **전역 경로가 띄운다**(QueryErrorToastBridge → routeGlobalError).
 * 자기 onError를 두면 전역이 handledInline으로 판단해 건너뛰므로 여기서 또 띄우면
 * 이중이 아니라 '전역이 죽어 있는지'를 가려버린다 — 실제로 2026-09-05까지
 * setQueryErrorNotifier 호출부가 0개여서 이 화면의 409·403이 조용히 사라졌고,
 * 그때 넣었던 인라인 토스트가 그 사실을 덮고 있었다.
 *
 * 서버 메시지("이번 주에는 이미 보냈어요…")는 normalizeError의 pickMessage가
 * 이미 안전하게 통과시킨다.
 */
export function useNudgeLapsedAudience(seriesId: number) {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => nudgeLapsedAudience(seriesId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.ontology.insights(seriesId) });
    },
  });
}
