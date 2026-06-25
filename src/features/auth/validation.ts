import type { SignupRequest, ConsentType } from '@/api/types';
import type { AppError } from '@/lib/errors';
import { resolveError } from '@/lib/errors';
import { SIGNUP_MIN_AGE } from './roles';

/**
 * 닉네임 허용 문자셋: 한글·영문·숫자·`_`만, 1~20자.
 * @멘션이 정확히 1명을 가리키게 하기 위한 제한(features.md §2).
 * 위반 시 서버는 400(INVALID_INPUT)으로 거부하지만 클라에서 선차단한다.
 */
export const NICKNAME_RE = /^[A-Za-z0-9가-힣_]{1,20}$/;

/**
 * 가입 시 반드시 동의해야 하는 약관(미동의 시 가입 거부 — features.md §3.1).
 * MARKETING_EMAIL은 선택(기본 opt-out)이라 포함하지 않는다.
 */
export const REQUIRED_CONSENTS: ConsentType[] = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY'];

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * birthDate(YYYY-MM-DD)를 로컬 자정 Date로 파싱. 형식/달력상 불가하면 null.
 */
function parseBirthDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/**
 * (now − 만 나이)를 계산.
 */
function ageInYears(birth: Date, now: Date): number {
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * 가입 폼 클라이언트 검증. 필드명→한국어 에러 메시지 맵을 반환(빈 맵=통과).
 * 메시지는 '무엇이 잘못됐고 어떻게 고치는지'를 담는다.
 */
export function validateSignup(f: SignupRequest): Record<string, string> {
  const errors: Record<string, string> = {};

  // email
  const email = (f.email ?? '').trim();
  if (!email) {
    errors.email = '이메일을 입력해 주세요.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = '이메일 형식이 올바르지 않습니다. 예) name@example.com';
  }

  // password
  const password = f.password ?? '';
  if (!password) {
    errors.password = '비밀번호를 입력해 주세요.';
  } else if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    errors.password = `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해 주세요.`;
  }

  // nickname
  const nickname = (f.nickname ?? '').trim();
  if (!nickname) {
    errors.nickname = '닉네임을 입력해 주세요.';
  } else if (!NICKNAME_RE.test(nickname)) {
    errors.nickname = '닉네임은 한글·영문·숫자·_만 사용해 1~20자로 입력해 주세요.';
  }

  // birthDate (필수, 과거, 만 14세 이상)
  const birthDate = (f.birthDate ?? '').trim();
  if (!birthDate) {
    errors.birthDate = '생년월일을 입력해 주세요. 예) 1990-01-01';
  } else {
    const birth = parseBirthDate(birthDate);
    const now = new Date();
    if (!birth) {
      errors.birthDate = '생년월일 형식이 올바르지 않습니다. YYYY-MM-DD로 입력해 주세요.';
    } else if (birth.getTime() > now.getTime()) {
      errors.birthDate = '생년월일은 오늘 이전 날짜여야 합니다.';
    } else if (ageInYears(birth, now) < SIGNUP_MIN_AGE) {
      errors.birthDate = `만 ${SIGNUP_MIN_AGE}세 이상만 가입할 수 있습니다.`;
    }
  }

  // consents (필수 약관 동의)
  const consents = (f.consents ?? {}) as Record<string, boolean | undefined>;
  for (const required of REQUIRED_CONSENTS) {
    if (consents[required] !== true) {
      errors.consents = '필수 약관(이용약관·개인정보 처리방침)에 모두 동의해 주세요.';
      break;
    }
  }

  return errors;
}

/**
 * 서버 에러(AppError)를 가입 폼 필드 에러 맵으로 매핑.
 * - DUPLICATE_NICKNAME → nickname, DUPLICATE_EMAIL → email(필드 에러가 비어도 합성).
 * - INVALID_INPUT 등은 카탈로그 메시지 + fieldErrors[]를 해당 필드로 spread.
 * - 알 수 없는 필드/코드는 'root'로 수렴.
 * lib/forms/fieldErrors와 톤을 맞춘다.
 */
export function mapServerErrorToForm(err: AppError): Record<string, string> {
  const out: Record<string, string> = {};
  const resolved = resolveError(err);

  switch (err.code) {
    case 'DUPLICATE_NICKNAME':
      out.nickname = '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.';
      break;
    case 'DUPLICATE_EMAIL':
      out.email = '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해 주세요.';
      break;
    case 'INVALID_INPUT':
      // fieldErrors가 채워지면 아래에서 필드별로 덮어쓴다. 없으면 일반 메시지.
      if (err.fieldErrors.length === 0) {
        out.root = resolved.message;
      }
      break;
    default:
      out.root = resolved.message;
      break;
  }

  // 백엔드 필드 에러를 그대로 반영(서버가 가장 구체적인 사유를 안다).
  for (const fe of err.fieldErrors) {
    const field = fe.field || 'root';
    out[field] = fe.reason;
  }

  return out;
}
