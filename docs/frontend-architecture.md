# Artiv 프론트엔드 아키텍처 (Single Source of Truth)

> Expo SDK ~56 (managed, New Architecture only / RN 0.85) · expo-router ~56.2.10
> (`typedRoutes` + `reactCompiler` 활성) · React 19.2 · TypeScript strict.
> 본 문서는 병렬 구현자들이 코딩 기준으로 삼는 **최종·내부 정합** 설계입니다.
> 모든 모듈 API는 `contract`에 고정되어 있으며, 본 문서와 충돌 시 본 문서가 우선합니다.

---

## 1. 개요 & 기술 스택 결정

Artiv는 다매체 아트 창작 플랫폼입니다(웹툰·일러스트·음악 등 + 커뮤니티·채팅·서재·후원). 화면은 크게 두 갈래로 나뉩니다.
- **CHROME**(탐색/라이브러리/커뮤니티): 따뜻한 ink 톤의 "갤러리 월".
- **VIEWER**(몰입형 세로 스크롤): TRUE-BLACK(OLED) 표면으로 프레임이 사라지는 독서면.

서버 상태가 지배적인 앱(목록/상세/무한스크롤/낙관적 토글/폴링/업로드)이므로
**서버 상태**와 **클라이언트(인증/UI) 상태**를 명확히 분리합니다.

### 선택한 스택과 이유

| 영역 | 선택 | 이유 | 거부한 대안 |
|---|---|---|---|
| 서버 상태 | **@tanstack/react-query v5** | 캐시/무한쿼리/낙관적 업데이트/폴링/`onlineManager`를 한 번에. 백엔드 Page/Slice 페이징과 정확히 맞음 | SWR(무한쿼리·낙관적·offline 큐가 약함), 직접 fetch 캐시(재구현 비용) |
| HTTP | **axios v1** | 단일 인스턴스에 request/response 인터셉터 → Bearer 부착 + 단일비행 refresh. `onUploadProgress` 지원(멀티파트 진행률) | fetch(progress·인터셉터 부재), ky(인터셉터 모델 빈약) |
| 토큰 at-rest | **expo-secure-store** | refresh(14일·회전)는 OS 보안저장소에. access(1시간)는 메모리만 | AsyncStorage(평문), MMKV(보안 약, 추가 의존) |
| 클라이언트/인증 상태 | **React Context** | 인증/네트워크/토스트는 저빈도 전역 상태. Redux는 과함 | Redux/Zustand(보일러플레이트·서버상태와 중복) |
| 이미지 | **expo-image** | `cachePolicy='memory-disk'`, `recyclingKey`로 리스트/뷰어 리사이클 | RN Image(캐시·리사이클 약함) |
| offline 신호 | **@react-native-community/netinfo** | `onlineManager` 소스 + 오프라인 배너. **단일 구독** | navigator.onLine(native에서 undefined) |
| 타입 | **openapi-typescript** 코드젠 | `docs/openapi.json` → `src/api/schema.d.ts` (성공 DTO). 에러 envelope는 스펙에 없어 수기 유지 | 전부 수기(드리프트) |

> **단일 권위 원칙(충돌 해소 결과).** 앱 전체에서 다음은 정확히 하나만 존재합니다:
> axios 인스턴스 `api`(`src/api/client.ts`), 토큰 스토어(`src/api/tokenStore.ts`),
> 에러 정규화 `normalizeError` + `AppError` 클래스(`src/lib/errors`),
> 쿼리키 팩토리(`src/lib/query/keys.ts`), QueryClient/Provider(`src/lib/query`),
> NetInfo 구독(`src/providers/NetworkProvider.tsx`), 그리고 프로바이더 순서(`src/app/_layout.tsx`).

---

## 2. 폴더 구조 & 레이어링 / 네이밍

