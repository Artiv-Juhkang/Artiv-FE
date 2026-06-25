/**
 * SocialButtonRow — the social-login UI slot under the email form.
 * ==================================================================
 * Renders a "또는" divider followed by brand-correct provider buttons
 * (Kakao #FEE500, Google white+stroke, Apple black/white per scheme) in the
 * Glass Stack look. TODAY each button surfaces "준비 중입니다" by catching the
 * typed NotReady error from `socialLogin` — no backend involved.
 *
 * Brand correctness (NOT the app theme — brand palettes are fixed):
 *   - Kakao : #FEE500 fill, near-black glyph/label (Kakao identity guideline).
 *   - Google: white fill, #1F1F1F label, #747775 neutral stroke (Google
 *     "Sign in with Google" guideline — the white button needs an edge).
 *   - Apple : BLACK button + white text on LIGHT scheme, WHITE button + black
 *     text on DARK scheme (Apple HIG "Sign in with Apple" button). Resolved
 *     here from `useTheme().isDark` since the registry leaves it scheme-bound.
 *
 * Accessibility:
 *   - role="button", per-provider Korean a11yLabel from the registry,
 *     busy/disabled states announced, 44pt min hit target from tokens.
 *
 * Double-tap safety:
 *   - Presses go through `useAsyncPress` (the app-wide async press lock,
 *     requirement #2) so a rapid double tap never fires `socialLogin` twice
 *     or stacks two "준비 중" toasts. Until that primitive lands, this falls
 *     back to a local in-flight ref (see `useGuardedPress`), so the component
 *     is safe to ship standalone.
 *
 * Apple App Store rule (encoded here): Guideline 4.8 requires Sign in with
 * Apple on iOS whenever any third-party social login is offered. So on iOS we
 * ALWAYS render Apple; on Android it may be omitted. See `social.ts`.
 */
import { useCallback, useRef } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text, useToast, useTheme } from '@/ui';
import {
  isSocialNotReadyError,
  socialLogin,
  socialProvidersInOrder,
  SOCIAL_NOT_READY_MESSAGE,
  type SocialProvider,
  type SocialProviderMeta,
} from './social';

export interface SocialButtonRowProps {
  /** Korean divider label above the buttons. Default "또는". */
  dividerLabel?: string;
  /**
   * Hide providers that aren't ready to ship on the current platform.
   * iOS always keeps Apple (Guideline 4.8). Default shows all in the
   * registry order.
   */
  visibleProviders?: SocialProvider[];
}

export function SocialButtonRow({
  dividerLabel = '또는',
  visibleProviders,
}: SocialButtonRowProps) {
  const t = useTheme();
  const toast = useToast();

  const onProviderPress = useCallback(
    async (provider: SocialProvider) => {
      try {
        // FUTURE: `await socialLogin(provider)` returns TokenResponse and the
        // AuthContext.socialLogin action takes over (setTokens → fetchMe →
        // protected stack guard flips). TODAY it throws the typed NotReady
        // error, which we translate into the calm "준비 중" toast below.
        await socialLogin(provider);
      } catch (e) {
        if (isSocialNotReadyError(e)) {
          // 'neutral' tone: this is informational ("준비 중"), not a failure.
          toast.show({ tone: 'neutral', message: SOCIAL_NOT_READY_MESSAGE });
          return;
        }
        // A genuine failure once social ships — surface as a danger toast.
        toast.show({ tone: 'danger', message: '로그인 중 문제가 생겼어요.' });
      }
    },
    [toast],
  );

  const providers = resolveVisible(visibleProviders);

  return (
    <View style={{ gap: t.space.lg }}>
      <OrDivider label={dividerLabel} />
      <View style={{ gap: t.space.sm }}>
        {providers.map((meta) => (
          <SocialButton key={meta.provider} meta={meta} onPress={onProviderPress} />
        ))}
      </View>
    </View>
  );
}

// ── "또는" divider ─────────────────────────────────────────────────
function OrDivider({ label }: { label: string }) {
  const t = useTheme();
  const line: ViewStyle = { flex: 1, height: 1, backgroundColor: t.color.border };
  return (
    <View
      accessibilityRole="none"
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}
    >
      <View style={line} />
      <Text variant="caption" color="onSurfaceMuted">
        {label}
      </Text>
      <View style={line} />
    </View>
  );
}

