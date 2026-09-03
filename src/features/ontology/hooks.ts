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
import { isAppError } from '@/lib/errors';
import { keys } from '@/lib/query';
import { useToast } from '@/ui';

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
 * 실패를 **인라인 토스트로 직접 처리한다**(withdraw.tsx:23과 같은 관례).
 *
 * 설계 초안은 "전역 MutationCache.onError → routeGlobalError가 이미 띄운다"고 봤는데,
 * 실측해보니 틀렸다 — routeGlobalError가 호출하는 errorNotifier가 앱 어디에서도 등록되지
 * 않아(queryClient.ts:55~59, 호출부 0개) 항상 __DEV__ console.warn으로 빠진다. 그 결과
 * 409 스로틀·403 k미달에서 사용자가 **아무 피드백도 받지 못했다.**
 *
 * 전역 등록을 고치는 편이 근본적이지만 그건 앱 전체의 에러 표출 동작을 바꾸는 변경이라
 * 이 작업 범위 밖이다(CLAUDE.md §3). 여기서는 이 화면만 책임진다.
 *
 * 서버 메시지를 그대로 쓴다 — "이번 주에는 이미 보냈어요"처럼 사유가 구체적이고,
 * normalizeError가 이미 안전한 서버 문구만 통과시킨다(pickMessage).
 */
export function useNudgeLapsedAudience(seriesId: number) {
  const qc = useQueryClient();
  const { show } = useToast();
  return useMutation<void, Error, void>({
    mutationFn: () => nudgeLapsedAudience(seriesId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.ontology.insights(seriesId) });
    },
    onError: (e) => {
      show({
        tone: 'danger',
        message: isAppError(e) ? e.message : '알림을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
      });
    },
  });
}
