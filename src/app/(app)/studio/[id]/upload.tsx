/**
 * 회차 올리기 — 작품에 새 회차 업로드(POST /api/series/{id}/episodes).
 *
 * 자산 종류(이미지/텍스트/오디오)는 작품 타입이 결정한다(레지스트리 assetKinds). 그에 맞는
 * 선택기로 파일을 고르고, 파트명은 'images'로 통일해 전송한다. v1은 즉시 발행(예약 발행은 후속).
 */
import { useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Alert, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { uploadEpisode } from '@/api/endpoints/episodes';
import type { RNFilePart } from '@/api/multipart';
import { useContentTypes } from '@/features/creativity/hooks';
import { useRequireRole } from '@/features/auth';
import { useSeriesDetail } from '@/features/series/hooks';
import { pickAssets } from '@/features/studio/pickers';
import { Field } from '@/features/studio/components';
import { keys } from '@/lib/query';
import { Button, Screen, Skeleton, Text, useTheme } from '@/ui';

type AssetKind = 'IMAGE' | 'TEXT' | 'AUDIO';

const KIND_LABEL: Record<AssetKind, { pick: string; noun: string }> = {
  IMAGE: { pick: '이미지 선택', noun: '이미지' },
  TEXT: { pick: '본문 파일 선택(.txt)', noun: '본문 파일' },
  AUDIO: { pick: '오디오 파일 선택', noun: '트랙' },
};

export default function EpisodeUploadScreen() {
  const { allowed, loading } = useRequireRole('CREATOR');
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = Number(id);
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: series, isLoading: seriesLoading } = useSeriesDetail(seriesId);
  const { data: types } = useContentTypes();

  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<RNFilePart[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Screen header={{ variant: 'solid', back: true, title: '회차 올리기' }}><View /></Screen>;
  if (!allowed) return <Redirect href={'/creator-request' as Href} />;

  const assetKind: AssetKind =
    (types?.find((c) => c.key === series?.contentType)?.assetKinds?.[0] as AssetKind) ?? 'IMAGE';
  const labels = KIND_LABEL[assetKind];

  const onPick = async () => {
    const picked = await pickAssets(assetKind);
    if (picked.length > 0) setFiles(picked);
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      Alert.alert('회차 제목', '회차 제목을 입력해 주세요(예: 1화).');
      return;
    }
    if (files.length === 0) {
      Alert.alert('자산 선택', `${labels.noun}을(를) 먼저 선택해 주세요.`);
      return;
    }
    setSubmitting(true);
    try {
      await uploadEpisode(seriesId, { title: title.trim(), files });
      await qc.invalidateQueries({ queryKey: keys.episodes.list(seriesId) });
      await qc.invalidateQueries({ queryKey: keys.series.detail(seriesId) });
      await qc.invalidateQueries({ queryKey: keys.series.mine() });
      await qc.invalidateQueries({ queryKey: keys.creativity.all });
      Alert.alert('업로드 완료', '새 회차가 발행됐어요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('업로드 실패', '파일 형식이 작품 타입과 맞는지 확인하고 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll header={{ variant: 'solid', back: true, title: '회차 올리기' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
        {seriesLoading ? (
          <Skeleton height={24} width="60%" />
        ) : (
          <Text variant="headline" weight="semibold" numberOfLines={1}>
            {series?.title ?? '작품'}
          </Text>
        )}

        <Field label="회차 제목" value={title} onChangeText={setTitle} placeholder="예: 1화" />

        <View style={{ gap: t.space.xs }}>
          <Text variant="label" color="onSurfaceSecondary">
            콘텐츠
          </Text>
          <Button label={labels.pick} variant="secondary" onPress={onPick} />
          {files.length > 0 ? (
            <Text variant="caption" color="onSurfaceSecondary">
              {files.length}개 {labels.noun} 선택됨
            </Text>
          ) : null}
        </View>

        <Button label="회차 발행" fullWidth loading={submitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}
