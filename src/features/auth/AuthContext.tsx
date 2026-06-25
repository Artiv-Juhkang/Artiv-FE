import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { authEvents } from '@/api/authEvents';
import {
  getRefreshToken,
  setTokens,
  clearTokens,
} from '@/api/tokenStore';
import { loginRequest, signupRequest, fetchMe } from '@/api/endpoints/auth';
import type {
  MyProfileResponse,
  SignupRequest,
  LoginRequest,
  Role,
} from '@/api/types';
import { isAdult as computeIsAdult } from './roles';

/**
 * 인증 상태 머신.
 * - loading: 부트스트랩 진행 중(스플래시 유지 신호).
 * - authenticated: 토큰·프로필 확보.
 * - unauthenticated: 토큰 없음 or refresh 실패.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthState = {
  status: AuthStatus;
  user: MyProfileResponse | null;
  role: Role | null;
  isAdult: boolean;
  login(email: string, pw: string): Promise<void>;
  signup(p: SignupRequest): Promise<void>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * MyProfileResponse에서 role을 안전하게 추출. (코드젠 타입이 좁혀지기 전에도 동작)
 */
function roleOf(user: MyProfileResponse | null): Role | null {
  if (!user) return null;
  const r = (user as { role?: unknown }).role;
  return typeof r === 'string' ? (r as Role) : null;
}

/**
 * MyProfileResponse에서 birthDate를 안전하게 추출.
 * 자기조회(MyProfile)는 birthDate를 포함한다(features.md §3.1).
 */
function birthDateOf(user: MyProfileResponse | null): string | null {
  if (!user) return null;
  const b = (user as { birthDate?: unknown }).birthDate;
  return typeof b === 'string' ? b : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MyProfileResponse | null>(null);

  // StrictMode/리렌더에서 부트스트랩 1회 보장.
  const bootstrappedRef = useRef(false);

  const applyAuthenticated = useCallback((profile: MyProfileResponse) => {
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const applyUnauthenticated = useCallback(() => {
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  /**
   * 현재 토큰으로 내 프로필 재조회. 실패는 호출부/인터셉터가 처리.
   */
  const refreshUser = useCallback(async () => {
    const profile = await fetchMe();
    applyAuthenticated(profile);
  }, [applyAuthenticated]);

  /**
   * 부트스트랩: refresh 토큰이 있으면 fetchMe 시도.
   * - access가 없거나 만료여도, 콜드스타트 첫 401은 client 인터셉터가
   *   refreshPromise로 회전 후 재시도한다.
   * - refresh 토큰이 아예 없으면 즉시 unauthenticated.
   */
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;

    (async () => {
      let refresh: string | null = null;
      try {
        refresh = await getRefreshToken();
      } catch {
        refresh = null;
      }

      if (!refresh) {
        if (!cancelled) applyUnauthenticated();
        return;
      }

      try {
        const profile = await fetchMe();
        if (!cancelled) applyAuthenticated(profile);
      } catch {
        // refresh 만료/재사용 등 → 비로그인. (인터셉터가 이미 토큰 정리/emit 수행)
        if (!cancelled) applyUnauthenticated();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAuthenticated, applyUnauthenticated]);

  /**
   * api 레이어(client 인터셉터)에서 보낸 logout 신호 구독.
   * refresh 최종 실패 등으로 세션이 끊겼을 때 React 상태/캐시를 정리한다.
   * client.ts ↔ AuthContext 순환을 막기 위해 authEvents 에미터를 거친다.
   */
  useEffect(() => {
    const off = authEvents.on('logout', () => {
      applyUnauthenticated();
      queryClient.clear();
    });
    return off;
  }, [applyUnauthenticated, queryClient]);

  const login = useCallback(
    async (email: string, pw: string) => {
      const body: LoginRequest = { email, password: pw } as LoginRequest;
      const tokens = await loginRequest(body);
      await setTokens(tokens);
      // 새 세션의 캐시 오염 방지.
      queryClient.clear();
      const profile = await fetchMe();
      applyAuthenticated(profile);
    },
    [applyAuthenticated, queryClient],
  );

  const signup = useCallback(
    async (p: SignupRequest) => {
      // 가입은 201 {id}만 반환 — 토큰 미발급. 가입 후 동일 자격으로 로그인한다.
      await signupRequest(p);
      const tokens = await loginRequest({
        email: p.email,
        password: p.password,
      } as LoginRequest);
      await setTokens(tokens);
      queryClient.clear();
      const profile = await fetchMe();
      applyAuthenticated(profile);
    },
    [applyAuthenticated, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await clearTokens();
    } finally {
      applyUnauthenticated();
      queryClient.clear();
    }
  }, [applyUnauthenticated, queryClient]);

  const role = roleOf(user);
  const isAdult = computeIsAdult(birthDateOf(user));

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      role,
      isAdult,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [status, user, role, isAdult, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 인증 상태 소비 훅. AuthProvider 하위에서만 호출.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