```
src/
├─ api/                         # HTTP 트랜스포트 + 엔드포인트 + DTO 타입
│  ├─ config.ts                 # BASE_URL/API_BASE/FILES_URL (단일 base url)
│  ├─ tokenStore.ts             # access(메모리)+refresh(SecureStore) 단일 스토어
│  ├─ authEvents.ts             # 'logout' 이벤트 에미터(React/router 비의존)
│  ├─ client.ts                 # 단일 axios `api` + 인터셉터 + 단일비행 refresh
│  ├─ paging.ts                 # Page/Slice 파라미터 빌더 + fixed-sort 가드
│  ├─ multipart.ts              # FormData/RN file part/업로드(progress+abort)
│  ├─ image.ts                  # resolveImageUrl(url)
│  ├─ types.ts                  # schema.d.ts 별칭 + enum 유니온
│  ├─ schema.d.ts               # (코드젠 산출물; 커밋 전 생성)
│  └─ endpoints/
│     ├─ auth.ts series.ts episodes.ts personalization.ts
│     └─ posts.ts notifications.ts users.ts
├─ lib/
│  ├─ errors/                   # 단일 AppError + normalizeError + 카탈로그
│  │  ├─ types.ts normalizeError.ts errorCatalog.ts messages.ts index.ts
│  ├─ query/                    # TanStack 설정
│  │  ├─ queryClient.ts keys.ts infinite.ts mutations.ts QueryProvider.tsx index.ts
│  └─ forms/fieldErrors.ts      # fieldErrors[] → 폼 필드 매핑
├─ providers/
│  ├─ NetworkProvider.tsx       # 단일 NetInfo 구독 → onlineManager + 배너 컨텍스트
│  └─ GlobalErrorBoundary.tsx   # 루트 렌더 크래시 캐치
├─ features/
│  ├─ auth/                     # AuthContext/api/roles/validation/useRequireRole
│  └─ series/                   # 참조 vertical: useSeriesList/useSeriesDetail/useSubscribeToggle
├─ ui/                          # (기존) 디자인 토큰/테마/프리미티브 — 재사용
│  ├─ tokens.ts theme.ts use-theme.ts index.ts
│  └─ primitives/ (Text Screen Button Card Badge Skeleton EmptyState ErrorState Toast …)
├─ components/feedback/OfflineBanner.tsx
└─ app/                         # expo-router 라우트 (app-shell 모듈 소유)
   ├─ _layout.tsx               # 루트: 프로바이더 + 스플래시/폰트 게이트 + Stack.Protected + ErrorBoundary
   ├─ +not-found.tsx
   ├─ (auth)/ _layout.tsx sign-in.tsx
   └─ (app)/  _layout.tsx (tabs)/_layout.tsx (tabs)/index.tsx
```

### 레이어링 / 의존성 규칙 (단방향, 위→아래만)

```
app(라우트) → features → lib/query · providers → api → lib/errors · ui(tokens)
```

- `api/client.ts`는 **React/expo-router를 import 하지 않습니다**(순환·테스트 위험). 로그아웃 같은 부수효과는 `authEvents`로 신호만 보냅니다.
- `lib/errors`는 어디에도 의존하지 않는 **잎(leaf)** 모듈(axios만 참조). `api`·`lib/query`·`ui`·`features`가 이를 import.
- `features/*`는 같은 feature 내부와 `api`·`lib`·`ui`만 참조. **feature 간 직접 import 금지**.
- `ui/`는 순수 표현 레이어. 네트워크/도메인 로직 없음.

### 네이밍 컨벤션
- 파일: 모듈/유틸 `camelCase.ts`, React 컴포넌트 `PascalCase.tsx`, 라우트는 expo-router 규칙(`_layout.tsx`, `[id].tsx`, `+not-found.tsx`).
- 훅: `useXxx`. 쿼리 훅은 feature `hooks.ts`에 모음.
- DTO 타입: **OpenAPI 코드젠 산출 이름**(`*Response` 접미사)을 정본으로, ergonomic 별칭만 `types.ts`에서 re-export(`EpisodeDetailResponse as EpisodeDetail`).
- import는 항상 `@/*` 별칭.

---

## 3. 환경설정 & 타입 코드젠

### BASE_URL (`src/api/config.ts`)
```ts
export const BASE_URL  = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
export const API_BASE  = `${BASE_URL}/api`;   // 엔드포인트 path는 '/api/...' 풀패스 사용
export const FILES_URL = `${BASE_URL}/files`; // 공개 정적 파일
```
- `EXPO_PUBLIC_` 접두 env는 **빌드 타임에 인라인**됩니다(클라이언트에서 읽힘).
- **실기기 개발**: `localhost`는 기기 자신을 가리키므로 동작하지 않음.
  - iOS 실기기/시뮬: `EXPO_PUBLIC_API_URL=http://<맥-LAN-IP>:8080`
  - Android: 같은 LAN IP 또는 `adb reverse tcp:8080 tcp:8080` 후 `localhost` 유지.
- baseURL은 `BASE_URL`만 설정하고 endpoint는 `'/api/...'` 풀패스로 호출 → `isPublicPath`가 `/api/auth` 등 풀프리픽스와 매칭.

