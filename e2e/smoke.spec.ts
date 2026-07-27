/**
 * 스모크 — 앱의 뼈대 동선이 살아 있는지 한 줄기로 확인한다.
 *   로그인 → 창작물(홈) → 작품 상세 → 회차 뷰어 → 서재 → 커뮤니티 → 채팅 → 내 정보
 *
 * 화면별 상세 검증은 여기 넣지 않는다. 이 파일이 하는 일은 "리팩터가 동선을 끊었는지"를
 * 몇 초 안에 알려주는 것뿐이다. 전제·함정은 e2e/README.md 참조.
 */
import { expect, test, type Page } from '@playwright/test';

const READER = { email: 'seed-reader@artiv.test', password: 'seedpass123' };

/** 화면 밖 스크린이 DOM에 남으므로 보이는 것만 고른다(RN Web). */
function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text, { exact: typeof text === 'string' }).filter({ visible: true }).first();
}

/**
 * 화면 이동 탭. 앱에는 더블탭 방지용 500ms 공유 내비게이션 스로틀이 있어(useGuardedNavigation)
 * 사람보다 빠른 연속 클릭은 두 번째가 그냥 버려진다 — 창을 비우고 눌러야 실제로 이동한다.
 * 이동이 일어났는지는 URL 변화로 확인한다(스크린 전환 애니메이션을 기다리지 않아도 확정적).
 */
async function tapNav(page: Page, locator: ReturnType<typeof visibleText>) {
  const before = page.url();
  await page.waitForTimeout(550);
  await locator.click();
  await page.waitForFunction((prev) => window.location.href !== prev, before, { timeout: 15_000 });
}

/** 로그인 후에는 page.goto()를 쓰지 않는다 — 웹은 access 토큰이 메모리에만 있어 로그아웃된다. */
async function signIn(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(READER.email);
  await inputs.nth(1).fill(READER.password);
  await page.getByText('로그인', { exact: true }).last().click();
  // 로그인 성공의 신호는 탭 셸(좌측 레일)의 등장이다.
  await expect(visibleText(page, '창작물')).toBeVisible();
}

test.describe('스모크', () => {
  test('로그인하고 웹 셸 목적지·작품·뷰어를 돌 수 있다', async ({ page }) => {
    await signIn(page);

    // 창작물 — 매체 칩과 작품 카드가 뜬다.
    await expect(visibleText(page, '웹툰')).toBeVisible();

    // 작품 상세 — 감상 CTA가 최상단 액션이어야 한다(후원보다 위: UX3).
    await tapNav(page, visibleText(page, '별빛 너머의 항해'));
    const readCta = page.getByText(/첫화 보기|이어보기/).filter({ visible: true }).first();
    await expect(readCta).toBeVisible();

    // 회차 뷰어 — 진입 후 되돌아온다. 이전 화면의 커버가 DOM에 숨은 채 남으므로
    // 여기서도 보이는 것만 골라야 한다(첫 img를 그냥 잡으면 숨은 커버가 걸린다).
    await tapNav(page, readCta);
    await expect(page.locator('img').filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.goBack();

    // 웹 셸의 나머지 목적지가 전부 열린다. 레일에는 4개뿐이고 '내 정보'는 계정 메뉴 안에만
    // 있다 — 네이티브의 5탭과 다른, 웹 셸의 현재 한계다(F21에서 협폭 폴백과 함께 다룬다).
    for (const tab of ['서재', '커뮤니티', '채팅'] as const) {
      await tapNav(page, visibleText(page, tab));
      await expect(visibleText(page, tab)).toBeVisible();
    }
  });

  test('커뮤니티 피드에 시드 글이 보인다', async ({ page }) => {
    await signIn(page);
    await tapNav(page, visibleText(page, '커뮤니티'));
    // 시드가 넣은 글 제목 중 하나 — 피드 렌더 + 백엔드 연결을 한 번에 확인한다.
    await expect(visibleText(page, '다들 어떤 매체로 보세요?')).toBeVisible();
  });

  test('채팅함에 대화가 보인다', async ({ page }) => {
    await signIn(page);
    await tapNav(page, visibleText(page, '채팅'));
    await expect(visibleText(page, '대화')).toBeVisible();
  });
});
