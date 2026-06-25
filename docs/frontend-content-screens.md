# AppToon 콘텐츠 화면 프레임워크 (Content-Screen Framework)

> 본 문서는 홈(요일별 그리드) → 시리즈 상세 → 회차 목록으로 이어지는 콘텐츠 탐색 화면의 **최종 합의 틀**이다.
> 7개 스펙 + Expo v56 검증 패턴 + 크리틱을 병합해 **파일 소유권 충돌·API 계약·관심/후원 시맨틱·라우트 네이밍**을 모두 해소했다.
> 구현자는 본 문서의 `contract[]`(파일별 고정 API)를 그대로 코딩한다. 본 문서와 충돌하는 개별 스펙 문구는 **무효**다.

---

## 1. 개요 (Overview)

AppToon의 콘텐츠 표면은 **Glass Stack**(표지 아트가 주인공, UI는 뒤로 물러남) 미학 위에 선다. 라이트/다크 + 반응형 + 기존 체계 틀(Screen 안전영역, 더블탭-세이프 Button, FeatureErrorBoundary>Suspense)을 그대로 따른다.

핵심 설계 원칙(크리틱이 못박은 SSOT):

- **하나의 day-state 출처**: 요일 상태는 홈 화면의 `useState<DayOfWeek>` 1개 (시드 = `todayDay()`). `use-weekday-axis.ts` 같은 별도 축 훅은 **만들지 않는다**(openapi에 status 파라미터가 없어 신작/완결 축이 서버 백킹 불가 → 미래 시드).
- **하나의 그리드 컬럼 규칙**: 컬럼 수 = `r.select({ phone: 2, tablet: 3, large: 3 })`. `coverWallColumns`(3/5/7, 로그인 아트월 전용)는 쓰지 않는다.
- **하나의 그리드 셀**: 이미 존재하는 `SeriesGridCard.tsx`가 유일한 포스터 셀. `CoverCell.tsx`는 **만들지 않는다**(삭제). 네비게이션은 부모가 `onPress`로 주입한다(셀이 자체 push하지 않음).
- **하나의 관심 결정**: `구독`(useSubscribeToggle, 실제 API) 과 `관심`(미래 시드, 준비 중 토스트)을 **별개**로 둔다. 관심을 구독에 합치지 않는다.
- **하나의 라우트 네이밍**: 상세 = `(app)/series/[id].tsx`, 뷰어(미래) = `(app)/series/[id]/[episodeNo].tsx`.
- **하나의 이어보기 출처**: read-history(`getReadHistory`/`keys.me.readHistory`)가 히어로 CTA와 회차 행 continue 마커 둘 다의 정본. `SubscriptionResponse.lastReadEpisodeNo`는 read-history가 이 시리즈를 못 잡았을 때의 **폴백**일 뿐.

검증된 DTO 현실(코딩 시 반드시 준수):

- `SeriesSummary` = `{ id?, title?, authorNickname?, genre?, status?, ageRating?, adultOnly?, visible? }` — **표지/썸네일·UP·lock 신호 없음**.
- `SeriesDetail` = 위 + `description?, episodeCount?, latestEpisodeNo?, isSubscribed?, publishDays?, releasePolicy?, tags?, waitFreeDays?, createdAt?` — `authorNickname`만 있음(**authorId·avatarUrl 없음** → 작가 탭 미래 시드).
- `EpisodeSummary` = `{ episodeNo?, title?, locked?, freeAt?, publishAt? }` — **thumbnail/viewCount/likeCount/lockReason 없음**. 절대 렌더하지 말 것.
- `SubscriptionResponse` = `{ seriesId?, title?, up?, lastReadEpisodeNo?, latestEpisodeNo? }`.
- `ReadHistoryResponse` = `{ seriesId?, lastReadEpisodeNo?, lastReadAt?, seriesTitle? }` — **latestEpisodeNo 없음**(클램프는 SeriesDetail.latestEpisodeNo로).
- `BookmarkResponse` = `{ seriesId?, episodeNo?, episodeTitle?, seriesTitle?, createdAt? }`.

