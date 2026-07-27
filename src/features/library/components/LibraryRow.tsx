/**
 * LibraryRow — one work row in 서재 (관심 / 열람). Pure presentation.
 * ------------------------------------------------------------------
 * The thumbnail shows the real cover (SubscriptionResponse / ReadHistoryResponse
 * both carry `coverUrl` — the V25 cover_url seam) over a tinted box that shows
 * through while loading or when the work has no cover. The row is text-led:
 * title + a single meta line, with an optional UP badge for a new episode on a
 * 관심 work. Tapping opens the series detail (parent injects).
 */
import { Pressable, View } from 'react-native';

import { AppImage } from '@/ui/AppImage';
import { Badge, Card, Text, useTheme } from '@/ui';

export type LibraryRowProps = {
  title: string;
  /** One meta line, e.g. "새 회차 24화" / "20화까지 봤어요" / "마지막으로 본 6화". */
  meta: string;
  /** Cover art url (app-root-relative or absolute); absent ⇒ tinted box only. */
  coverUrl?: string | null;
  /**
   * 행에서 바로 감상으로 들어가는 보조 액션(이어보기). 없으면 렌더하지 않는다 —
   * 아직 한 화도 안 봤거나 이어볼 곳을 알 수 없는 행은 작품 상세로 가는 게 맞다.
   */
  action?: { label: string; onPress: () => void };
  /** Show the UP badge (a 관심 work has a new episode since last read). */
  up?: boolean;
  onPress: () => void;
};

export function LibraryRow({ title, meta, coverUrl, action, up = false, onPress }: LibraryRowProps) {
  const t = useTheme();
  // 이어보기 CTA는 Card(누를 수 있는 행) '안'이 아니라 '옆'에 둔다 — 눌리는 요소를 겹쳐
  // 놓으면 웹에서 button 안에 button이 들어가는 잘못된 마크업이 되고, 어디를 눌러야 어디로
  // 가는지도 흐려진다. 행 = 작품 상세, 오른쪽 CTA = 감상으로 명확히 가른다.
  const row = (
    <Card
      onPress={onPress}
      padding="md"
      radius="md"
      elevated={false}
      accessibilityLabel={`${title}${meta ? `, ${meta}` : ''}${up ? ', 새 회차' : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        backgroundColor: 'transparent',
        minHeight: t.layout.rowMinHeight,
      }}
    >
      {/* Cover thumbnail — real art over a tinted box (shows through if no cover). */}
      <View
        style={{
          width: 48,
          height: 64,
          borderRadius: t.radius.md,
          overflow: 'hidden',
          backgroundColor: t.color.surfaceElevated,
        }}
      >
        <AppImage url={coverUrl} recyclingKey={coverUrl ?? title} contentFit="cover" style={{ width: 48, height: 64 }} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          <Text variant="headline" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Text>
          {up ? <Badge variant="up" /> : null}
        </View>
        {meta ? (
          <Text variant="caption" color="onSurfaceSecondary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Card>
  );

  if (!action) return row;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, minWidth: 0 }}>{row}</View>
      <Pressable
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${action.label}`}
        hitSlop={8}
        style={{
          minHeight: t.layout.minHitTarget,
          justifyContent: 'center',
          paddingHorizontal: t.space.md,
        }}
      >
        <Text variant="caption" weight="semibold" color="accent">
          {action.label}
        </Text>
      </Pressable>
    </View>
  );
}
