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
import { isAppError } from '@/lib/errors';
import { keys } from '@/lib/query';
import { guardedBack } from '@/lib/navigation/useGuardedNavigation';
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

  const { data, isLoading, isError, error } = useQuery<EpisodeDetail>({
    queryKey: keys.episodes.detail(seriesId, no),
    queryFn: () => getEpisode(seriesId, no),
    enabled: valid,
    retry: false,
  });

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
  const header: HeaderConfig = { variant: 'transparent', back: true, title };

  if (!valid) {
    return (
      <Screen surface="viewer" center header={{ variant: 'transparent', back: true, title: '회차' }}>
        <Padded>
          <ErrorState code="ENTITY_NOT_FOUND" onRetry={() => guardedBack()} />
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
          <ErrorState
            code={code === 'ADULT_ONLY' ? 'ADULT_ONLY' : code === 'ENTITY_NOT_FOUND' ? 'ENTITY_NOT_FOUND' : 'UNKNOWN'}
            message={isAppError(error) ? error.message : undefined}
            onRetry={() => guardedBack()}
          />
        </Padded>
      </Screen>
    );
  }

  if (locked) {
    return (
      <Screen surface="viewer" center header={header}>
        <Padded>
          <LockedView freeAt={data.freeAt} />
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
  // transparent 헤더의 흰 글리프는 '아트 위에 뜬다'는 전제라 다크(트루블랙 viewerBg)에서는
  // 항상 안전했지만, 소설 본문이 라이트/추천 읽기 모드로 전환되면(§12.5) viewerBg도 흰색이
  // 돼 흰 글리프가 통째로 안 보인다. 그때만 solid로 바꿔 테마에 맞는 잉크를 쓴다 — 다크에서는
  // 원래의 아트-포워드 트랜스페런트 헤더를 그대로 유지(solid 밴드가 트루블랙과 안 맞아 seam 생김).
  const readerHeader: HeaderConfig =
    kind === 'TEXT' && !t.isDark ? { ...header, variant: 'solid' } : header;

  // 리모컨 노출: 스크롤 리더(웹툰/소설)는 몰입을 위해 기본 숨김(탭/역스크롤로 노출),
  // 오디오는 스크롤이 없으므로 항상 노출한다.
  const [remoteVisible, setRemoteVisible] = useState(!isScrolling);
  const lastY = useRef(0);

  // 역스크롤(위로 되짚음) → 노출, 아래로 읽는 중 → 숨김. 작은 데드존(6px)으로 미세 흔들림 무시.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (dy > 6) setRemoteVisible(false);
    else if (dy < -6) setRemoteVisible(true);
    lastY.current = y;
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
    />
  ) : null;

  // 오디오 — 중앙 정렬 단일 플레이어 + 항상 노출 리모컨.
  if (!isScrolling) {
    return (
      <View style={{ flex: 1 }}>
        <Screen surface="viewer" center header={header}>
          <AudioReader url={images[0].url!} title={title} />
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
            <NovelReader url={images[0].url!} />
          ) : (
            <WebtoonReader images={images} />
          )}
          <View style={{ height: REMOTE_CLEARANCE }} />
        </Pressable>
      </Screen>
      {remote}
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

function NovelReader({ url }: { url: string }) {
  const t = useTheme();
  useReadingSurface(); // '추천' 모드에서는 소설 본문만 라이트로 opt-in(M1)
  const resolved = resolveImageUrl(url);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['episode-text', url],
    queryFn: async () => {
      const res = await fetch(resolved!);
      if (!res.ok) throw new Error('본문을 불러오지 못했어요.');
      return res.text();
    },
    enabled: !!resolved,
    staleTime: Infinity,
  });

  // 텍스트는 뷰어 거터(0)를 쓰지 않으므로 자체 읽기 여백이 필요. 다크에서는 여전히 원래의
  // 플로팅 transparent 헤더라 본문이 그 아래로 직접 깔리므로 헤더 높이만큼 수동 오프셋(기존
  // 동작 유지) — 라이트/추천 읽기에서는 헤더가 solid(flow)로 바뀌어(위 readerHeader) 상단
  // 인셋을 헤더가 직접 소유하므로 수동 오프셋이 불필요.
  const pad = {
    paddingHorizontal: t.space.lg,
    paddingTop: t.isDark ? HEADER_BAND_HEIGHT : 0,
  } as const;

  if (isLoading) {
    return (
      <View style={[pad, { gap: t.space.md }]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width={i % 3 === 2 ? '70%' : '100%'} height={16} />
        ))}
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={pad}>
        <ErrorState code="UNKNOWN" message="본문을 불러오지 못했어요." />
      </View>
    );
  }

  return (
    <View style={[pad, { paddingBottom: t.space.lg }]}>
      <Text variant="body" style={{ lineHeight: 30, fontSize: 17, color: t.color.onSurface }}>
        {data.trim()}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  잠긴 회차 — freeAt 안내(목록의 토스트와 별개 화면 상태).                      */
/* -------------------------------------------------------------------------- */

function LockedView({ freeAt }: { freeAt?: string | null }) {
  const t = useTheme();
  const when = freeAt ? new Date(freeAt) : null;
  const label =
    when && Number.isFinite(when.getTime())
      ? `${when.getMonth() + 1}월 ${when.getDate()}일부터 무료로 볼 수 있어요.`
      : '아직 잠긴 회차예요.';
  return (
    <View style={{ gap: t.space.md, alignItems: 'center' }}>
      <Text variant="display" weight="bold" style={{ textAlign: 'center', color: '#fff' }}>
        아직 잠긴 회차예요
      </Text>
      <Text variant="body" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
        {label}
      </Text>
      <View style={{ marginTop: t.space.sm }}>
        <Button label="목록으로 돌아가기" variant="secondary" onPress={() => guardedBack()} />
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
}: {
  seriesId: number;
  no: number;
  latest?: number;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComments: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hasPrev = no > 1;
  const hasNext = typeof latest === 'number' ? no < latest : false;

  const go = (target: number) => {
    router.replace({
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
 * 아트 위에 뜨므로 기본 잉크는 흰색(header-actions의 INK_ON_ART와 동일 컨벤션).
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
    ? 'rgba(255,255,255,0.3)'
    : active
      ? t.color.accent
      : '#FFFFFF';
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
