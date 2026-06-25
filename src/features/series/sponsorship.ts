/**
 * 정기 후원 / 멤버십 SEAM — series-level monetization.
 * ==================================================================
 * WHY THIS FILE EXISTS NOW (the only monetization that ships today is the
 * wait-free time-lock; there is NO membership / coin / sponsorship endpoint):
 *
 * roadmap-and-monetization.md puts 후원(일회/정기)·멤버십 at STAGE 2 (after the
 * coin + paid-preview stage). The backend exposes nothing for it yet, so we do
 * NOT fake one. Instead this file defines the *shape of the seam* so that, the
 * day the backend ships a membership/purchase API, turning sponsorship on is
 * WIRING (fill in the marked spots) rather than RESTRUCTURING — no UI rewrite,
 * no change to the error system, no change to the EpisodeAccessEvaluator call.
 *
 * This is a 1:1 mirror of the social-login seam (`@/features/auth/social.ts`):
 * production types are already the real ones, the entry points already have
 * their production signatures, and TODAY they throw a TYPED "준비 중"
 * (NotReady) AppError so the UI (`SupportButton`) can show a calm message
 * without any backend.
 *
 * What is real today:
 *   - The closed `SupportKind` union + the membership domain types
 *     (`Membership`, `MembershipEntitlement`) that the future entitlement
 *     mirror will use.
 *   - `MEMBERSHIP_BENEFITS` — the copy that drives the explainer sheet
 *     (`SupportButton`'s Modal). These are the real planned benefits from the
 *     monetization doc (미리보기 무료 · 광고 제거 · 후원), not placeholders.
 *   - `coversEpisode(...)` — the FRONT mirror of the backend's
 *     `EpisodeAccessEvaluator` injection point. TODAY it always returns false
 *     (no entitlement exists), so every lock decision falls through to the
 *     existing wait-free `freeAt` countdown. See the WIRING note on it.
 *
 * What is deliberately a stub (the WIRING spots, marked `WIRING:`):
 *   1. startMembership(seriesId) — run the purchase/subscription flow and
 *      return the resulting `Membership`. TODAY throws NotReady.
 *   2. openSupport(seriesId, kind) — open the support sheet / checkout for a
 *      one-time OR membership support. TODAY throws NotReady.
 *   3. coversEpisode(...) — once entitlements are fetched, return whether the
 *      viewer's membership unlocks `episode`. TODAY false (fall-through).
 *
 * ------------------------------------------------------------------
 * ERROR-SYSTEM DECISION (identical to social.ts — keep them consistent):
 * `AppErrorCode` (src/lib/errors/types.ts) is a CLOSED union backed by
 * exhaustive `Record<AppErrorCode, …>` maps (errorCatalog.ts, messages.ts).
 * Adding a `NOT_READY` member would force edits to those maps and couple a
 * frontend-only concept into the backend error contract.
 *
 * So the "준비 중" error is a normal `AppError` with `code: 'UNKNOWN'` (stays
 * inside the closed union — `resolveError`, `normalizeError`, QueryCache.onError
 * all keep working untouched) but is TAGGED on `raw` with a discriminator and
 * carries dedicated Korean copy. Callers detect it with the exported
 * `isMembershipNotReadyError()` guard and show the calm neutral message instead
 * of the generic failure toast.
 *
 * WIRING (query layer): when the backend ships, add `keys.me.memberships()` to
 * `@/lib/query/keys` and a `useMemberships()` selector that hydrates a
 * `MembershipEntitlement`; pass it into `coversEpisode` from the access guard.
 * It is intentionally NOT added now (YAGNI — an unused query key is debt).
 *
 * NOTE: this module stays PURE LOGIC — zero React / react-native imports — so
 * it can be unit-tested and imported anywhere (mirrors social.ts).
 */
import { AppError } from '@/lib/errors';
import type { SeriesDetail, EpisodeSummary } from '@/api/types';