---

## 2. 화면 지도 & 네비게이션 (라우트 트리)

본 워크플로의 **인-스코프**는 ① 홈(요일별 그리드) ② 시리즈 상세 ③ 회차 목록이다. Explore/Library/Viewer는 라우트 자리만 예약하고 본 문서에서 화면을 구현하지 않는다(아웃-오브-스코프, 시드만).

```
src/app/
  (auth)/ ...                         # 비인증 (기존)
  (app)/                              # 인증 가드 (Stack.Protected)
    _layout.tsx          [modify]     # series/[id] (+ series/[id]/[episodeNo] 시드) 등록
    (tabs)/
      _layout.tsx        [unchanged]  # 홈 + 내 정보 (Explore/Library 탭은 미래)
      index.tsx          [rewrite]    # ★ 홈: WeekdayTabs + SeriesGrid
      my.tsx             [unchanged]
    series/
      [id].tsx           [create]     # ★ 시리즈 상세 (탭바 위로 push)
      [id]/[episodeNo].tsx [future]   # 뷰어 (아웃-오브-스코프, 라우트 시드만)
```

### 네비게이션 척추 (Nav spine)

```
SeriesGridCard.onPress
  └─(부모 주입 guardedPush)→ /series/[id]            # 상세, 탭바 위 full-screen push
        ├─ 첫화/이어보기 CTA ─(guarded)→ /series/[id]/[episodeNo]   # 뷰어 (미래 stub)
        └─ EpisodeRow.onPress(unlocked) ─(guarded)→ /series/[id]/[episodeNo]
```

**Expo v56 typed-routes 규칙(검증)**:

- `typedRoutes: true`(app.json experiments) 활성 → 동적 라우트는 **객체 형태 필수**: `{ pathname: '/series/[id]', params: { id } }`. 베어 문자열 `"/series/[id]"`는 TS 에러.
- 상세 화면 파라미터: `const { id } = useLocalSearchParams<'/series/[id]'>();` — 제네릭에 **라우트 경로 문자열**을 넘긴다(인터페이스 아님). 런타임 값은 항상 `string | string[]` → `Number(id)`로 강제 변환·검증.
- `useGlobalSearchParams` 대신 `useLocalSearchParams`(백그라운드된 화면에 다른 화면 파라미터가 새지 않음).
- 본 프로젝트는 명령형 네비게이션을 **`guardedPush`/`useGuardedNavigation`**(500ms 더블탭 가드)로 통일. `guardedPush({ pathname: '/series/[id]', params: { id } })`.
- `Link.Trigger/Preview/Menu`(iOS 전용, SDK 54+/56 동작)는 **선택적 강화**일 뿐. Android/web에서 무시되므로 카드는 그 없이도 완전히 동작해야 한다. 본 1차 구현에서는 적용하지 않는다(미래 강화 노트).
- `[id].tsx` 추가 후 `expo-env.d.ts` 재생성을 위해 typecheck/build 1회 실행(이 파일은 git-ignore, 커밋 금지).

---

## 3. 홈 (요일별 그리드)

`(app)/(tabs)/index.tsx`를 **재작성**한다(기존 vertical list 폐기). 두 영역:

1. **WeekdayTabs 밴드**(상단 고정, FlatList 바깥 — 스티키): 월~일 7개 칩, 기본 = `todayofMon-first` 오늘. `value`/`onChange` 컨트롤드.
2. **SeriesGrid**(본문): 반응형 2/3열 포스터 그리드, 무한 스크롤.

### day 필터 = 실제 백엔드 계약

`GET /api/series`는 `day`(MONDAY..SUNDAY) + `sort`(LATEST|ADULT_FIRST)를 받는다(openapi 확인). 따라서:

