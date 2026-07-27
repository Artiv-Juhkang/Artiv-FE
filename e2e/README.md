# e2e — 웹 스모크 하니스

앱의 핵심 동선이 살아 있는지 한 번에 확인하는 최소 회귀 그물. 화면 단위 상세 검증이 아니라
**"로그인해서 5탭을 돌고 작품을 열어 회차를 읽고 채팅함까지 도달한다"**는 뼈대만 지킨다.

## 전제

로컬 스택이 떠 있어야 한다(하니스는 서버를 띄우지 않는다 — 이미 떠 있는 스택에 붙는다).

```bash
# 1) 도커(Postgres·MinIO)
docker start artiv-db artiv-minio

# 2) 백엔드 :8080 (dev 프로파일)
cd backend && ./gradlew bootRun

# 3) 시드 — 커뮤니티·채팅 포함(한 번만)
cd backend && python3 scripts/seed-demo.py

# 4) Expo 웹 :8081
cd frontend && npm run web
```

## 실행

```bash
cd frontend
npx playwright install chromium   # 최초 1회
npm run test:e2e                  # 헤드리스
npm run test:e2e -- --headed      # 브라우저 보면서
npm run test:e2e -- --debug       # 스텝 디버깅
```

계정은 시드 독자(`seed-reader@artiv.test` / `seedpass123`)를 쓴다. 전체 계정 목록은
`docs/local-accounts.md` 참조.

## 이 하니스에 코드를 얹을 때 지켜야 할 것

세션 중에 반복해서 깨졌던 함정들이라 규칙으로 굳혀 둔다.

- **로그인 후 `page.goto()` 금지.** 웹 빌드는 access 토큰을 메모리에만 들고 있어서 전체 내비게이션이
  일어나면 그대로 로그아웃된다. 화면 이동은 반드시 앱 안의 링크·탭 클릭으로 한다.
- **텍스트 선택자에 `.filter({ visible: true })`를 붙인다.** RN Web은 화면 밖 스크린을 DOM에
  남겨두기 때문에 같은 문구가 여러 번 잡힌다.
- **롱프레스는 `click({ delay: 900 })`.** RN Web의 롱프레스 임계값(≈500ms)을 넘겨야 한다.
- **토스트는 약 2초 만에 사라진다.** 단언하려면 액션 직후에 확인한다.
- **화면 이동은 `tapNav()`로 한다.** 앱에 더블탭 방지용 500ms 공유 내비게이션 스로틀이 있어
  (`useGuardedNavigation`) 사람보다 빠른 연속 클릭은 두 번째가 조용히 버려진다. 그냥 `click()`을
  연달아 쓰면 "화면이 안 넘어간다"로 나타나는데 앱은 정상이다.
- **웹 좌측 레일에는 목적지가 4개뿐이다**(창작물·커뮤니티·채팅·서재). '내 정보'는 계정 메뉴
  안에만 있어 네이티브의 5탭과 다르다 — 웹 셸의 현재 한계(F21)이지 버그가 아니다.

## 네이티브(iOS 시뮬레이터)는 이 하니스 밖

시뮬레이터 검증은 수동이다. 딥링크는 `xcrun simctl openurl`이 아니라 앱을 띄운 뒤
(`xcrun simctl launch booted com.kangjuhyun.artiv`) 앱 안에서 이동해 확인한다 —
`openurl`은 dev client 연결을 끊어 검증 자체를 무효화한 전례가 있다.