// ── Support kinds ──────────────────────────────────────────────────
/**
 * Closed set of support actions. 일회 후원(ONE_TIME) vs 정기 후원 = 멤버십
 * (MEMBERSHIP, 월정액). The roadmap treats 정기 후원 AS the membership tier;
 * we keep both in one union so the sheet can branch without a second type.
 */
export type SupportKind = 'ONE_TIME' | 'MEMBERSHIP';

// ── Domain types (already production-shaped) ───────────────────────
/**
 * A viewer's membership state for one series. `tierId` is opaque (the backend
 * will own tier ids); `renewsAt` is the next billing date for an active
 * 정기 후원. All fields are required here because this is OUR model, not a
 * codegen DTO — the WIRING layer maps the future API response into it.
 */
export interface Membership {
  seriesId: number;
  tierId: string;
  active: boolean;
  renewsAt?: string | null;
}

/**
 * Front-side mirror of the backend ENTITLEMENT table
 * (roadmap §"엔타이틀먼트(접근권) 테이블"). The access guard consults this to
 * decide whether a locked episode is already covered by the viewer's
 * membership BEFORE falling back to the wait-free countdown.
 *
 * A `ReadonlySet` of series ids the viewer is a member of is the minimal shape
 * `coversEpisode` needs today; richer per-episode entitlements (paid preview
 * unlocks) plug in here later without changing the call sites.
 */
export interface MembershipEntitlement {
  memberOfSeriesIds: ReadonlySet<number>;
}

// ── Benefit copy (drives the explainer sheet) ──────────────────────
/** One row in the membership explainer sheet. */
export interface MembershipBenefit {
  /** Stable key (for list rendering + future analytics). */
  key: 'preview' | 'noAds' | 'support';
  /** SF Symbol name the sheet renders next to the row (expo-symbols). */
  sfSymbol: string;
  /** Short Korean title. */
  title: string;
  /** One-line Korean description. */
  description: string;
}

/**
 * The three planned member benefits from roadmap-and-monetization.md
 * (정기 후원 = 멤버십 → 멤버 혜택: 미리보기 무료 · 전용/광고제거 · 후원).
 * Real planned copy, NOT lorem — the sheet is honest about what membership
 * will offer once it ships.
 */
export const MEMBERSHIP_BENEFITS: readonly MembershipBenefit[] = [
  {
    key: 'preview',
    sfSymbol: 'lock.open',
    title: '미리보기 무료',
    description: '기다리지 않고 잠긴 최신 화를 바로 볼 수 있어요.',
  },
  {
    key: 'noAds',
    sfSymbol: 'sparkles',
    title: '광고 없이 감상',
    description: '광고 없이 깔끔하게 작품에 몰입할 수 있어요.',
  },
  {
    key: 'support',
    sfSymbol: 'heart.fill',
    title: '작가 직접 후원',
    description: '정기 후원으로 좋아하는 작가의 연재를 응원해요.',
  },
] as const;

// ── "준비 중" (NotReady) typed error ───────────────────────────────
/** Discriminator we stash on AppError.raw so the guard is exact, not fuzzy. */
const MEMBERSHIP_NOT_READY_TAG = 'series.membership.notReady' as const;

interface MembershipNotReadyRaw {
  reason: typeof MEMBERSHIP_NOT_READY_TAG;
  seriesId: number;
  kind: SupportKind;
}

/** Calm Korean copy shown when a user taps 정기 후원 today. */
export const MEMBERSHIP_NOT_READY_MESSAGE =
  '정기 후원은 준비 중이에요. 곧 만나보실 수 있어요.';

/**
 * Build the typed "준비 중" error. It is a real `AppError` (so it flows through
 * every existing catch/normalize path) with `code: 'UNKNOWN'` to stay inside
 * the closed union, tagged on `raw` so `isMembershipNotReadyError` can detect
 * it precisely and the UI can show the calm neutral message instead of a
 * failure toast.
 */