- `SeriesListParams`에 `day?: DayOfWeek` 추가, `listSeries`로 전달.
- `keys.series.list({ sort, genre, keyword, day })`의 `normalizeParams`가 임의 필드를 정규화 → **요일마다 별도 캐시 엔트리 자동 생성**(keys.ts 수정 불필요).
- 요일 전환: 새 키 → React Query가 해당 요일 캐시로 스왑(첫 방문 skeleton, 재방문 즉시). 수동 refetch 없음.

### 그리드 컬럼 & 셀 폭 (단일 규칙)

크리틱 해소: `numColumns`(페이징/리사이클)와 **부모-계산 셀 폭**(SeriesGridCard의 `width` prop)을 함께 쓴다.

```ts
const r = useResponsive();
const cols = r.select({ phone: 2, tablet: 3, large: 3 }) ?? 2;
// Screen 좌우 gutter를 뺀 콘텐츠 폭. r.width는 측정된 윈도 폭(Dimensions 아님).
const contentWidth = r.width - SCREEN_GUTTER * 2;
const { cellWidth } = seriesGridLayout(contentWidth, cols);   // SeriesGridCard가 export
// <SeriesGridCard width={cellWidth} ... />
// FlatList numColumns={cols} key={`grid-${cols}`}  ← 컬럼 변경(회전/split) 시 remount
```

- 셀은 자가 측정하지 않는다(부모가 `width` 주입). `numColumns`와 고정 폭 셀의 충돌은 `flex: 1/cols` 래퍼 대신 **명시적 `width`**로 통일.
- `columnWrapperStyle={ cols > 1 ? { gap: SERIES_GRID.gap } : undefined }`(numColumns===1이면 RN throw).

### Expo v56 FlatList + expo-image 그리드 성능 (검증)

- `keyExtractor={(s) => String(s.id)}` — 안정적 id(인덱스 폴백 금지, 페이징 리사이클 깨짐).
- `onEndReached` 가드: `if (hasNextPage && !isFetchingNextPage) void fetchNextPage()`; `onEndReachedThreshold={0.6}`.
- `pull-to-refresh`: `refreshing={isRefetching} onRefresh={refetch}`.
- expo-image(=AppImage)는 `recyclingKey={`series-${id}`}`로 리사이클 셀이 이전 표지를 깜빡이지 않게(이미 SeriesGridCard가 적용). `contentFit="cover"`, 2:3 `aspectRatio`.

### 셀에 없는 신호 (UP/lock/cover)

`SeriesSummary`엔 표지·UP·lock이 없다. 홈 그리드에서는:

- 표지: `coverUrl` 미전달 → SeriesGridCard의 결정적 틴트 플레이스홀더.
- 19 배지: `adultOnly || ageRating==='AGE_19'`에서 셀 내부 도출(카드는 미성년에게도 보임; 게이트는 뷰어).
- UP/lock: 홈에서는 **미전달**(미래 시드). UP/이어보기는 Library 표면에서만 실데이터(아웃-오브-스코프).

### 신작/완결/장르 축 (미래 시드)

openapi `GET /api/series`엔 `status` 파라미터가 **없다** → 신작/완결을 서버 필터할 수 없다. 무한 페이지 클라이언트 필터는 페이지네이션을 깨므로 금지. WeekdayTabs는 추가 칩 자리를 남기되, **오늘은 요일만** 라이브 축이다.

---

## 4. 시리즈 상세 (히어로/정보/액션바/회차/CTA)

`(app)/series/[id].tsx` 생성. `(app)` Stack의 형제로 두어 **탭바 위로 push**(몰입 히어로 + back). Screen(scroll) + FeatureErrorBoundary > Suspense 정본 쉘.

### 구성

```
SeriesHero        (표지 히어로 + 정보 패널)
SeriesActionBar   (구독 · 관심 · 정기후원 seam · 공유)
StatsRow          (episodeCount / latestEpisodeNo, SeriesDetail에서)
CTA row           (첫화 보기 / 이어보기  ← useResumePoint)
EpisodeList       (회차 목록, 인라인 마운트 — §5 소유)
```

### 히어로 (Glass Stack)

