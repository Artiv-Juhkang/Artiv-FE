/**
 * Social login SEAM — Google / Kakao / Apple.
 * ==================================================================
 * WHY THIS FILE EXISTS NOW (backend is email/password ONLY today):
 *
 * The backend exposes no social endpoint yet. We do NOT fake one. Instead
 * this file defines the *shape of the seam* so that, the day the backend
 * ships `POST /auth/social`, turning social login on is WIRING (fill in
 * three small marked spots) rather than RESTRUCTURING (no UI rewrite, no
 * change to AuthContext's public surface, no change to the error system).
 *
 * What is real today:
 *   - The closed set of providers + a presentation registry (label, brand
 *     color, a11y label, icon ref) that the UI (`SocialButtonRow`) renders.
 *   - `socialLogin(provider)` — the single async entry point. TODAY it
 *     throws a TYPED, client-only "준비 중" (NotImplemented) AppError so the
 *     UI can show "준비 중입니다" without any backend. The function signature
 *     and return type are ALREADY the production ones.
 *
 * What is deliberately a stub (the three WIRING spots, marked `WIRING:`):
 *   1. acquireProviderToken(provider) — run expo-auth-session (Google) /
 *      Kakao SDK / expo-apple-authentication and return the provider token.
 *   2. exchangeWithBackend(...)       — POST /auth/social { provider, token }
 *      and receive our own TokenResponse (same shape email login returns).
 *   3. (in AuthContext) a `socialLogin` action that calls this, then
 *      `setTokens` + `fetchMe` + flips status — identical tail to `login()`.
 *
 * ------------------------------------------------------------------
 * ERROR-SYSTEM DECISION (important):
 * `AppErrorCode` (src/lib/errors/types.ts) is a CLOSED union backed by
 * exhaustive `Record<AppErrorCode, …>` maps (errorCatalog.ts, messages.ts).
 * Adding a `NOT_IMPLEMENTED` member would force edits to those maps and
 * couple a frontend-only concept into the backend error contract.
 *
 * So the "준비 중" error is a normal `AppError` with `code: 'UNKNOWN'`
 * (keeps it inside the closed union — `resolveError`, `normalizeError`,
 * QueryCache.onError all keep working untouched) but is TAGGED with a
 * discriminator on `raw` and carries dedicated Korean copy. Callers detect
 * it with the exported `isSocialNotReadyError()` guard and show the calm
 * "준비 중입니다" message instead of the generic failure toast.
 */
import { AppError } from '@/lib/errors';
import type { TokenResponse } from '@/api/types';

// ── Providers ─────────────────────────────────────────────────────
/** Closed set of social identity providers we intend to support. */
export type SocialProvider = 'google' | 'kakao' | 'apple';

/** Stable render order for the button row (Apple last per platform habit;
 *  see APPLE GUIDELINE note below for the iOS *requirement* nuance). */
export const SOCIAL_PROVIDER_ORDER: readonly SocialProvider[] = [
  'kakao',
  'google',
  'apple',
] as const;

// ── Icon reference (no RN/JSX dependency here on purpose) ──────────
/**
 * This module stays pure logic — zero React / react-native imports — so it
 * can be unit-tested and imported anywhere. It therefore does NOT render an
 * icon; it only *describes* one. `SocialButtonRow` maps this descriptor to a
 * <SymbolView> or a brand glyph.
 *
 * Apple ships a real SF Symbol (`apple.logo`); Google "G" and Kakao's speech
 * bubble are brand marks that are NOT SF Symbols, so they fall back to a
 * vendored glyph keyed by `brandGlyph`.
 */
export interface SocialIconRef {
  /** SF Symbol name when the brand mark exists as one (Apple only today). */
  sfSymbol?: string;
  /** Fallback brand-glyph key the UI resolves to a vendored asset/text. */
  brandGlyph: SocialProvider;
}

// ── Presentation registry ─────────────────────────────────────────
export interface SocialProviderMeta {
  provider: SocialProvider;
  /** Visible Korean button copy, e.g. "카카오로 시작하기". */
  label: string;
  /**
   * Official brand background color (button fill).
   *  - kakao  #FEE500 (brand yellow, black text/glyph)
   *  - google #FFFFFF (white surface, dark text, neutral border)
   *  - apple  '' → resolved per-color-scheme by the UI (black on light,
   *    white on dark) per Apple's "Sign in with Apple" button guidelines.
   */
  brandColor: string;
  /** Foreground (text + glyph) color that meets contrast on `brandColor`. */
  brandFg: string;
  /** Hairline color when the fill is near-white (Google) and needs an edge. */
  brandBorder?: string;
  /** VoiceOver / TalkBack label (full sentence, not just the brand). */
  a11yLabel: string;
  /** Icon descriptor (see SocialIconRef). */
  icon: SocialIconRef;
}

/**
 * The registry. Colors here are the BRANDS' fixed palettes (Kakao #FEE500,
 * Google white) and are intentionally NOT in the app's theme tokens — brand
 * colors must stay exact across light/dark and must not be re-skinned by the
 * Glass Stack. Apple is the one exception: its button color is mode-dependent
 * by guideline, so `brandColor`/`brandFg` are left empty and the UI fills
 * them from the active color scheme.
 */
