# AppToon Frontend System Framework — Glass Stack (정본)

> 이 문서는 8개 concern 스펙 + Expo SDK 56 검증 패턴 + 비평(critic) 지적을 병합한 **최종 단일 진실(SSOT)** 이다.
> 병렬 구현자는 §12 "구현 계약(contract)" 과 모듈 분할을 그대로 코드로 옮긴다.
> 모든 파일 경로는 절대경로 기준. 코드 별칭 `@/*` → `src/*`.

---

## 1. 개요 — Glass Stack 전환 요약

AppToon 디자인 시스템을 기존 **"Inkwell & Ember"(웜 잉크/엠버)** 에서 승인된 **"Glass Stack"** 으로 재스킨한다.

핵심 시각 모델: **블러 처리된 커버아트의 "살아있는 벽"(CoverWall) 위에, 서리 낀 유리 표면(GlassCard)이 떠 있는 화면.** 콘텐츠(커버아트)가 주인공이고, 폼/표면은 유리.

| 전환 | Before (Inkwell & Ember) | After (Glass Stack) |
|---|---|---|
| accent | 웜 엠버 | **인디고** (`#9AA6FF` dark / `#3D5BFF` light) — 링크/포커스/active/kicker 전용 |
| primary CTA | accent 채움 | **고대비 뉴트럴** (dark: 흰 배경+잉크 텍스트 / light: 잉크 배경+흰 텍스트) — accent 아님 |
| 웜 톤 | 전역 accent | **unlock/countdown 순간 전용** (`unlockWarm` role) |
| 표면 | 불투명 잉크 | **glass roles** (glassBg/glassBorder/glassField/glassFieldBorder) + scrim |
| 뉴트럴 램프 | 웜 잉크 | **쿨 뉴트럴** (bg/text/secondary/kicker) |

**불변(유지) 항목:** viewer = true-black, 배지(lock/up/19/best), spacing/radius/type(Pretendard)/motion/zIndex/opacity 구조, `layout.minHitTarget`(44), `layout.maxContentWidth`(720), `layout.viewerMaxWidth`(900).

**전환에 동반되는 신규 시스템 (이 프레임워크의 범위):**
1. 디자인 토큰/테마 재스킨 + Glass 프리미티브(GlassCard, CoverWall)
2. 라이트/다크 **모드 선택**(시스템/라이트/다크, 영속화)
3. 더블탭/중복요청 방지(useAsyncPress + Button + nav guard)
4. ScreenLayout 강화(안전영역, Android OS 네비바 겹침 방지, 키보드, 풋터 슬롯)
5. 반응형/적응형(브레이크포인트, 폰트스케일 클램프, 태블릿)
6. 네비게이션 전환 정합성(GestureHandlerRootView, Reanimated4 규칙, 일관 전환)
7. 소셜 로그인 시드(seam은 이미 존재 — sign-in에 슬롯 장착)
8. Glass 로그인 화면 조립

---

## 2. 디자인 토큰 재스킨 — 라이트/다크 role 표 + 대비/WCAG

토큰은 `tokens.ts`(원시 리터럴) → `theme.ts`(시맨틱 role) 2계층. **프리미티브는 절대 palette를 직접 읽지 않고 항상 role(`t.color.*`)을 읽는다.**

### 2.1 DARK role 표 (정확 값)

```
bg #0E1014  surface #22242C  surfaceElevated #191B22  surfaceSunken #000000  viewerBg #000000
glassBg rgba(255,255,255,.10)  glassBorder rgba(255,255,255,.26)
glassField rgba(255,255,255,.13)  glassFieldBorder rgba(255,255,255,.22)
onSurface #FFFFFF  onSurfaceSecondary #C7CCDC  onSurfaceMuted #A7AEC6  kicker #A7AEC6
primaryBg #FFFFFF  primaryPressed #E6E7EE  onPrimary #10121A  onAccent #FFFFFF
accent #9AA6FF  accentPressed #6C7CFF  accentSubtle rgba(154,166,255,.16)  accentBorder rgba(154,166,255,.40)
unlockWarm #FF9C7A  unlockWarmSubtle rgba(255,156,122,.16)
lockBg #2A2E35  lockFg #7E8794  border rgba(255,255,255,.10)  borderStrong rgba(255,255,255,.18)
success #1FA971  danger #E5484D  warn #E0A106  focusRing #9AA6FF
badge19 #E5484D  badgeUp #1FA971  badgeBest #7C5CFF  badgeLockBg #00000099  scrim rgba(14,16,20,.62)
```

