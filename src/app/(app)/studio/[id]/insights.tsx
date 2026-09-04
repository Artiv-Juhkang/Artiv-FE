/**
 * 작품 진단 — 창작자 온톨로지.
 * ------------------------------------------------------------------
 * Phase A가 만든 진단(잔존·절벽·유입·세그먼트)에 Phase B의 액션(이탈 독자 알림)을 얹어
 * 결정 → 액션 → 측정 루프를 화면에서 닫는다. 관리자 콘솔(:8080/admin)의 진단 뷰와
 * 같은 데이터를 보여주며, 두 화면의 수치가 어긋나면 그건 버그다.
 *
 * 지표마다 기간이 다르다: 요약·유입은 최근 30일, 잔존·세그먼트는 생애 전체.
 * 잔존은 기간 지표가 아니라 퍼널이고, 세그먼트에 창을 걸면 이탈이 구조적으로 0이 된다.
 */
import { useMemo } from 'react';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { useRequireRole } from '@/features/auth';
import {
  useNudgeLapsedAudience,
  useOntologySchema,
  useSharedAudience,
  useWorkInsights,
} from '@/features/ontology/hooks';
import {
  Button,
  Card,
  ErrorState,
  ProgressBar,
  Screen,
  Skeleton,
  Text,
  mediaColor,
  useTheme,
  useToast,
  type HeaderConfig,
} from '@/ui';

/** 화면이 실제로 실행할 수 있는 액션. 서버가 내려준 applicableActions와 교집합을 취한다. */
const HANDLED_ACTIONS = ['NUDGE_LAPSED_AUDIENCE'] as const;

export default function WorkInsightsScreen() {
  const { allowed, loading } = useRequireRole('CREATOR');
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = Number(id);

  if (loading) {
    return (
      <Screen header={{ variant: 'solid', back: true, title: '작품 진단' }}>
        <View style={{ paddingVertical: 24, gap: 12 }}>
          <Skeleton height={96} radius="lg" />
          <Skeleton height={180} radius="lg" />
        </View>
      </Screen>
    );
  }
  if (!allowed) return <Redirect href={'/creator-request' as Href} />;

  return <InsightsBody seriesId={seriesId} />;
}