export const SOCIAL_REGISTRY: Record<SocialProvider, SocialProviderMeta> = {
  kakao: {
    provider: 'kakao',
    label: '카카오로 시작하기',
    brandColor: '#FEE500',
    brandFg: '#191600', // Kakao guideline: near-black label on yellow (87% black)
    a11yLabel: '카카오 계정으로 로그인',
    icon: { brandGlyph: 'kakao' },
  },
  google: {
    provider: 'google',
    label: 'Google로 시작하기',
    brandColor: '#FFFFFF',
    brandFg: '#1F1F1F', // Google guideline: #1F1F1F text on white
    brandBorder: '#747775', // Google guideline neutral stroke for the white button
    a11yLabel: 'Google 계정으로 로그인',
    icon: { brandGlyph: 'google' },
  },
  apple: {
    provider: 'apple',
    label: 'Apple로 계속하기',
    brandColor: '', // resolved by UI: black (light) / white (dark)
    brandFg: '', // resolved by UI: white (light) / black (dark)
    a11yLabel: 'Apple로 로그인',
    icon: { sfSymbol: 'apple.logo', brandGlyph: 'apple' },
  },
};

/** Convenience: registry entries in the canonical row order. */
export function socialProvidersInOrder(): SocialProviderMeta[] {
  return SOCIAL_PROVIDER_ORDER.map((p) => SOCIAL_REGISTRY[p]);
}

// ── "준비 중" (NotImplemented) typed error ─────────────────────────
/** Discriminator we stash on AppError.raw so the guard is exact, not fuzzy. */
const SOCIAL_NOT_READY_TAG = 'social.notReady' as const;

interface SocialNotReadyRaw {
  reason: typeof SOCIAL_NOT_READY_TAG;
  provider: SocialProvider;
}

/** Calm Korean copy shown when a user taps a social button today. */
export const SOCIAL_NOT_READY_MESSAGE = '준비 중입니다. 곧 만나보실 수 있어요.';

/**
 * Build the typed "준비 중" error. It is a real `AppError` (so it flows through
 * every existing catch/normalize path) with `code: 'UNKNOWN'` to stay inside
 * the closed union, tagged on `raw` so `isSocialNotReadyError` can detect it
 * precisely and the UI can show the calm message instead of a failure toast.
 */
export function makeSocialNotReadyError(provider: SocialProvider): AppError {
  const raw: SocialNotReadyRaw = { reason: SOCIAL_NOT_READY_TAG, provider };
  return new AppError({
    status: 0,
    code: 'UNKNOWN',
    message: SOCIAL_NOT_READY_MESSAGE,
    fieldErrors: [],
    isNetwork: false,
    isTimeout: false,
    raw,
  });
}

/** Type guard: was this the typed social "준비 중" error (not a real failure)? */
export function isSocialNotReadyError(
  e: unknown,
): e is AppError & { raw: SocialNotReadyRaw } {
  return (
    e instanceof AppError &&
    typeof e.raw === 'object' &&
    e.raw !== null &&
    (e.raw as Partial<SocialNotReadyRaw>).reason === SOCIAL_NOT_READY_TAG
  );
}

// ── The seam entry point ───────────────────────────────────────────
/**
 * Begin a social login for `provider`.
 *
 * TODAY: throws `makeSocialNotReadyError(provider)` (the UI catches it via
 * `isSocialNotReadyError` and shows "준비 중입니다").
 *
 * FUTURE (wiring only): the body below becomes
 *     const providerToken = await acquireProviderToken(provider);
 *     return exchangeWithBackend(provider, providerToken);
 * and the AuthContext `socialLogin` action consumes the returned
 * TokenResponse exactly like email login does (setTokens → fetchMe → flip).
 *
 * The return type is ALREADY `Promise<TokenResponse>` so flipping it on is a
 * one-line change and AuthContext never learns it used to throw.
 */
export async function socialLogin(provider: SocialProvider): Promise<TokenResponse> {
  // ── WIRING (remove this block when the backend ships) ──
  throw makeSocialNotReadyError(provider);

  // ── WIRING 1: obtain a provider credential (UNREACHABLE today) ──
  // const providerToken = await acquireProviderToken(provider);
  // ── WIRING 2: trade it for our own session tokens ──
  // return exchangeWithBackend(provider, providerToken);
}

// ── WIRING 1 stub: native/web provider auth ────────────────────────
/**
 * WIRING: implement per provider when SDKs land.
 *   - google: expo-auth-session Google provider (id token) — managed-safe.
 *   - kakao : Kakao native SDK / REST OAuth (access token).
 *   - apple : expo-apple-authentication (identityToken) — iOS only; see note.
 * Returns the opaque provider token the backend will verify.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function acquireProviderToken(provider: SocialProvider): Promise<string> {
  throw makeSocialNotReadyError(provider);
}

// ── WIRING 2 stub: backend token exchange ──────────────────────────
/**
 * WIRING: POST /auth/social { provider, token } → TokenResponse.
 * Use the existing axios client (`@/api/client`) and the same TokenResponse
 * type the email login returns, so the AuthContext tail is identical:
 *   const tokens = await exchangeWithBackend(provider, providerToken);
 *   await setTokens(tokens); queryClient.clear();
 *   const profile = await fetchMe(); applyAuthenticated(profile);
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function exchangeWithBackend(
  provider: SocialProvider,
  providerToken: string,
): Promise<TokenResponse> {
  void providerToken; // WIRING: sent in the POST body once the endpoint exists.
  throw makeSocialNotReadyError(provider);
}

/**
 * APPLE GUIDELINE — read before shipping ANY third-party social login:
 * App Store Review Guideline 4.8 requires "Sign in with Apple" to be offered
 * on iOS whenever the app offers a third-party or social login (Google/Kakao
 * here). So Apple is not optional decoration: the day Google or Kakao goes
 * live on iOS, `apple` MUST be present and functional on iOS. `SocialButtonRow`
 * encodes this by always rendering Apple on iOS (it may be hidden on Android,
 * where there is no such requirement).
 */