### 2.2 LIGHT role 표 (정확 값)

```
bg #EAEBF0  surface #FFFFFF  surfaceElevated #FFFFFF  surfaceSunken #EAEBF0  viewerBg #FFFFFF
glassBg rgba(255,255,255,.55)  glassBorder rgba(255,255,255,.9)
glassField rgba(255,255,255,.78)  glassFieldBorder rgba(0,0,0,.08)
onSurface #14151A  onSurfaceSecondary #3C3E48  onSurfaceMuted #6A6E80  kicker #6A6E80
primaryBg #16171D  primaryPressed #000000  onPrimary #FFFFFF  onAccent #FFFFFF
accent #3D5BFF  accentPressed #2E45D6  accentSubtle rgba(61,91,255,.10)  accentBorder rgba(61,91,255,.35)
unlockWarm #A82E12  unlockWarmSubtle rgba(168,46,18,.10)
lockBg #E4E6EA  lockFg #4C545F  border rgba(0,0,0,.10)  borderStrong rgba(0,0,0,.18)
success #1FA971  danger #E5484D  warn #E0A106  focusRing #3D5BFF
badge19 #E5484D  badgeUp #1FA971  badgeBest #7C5CFF  badgeLockBg #00000099  scrim rgba(245,246,250,.55)
```

> `lightColors` 와 `darkColors` 는 **반드시 동일한 36개 key 집합** 을 가져야 한다(makeTheme의 `isDark ? darkColors : lightColors` 유니온이 `ColorRoleName`을 좁히지 않게). 구현 후 key 집합 동일 여부를 프로그램으로 검증.

### 2.3 대비 / WCAG AA 검증 결과

