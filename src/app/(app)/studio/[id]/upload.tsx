/**
 * 회차 올리기 — 작품에 새 회차 업로드(POST /api/series/{id}/episodes).
 *
 * 데스크톱/웹 우선으로 재작성: 자산을 드래그앤드롭(웹)/피커(네이티브)로 여러 번 나눠 추가하고,
 * 콘택트 시트(썸네일 그리드)에서 미리보고 순서를 바꾼다. 배열 순서가 곧 백엔드 'images' 파트
 * 순서(웹툰은 위→아래 읽기 순)라 인덱스 배지가 순서 변경 시 즉시 다시 매겨진다. 업로드 진행률은
 * 단일 multipart POST 의 전체 바이트 기준 하나의 정직한 막대로 보여주고, 취소를 지원한다.
 *
 * 피드백은 useToast + 인라인 에러다(Alert.alert 은 react-native-web 에서 no-op → 웹에서
 * 검증/에러/성공콜백이 전부 사라진다). 성공 시 Alert 버튼 콜백이 아니라 직접 router.back() 한다.
 * 자산 종류(이미지/텍스트/오디오)는 작품 타입이 결정한다(레지스트리 assetKinds).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import { uploadEpisode } from '@/api/endpoints/episodes';
import type { RNFilePart } from '@/api/multipart';
import { useContentTypes } from '@/features/creativity/hooks';
import { useRequireRole } from '@/features/auth';
import { useSeriesDetail } from '@/features/series/hooks';
import { DropZone } from '@/features/studio/DropZone';
import { ACCEPTED_IMAGE_TYPES, type AssetKind } from '@/features/studio/pickers';
import { Field } from '@/features/studio/components';
import { keys } from '@/lib/query';
import {
  Button,
  ProgressBar,
  Screen,
  Skeleton,
  Text,
  useResponsive,
  useTheme,
  useToast,
} from '@/ui';

const NOUN: Record<AssetKind, string> = { IMAGE: '이미지', TEXT: '본문 파일', AUDIO: '트랙' };

const partKey = (p: RNFilePart): string => `${p.name}::${p.uri}`;
const isBlobUri = (uri: string): boolean => uri.startsWith('blob:');

export default function EpisodeUploadScreen() {
  const { allowed, loading } = useRequireRole('CREATOR');
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = Number(id);
  const t = useTheme();
  const r = useResponsive();
  const router = useRouter();
  const qc = useQueryClient();
  const { show } = useToast();

  const { data: series, isLoading: seriesLoading } = useSeriesDetail(seriesId);
  const { data: types } = useContentTypes();

  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<RNFilePart[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pct, setPct] = useState(0);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Revoke web object URLs on unmount so large (40-image) sets don't leak.
  // Keep a ref of the latest files (updated in an effect, never during render)
  // so the unmount-only cleanup sees the final set.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(
    () => () => {
      for (const f of filesRef.current) if (isBlobUri(f.uri)) URL.revokeObjectURL(f.uri);
    },
    [],
  );

  const addFiles = useCallback((parts: RNFilePart[]) => {
    setFilesError(null);
    setFiles((prev) => {
      const seen = new Set(prev.map(partKey));
      const next = [...prev];
      for (const p of parts) {
        if (!seen.has(partKey(p))) {
          seen.add(partKey(p));
          next.push(p);
        }
      }
      return next;
    });
  }, []);

  const removeAt = useCallback((i: number) => {
    setFiles((prev) => {
      const target = prev[i];
      if (target && isBlobUri(target.uri)) URL.revokeObjectURL(target.uri);
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  const move = useCallback((from: number, to: number) => {
    setFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Screen header={{ variant: 'solid', back: true, title: '회차 올리기' }}>
        <View />
      </Screen>
    );
  }
  if (!allowed) return <Redirect href={'/creator-request' as Href} />;

  const assetKind: AssetKind =
    (types?.find((c) => c.key === series?.contentType)?.assetKinds?.[0] as AssetKind) ?? 'IMAGE';
  const noun = NOUN[assetKind];
  const isImage = assetKind === 'IMAGE';

  const onSubmit = async () => {
    if (submitting) return;
    let ok = true;
    if (!title.trim()) {
      setTitleError('회차 제목을 입력해 주세요(예: 1화).');
      ok = false;
    } else {
      setTitleError(null);
    }
    if (files.length === 0) {
      setFilesError(`${noun}을(를) 먼저 추가해 주세요.`);
      ok = false;
    } else if (isImage && files.some((f) => !ACCEPTED_IMAGE_TYPES.includes(f.type))) {
      setFilesError('이미지는 JPG · PNG 형식만 올릴 수 있어요.');
      ok = false;
    } else {
      setFilesError(null);
    }
    if (!ok) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true);
    setPct(0);
    try {
      await uploadEpisode(seriesId, {
        title: title.trim(),
        files,
        onProgress: (p) => setPct(p.pct),
        signal: controller.signal,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.episodes.list(seriesId) }),
        qc.invalidateQueries({ queryKey: keys.series.detail(seriesId) }),
        qc.invalidateQueries({ queryKey: keys.series.mine() }),
        qc.invalidateQueries({ queryKey: keys.creativity.all }),
      ]);
      // 웹에서 Alert 은 no-op → 콜백에 의존하지 않고 직접 이동 + 토스트로 확인.
      show({ message: '새 회차가 발행됐어요.', tone: 'success' });
      router.back();
    } catch {
      if (controller.signal.aborted) {
        // 사용자 취소 — 조용히 종료(에러 아님).
      } else {
        show({
          message: '업로드에 실패했어요. 파일 형식이 작품 타입과 맞는지 확인해 주세요.',
          tone: 'danger',
        });
      }
    } finally {
      setSubmitting(false);
      abortRef.current = null;
    }
  };

  const columns = isImage ? r.select({ phone: 3, tablet: 4, large: 5 }) ?? 3 : 1;
  const gap = t.space.sm;
  const tile = gridWidth > 0 ? Math.floor((gridWidth - gap * (columns - 1)) / columns) : 0;

  return (
    <Screen
      scroll
      maxWidth={960}
      header={{ variant: 'solid', back: true, title: '회차 올리기' }}
      footer={
        <View style={{ gap: t.space.sm }}>
          {submitting ? (
            <View style={{ gap: t.space.xs }}>
              <ProgressBar value={pct} />
              <Text variant="caption" color="onSurfaceSecondary">
                {pct}% 업로드 중…
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            {submitting ? (
              <View style={{ flex: 1 }}>
                <Button
                  label="취소"
                  variant="secondary"
                  fullWidth
                  onPress={() => abortRef.current?.abort()}
                />
              </View>
            ) : null}
            <View style={{ flex: 2 }}>
              <Button label="회차 발행" fullWidth loading={submitting} onPress={onSubmit} />
            </View>
          </View>
        </View>
      }
    >
      <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
        {seriesLoading ? (
          <Skeleton height={24} width="60%" />
        ) : (
          <Text variant="headline" weight="semibold" numberOfLines={1}>
            {series?.title ?? '작품'}
          </Text>
        )}

        <View style={{ gap: t.space.xs }}>
          <Field label="회차 제목" value={title} onChangeText={setTitle} placeholder="예: 1화" />
          {titleError ? (
            <Text variant="caption" color="danger">
              {titleError}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: t.space.sm }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text variant="label" color="onSurfaceSecondary">
              콘텐츠
            </Text>
            {files.length > 0 ? (
              <Text variant="caption" color="onSurfaceMuted">
                {files.length}개 · 순서대로 발행
              </Text>
            ) : null}
          </View>

          <View pointerEvents={submitting ? 'none' : 'auto'} style={{ opacity: submitting ? 0.5 : 1 }}>
            <DropZone assetKind={assetKind} onAdd={addFiles} />
          </View>

          {filesError ? (
            <Text variant="caption" color="danger">
              {filesError}
            </Text>
          ) : null}

          {files.length > 0 ? (
            isImage ? (
              <View
                onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
              >
                {files.map((f, i) => (
                  <View key={partKey(f)} style={{ width: tile || undefined }}>
                    <View>
                      <Image
                        source={{ uri: f.uri }}
                        contentFit="cover"
                        style={{
                          width: tile || '100%',
                          height: tile || 120,
                          borderRadius: t.radius.md,
                          backgroundColor: t.color.surfaceSunken,
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          backgroundColor: t.color.accent,
                          borderRadius: t.radius.pill,
                          minWidth: 20,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          alignItems: 'center',
                        }}
                      >
                        <Text variant="micro" weight="bold" style={{ color: '#FFFFFF' }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removeAt(i)}
                        accessibilityRole="button"
                        accessibilityLabel={`${i + 1}번째 ${noun} 제거`}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 22,
                          height: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: t.radius.pill,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                        }}
                      >
                        <Text variant="caption" weight="bold" style={{ color: '#FFFFFF' }}>
                          ×
                        </Text>
                      </Pressable>
                    </View>
                    <View
                      style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}
                    >
                      <OrderButton
                        label="◀"
                        a11y={`${i + 1}번째를 앞으로`}
                        disabled={i === 0}
                        onPress={() => move(i, i - 1)}
                      />
                      <OrderButton
                        label="▶"
                        a11y={`${i + 1}번째를 뒤로`}
                        disabled={i === files.length - 1}
                        onPress={() => move(i, i + 1)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: t.space.sm }}>
                {files.map((f, i) => (
                  <View
                    key={partKey(f)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: t.space.sm,
                      padding: t.space.md,
                      borderRadius: t.radius.md,
                      backgroundColor: t.color.surfaceSunken,
                    }}
                  >
                    <Text variant="caption" weight="bold" style={{ color: t.color.accent }}>
                      {i + 1}
                    </Text>
                    <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                      {f.name}
                    </Text>
                    <OrderButton
                      label="▲"
                      a11y={`${i + 1}번째를 위로`}
                      disabled={i === 0}
                      onPress={() => move(i, i - 1)}
                    />
                    <OrderButton
                      label="▼"
                      a11y={`${i + 1}번째를 아래로`}
                      disabled={i === files.length - 1}
                      onPress={() => move(i, i + 1)}
                    />
                    <OrderButton label="×" a11y={`${i + 1}번째 제거`} onPress={() => removeAt(i)} />
                  </View>
                ))}
              </View>
            )
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function OrderButton({
  label,
  a11y,
  onPress,
  disabled,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        minWidth: 32,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: t.radius.sm,
        backgroundColor: t.color.surfaceSunken,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Text variant="caption" weight="semibold" color="onSurfaceSecondary">
        {label}
      </Text>
    </Pressable>
  );
}