// ── One brand button ──────────────────────────────────────────────
function SocialButton({
  meta,
  onPress,
}: {
  meta: SocialProviderMeta;
  onPress: (p: SocialProvider) => Promise<void>;
}) {
  const t = useTheme();
  const { run, busy } = useGuardedPress();

  // Apple resolves its colors from the scheme; others use the fixed brand.
  const { fill, fg, border } = resolveColors(meta, t.isDark);

  const handlePress = useCallback(() => {
    void run(() => onPress(meta.provider));
  }, [run, onPress, meta.provider]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.a11yLabel}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={handlePress}
      style={({ pressed }) => ({
        minHeight: t.layout.minHitTarget,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.space.sm,
        paddingHorizontal: t.space.xl,
        borderRadius: t.radius.md,
        backgroundColor: fill,
        borderWidth: border ? 1 : 0,
        borderColor: border ?? 'transparent',
        opacity: pressed ? t.opacity.pressed : 1,
      })}
    >
      <BrandIcon meta={meta} tint={fg} />
      <Text variant="callout" weight="semibold" style={{ color: fg }}>
        {meta.label}
      </Text>
    </Pressable>
  );
}

// ── Brand glyph: SF Symbol when it exists (Apple), else vendored mark ──
function BrandIcon({ meta, tint }: { meta: SocialProviderMeta; tint: string }) {
  const size = 18;
  if (meta.icon.sfSymbol) {
    return (
      <SymbolView
        name={meta.icon.sfSymbol as Parameters<typeof SymbolView>[0]['name']}
        size={size}
        tintColor={tint}
        // Google/Kakao have no SF Symbol; Apple does. A text fallback keeps
        // the button legible if the symbol is unavailable on the platform.
        fallback={<BrandGlyphFallback glyph={meta.icon.brandGlyph} tint={tint} />}
      />
    );
  }
  // WIRING: swap these text marks for the official brand logo assets
  // (Google "G", Kakao bubble) once the brand asset pack is vendored.
  return <BrandGlyphFallback glyph={meta.icon.brandGlyph} tint={tint} />;
}

function BrandGlyphFallback({ glyph, tint }: { glyph: SocialProvider; tint: string }) {
  const mark = glyph === 'google' ? 'G' : glyph === 'kakao' ? '카' : '';
  if (!mark) return null;
  return (
    <Text variant="callout" weight="bold" style={{ color: tint, width: 18, textAlign: 'center' }}>
      {mark}
    </Text>
  );
}

// ── Color resolution ──────────────────────────────────────────────
function resolveColors(meta: SocialProviderMeta, isDark: boolean) {
  if (meta.provider === 'apple') {
    // Apple HIG: black button on light UI, white button on dark UI.
    return isDark
      ? { fill: '#FFFFFF', fg: '#000000', border: undefined as string | undefined }
      : { fill: '#000000', fg: '#FFFFFF', border: undefined as string | undefined };
  }
  return { fill: meta.brandColor, fg: meta.brandFg, border: meta.brandBorder };
}

// ── Visible-provider resolution (iOS keeps Apple per Guideline 4.8) ──
function resolveVisible(visible?: SocialProvider[]): SocialProviderMeta[] {
  const all = socialProvidersInOrder();
  if (!visible) return all;
  const set = new Set<SocialProvider>(visible);
  if (Platform.OS === 'ios') set.add('apple'); // required alongside any social login
  return all.filter((m) => set.has(m.provider));
}

// ── Local double-tap guard (fallback for `useAsyncPress`) ──────────
/**
 * Temporary in-component guard until the shared `useAsyncPress` (requirement
 * #2) ships in `@/ui`. Locks during the async op so a rapid double tap can't
 * fire twice. When the shared hook lands, replace this with:
 *   `const { run, busy } = useAsyncPress();`  // from '@/ui'
 * and delete this helper — the call sites above are already that shape.
 */
function useGuardedPress() {
  const inFlight = useRef(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await fn();
    } finally {
      inFlight.current = false;
    }
  }, []);
  // `busy` is intentionally not reactive in this fallback (the op is instant
  // today). The real `useAsyncPress` exposes a reactive `busy` for spinners.
  return { run, busy: false as boolean };
}
