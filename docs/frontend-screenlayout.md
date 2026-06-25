# Frontend ScreenLayout / Header 프레임워크 (FINAL)

> 본 문서는 5개 스펙 + Expo SDK 56 검증 패턴 + 비평(critic)을 병합한 **확정 설계(SSOT)** 다.
> 모든 비평 항목(단일 헤더 API · body 오프셋 정합성 · 관심 매핑 · 파일 소유권)을 해소한다.
> 구현은 이 문서의 계약(contract)만 따른다. 스펙 간 충돌 시 본 문서가 우선한다.

---

## 1. 개요 — ScreenLayout = 모든 화면의 틀

`Screen`(= `src/ui/primitives/Screen.tsx`)은 이미 자기 docblock에서 **"the app's ScreenLayout primitive"** 로 선언된, 앱의 **유일한 프레임 프리미티브**다. 안전영역(insets) · StatusBar · 키보드 회피(KAV) · scroll/fixed body · 반응형 maxWidth column · 전면 `background` 레이어 · 하단 pinned `footer`를 한 곳에서 소유한다.

**결정:** 별도의 `ScreenLayout` 컴포넌트를 신설하지 **않는다.** 대신 `Screen`에 **`header?: HeaderConfig` 프롭을 1개 추가(additive)** 한다. 기존 동작(surface/scroll/center/footer/background/maxWidth/StatusBar)은 **한 줄도 변경하지 않는다.** 헤더는 순수 추가다.

> `export { Screen as ScreenLayout }` 별칭은 도입하지 않는다(이름 1개 = 개념 1개). 팀이 원하면 배럴에 1줄 추가하면 되는 zero-cost 결정으로 남긴다.

헤더 컴포넌트는 `src/ui/primitives/ScreenHeader.tsx`에 **단 한 번** 생성한다(파일명 = `ScreenHeader.tsx`, API = config-object). 리프 버튼(back/icon/title)은 `src/ui/primitives/header-actions.tsx`에 **단 한 번** 생성하고, `ScreenHeader`는 이를 **import해 조립만** 한다.

---

## 2. Header API (단일 · 확정)

비평이 지적한 두 계열(config-object vs raw-ReactNode)을 **config-object로 통일**한다. 이유: `Screen`이 "헤더가 존재한다"는 사실을 알아야 body의 top inset 소유권을 옮길 수 있고, root/pushed back 규약 · 안전영역 · 스크림 · a11y를 **한 곳에서** 강제할 수 있기 때문이다. raw ReactNode는 드문 커스텀 케이스를 위한 **escape hatch**로만 허용한다.

```ts
// src/ui/primitives/ScreenHeader.tsx
export type HeaderVariant = 'solid' | 'transparent' | 'large' | 'hidden';
export type HeaderTitleAlign = 'left' | 'center';

export type HeaderConfig = {
  /** 제목. string 또는 ReactNode(예: 로고/검색필드). */
  title?: string | ReactNode;
  /** ‹ 뒤로가기 노출. DEFAULT true(pushed). root는 false를 명시한다. */
  back?: boolean;
  /** guardedBack를 대체하는 back 액션 override(딥링크 첫 진입 등). */
  onBack?: () => void;
  /** 좌측 영역 커스텀. 주어지면 `back`보다 우선한다. */
  left?: ReactNode;
  /** 우측 액션 영역. HeaderIconButton 들을 row로 조립한다(배열/노드 허용). */
  right?: ReactNode;
  /** @default 'solid' */
  variant?: HeaderVariant;
  /** @default 'center'(solid/transparent), 'left'(large) */
  titleAlign?: HeaderTitleAlign;
};
```

`Screen`의 프롭:

```ts
header?: HeaderConfig | ReactNode;   // config면 <ScreenHeader/>로 렌더, ReactNode면 그대로(escape hatch)
```

**프롭 의미 요약**

