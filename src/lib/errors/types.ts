/**
 * Frontend-owned error contract.
 *
 * The backend always shapes failures as {@link ErrorResponse}
 * `{ status, code, message(Korean), fieldErrors[] }` (frontend-guide §3.3).
 * We mirror that raw wire shape here, then normalize every thrown value into
 * a single canonical {@link AppError} class (see `normalizeError`).
 *
 * This is the ONLY place `AppError` is defined. Do not create
 * `src/api/errors.ts` or any other AppError — import from `@/lib/errors`.
 *
 * Network/timeout failures have no server `code`; they are represented by the
 * `isNetwork` / `isTimeout` flags with `status === 0`, never by a code.
 */

/** A single field-level validation failure from the backend. */
export interface FieldError {
  field: string;
  reason: string;
}

/** Raw error envelope returned by the backend on failure. */
export interface ErrorResponse {
  status: number;
  code: string;
  message: string;
  fieldErrors?: FieldError[];
}

/**
 * Closed union of error codes the frontend branches on. Any server `code`
 * we don't recognize collapses to `'UNKNOWN'` during normalization.
 */
export type AppErrorCode =
  | 'INVALID_INPUT'
  | 'ENTITY_NOT_FOUND'
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_NICKNAME'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'FORBIDDEN'
  | 'ADULT_ONLY'
  | 'INVALID_IMAGE'
  | 'UNKNOWN';

/** Args for constructing an {@link AppError}. */
export interface AppErrorInit {
  status: number;
  code: AppErrorCode;
  message: string;
  fieldErrors: FieldError[];
  isNetwork: boolean;
  isTimeout: boolean;
  raw?: unknown;
}

/**
 * Canonical error every layer above the HTTP client throws/handles.
 * Extends `Error` so it integrates with React error boundaries and logging.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly fieldErrors: FieldError[];
  readonly isNetwork: boolean;
  readonly isTimeout: boolean;
  readonly raw?: unknown;

  constructor(init: AppErrorInit) {
    super(init.message);
    // Restore prototype chain — required when targeting ES5/transpiled output
    // so `instanceof AppError` keeps working.
    Object.setPrototypeOf(this, AppError.prototype);
    this.name = 'AppError';
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors;
    this.isNetwork = init.isNetwork;
    this.isTimeout = init.isTimeout;
    this.raw = init.raw;
  }
}

/** Type guard: is the value an {@link AppError} instance? */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
