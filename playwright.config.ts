/**
 * Playwright 설정 — 웹 스모크 하니스(e2e/) 전용.
 *
 * webServer를 쓰지 않는다: 백엔드(:8080)·Expo(:8081)·Postgres를 이 설정이 띄우기 시작하면
 * 실패 원인이 앱인지 기동 순서인지 구분이 안 된다. 이미 떠 있는 로컬 스택에 붙는 쪽이
 * 진단이 쉽고, 전제는 e2e/README.md에 적어 둔다.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 스모크는 순서대로 한 줄기로 도는 게 실패 지점을 읽기 쉽다(공유 시드 데이터도 안전).
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.ARTIV_WEB_URL ?? 'http://localhost:8081',
    // 첫 페인트까지 폰트·번들 로딩이 있어 기본값보다 넉넉히 준다.
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
