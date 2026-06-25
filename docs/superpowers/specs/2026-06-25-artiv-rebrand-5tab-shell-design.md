# 슬라이스 1 설계: Artiv 리브랜드 + 5탭 셸

- **작성일**: 2026-06-25
- **상태**: 검토 대기 (구현 전)
- **대상 레포**: `AppToon_Front` (프론트 전용 슬라이스. 백엔드 변경 없음)
- **선행 결정**: 이름 `Artiv`(잠정, [design-concepts/naming-concepts.md] 참조), 전체 리네임, 1번 탭 라벨 `창작물`, 채팅·결제 플레이스홀더 유지

---

## 1. 목표 (Goal)

웹툰 전용 "AppToon"을 다매체 아트 플랫폼 **Artiv**로 리브랜딩하고, 하단 탭을 현재 3탭에서 **5탭**(창작물·커뮤니티·채팅·서재·내정보)으로 확장하는 **셸(뼈대)** 을 세운다. 커뮤니티·채팅은 이번 슬라이스에서 **플레이스홀더 화면**으로 두고, 후속 슬라이스에서 실제 기능을 채운다.

성공 기준: 앱을 실행하면 Artiv 브랜드로 보이고, 5탭이 올바른 순서·라벨·아이콘으로 뜨며, 각 탭이 정상 동작(커뮤니티·채팅은 플레이스홀더)하고, 기존 흐름(로그인·작품 상세·서재·내정보)이 깨지지 않는다.

## 2. 범위 (Scope)

### In
1. **브랜드 리네임** — 표시명·식별자·UI 문자열·딥링크 전부 Artiv로
2. **5탭 구조** — `community`·`chat` 라우트 신설, 탭바 순서·라벨·아이콘 재구성
3. **플레이스홀더 화면 2종** — 커뮤니티(단기), 채팅(장기 "준비 중")
4. **죽은 코드 정리** — `getMe`(중복) 삭제
5. **핵심 문서 브랜드 동기화** — ToDoList 재지향 + 브랜드 한 줄 수정(범위 한정)
6. **frontend-design 적용** — 신규 표면(탭바·플레이스홀더·Artiv 워드마크)에 한정

### Out (후속 슬라이스)
- 회차 뷰어 실구현 → 멀티미디어 모델 슬라이스
- 커뮤니티 실기능(피드/작성/댓글) → 커뮤니티 슬라이스
- 채팅 실기능 → 마지막 슬라이스
- 검색/알림 화면·탭뱃지 → 알림은 프로필 슬라이스, 검색은 보류(백엔드 없음)
- 소셜 로그인(스텁 유지), 회원가입 화면, 작가 업로드, 실결제 → 각 슬라이스
- `useGuardedPress` 심 제거 → social-login 슬라이스에서(그 파일을 건드릴 때 함께; 이번엔 stub 미접촉이 더 외과적)
- 앱 아이콘 **이미지** 리디자인 → 별도 비주얼 에셋 작업(코드 범위 밖)

## 3. 브랜드 리네임 상세

### 3.1 식별자 (`app.json`)
| 키 | 현재 | 변경 |
|---|---|---|
| `name` | `AppToon` | `Artiv` |
| `slug` | `AppToon` | `Artiv` |
| `scheme` | `apptoon` | `artiv` |
| `ios.bundleIdentifier` | `com.kangjuhyun.AppToon` | `com.kangjuhyun.artiv` |
| `android.package` | `com.kangjuhyun.AppToon` | `com.kangjuhyun.artiv` |

`package.json`의 `name: "apptoon"` → `artiv`. `extra.eas.projectId`는 **유지**(EAS 프로젝트 동일).

### 3.2 UI 브랜드 문자열
- `src/app/(auth)/sign-in.tsx:115` kicker `Webtoon` → `Artiv`(또는 다매체 슬로건), `:118` 타이틀 `AppToon` → `Artiv`. **아우로라 글래스 비주얼·레이아웃은 그대로**, 텍스트만.
- `src/app/(app)/(tabs)/index.tsx:69` 헤더 타이틀 `AppToon` → `Artiv`.

### 3.3 딥링크
- `src/app/(app)/series/[id].tsx:229,232` 공유 문구 "앱툰에서…" + `apptoon://series/${seriesId}` → Artiv 문구 + `artiv://series/${seriesId}`.
- `src/app/+not-found.tsx` 주석의 scheme 언급 정합성만 확인(주석).

### 3.4 의도적 비변경 (외과적 원칙)
- `src/ui/*`, `transitions.ts` 등의 **주석/내부 식별자**(예: "AppToon design tokens") — 사용자 비노출 → 변경 안 함.
- 스토리지 키 `@apptoon/theme-mode`(`theme-mode.tsx:57`), `apptoon.refreshToken`(`tokenStore.ts:15`) — 변경 시 기존 사용자 **테마 초기화 + 로그아웃 1회** 발생 → **유지**. (원하면 별도 결정으로 변경 가능)

## 4. 5탭 구조

### 4.1 라우트
신규 파일 2개: `src/app/(app)/(tabs)/community.tsx`, `src/app/(app)/(tabs)/chat.tsx`. typedRoutes가 자동 인식.

### 4.2 탭바 (`_layout.tsx`의 `<Tabs.Screen>` 순서로 제어)
| 순서 | 라우트 | 라벨 | 아이콘(SF Symbol, Text fallback) |
|---|---|---|---|
| 1 | `index` | 창작물 | `square.grid.2x2.fill` (또는 `sparkles`) |
| 2 | `community` | 커뮤니티 | `bubble.left.and.bubble.right.fill` |
| 3 | `chat` | 채팅 | `paperplane.fill` (또는 `message.fill`) |
| 4 | `library` | 서재 | `books.vertical.fill` (현행 유지) |
| 5 | `my` | 내 정보 | `person.crop.circle.fill` (현행 유지) |

