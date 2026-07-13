/**
 * 문의 작성 (M2) — 유형·제목·본문 + 이미지 ≤5장(jpeg/png).
 * posts/new.tsx와 동일한 폼 부품(Field·ChipSelect·DropZone) 재사용.
 * 성공 시 목록 invalidate 후 작성된 문의 상세로 replace(뒤로가면 목록).
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { RNFilePart } from '@/api/multipart';
import type { InquiryType } from '@/api/types';
import { INQUIRY_TYPES, INQUIRY_TYPE_LABEL } from '@/features/inquiry/categories';
import { useCreateInquiry } from '@/features/inquiry/hooks';
import { ChipSelect, Field } from '@/features/studio/components';
import { DropZone } from '@/features/studio/DropZone';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { Button, Screen, Text, useTheme, useToast } from '@/ui';

const MAX_IMAGES = 5; // 백엔드 InquiryService.MAX_IMAGES 미러(초과는 서버 400 — 클라 선차단)

export default function InquiryNewScreen() {
  const t = useTheme();
  const toast = useToast();
  const nav = useGuardedNavigation();

  const [type, setType] = useState<InquiryType>('ACCOUNT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<RNFilePart[]>([]);

  const createMut = useCreateInquiry();

  const onAddImages = (parts: RNFilePart[]) => {
    setImages((prev) => {
      const next = [...prev, ...parts];
      if (next.length > MAX_IMAGES) {
        toast.show({ tone: 'danger', message: `이미지는 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.` });
        return next.slice(0, MAX_IMAGES);
      }
      return next;
    });
  };

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !createMut.isPending;

  const onSubmit = () => {
    if (!canSubmit) return;
    createMut.mutate(
      { type, title: title.trim(), content: content.trim(), images },
      {
        onSuccess: ({ id }) => nav.replace({ pathname: '/inquiries/[id]', params: { id } }),
        onError: () => toast.show({ tone: 'danger', message: '문의 등록에 실패했어요. 잠시 후 다시 시도해 주세요.' }),
      },
    );
  };

  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: '문의하기' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.md }}>
        <ChipSelect
          label="유형"
          options={INQUIRY_TYPES.map((v) => ({ value: v, label: INQUIRY_TYPE_LABEL[v] }))}
          value={type}
          onChange={setType}
        />
        <Field label="제목" value={title} onChangeText={setTitle} placeholder="제목을 입력하세요" />
        <Field
          label="내용"
          value={content}
          onChangeText={setContent}
          placeholder="어떤 점이 궁금하거나 불편하셨나요?"
          multiline
        />

        <View style={{ gap: t.space.sm }}>
          <Text variant="label" color="onSurfaceSecondary">
            이미지 ({images.length}/{MAX_IMAGES})
          </Text>
          {images.length < MAX_IMAGES ? <DropZone assetKind="IMAGE" onAdd={onAddImages} /> : null}
          {images.map((im, i) => (
            <View
              key={`${im.name}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space.sm,
                paddingHorizontal: t.space.md,
                paddingVertical: t.space.sm,
                borderRadius: t.radius.md,
                backgroundColor: t.color.surfaceSunken,
              }}
            >
              <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                {im.name}
              </Text>
              <Pressable
                onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                accessibilityRole="button"
                accessibilityLabel={`${im.name} 제거`}
                hitSlop={8}
              >
                <Text variant="caption" color="danger" weight="semibold">
                  제거
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Button
          label="등록"
          variant="primary"
          fullWidth
          loading={createMut.isPending}
          disabled={!canSubmit}
          onPress={onSubmit}
        />
      </View>
    </Screen>
  );
}
