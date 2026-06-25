/**
 * 정본 QueryClient (싱글톤) + retry 술어 + 전역 기본값.
 *
 * 다른 QueryClient를 만들지 말 것 — 앱 전체가 이 인스턴스를 공유한다.
 * (QueryProvider, AuthContext의 useQueryClient, NetworkProvider의 onlineManager가
 *  모두 동일 캐시를 바라봐야 낙관적 업데이트/invalidate가 일관된다.)
 *
 * 에러 정책은 src/lib/errors에 위임한다:
 *  - normalizeError: 모든 throw 값 → AppError (절대 throw 안 함)
 *  - resolveError/isFatal: code → kind/recoverable 분류
 *
 * 전역 onError 라우팅은 React에 의존할 수 없으므로(QueryCache/MutationCache는
 * 컴포넌트 밖) 작은 pluggable notifier(setQueryErrorNotifier)로 분리한다.
 * Toast 레이어가 마운트되면 모듈 싱글톤을 등록하고, 미등록 시 dev에서 console로 폴백.
 */
import { QueryCache, MutationCache, QueryClient } from '@tanstack/react-query';
import { normalizeError } from '@/lib/errors/normalizeError';
import { isFatal, resolveError } from '@/lib/errors/errorCatalog';

/** 목록/상세 기본 staleTime (60초). */
export const DEFAULT_STALE_TIME = 60_000;
/** 가비지 컬렉션 타임 (5분). 화면 이탈 후에도 잠시 캐시 유지. */
const DEFAULT_GC_TIME = 5 * 60_000;
/** Query 자동 재시도 최대 횟수 (network/5xx 한정). */
const MAX_RETRIES = 2;
/** 지수 백오프 상한 (8초). */
const RETRY_DELAY_CAP = 8_000;

/**
 * Query 재시도 술어.
 * - 4xx(클라이언트 에러): 재시도해도 동일 → 즉시 포기.
 * - 401/INVALID_TOKEN: 인터셉터(single-flight refresh)가 소유 → Query는 재시도 안 함.
 * - network/timeout/5xx: 일시적일 수 있으므로 MAX_RETRIES까지 재시도.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const e = normalizeError(error);
  // 네트워크/타임아웃이 아니고 4xx면 재시도 무의미.
  if (!e.isNetwork && !e.isTimeout && e.status >= 400 && e.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/** 지수 백오프 지연 (1s, 2s, 4s … cap 8s). */
function retryDelay(attemptIndex: number): number {
  return Math.min(1_000 * 2 ** attemptIndex, RETRY_DELAY_CAP);
}

/**
 * 비-React 코드(인터셉터/전역 onError)용 에러 알림 hook.
 * Toast 레이어가 register하여 사용자 토스트로 surfacing한다.
 */
type QueryErrorNotifier = (e: ReturnType<typeof normalizeError>) => void;

let errorNotifier: QueryErrorNotifier | null = null;

/** Toast 싱글톤이 마운트 시 등록 (framework-agnostic 주입점). */
export function setQueryErrorNotifier(fn: QueryErrorNotifier | null): void {
  errorNotifier = fn;
}

/**
 * 전역 캐시 onError 라우팅.
 * - silent(401/INVALID_TOKEN): 인증 레이어 소유 → 무처리.
 * - blocked/notFound/fieldErrors/upload: 화면 인라인에서 처리 → 전역 무처리.
 * - generic(network/timeout/UNKNOWN): 토스트.
 */
function routeGlobalError(error: unknown): void {
  const e = normalizeError(error);
  const { kind } = resolveError(e);
  if (kind !== 'generic') return; // silent/blocked/notFound/fieldErrors/upload는 인라인 처리
  if (errorNotifier) {
    errorNotifier(e);
  } else if (__DEV__) {
    // Toast 미등록 시(테스트/초기 부트스트랩) dev 가시성 확보.
     
    console.warn('[query] unhandled generic error:', e.code, e.message);
  }
}

/**
 * throwOnError 통합 정책.
 * 치명적(fatal)이면서 silent가 아닌 경우에만 ErrorBoundary로 throw.
 * 복구가능/필드/silent 에러는 인라인 ErrorState·폼·무처리로 surfacing한다.
 */
function throwOnError(error: unknown): boolean {
  const e = normalizeError(error);
  return isFatal(e) && resolveError(e).kind !== 'silent';
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: routeGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: routeGlobalError,
  }),
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      gcTime: DEFAULT_GC_TIME,
      // RN에는 window focus 개념이 없음 → 비활성화.
      refetchOnWindowFocus: false,
      // 오프라인 → 온라인 복귀 시 자동 갱신 (onlineManager는 NetworkProvider 소유).
      refetchOnReconnect: true,
      retry: shouldRetry,
      retryDelay,
      throwOnError,
    },
    mutations: {
      // 멱등 토글이라도 중복 재시도는 낙관적 롤백/재적용을 꼬이게 함 → 수동 처리.
      retry: false,
      throwOnError,
    },
  },
});
