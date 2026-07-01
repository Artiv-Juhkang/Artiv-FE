/**
 * 검색 — 제목·작가 검색 + '#장르/태그' 검색.
 * ------------------------------------------------------------------
 * 헤더 검색 아이콘(창작 홈)에서 push. 입력은 헤더 자리의 글래스 필드(자동 포커스).
 *
 *  - 빈 입력  → 최근 검색어(AsyncStorage) + 장르 추천 칩('#로맨스'…)으로 발견을 돕는다.
 *  - 입력 중  → 250ms 디바운스 후 검색. '#스릴러'면 장르, '#…' 그 외면 자유 태그,
 *              아니면 제목·작가 키워드(parseSearch). 결과는 매체 타입별 섹션으로 묶어
 *              SeriesGridCard 그리드로 보여준다(매체색 도트 + 라벨 + 개수).
 *  - 결과 없음 → 빈 상태. 검색은 series-only(phase 1) — 커뮤니티/유저 검색은 후속.
 *
 * 백엔드 무변경(이미 keyword·genre·tag 지원), 작가 매칭만 1줄 추가됨(SeriesRepository).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { listSeries } from '@/api/endpoints/series';
import type { SeriesSummary } from '@/api/types';
import { useContentTypes } from '@/features/creativity/hooks';
import {
  SeriesGridCard,
  seriesGridLayout,
  SERIES_GRID,
  isRecentlyUpdated,
} from '@/features/series/components/SeriesGridCard';
import { GENRE_LABEL, GENRE_SUGGESTIONS, parseSearch } from '@/features/search/genre';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  EmptyState,
  ErrorState,
  HeaderBackButton,
  Screen,
  Text,
  useResponsive,
  useTheme,
} from '@/ui';
import { mediaColor } from '@/ui/tokens';

const RECENTS_KEY = 'artiv.search.recents';
const RECENTS_MAX = 8;

/* -------------------------------------------------------------------------- */
/*  최근 검색어 (AsyncStorage)                                                   */
/* -------------------------------------------------------------------------- */