function InsightsBody({ seriesId }: { seriesId: number }) {
  const t = useTheme();
  const { show } = useToast();
  const insights = useWorkInsights(seriesId);
  const shared = useSharedAudience(seriesId);
  const schema = useOntologySchema();

  const d = insights.data;

  // 액션 라벨의 정본은 스키마다. insights.applicableActions는 enum 이름 문자열뿐이라
  // 조인 없이 렌더하면 'RETAG_WORK'가 그대로 노출된다(관리자 콘솔이 지금 그 상태다).
  const actions = useMemo(() => {
    if (!d || !schema.data) return [];
    return d.applicableActions
      .filter((k) => (HANDLED_ACTIONS as readonly string[]).includes(k))
      .map((k) => schema.data!.actions.find((a) => a.key === k))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [d, schema.data]);

  const header: HeaderConfig = {
    variant: 'solid',
    back: true,
    title: '작품 진단',
    mediaColor: d ? mediaColor(d.contentType.toLowerCase()) : undefined,
  };

  if (insights.isLoading) {
    return (
      <Screen scroll header={header}>
        <View style={{ paddingVertical: 24, gap: 12 }}>
          <Skeleton height={96} radius="lg" />
          <Skeleton height={220} radius="lg" />
          <Skeleton height={140} radius="lg" />
        </View>
      </Screen>
    );
  }
  if (insights.isError || !d) {
    return (
      <Screen header={header}>
        <ErrorState code="UNKNOWN" onRetry={() => void insights.refetch()} />
      </Screen>
    );
  }

  const maxReaders = Math.max(1, ...d.retention.map((r) => r.uniqueReaders));
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const lapsed = d.segments.find((s) => s.segment === 'LAPSED');
  const canNudge = lapsed?.disclosed === true;

  return (
    <Screen scroll surface="chrome" header={header}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
        <View style={{ gap: 2 }}>
          <Text variant="title" weight="bold" numberOfLines={2}>
            {d.title}
          </Text>
          <Text variant="caption" color="onSurfaceMuted">
            {d.medium} · 요약·유입은 최근 {d.window.days}일 / 잔존·세그먼트는 전체 기간
          </Text>
        </View>

        {/* ── 요약 ── */}
        <Card>
          <View style={{ flexDirection: 'row', gap: t.space.md }}>
            <Stat value={String(d.summary.sessions)} label="열람 세션" />
            <Stat value={String(d.summary.uniqueReaders)} label="고유 독자" />
            <Stat value={pct(d.summary.completionRate)} label="완독률" />
          </View>
          <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
            원자료 {d.summary.sampleSize}건 기준 · 10건 미만이면 비율을 표시하지 않아요.
          </Text>
          {d.lastAction ? (
            <Text variant="caption" color="onSurfaceMuted">
              마지막 액션 · {d.lastAction.label} ({new Date(d.lastAction.occurredAt).toLocaleDateString('ko-KR')})
            </Text>
          ) : null}
        </Card>

        {/* ── 회차별 잔존 ── */}
        <Card>
          <Text variant="headline" weight="semibold">
            회차별 잔존
          </Text>
          {d.retention.length === 0 ? (
            <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
              아직 열람 데이터가 없어요.
            </Text>
          ) : (
            <View style={{ gap: t.space.xs, marginTop: t.space.sm }}>
              {d.retention.map((r) => (
                <View key={r.episodeNo} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <Text
                    variant="caption"
                    weight={r.cliff ? 'bold' : 'regular'}
                    style={{ width: 44, color: r.cliff ? t.color.danger : t.color.onSurfaceMuted }}
                  >
                    {r.episodeNo}화
                  </Text>
                  <View style={{ flex: 1 }}>
                    {/* retentionPct는 서버에서 100×readers/max로 계산된다 — 관리자 콘솔 막대와 같은 수식. */}
                    <ProgressBar value={(100 * r.uniqueReaders) / maxReaders} height={8} />
                  </View>
                  <Text variant="caption" style={{ width: 46, textAlign: 'right' }}>
                    {r.retentionPct}%
                  </Text>
                  <Text variant="caption" color="onSurfaceMuted" style={{ width: 42, textAlign: 'right' }}>
                    {r.uniqueReaders}명
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
            {d.cliff
              ? `${d.cliff.episodeNo}화에서 ${d.cliff.dropPct}%p 급락했어요. 그 회차의 도입부·썸네일·제목을 점검해 보세요.`
              : '뚜렷한 이탈 절벽은 보이지 않아요.'}
          </Text>
        </Card>

        {/* ── 유입 경로 ── */}
        <Card>
          <Text variant="headline" weight="semibold">
            유입 경로
          </Text>
          {d.entryPoints.length === 0 ? (
            <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
              최근 {d.window.days}일 유입 데이터가 없어요.
            </Text>
          ) : (
            <View style={{ gap: t.space.xs, marginTop: t.space.sm }}>
              {d.entryPoints.map((e) => (
                <View key={e.entryPoint} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <Text variant="caption" color="onSurfaceMuted" style={{ width: 68 }}>
                    {e.label}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <ProgressBar value={e.share * 100} height={8} />
                  </View>
                  <Text variant="caption" style={{ width: 42, textAlign: 'right' }}>
                    {Math.round(e.share * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
            독자가 이 작품에 어떻게 도달했는지예요. 회차가 아니라 작품에 들어온 시점에
            기록하므로, 한 번 들어와서 읽은 회차들은 같은 경로로 묶여요.
          </Text>
        </Card>

        {/* ── 함께 보는 작품 ── */}
        <Card>
          <Text variant="headline" weight="semibold">
            내 독자가 함께 보는 작품
          </Text>
          {shared.isLoading ? (
            <Skeleton height={72} radius="md" />
          ) : shared.data && shared.data.links.length > 0 ? (
            <View style={{ gap: t.space.xs, marginTop: t.space.sm }}>
              {shared.data.links.map((l) => (
                <Text key={l.workId} variant="body">
                  내 독자의{' '}
                  <Text variant="body" weight="bold">
                    {Math.round(l.shareOfMyAudience * 100)}%
                  </Text>
                  가 「{l.title}」도 봐요
                </Text>
              ))}
            </View>
          ) : (
            <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
              {shared.data?.myAudienceSize == null
                ? '독자가 더 모이면 보여드릴 수 있어요.'
                : '함께 보는 작품이 아직 없어요.'}
            </Text>
          )}
        </Card>

        {/* ── 독자 세그먼트 ── */}
        <Card>
          <Text variant="headline" weight="semibold">
            독자 세그먼트
          </Text>
          <View style={{ gap: t.space.xs, marginTop: t.space.sm }}>
            {d.segments.map((s) => (
              <View key={s.segment} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body">{s.label}</Text>
                <Text variant="body" color={s.disclosed ? 'onSurface' : 'onSurfaceMuted'}>
                  {s.disclosed ? `${s.size}명` : '5명 미만 비공개'}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="caption" color="onSurfaceMuted" style={{ marginTop: t.space.sm }}>
            5명 미만은 개인 식별 위험이 있어 크기를 공개하지 않아요. 세그먼트는 전체 기간 기준이라
            위 요약(최근 {d.window.days}일)의 고유 독자 수와 합계가 달라요.
          </Text>
        </Card>

        {/* ── 액션 ── */}
        {actions.length > 0 ? (
          <ActionCard
            seriesId={seriesId}
            actions={actions}
            canNudge={canNudge}
            onDone={() => show({ message: '이탈 독자에게 알림을 보냈어요.', tone: 'success' })}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="title" weight="bold">
        {value}
      </Text>
      <Text variant="caption" color="onSurfaceMuted">
        {label}
      </Text>
    </View>
  );
}

function ActionCard({
  seriesId,
  actions,
  canNudge,
  onDone,
}: {
  seriesId: number;
  actions: { key: string; label: string }[];
  canNudge: boolean;
  onDone: () => void;
}) {
  const t = useTheme();
  // 화면 코드에 한국어 액션 라벨을 하드코딩하지 않는다 — 라벨은 스키마에서 온다.
  const nudge = actions.find((a) => a.key === 'NUDGE_LAPSED_AUDIENCE');

  return (
    <Card>
      <Text variant="headline" weight="semibold">
        할 수 있는 것
      </Text>
      {nudge ? (
        <View style={{ gap: t.space.sm, marginTop: t.space.sm }}>
          <NudgeButton seriesId={seriesId} label={nudge.label} disabled={!canNudge} onDone={onDone} />
          <Text variant="caption" color="onSurfaceMuted">
            {canNudge
              ? '이 작품을 구독 중인 이탈 독자에게만 보내요. 작품당 주 1회까지 보낼 수 있어요.'
              : '대상이 5명 미만이면 개인 식별 위험이 있어 보낼 수 없어요.'}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function NudgeButton({
  seriesId,
  label,
  disabled,
  onDone,
}: {
  seriesId: number;
  label: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const mutation = useNudgeLapsedAudience(seriesId);

  // 실제 사람에게 알림이 간다 — 확인 없이 실행하지 않는다(설계 §8-4).
  //
  // react-native-web의 Alert.alert는 **빈 함수**라 웹에서는 아무 일도 일어나지 않는다
  // (`class Alert { static alert() {} }`). 확인 다이얼로그가 조용히 사라져 액션이 영원히
  // 실행되지 않으므로 웹은 window.confirm으로 분기한다 — withdraw.tsx:36과 같은 패턴.
  const MESSAGE = '이 작품을 구독 중인 이탈 독자에게 알림을 보낼까요? 이번 주에는 다시 보낼 수 없어요.';
  const confirm = () => {
    const run = () => mutation.mutate(undefined, { onSuccess: onDone });
    if (Platform.OS === 'web') {
      if (window.confirm(MESSAGE)) run();
      return;
    }
    Alert.alert(label, MESSAGE, [
      { text: '취소', style: 'cancel' },
      { text: '보내기', onPress: run },
    ]);
  };

  return (
    <Button label={label} fullWidth disabled={disabled || mutation.isPending} onPress={confirm} />
  );
}