| 프롭 | 역할 | 기본값 |
|---|---|---|
| `title` | 제목(string/Node). large는 큰 표시 타이틀. | — |
| `back` | ‹ 뒤로가기 노출 여부. **caller가 명시(root=false)**. | `true` |
| `onBack` | back onPress override(딥링크 첫진입 fallback 등). | `guardedBack` |
| `left` | 좌측 커스텀 노드. 있으면 `back` 무시. | — |
| `right` | 우측 액션 row. | — |
| `variant` | 헤더 변형. | `'solid'` |
| `titleAlign` | 타이틀 정렬. | variant별 |

---

## 3. 헤더 변형 (solid / transparent-over-hero / large / hidden)

| variant | 레이아웃 | 배경 | 용도 |
|---|---|---|---|
| **solid** | **in-flow**(body를 아래로 밀어냄) | `surface` bg + 하단 hairline border | 탭 루트(홈/내정보), 일반 pushed 화면 |
| **transparent** | **absolute float**(art가 헤더 밑으로 bleed) | 없음. 상단 scrim + 액션마다 glass chip | 상세(커버 히어로 위에 떠 있음) |
| **large** | in-flow, 2행(compact row + 큰 title row) | solid와 동일 | large-title 루트(옵션) |
| **hidden** | `null` 렌더(헤더 없음) | — | 몰입형 뷰어(미래 실서비스) |

- **transparent 가독성:** 각 액션/back은 44pt 원형 **glass chip**(`glassBg` + `glassBorder` hairline) 위에 그려지고, 헤더 row 뒤에 상단→투명 **scrim** 밴드를 깔아 밝은 커버 위에서도 흰 글리프가 읽힌다. 글리프 tint는 transparent에서 흰색 고정(`#FFFFFF`).
- **애니메이션 없음:** scrim/chip은 정적. 헤더는 shared-value를 render에서 읽지 않는다 → reduced-motion 자동 안전.

---

## 4. headerLeft 뒤로가기(guardedBack) & headerRight 액션

### 4.1 뒤로가기 — 단일 구현

- back onPress = **`onBack ?? guardedBack`**.
- `guardedBack`(`src/lib/navigation/useGuardedNavigation.ts`)은 **이미** `if (router.canGoBack()) router.back()` 가드 + 모듈 레벨 500ms 더블탭 게이트를 포함한다. **재구현 금지.**
- **레이어 규칙 해소:** `header-actions.tsx`/`ScreenHeader.tsx`는 `guardedBack`을 **직접 경로 import**(`@/lib/navigation/useGuardedNavigation`)한다. `guardedBack`은 expo-router의 **문서화된 간접화 계층**이지 raw router가 아니다. `@/ui` 배럴은 `guardedBack`을 **재export하지 않는다**(ui-has-no-router 규칙 유지). `useGuardedNavigation`이 배럴에서 제외된 것과 동일한 경계.
- a11y: `accessibilityLabel="뒤로 가기"`, `accessibilityRole="button"`, 44pt(`layout.minHitTarget`) 히트 타깃.
- SymbolView `chevron.left` + Text `‹` fallback(iOS 외 graceful degrade).

### 4.2 우측 액션 — 단일 리프

모든 액션은 `header-actions.tsx`의 **`HeaderIconButton`** 1개로 만든다(SymbolView + Text fallback, 44pt, `accessibilityRole=button` + label, `useAsyncPress` 더블탭 안전, `tone`별 tint, `active` 상태). 그 위에 thin wrapper로 ready-made 액션을 제공한다:

| 액션 | 아이콘(SF) | fallback | a11y label |
|---|---|---|---|
| `SearchAction` | `magnifyingglass` | `검색` | 검색 |
| `NotificationAction` | `bell` | `알림` | 알림 / `알림 N개` |
| `MoreAction` | `ellipsis` | `···` | 더보기 |
| `BookmarkAction`(관심) | `heart`/`heart.fill` | `♡`/`♥` | 관심 등록/관심 해제 |
| 공유 | `square.and.arrow.up` | `공유` | 공유 |

