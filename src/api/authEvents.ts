/**
 * api 레이어가 React/expo-router 없이 'logout' 신호를 보내는 최소 에미터.
 *
 * client.ts 의 refresh 인터셉터가 refresh 실패 시 logout 을 emit 하면
 * AuthContext 가 구독해 세션을 정리한다 — client.ts ↔ AuthContext 순환 import 차단용.
 */

type AuthEvent = 'logout';
type Listener = () => void;

const listeners: Record<AuthEvent, Set<Listener>> = {
  logout: new Set(),
};

export const authEvents = {
  /** 이벤트 구독. 반환된 함수로 해제. */
  on(event: AuthEvent, cb: Listener): () => void {
    listeners[event].add(cb);
    return () => {
      listeners[event].delete(cb);
    };
  },
  /** 이벤트 발행. 구독자 콜백을 동기 호출. */
  emit(event: AuthEvent): void {
    for (const cb of listeners[event]) {
      cb();
    }
  },
};
