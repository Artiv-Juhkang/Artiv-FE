/**
 * Placard — 다매체 통일 "호명표". 작품을 한 줄로: [매체] · 제목 · 작가 · ▲반응.
 * 매체는 색으로 신호한다 — 앞의 얇은 틱 + 라벨이 매체색(로고 아래 헤어라인과 같은 언어).
 * 웹·일러·소설·음악이 전부 같은 포맷으로 묶여 한 갤러리가 된다(교차매체 통일).
 *
 * 타입: 라벨/제목/작가는 Pretendard(Text 프리미티브, 한글 안전). 웹 시안의 SpaceMono는
 * 한글 글리프가 없어 쓰지 않는다 — 에디토리얼 성격은 색·틱·포맷이 만든다.
 * 매체색은 mediaColor(contentType)에서(토큰); 미정의 타입은 인디고 accent로 degrade.
 */
import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../use-theme';
import { mediaColor } from '../tokens';

export type PlacardProps = {
  /** ContentType 키(webtoon/illustration/novel/audio/…) — 매체색을 결정. */
  contentType: string;
  /** 표시 라벨(레지스트리 GET /api/creativity/types 에서 온 label). */
  mediaLabel: string;
  title: string;
  author?: string;
  /** 추천 수(▲). 생략하면 미표시. */
  score?: number;
};

export function Placard({ contentType, mediaLabel, title, author, score }: PlacardProps) {
  const t = useTheme();
  const mc = mediaColor(contentType);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${mediaLabel} ${title}${author ? ` ${author}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}
    >
      {/* 매체색 틱 — 헤어라인과 같은 신호 */}
      <View
        style={{ width: 3, height: 14, borderRadius: t.radius.pill, backgroundColor: mc }}
      />
      <Text variant="caption" weight="bold" style={{ color: mc }}>
        {mediaLabel}
      </Text>
      <Text variant="caption" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {author ? (
        <Text variant="caption" color="onSurfaceMuted" numberOfLines={1}>
          · {author}
        </Text>
      ) : null}
      {score != null ? (
        <Text variant="caption" weight="bold" style={{ color: t.color.badgeUp, marginLeft: 'auto' }}>
          ▲ {score}
        </Text>
      ) : null}
    </View>
  );
}