### 타입 코드젠 (openapi-typescript)
```bash
npx openapi-typescript docs/openapi.json -o src/api/schema.d.ts
```
- 성공 DTO/enum만 생성됩니다. **에러 envelope(ErrorResponse/FieldError)는 스펙에 없으므로** `src/lib/errors/types.ts`에서 수기로 소유합니다.
- `src/api/types.ts`가 `schema.d.ts`의 `components['schemas'][...]`를 좁혀 별칭 + enum 문자열 유니온을 export.

---

## 4. 인증 & 토큰 생애주기

### 저장 전략
- **access(1h)**: `tokenStore` 모듈 싱글톤 변수(메모리). request 인터셉터가 동기 읽기. 콜드스타트 시 소멸(의도된 동작 — refresh로 재발급).
- **refresh(14d, 회전/단일사용)**: `expo-secure-store`에만. 회전이므로 재사용 시 401.

### 상태 머신
`status: 'loading' | 'authenticated' | 'unauthenticated'`. `'loading'` 동안 네이티브 스플래시 유지(가드가 settled 되기 전 화면 깜빡임 방지).

### 부트스트랩 (콜드스타트)
```
앱 시작
 └ AuthProvider mount → getRefreshToken()
     ├ 없음 → status='unauthenticated'
     └ 있음 → fetchMe() (GET /api/users/me)
         └ access 없음 → 401 → 응답 인터셉터가 단일비행 refresh → 재발급 → 재시도
             ├ 성공 → setUser(me); status='authenticated'
             └ refresh 실패(401) → clearTokens(); status='unauthenticated'
```
> 부트스트랩은 인터셉터의 single-flight를 그대로 이용(콜드스타트 첫 `/users/me` 401 → refresh → 재시도). 별도 사전-refresh를 두지 않아 단일 경로를 유지.

### 단일비행(single-flight) refresh — 시퀀스
```
요청 A,B,C 동시 진행 중 access 만료
 ├ A 401(code UNAUTHORIZED|INVALID_TOKEN) → refreshOnce() 시작 (refreshPromise 생성)
 ├ B 401 → refreshOnce() : 진행 중 promise를 await (새 호출 X)
 ├ C 401 → refreshOnce() : 동일 promise await
 └ doRefresh(): axios.post(BASE_URL+'/api/auth/refresh') ← **bare axios**(인터셉터 우회)
     ├ 성공 → setTokens(회전된 쌍) → 새 access 반환
     │   └ A,B,C 각각 cfg._retried=true 태깅 후 새 토큰으로 1회 재시도
     └ 실패(회전/만료 401) → clearTokens(); authEvents.emit('logout')
         └ AuthProvider 리스너 → status='unauthenticated'; queryClient.clear()
            → 루트 Stack.Protected 가드가 (auth)로 리다이렉트
```
**불변식**: 앱 전체에서 `refreshPromise`는 **단 하나의 모듈 변수**(`src/api/client.ts`). refresh 호출 자체는 bare axios라 인터셉터를 타지 않음 → 무한루프 불가. 재시도 요청은 `_retried` 태깅 → 2차 refresh 방지.

### 역할 & 가드
- `Role = READER | CREATOR | ADMIN` (단일·비누적). `isCreator`/`isAdmin` 헬퍼.
- 클라이언트 가드는 UX 용도일 뿐 **보안 아님**(서버가 owner 재검증).
- 라우트 보호는 **루트 `_layout.tsx`의 `Stack.Protected guard={...}`** 로 단일 결정 트리(verified 패턴). 화면마다 `<Redirect>` 흩뿌리지 않음.

### 연령 게이트
- `isAdult(birthDate)` = `birthDate <= 오늘-19년`. null/누락 ⇒ **미성년(보수적)**. 매 호출 `new Date()`로 평가(자정 경계 재계산).
- `ADULT_ONLY(403)`은 **인증 인터셉터가 처리하지 않음**(refresh/logout 트리거 금지). feature/query 레이어에서 `code==='ADULT_ONLY'`로 분기 → 시리즈 카드는 유지, 에피소드 목록/상세만 차단 UI.

### 회원가입 강제 규칙
- nickname `^[A-Za-z0-9가-힣_]{1,20}$`, password 8~64, birthDate 필수 & 만 14세 이상, 필수 동의 `TERMS_OF_SERVICE`+`PRIVACY_POLICY`(MARKETING_EMAIL/ADULT_CONTENT_19 옵션).
- 서버 409 `DUPLICATE_EMAIL`/`DUPLICATE_NICKNAME` 및 400 `fieldErrors[]`를 해당 폼 필드로 매핑.