- `NotificationAction`의 `unreadCount`는 **optional placeholder**(현재 unread-count 훅 없음). ui는 features/api에 의존 불가하므로 parent가 미래 훅을 한 줄로 주입한다.
- `BookmarkAction`은 **controlled**(`active` + `onToggle`). 내부 state 없음 — optimistic 캐시(toggle 훅)가 SSOT.

---

## 5. 안전영역 통합 (노치 아래 헤더 · body 오프셋 · double-inset 방지)

> Expo SDK 56 검증 규칙: **"정확히 한 요소가 각 edge를 소유한다."** top inset 소유권은 **헤더**가 가진다.

### 5.1 단일 body-offset 규칙 (확정)

```ts
// Screen 내부
const hasHeader   = header != null && !(isConfig(header) && header.variant === 'hidden');
const isFloating  = hasHeader && isConfig(header) && header.variant === 'transparent';
const hasFlowHeader = hasHeader && !isFloating;   // solid / large

// 기존: const topPad = wantTop ? insets.top : 0;
const topPad = wantTop && !hasFlowHeader ? insets.top : 0;
```

| 케이스 | 헤더 위치 | 헤더 paddingTop | body topPad |
|---|---|---|---|
| 헤더 없음 | — | — | `wantTop ? insets.top : 0` (**기존 그대로**) |
| **solid / large** (flow) | body 위 sibling | `insets.top` (헤더가 소유) | **0** |
| **transparent** (float) | absolute overlay | `insets.top` (헤더가 소유) | **`insets.top` 유지** |
| **hidden** | 렌더 안 함 | — | `wantTop ? insets.top : 0` |

### 5.2 왜 transparent는 body topPad을 유지하나 (비평 핵심 해소)

스펙 3/4/5의 "헤더 있으면 무조건 body topPad=0 + 히어로가 inset 재예약"은 **모든 히어로 화면이 inset 배선을 다시 떠안게** 만든다 — 프레임워크가 없애려는 per-screen 배선이 되살아나고 double/zero-inset 버그가 쉽다. 채택안(스펙 1):

- transparent 헤더는 **absolute float** → 세로 레이아웃 공간을 차지하지 않음.
- 커버아트(`SeriesHero`의 `CoverWall`)는 **`Screen`의 `background` absoluteFill 레이어로 렌더** → body padding과 무관하게 화면 최상단(노치 밑)부터 bleed.
- body는 `topPad = insets.top`을 **유지** → 패널 텍스트가 노치 아래에 안전하게 위치.
- 결과: art는 bleed, 텍스트는 노치 회피, inset 소유권은 헤더 1곳. per-screen 배선 0.

> double-inset 버그 = SafeAreaView(edges top) **그리고** insets.top을 동시에 적용하는 것. 본 프레임워크는 **헤더만** insets.top을 적용하고 body는 flow-header일 때만 0으로 양보한다.

### 5.3 헤더 내부 폭 (태블릿)

- 배경 밴드(bg/border 또는 scrim) = **full-width**(`insets.left/right` + gutter).
- 내부 컨텐츠 row(title/actions) = **`Screen`의 `columnStyle`(maxWidth + alignSelf:center) 재사용** → 본문 컬럼과 정렬.
- 즉 "full-width 밴드 + capped 내부 row"가 단일 규칙(스펙 1 채택, 스펙 4의 full-bleed는 폐기).

---

## 6. root-vs-pushed 규약

| 분류 | 화면 | back | 헤더 |
|---|---|---|---|
| **ROOT** | 탭 루트(홈, 내정보), auth 루트(sign-in) | `back:false` | 탭 루트=solid(title+actions). sign-in=**헤더 없음**(브랜드는 폼 중앙, 아우로라와 경쟁 회피) |
| **PUSHED** | 상세, 뷰어 스텁, 미래 sub-화면 | `back:true`(기본) | variant별(상세=transparent, 뷰어 스텁=solid) |
| **+not-found** | 딥링크 첫진입 가능 | `back:true` + **`onBack=goHome`** | solid. canGoBack=false여도 항상 탈출 가능 |

