/**
 * 글 수정 (C4) — 텍스트 필드만(카테고리·제목·본문, 이미지 교체는 확정 D-확2로 범위 밖).
 * 상세 캐시(usePost)로 기존 값을 프리필하고, 저장 시 상세·피드 invalidate 후 뒤로.
 * 작성자 전용 — 진입 버튼 자체가 소유자에게만 노출되고(상세 헤더), 서버도 403으로 이중 방어.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updatePost } from '@/api/endpoints/posts';
import { CategoryPicker } from '@/features/community/CategoryPicker';
import { usePost } from '@/features/community/hooks';
import { Field } from '@/features/studio/components';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { keys } from '@/lib/query';
import { Button, ErrorState, Screen, Skeleton, useReadingSurface, useTheme, useToast } from '@/ui';

export default function PostEditScreen() {
  const t = useTheme();
  useReadingSurface(); // '추천' 모드에서는 글 수정도 라이트로 opt-in(M1, 글 작성과 동일 취급)
  const toast = useToast();
  const qc = useQueryClient();
  const nav = useGuardedNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const post = usePost(postId);

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [seeded, setSeeded] = useState(false);

  // 상세 데이터 도착 시 1회 프리필(이후 사용자의 입력을 덮지 않음).
  useEffect(() => {
    if (seeded || !post.data) return;
    setCategory(post.data.category ?? '');
    setTitle(post.data.title ?? '');
    setContent(post.data.content ?? '');
    setSeeded(true);
  }, [seeded, post.data]);

  const saveMut = useMutation<void, Error, void>({
    mutationFn: () => updatePost(postId, { category, title: title.trim(), content: content.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.posts.detail(postId) });
      qc.invalidateQueries({ queryKey: keys.posts.all });
      toast.show({ message: '글을 수정했어요.' });
      nav.back();
    },
    onError: () => toast.show({ tone: 'danger', message: '수정에 실패했어요. 잠시 후 다시 시도해 주세요.' }),
  });

  if (post.isLoading) {
    return (
      <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '글 수정' }}>
        <View style={{ gap: t.space.md, paddingVertical: t.space.md }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="100%" height={48} radius="md" />
          <Skeleton width="100%" height={96} radius="md" />
        </View>
      </Screen>
    );
  }
  if (post.isError || !post.data) {
    return (
      <Screen surface="ambient" header={{ variant: 'ambient', back: true, title: '글 수정' }}>
        <ErrorState code="ENTITY_NOT_FOUND" onRetry={() => void post.refetch()} />
      </Screen>
    );
  }

  const canSubmit =
    category.length > 0 && title.trim().length > 0 && content.trim().length > 0 && !saveMut.isPending;

  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: '글 수정' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.md }}>
        <CategoryPicker value={category} onChange={setCategory} />
        <Field label="제목" value={title} onChangeText={setTitle} placeholder="제목을 입력하세요" />
        <Field
          label="본문"
          value={content}
          onChangeText={setContent}
          placeholder="이야기를 들려주세요"
          multiline
        />
        <Button
          label="저장"
          variant="primary"
          fullWidth
          loading={saveMut.isPending}
          disabled={!canSubmit}
          onPress={() => saveMut.mutate()}
        />
      </View>
    </Screen>
  );
}
