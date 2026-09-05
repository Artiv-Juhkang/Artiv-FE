/**
 * 회원가입 — 이메일 가입의 유일한 입구.
 * ------------------------------------------------------------------
 * 백엔드(POST /api/auth/signup)는 처음부터 완성돼 있었는데 화면이 없어서, 새로 온 사람은
 * 로그인 화면에서 더 갈 데가 없었다(온보딩 퍼널이 통째로 막혀 있었다).
 *
 * 로그인과 같은 폼 언어(CoverWall 위 GlassCard + 글래스 필드)를 그대로 쓴다 — 가입은
 * 로그인의 옆문이지 다른 세계가 아니다.
 *
 * 검증을 화면에서 한 번 더 하는 이유: 서버도 같은 규칙을 강제하지만, 만 14세 미만처럼
 * "고칠 수 없는" 거절을 왕복 후에 알려주는 건 불친절하다. 서버 응답의 fieldErrors도 그대로
 * 받아 필드 밑에 붙인다(형식 규칙의 정본은 서버).
 *
 * 비밀번호 찾기는 여기 없다 — 메일 발송 인프라가 아직 없어서(별도 슬라이스) 가입만 연다.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/AuthContext';
import { isAppError, normalizeError } from '@/lib/errors';
import { applyAppErrorToForm } from '@/lib/forms/fieldErrors';
import { Button, CoverWall, GlassCard, Screen, Text, useTheme, useToast } from '@/ui';

/** 가입 시 반드시 받아야 하는 동의(백엔드 ConsentType과 1:1). */
const REQUIRED_CONSENTS = [
  { key: 'TERMS_OF_SERVICE', label: '이용약관에 동의합니다', doc: 'terms' },
  { key: 'PRIVACY_POLICY', label: '개인정보 처리방침에 동의합니다', doc: 'privacy' },
] as const;

/** 선택 동의 — 안 해도 가입된다. */
const OPTIONAL_CONSENTS = [
  { key: 'MARKETING_EMAIL', label: '새 소식·추천 작품 메일 받기 (선택)', doc: null },
] as const;

const MIN_AGE = 14;

