/**
 * SeriesGallery — 단일물(비연재) 작품의 이미지 갤러리.
 *
 * 일러스트·사진·디자인·손그림처럼 '회차'가 아닌 단일 작품은, 인스타그램 게시물처럼
 * 여러 장의 사진을 가로 스와이프로 넘겨 본다(웹툰의 회차 목록 대신). 사진을 누르면
 * 화면 전체 뷰어(Modal, 검은 배경, contain)로 크게 본다.
 *
 * 데이터는 현재 모델에서 가능한 단 하나의 이미지 보관처인 회차 1의 images[] 를 재사용한다
 * (episode_no NOT NULL 단계 — 진짜 단일물 모델은 백엔드 후속 작업). getEpisode 가
 * 연령/잠금 게이팅(403/200+locked)을 그대로 수행하므로 여기선 그 결과만 분기한다.
 *
 * 상태: 로딩(skeleton) / 작품없음·404(빈 상태) / 그 외 에러 / 갤러리.
 */
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEpisode } from '@/api/endpoints/episodes';
import type { EpisodeImage } from '@/api/types';
import { isAppError } from '@/lib/errors';
import { keys } from '@/lib/query';
import { AppImage } from '@/ui/AppImage';
import { EmptyState, ErrorState, Skeleton, Text, useTheme } from '@/ui';

export function SeriesGallery({ seriesId }: { seriesId: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [viewerAt, setViewerAt] = useState<number | null>(null);

  // 단일물 = 회차 1. 회차가 아직 없으면 404 → 빈 상태(에러 아님)이므로 retry 끔.
  const { data, isLoading, isError, error } = useQuery({
    queryKey: keys.episodes.detail(seriesId, 1),
    queryFn: () => getEpisode(seriesId, 1),
    retry: false,
  });

  const images = (data?.images ?? []).filter((im): im is EpisodeImage => !!im.url);

  if (isLoading) return <Skeleton height={320} radius="lg" />;

  if (isError) {
    const code = isAppError(error) ? error.code : 'UNKNOWN';
    if (code === 'ENTITY_NOT_FOUND') return <GalleryEmpty />;
    return (
      <ErrorState code="UNKNOWN" message={isAppError(error) ? error.message : undefined} />
    );
  }

  if (images.length === 0) return <GalleryEmpty />;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={images}
          keyExtractor={(im, i) => `${im.sortOrder ?? i}`}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index: i }) => (
            <Pressable
              onPress={() => setViewerAt(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${i + 1}번째 사진 크게 보기`}
            >
              <View
                style={{
                  width,
                  height: width, // 1:1 — 작품 전체를 contain으로 담는다(크롭 없음).
                  borderRadius: t.radius.lg,
                  overflow: 'hidden',
                  backgroundColor: t.color.surfaceSunken,
                }}
              >
                <AppImage url={item.url} contentFit="contain" style={{ width: '100%', height: '100%' }} />
              </View>
            </Pressable>
          )}
        />
      ) : null}

      {/* 페이지 인디케이터 — 2장 이상일 때만. */}
      {images.length > 1 ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: t.space.sm }}
        >
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? t.color.onSurface : t.color.onSurfaceMuted,
              }}
            />
          ))}
        </View>
      ) : null}

      {viewerAt !== null ? (
        <FullScreenViewer
          images={images}
          initialIndex={viewerAt}
          onClose={() => setViewerAt(null)}
        />
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  FullScreenViewer — 검은 배경 위 전체화면 사진 뷰어(가로 스와이프, contain).   */
/* -------------------------------------------------------------------------- */

function FullScreenViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: EpisodeImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={images}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(im, i) => `${im.sortOrder ?? i}`}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center' }}>
              <AppImage url={item.url} contentFit="contain" style={{ width, height }} />
            </View>
          )}
        />

        {/* 닫기 — 좌상단(safe-area). */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={12}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        >
          <Text variant="headline" weight="bold" style={{ color: '#fff' }}>
            ✕
          </Text>
        </Pressable>

        {/* N / M 인디케이터 — 하단(safe-area). */}
        {images.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              bottom: insets.bottom + 16,
              alignSelf: 'center',
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          >
            <Text variant="caption" style={{ color: '#fff' }}>
              {index + 1} / {images.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function GalleryEmpty() {
  return (
    <EmptyState
      title="아직 공개된 작품이 없어요"
      description="작가가 작품을 올리면 여기에서 바로 볼 수 있어요."
    />
  );
}
