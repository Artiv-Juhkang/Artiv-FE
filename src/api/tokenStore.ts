/**
 * 토큰 생애주기 단일 스토어.
 *
 * - accessToken: 메모리 싱글톤(휘발성, 동기 접근). 1시간 만료.
 * - refreshToken: SecureStore(at-rest). 14일 만료, 회전(single-use)이라 항상 최신만 보관.
 *
 * 정본 tokenStore 는 여기뿐. 다른 모듈은 이 함수들만 사용한다.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { TokenResponse } from './types';

/** SecureStore 키 (refresh 전용). */
export const REFRESH_KEY = 'apptoon.refreshToken';

/** 메모리에만 존재하는 access 토큰. 앱 재시작 시 사라진다(부트스트랩에서 refresh 로 복구). */
let accessToken: string | null = null;

/** web 은 expo-secure-store 미지원 → best-effort 가드. */
const secureStoreAvailable = Platform.OS !== 'web';

/** 현재 메모리 access 토큰(동기). */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * access 토큰을 메모리에 set(동기). null 이면 제거.
 * refresh 인터셉터 경로에서 새 access 만 갱신할 때 사용.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * 로그인/회전 결과 토큰 쌍 저장.
 * - access: 메모리(동기, 즉시 사용 가능)
 * - refresh: SecureStore(await) — 최신 refresh 로 덮어쓰기(회전)
 */
export async function setTokens(t: TokenResponse): Promise<void> {
  accessToken = t.accessToken ?? null;
  if (!secureStoreAvailable) return;
  try {
    if (t.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
  } catch {
    // SecureStore 실패는 치명적이지 않게 best-effort(특히 web/시뮬레이터 환경).
  }
}

/** SecureStore 에서 refresh 토큰 읽기. 없거나 web 이면 null. */
export async function getRefreshToken(): Promise<string | null> {
  if (!secureStoreAvailable) return null;
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

/**
 * 모든 토큰 제거(멱등). 로그아웃·refresh 실패 시.
 * 메모리 access 즉시 제거 + SecureStore refresh best-effort 삭제.
 */
export async function clearTokens(): Promise<void> {
  accessToken = null;
  if (!secureStoreAvailable) return;
  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // 이미 없거나 미지원 → 무시(멱등).
  }
}