/** YYYY-MM-DD 문자열을 만 나이로. 형식이 어긋나면 null. */
function ageFrom(birth: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday =
    now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export default function SignUpScreen() {
  const t = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const { signup } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggle = useCallback((key: string) => {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const allRequiredAgreed = useMemo(
    () => REQUIRED_CONSENTS.every((c) => agreed[c.key]),
    [agreed],
  );

  const onSubmit = async () => {
    if (submitting) return;
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = '이메일을 입력해 주세요.';
    if (password.length < 8) next.password = '비밀번호는 8자 이상이어야 해요.';
    if (!nickname.trim()) next.nickname = '닉네임을 입력해 주세요.';

    const age = ageFrom(birthDate);
    if (age === null) next.birthDate = '생년월일을 YYYY-MM-DD로 입력해 주세요.';
    else if (age < MIN_AGE) next.birthDate = `만 ${MIN_AGE}세부터 가입할 수 있어요.`;

    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!allRequiredAgreed) {
      setFormError('필수 항목에 동의해야 가입할 수 있어요.');
      return;
    }
    setFormError(null);

    setSubmitting(true);
    try {
      await signup({
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        birthDate: birthDate.trim(),
        consents: {
          ...Object.fromEntries(REQUIRED_CONSENTS.map((c) => [c.key, true])),
          ...Object.fromEntries(OPTIONAL_CONSENTS.map((c) => [c.key, Boolean(agreed[c.key])])),
        },
      });
      // 가입 성공 = 이미 로그인 상태다(AuthContext가 이어서 로그인한다) — 화면 이동은
      // 인증 가드가 알아서 한다. 여기서 직접 push하면 로그인 직후 경쟁이 생긴다.
      show({ message: '가입이 끝났어요. 반가워요!', tone: 'success' });
    } catch (e) {
      const err = normalizeError(e);
      if (isAppError(e)) {
        // 형식 규칙의 정본은 서버다 — 응답의 fieldErrors를 그대로 필드 밑에 붙인다.
        applyAppErrorToForm(e, (field, message) =>
          setFieldErrors((prev) => ({ ...prev, [field]: message })),
        );
      }
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  const field = (
    label: string,
    node: React.ReactNode,
    errorKey: string,
    hint?: string,
  ) => (
    <View style={{ gap: t.space.xs }}>
      <Text variant="label" color="onSurfaceSecondary">
        {label}
      </Text>
      {node}
      {fieldErrors[errorKey] ? (
        <Text variant="caption" color="danger">
          {fieldErrors[errorKey]}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="onSurfaceMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen surface="glass" scroll center background={<CoverWall />}>
      <GlassCard style={{ padding: t.space.xl, gap: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <Text variant="display" weight="bold">
            회원가입
          </Text>
          <Text variant="callout" color="onSurfaceSecondary">
            웹툰·소설·오디오를 한곳에서 보고, 모아두고, 이야기해요.
          </Text>
        </View>

        <View style={{ gap: t.space.md }}>
          {field(
            '이메일',
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
            />,
            'email',
          )}

          {field(
            '비밀번호',
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="8자 이상"
              placeholderTextColor={t.color.onSurfaceMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!submitting}
              accessibilityLabel="비밀번호"
              style={inputStyle}
            />,
            'password',
          )}

          {field(
            '닉네임',
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="한글·영문·숫자 20자 이내"
              placeholderTextColor={t.color.onSurfaceMuted}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              accessibilityLabel="닉네임"
              style={inputStyle}
            />,
            'nickname',
          )}

          {field(
            '생년월일',
            <TextInput
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="2000-01-01"
              placeholderTextColor={t.color.onSurfaceMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              editable={!submitting}
              accessibilityLabel="생년월일"
              style={inputStyle}
            />,
            'birthDate',
            '연령 확인에만 써요. 19세 이용가 작품 열람 여부도 이 값으로 정해져요.',
          )}
        </View>

        <View style={{ gap: t.space.sm }}>
          {[...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS].map((c) => {
            const on = Boolean(agreed[c.key]);
            return (
              // 행 전체가 체크박스라 문서 '보기'는 형제로 분리한다 — 중첩하면 웹에서
              // <button> 안 <button>이 되고(P3-6에서 겪은 것과 같은 위반) 어디를 눌렀는지도 모호해진다.
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <Pressable
                onPress={() => toggle(c.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={c.label}
                disabled={submitting}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.space.sm,
                  minHeight: t.layout.minHitTarget,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: t.radius.sm,
                    borderWidth: 1.5,
                    borderColor: on ? t.color.accent : t.color.glassFieldBorder,
                    backgroundColor: on ? t.color.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? (
                    <Text variant="caption" weight="bold" style={{ color: t.color.onPrimary }}>
                      ✓
                    </Text>
                  ) : null}
                </View>
                <Text variant="callout" style={{ flexShrink: 1 }}>
                  {c.label}
                </Text>
              </Pressable>
                {c.doc ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: c.doc } })}
                    accessibilityRole="link"
                    accessibilityLabel={`${c.label} 전문 보기`}
                    hitSlop={8}
                    style={{ minHeight: t.layout.minHitTarget, justifyContent: 'center' }}
                  >
                    <Text variant="caption" weight="semibold" style={{ color: t.color.accent }}>
                      보기
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        {formError ? (
          <Text variant="caption" color="danger">
            {formError}
          </Text>
        ) : null}

        <Button label="가입하고 시작하기" fullWidth loading={submitting} onPress={onSubmit} />

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="로그인으로 돌아가기"
          style={{ minHeight: t.layout.minHitTarget, justifyContent: 'center' }}
        >
          <Text variant="callout" color="accent" style={{ textAlign: 'center' }}>
            이미 계정이 있어요 · 로그인
          </Text>
        </Pressable>
      </GlassCard>
    </Screen>
  );
}
