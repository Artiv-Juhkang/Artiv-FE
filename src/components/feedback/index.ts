/**
 * feedback — user-facing feedback surfaces (connectivity + error recovery).
 *
 * This barrel exposes ONLY the feedback-specific components owned here.
 * The presentational primitives (ErrorState / EmptyState / Skeleton / Toast)
 * live in @/ui and must be imported from there — do not re-define or
 * re-export them as new components.
 *
 *   import { OfflineBanner, FeatureErrorBoundary } from '@/components/feedback';
 *   import { ErrorState, EmptyState } from '@/ui'; // primitives stay in @/ui
 */
export { OfflineBanner } from './OfflineBanner';
export { FeatureErrorBoundary } from './FeatureErrorBoundary';