---

## 5. 데이터 레이어 (TanStack Query v5)

### QueryClient 기본값 (`src/lib/query/queryClient.ts`)
- `staleTime`: 목록/상세 60s, 정적 enum 5min, 미읽음 카운트 0(폴링 구동). `gcTime` 5min.
- `refetchOnWindowFocus: false`(RN), `refetchOnReconnect: true`.
- **retry 술어**: `AppError`이고 `!isNetwork && status < 500`이면 재시도 안 함(4xx 비재시도). 그 외(network/5xx) 최대 2회 지수백오프(1s,2s, cap 8s). 401은 인터셉터가 처리하므로 Query는 재시도 안 함. mutations 기본 `retry:false`.
- **throwOnError 통합 정책**: `(error) => { const e = normalizeError(error); return isFatal(e) && resolveError(e).kind !== 'silent'; }` — 치명적이고 silent가 아닌 경우에만 바운더리로 throw. 복구가능/필드/silent 에러는 인라인 ErrorState·폼·무처리로 surfaced.
- 전역 `QueryCache.onError`/`MutationCache.onError`: 카탈로그로 라우팅(generic→토스트, silent→무시).

### 쿼리키 팩토리 (`src/lib/query/keys.ts`)
계층형·파라미터 내장 키. 예: `keys.series.list(params)` / `keys.series.detail(id)` / `keys.episodes.list(seriesId)` / `keys.episodes.detail(seriesId,no)` / `keys.notifications.unreadCount()` / `keys.me.subscriptions()`. 헤드 세그먼트(`['series']`)로 광역 invalidate.

### Page vs Slice 무한쿼리 (`src/lib/query/infinite.ts`)
- **Page**(목록/댓글/활동): `getNextPageParam = last ? undefined : page+1`. `PageResponse{content,page,size,totalElements,totalPages,last}`.
- **Slice**(에피소드 목록 전용): `getNextPageParam = hasNext ? page+1 : undefined`. `SliceResponse{content,page,size,hasNext}`.
- 둘 다 `initialPageParam: 0`. `flattenInfinite(data, keyOf?)`로 평탄화 + Slice 중복 방지 de-dupe.
- **fixed-sort 가드**(`src/api/paging.ts`): `buildFixedSortParams`는 `sort`가 들어오면 `__DEV__`에서 throw/strip → fixed-sort 목록(에피소드/구독/북마크/읽기기록/내 활동/알림)에 `?sort=` 절대 미전송.

### 낙관적 토글 (`src/lib/query/mutations.ts`)
`createToggleMutation` 팩토리: `onMutate`(cancelQueries+snapshot+낙관적 patch) → `onError`(snapshot 롤백) → `onSettled`(invalidate). 토글 엔드포인트는 201/204 무바디이므로 상태는 **detail 캐시**에 patch.
- 구독: `SeriesDetailResponse.isSubscribed` patch (목록 DTO엔 필드 없음).
- 에피소드 좋아요: `EpisodeDetailResponse.liked` + `likeCount ±1`.
- **post 좋아요는 200+바디** → `usePostLike`는 `onSuccess`에서 `PostDetailResponse.liked/likeCount`를 권위값으로 reconcile(목록 `PostResponse`엔 liked 없음).

### 폴링
미읽음 카운트: `refetchInterval`(예 30s) + `refetchIntervalInBackground:false`, `enabled = isAuthenticated && appActive`(배터리/401 루프 방지).

### 멀티파트 업로드 (`src/api/multipart.ts`)
스칼라(title/content/category/publishAt/type)는 **쿼리 파라미터**, 바이너리(images[]/file)만 FormData 바디(openapi 기준). RN file part `{uri,name,type}`. `onUploadProgress` 진행률 + `AbortController` 취소. `INVALID_IMAGE(400)`→필드 에러.

### 이미지 (`src/api/image.ts` + `ui` AppImage)
`resolveImageUrl(url)=절대URL이면 그대로, 아니면 ${BASE_URL}${url}`. `/files/**`는 공개이므로 **Authorization 미부착**. expo-image `cachePolicy='memory-disk'` + `recyclingKey`(리스트/뷰어 페이지 재활용 시 stale frame 방지).

---

## 6. 에러 처리 & 바운더리