| 쌍 | 모드 | 대비 | 판정 |
|---|---|---|---|
| onSurface(#FFF) on bg(#0E1014) | dark | ~18.x:1 | AA/AAA 통과 |
| onSurface(#14151A) on bg(#EAEBF0) | light | ~15.x:1 | AA/AAA 통과 |
| primary CTA (흰 위 잉크 텍스트) | dark | 18.7:1 | 통과 |
| primary CTA (잉크 위 흰 텍스트) | light | 17.9:1 | 통과 |
| accent(#9AA6FF) on bg | dark | 8.41:1 | 통과 |
| accent(#9AA6FF) on glassBg | dark | 6.52:1 | 통과 |
| accent(#3D5BFF) on glass/white | light | 4.7–5.07:1 | AA(작은 본문 포함) 통과 |
| **accent(#3D5BFF) on bare bg(#EAEBF0)** | light | **4.26:1** | **AA large/UI만** — ⚠️ 작은 본문 금지 |
| kicker(#6A6E80) on bg | light | 4.25:1 | UI/large 통과 |
| unlockWarm(#FF9C7A) on bg | dark | 9.33:1 | 통과 |
| unlockWarm(#A82E12) on bg | light | 5.76:1 | 통과 |

**사용 가이드라인(린트성 규칙):**
- 라이트 인디고 accent 텍스트는 **glass/white 위에만** 배치(맨 bg 위 작은 본문 금지 — 4.26:1).
- unlockWarm은 라이트에서 **반드시 어두운 `#A82E12`** (중간 엠버는 pale bg에서 AA 실패), 다크는 밝은 `#FF9C7A`. **단일 공유값 불가.**
- scrim은 RN `backgroundColor`가 CSS gradient를 못 받으므로 단색 rgba(목업 mid-stop 근사)로 저장. 추후 `expo-linear-gradient` 도입 시 진짜 그라데이션으로 업그레이드 가능.

---

## 3. 라이트·다크 모드 선택

### 3.1 모델
- **ThemeMode**: `'system' | 'light' | 'dark'`. AsyncStorage key `@apptoon/theme-mode`.
- **저장 대상은 사용자 의도(mode)만.** resolvedScheme(`'light'|'dark'`)은 mode + 실시간 OS 신호에서 매 렌더 파생 → `system` 사용자가 앱 실행 중 OS 테마를 바꿔도 즉시 추종.
- 영속화에 resolvedScheme를 저장하지 않는다(stale 방지).

### 3.2 단일 override read path (★ critic 해소)
**override를 읽는 곳은 `src/ui/use-theme.ts` 의 `useTheme()` 단 하나.** 구현:

```ts
export function useTheme(): Theme {
  const ctx = useThemeModeContextOptional(); // 비throw, 무조건 호출
  const os = useColorScheme();               // @/hooks/use-color-scheme, 무조건 호출
  const scheme = ctx?.resolvedScheme ?? (os === 'dark' ? 'dark' : 'light');
  return themes[scheme];
}
```
- 프로바이더 부재(루트 ErrorBoundary)에서도 비throw fallback으로 OS 스킴을 쓴다 → 마지막 보루 화면이 절대 깨지지 않음.
- **두 훅 모두 조건 없이 매 렌더 호출**(reactCompiler/rules-of-hooks 안전), 값만 분기.
- ⚠️ **중복 파일 `src/hooks/use-theme.ts` 는 삭제**(배럴에서 export되지 않으며 override 동작과 silently 분기됨). 정본은 `src/ui/use-theme.ts`.

### 3.3 프로바이더 위치
`ThemeModeProvider` 는 SSOT 프로바이더 트리에서 **AuthProvider 아래, Gate 위** 슬롯(아키텍처가 예약한 'ThemeProvider' 슬롯)에 위치 → 모든 `useTheme` consumer 위. §10 참조.

### 3.4 첫 페인트 플래시 방지
- Provider는 `hasLoaded=false`로 시작, mount effect에서 AsyncStorage 읽기.
- **Gate가 `(fonts/auth ready) AND themeReady` 까지 `null` 반환** → 네이티브 splash 유지 → light→dark 스냅 절대 노출 안 됨.
- 읽기 실패/garbage → `'system'` 기본 + `hasLoaded=true`(splash 데드락 방지, 기존 fontError 관용 미러링).
- StrictMode 이중 호출은 `startedRef` + `cancelled` 플래그로 가드.

### 3.5 상태바 / Android 네비바 — 단일 소유자 규칙 (★ critic 해소)
세 스펙(StatusBar / SystemUI / SystemBars)이 충돌 → **다음으로 정본화:**

1. **per-screen 바 아이콘 색 = `Screen.tsx` 가 단독 소유.** Screen이 surface(viewer/glass/chrome)+resolvedScheme를 알므로 `<SystemBars style={...}/>`(from `react-native-edge-to-edge`)를 surface별로 렌더. SystemBars/StatusBar는 mount 순서로 머지 → 라우팅된 화면에서는 **Screen이 항상 승리.**
2. **`ThemeModeProvider` 의 `<StatusBar/>` 는 app-wide 기본값으로 강등** — Screen이 없는 경우(splash/error boundary)만 커버. 문서화된 default.
3. **nav-bar 메커니즘은 expo-status-bar backgroundColor 가 아니라 `SystemBars`** (SDK56 edge-to-edge에서 backgroundColor는 deprecated). Screen이 SystemBars로 status+nav 아이콘 색 동시 제어.
4. Provider의 `SystemUI.setBackgroundColorAsync(bg)` 는 **윈도우 배경 페인트(회전/오버스크롤 anti-flash)** 용으로만 유지 — 바 색칠 용도 아님.

→ 세 메커니즘이 서로 싸우지 않음. Screen=바 아이콘 색, Provider=윈도우 배경, expo-navigation-bar 의존성 추가 없음.

---

## 4. ScreenLayout

`Screen` 프리미티브를 강화. 기존 `Screen`/`Box` API 보존(추가형). 모든 인셋은 `useSafeAreaInsets()`(SafeAreaView 래퍼 대체)로 읽어 **각 인셋을 정확한 sub-element 에 적용.**

### 4.1 안전영역 매핑
- `top` → body 상단 패딩(노치/상태바)
- `left`/`right` → body+footer 가로 패딩(가로/폴더블/split)
- `bottom` → **pinned footer 의 paddingBottom = `Math.max(insets.bottom, t.space.lg)`**

### 4.2 Android OS 네비바 겹침 방지 (★ 핵심 요구 #5)
- footer 슬롯: `paddingBottom: Math.max(insets.bottom, t.space.lg)` — SDK56 always-on edge-to-edge에서 콘텐츠가 시스템 바 뒤로 그려지므로, 이 한 줄이 CTA를 제스처 핀/3버튼 바/iOS 홈인디케이터 위로 띄우는 유일한 계약. bottom 인셋 0인 기기는 `space.lg`(16) 바닥값.
- footer 없고 body가 bottom edge를 원하면 동일 `Math.max` 를 body 하단 패딩에 적용.
- **footer 존재 시 body는 자기 bottom 인셋을 억제**: `bodyWantsBottom = edges.includes('bottom') && !footer` → footer 위 이중 갭 방지.
- **(tabs) 탭바도 동일 인셋 필요 (★ critic 해소):** Screen은 자기 footer만 처리하므로, **`(tabs)/_layout.tsx` 가 `tabBarStyle` 에 직접 bottom 인셋을 적용**해야 한다. §12 참조(탭 화면이 Android 네비바 아래로 스크롤되는 것을 막는 진짜 표면).

### 4.3 키보드
`KeyboardAvoidingView` 가 body+footer 래핑. behavior: iOS `'padding'` / Android `'height'`. 스크롤 body는 `keyboardShouldPersistTaps='handled'`. `disableKeyboardAvoiding` 탈출구.

### 4.4 풋터 슬롯
스크롤러 밖 + KeyboardAvoidingView 안 → body 스크롤 중 고정, 키보드와 함께 상승.

### 4.5 status bar / SystemBars
Screen이 surface+theme로 `<SystemBars style={...}/>`(react-native-edge-to-edge) 렌더. viewer/glass=light 아이콘, chrome=isDark 추종. `statusBarStyle` prop으로 화면별 override 가능. backgroundColor/translucent 미사용.

### 4.6 배경 변형(surface)
- `chrome`: `t.color.bg`, gutter `r.gutter`, content `r.contentMaxWidth` 캡(태블릿+ 중앙).
- `viewer`: true-black `viewerBg`, gutter 0, bottom bleed, `viewerMaxWidth`(900) 캡.
- `glass`: `transparent`(뒤 CoverWall 비침), footer transparent, 바 light 아이콘.

### 4.7 반응형 연동
`useResponsive()` 의 `r.gutter`/`r.contentMaxWidth` 를 Screen이 읽음. phone에서 `contentMaxWidth=Infinity` → RN이 무시 → full-bleed(분기 없음). 태블릿+ 중앙 캡.

---

## 5. 더블탭 / 중복요청 방지

3계층:

### 5.1 useAsyncPress (headless)
`src/ui/use-async-press.ts`. 락의 **권위 게이트는 `useRef` boolean**(동기 — 같은 tick의 두 번째 탭이 stale state를 읽기 전에 차단). `useState`는 스피너 렌더용 미러.
- `Promise.resolve(handler())` 로 sync/async 정규화 후 await.
- handler settle 후 **trailing cooldown**(기본 350ms, reduced-motion 시 0) 동안 락 유지 → 인간 더블탭(120–250ms) 차단.
- handler rejection을 catch하여 락 해제(영구 비활성 버튼 방지) + optional `opts.onError`.
- unmount 시 timer clear + `mountedRef` 가드.

### 5.2 Button (자동 적용)
`Button.tsx` 가 onPress를 `useAsyncPress` 로 라우팅 → **모든 액션 버튼 기본 더블탭 안전**, 호출부 변경 0.
- `busy = loading || pending` (스피너 소스, cooldown 단독은 스피너 안 띄움).
- `isDisabled = disabled || loading || pending || pressDisabled`.
- accessibilityState busy/disabled 동기화.
- onPress 타입을 `AsyncPressHandler`(sync OR `Promise<void>`)로 확장 → `ButtonProps` 가 `onPress` 를 override.
- **색 role은 re-skin 정본 유지**: primary = `primaryBg`/`onPrimary`(뉴트럴), danger = `danger`/`onAccent`, ghost = `accent`/`accentBorder`, focus = `focusRing`.

### 5.3 nav guard
`src/lib/navigation/useGuardedNavigation.ts`. **module-level `lastNavAt`** leading-edge throttle(기본 500ms) → 서로 다른 컴포넌트(리스트 카드 2개)가 같은 라우트로 동시 push해도 1번만. 첫 내비 즉시, 윈도우 내 후속 drop. expo-router `router` 싱글톤 래핑. 훅 + standalone fn 둘 다 제공. `__resetNavGuard()` 테스트 훅. **Button과 결합 안 함**(ui→expo-router 의존 회피); 같은 버튼 반복은 cooldown이 커버.

### 5.4 sign-in 정합 (★ critic 해소)
sign-in의 Button은 **`onPress={onSubmit}`(async 직접 전달, void 래퍼 제거)** → useAsyncPress가 실제 promise를 await하여 요청 전체 동안 락 유지. `loading={submitting}` 도 유지(이중 방어). 화면 내 `if (submitting) return;` 는 redundant-but-harmless 가 아니라 추가 방어선으로 유지.

---

## 6. 반응형 / 적응형

`src/ui/responsive.ts` (provider 없음, `useTheme` 처럼 매 렌더 OS 신호 + 내부 memo).

### 6.1 브레이크포인트 표 (inclusive lower bound)
| bp | width | content max-width | gutter | CoverWall cols | twoPane |
|---|---|---|---|---|---|
| phone | <600 | Infinity(full-bleed) | space.lg(16) | 3 | false |
| tablet | 600–1023 | maxContentWidth(720) | space.2xl(24) | 5 | false |
| large | ≥1024 | 720 | 24 | 7 | true |

### 6.2 hooks/helpers
`useResponsive()` → `{ bp, width, height, isPhone/isTablet/isLarge/isTabletUp, isLandscape, select, scale, clamp, contentMaxWidth, coverWallColumns, coverColumnsFor, gutter, twoPane }`. memo deps `[bp, width, height]` → 리사이즈 프레임마다 re-render storm 없음. `useBreakpoint()` = bucket만.
- `select()` mobile-first 캐스케이드(현재 bp→phone, 마지막 수단 위로).
- `scale()` 클램프·서브선형(factor 0.5, floor=base)·**incidental 사이징 전용**(타입 아님).
- `coverColumnsFor(w)` = `min(designed, floor((w+gap)/(tileMin+gap)))`, floor 1 → 타일이 ~104dp 밑으로 안 떨어짐.

### 6.3 폰트스케일 클램프
역할별 캡(`resolveFontScaleCap(variant)`): display 1.3 / title 1.35 / body 1.6 / caption 1.7 / default 1.6. **Text 프리미티브가 hardcoded `maxFontSizeMultiplier={2}` 를 `maxFontSizeMultiplier ?? resolveFontScaleCap(variant)` 로 교체**, optional override prop 추가. display/title는 타이트(레이아웃 보호), body/caption은 여유(a11y 가독성).

### 6.4 토큰
모든 숫자는 `tokens.ts`: `breakpoints`, `coverWallColumns{phone:3,tablet:5,large:7}`, `coverTileMinWidth:104`, `fontScaleCap`. `layout.maxContentWidth`(720)/`viewerMaxWidth`(900) 재사용.

---

## 7. 네비게이션 전환 & 애니메이션 정확성

### 7.1 GestureHandlerRootView (★ 핵심 요구 #4, ★ critic 해소: 단일 소유자)
**`_layout.tsx` 의 진짜 최상단(GlobalErrorBoundary 래핑)에 `<GestureHandlerRootView style={{flex:1}}>` 1회 추가** — `integration` 모듈(=theme-mode 프로바이더 트리 소유자)이 단독 적용. transitions 스펙은 재추가하지 않고 참조만. `style={{flex:1}}` 필수(없으면 제스처 영역 0). 에러 화면에서도 제스처 동작하도록 GlobalErrorBoundary 바깥. react-native-screens는 expo-router가 auto-enable → `enableScreens()` 수동 호출 금지.

### 7.2 transitions.ts (option 팩토리)
`src/lib/navigation/transitions.ts` — 네비 타입 + `@/ui` motion 토큰만 import(leaf). reduced-motion 인지 팩토리:
- `chromeStackScreenOptions(reduced)`: 수평 push. `animation:'ios_from_right'`(iOS/Android 일관), gesture-back. reduced → `'none'`+0ms+gestureEnabled:false.
- `modalScreenOptions(reduced)`: `presentation:'modal'` + `'slide_from_bottom'`(viewer/lightbox가 chrome 위로 상승, swipe-down dismiss), 360ms. reduced → `'fade'` 120ms + dismiss gesture **유지**(immersive viewer의 유일 출구).
- `tabsScreenOptions(reduced)`: cross-fade(`'fade'`/`'none'`, TabAnimationName 유니온; local `TabsAnimationOptions` 타입). reduced → `'none'`.
- `REANIMATED_RULES`: 워클릿/get-set/no-read-in-render 계약 문서 객체.
- `contentStyle`/배경 미설정(ScreenLayout이 surface 페인트 → 전환 중 잘못된 모드색 플래시 방지).

### 7.3 전환 옵션 와이어링 (★ critic 해소: dead code 방지)
**transitions 스펙이 두 layout 편집을 소유**(integration 모듈이 적용):
- `_layout.tsx` 루트 Stack: `screenOptions={{ headerShown:false, ...chromeStackScreenOptions(useReducedMotion()) }}`.
- `(tabs)/_layout.tsx`: `screenOptions={{ ...기존, ...tabsScreenOptions(useReducedMotion()) }}`.
- (viewer) 그룹은 아직 미존재 → `modalScreenOptions` 는 준비-but-미사용(그룹 추가 시 적용).

### 7.4 Reanimated 4 + React Compiler 규칙
- `react-native-reanimated` 4.3.1 + `react-native-worklets`(별도 peer). babel plugin은 `babel-preset-expo` 자동 — 수동 항목 시 `'react-native-worklets/plugin'`.
- shared value: **reactCompiler ON 이므로 `.value` 직접 read/write 금지, `get()/set()` 사용.**
- **렌더 중 shared value read/write 절대 금지**(Rules of React 위반 경고).
- 모든 read/write는 콜백/훅(useAnimatedStyle, gesture callback)에서. JS 전이는 `runOnJS`.
- reduced-motion은 `ReduceMotion.System` / `useReducedMotion()` 존중.
- transitions.ts엔 워클릿/shared value 없음(불리언+토큰의 plain object).

---

## 8. 소셜 로그인 시드 (google/kakao/apple seam)

**시드는 이미 존재** (`src/features/auth/social.ts`, `SocialButtonRow.tsx`). 이 프레임워크는 **UI 슬롯 장착만** 추가.

### 8.1 기존 seam(불변)
- `SocialProvider = 'google' | 'kakao' | 'apple'` (closed union).
- `socialLogin(provider): Promise<TokenResponse>` — 단일 async 진입점. **오늘은 `makeSocialNotReadyError()`("준비 중입니다")** 던짐, 시그니처/반환은 production 형태.
- 미래 토큰 교환 지점(문서화된 2단계):
  1. `acquireProviderToken(provider)` — expo-auth-session(Google) / Kakao SDK / expo-apple-authentication.
  2. `exchangeWithBackend({provider, token})` — `POST /auth/social` → `TokenResponse` → tokenStore.
- `SOCIAL_REGISTRY`(label/brand/glyph), `socialProvidersInOrder()`, `isSocialNotReadyError()` 가드, `SOCIAL_NOT_READY_MESSAGE`.

### 8.2 UI 슬롯
`SocialButtonRow`("또는" divider + 브랜드 버튼들, `visibleProviders` prop) 를 **sign-in 폼 아래에 마운트**(§9). "준비 중" 에러는 calm toast/inline로.

### 8.3 Apple 규칙
iOS에서 다른 소셜 로그인을 제공하면 Apple 로그인 필수(Guideline 4.8) → `SocialButtonRow` 의 `resolveVisible` 이 iOS에서 Apple 유지. **백엔드를 가짜로 만들지 않음** — seam은 형태만, 실제 호출은 "준비 중".

---

## 9. Glass 로그인 화면 (조립)

`src/app/(auth)/sign-in.tsx` 를 Glass Stack 으로 재스킨(★ critic 해소: 프리미티브가 실제로 마운트됨):

```
<Screen surface="glass" footer={<Button label="로그인" fullWidth loading={submitting} onPress={onSubmit} />}>
  <CoverWall />                          {/* 절대배치 배경, pointerEvents none */}
  <GlassCard radius="xl">                {/* 떠 있는 폼 */}
    <Text variant="display">AppToon</Text>
    <Text variant="body" color="onSurfaceSecondary">로그인하고 …</Text>
    <TextInput style={glassField 스타일}/>   {/* glassField + glassFieldBorder role */}
    <TextInput .../>
    {formError 등}
  </GlassCard>
  <SocialButtonRow />                     {/* 폼 아래 소셜 슬롯 */}
</Screen>
```
- TextInput 배경/보더는 `glassField`/`glassFieldBorder` role.
- primary CTA는 footer 슬롯의 `Button`(뉴트럴, Screen이 bottom 인셋 처리).
- onPress는 **async `onSubmit` 직접 전달**(§5.4).
- 기존 로그인 로직(useAuth().login, 필드 에러 매핑, Stack.Protected 추종)·a11y label 보존.
- CoverWall은 실제 cover URL 없으면 deterministic flat hue 플레이스홀더.

---

## 10. 프로바이더 트리 최종본

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>      {/* ★ 신규, 진짜 최상단 */}
  <GlobalErrorBoundary>
    <SafeAreaProvider>
      <NetworkProvider>
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              <ThemeModeProvider>                  {/* ★ 신규, ThemeProvider 슬롯 */}
                <Gate />                            {/* fonts+auth+themeReady 게이트 */}
              </ThemeModeProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  </GlobalErrorBoundary>
</GestureHandlerRootView>
```
- Gate는 ThemeModeProvider 아래(`useThemeMode().hasLoaded` 읽음).
- 루트 Stack: `screenOptions={{ headerShown:false, ...chromeStackScreenOptions(useReducedMotion()) }}`.
- `ErrorBoundary` named export(루트 라우트 경계)는 `SafeAreaProvider`만 마운트 → `useTheme` 이 OS fallback으로 동작(§3.2).
- Stack.Protected 가드는 그대로(로그인 후 hand-navigate 금지, expo #30700).

---

## 11. 구현 / 검증 체크리스트

**파일 소유권(critic 해소):** 각 파일은 정확히 1개 모듈 소유. integration 모듈이 `_layout.tsx`, `(auth)/sign-in.tsx`, `(app)/(tabs)/_layout.tsx`, `src/ui/index.ts`(배럴, append-only) 단독 소유.

- [ ] tokens.ts: Glass Stack palette + 신규 토큰(glass/cta/unlock/indigo/kicker, breakpoints/coverWallColumns/coverTileMinWidth/fontScaleCap). 구조 토큰 불변.
- [ ] theme.ts: light/dark 36 key 동일 — 프로그램 검증.
- [ ] use-theme.ts: 단일 override read path. `src/hooks/use-theme.ts` **삭제.**
- [ ] theme-mode.tsx: AsyncStorage 영속, hasLoaded, resolvedScheme, app-wide StatusBar(default).
- [ ] use-async-press.ts + Button.tsx: ref 게이트 + cooldown, 색 role 보존.
- [ ] useGuardedNavigation.ts: module-level throttle.
- [ ] responsive.ts: bp/select/scale/clamp/contentMaxWidth/coverColumnsFor/fontScaleCap.
- [ ] Text.tsx: `resolveFontScaleCap(variant)` 와이어.
- [ ] Screen.tsx: useSafeAreaInsets, footer `Math.max(bottom, lg)`, SystemBars, surface 변형, useResponsive.
- [ ] GlassCard.tsx / CoverWall.tsx: availability+fallback, AppImage blurRadius.
- [ ] AppImage.tsx: `blurRadius` prop 포워드 추가.
- [ ] ThemeModeToggle.tsx: `space.xs`/`space.none` + `layout.minHitTarget`(★ critic: `space.xxs`/`minHitTarget44` 존재 안 함).
- [ ] sign-in.tsx: Screen glass + CoverWall + GlassCard + SocialButtonRow + async onPress.
- [ ] _layout.tsx: GHRootView + ThemeModeProvider + Gate themeReady + Stack chromeStackScreenOptions.
- [ ] (tabs)/_layout.tsx: tabsScreenOptions + tabBar bottom 인셋.
- [ ] index.ts 배럴: 모든 신규 export append.

**검증:**
- [ ] `tsc --noEmit` — src/ui 0 에러(기존 무관 에러 제외).
- [ ] ESLint clean.
- [ ] light/dark/system 토글 → 첫 페인트 플래시 없음, OS 추종.
- [ ] Android 기기: footer/탭바 CTA가 OS 네비바 위.
- [ ] 더블탭 → 단일 submit/단일 push.
- [ ] reduced-motion: 전환 collapse, viewer dismiss gesture 유지.
- [ ] iOS 26 GlassView 렌더 / Android·구형 fallback 표면 가시.
