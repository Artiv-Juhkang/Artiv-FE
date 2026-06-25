/**
 * FeatureErrorBoundary — a reusable, section-scoped error boundary.
 *
 * Wrap any feature/section (a list, a detail pane, a tab body) so a thrown
 * error degrades just that subtree instead of bubbling to the root
 * GlobalErrorBoundary. It catches via an inner class component, normalizes
 * whatever was thrown into an AppError, and renders the shared ui ErrorState
 * (we never define a second error component).
 *
 * It composes with React Query: QueryErrorResetBoundary supplies a reset()
 * that clears the error state of queries whose useQuery({ throwOnError })
 * tripped this boundary. The retry button calls that reset(), resets the
 * boundary, then the optional onReset() so callers can refetch.
 *
 * Callers can supply a custom `fallback(error, reset)` render prop; otherwise
 * the catalog-driven default ErrorState renders (retry shown only for
 * retryable codes — network/timeout/unknown — per the error catalog).
 */
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';

import { type AppError, normalizeError, resolveError } from '@/lib/errors';
import { ErrorState, type ApiErrorCode } from '@/ui';

type FeatureErrorBoundaryProps = {
  children: ReactNode;
  /** Called after the boundary resets — use to refetch / clear local state. */
  onReset?: () => void;
  /** Custom fallback; receives the normalized error + a reset() to recover. */
  fallback?: (error: AppError, reset: () => void) => ReactNode;
};

export function FeatureErrorBoundary({ children, onReset, fallback }: FeatureErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <InnerBoundary
          onReset={() => {
            // Clear query error state first, then let callers refetch.
            reset();
            onReset?.();
          }}
          fallback={fallback}
        >
          {children}
        </InnerBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

// ── internal class boundary ───────────────────────────────────────────────

type InnerProps = {
  children: ReactNode;
  onReset: () => void;
  fallback?: (error: AppError, reset: () => void) => ReactNode;
};
type InnerState = { error: AppError | null };

class InnerBoundary extends Component<InnerProps, InnerState> {
  state: InnerState = { error: null };

  static getDerivedStateFromError(error: unknown): InnerState {
    // Funnel every throwable (AppError, axios error, string, ...) through the
    // single normalize choke point so the fallback always sees an AppError.
    return { error: normalizeError(error) };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[FeatureErrorBoundary] caught', error);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const resolved = resolveError(error);
    return (
      <ErrorState
        code={toApiErrorCode(error)}
        message={resolved.message}
        onRetry={resolved.retryable ? this.reset : undefined}
      />
    );
  }
}

/** Map an AppError onto the ErrorState code surface. Network/timeout don't
 *  carry a server `code`, so they map to the dedicated 'NETWORK' visual. */
function toApiErrorCode(error: AppError): ApiErrorCode {
  if (error.isNetwork || error.isTimeout) return 'NETWORK';
  return error.code;
}