- 배경: `CoverWall`을 표지 없는(aurora) 모드로 깔고 그 위에 `GlassCard` 정보 패널. 표지 필드가 생기면 `covers={[coverUrl]}` + 히어로 AppImage `url={coverUrl}`만 바꾸면 됨(구조 불변).
- 정보: title, **작가 행(Avatar 이니셜 + nickname, 정적 — authorId/avatarUrl 없어 탭 불가; 미래 시드 주석)**, genre + tags(가로 ScrollView 클램프), status 배지(ONGOING 연재중/COMPLETED 완결/HIATUS 휴재), 19 배지(adultOnly), releasePolicy==='WAIT_FREE' → '기다리면무료' 칩, description(없으면 블록 전체 숨김, 더보기/접기).

### 액션바 — 관심/구독/후원 시맨틱 (못박음)

| 버튼 | 동작 | 출처 |
|---|---|---|
| **구독** | 실제 `useSubscribeToggle(seriesId)` 낙관 토글. label = `isSubscribed ? '구독중' : '구독'`. | `POST/DELETE /api/series/{id}/subscription` |
| **관심** | **미래 시드** — `준비 중` 토스트. 시리즈-레벨 관심 엔드포인트 없음. 구독에 합치지 않음(구독=UP/이어보기 피드, 관심=수동 저장, 별개 의도). | 없음 (1줄 스왑 시드) |
| **정기 후원/멤버십** | **미래 시드** — `SupportButton`(§6) 준비 중 토스트/시트. | 없음 (EpisodeAccessEvaluator 주입점) |
| 공유 | `RN Share.share` + `apptoon://` 딥링크(백엔드 불필요). | 로컬 |

> 구독은 Button의 `useAsyncPress`로 더블탭-세이프. `toggle.mutate(!isSubscribed)`. `isSubscribed`는 `useSeriesDetail` 캐시를 읽음(낙관 patch가 같은 캐시를 갱신).

### 첫화/이어보기 CTA

`useResumePoint(seriesId)`(§7, read-history 기반):

- read-history에 이 시리즈 항목 있음 → `이어보기 {min(lastReadEpisodeNo+1, latestEpisodeNo)}화` (latest는 **SeriesDetail.latestEpisodeNo**로 클램프).
- 없음/로딩 중 → `첫화 보기`(no=1, 안전 기본).
- `episodeCount===0` → CTA 비활성(공개 회차 없음).
- 둘 다 `guardedPush({ pathname: '/series/[id]/[episodeNo]', params: { id, episodeNo } })`(뷰어 미래 stub).

### Stack 헤더 결정 (Expo v56, 검증)

상세는 아트-주도 풀블리드 히어로 + Screen이 top-inset을 소유 → **네이티브 라지타이틀 헤더를 쓰지 않는다**. `_layout.tsx`에 `<Stack.Screen name="series/[id]" options={{ headerShown: false }} />`. 히어로가 자체 back 어포던스를 가짐. (텍스트 위주 페이지에서 추후 헤더가 필요하면 `headerTransparent` floating 헤더를 쓰되, Screen 패딩 래핑과 `contentInsetAdjustmentBehavior` 충돌에 주의.)

---

## 5. 회차 목록 & 행 (Episode List & Row)

3개 신규 파일: `episode-hooks.ts`, `EpisodeRow.tsx`, `EpisodeList.tsx`. 데이터 응집을 위해 에피소드 훅은 `hooks.ts`가 아니라 **`episode-hooks.ts`** 소유(크리틱 해소).

### useEpisodeList — OPTIONS 빌더 (hooks.ts 패턴 미러)

```ts
export function useEpisodeList(seriesId: number) {
  return createSliceInfiniteQuery({
    queryKey: keys.episodes.list(seriesId),
    fetchPage: (page, signal) => listEpisodes(seriesId, page, signal), // (seriesId, page, signal) 위치인자
    enabled: Number.isFinite(seriesId) && seriesId > 0,
  });
}
// 소비: const q = useInfiniteQuery(useEpisodeList(seriesId));
//       const eps = flattenInfinite(q.data, e => e.episodeNo!);  // 꼬리 중복 de-dupe
```

