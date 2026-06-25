/**
 * Korean user-facing copy for every error code, plus network/timeout/generic
 * fallbacks and the retry-button label.
 *
 * Principle: say WHAT went wrong and HOW to fix it — never vague ("오류가
 * 발생했습니다"). Tone is kept consistent with `ui/primitives/ErrorState`'s
 * DEFAULTS so the same failure reads identically anywhere it surfaces.
 *
 * Note: a *safe* server-provided Korean `message` may override these at the
 * presentation layer (see `resolveError`); these are the trustworthy defaults.
 */
import type { AppErrorCode } from './types';

/** Per-code default title + body. */
export const ERROR_COPY: Record<AppErrorCode, { title: string; message: string }> = {
  INVALID_INPUT: {
    title: '입력값을 확인해 주세요',
    message: '입력한 정보에 문제가 있어요. 표시된 항목을 다시 확인해 주세요.',
  },
  ENTITY_NOT_FOUND: {
    title: '찾을 수 없어요',
    message: '삭제되었거나 존재하지 않는 콘텐츠예요. 목록에서 다시 선택해 주세요.',
  },
  DUPLICATE_EMAIL: {
    title: '이미 가입된 이메일이에요',
    message: '이 이메일로 가입된 계정이 있어요. 다른 이메일을 사용하거나 로그인해 주세요.',
  },
  DUPLICATE_NICKNAME: {
    title: '이미 사용 중인 닉네임이에요',
    message: '다른 닉네임을 입력해 주세요. 한글·영문·숫자·밑줄(_)만 사용할 수 있어요.',
  },
  INVALID_CREDENTIALS: {
    title: '로그인할 수 없어요',
    message: '이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.',
  },
  UNAUTHORIZED: {
    title: '다시 로그인해 주세요',
    message: '로그인이 만료되었어요. 다시 로그인하면 이어서 이용할 수 있어요.',
  },
  INVALID_TOKEN: {
    title: '다시 로그인해 주세요',
    message: '로그인 정보가 만료되었어요. 다시 로그인해 주세요.',
  },
  FORBIDDEN: {
    title: '접근 권한이 없어요',
    message: '이 콘텐츠를 볼 수 있는 권한이 없어요.',
  },
  ADULT_ONLY: {
    title: '19세 이용가 작품이에요',
    message: '성인 인증을 완료하면 이용할 수 있어요. 프로필에서 본인 인증을 진행해 주세요.',
  },
  INVALID_IMAGE: {
    title: '이미지를 처리할 수 없어요',
    message: 'JPEG 또는 PNG 형식의 이미지를 사용해 주세요. 파일 크기가 너무 크지 않은지도 확인해 주세요.',
  },
  UNKNOWN: {
    title: '문제가 생겼어요',
    message: '잠시 후 다시 시도해 주세요. 계속되면 앱을 다시 실행해 주세요.',
  },
};

/** No response reached the server (offline / DNS / connection refused). */
export const NETWORK_COPY: { title: string; message: string } = {
  title: '연결이 불안정해요',
  message: '인터넷 연결을 확인하고 다시 시도해 주세요.',
};

/** Request was made but the server didn't respond in time. */
export const TIMEOUT_COPY: { title: string; message: string } = {
  title: '응답이 지연되고 있어요',
  message: '네트워크가 느린 것 같아요. 잠시 후 다시 시도해 주세요.',
};

/** Last-resort fallback when no more specific copy applies. */
export const GENERIC_COPY: { title: string; message: string } = {
  title: '문제가 생겼어요',
  message: '잠시 후 다시 시도해 주세요. 계속되면 앱을 다시 실행해 주세요.',
};

/** Standard retry-button label, kept in one place for consistency. */
export const RETRY_LABEL: string = '다시 시도';