function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => {
        if (alive && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setRecents(parsed.slice(0, RECENTS_MAX));
          } catch {
            /* 손상된 값은 무시(빈 목록으로 시작). */
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    setRecents(next);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const commit = useCallback(
    (term: string) => {
      const q = term.trim();
      if (!q) return;
      persist([q, ...recents.filter((r) => r !== q)].slice(0, RECENTS_MAX));
    },
    [recents, persist],
  );

  const clearAll = useCallback(() => persist([]), [persist]);

  return { recents, commit, clearAll };
}

/* -------------------------------------------------------------------------- */
/*  디바운스                                                                     */
/* -------------------------------------------------------------------------- */

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/* -------------------------------------------------------------------------- */
/*  화면                                                                         */
/* -------------------------------------------------------------------------- */

export default function SearchScreen() {
  const t = useTheme();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { recents, commit, clearAll } = useRecentSearches();

  const debounced = useDebounced(text, 250);
  const parsed = useMemo(() => parseSearch(debounced), [debounced]);
  const isIdle = parsed.mode === 'empty';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'search',
      parsed.mode,
      parsed.mode === 'keyword'
        ? parsed.keyword
        : parsed.mode === 'genre'
          ? parsed.genre
          : parsed.mode === 'tag'
            ? parsed.tag
            : '',
    ],
    queryFn: ({ signal }) =>
      listSeries(
        {
          page: 0,
          size: 40,
          keyword: parsed.mode === 'keyword' ? parsed.keyword : undefined,
          genre: parsed.mode === 'genre' ? parsed.genre : undefined,
          tag: parsed.mode === 'tag' ? parsed.tag : undefined,
        },
        signal,
      ),
    enabled: !isIdle,
  });

  const results = data?.content ?? [];

  const onClear = () => {
    setText('');
    inputRef.current?.focus();
  };

  const runTerm = (term: string) => {
    setText(term);
    commit(term);
    inputRef.current?.focus();
  };

  return (
    <Screen
      surface="ambient"
      edges={['top']}
      header={
        <SearchBar
          inputRef={inputRef}
          value={text}
          onChangeText={setText}
          onClear={onClear}
          onSubmit={() => commit(text)}
        />
      }
    >
      {isIdle ? (
        <IdleState
          recents={recents}
          onClearRecents={clearAll}
          onRunTerm={runTerm}
        />
      ) : isLoading ? (
        <View style={{ paddingTop: t.space.xl, alignItems: 'center' }}>
          <ActivityIndicator color={t.color.onSurfaceMuted} />
        </View>
      ) : isError ? (
        <ErrorState code="UNKNOWN" onRetry={() => void refetch()} />
      ) : results.length === 0 ? (
        <EmptyState
          title="검색 결과가 없어요"
          description="제목·작가로 검색하거나, #장르(예: #스릴러)로 찾아보세요."
        />
      ) : (
        <Results results={results} query={parsed} />
      )}
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  검색 필드(헤더 노드)                                                          */
/* -------------------------------------------------------------------------- */

function SearchBar({
  inputRef,
  value,
  onChangeText,
  onClear,
  onSubmit,
}: {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (s: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const t = useTheme();
  // 커스텀 ReactNode 헤더는 Screen이 top inset을 대신 주지 않는다(HeaderConfig만
  // ScreenHeader가 소유). 그래서 상태바/다이내믹아일랜드와 겹치지 않게 직접 inset한다.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        paddingHorizontal: t.space.sm,
        paddingTop: insets.top + t.space.xs,
        paddingBottom: t.space.sm,
      }}
    >
      <HeaderBackButton />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          height: 40,
          paddingHorizontal: t.space.md,
          borderRadius: t.radius.pill,
          backgroundColor: t.color.glassField,
          borderWidth: 1,
          borderColor: t.color.glassFieldBorder,
        }}
      >
        <Text variant="callout" style={{ color: t.color.onSurfaceMuted }}>
          ⌕
        </Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          autoFocus
          returnKeyType="search"
          placeholder="제목·작가 또는 #장르"
          placeholderTextColor={t.color.onSurfaceMuted}
          style={{
            flex: 1,
            color: t.color.onSurface,
            fontSize: t.typography.fontSize.body,
            padding: 0,
          }}
        />
        {value.length > 0 ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            hitSlop={10}
          >
            <Text variant="callout" style={{ color: t.color.onSurfaceMuted }}>
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  빈 상태 — 최근 검색어 + 장르 추천                                              */
/* -------------------------------------------------------------------------- */

function IdleState({
  recents,
  onClearRecents,
  onRunTerm,
}: {
  recents: string[];
  onClearRecents: () => void;
  onRunTerm: (term: string) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {recents.length > 0 ? (
        <View style={{ marginBottom: t.space.xl }}>
          <SectionLabel
            label="최근 검색어"
            action={{ label: '전체 삭제', onPress: onClearRecents }}
          />
          <ChipRow>
            {recents.map((r) => (
              <TermChip key={r} label={r} onPress={() => onRunTerm(r)} />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <View>
        <SectionLabel label="장르로 찾기" />
        <ChipRow>
          {GENRE_SUGGESTIONS.map((g) => (
            <TermChip
              key={g}
              label={`#${GENRE_LABEL[g]}`}
              tint={mediaColor('webtoon')}
              onPress={() => onRunTerm(`#${GENRE_LABEL[g]}`)}
            />
          ))}
        </ChipRow>
      </View>
    </ScrollView>
  );
}

function SectionLabel({
  label,
  action,
}: {
  label: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: t.space.sm,
      }}
    >
      <Text variant="label" weight="bold">
        {label}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <Text variant="caption" color="onSurfaceSecondary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
  );
}

function TermChip({
  label,
  tint,
  onPress,
}: {
  label: string;
  tint?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: tint ? `${tint}55` : t.color.border,
      }}
    >
      <Text variant="caption" weight="medium" style={{ lineHeight: 18 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  결과 — 매체 타입별 섹션                                                       */
/* -------------------------------------------------------------------------- */

function Results({
  results,
  query,
}: {
  results: SeriesSummary[];
  query: ReturnType<typeof parseSearch>;
}) {
  const t = useTheme();
  const r = useResponsive();
  const nav = useGuardedNavigation();
  const { data: types } = useContentTypes();

  // 2열 그리드 셀 폭(Screen gutter 안쪽 콘텐츠 폭 기준).
  const gutter = t.space.lg;
  const { cellWidth } = seriesGridLayout(r.width - gutter * 2, 2);

  // 레지스트리 순서로 매체별 그룹핑(빈 그룹 제외).
  const groups = useMemo(() => {
    const order = (types ?? []).map((ct) => ct.key);
    const byType = new Map<string, SeriesSummary[]>();
    for (const s of results) {
      const key = s.contentType ?? 'ETC';
      const list = byType.get(key);
      if (list) list.push(s);
      else byType.set(key, [s]);
    }
    const labelFor = (key: string) =>
      (types ?? []).find((ct) => ct.key === key)?.label ?? key;
    const sorted = [...byType.keys()].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
    return sorted.map((key) => ({ key, label: labelFor(key), items: byType.get(key)! }));
  }, [results, types]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: t.space.xl }}
    >
      <Text variant="caption" color="onSurfaceSecondary" style={{ marginBottom: t.space.sm }}>
        {query.mode === 'keyword'
          ? `'${query.keyword}' 검색 결과 ${results.length}건`
          : query.mode === 'genre'
            ? `장르 '${query.label}' ${results.length}건`
            : query.mode === 'tag'
              ? `태그 '#${query.tag}' ${results.length}건`
              : ''}
      </Text>

      {groups.map((group) => (
        <View key={group.key} style={{ marginTop: t.space.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: t.space.sm,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: mediaColor(group.key.toLowerCase()),
              }}
            />
            <Text variant="headline" weight="bold">
              {group.label}
            </Text>
            <Text variant="caption" color="onSurfaceSecondary">
              {group.items.length}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SERIES_GRID.gap }}>
            {group.items.map((s) => (
              <SeriesGridCard
                key={s.id}
                series={s}
                width={cellWidth}
                coverUrl={s.coverUrl}
                isUp={isRecentlyUpdated(s.lastPublishedAt)}
                onPress={() => nav.push({ pathname: '/series/[id]', params: { id: s.id! } })}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