### 단일 AppError (`src/lib/errors/types.ts`)
`Error`를 상속한 **클래스**(throw 후 boundary/Query에서 instanceof 가능):
`AppError { status:number; code:AppErrorCode; fieldErrors:FieldError[]; isNetwork:boolean; isTimeout:boolean; raw?:unknown }`.
`AppErrorCode = INVALID_INPUT|ENTITY_NOT_FOUND|DUPLICATE_EMAIL|DUPLICATE_NICKNAME|INVALID_CREDENTIALS|UNAUTHORIZED|INVALID_TOKEN|FORBIDDEN|ADULT_ONLY|INVALID_IMAGE|UNKNOWN`.
**네트워크는 코드가 아니라 플래그**(`isNetwork=true`, `status=0`). 타임아웃은 `isTimeout`.

### normalizeError — 단일 choke point (`src/lib/errors/normalizeError.ts`)
모든 throw 값 → `AppError`. axios 에러(바디의 `code`/`message`/`fieldErrors` 파싱), 무응답(network/timeout), 비-axios throwable(UNKNOWN) 처리. **절대 throw하지 않음**. 알 수 없는 서버 코드는 `UNKNOWN`.

### code → 처리 맵 (`src/lib/errors/errorCatalog.ts`)
`resolveError(e) → { kind, recoverable, retryable, title, message }`.
| code | kind | 처리 |
|---|---|---|
| UNAUTHORIZED / INVALID_TOKEN | `silent` | 인증 레이어 소유, UI 무노출(refresh 실패 시에만 logout 토스트) |
| FORBIDDEN / ADULT_ONLY | `blocked` | 비복구·비재시도, 연령/권한 차단 UI(시리즈 카드는 유지) |
| ENTITY_NOT_FOUND | `notFound` | not-found 상태(비재시도) |
| DUPLICATE_* / INVALID_INPUT | `fieldErrors` | 폼 필드로 매핑 |
| INVALID_IMAGE | `upload` | 업로드 필드 인라인 에러 |
| network/timeout/UNKNOWN | `generic` | 토스트/ErrorState, network·timeout은 retryable |

한국어 카피는 `messages.ts`에 집약("무엇이/어떻게 고치는지", 모호 금지). 서버 메시지가 안전하면 우선.

### 바운더리 3계층 (expo-router v56 verified)
1. **라우트 레벨**: 임의 라우트/레이아웃 파일에서 **named export** `ErrorBoundary({error, retry}: ErrorBoundaryProps)`(default 아님). `retry`는 `() => Promise<void>`. 세그먼트 단위로 캐치.
2. **전역 루트**: `src/app/_layout.tsx`에서 동일 `ErrorBoundary` named export → 하위 모든 라우트의 미처리 에러 최종 캐치.
3. **렌더 크래시 최후방어**: 프로바이더 트리 바깥을 감싸는 `GlobalErrorBoundary`(class, `getDerivedStateFromError`) → 리로드 제공.

모든 바운더리는 `QueryErrorResetBoundary`로 감싸고 retry 시 `reset()`을 먼저 호출(throwOnError로 throw된 쿼리를 재요청 가능 상태로 되돌림 — 안 하면 retry가 즉시 재캐치).

### Suspense & 상태 컴포넌트
패턴: `<FeatureErrorBoundary><Suspense fallback={<Skeleton/>}>…</Suspense></FeatureErrorBoundary>`(바운더리가 Suspense 바깥).
인라인 상태: `ErrorState`(retry), `EmptyState`, `Skeleton`/`LoadingState` — 모두 `ui` 프리미티브 재사용(한국어 카피).

### 토스트 & 폼 fieldErrors
- 토스트: `ToastProvider` + `useToast()`(컴포넌트) + 모듈 싱글톤 `toast.*`(인터셉터/전역 onError 같은 비-React 코드용, 마운트 전 호출 버퍼링). dedup(code+message 짧은 윈도우)로 retry storm 방지.
- 폼: `fieldErrorsToFormErrors(error, setError)` / `fieldErrorsToMap(error)`. `DUPLICATE_NICKNAME` 등 `fieldErrors`가 비어도 카탈로그 메시지로 해당 필드 합성. 모르는 필드는 form-level 루트 에러로 수렴.

---

## 7. 네비게이션 & 앱 셸

### 라우트 그룹 (정본)
- `(auth)`: 비인증 영역(sign-in 등). `(app)`: 인증 영역으로 `(tabs)`와 (후속) `(viewer)`를 포함.
- 그룹 폴더는 URL 세그먼트를 만들지 않음. 두 그룹에 동일 라우트명 충돌 금지.

