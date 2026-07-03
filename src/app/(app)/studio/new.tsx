/**
 * 새 작품 만들기 — 작품 메타 생성(POST /api/series) + 선택적 커버 업로드.
 *
 * contentType 옵션은 레지스트리(useContentTypes)에서 동적으로(타입=데이터). 성인전용은
 * 백엔드 불변식상 19세 이용가여야 하므로 제출 전 검증한다. 생성 후 회차 업로드 화면으로 이동.
 */
import { useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import { createSeries, uploadCover, type CreateSeriesBody } from '@/api/endpoints/series';
import type { AgeRating, DayOfWeek, Genre, SeriesStatus } from '@/api/types';
import type { RNFilePart } from '@/api/multipart';
import { useContentTypes } from '@/features/creativity/hooks';
import { useRequireRole } from '@/features/auth';
import { pickCover } from '@/features/studio/pickers';
import { ChipMulti, ChipSelect, Field, type ChipOption } from '@/features/studio/components';
import { keys } from '@/lib/query';
import { Button, Screen, Text, useTheme, useToast } from '@/ui';

const AGE_OPTIONS: ChipOption<AgeRating>[] = [
  { value: 'ALL', label: '전체' },
  { value: 'AGE_12', label: '12세' },
  { value: 'AGE_15', label: '15세' },
  { value: 'AGE_19', label: '19세' },
];
const STATUS_OPTIONS: ChipOption<SeriesStatus>[] = [
  { value: 'ONGOING', label: '연재중' },
  { value: 'COMPLETED', label: '완결' },
  { value: 'HIATUS', label: '휴재' },
];
const GENRE_OPTIONS: ChipOption<Genre>[] = [
  { value: 'ROMANCE', label: '로맨스' },
  { value: 'FANTASY', label: '판타지' },
  { value: 'ACTION', label: '액션' },
  { value: 'DRAMA', label: '드라마' },
  { value: 'DAILY', label: '일상' },
  { value: 'COMEDY', label: '코미디' },
  { value: 'THRILLER', label: '스릴러' },
  { value: 'SPORTS', label: '스포츠' },
  { value: 'HORROR', label: '공포' },
  { value: 'ETC', label: '기타' },
];
const DAY_OPTIONS: ChipOption<DayOfWeek>[] = [
  { value: 'MONDAY', label: '월' },
  { value: 'TUESDAY', label: '화' },
  { value: 'WEDNESDAY', label: '수' },
  { value: 'THURSDAY', label: '목' },
  { value: 'FRIDAY', label: '금' },
  { value: 'SATURDAY', label: '토' },
  { value: 'SUNDAY', label: '일' },
];

export default function NewSeriesScreen() {
  const { allowed, loading } = useRequireRole('CREATOR');
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { show } = useToast();
  const { data: types } = useContentTypes();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState('WEBTOON');
  const [ageRating, setAgeRating] = useState<AgeRating>('ALL');
  const [status, setStatus] = useState<SeriesStatus>('ONGOING');
  const [genre, setGenre] = useState<Genre>('ETC');
  const [tagsText, setTagsText] = useState('');
  const [adultOnly, setAdultOnly] = useState(false);
  const [days, setDays] = useState<DayOfWeek[]>([]);
  const [cover, setCover] = useState<RNFilePart | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Screen header={{ variant: 'solid', back: true, title: '새 작품' }}><View /></Screen>;
  if (!allowed) return <Redirect href={'/creator-request' as Href} />;

  const typeOptions: ChipOption<string>[] =
    (types ?? []).map((c) => ({ value: c.key, label: c.label }));
  const isWebtoon = contentType === 'WEBTOON';

  const onPickCover = async () => {
    const file = await pickCover();
    if (file) setCover(file);
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      show({ message: '작품 제목을 입력해 주세요.', tone: 'danger' });
      return;
    }
    if (adultOnly && ageRating !== 'AGE_19') {
      show({ message: '성인 전용(19금)은 연령등급을 19세로 설정해야 해요.', tone: 'danger' });
      return;
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const body: CreateSeriesBody = {
      title: title.trim(),
      description: description.trim() || undefined,
      ageRating,
      status,
      contentType,
      adultOnly,
      genre,
      tags,
      publishDays: isWebtoon && days.length > 0 ? days : undefined,
    };

    setSubmitting(true);
    try {
      const { id } = await createSeries(body);
      if (cover) {
        try {
          await uploadCover(id, cover);
        } catch {
          // 커버 실패는 작품 생성을 무르지 않는다 — 나중에 스튜디오에서 재설정 가능.
        }
      }
      await qc.invalidateQueries({ queryKey: keys.series.mine() });
      await qc.invalidateQueries({ queryKey: keys.creativity.all });
      router.replace({ pathname: '/studio/[id]/upload', params: { id } } as unknown as Href);
    } catch {
      show({ message: '작품 생성에 실패했어요. 잠시 후 다시 시도해 주세요.', tone: 'danger' });
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll header={{ variant: 'solid', back: true, title: '새 작품' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
        <Field label="제목" value={title} onChangeText={setTitle} placeholder="작품 제목" />
        <Field
          label="소개"
          value={description}
          onChangeText={setDescription}
          placeholder="작품을 한두 문장으로 소개해 주세요."
          multiline
        />
        {typeOptions.length > 0 ? (
          <ChipSelect label="매체" options={typeOptions} value={contentType} onChange={setContentType} />
        ) : null}
        <ChipSelect label="연령등급" options={AGE_OPTIONS} value={ageRating} onChange={setAgeRating} />
        <ChipSelect label="연재 상태" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <ChipSelect label="장르" options={GENRE_OPTIONS} value={genre} onChange={setGenre} />
        {isWebtoon ? (
          <ChipMulti
            label="연재 요일"
            options={DAY_OPTIONS}
            values={days}
            onToggle={(d) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
          />
        ) : null}
        <Field label="태그 (쉼표로 구분)" value={tagsText} onChangeText={setTagsText} placeholder="예: 로맨스, 여름" />
        <ChipSelect
          label="성인 전용"
          options={[
            { value: 'no', label: '아니오' },
            { value: 'yes', label: '19금' },
          ]}
          value={adultOnly ? 'yes' : 'no'}
          onChange={(v) => setAdultOnly(v === 'yes')}
        />

        <View style={{ gap: t.space.xs }}>
          <Text variant="label" color="onSurfaceSecondary">
            커버 이미지 (선택)
          </Text>
          {cover ? (
            <Image
              source={{ uri: cover.uri }}
              contentFit="cover"
              style={{
                width: 120,
                height: 160,
                borderRadius: t.radius.md,
                backgroundColor: t.color.surfaceSunken,
              }}
            />
          ) : null}
          <Button label={cover ? '커버 선택됨 · 변경' : '커버 이미지 선택'} variant="secondary" onPress={onPickCover} />
        </View>

        <Button label="작품 만들기" fullWidth loading={submitting} onPress={onSubmit} />
      </View>
    </Screen>
  );
}
