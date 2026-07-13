/**
 * ErrorState — explains what went wrong + how to fix it, in the app's
 * voice. Maps backend ErrorResponse.code (frontend-guide §3.3) to a
 * sensible default Korean message, but a caller-supplied `message`
 * (the server's Korean `message`) wins. ADULT_ONLY / FORBIDDEN render
 * without a retry button (retrying won't help).
 */
import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '../use-theme';

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'ENTITY_NOT_FOUND'
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_NICKNAME'
  | 'DUPLICATE_POST_CATEGORY'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'FORBIDDEN'
  | 'ADULT_ONLY'
  | 'INVALID_IMAGE'
  | 'NETWORK'
  | 'UNKNOWN';

export type ErrorStateProps = {
  code?: ApiErrorCode;
  message?: string; // server Korean message; overrides default
  onRetry?: () => void; // hidden for non-retryable codes
};

const DEFAULTS: Record<ApiErrorCode, { title: string; body: string; retryable: boolean }> = {
  ADULT_ONLY: { title: '19세 이용가 작품이에요', body: '성인 인증 후 이용할 수 있어요.', retryable: false },
  FORBIDDEN: { title: '접근 권한이 없어요', body: '이 콘텐츠를 볼 수 있는 권한이 없어요.', retryable: false },
  ENTITY_NOT_FOUND: { title: '찾을 수 없어요', body: '삭제되었거나 존재하지 않는 콘텐츠예요.', retryable: false },
  NETWORK: { title: '연결이 불안정해요', body: '네트워크를 확인하고 다시 시도해 주세요.', retryable: true },
  INVALID_INPUT: { title: '입력값을 확인해 주세요', body: '입력한 정보를 다시 확인해 주세요.', retryable: false },
  INVALID_IMAGE: { title: '이미지를 처리할 수 없어요', body: 'JPEG 또는 PNG 이미지를 사용해 주세요.', retryable: false },
  INVALID_CREDENTIALS: { title: '로그인할 수 없어요', body: '이메일 또는 비밀번호를 확인해 주세요.', retryable: false },
  UNAUTHORIZED: { title: '다시 로그인해 주세요', body: '로그인이 만료되었어요.', retryable: false },
  INVALID_TOKEN: { title: '다시 로그인해 주세요', body: '로그인이 만료되었어요.', retryable: false },
  DUPLICATE_EMAIL: { title: '이미 가입된 이메일이에요', body: '다른 이메일을 사용해 주세요.', retryable: false },
  DUPLICATE_NICKNAME: { title: '이미 사용 중인 닉네임이에요', body: '다른 닉네임을 사용해 주세요.', retryable: false },
  DUPLICATE_POST_CATEGORY: { title: '이미 있는 카테고리예요', body: '같은 이름의 카테고리가 이미 등록되어 있어요.', retryable: false },
  UNKNOWN: { title: '문제가 생겼어요', body: '잠시 후 다시 시도해 주세요.', retryable: true },
};

export function ErrorState({ code = 'UNKNOWN', message, onRetry }: ErrorStateProps) {
  const t = useTheme();
  const d = DEFAULTS[code] ?? DEFAULTS.UNKNOWN;
  const showRetry = d.retryable && !!onRetry;
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: t.space['3xl'],
        gap: t.space.md,
      }}
    >
      <Text variant="headline" weight="semibold" style={{ textAlign: 'center' }}>
        {d.title}
      </Text>
      <Text variant="body" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
        {message ?? d.body}
      </Text>
      {showRetry ? (
        <View style={{ marginTop: t.space.md }}>
          <Button label="다시 시도" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