- `listEpisodes`는 fixed-sort(`buildFixedSortParams`, sort 미전송). **?sort 절대 전송 금지**(DEV throw).
- 1↔N 정렬 토글 = **로드된 페이지 클라이언트 reverse**(쿼리키/요청 불변). 캐비엇: 무한 스크롤에서 oldest-first는 전 페이지 로드 전까진 근사.

### 회차 행 (EpisodeRow) — 순수 프레젠테이션

`EpisodeSummary`엔 thumbnail/viewCount/likeCount/lockReason **없음** → 렌더 금지. 행 구성:

- `${episodeNo}화` + title(numberOfLines 1), publishAt 상대시간('3일 전').
- locked → `Badge variant="lock"` + `CountdownPill remainingMs={...}`(부모 단일 클락이 `remainingFromFreeAt(freeAt, now)` 주입 — 행마다 타이머 금지).
- 읽음 표시: `isRead`(점/체크), `isContinue`(이어보기 칩) — read-history에서.
- 북마크 토글: 에피소드-스코프(`POST/DELETE /api/series/{id}/episodes/{no}/bookmark`), `useAsyncPress`로 더블탭-세이프.

### 회차 컨테이너 (EpisodeList)

- 단일 `now` 클락(`useState`+`setInterval(1000)`, locked 행 있을 때만).
- locked 행 탭 → **네비게이션 금지** + 카운트다운/토스트(읽음 처리도 금지).
- unlocked 행 탭 → guarded `guardedPush(.../[episodeNo])`(뷰어 미래 stub).
- 상태: isLoading→Skeleton, isError→ErrorState(`ADULT_ONLY`/`ENTITY_NOT_FOUND` via `isAppError`), empty→EmptyState('아직 공개된 회차가 없어요'), 슬라이스 끝→푸터 스피너 없음.
- 19+ 미성년 403 = `ADULT_ONLY` → 리스트 영역만 게이트, 히어로/카드는 유지.

---

## 6. 정기후원 / 멤버십 미래 시드 (통합 지점)

`sponsorship.ts`(순수 로직, RN import 0) + `SupportButton.tsx`(Glass 버튼 + Modal 설명 시트). **소셜 로그인 시드(auth/social.ts)를 1:1 미러**한다.

- 백엔드 현실: 멤버십/코인/후원/결제/엔타이틀먼트 **엔드포인트 없음**. 유일한 수익화 = wait-free 타임락. 가짜 백엔드 금지.
- `준비 중` 상태 = 타입드 `AppError`(code `'UNKNOWN'` + `raw` 태그 `series.membership.notReady` + `isMembershipNotReadyError` 가드 + `MEMBERSHIP_NOT_READY_MESSAGE`). `AppErrorCode` 닫힌 유니온은 건드리지 않음.
- 엔트리: `startMembership(seriesId): Promise<Membership>` / `openSupport(seriesId, kind): Promise<void>` — 시그니처는 **이미 프로덕션 형태**지만 오늘은 NotReady throw. UI가 잡아 calm neutral 토스트.
- **통합 지점**: `coversEpisode(entitlement, series, episode): boolean` — 오늘 항상 false(→ 기존 wait-free 락으로 fall through). 미래 `EpisodeAccessEvaluator`가 `freeAt` 체크 **이전에** 이 함수를 호출하면, 멤버는 락 렌더 변경 없이 회차가 열림(roadmap §3.6 주입점 ①의 프론트 미러).
- 배치: 상세 액션바에서 구독 + wait-free 카운트다운 **옆**("멤버가 되면 기다리지 않고 바로 보기").
- 미래 쿼리키 `keys.me.memberships()`는 **지금 추가하지 않음**(YAGNI, sponsorship.ts에 WIRING 주석으로 표기).

---