- **자동감지 안 함:** expo-router는 render 시점에 "내가 pushed인가"를 신뢰성 있게 주지 않는다(`canGoBack`은 스택 깊이지 push 여부가 아님). 그래서 **caller가 `back`을 명시**한다.
- **제스처 정합성:** `chromeStackScreenOptions`가 스택 전체에 `gestureEnabled:!reduced`를 설정 → 모든 pushed 화면이 스와이프-백 가능. 커스텀 헤더는 native iOS interactive-pop을 **깨지 않는다**(pop은 native card 속성, gestureEnabled가 지배). 헤더 ‹ 와 스와이프는 둘 다 `router.back` → 동일 동작. full-bleed 히어로가 좌측 엣지 제스처를 가로채면 `fullScreenGestureEnabled:true`로 대응(필요 시).

---

## 7. 화면별 적용

| 화면 | 파일 | 헤더 config |
|---|---|---|
| **홈** | `(app)/(tabs)/index.tsx` | `{ variant:'solid', back:false, title:'AppToon', right:[SearchAction, NotificationAction] }`. WeekdayTabs 밴드는 헤더 **아래** 컨텐츠(스티키 sub-header)로 그대로. FlatList 미변경. |
| **내정보** | `(app)/(tabs)/my.tsx` | `{ variant:'solid', back:false, title:'내 정보' }`. body 미변경. |
| **상세** | `(app)/series/[id].tsx` | `{ variant:'transparent', back:true, right:[관심(heart, useSubscribeToggle), 공유, 더보기] }`. 헤더는 `isSubscribed`를 아는 `DetailContent` 안에서 구성. 로딩/에러 분기는 back-only transparent 헤더. |
| **뷰어 스텁** | `(app)/series/[id]/[episodeNo].tsx` | `{ variant:'solid', back:true, title:'N화' }`. 실서비스 몰입형 뷰어는 미래에 `hidden` + modal로 전환(주석 seam). |
| **낫파운드** | `+not-found.tsx` | `{ variant:'solid', back:true, onBack:goHome, title:'페이지를 찾을 수 없어요' }`. 기존 `Stack.Screen headerShown:false` 유지. |
| **로그인** | `(auth)/sign-in.tsx` | **헤더 없음**(규약상 의도). 코드 변경은 주석 1줄(문서화)뿐. |

---

## 8. 관심(interest) 매핑 결정 (확정)

**검증된 API 사실:** `SeriesDetailResponse`에 cover/조회수/좋아요/구독자수 필드 **없음**. series-level personalization 엔드포인트는 **`/api/series/{id}/subscription` 단 하나**. bookmark는 **per-EPISODE 전용**(`/api/series/{id}/episodes/{no}/bookmark`, seriesId+episodeNo 둘 다 필요). **series-level 관심/save 엔드포인트는 존재하지 않는다.**

**결정 (스펙 3 채택):**
1. **헤더 관심(heart) = 실제 구독 토글**(`useSubscribeToggle`, optimistic). `isSubscribed`면 `heart.fill`. 관심 = "이 작품 팔로우" = 구독, 유일한 실 series-level 의도. 헤더 heart와 본문 구독 버튼은 **같은 캐시**(`keys.series.detail(id)`)를 읽어 동기화.
2. **`SeriesActionBar`의 중복 "관심" 버튼 제거.** 같은 단어 "관심"을 가진 두 컨트롤이 서로 다른 동작(헤더=구독, 본문=준비중 토스트)을 하면 더 나쁘다. 본문 row는 **구독(real) + 정기후원(seam) + 공유(local)** 만 유지.
3. **조작된 stats(조회/좋아요) 렌더 금지.** 백킹 데이터 없음 → 실제 필드(`status`/`episodeCount`/`latestEpisodeNo`)만. 기존 `StatsRow` 유지.

