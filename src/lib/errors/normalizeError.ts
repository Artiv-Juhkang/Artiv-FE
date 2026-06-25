/**
 * normalizeError — the single choke point that turns ANY thrown value into a
 * canonical {@link AppError}. The axios response interceptor calls this before
 * rejecting, and Query's retry/throwOnError predicates call it again
 * (idempotently). This function NEVER throws.
 *
 * Handling:
 *   - already an AppError            -> returned unchanged
 *   - axios error with NO response   -> isTimeout (ECONNABORTED / CanceledError
 *                                       / timeout) or isNetwork (ERR_NETWORK),
 *                                       status 0, code 'UNKNOWN'
 *   - axios error WITH a response    -> map body.code via asCode (unknown ->
 *                                       'UNKNOWN'); message prefers a safe
 *                                       server message, else generic copy
 *   - anything else (string, plain   -> coerced to a generic UNKNOWN AppError
 *     object, non-Error throwable)
 */
import { isAxiosError } from 'axios';

import { GENERIC_COPY } from './messages';
import { AppError, isAppError, type AppErrorCode, type ErrorResponse, type FieldError } from './types';

const KNOWN_CODES: ReadonlySet<string> = new Set<AppErrorCode>([
  'INVALID_INPUT',
  'ENTITY_NOT_FOUND',
  'DUPLICATE_EMAIL',
  'DUPLICATE_NICKNAME',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'INVALID_TOKEN',
  'FORBIDDEN',
  'ADULT_ONLY',
  'INVALID_IMAGE',
  'UNKNOWN',
]);

/** Narrow an arbitrary server `code` string to the closed AppErrorCode union. */
function asCode(code: unknown): AppErrorCode {
  return typeof code === 'string' && KNOWN_CODES.has(code) ? (code as AppErrorCode) : 'UNKNOWN';
}

/** Extract a clean FieldError[] from an unknown response body. */
function asFieldErrors(body: unknown): FieldError[] {
  const fe = (body as Partial<ErrorResponse> | undefined)?.fieldErrors;
  if (!Array.isArray(fe)) return [];
  return fe
    .filter((f): f is FieldError => !!f && typeof f === 'object')
    .map((f) => ({
      field: String((f as FieldError).field ?? ''),
      reason: String((f as FieldError).reason ?? ''),
    }));
}

/** Pick a trustworthy human message: server message if it's a real string. */
function pickMessage(serverMessage: unknown): string {
  if (typeof serverMessage === 'string') {
    const trimmed = serverMessage.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return GENERIC_COPY.message;
}

export function normalizeError(err: unknown): AppError {
  // Idempotent: already normalized.
  if (isAppError(err)) return err;

  if (isAxiosError(err)) {
    const response = err.response;

    if (!response) {
      // No response reached the server: distinguish timeout vs network.
      const isTimeout =
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.name === 'CanceledError' ||
        /timeout/i.test(err.message ?? '');
      const isNetwork = !isTimeout; // ERR_NETWORK and everything else without a response
      return new AppError({
        status: 0,
        code: 'UNKNOWN',
        message: pickMessage(undefined),
        fieldErrors: [],
        isNetwork,
        isTimeout,
        raw: err,
      });
    }

    const body = response.data as Partial<ErrorResponse> | undefined;
    return new AppError({
      status: typeof body?.status === 'number' ? body.status : response.status,
      code: asCode(body?.code),
      message: pickMessage(body?.message),
      fieldErrors: asFieldErrors(body),
      isNetwork: false,
      isTimeout: false,
      raw: err,
    });
  }

  // Non-axios throwable: coerce string / Error / unknown into UNKNOWN.
  const message =
    err instanceof Error
      ? err.message || GENERIC_COPY.message
      : typeof err === 'string' && err.trim().length > 0
        ? err.trim()
        : GENERIC_COPY.message;

  return new AppError({
    status: 0,
    code: 'UNKNOWN',
    message,
    fieldErrors: [],
    isNetwork: false,
    isTimeout: false,
    raw: err,
  });
}
