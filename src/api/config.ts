/**
 * config — the single source of truth for the backend origin.
 *
 * Every absolute URL the app builds (axios baseURL, image URL resolution,
 * public static /files) derives from {@link BASE_URL}. There is exactly one
 * place that reads `EXPO_PUBLIC_API_URL` — here. Do NOT create a parallel
 * `env.ts` / duplicate origin module; import from `@/api/config` instead.
 *
 * Endpoints are called with the full `/api/...` path on top of BASE_URL
 * (the request interceptor's `isPublicPath` matches `/api/auth`, `/files`,
 * `/api/health`), so the axios instance uses `baseURL = BASE_URL` and each
 * endpoint passes `'/api/...'`.
 *
 * EXPO_PUBLIC_* vars are inlined at build time by Expo and are readable on
 * web, native, and in tests. When unset we fall back to localhost:8080.
 *
 * Real-device caveat: `http://localhost:8080` resolves to the *device*, not
 * your dev machine. On a physical phone either
 *   - set EXPO_PUBLIC_API_URL to your machine's LAN IP, e.g.
 *       EXPO_PUBLIC_API_URL=http://192.168.0.10:8080
 *   - or, on Android over USB, run `adb reverse tcp:8080 tcp:8080` so the
 *     device's localhost:8080 is forwarded to the host.
 */

/** Backend origin (scheme + host + port), no trailing slash, no path. */
export const BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

/** REST API root: `${BASE_URL}/api`. */
export const API_BASE: string = `${BASE_URL}/api`;

/** Public static files root: `${BASE_URL}/files` (served without auth). */
export const FILES_URL: string = `${BASE_URL}/files`;