export function makeMembershipNotReadyError(
  seriesId: number,
  kind: SupportKind,
): AppError {
  const raw: MembershipNotReadyRaw = {
    reason: MEMBERSHIP_NOT_READY_TAG,
    seriesId,
    kind,
  };
  return new AppError({
    status: 0,
    code: 'UNKNOWN',
    message: MEMBERSHIP_NOT_READY_MESSAGE,
    fieldErrors: [],
    isNetwork: false,
    isTimeout: false,
    raw,
  });
}

/** Type guard: was this the typed membership "준비 중" error (not a real failure)? */
export function isMembershipNotReadyError(
  e: unknown,
): e is AppError & { raw: MembershipNotReadyRaw } {
  return (
    e instanceof AppError &&
    typeof e.raw === 'object' &&
    e.raw !== null &&
    (e.raw as Partial<MembershipNotReadyRaw>).reason === MEMBERSHIP_NOT_READY_TAG
  );
}

// ── Seam entry points ──────────────────────────────────────────────
/**
 * Begin a 정기 후원 (membership) for `seriesId`.
 *
 * TODAY: throws `makeMembershipNotReadyError(seriesId, 'MEMBERSHIP')` (the UI
 * catches it via `isMembershipNotReadyError` and shows the calm message).
 *
 * FUTURE (wiring only): the body becomes the purchase/subscription flow and
 * resolves to the resulting `Membership`. The return type is ALREADY
 * `Promise<Membership>` so flipping it on is a one-line change and the caller
 * never learns it used to throw.
 */
export async function startMembership(seriesId: number): Promise<Membership> {
  // ── WIRING (remove this throw when the backend ships) ──
  throw makeMembershipNotReadyError(seriesId, 'MEMBERSHIP');

  // ── WIRING: run checkout, then return the created membership ──
  // const result = await purchaseMembership(seriesId);
  // return result;
}

/**
 * Open the support flow for `seriesId` — either a 일회 후원 or a 정기 후원
 * (defaults to MEMBERSHIP, the primary CTA). TODAY throws NotReady; FUTURE this
 * opens the real support sheet / checkout.
 */
export async function openSupport(
  seriesId: number,
  kind: SupportKind = 'MEMBERSHIP',
): Promise<void> {
  // ── WIRING (remove this throw when the backend ships) ──
  throw makeMembershipNotReadyError(seriesId, kind);
}

// ── EpisodeAccessEvaluator front mirror ────────────────────────────
/**
 * Does the viewer's membership cover this episode? FRONT mirror of the backend
 * access-guard injection point (roadmap §"주입점 ①":
 *   `if (membership.covers(viewerId, series)) return open()`).
 *
 * TODAY: always returns `false`. No membership endpoint exists, so every lock
 * decision falls through to the existing wait-free `freeAt` countdown — the
 * ONLY monetization that ships now. This keeps the access logic centralized so
 * that when memberships land, the lock UI gains "member → open" with ZERO
 * structural change (just flip the body to the commented membership check).
 *
 * The signature already accepts the future `entitlement` + an `episode` so the
 * call site is final; `episode` is unused today (no per-episode coverage yet).
 *
 * Guards: a null/undefined entitlement, a series with no id (codegen-optional),
 * or no entitlement membership all yield `false` (locked → countdown).
 */
export function coversEpisode(
  entitlement: MembershipEntitlement | null | undefined,
  series: Pick<SeriesDetail, 'id'> | null | undefined,
  episode?: Pick<EpisodeSummary, 'episodeNo'>,
): boolean {
  // `episode` is the future per-episode coverage input; unused today. Reading
  // it keeps the param "live" without changing behavior.
  void episode;

  // ── WIRING (flip on when entitlements are fetched) ──
  // SeriesDetail.id is codegen-optional → guard before any lookup.
  if (entitlement == null) return false;
  if (series?.id == null) return false;
  // return entitlement.memberOfSeriesIds.has(series.id);

  // No entitlement source today → never covered; wait-free countdown governs.
  return false;
}