> **문서 의미 변경 주의:** 기존 `SeriesActionBar` docblock은 "구독과 관심은 구별되는 의도(구독=feed, 관심=manual save)"라 명시했다. 본 결정은 이를 **갱신**한다(관심 = 구독). 제품 의미 변경이므로 `SeriesActionBar.tsx`의 docblock도 함께 수정한다.
> `header-actions.tsx`의 `BookmarkAction`은 "특정 series-bookmark"가 아니라 **"controlled — 화면이 실제 토글(여기선 구독)에 바인딩하는 컨트롤"** 로 문서화한다.

---

## 9. 라이트/다크 & 접근성 & 더블탭

- **라이트/다크:** 모든 색은 `useTheme()` 역할(`surface`/`onSurface`/`border`/`glassBg`/`glassBorder`/`scrim`/`accent`/`danger`). transparent 헤더의 글리프만 art 위 가독성 위해 흰색 고정.
- **접근성:** back label `"뒤로 가기"`, 모든 액션 `accessibilityRole="button"` + 한글 label, 44pt 히트 타깃(`layout.minHitTarget`), `BookmarkAction`은 `accessibilityState={{selected:active}}`. 타이틀은 Text 프리미티브의 per-role `maxFontSizeMultiplier` clamp 상속(Dynamic Type 안전, 단일 라인 유지). 밴드는 `minHeight`(고정 height 아님)로 큰 폰트에서 확장.
- **더블탭:** back = `guardedBack`(모듈 500ms 게이트 + canGoBack). 액션 = `useAsyncPress`(버튼 단위 동기 락). reduced-motion에서 `useAsyncPress` 쿨다운은 0으로 collapse.
- **status bar:** transparent 헤더는 보통 `surface='glass'`(이미 light glyphs)와 짝. 별도 로직 불필요, caller가 `statusBarStyle`로 override 가능.

---

## 10. 파일 소유권 (확정 · 단일 소유자)

| 파일 | action | 소유자(스펙) | 비고 |
|---|---|---|---|
| `src/ui/primitives/header-actions.tsx` | create | 스펙 2 | **리프 버튼 단일 홈**. 다른 파일은 import만. |
| `src/ui/primitives/ScreenHeader.tsx` | create | 스펙 1(API) + 스펙 4(이름) | **헤더 프레임 단일 생성**. config-object API + 내부 guardedBack. leaf를 import해 조립. |
| `src/ui/primitives/Screen.tsx` | modify | 스펙 1 | `header` 프롭 1개 추가 + body-offset 규칙. 나머지 미변경. |
| `src/ui/index.ts` | modify | 스펙 1 | 헤더 export 블록 **1개만** 추가(중복 금지). |
| `src/app/(app)/series/[id].tsx` | modify | 스펙 3 | 상세 리팩터(transparent 헤더 + 관심=구독). 스펙 1은 prose 예시로만. |
| `src/features/series/components/SeriesHero.tsx` | modify | 스펙 3 | 풀블리드 히어로(`Screen` background로). |
| `src/features/series/components/SeriesActionBar.tsx` | modify | 스펙 3 | 중복 관심 제거 + docblock 갱신. |
| `(app)/(tabs)/index.tsx` | modify | 스펙 4 | 홈 헤더 config. |
| `(app)/(tabs)/my.tsx` | modify | 스펙 4 | 내정보 헤더 config. |
| `(app)/series/[id]/[episodeNo].tsx` | modify | 스펙 5 | 뷰어 스텁 헤더 + router.back→guardedBack. |
| `+not-found.tsx` | modify | 스펙 5 | back + onBack=goHome. |
| `(auth)/sign-in.tsx` | modify | 스펙 5 | 주석 1줄(헤더 없음 규약). |

**중복 제거 규칙:**
- `HeaderIconButton`/`HeaderBackButton`/`HeaderTitle`/액션들은 **`header-actions.tsx`에만** 정의. `ScreenHeader`는 import.
- `ui/index.ts`는 `// header` 블록 **하나**만. `HeaderAction`/`HeaderIconButton` 등 이름 충돌 export 금지.

병렬 안전성: 위 소유권으로 파일별 단일 소유자가 보장되어 모듈을 병렬 작업해도 충돌하지 않는다.
