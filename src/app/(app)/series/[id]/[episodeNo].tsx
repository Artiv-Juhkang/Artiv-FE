/**
 * Episode viewer — 다매체 회차 리더.
 * ------------------------------------------------------------------
 * 회차 자산의 mediaKind(백엔드가 작품 타입으로 결정)에 따라 세 가지로 분기한다:
 *   IMAGE → 세로 스크롤 이미지 리더(웹툰, 아트 풀블리드)
 *   TEXT  → 소설 본문 리더(url의 텍스트 파일을 받아 렌더)
 *   AUDIO → 오디오 플레이어(재생/일시정지·탐색·시간, expo-audio)
 *
 * 리딩 표면은 Screen surface='viewer'(OLED 블랙 + 좌우 거터 0), 헤더는 transparent
 * (아트 위에 뜨는 흰 글리프 + 스크림 — 테마 무관). 열람 시 markRead(잠긴 회차 제외)로
 * 이어보기/서재를 갱신하고, 연재물은 이전/다음 화 이동을 제공한다(경계는
 * SeriesDetail.latestEpisodeNo). 잠김/빈 회차·연령 게이트(403)·에러를 각각 처리한다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getEpisode, markRead } from '@/api/endpoints/episodes';
import type { EpisodeDetail, EpisodeImage } from '@/api/types';
import { resolveImageUrl } from '@/api/image';
import { AudioReader } from '@/features/series/components/AudioReader';
import { useEpisodeLikeToggle } from '@/features/series/episode-hooks';
import { useSeriesDetail } from '@/features/series/hooks';
import {
  READER_FONT_SIZES,
  lineHeightFor,
  readingWidthFor,
  useReaderFontSize,
  type ReaderFontSize,
} from '@/features/series/reading-settings';
import { isAppError } from '@/lib/errors';
import { keys } from '@/lib/query';
import { guardedBackOr, guardedReplace } from '@/lib/navigation/useGuardedNavigation';
import {
  Button,
  EmptyState,
  ErrorState,
  GlassCard,
  HEADER_BAND_HEIGHT,
  Screen,
  Skeleton,
  Text,
  useReadingSurface,
  useTheme,
  type HeaderConfig,
  type Theme,
} from '@/ui';
import { AppImage } from '@/ui/AppImage';

/** Cast an SF-Symbol string to SymbolView's `name` prop (header-actions와 동일 패턴). */
type SymbolName = Parameters<typeof SymbolView>[0]['name'];

/** 리모컨이 스크롤 콘텐츠 꼬리를 영구히 가리지 않도록 하단에 확보하는 여백(px). */
const REMOTE_CLEARANCE = 96;

