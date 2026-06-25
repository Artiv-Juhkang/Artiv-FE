/**
 * 단일 axios 인스턴스 + 인터셉터.
 *
 * request:  Bearer 자동 첨부(공개경로 skip)
 * response: 단일비행(single-flight) refresh 큐 + _retried 태깅 + 실패 시 logout emit + AppError 정규화
 *
 * 정본 axios 는 'api' 하나뿐. React/expo-router import 금지(순환 차단 — authEvents 사용).
 */
import axios, {
  AxiosError,
  isAxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { BASE_URL } from './config';
import { authEvents } from './authEvents';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setTokens,
} from './tokenStore';
import type { TokenResponse } from './types';
import { normalizeError } from '@/lib/errors/normalizeError';

/** 인증 없이 접근 가능한 경로 prefix(요청 시 Bearer 미첨부 + refresh 대상 제외). */
export const PUBLIC_PREFIXES = ['/api/auth', '/files', '/api/health'] as const;

/** url 이 공개 경로 prefix 로 시작하면 true. baseURL 풀패스/상대경로 모두 허용. */
export function isPublicPath(url?: string): boolean {
  if (!url) return false;
  // 절대 URL 이면 path 만 추출, 상대면 그대로 — BASE_URL prefix 도 안전하게 처리.
  let path = url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      path = new URL(url).pathname;
    } catch {
      path = url;
    }
  } else if (url.startsWith(BASE_URL)) {
    path = url.slice(BASE_URL.length);
  }
  return PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** 401 재시도 1회 태깅을 위해 axios config 를 확장. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

/* -------------------------------------------------------------------------- */
/*  Request 인터셉터: Bearer 첨부                                                */
/* -------------------------------------------------------------------------- */
api.interceptors.request.use((config) => {
  // 공개 경로엔 Authorization 미첨부(/files, /api/auth, /api/health).
  if (isPublicPath(config.url)) return config;
  const token = getAccessToken();
  if (token) {
    // axios v1 AxiosHeaders — set 사용.
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/* -------------------------------------------------------------------------- */
/*  단일비행 refresh                                                            */
/* -------------------------------------------------------------------------- */

/** 모듈 레벨 단 하나의 refresh 약속. 동시 401 다발이 하나의 refresh 만 트리거. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * refresh 토큰으로 새 토큰 쌍 발급.
 * bare axios.post 로 인터셉터를 우회(자기 인터셉터 재귀 + Bearer 첨부 방지).
 * 성공 → 새 access 반환 + setTokens 로 회전 refresh 저장.
 * 실패 → clearTokens + logout emit, null 반환.
 */
async function runRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearTokens();
    authEvents.emit('logout');
    return null;
  }
  try {
    const { data } = await axios.post<TokenResponse>(
      `${BASE_URL}/api/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
    await setTokens(data);
    return data.accessToken ?? null;
  } catch {
    // refresh 401(회전 재사용/만료) 또는 네트워크 → 세션 종료.
    await clearTokens();
    authEvents.emit('logout');
    return null;
  }
}

/** 진행 중 refresh 가 있으면 공유, 없으면 시작. 끝나면 슬롯 해제. */
function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/* -------------------------------------------------------------------------- */
/*  Response 인터셉터: 단일비행 refresh + AppError 정규화                          */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) {
      return Promise.reject(normalizeError(error));
    }

    const axErr = error as AxiosError<{ code?: string }>;
    const config = axErr.config as RetriableConfig | undefined;
    const status = axErr.response?.status;
    const code = axErr.response?.data?.code;

    const shouldRefresh =
      status === 401 &&
      (code === 'UNAUTHORIZED' || code === 'INVALID_TOKEN') &&
      !!config &&
      !config._retried &&
      !isPublicPath(config.url);

    if (shouldRefresh && config) {
      config._retried = true;
      const newToken = await refreshOnce();
      if (newToken) {
        setAccessToken(newToken);
        config.headers.set('Authorization', `Bearer ${newToken}`);
        // 원 요청 재시도(이번엔 _retried=true 라 또 401 이면 더 refresh 안 함).
        try {
          return await api.request(config);
        } catch (retryErr) {
          return Promise.reject(normalizeError(retryErr));
        }
      }
      // refresh 실패: 이미 runRefresh 에서 clearTokens + logout emit 됨.
    }

    return Promise.reject(normalizeError(error));
  },
);