## 7. 그리드/카드 비주얼 (Glass Stack, 라이트/다크, 반응형)

`SeriesGridCard.tsx`는 **이미 존재**(소유: grid-card 모듈). 본 프레임워크는 이를 정본 셀로 채택하고 신규 셀을 만들지 않는다.

- **2:3 포스터가 주인공**: 틴트 박스 위 AppImage absolute-fill. 표지 없으면 결정적 per-id 틴트(라이트/다크 팔레트). title(callout/semibold, 1~2줄) + author(caption/secondary) **아래**. 측면 구독 버튼 없음.
- 배지: 19(좌상) · UP(우상, 부모 isUp) · lock/카운트다운(하단, 부모 locked/remainingMs) — 코너 분리로 충돌 방지.
- 메트릭 export: `POSTER_ASPECT=2/3`, `SERIES_GRID_COLUMNS={phone:2,tablet:3,large:3}`, `SERIES_GRID={gap:12,posterRadius:'lg',badgeInset:8,textGap:8}`, `seriesGridLayout(contentWidth, columns, gap?) → {cellWidth, posterHeight, columns}`.
- `SeriesGridCardSkeleton({ width })`: 동일 footprint로 로딩→로드 reflow 방지.
- 라이트/다크: 전부 `useTheme()` 역할 토큰(`radius.lg`, `surfaceSunken`, typography). 원시 토큰/새 토큰 시스템 도입 금지.
- 반응형: 셀은 부모 `width` 주입(자가 측정 안 함) → FlatList 행/wrap 그리드에서 동일 렌더.

---

## 8. 데이터 레이어 (훅 · 쿼리키 · 낙관 · 무효화)

| 훅 | 파일 | 종류 | 반환 |
|---|---|---|---|
| `useSeriesList(params)` | hooks.ts (수정) | Page 무한 OPTIONS | `createPageInfiniteQuery` 옵션 (소비부가 useInfiniteQuery) |
| `useSeriesDetail(id)` | hooks.ts (기존) | 단건 useQuery | **쿼리 결과 직접 반환**(옵션 아님) |
| `useSubscribeToggle(id)` | hooks.ts (기존) | 낙관 토글 | mutation |
| `useResumePoint(id)` | hooks.ts (수정/추가) | read-history 셀렉터 | `{ mode:'first'\|'resume', episodeNo }` |
| `useEpisodeList(id)` | episode-hooks.ts (생성) | Slice 무한 OPTIONS | `createSliceInfiniteQuery` 옵션 |
| `useEpisodeBookmarkToggle(id,no)` | episode-hooks.ts (생성) | 낙관 토글 | mutation |
| `useReadHistory()` / `useReadState(id)` | episode-hooks.ts (생성) | read-history Page/셀렉터 | 쿼리/파생 |

**비대칭 주의**(크리틱): `useSeriesDetail`은 useQuery 결과를 **직접** 반환. `useSeriesList`/`useEpisodeList`만 OPTIONS 팩토리 → `useInfiniteQuery(...)`로 소비.

**쿼리키**: `keys.ts`는 **수정 불필요**. `keys.series.list`의 `normalizeParams`가 `day`를 포함한 임의 필드를 흡수. `keys.episodes.list(seriesId)`, `keys.me.{subscriptions,bookmarks,readHistory}`는 그대로.

**낙관/무효화**: 구독 토글은 `keys.series.detail(id)` patch + `keys.me.subscriptions()` invalidate(기존). 북마크 토글은 detail 캐시가 없으므로 plain optimistic + `onSettled`에서 `keys.me.bookmarks()` invalidate.

---

## 9. 엣지 케이스 표

