/**
 * Series detail — the dynamic route `(app)/series/[id]`.
 * ------------------------------------------------------------------
 * Pushed as a full screen OVER the tab bar (registered in (app)/_layout as a
 * sibling of (tabs)). Art-led IMMERSIVE hero: a TRANSPARENT header floats
 * absolutely over a full-bleed cover/aurora that bleeds from the notch down.
 * The custom <Screen> header owns the top inset (no native header).
 *
 * HEADER (frontend-screenlayout §3/§7/§8):
 *   variant 'transparent' (glass chips + forced white ink over art), back ‹.
 *   right = [관심(heart), 공유, 더보기]. The heart is the REAL subscription
 *   toggle (useSubscribeToggle) — 관심 == 구독 (the only series-level intent the
 *   backend has). It reads/writes the SAME keys.series.detail(id) cache as the
 *   body 구독 button, so header heart and body button stay in lock-step.
 *   Loading / error / invalid branches show a BACK-ONLY transparent header (no
 *   toggle until data exists). Each branch owns its own <Screen> so the header
 *   reflects the data state; the cover (CoverWall) is the Screen `background`
 *   absoluteFill layer so it bleeds full-screen behind the body.
 *
 * Composition (frontend-content-screens §4):
 *   SeriesHero        full-bleed cover/aurora hero + glass info panel
 *   SeriesActionBar   구독 (real) · 정기후원 (seam) · 공유 (local)
 *   StatsRow          episodeCount / latestEpisodeNo (from SeriesDetail)
 *   CTA               첫화 보기 / 이어보기 N화 (← useResumePoint)
 *   EpisodeList       inline 회차 목록 (§5 module — mounted with seriesId)
 *
 * Shell = Screen(scroll, transparent header, CoverWall background) >
 * FeatureErrorBoundary > Suspense (the canonical boundary-OUTSIDE-Suspense
 * pattern). Branches:
 *   - invalid id (NaN / ≤ 0)            → ENTITY_NOT_FOUND, no query fired
 *   - 404 / visible === false (non-owner) → ENTITY_NOT_FOUND + 홈으로
 *   - other error                       → ErrorState (mapped code) + retry
 *
 * typedRoutes: the route PATH string is the generic of useLocalSearchParams and
 * the pathname of guardedPush — never an inline {id} interface, never a bare
 * string href for a dynamic route.
 */
import { Suspense, type ReactNode } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';

import type { SeriesDetail } from '@/api/types';
import { FeatureErrorBoundary } from '@/components/feedback';
import { EpisodeList } from '@/features/series/components/EpisodeList';
import { SeriesActionBar } from '@/features/series/components/SeriesActionBar';
import { SeriesGallery } from '@/features/series/components/SeriesGallery';
import { SeriesHero } from '@/features/series/components/SeriesHero';
import { useContentTypes } from '@/features/creativity/hooks';
import {
  useResumePoint,
  useSeriesDetail,
  useSubscribeToggle,
} from '@/features/series/hooks';
import { isAppError } from '@/lib/errors';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  BookmarkAction,
  Button,
  CoverWall,
  ErrorState,
  HeaderIconButton,
  Screen,
  Skeleton,
  Text,
  useTheme,
  type HeaderConfig,
} from '@/ui';

