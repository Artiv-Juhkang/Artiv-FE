/**
 * 전역 쿼리 에러 → 토스트 배선.
 *
 * queryClient는 컴포넌트 밖(모듈 싱글톤)이라 React의 useToast를 직접 쓸 수 없어,
 * setQueryErrorNotifier라는 주입점만 두고 등록은 이 컴포넌트가 한다.
 * **그 주입점은 오래도록 호출부가 0개였다** — routeGlobalError가 항상 __DEV__
 * console.warn으로 빠져, 자기 onError가 없는 뮤테이션은 실패해도 사용자에게
 * 아무 표시가 없었다(2026-09-05 온톨로지 액션 409에서 발견).
 *
 * ToastProvider **안쪽**에 마운트해야 한다(useToast가 컨텍스트를 요구).
 */
import { useEffect } from 'react';

import { useToast } from '@/ui';

import { setQueryErrorNotifier } from './queryClient';

export function QueryErrorToastBridge() {
  const { show } = useToast();

  useEffect(() => {
    setQueryErrorNotifier((e) => {
      show({ tone: 'danger', message: e.message });
    });
    return () => setQueryErrorNotifier(null);
  }, [show]);

  return null;
}
