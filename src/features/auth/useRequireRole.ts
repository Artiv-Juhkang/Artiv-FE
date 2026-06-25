import { useAuth } from './AuthContext';
import { isCreator, isAdmin } from './roles';

/**
 * 크리에이터/관리자 전용 화면 가드 훅.
 * - status가 'loading'이면 loading=true (아직 판정 불가).
 * - allowed는 요구 역할을 정확히 만족할 때만 true. 권한은 단일 enum(누적 아님)이라
 *   CREATOR 요구 시 ADMIN은 통과하지 못한다(서버도 본인 작가 재검사).
 * 리다이렉트는 소비 화면에서 <Redirect>로 처리한다(render 중 router.replace 금지).
 */
export function useRequireRole(required: 'CREATOR' | 'ADMIN'): {
  allowed: boolean;
  loading: boolean;
} {
  const { status, role } = useAuth();
  const loading = status === 'loading';

  const allowed =
    !loading &&
    status === 'authenticated' &&
    (required === 'CREATOR' ? isCreator(role) : isAdmin(role));

  return { allowed, loading };
}

/**
 * 현재 사용자가 성인(만 19세 이상)인지. 19금 콘텐츠 게이트 분기에 사용.
 * 미인증/생년월일 없음 → false(보수적 미성년 취급).
 */
export function useIsAdult(): boolean {
  const { isAdult } = useAuth();
  return isAdult;
}
