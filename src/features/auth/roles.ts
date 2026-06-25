import type { Role } from '@/api/types';

/**
 * 가입 최소 연령(만 14세 미만 가입 차단 — features.md §3.1).
 */
export const SIGNUP_MIN_AGE = 14 as const;

/**
 * 성인 콘텐츠(19금) 열람 최소 연령(만 19세 — features.md §3.5).
 */
export const ADULT_MIN_AGE = 19 as const;

/**
 * 역할이 작가(CREATOR)인지. 권한은 단일 enum(누적 아님)이라 정확히 일치해야 한다.
 */
export function isCreator(r: Role | null): boolean {
  return r === 'CREATOR';
}

/**
 * 역할이 관리자(ADMIN)인지.
 */
export function isAdmin(r: Role | null): boolean {
  return r === 'ADMIN';
}

/**
 * 만으로 계산한 나이를 반환. 생일이 아직 지나지 않았으면 한 살 빼준다.
 * 파싱 불가/미래 날짜는 음수가 될 수 있으니 호출부에서 가드한다.
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
 * 성인 여부 판정(연령 게이트).
 * - `birthDate`(YYYY-MM-DD, LocalDate)가 (now − 19년) 이전이면 성인.
 * - null/빈 문자열/파싱 불가 → 보수적으로 미성년(false) 취급.
 * - `now` 기본값은 호출 시점의 new Date() → 자정 경계가 지나면 자동 재계산.
 */
export function isAdult(birthDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!birthDate) return false;

  // LocalDate(YYYY-MM-DD)를 로컬 자정 기준으로 파싱(타임존 시프트 방지).
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const birth = new Date(year, month - 1, day);
  // Date 정규화로 잘못된 날짜(예: 2026-02-30) 걸러내기.
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return false;
  }

  // 미래 생년월일은 성인 아님.
  if (birth.getTime() > now.getTime()) return false;

  return ageInYears(birth, now) >= ADULT_MIN_AGE;
}