export default function SeriesDetailScreen() {
  // typedRoutes: pass the ROUTE PATH as the generic. Runtime value is always
  // string | string[] (URL-derived) → coerce + validate ourselves.
  const { id } = useLocalSearchParams<'/series/[id]'>();
  const seriesId = Number(id);
  const validId = Number.isFinite(seriesId) && seriesId > 0;

  // Invalid id → render not-found WITHOUT firing the query (back-only header).
  if (!validId) {
    return (
      <DetailShell>
        <InvalidId />
      </DetailShell>
    );
  }

  return (
    <FeatureErrorBoundary>
      <Suspense
        fallback={
          <DetailShell>
            <DetailSkeleton />
          </DetailShell>
        }
      >
        <DetailContent seriesId={seriesId} />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailShell — the transparent-header + full-bleed-cover frame, shared by   */
/*  every branch. `right` defaults to none (back-only) for loading/error.     */
/* -------------------------------------------------------------------------- */

function DetailShell({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  const header: HeaderConfig = {
    variant: 'transparent',
    back: true,
    right,
  };
  return (
    <Screen
      surface="glass"
      scroll
      edges={['top']}
      header={header}
      // Cover seam: SeriesDetailResponse has no cover field yet → aurora.
      // The instant the API grows one, pass covers={[coverUrl]} here. The
      // background absoluteFill bleeds from the notch behind the floating header.
      background={<CoverWall covers={[]} />}
    >
      {children}
    </Screen>
  );
}

function InvalidId() {
  const nav = useGuardedNavigation();
  return (
    <View style={{ flex: 1, minHeight: 400 }}>
      <ErrorState code="ENTITY_NOT_FOUND" onRetry={() => nav.back()} />
    </View>
  );
}

function DetailContent({ seriesId }: { seriesId: number }) {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const { data, isLoading, isError, error, refetch } =
    useSeriesDetail(seriesId);

  // 타입별 화면 분기 키 — registry의 serialized 플래그(타입=데이터: 백엔드에 ContentType
  // 추가 시 FE 변경 0). 미해결/미지정 시 안전 기본값 = 연재(현 웹툰 회차 모델).
  const { data: contentTypes } = useContentTypes();

  // Header heart = 관심 (the ONLY series-level personalization = subscription).
  // Controlled by the detail cache; it is the SOLE 관심 control — no body dup,
  // and no "구독" wording (작품 단위 관심). Author follow is a separate feature.
  const toggle = useSubscribeToggle(seriesId);

  // useResumePoint reads read-history (the single source for 이어보기); it
  // returns a safe 첫화 default while loading / when this series is absent.
  const resume = useResumePoint(seriesId);

  // Loading / error / not-found → BACK-ONLY transparent header (no toggle until
  // we actually have data to bind it to).
  if (isLoading) {
    return (
      <DetailShell>
        <DetailSkeleton />
      </DetailShell>
    );
  }

  if (isError) {
    // The query layer normalizes thrown values to AppError. A private/
    // unpublished series is a 404 for non-owners → ENTITY_NOT_FOUND.
    const code = isAppError(error) ? error.code : 'UNKNOWN';
    return (
      <DetailShell>
        <View style={{ flex: 1, minHeight: 400 }}>
          <ErrorState
            code={code === 'ENTITY_NOT_FOUND' ? 'ENTITY_NOT_FOUND' : 'UNKNOWN'}
            message={error?.message}
            onRetry={() => void refetch()}
          />
        </View>
      </DetailShell>
    );
  }

  // Non-owner view of a hidden series can come back 200 + visible:false rather
  // than a 404 — treat it as not-found too (don't render a ghost detail).
  if (!data || data.visible === false) {
    return (
      <DetailShell>
        <View style={{ flex: 1, minHeight: 400 }}>
          <ErrorState code="ENTITY_NOT_FOUND" onRetry={() => nav.back()} />
        </View>
      </DetailShell>
    );
  }

  const series: SeriesDetail = data;
  const subscribed = series.isSubscribed ?? false;

  // 연재(웹툰·소설) → 회차 모델; 비연재(일러스트·사진·디자인·손그림) → 스와이프 갤러리.
  const serialized =
    contentTypes?.find((ct) => ct.key === series.contentType)?.serialized ?? true;

  // CTA target episode. 이어보기 clamps lastRead+1 to the latest published
  // episode (read-history carries no latest — SeriesDetail.latestEpisodeNo
  // is the authority). episodeCount === 0 ⇒ no published episodes ⇒ disabled.
  const latest = series.latestEpisodeNo;
  const episodeCount = series.episodeCount ?? 0;
  const hasEpisodes = episodeCount > 0;

  const targetEpisodeNo =
    resume.mode === 'resume'
      ? typeof latest === 'number'
        ? Math.min(resume.episodeNo, latest)
        : resume.episodeNo
      : 1;

  const ctaLabel =
    resume.mode === 'resume' ? `이어보기 ${targetEpisodeNo}화` : '첫화 보기';

  const onPressCta = () => {
    // 회차 뷰어로 이동(멀티미디어 리더). params 는 URL 세그먼트라 문자열로 넘긴다.
    // guardedPush 는 컴포넌트 간 중복 push 방지.
    nav.push({
      pathname: '/series/[id]/[episodeNo]',
      params: { id: String(seriesId), episodeNo: String(targetEpisodeNo) },
    });
  };

  // Local share — no backend. Deep link uses the app scheme (app.json
  // scheme="artiv") so opening it returns to this detail screen.
  const onShare = () => {
    void Share.share({
      message: `Artiv에서 이 작품을 확인해 보세요\nartiv://series/${seriesId}`,
    });
  };

  // FUTURE SEAM: a series-level overflow menu (신고/작가 프로필 등) is TBD —
  // backend exposes no such actions yet, so 더보기 is a calm no-op placeholder.
  const onMore = () => {};

  // right actions: 관심(heart) · 공유 · 더보기. 관심 = the series subscription
  // endpoint (작품 단위 관심 — there is no separate "구독"; one intent). The heart
  // is CONTROLLED by the cache; onToggle flips it through the optimistic mutation.
  const right = (
    <>
      <BookmarkAction
        active={subscribed}
        onToggle={() => toggle.mutate(!subscribed)}
        tone="transparent"
      />
      <HeaderIconButton
        name="square.and.arrow.up"
        fallback="공유"
        tone="transparent"
        onPress={onShare}
        accessibilityLabel="공유"
      />
      <HeaderIconButton
        name="ellipsis"
        fallback="···"
        tone="transparent"
        onPress={onMore}
        accessibilityLabel="더보기"
      />
    </>
  );

  return (
    <DetailShell right={right}>
      <View style={{ gap: t.space.lg, paddingBottom: t.space.lg }}>
        <SeriesHero series={series} />

        <SeriesActionBar seriesId={seriesId} />

        {serialized ? (
          <>
            <StatsRow episodeCount={episodeCount} latestEpisodeNo={latest} />

            <Button
              label={hasEpisodes ? ctaLabel : '공개된 회차가 없어요'}
              variant="primary"
              fullWidth
              disabled={!hasEpisodes}
              onPress={onPressCta}
            />

            {/* Inline 회차 목록 (§5 module). Owns its own infinite query, clock, sort
                toggle, read/bookmark mapping, and lock-safe navigation. */}
            <EpisodeList seriesId={seriesId} />
          </>
        ) : (
          // 비연재 단일물 — 회차/정기후원 통계 대신 스와이프 이미지 갤러리.
          <SeriesGallery seriesId={seriesId} />
        )}
      </View>
    </DetailShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  StatsRow — episodeCount / latestEpisodeNo from the detail DTO.            */
/* -------------------------------------------------------------------------- */

function StatsRow({
  episodeCount,
  latestEpisodeNo,
}: {
  episodeCount: number;
  latestEpisodeNo?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.space.xl }}>
      <Stat label="전체 회차" value={`${episodeCount}화`} />
      {typeof latestEpisodeNo === 'number' ? (
        <Stat label="최신 회차" value={`${latestEpisodeNo}화`} />
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="onSurfaceMuted">
        {label}
      </Text>
      <Text variant="headline" weight="semibold">
        {value}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton — hero + actions + stats footprint (no reflow when data lands).  */
/* -------------------------------------------------------------------------- */

function DetailSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
      <Skeleton height={240} radius="xl" />
      <Skeleton height={t.layout.minHitTarget} radius="md" />
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <Skeleton height={t.layout.minHitTarget} radius="md" />
        </View>
        <View style={{ flex: 1 }}>
          <Skeleton height={t.layout.minHitTarget} radius="md" />
        </View>
      </View>
      <Skeleton width="60%" height={20} />
      <Skeleton height={t.layout.minHitTarget} radius="md" />
      <View style={{ gap: t.space.md }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={64} radius="lg" />
        ))}
      </View>
    </View>
  );
}
