/**
 * 이미지 URL 해석: 앱 루트 상대경로(/files/...) → 절대 URL.
 *
 * 백엔드의 image.url 은 '/files/1/3/0.png' 같은 앱 루트 상대경로다.
 * 렌더 시 `${BASE_URL}${url}` 로 절대화한다. /files/** 는 공개라 Authorization 미부착.
 */
import { BASE_URL } from './config';

/**
 * @param url 서버가 준 상대/절대 url 또는 빈값.
 * @returns 절대 URL. 빈값/undefined 면 undefined(`${BASE_URL}undefined` 방지).
 */
export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.length === 0) return undefined;
  // 이미 절대 URL 이면 그대로.
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // 앱 루트 상대경로(/files/...) → BASE_URL 붙임. 선행 슬래시 보정.
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${BASE_URL}${path}`;
}
