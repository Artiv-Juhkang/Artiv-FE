/**
 * query 모듈 barrel.
 * import 표면:
 *   import { queryClient, keys, QueryProvider, useToggleMutation } from '@/lib/query';
 *   import { createPageInfiniteQuery, flattenInfinite } from '@/lib/query';
 */
export * from './keys';
export * from './infinite';
export * from './mutations';
export { queryClient, shouldRetry, DEFAULT_STALE_TIME, setQueryErrorNotifier } from './queryClient';
export { QueryProvider } from './QueryProvider';
