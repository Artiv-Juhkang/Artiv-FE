/**
 * fieldErrors — bridges a backend ErrorResponse (already normalized into an
 * {@link AppError}) onto form fields.
 *
 * Two surfaces:
 *   - {@link fieldErrorsToMap}    : AppError -> { field: koreanMessage }
 *   - {@link applyAppErrorToForm} : AppError -> calls a framework-agnostic
 *                                   setFieldError(field, message) per entry
 *
 * Design notes (per contract):
 *   - The backend's `fieldErrors[]` ({ field, reason }) is the primary source.
 *     Each entry maps straight to its field with the server's Korean reason.
 *   - DUPLICATE_NICKNAME / DUPLICATE_EMAIL frequently arrive as a 409 with an
 *     EMPTY fieldErrors[] (it's a uniqueness violation, not bean validation).
 *     We SYNTHESIZE the matching field ('nickname' / 'email') from the error
 *     catalog so the form still highlights the right input.
 *   - Anything we can't attribute to a concrete field (an entry with no/blank
 *     `field`, or a non-field-shaped error like INVALID_CREDENTIALS) converges
 *     onto the conventional 'root' key so the form can show a top-level banner.
 *   - RHF is not in the stack yet, so the apply() form takes a plain
 *     setFieldError callback — works with RHF's setError, a useState reducer,
 *     a Formik setFieldError, etc.
 */
import { type AppError, resolveError } from '@/lib/errors';

/** Conventional key for an error that isn't tied to a single field. */
export const ROOT_FIELD = 'root' as const;

/** Server error codes that imply a specific form field even with empty fieldErrors[]. */
const CODE_TO_FIELD: Partial<Record<AppError['code'], string>> = {
  DUPLICATE_NICKNAME: 'nickname',
  DUPLICATE_EMAIL: 'email',
};

/**
 * Flatten an AppError into a { field -> message } map suitable for driving
 * per-field error UI. Server `fieldErrors` win; otherwise we synthesize from
 * the code, finally falling back to a single 'root' message.
 */
export function fieldErrorsToMap(error: AppError): Record<string, string> {
  const map: Record<string, string> = {};

  // 1) Explicit backend field errors (validation failures) take priority.
  for (const fe of error.fieldErrors ?? []) {
    const field = normalizeField(fe.field);
    const reason = fe.reason?.trim();
    if (!reason) continue;
    // First reason per field wins; don't clobber a more specific earlier entry.
    if (!(field in map)) map[field] = reason;
  }

  // 2) Synthesize a field for uniqueness-style codes that ship no fieldErrors.
  const synthetic = CODE_TO_FIELD[error.code];
  if (synthetic && !(synthetic in map)) {
    map[synthetic] = catalogMessage(error);
  }

  // 3) Nothing attributable yet -> surface the error at the form root so the
  //    user still sees *what* went wrong (e.g. INVALID_CREDENTIALS, network).
  if (Object.keys(map).length === 0) {
    map[ROOT_FIELD] = catalogMessage(error);
  }

  return map;
}

/**
 * Apply an AppError onto a form via a framework-agnostic setter. Calls
 * setFieldError once per derived field. Safe to call from a mutation's
 * onError; it never throws.
 */
export function applyAppErrorToForm(
  error: AppError,
  setFieldError: (field: string, message: string) => void,
): void {
  const map = fieldErrorsToMap(error);
  for (const [field, message] of Object.entries(map)) {
    setFieldError(field, message);
  }
}

/** Blank / missing field names collapse to the form root. */
function normalizeField(field: string | undefined | null): string {
  const trimmed = field?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : ROOT_FIELD;
}

/** Prefer the catalog's resolved Korean copy (which already favors a safe
 *  server message) when synthesizing a message for a code/root error. */
function catalogMessage(error: AppError): string {
  return resolveError(error).message;
}