| 케이스 | 처리 |
|---|---|
| **연령 게이트** (19+ 미성년) | 시리즈 카드/히어로는 보임(detail 200). 게이트는 **뷰어/회차 리스트**: 403 `ADULT_ONLY` → `ErrorState code='ADULT_ONLY'`(재시도 없음). 19 배지가 신호. |
| **잠금** (wait-free) | 회차 detail = 200 + `locked:true` + `freeAt` + `images:[]`. `CountdownPill` 렌더, **markRead 호출 금지**. 락은 에러 아님. |
| **빈 상태** (요일별 빈 결과) | fetch 성공 + length 0 → 요일별 EmptyState('이 요일 작품이 아직 없어요'). 로딩(Skeleton)과 구분. |
| **404** (삭제/비공개 비소유자) | `getSeries` 404 → AppError `ENTITY_NOT_FOUND` → `ErrorState code='ENTITY_NOT_FOUND'` + 홈으로 CTA. detail이 200인데 `visible===false`여도 동일 not-found. |
| **잘못된 [id]** | `Number(id)`; `Number.isFinite && >0` 가드 후에만 쿼리. invalid → not-found, 헛 요청 없음(`useSeriesDetail` enabled 2차 가드). |
| **이어보기 타깃 없음** (비구독자) | read-history 없음 → `첫화 보기`(no=1). 있으면 `이어보기(min(last+1, latest))`. latest = SeriesDetail.latestEpisodeNo. |
| **이어보기 화 잠김/초과** | CTA는 episodeNo만 전달; 락 판정은 뷰어 단일 소유. `last > latest`면 뷰어가 not-found 처리. |
| **표지 없음** (현 DTO) | SeriesGridCard 틴트 플레이스홀더 + 히어로 CoverWall aurora. `coverUrl` 미래 시드. |
| **컬럼 변경** (회전/split) | `r.select` 재계산 + FlatList `key={`grid-${cols}`}` remount. `columnWrapperStyle`는 cols>1일 때만. |
| **더블탭** | 데이터 셀/행 = `guardedPush`(500ms 가드). Button = `useAsyncPress` 내장. |
| **정기후원/멤버십** | 엔드포인트 없음 → SupportButton 준비 중 토스트. `coversEpisode` 시드가 미래 락 평가 주입점. |
| **fixed-sort에 ?sort** | `/api/series`만 sort 허용. episodes/me/* = `buildFixedSortParams`(strip + DEV throw). |

---

## 10. 구현 순서 & 파일 소유권

각 파일은 **정확히 한 모듈**이 소유(크리틱 강제). 병렬 안전.

| # | 모듈 | 파일 | 액션 | 의존 |
|---|---|---|---|---|
| 1 | **data-layer** | `series.ts`(endpoint), `hooks.ts`, `episode-hooks.ts` | modify, modify, create | 없음(루트) |
| 2 | **grid-card** | `SeriesGridCard.tsx` | (이미 존재 — 변경 없음/참조만) | 없음 |
| 3 | **home** | `(tabs)/index.tsx`, `WeekdayTabs.tsx` | rewrite, create | data-layer, grid-card |
| 4 | **detail** | `series/[id].tsx`, `SeriesHero.tsx`, `SeriesActionBar.tsx`, `(app)/_layout.tsx` | create×3, modify | data-layer, episode-list, monetization |
| 5 | **episode-list** | `EpisodeRow.tsx`, `EpisodeList.tsx`, `personalization.ts`(endpoint) | create, create, modify | data-layer |
| 6 | **monetization** | `sponsorship.ts`, `SupportButton.tsx` | create, create | 없음 |

**권장 순서**: 1(데이터) → 2(셀, 기존) → {3 홈, 5 회차, 6 후원} 병렬 → 4 상세(3·5·6 합류). `hooks.ts`는 1번 모듈이 단독 편집(day 추가 + useResumePoint). `(app)/_layout.tsx`는 4번 모듈이 단독 편집.

> **소유권 못박음 요약**: CoverCell/SeriesGrid(Spec1)·WeekdayStrip·use-weekday-axis = **폐기**. EpisodeList/Row = episode-list 모듈 단독. useEpisodeList = episode-hooks.ts 단독(hooks.ts 아님). day param = data-layer 단독(중복 적용 금지). 관심 = 별개 미래 시드.
