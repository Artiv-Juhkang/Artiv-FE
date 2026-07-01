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
import { useEffect, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getEpisode, markRead } from '@/api/endpoints/episodes';
import type { EpisodeDetail, EpisodeImage } from '@/api/types';
import { resolveImageUrl } from '@/api/image';
import { AudioReader } from '@/features/series/components/AudioReader';
import { useSeriesDetail } from '@/features/series/hooks';
import { isAppError } from '@/lib/errors';
import { keys } from '@/lib/query';
import { guardedBack } from '@/lib/navigation/useGuardedNavigation';
import {
  Button,
  EmptyState,
  ErrorState,
  HEADER_BAND_HEIGHT,
  Screen,
  Skeleton,
  Text,
  useTheme,
  type HeaderConfig,
} from '@/ui';
import { AppImage } from '@/ui/AppImage';

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

  const kind = images[0].mediaKind;
  const nav = <EpisodeNav seriesId={seriesId} no={no} latest={series?.latestEpisodeNo} />;

  // 오디오 — 중앙 정렬 단일 플레이어.
  if (kind === 'AUDIO') {
    return (
      <Screen surface="viewer" center header={header}>
        <AudioReader url={images[0].url!} title={title} />
        {nav}
      </Screen>
    );
  }

  // 이미지/텍스트 — 세로 스크롤. 이미지는 풀블리드(거터 0), 텍스트는 읽기 여백.
  return (
    <Screen surface="viewer" scroll header={header}>
      {kind === 'TEXT' ? <NovelReader url={images[0].url!} /> : <WebtoonReader images={images} />}
      {nav}
    </Screen>
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

  // 텍스트는 뷰어 거터(0)를 쓰지 않으므로 자체 읽기 여백 + 헤더 높이만큼 상단 확보.
  const pad = { paddingHorizontal: t.space.lg, paddingTop: HEADER_BAND_HEIGHT } as const;

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
      <Text variant="body" style={{ lineHeight: 30, fontSize: 17, color: '#fff' }}>
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
/*  이전/다음 화 — 연재 경계 안에서만(1 ≤ no ≤ latest). 스택 누적 방지 위해 replace. */
/* -------------------------------------------------------------------------- */

function EpisodeNav({
  seriesId,
  no,
  latest,
}: {
  seriesId: number;
  no: number;
  latest?: number;
}) {
  const t = useTheme();
  const router = useRouter();
  const hasPrev = no > 1;
  const hasNext = typeof latest === 'number' ? no < latest : false;

  if (!hasPrev && !hasNext) return null;

  const go = (target: number) => {
    router.replace({
      pathname: '/series/[id]/[episodeNo]',
      params: { id: seriesId, episodeNo: target },
    } as unknown as Href);
  };

  return (
    <View style={{ flexDirection: 'row', gap: t.space.sm, paddingHorizontal: t.space.lg, paddingVertical: t.space.lg }}>
      <View style={{ flex: 1 }}>
        <Button label="이전 화" variant="secondary" fullWidth disabled={!hasPrev} onPress={() => go(no - 1)} />
      </View>
      <View style={{ flex: 1 }}>
        <Button label="다음 화" variant="primary" fullWidth disabled={!hasNext} onPress={() => go(no + 1)} />
      </View>
    </View>
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
