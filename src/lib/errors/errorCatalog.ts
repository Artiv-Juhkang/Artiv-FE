/**
 * errorCatalog — maps each {@link AppErrorCode} to how the app should PRESENT
 * and ACT on it (kind + recoverable/retryable + Korean title/message), and
 * provides the runtime resolver that layers network/timeout copy on top of an
 * actual {@link AppError} instance.
 *
 * Routing intent (consumed by QueryCache.onError, error boundaries, forms):
 *   - UNAUTHORIZED / INVALID_TOKEN -> 'silent'      (interceptor handles
 *                                                     refresh/logout; don't
 *                                                     show a toast)
 *   - FORBIDDEN / ADULT_ONLY       -> 'blocked'      (not retryable)
 *   - ENTITY_NOT_FOUND             -> 'notFound'
 *   - INVALID_INPUT / DUPLICATE_*  -> 'fieldErrors'  (surface on the form)
 *   - INVALID_IMAGE                -> 'upload'       (field error on the picker)
 *   - UNKNOWN                      -> 'generic'
 *
 * `resolveError` additionally prefers the network/timeout copy when those
 * flags are set on the instance (code is UNKNOWN in that case), and prefers a
 * safe server-provided message over the catalog default.
 */
import { GENERIC_COPY, ERROR_COPY, NETWORK_COPY, TIMEOUT_COPY } from './messages';
import { AppError, type AppErrorCode } from './types';

export type ErrorKind = 'silent' | 'fieldErrors' | 'blocked' | 'notFound' | 'upload' | 'generic';

export interface ErrorPresentation {
  kind: ErrorKind;
  recoverable: boolean;
  retryable: boolean;
  title: string;
  message: string;
}

export const errorCatalog: Record<AppErrorCode, ErrorPresentation> = {
  // Validation / conflicts -> show against form fields, user can fix & retry.
  INVALID_INPUT: {
    kind: 'fieldErrors',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.INVALID_INPUT.title,
    message: ERROR_COPY.INVALID_INPUT.message,
  },
  DUPLICATE_EMAIL: {
    kind: 'fieldErrors',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.DUPLICATE_EMAIL.title,
    message: ERROR_COPY.DUPLICATE_EMAIL.message,
  },
  DUPLICATE_NICKNAME: {
    kind: 'fieldErrors',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.DUPLICATE_NICKNAME.title,
    message: ERROR_COPY.DUPLICATE_NICKNAME.message,
  },
  INVALID_CREDENTIALS: {
    kind: 'fieldErrors',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.INVALID_CREDENTIALS.title,
    message: ERROR_COPY.INVALID_CREDENTIALS.message,
  },

  // Upload-specific.
  INVALID_IMAGE: {
    kind: 'upload',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.INVALID_IMAGE.title,
    message: ERROR_COPY.INVALID_IMAGE.message,
  },

  // Auth expiry -> interceptor owns the recovery; UI stays silent.
  UNAUTHORIZED: {
    kind: 'silent',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.UNAUTHORIZED.title,
    message: ERROR_COPY.UNAUTHORIZED.message,
  },
  INVALID_TOKEN: {
    kind: 'silent',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.INVALID_TOKEN.title,
    message: ERROR_COPY.INVALID_TOKEN.message,
  },

  // Hard blocks -> retrying won't help.
  FORBIDDEN: {
    kind: 'blocked',
    recoverable: false,
    retryable: false,
    title: ERROR_COPY.FORBIDDEN.title,
    message: ERROR_COPY.FORBIDDEN.message,
  },
  ADULT_ONLY: {
    kind: 'blocked',
    recoverable: false,
    retryable: false,
    title: ERROR_COPY.ADULT_ONLY.title,
    message: ERROR_COPY.ADULT_ONLY.message,
  },

  // Missing resource.
  ENTITY_NOT_FOUND: {
    kind: 'notFound',
    recoverable: false,
    retryable: false,
    title: ERROR_COPY.ENTITY_NOT_FOUND.title,
    message: ERROR_COPY.ENTITY_NOT_FOUND.message,
  },

  // Unknown -> generic. retryable is decided at resolve time
  // (only network/timeout are retryable); a bare UNKNOWN is not.
  UNKNOWN: {
    kind: 'generic',
    recoverable: true,
    retryable: false,
    title: ERROR_COPY.UNKNOWN.title,
    message: ERROR_COPY.UNKNOWN.message,
  },
};

/**
 * Resolve presentation for a concrete error instance. Network and timeout
 * failures (flagged on the instance, code === 'UNKNOWN') override the catalog
 * entry with their dedicated copy and become retryable. A safe server message,
 * when present, replaces the catalog default body.
 */
export function resolveError(e: AppError): ErrorPresentation {
  if (e.isTimeout) {
    return {
      kind: 'generic',
      recoverable: true,
      retryable: true,
      title: TIMEOUT_COPY.title,
      message: TIMEOUT_COPY.message,
    };
  }
  if (e.isNetwork) {
    return {
      kind: 'generic',
      recoverable: true,
      retryable: true,
      title: NETWORK_COPY.title,
      message: NETWORK_COPY.message,
    };
  }

  const base = errorCatalog[e.code] ?? errorCatalog.UNKNOWN;

  // Prefer a safe, non-empty server message over the catalog default.
  const serverMessage = e.message?.trim();
  const message =
    serverMessage && serverMessage.length > 0 && serverMessage !== GENERIC_COPY.message
      ? serverMessage
      : base.message;

  return { ...base, message };
}

/** Can the user do something to recover (fix input, re-auth, retry)? */
export function isRecoverable(e: AppError): boolean {
  return resolveError(e).recoverable;
}

/** Is this terminal for the current flow (not silently recoverable)? */
export function isFatal(e: AppError): boolean {
  return !resolveError(e).recoverable;
}
