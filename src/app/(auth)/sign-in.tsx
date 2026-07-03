/**
 * Sign-in — the Glass Stack reference auth screen. Proves the wiring end to end
 * (useAuth().login -> tokenStore -> protected stack guard flips) AND realises
 * the approved concept: a frosted-glass form floating, centered, over a soft
 * color aurora (CoverWall).
 *
 * Layout (matches the approved mockup #4):
 *   - <Screen surface="glass" center background={<CoverWall/>}> paints the
 *     full-screen aurora behind everything and vertically centers the form.
 *   - One <GlassCard> holds the whole form: email, password, the PRIMARY 로그인
 *     CTA (inside the card, not a stranded footer), the social slot, and the
 *     회원가입 / 비밀번호 찾기 links.
 *
 * Double-tap safety (req #2): 로그인's onPress is the async `onSubmit` passed
 * DIRECTLY to Button, so its useAsyncPress lock holds for the whole login
 * promise. `submitting` is a second line of defence.
 *
 * Error handling (unchanged): INVALID_CREDENTIALS -> general message;
 * fieldErrors -> per-field via applyAppErrorToForm; network/timeout copy; on
 * success do NOTHING (the protected guard redirects — avoids expo #30700).
 */
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { SocialButtonRow } from '@/features/auth/SocialButtonRow';
import { useAuth } from '@/features/auth';
import { isAppError, normalizeError } from '@/lib/errors';
import { applyAppErrorToForm } from '@/lib/forms/fieldErrors';
import { Button, CoverWall, GlassCard, Screen, Text, useTheme, useToast } from '@/ui';

export default function SignInScreen() {
  const t = useTheme();
  const { login } = useAuth();
  const { show } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    if (submitting) return; // second line of defence behind Button's press-lock
    setFieldErrors({});
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Success: do NOT navigate — the protected stack guard flips on
      // status === 'authenticated' and the router redirects for us.
    } catch (e) {
      const err = isAppError(e) ? e : normalizeError(e);
      if (err.code === 'INVALID_CREDENTIALS') {
        setFormError('이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.');
      } else if (err.fieldErrors.length > 0 || err.code === 'INVALID_INPUT') {
        const next: Record<string, string> = {};
        applyAppErrorToForm(err, (field, message) => {
          next[field] = message;
        });
        if (next.root) {
          setFormError(next.root);
          delete next.root;
        } else if (Object.keys(next).length === 0) {
          setFormError(err.message);
        }
        setFieldErrors(next);
      } else if (err.isNetwork) {
        setFormError('네트워크 연결을 확인하고 다시 시도해 주세요.');
      } else if (err.isTimeout) {
        setFormError('응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.');
      } else {
        setFormError(err.message || '로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, password, login, submitting]);

  // Inputs read the GLASS FIELD roles so they sit as translucent panels ON the
  // glass card (not opaque chrome boxes).
  const inputStyle = {
    minHeight: t.layout.minHitTarget,
    borderWidth: 1,
    borderColor: t.color.glassFieldBorder,
    borderRadius: t.radius.md,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
    color: t.color.onSurface,
    backgroundColor: t.color.glassField,
    fontFamily: t.typography.fontFamily.body,
    fontSize: t.typography.fontSize.body,
  } as const;

  // 회원가입 / 비밀번호 찾기 screens aren't built yet — surface a calm placeholder
  // rather than a dead tap or a typed-route to a nonexistent screen.
  const notReady = (label: string) =>
    show({ message: `${label}는 곧 제공될 예정이에요.`, tone: 'neutral' });

  return (
    // No `header` prop — INTENTIONAL. Auth-stack roots are header-less by
    // convention: there is no back target (this IS the entry), the brand lives
    // in the centered form (below), not a chrome band, and a solid/transparent
    // header would fight the full-screen CoverWall aurora. See ScreenLayout
    // §6 (root-vs-pushed) — sign-in is the documented header-less ROOT.
    <Screen surface="glass" scroll center background={<CoverWall />}>
      <View style={{ gap: t.space.xl }}>
        {/* Brand-forward header (over the aurora). */}
        <View style={{ gap: t.space.xs, paddingHorizontal: t.space.xs }}>
          <Text variant="micro" weight="semibold" color="kicker" caps>
            그림 · 만화 · 음악
          </Text>
          <Text variant="display" weight="bold">
            Artiv
          </Text>
          <Text variant="body" color="onSurfaceSecondary">
            보던 작품이, 기다리고 있어요.
          </Text>
        </View>

        {/* One frosted card holds the whole form. */}
        <GlassCard style={{ padding: t.space.xl, gap: t.space.lg }}>
          <View style={{ gap: t.space.md }}>
            <View style={{ gap: t.space.xs }}>
              <Text variant="label" color="onSurfaceSecondary">
                이메일
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={t.color.onSurfaceMuted}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                inputMode="email"
                textContentType="emailAddress"
                editable={!submitting}
                accessibilityLabel="이메일"
                style={inputStyle}
              />
              {fieldErrors.email ? (
                <Text variant="caption" color="danger">
                  {fieldErrors.email}
                </Text>
              ) : null}
            </View>

            <View style={{ gap: t.space.xs }}>
              <Text variant="label" color="onSurfaceSecondary">
                비밀번호
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호"
                placeholderTextColor={t.color.onSurfaceMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                textContentType="password"
                editable={!submitting}
                onSubmitEditing={() => void onSubmit()}
                returnKeyType="go"
                accessibilityLabel="비밀번호"
                style={inputStyle}
              />
              {fieldErrors.password ? (
                <Text variant="caption" color="danger">
                  {fieldErrors.password}
                </Text>
              ) : null}
            </View>

            {formError ? (
              <Text variant="callout" color="danger" accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}
          </View>

          {/* PRIMARY CTA — inside the card (matches the concept). */}
          <Button label="로그인" fullWidth loading={submitting} onPress={onSubmit} />

          {/* Social-login slot (req #7) — "또는" divider + providers (준비 중). */}
          <SocialButtonRow />

          {/* Secondary links. */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: t.space.sm,
            }}
          >
            <Text
              variant="caption"
              weight="semibold"
              style={{ color: t.color.accent }}
              onPress={() => notReady('회원가입')}
              accessibilityRole="link"
            >
              처음이라면 회원가입
            </Text>
            <Text variant="caption" color="onSurfaceMuted">
              ·
            </Text>
            <Text
              variant="caption"
              color="onSurfaceSecondary"
              onPress={() => notReady('비밀번호 찾기')}
              accessibilityRole="link"
            >
              비밀번호 찾기
            </Text>
          </View>
        </GlassCard>
      </View>
    </Screen>
  );
}