export default function EpisodeViewerScreen() {
  const { id, episodeNo } = useLocalSearchParams<{ id: string; episodeNo: string }>();
  const seriesId = Number(id);
  const no = Number(episodeNo);
  const valid = Number.isFinite(seriesId) && seriesId > 0 && Number.isFinite(no) && no > 0;

  const { data, isLoading, isError, error, refetch } = useQuery<EpisodeDetail>({
    queryKey: keys.episodes.detail(seriesId, no),
    queryFn: () => getEpisode(seriesId, no),
    enabled: valid,
    retry: false,
  });

  // 딥링크 콜드 스타트(알림·외부 링크로 뷰어가 첫 화면)에서는 되돌아갈 스택이 없다 —
  // 그때의 탈출구는 이 회차가 속한 작품 상세다.
  const backHref = { pathname: '/series/[id]', params: { id: seriesId } } as unknown as Href;
  const leaveViewer = () => guardedBackOr(backHref);

  // 연재 경계(이전/다음)용 최신 회차 번호. 상세 화면 캐시를 재사용(비블로킹).
  const { data: series } = useSeriesDetail(seriesId);

  const locked = data?.locked === true;
  const qc = useQueryClient();

  // 열람 기록 — 접근 가능(=잠김 아님)한 회차를 열면 멱등 POST. 성공 시 이어보기/서재 갱신.
  useEffect(() => {
    if (!valid || !data || locked) return;
    void markRead(seriesId, no).then(() => {
      void qc.invalidateQueries({ queryKey: keys.me.readHistory() });
    });
  }, [valid, data, locked, seriesId, no, qc]);

  const title = data?.title ?? (Number.isFinite(no) ? `${no}화` : '회차');
  // onBack을 넘기지 않으면 헤더 ‹는 기본 guardedBack이라 스택이 빈 콜드 스타트에서 무반응이다
  // (HeaderConfig.onBack 자체가 "deep-link first entry"용으로 설계돼 있는데 뷰어만 안 쓰고 있었다).
  const header: HeaderConfig = { variant: 'transparent', back: true, title, onBack: leaveViewer };

  if (!valid) {
    return (
      <Screen
        surface="viewer"
        center
        header={{ variant: 'transparent', back: true, title: '회차', onBack: () => guardedBackOr('/' as Href) }}
      >
        <Padded>
          {/* 경로 자체가 잘못돼 작품 상세로도 갈 수 없다 — 홈으로 내보낸다. */}
          <ErrorState code="ENTITY_NOT_FOUND" onRetry={() => guardedBackOr('/' as Href)} />
        </Padded>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen surface="viewer" header={header}>
        <View style={{ paddingTop: HEADER_BAND_HEIGHT }}>
          <ViewerSkeleton />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    const code = isAppError(error) ? error.code : 'UNKNOWN';
    // 19금 + 미성년 → ADULT_ONLY(403). 그 외는 매핑된 코드.
    return (
      <Screen surface="viewer" center header={header}>
        <Padded>
          {/* '다시 시도'는 실제로 다시 불러와야 한다 — 예전엔 뒤로가기라 라벨이 거짓말이었고,
              retry:false라 일시적 네트워크 오류에서 빠져나올 방법이 아예 없었다. 연령·부재처럼
              다시 시도해도 결과가 같은 코드만 화면을 떠나는 동작을 유지한다. */}
          <ErrorState
            code={code === 'ADULT_ONLY' ? 'ADULT_ONLY' : code === 'ENTITY_NOT_FOUND' ? 'ENTITY_NOT_FOUND' : 'UNKNOWN'}
            message={isAppError(error) ? error.message : undefined}
            onRetry={code === 'ADULT_ONLY' || code === 'ENTITY_NOT_FOUND' ? leaveViewer : () => void refetch()}
          />
        </Padded>
      </Screen>
    );
  }

  if (locked) {
    return (
      <Screen surface="viewer" center header={header}>
        <Padded>
          <LockedView freeAt={data.freeAt} onLeave={leaveViewer} />
        </Padded>
      </Screen>
    );
  }

  const images = (data.images ?? []).filter((im): im is EpisodeImage => !!im.url);
  if (images.length === 0) {
    return (
      <Screen surface="viewer" center header={header}>
        <Padded>
          <EmptyState title="아직 볼 내용이 없어요" description="이 회차에 등록된 콘텐츠가 없습니다." />
        </Padded>
      </Screen>
    );
  }

  return (
    <ViewerContent
      images={images}
      seriesId={seriesId}
      no={no}
      title={title}
      header={header}
      episode={data}
      latest={series?.latestEpisodeNo}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  뷰어 본문 + 플로팅 리모컨 — 리모컨 노출 상태·좋아요 토글·댓글 이동을 소유.      */
/* -------------------------------------------------------------------------- */

function ViewerContent({
  images,
  seriesId,
  no,
  title,
  header,
  episode,
  latest,
}: {
  images: EpisodeImage[];
  seriesId: number;
  no: number;
  title: string;
  header: HeaderConfig;
  episode: EpisodeDetail;
  latest?: number;
}) {
  const router = useRouter();
  const t = useTheme();
  const kind = images[0].mediaKind;
  const isScrolling = kind !== 'AUDIO';
  // transparent 헤더의 흰 글리프는 '헤더 뒤에 아트가 있다'는 전제인데, 그 전제가 성립하는 건
  // 전폭 이미지를 깔아주는 웹툰 리더뿐이다. 소설·오디오는 헤더 뒤가 그냥 viewerBg이고 라이트
  // 테마의 viewerBg는 흰색이라 흰 글리프가 통째로 사라진다 — 그래서 라이트에서는 solid로 바꿔
  // 테마 잉크를 쓴다. 다크에서는 원래의 아트-포워드 transparent 유지(solid 밴드가 트루블랙과
  // 안 맞아 seam이 생긴다).
  const artBehindHeader = kind === 'IMAGE';
  const readerHeader: HeaderConfig =
    !artBehindHeader && !t.isDark ? { ...header, variant: 'solid' } : header;

  // 리모컨 노출: 스크롤 리더(웹툰/소설)는 몰입을 위해 기본 숨김(탭/역스크롤로 노출),
  // 오디오는 스크롤이 없으므로 항상 노출한다.
  const [remoteVisible, setRemoteVisible] = useState(!isScrolling);
  const lastY = useRef(0);
  // 읽기 설정은 소설에서만 의미가 있다(이미지·오디오엔 본문 활자가 없다).
  const { fontSize, setFontSize } = useReaderFontSize();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 얼마나 읽었는지(0~1). 소설은 끝이 안 보이는 스크롤이라 남은 양을 알 수 있어야 한다.
  const [progress, setProgress] = useState(0);

  // 역스크롤(위로 되짚음) → 노출, 아래로 읽는 중 → 숨김. 작은 데드존(6px)으로 미세 흔들림 무시.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const dy = y - lastY.current;
    if (dy > 6) setRemoteVisible(false);
    else if (dy < -6) setRemoteVisible(true);
    lastY.current = y;

    const scrollable = contentSize.height - layoutMeasurement.height;
    setProgress(scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 1);
  };

  const like = useEpisodeLikeToggle(seriesId, no);
  const onLike = () => like.mutate(!(episode.liked === true));

  const onComments = () =>
    router.push({
      pathname: '/series/[id]/[episodeNo]/comments',
      params: { id: seriesId, episodeNo: no },
    } as unknown as Href);

  const remote = remoteVisible ? (
    <ViewerRemote
      seriesId={seriesId}
      no={no}
      latest={latest}
      liked={episode.liked === true}
      likeCount={episode.likeCount ?? 0}
      commentCount={episode.commentCount ?? 0}
      onLike={onLike}
      onComments={onComments}
      onReadingSettings={kind === 'TEXT' ? () => setSettingsOpen((v) => !v) : undefined}
    />
  ) : null;

  // 오디오 — 중앙 정렬 단일 플레이어 + 항상 노출 리모컨.
  if (!isScrolling) {
    return (
      <View style={{ flex: 1 }}>
        <Screen surface="viewer" center header={readerHeader}>
          <AudioReader urls={images.map((im) => im.url!)} title={title} />
        </Screen>
        {remote}
      </View>
    );
  }

  // 이미지/텍스트 — 세로 스크롤. 탭으로 리모컨 토글, 역스크롤로 노출. 리모컨은 Screen의
  // 형제로 absolute 오버레이(스크롤에 안 쓸려 화면에 고정). 이미지는 풀블리드(거터 0).
  return (
    <View style={{ flex: 1 }}>
      <Screen
        surface="viewer"
        scroll
        header={readerHeader}
        scrollProps={{ onScroll, scrollEventThrottle: 16 }}
      >
        <Pressable onPress={() => setRemoteVisible((v) => !v)}>
          {kind === 'TEXT' ? (
            <NovelReader urls={images.map((im) => im.url!)} fontSize={fontSize} />
          ) : (
            <WebtoonReader images={images} />
          )}
          {/* 다 읽고 나면 다음 화로 가는 게 자연스러운 다음 행동이다 — 숨어 있는 리모컨을
              찾아 꺼내지 않아도 되게 본문 끝에 둔다. 최신 회차에서는 갈 곳이 없어 숨긴다. */}
          {typeof latest === 'number' && no < latest ? (
            <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.xl }}>
              <Button
                label={`다음 화 보기 (${no + 1}화)`}
                fullWidth
                onPress={() =>
                  guardedReplace({
                    pathname: '/series/[id]/[episodeNo]',
                    params: { id: seriesId, episodeNo: no + 1 },
                  } as unknown as Href)
                }
              />
            </View>
          ) : null}
          <View style={{ height: REMOTE_CLEARANCE }} />
        </Pressable>
      </Screen>
      {settingsOpen ? (
        <ReadingSettings value={fontSize} onChange={setFontSize} onClose={() => setSettingsOpen(false)} />
      ) : null}
      {remoteVisible && !settingsOpen ? <ReadingProgress ratio={progress} /> : null}
      {remote}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  진행률 — 리모컨과 같은 노출 상태로만 뜬다(크롬을 새로 늘리지 않는다).           */
/* -------------------------------------------------------------------------- */

function ReadingProgress({ ratio }: { ratio: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom, t.space.md) + REMOTE_CLEARANCE - t.space.sm,
        alignItems: 'center',
      }}
    >
      <GlassCard radius="pill" intensity="clear" style={{ paddingHorizontal: t.space.md, paddingVertical: 2 }}>
        <Text variant="micro" style={{ color: viewerInkMuted(t) }}>
          {Math.round(ratio * 100)}%
        </Text>
      </GlassCard>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  읽기 설정 — 글자 크기. 리모컨 바로 위에 뜨는 얕은 시트.                        */
/* -------------------------------------------------------------------------- */

function ReadingSettings({
  value,
  onChange,
  onClose,
}: {
  value: ReaderFontSize;
  onChange: (next: ReaderFontSize) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom, t.space.md) + REMOTE_CLEARANCE,
        paddingHorizontal: t.space.lg,
        alignItems: 'center',
      }}
    >
      <GlassCard radius="lg" intensity="clear" style={{ padding: t.space.md, gap: t.space.sm }}>
        <Text variant="caption" style={{ color: viewerInkMuted(t), textAlign: 'center' }}>
          글자 크기
        </Text>
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          {READER_FONT_SIZES.map((size) => {
            const selected = size === value;
            return (
              <Pressable
                key={size}
                onPress={() => {
                  onChange(size);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`글자 크기 ${size}`}
                style={{
                  minWidth: t.layout.minHitTarget,
                  minHeight: t.layout.minHitTarget,
                  paddingHorizontal: t.space.md,
                  borderRadius: t.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? t.color.accentSubtle : 'transparent',
                }}
              >
                <Text
                  weight={selected ? 'semibold' : 'regular'}
                  style={{ fontSize: size, color: selected ? t.color.accent : viewerInk(t) }}
                >
                  가
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  WEBTOON — 세로로 이어 붙인 전폭 이미지(간격 0, 아트 풀블리드).                */
/* -------------------------------------------------------------------------- */

function WebtoonReader({ images }: { images: EpisodeImage[] }) {
  return (
    <View style={{ gap: 0 }}>
      {images.map((im, i) => {
        const ar = im.width && im.height ? im.width / im.height : undefined;
        return (
          <AppImage
            key={`${im.sortOrder ?? i}`}
            url={im.url}
            contentFit="cover"
            style={ar ? { width: '100%', aspectRatio: ar } : { width: '100%', height: 480 }}
          />
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  NOVEL — url의 텍스트 파일을 받아 읽기 좋은 본문으로 렌더.                     */
/* -------------------------------------------------------------------------- */

function NovelReader({ urls, fontSize }: { urls: string[]; fontSize: number }) {
  const t = useTheme();
  useReadingSurface(); // '추천' 모드에서는 소설 본문만 라이트로 opt-in(M1)
  // 작가는 한 회차에 본문 파일을 여러 개 올릴 수 있다(업로드가 다중 허용) — 예전엔 첫 파일만
  // 읽어 나머지 파트가 통째로 유실됐다. sortOrder 순서대로 전부 받아 이어 붙인다.
  const resolvedUrls = urls.map((u) => resolveImageUrl(u)).filter((u): u is string => !!u);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['episode-text', resolvedUrls],
    queryFn: async () => {
      const parts = await Promise.all(
        resolvedUrls.map(async (u) => {
          const res = await fetch(u);
          if (!res.ok) throw new Error('본문을 불러오지 못했어요.');
          return res.text();
        }),
      );
      return parts;
    },
    enabled: resolvedUrls.length > 0,
    staleTime: Infinity,
  });

  // 텍스트는 뷰어 거터(0)를 쓰지 않으므로 자체 읽기 여백이 필요. 다크에서는 여전히 원래의
  // 플로팅 transparent 헤더라 본문이 그 아래로 직접 깔리므로 헤더 높이만큼 수동 오프셋(기존
  // 동작 유지) — 라이트/추천 읽기에서는 헤더가 solid(flow)로 바뀌어(위 readerHeader) 상단
  // 인셋을 헤더가 직접 소유하므로 수동 오프셋이 불필요.
  //
  // 넓은 화면(웹·태블릿)에서 본문이 화면 끝까지 늘어나면 줄 끝에서 다음 줄을 찾기 어렵다 —
  // 읽기 폭을 글자 크기에서 끌어내 가운데로 모은다.
  const pad = {
    paddingHorizontal: t.space.lg,
    paddingTop: t.isDark ? HEADER_BAND_HEIGHT : 0,
  } as const;
  const column = {
    width: '100%',
    maxWidth: readingWidthFor(fontSize),
    alignSelf: 'center',
  } as const;

  if (isLoading) {
    return (
      <View style={[pad, { gap: t.space.md }, column]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width={i % 3 === 2 ? '70%' : '100%'} height={16} />
        ))}
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={[pad, column]}>
        {/* 본문 fetch는 뷰어 쿼리와 별개라 여기에도 재시도가 있어야 한다(없으면 회차를
            떠났다 돌아오는 것 말고는 방법이 없었다). */}
        <ErrorState code="UNKNOWN" message="본문을 불러오지 못했어요." onRetry={() => void refetch()} />
      </View>
    );
  }

  return (
    <View style={[pad, { paddingBottom: t.space.lg, gap: t.space.xl }, column]}>
      {data.map((part, i) => (
        <Text
          key={i}
          variant="body"
          style={{ lineHeight: lineHeightFor(fontSize), fontSize, color: t.color.onSurface }}
        >
          {part.trim()}
        </Text>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  뷰어 크롬 잉크 — 표면을 따라간다.                                             */
/* -------------------------------------------------------------------------- */

/**
 * 뷰어 크롬(리모컨·잠금 안내·오디오 플레이어)의 잉크.
 *
 * 원래 규칙은 "뷰어는 트루블랙이니 크롬은 흰색 고정"이었는데, viewerBg는 라이트 테마에서
 * 흰색이라(theme.ts) 그 전제가 통째로 깨진다 — 잠금 안내·오디오 플레이어·리모컨 글리프가
 * 흰 배경에 흰색으로 렌더돼 아예 보이지 않았다. 소설 라이트 읽기(§12.5)는 살릴 가치가 있는
 * 기능이라 뷰어를 다크 고정으로 되돌리는 대신, 잉크가 표면을 따라가게 한다(매체별 분기 없음).
 */
function viewerInk(t: Theme): string {
  return t.isDark ? '#FFFFFF' : t.color.onSurface;
}

/** 보조 잉크(시간 표시·부연 문구). */
function viewerInkMuted(t: Theme): string {
  return t.isDark ? 'rgba(255,255,255,0.7)' : t.color.onSurfaceSecondary;
}

/* -------------------------------------------------------------------------- */
/*  잠긴 회차 — freeAt 안내(목록의 토스트와 별개 화면 상태).                      */
/* -------------------------------------------------------------------------- */

function LockedView({ freeAt, onLeave }: { freeAt?: string | null; onLeave: () => void }) {
  const t = useTheme();
  const when = freeAt ? new Date(freeAt) : null;
  const label =
    when && Number.isFinite(when.getTime())
      ? `${when.getMonth() + 1}월 ${when.getDate()}일부터 무료로 볼 수 있어요.`
      : '아직 잠긴 회차예요.';
  return (
    <View style={{ gap: t.space.md, alignItems: 'center' }}>
      {/* 잠금 화면엔 아트가 없어 배경이 곧 viewerBg다 — 라이트에서 흰 잉크를 쓰면 흰 배경에
          흰 글자가 된다. 잉크는 뷰어 표면을 따라간다(viewerInk 규칙). */}
      <Text variant="display" weight="bold" style={{ textAlign: 'center', color: viewerInk(t) }}>
        아직 잠긴 회차예요
      </Text>
      <Text variant="body" style={{ textAlign: 'center', color: viewerInkMuted(t) }}>
        {label}
      </Text>
      <View style={{ marginTop: t.space.sm }}>
        <Button label="목록으로 돌아가기" variant="secondary" onPress={onLeave} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  플로팅 리모컨 — 이전/다음화(연재 경계 1 ≤ no ≤ latest, 스택 누적 방지 replace)      */
/*  + 추천(좋아요 토글) + 댓글(개수·해당 회차 댓글 화면 이동). 아트 위에 뜨는 글래스 필. */
/* -------------------------------------------------------------------------- */

function ViewerRemote({
  seriesId,
  no,
  latest,
  liked,
  likeCount,
  commentCount,
  onLike,
  onComments,
  onReadingSettings,
}: {
  seriesId: number;
  no: number;
  latest?: number;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComments: () => void;
  /** 소설에서만 전달 — 없으면 'Aa' 컨트롤을 렌더하지 않는다. */
  onReadingSettings?: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const hasPrev = no > 1;
  const hasNext = typeof latest === 'number' ? no < latest : false;

  // 앱 전역 컨벤션대로 가드를 통과시킨다 — raw replace는 더블탭 시 회차를 건너뛸 창을 남긴다.
  const go = (target: number) => {
    guardedReplace({
      pathname: '/series/[id]/[episodeNo]',
      params: { id: seriesId, episodeNo: target },
    } as unknown as Href);
  };

  return (
    // box-none: 필 바깥(투명) 영역의 탭은 아래 리더로 통과(탭 토글 유지).
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: t.space.lg,
        paddingBottom: Math.max(insets.bottom, t.space.md),
        alignItems: 'center',
      }}
    >
      <GlassCard
        radius="pill"
        intensity="clear"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: t.space.xs,
          paddingVertical: 4,
        }}
      >
        <RemoteAction
          symbol="chevron.left"
          glyph="‹"
          label="이전 화"
          disabled={!hasPrev}
          onPress={() => go(no - 1)}
        />
        <RemoteAction
          symbol={liked ? 'heart.fill' : 'heart'}
          glyph={liked ? '♥' : '♡'}
          count={likeCount}
          active={liked}
          label={liked ? '추천 취소' : '추천'}
          onPress={onLike}
        />
        <RemoteAction
          symbol="text.bubble"
          glyph="💬"
          count={commentCount}
          label="댓글 보기"
          onPress={onComments}
        />
        {onReadingSettings ? (
          <RemoteAction symbol="textformat.size" glyph="Aa" label="글자 크기" onPress={onReadingSettings} />
        ) : null}
        <RemoteAction
          symbol="chevron.right"
          glyph="›"
          label="다음 화"
          disabled={!hasNext}
          onPress={() => go(no + 1)}
        />
      </GlassCard>
    </View>
  );
}

/**
 * 리모컨 개별 컨트롤 — SF Symbol(+텍스트 폴백) 아이콘, 선택적 개수, 활성(accent)·비활성 잉크.
 * 잉크는 뷰어 표면을 따른다(viewerInk) — 다크에서는 기존과 같은 흰색, 라이트에서는 본문 잉크.
 */
function RemoteAction({
  symbol,
  glyph,
  count,
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  symbol: string;
  glyph: string;
  count?: number;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const ink = disabled
    ? (t.isDark ? 'rgba(255,255,255,0.3)' : t.color.onSurfaceMuted)
    : active
      ? t.color.accent
      : viewerInk(t);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: t.space.sm,
        paddingVertical: t.space.sm,
        opacity: pressed && !disabled ? t.opacity.pressed : 1,
      })}
    >
      <SymbolView
        name={symbol as SymbolName}
        size={20}
        weight="semibold"
        tintColor={ink}
        fallback={
          <Text variant="label" weight="semibold" style={{ color: ink }}>
            {glyph}
          </Text>
        }
      />
      {typeof count === 'number' ? (
        <Text variant="caption" weight="semibold" style={{ color: ink }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */

/** 뷰어 거터(0)를 쓰는 중앙 상태(에러/잠김/빈)에 읽기 여백을 준다. */
function Padded({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ paddingHorizontal: t.space.lg, width: '100%' }}>{children}</View>;
}

function ViewerSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.md, paddingHorizontal: t.space.lg }}>
      <Skeleton height={360} radius="md" />
      <Skeleton height={360} radius="md" />
    </View>
  );
}
