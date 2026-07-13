/**
 * 글 작성 (C3) — 카테고리·제목·본문 + 이미지 ≤5장(jpeg/png).
 *
 * 폼 부품은 스튜디오와 공유(Field·ChipSelect), 이미지 획득은 DropZone
 * (네이티브=피커 / 웹=드래그앤드롭 — 플랫폼 파일 분기)을 그대로 재사용한다.
 * 성공 시 피드 invalidate 후 작성된 글 상세로 replace(뒤로가면 피드).
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createPost } from '@/api/endpoints/posts';
import type { RNFilePart } from '@/api/multipart';
import type { PostCategory } from '@/api/types';
import { POST_CATEGORIES, POST_CATEGORY_LABEL } from '@/features/community/categories';
import { ChipSelect, Field } from '@/features/studio/components';
import { DropZone } from '@/features/studio/DropZone';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { keys } from '@/lib/query';
import { Button, Screen, Text, useReadingSurface, useTheme, useToast } from '@/ui';

const MAX_IMAGES = 5; // 백엔드 PostService.MAX_IMAGES 미러(초과는 서버 400 — 클라 선차단)

export default function PostNewScreen() {
  const t = useTheme();
  useReadingSurface(); // '추천' 모드에서는 글 작성도 라이트로 opt-in(M1)
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useGuardedNavigation();

  const [category, setCategory] = useState<PostCategory>('FREE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<RNFilePart[]>([]);

  const createMut = useMutation<{ id: number }, Error, void>({
    mutationFn: () => createPost({ category, title: title.trim(), content: content.trim(), images }),
    onSuccess: ({ id }) => {
      // 피드 목록 재동기 후 상세로 교체 진입(뒤로가면 피드로).
      qc.invalidateQueries({ queryKey: keys.posts.all });
      nav.replace({ pathname: '/posts/[id]', params: { id } });
    },
    onError: () => toast.show({ tone: 'danger', message: '글 등록에 실패했어요. 잠시 후 다시 시도해 주세요.' }),
  });

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

  return (
    <Screen
      scroll
      surface="ambient"
      header={{ variant: 'ambient', back: true, title: '글쓰기' }}
    >
      <View style={{ gap: t.space.lg, paddingVertical: t.space.md }}>
        <ChipSelect
          label="카테고리"
          options={POST_CATEGORIES.map((c) => ({ value: c, label: POST_CATEGORY_LABEL[c] }))}
          value={category}
          onChange={setCategory}
        />
        <Field label="제목" value={title} onChangeText={setTitle} placeholder="제목을 입력하세요" />
        <Field
          label="본문"
          value={content}
          onChangeText={setContent}
          placeholder="이야기를 들려주세요"
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
          onPress={() => createMut.mutate()}
        />
      </View>
    </Screen>
  );
}