### 보호 라우팅 (Stack.Protected — verified)
루트 `_layout.tsx`에서 **단일 결정 트리**:
```tsx
const { status } = useAuth();
// fonts/auth 게이트 통과 전엔 null 반환(스플래시 유지)
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Protected guard={status === 'authenticated'}>
    <Stack.Screen name="(app)" />
  </Stack.Protected>
  <Stack.Protected guard={status === 'unauthenticated'}>
    <Stack.Screen name="(auth)" />
  </Stack.Protected>
  <Stack.Screen name="+not-found" />
</Stack>
```
- `guard`는 반드시 실제 boolean. 로그인 직후 수동 navigate 대신 **가드가 뒤집히게** 둔다(expo #30700 레이스 회피).
- **`unstable_settings` 미export**(빈 객체라도 deep-link 깨짐 이슈 #818). 필요 시에만 `initialRouteName` 도입.
- 크리에이터/관리자 전용 하위는 `useRequireRole`로 추가 가드.

### 프로바이더 순서 (정본, `src/app/_layout.tsx`)
```
GlobalErrorBoundary
 └ SafeAreaProvider
    └ NetworkProvider            (단일 NetInfo → onlineManager + 배너 컨텍스트)
       └ QueryProvider           (QueryClientProvider; AuthProvider가 useQueryClient 필요 → 위에)
          └ ToastProvider        (AuthProvider logout 토스트가 필요 → 위에)
             └ AuthProvider      (status/user/role)
                └ ThemeProvider  (ui useTheme/색상 스킴)
                   └ Stack + <OfflineBanner/>
```
근거: AuthProvider는 `useQueryClient`(QueryProvider 상위)·logout 토스트(ToastProvider 상위)가 필요. GlobalErrorBoundary는 프로바이더 크래시까지 잡도록 최외곽.

### 스플래시 & 폰트 게이트 (verified)
- `SplashScreen.preventAutoHideAsync()`를 **모듈 스코프**에서 호출. `setOptions({duration:300, fade:true})`.
- `useFonts({ Pretendard })` + `useAuth().status`. `ready = (fontsLoaded || fontError) && status !== 'loading'`.
- `if (!ready) return null;`(스피너 아님 — 네이티브 스플래시 유지). `useEffect(()=>{ if(ready) SplashScreen.hideAsync(); },[ready])`. `fontError`도 게이트해 폰트 누락 데드락 방지.

### 탭
`(app)/(tabs)/_layout.tsx`의 `Tabs`. 참조 스캐폴드는 홈 탭 1개(`index.tsx` = 시리즈 목록 참조 화면)로 배선 검증.

### 딥링크 매핑
- scheme `apptoon://`(app.json). `+not-found.tsx`가 미매칭 URL 캐치.
- 알림 라우팅: `(targetType,targetId) → href` resolver. `targetType ∈ {SERIES,EPISODE,INQUIRY,POST,COMMENT,USER}`이며 **UNKNOWN 센티넬 없음** → 미지원 타입은 default 분기에서 no-op/토스트(스테일 클라 안전). `PATCH /{id}/read`는 read+routing을 한 번에 반환.

### 뷰어
`(app)/(viewer)` 그룹은 후속(openIssue). 본 스캐폴드는 그룹 셸/배선만 정의하고 실제 뷰어 화면은 범위 외. 잠금 에피소드(200+locked)는 에러 아님 — countdown 렌더, markRead 미호출.

---

## 8. 엣지 케이스 대응 표

| 도메인 | 케이스 | 처리 |
|---|---|---|
| 인증 | access 만료로 동시 401 다발 | 단일비행: 첫 401이 refreshPromise 생성, 나머지는 await 후 새 토큰으로 재시도 |
| 인증 | refresh 자체 401(회전 재사용/만료) | 재시도 안 함. clearTokens→`logout` emit→status unauthenticated→가드 리다이렉트 |
| 인증 | 재시도 요청이 다시 401 | `_retried` 태깅으로 무시·reject(루프 방지) |
| 인증 | 콜드스타트 refresh 없음/만료 | 없으면 즉시 unauthenticated; 만료는 부트스트랩 refresh 401→unauthenticated |
| 로그인 | INVALID_CREDENTIALS(401) | refresh/logout 트리거 X. 로그인 폼에 일반 메시지 |
| 가입 | nickname 규칙 위반/중복(409) | 클라 `NICKNAME_RE` 선차단 + 서버 fieldErrors/409를 nickname 필드로 매핑 |
| 가입 | birthDate 누락/<14/미래 | 클라 차단(만 14세·과거). 누락은 가입 자체 불가 |
| 가입 | 필수 동의 누락 | TERMS_OF_SERVICE+PRIVACY_POLICY 미동의 시 제출 차단 |
| 시리즈 | 빈 목록/검색 0건 | content=[] → 전용 EmptyState(스피너/에러 아님) |
| 시리즈 | fixed-sort에 ?sort= 실수 | buildFixedSortParams가 strip/throw → 서버 미전송 |
| 시리즈 | 비공개/미발행 상세(비소유자) | 404 ENTITY_NOT_FOUND → not-found 화면(존재 은닉) |
| 에피소드 | 잠금(200, locked:true, freeAt, images:[]) | 에러 아님. countdown 렌더, markRead 미호출, viewCount 미표시 |
| 에피소드 | freeAt 도달(화면 열린 채) | now≥freeAt 시 상세 재요청해 이미지 로드 |
| 에피소드 | 작성자/관리자 미리보기 | 서버가 unlocked 반환 → 그대로 렌더 |
| 연령 | 미성년이 19+ 목록/상세 | 403 ADULT_ONLY → blocked UI, 시리즈 카드는 유지, 비재시도 |
| 연령 | birthDate 누락 | isAdult=false(미성년) |
| 개인화 | 빠른 더블탭 토글 | 낙관적 set + 최종 의도 전송(idempotent). 실패 시 snapshot 롤백 |
| 개인화 | 잠금 에피소드 markRead | locked면 호출 억제(continue-reading 오염 방지) |
| 개인화 | 본인 팔로우 | 본인 프로필에선 팔로우 컨트롤 숨김/비활성 |
| 라이브러리 | UP 배지 | SubscriptionResponse.up / lastReadEpisodeNo↔latestEpisodeNo |
| 커뮤니티 | 공개 목록 blinded | PostResponse엔 blinded 필드 없음(서버가 제외) → 그대로 렌더 |
| 커뮤니티 | 내 활동 blinded | MyPostResponse.blinded 등 → blinded 배지+dimmed |
| 댓글 | 재귀 nested replies | 클라에서 1-depth로 평탄화(2단계만 렌더) |
| 알림 | 미지의 targetType | default 분기 no-op/토스트(크래시 방지) |
| 네트워크 | NetInfo connected인데 ERR_NETWORK | AppError.isNetwork=true → network 카피+retry(배너와 독립) |
| 네트워크 | 타임아웃 | isTimeout=true → timeout 카피, retryable |
| 네트워크 | 오프라인 | onlineManager가 offline → Query pause, 재연결 시 refetch. OfflineBanner 노출 |
| 업로드 | 사용자 취소/언마운트 | AbortController → Cancel은 정상 취소(에러 토스트 X) |
| 업로드 | INVALID_IMAGE(400) | 필드 인라인 에러 |
| 토스트 | 인터셉터가 마운트 전 토스트 | 모듈 싱글톤이 버퍼링 후 flush |
| 렌더 | 바운더리 밖 크래시 | GlobalErrorBoundary가 캐치·리로드 |
| 이미지 | url 절대/빈값 | 절대 URL 그대로, 빈값은 안전 fallback(`${BASE_URL}undefined` 방지) |

---

## 9. 디자인 토큰 & UI 컨셉 방향

> 기존 `src/ui/tokens.ts`/`theme.ts`가 정본. 새 토큰을 만들지 말고 재사용·확장.

### 팔레트 — "Inkwell & Ember"
- **Ember**(`ember500 #F2542D`): 브랜드/주요 액션 + **잠금 해제·countdown 순간**(차가운 타이머가 아닌 기대감).
- **Ink**(약간 따뜻한 중성 램프): chrome 표면/텍스트. dark chrome은 `ink800`(틴티드, 뷰어와 구분).
- **viewer**: dark에서 `trueBlack`(OLED, 아트가 표면으로 사라짐), light에선 paper white.
- **Slate**(쿨/차분): 잠금 상태("대기").
- 배지 전용색: `badge19`(빨강), `badgeUp`(초록), `badgeBest`(보라, 절제 사용).

### 타입
- 단일 가변 패밀리 **Pretendard**(Hangul+Latin 동일 메트릭)로 display/body 공용 — 위계는 size+weight로. fallback 체인 끝에 시스템 한국어 페이스.
- 모든 role에 넉넉한 lineHeight(본문 ≈1.5)로 Hangul 받침/ascender 보호. letterSpacing은 Hangul 0, ALL-CAPS Latin 배지만 +0.6.

### 스페이싱/라디우스
4pt 베이스(`space.xs…5xl`). 카드 `radius.lg`, 배지/칩 `radius.pill`, 뷰어 아트 `radius.none`(풀폭 bleed).

### 다크모드 & 뷰어
chrome 표면은 따뜻한 ink "갤러리 월", **뷰어만 true-black**. dark에서 card shadow는 flat으로 degrade(표면 명도로 분리). `viewerBg`를 `bg`와 분리한 것이 입장 시 프레임이 사라지는 핵심.

### 프리미티브 목록 (`src/ui/primitives` — 기존)
`Text, Screen/Box, Button, Card, Badge, Skeleton, EmptyState, ErrorState, Toast(+Provider), Divider, Avatar, CountdownPill`. 신규 `OfflineBanner`(components/feedback).

### 컨셉(요약)
AppToon은 "하나의 스킨을 입은 두 앱"입니다. 탐색/라이브러리/커뮤니티의 **CHROME**은 따뜻한 ink 위에 표지 아트가 포스터처럼 놓이는 갤러리 월 — 결코 납작한 회색 보이드가 아닙니다. 에피소드로 들어가는 순간 표면이 **VIEWER**의 true-black으로 전환되어 프레임이 사라지고 작품만 남습니다. 유일한 celebratory motion은 잠금 에피소드가 `freeAt`을 넘길 때 lock 칩이 ember "지금 무료" 펄스로 cross-fade되는 순간이며, 그 외 모든 모션은 조용합니다(스튜디오적 절제).

---

## 10. 접근성 & 성능 플로어

### 접근성
- **hit target ≥ 44pt**(`layout.minHitTarget`) — 모든 탭 가능 요소.
- **visible focus**: `focusRing`(ember) — 키보드/스위치 컨트롤.
- **reduced motion**: `useMotion()`/`isReduceMotionEnabled()`로 OS 플래그 감지 → `duration.instant(0)`으로 스왑(토스트/펄스 즉시화).
- 상태 컴포넌트에 `accessibilityRole`(ErrorState=`alert`), 한국어 라벨.

### 성능
- **이미지**: expo-image `cachePolicy='memory-disk'` + `recyclingKey`로 stale frame·메모리 누수 방지. `/files/**`는 공개 → 인증 헤더 없이 캐시 친화.
- **리스트**: 무한쿼리는 `isFetchingNextPage` 가드로 중복 fetch 차단, Slice는 de-dupe. 페이지 평탄화는 `flattenInfinite`로 1회.
- **reactCompiler 활성**: rules-of-hooks 엄수(무한쿼리 헬퍼는 그 자체가 훅 — 무조건 호출). Context value는 `useMemo`(컴파일러/소비자 churn 완화).
- **폴링**: 백그라운드/비인증 시 중단(배터리·401 루프).

---

## 11. 구현 순서 체크리스트

**A. 기반(병렬 가능)**
1. `config` — BASE_URL/API_BASE/FILES_URL.
2. `lib/errors` — AppError/normalizeError/errorCatalog/messages.
3. 코드젠 — `npx openapi-typescript docs/openapi.json -o src/api/schema.d.ts` → `api/types.ts` 별칭.
4. `api-core` — tokenStore, authEvents, client(인터셉터+단일비행 refresh), paging, multipart, image.
5. `data-layer` — queryClient/keys/infinite/mutations/QueryProvider.
6. `error-feedback` — providers(Network/GlobalErrorBoundary), OfflineBanner, forms/fieldErrors, FeatureErrorBoundary(ui 재사용).
7. `ui-tokens` — 기존 토큰/프리미티브 확인(이미 존재; AppImage만 추가).

**B. 인증**
8. `auth` — AuthContext/api/roles/validation/useRequireRole/index.

**C. 첫 화면 검증(배선 증명)**
9. `app-shell` — `_layout.tsx`(프로바이더 순서+스플래시/폰트 게이트+Stack.Protected+ErrorBoundary), `(auth)/sign-in.tsx`, `(app)/(tabs)/index.tsx`(시리즈 목록 참조), `+not-found.tsx`.
10. `features/series` — useSeriesList(무한)/useSeriesDetail/useSubscribeToggle.
11. 검증: tsc + lint, 로그인 플로우 + 시리즈 목록 무한스크롤 + 구독 낙관 토글 동작 확인.