기존 탭바 패턴(`tabBarLabel` 커스텀 `Text` + `SymbolView` + Text fallback + safe-area 인셋)을 그대로 따른다. `index`의 라벨만 `홈`→`창작물`, 아이콘 `house.fill`→위 표대로.

## 5. 플레이스홀더 화면

회차 뷰어 stub(`[episodeNo].tsx`) 패턴 재사용: `Screen center` + 아이콘 + display/body 텍스트.
- `community.tsx` — "커뮤니티가 곧 열려요" (단기, 다음 슬라이스에서 실 화면으로 교체)
- `chat.tsx` — "채팅 준비 중" (장기, 후원 placeholder와 같은 '준비 중' 톤)

헤더는 각 탭 루트이므로 `variant: 'solid'`, `back: false`. (검색/알림 액션은 이번 슬라이스에서 추가하지 않음.)

## 6. 죽은 코드 정리

- `src/api/endpoints/users.ts`의 **`getMe` 삭제** — `endpoints/auth.ts`의 `fetchMe`와 중복, 소비자 0(감사 확인). `getFollowStats`/`setFollow`는 **유지**(프로필 슬라이스에서 부활 예정).
- 삭제로 불필요해진 import/타입만 함께 정리. 그 외 데드코드는 손대지 않음.

## 7. 문서 브랜드 동기화 (범위 한정)

전체 문서 재작성은 **아님**. 이번엔 브랜드가 정면 충돌하는 최소 지점만:
- `AppToon_Back/ToDoList.md` — 통째 obsolete(알림 "미구현" 거짓, "V10" 거짓 → 실제 V22) → **Artiv 빌드 순서로 재지향**(또는 비우고 로드맵 링크).
- `AppToon_Front/docs/README.md`, `AppToon_Back/docs/README.md`, `AppToon_Front/docs/frontend-architecture.md` — "웹툰 플랫폼/웹툰 리더 앱" **브랜드 한 줄**만 다매체+Artiv로.
- `design-concepts/naming-concepts.md`의 Artiv 잠정 채택은 이미 반영됨(유지).
- 깊은 재작성(roadmap-and-monetization 비전, screen-flows.html, features.md 본문)은 **후속 문서 패스**로 분리.

> ⚠️ 백엔드 문서(`AppToon_Back`)는 별도 git 레포다. 그 수정은 커밋이 분리되며, 사용자 승인 시 진행.

## 8. frontend-design 적용 지점

방금 새로 디자인한 로그인(Glass Stack 아우로라)은 **유지**. frontend-design 스킬은 신규/변경 표면에만:
- 5탭 탭바: 5칸 균형·아이콘 리듬·활성 색
- 커뮤니티/채팅 **플레이스홀더 화면**의 결(브랜드 톤·여백·일러스트)
- **Artiv 워드마크** 타이포 처리(sign-in·홈 헤더)

## 9. 검증 기준 (Acceptance)

1. 앱 실행 시 표시명·sign-in·홈 헤더가 **Artiv**. 잔존 "AppToon/Webtoon" 사용자 노출 0.
2. 하단 5탭이 **창작물·커뮤니티·채팅·서재·내정보** 순서·라벨·아이콘으로 표시.
3. 커뮤니티·채팅 탭 = 플레이스홀더 화면 정상 표시. 서재·내정보·창작물 = 기존 동작 유지.
4. `artiv://series/{id}` 딥링크 해석, 공유 문구가 artiv://.
5. TypeScript 컴파일·`expo lint` 통과. typedRoutes에 새 탭 반영.
6. 기존 로그인→홈→상세→서재 흐름 회귀 없음.

검증 방법: `expo lint` + tsc + 시뮬레이터 실행 후 위 1~6 육안 확인.

## 10. 리스크·주의

- **EAS slug**: `slug` 변경 + `projectId` 유지 → 다음 `eas` 명령에서 슬러그 불일치 경고 가능. expo.dev 프로젝트명도 Artiv로 맞추거나 빌드 시점 정리. `expo start` 개발은 무관.
- **번들ID/scheme 변경 → 네이티브 재생성 필요**: `npx expo prebuild --clean -p ios`(현재 iOS 빌드 실패(code 65)도 이 단계에서 함께 해소 기대). dev 빌드 **재설치** 필요. 기존 `apptoon://` 링크 사망(출시 전이라 무방).
- **앱 아이콘 이미지**는 옛 디자인 유지(표시명만 Artiv). 아이콘 에셋 리디자인은 별도.
- 스토리지 키 유지로 인해 내부엔 `apptoon` 잔존(의도적, 비노출).

## 11. 구현 순서(요약)

1. `app.json`·`package.json` 식별자 → Artiv
2. UI 브랜드 문자열·딥링크 → Artiv (sign-in, 홈 헤더, series 공유)
3. `community.tsx`·`chat.tsx` 플레이스홀더 생성
4. `_layout.tsx` 5탭 재구성(순서·라벨·아이콘)
5. `getMe` 삭제
6. 문서 브랜드 동기화(범위 한정)
7. frontend-design 패스(탭바·플레이스홀더·워드마크)
8. 검증(lint·tsc·시뮬레이터) + (필요시) `prebuild --clean`
