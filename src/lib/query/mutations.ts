/**
 * 낙관적 토글 팩토리 (구독/좋아요/북마크/팔로우 등 멱등 토글용).
 *
 * 토글 엔드포인트는 대부분 201/204 무바디(POST=on, DELETE=off)이므로
 * 서버 응답으로 상태를 못 받는다 → 낙관적으로 detail 캐시에 patch하고,
 * 실패 시 snapshot으로 롤백, 성공/실패와 무관하게 onSettled에서 invalidate한다.
 *
 * 흐름:
 *   onMutate  : cancelQueries(진행 중 refetch가 낙관값을 덮어쓰지 않게) + snapshot + apply
 *   onError   : snapshot 롤백
 *   onSettled : targetKey + invalidate[] 무효화 (서버 권위값으로 재동기)
 *
 * 훅이므로 use 접두 — 컴포넌트/커스텀 훅 안에서만 호출.
 * (post 좋아요처럼 200+바디를 권위값으로 reconcile해야 하는 경우는 이 팩토리 대신
 *  useMutation의 onSuccess에서 직접 setQueryData 하는 게 맞다.)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface ToggleConfig<TCache> {
  /** 낙관적 patch 대상 캐시 키 (보통 detail 키). */
  targetKey: readonly unknown[];
  /** next(켜짐 여부)를 받아 서버 토글을 수행. 무바디여도 됨. */
  mutationFn: (next: boolean) => Promise<unknown>;
  /** 이전 캐시값과 next로 새 캐시값을 만든다(불변 갱신). undefined면 patch 생략. */
  apply: (prev: TCache | undefined, next: boolean) => TCache | undefined;
  /** 정착 후 추가로 무효화할 키들(예: 내 구독 목록). targetKey는 자동 포함. */
  invalidate?: readonly (readonly unknown[])[];
}

interface ToggleContext<TCache> {
  previous: TCache | undefined;
}

export function useToggleMutation<TCache>(cfg: ToggleConfig<TCache>) {
  const qc = useQueryClient();

  return useMutation<unknown, Error, boolean, ToggleContext<TCache>>({
    mutationFn: (next: boolean) => cfg.mutationFn(next),

    onMutate: async (next: boolean) => {
      // 진행 중인 refetch를 멈춰 낙관값이 stale 응답에 덮이지 않게 한다.
      await qc.cancelQueries({ queryKey: cfg.targetKey });
      const previous = qc.getQueryData<TCache>(cfg.targetKey);
      // 캐시가 아직 없으면(상세 미진입) patch 생략 — apply가 undefined를 그대로 다룬다.
      const nextValue = cfg.apply(previous, next);
      if (nextValue !== undefined) {
        qc.setQueryData<TCache>(cfg.targetKey, nextValue);
      }
      return { previous };
    },

    onError: (_err, _next, context) => {
      // 낙관적 patch 롤백.
      if (context) {
        qc.setQueryData<TCache>(cfg.targetKey, context.previous);
      }
    },

    onSettled: () => {
      // 서버 권위값으로 재동기. targetKey + 설정된 부수 키들.
      qc.invalidateQueries({ queryKey: cfg.targetKey });
      for (const key of cfg.invalidate ?? []) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
