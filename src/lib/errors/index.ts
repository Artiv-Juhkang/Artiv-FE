/**
 * errors module barrel.
 *
 * Import surface:
 *   import { normalizeError, AppError, resolveError } from '@/lib/errors';
 */
export * from './types';
export { normalizeError } from './normalizeError';
export {
  errorCatalog,
  resolveError,
  isRecoverable,
  isFatal,
  type ErrorKind,
  type ErrorPresentation,
} from './errorCatalog';
export * from './messages';
