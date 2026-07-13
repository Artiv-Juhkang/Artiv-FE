/**
 * CategoryPicker — 게시글 카테고리 등록제(C7) 선택 + 등록.
 * 레지스트리(usePostCategories)를 ChipSelect로 보여주고, '+ 새 카테고리'로
 * 그 자리에서 등록(POST /api/post-categories)한 뒤 바로 선택 상태로 전환한다.
 * 이름 자체가 표시 라벨이라 별도 라벨 매핑이 없다.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useCreatePostCategory, usePostCategories } from '@/features/community/hooks';
import { Field } from '@/features/studio/components';
import { ChipSelect } from '@/features/studio/components';
import { isAppError } from '@/lib/errors';
import { Button, ErrorState, Skeleton, Text, useTheme, useToast } from '@/ui';

const MAX_NAME_LENGTH = 20;

export function CategoryPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const t = useTheme();
  const toast = useToast();
  const categories = usePostCategories();
  const createMut = useCreatePostCategory();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // 값이 비어 있으면(초기 진입) 목록 도착 즉시 첫 카테고리를 기본 선택 — 칩이 아무것도
  // 안 골라진 채로 뜨는 걸 방지(서버 데이터라 컴파일 타임에 기본값을 알 수 없다).
  useEffect(() => {
    if (!value && categories.data && categories.data.length > 0) {
      onChange(categories.data[0].name!);
    }
  }, [value, categories.data, onChange]);

  const onCreate = () => {
    const name = newName.trim();
    if (!name || createMut.isPending) return;
    createMut.mutate(name, {
      onSuccess: (created) => {
        onChange(created.name!);
        setNewName('');
        setAdding(false);
      },
      onError: (e) => {
        const dup = isAppError(e) && e.code === 'DUPLICATE_POST_CATEGORY';
        toast.show({
          tone: 'danger',
          message: dup ? '이미 있는 카테고리예요.' : '카테고리 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',
        });
      },
    });
  };

  if (categories.isLoading) {
    return (
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" color="onSurfaceSecondary">
          카테고리
        </Text>
        <Skeleton width="60%" height={36} radius="pill" />
      </View>
    );
  }
  if (categories.isError) {
    return <ErrorState code="UNKNOWN" onRetry={() => void categories.refetch()} />;
  }

  const options = (categories.data ?? []).map((c) => ({ value: c.name!, label: c.name! }));

  return (
    <View style={{ gap: t.space.sm }}>
      <ChipSelect label="카테고리" options={options} value={value} onChange={onChange} />
      {adding ? (
        <View style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              label="새 카테고리 이름"
              value={newName}
              onChangeText={(v) => setNewName(v.slice(0, MAX_NAME_LENGTH))}
              placeholder="최대 20자"
            />
          </View>
          <Button label="등록" size="sm" loading={createMut.isPending} onPress={onCreate} />
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="새 카테고리 추가">
          <Text variant="caption" color="accent" weight="semibold">
            + 새 카테고리
          </Text>
        </Pressable>
      )}
    </View>
  );
}
