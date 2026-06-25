/**
 * LibraryRow — one work row in 서재 (관심 / 열람). Pure presentation.
 * ------------------------------------------------------------------
 * The DTOs (SubscriptionResponse / ReadHistoryResponse) expose NO cover image
 * field, so the thumbnail is a deterministic tinted placeholder (same gap as the
 * grid/detail — swaps to a real cover the instant the API grows the field). The
 * row is text-led: title + a single meta line, with an optional UP badge for a
 * new episode on a 관심 work. Tapping opens the series detail (parent injects).
 */
import { View } from 'react-native';

import { Badge, Card, Text, useTheme } from '@/ui';

export type LibraryRowProps = {
  title: string;
  /** One meta line, e.g. "새 회차 24화" / "20화까지 봤어요" / "마지막으로 본 6화". */
  meta: string;
  /** Show the UP badge (a 관심 work has a new episode since last read). */
  up?: boolean;
  onPress: () => void;
};

export function LibraryRow({ title, meta, up = false, onPress }: LibraryRowProps) {
  const t = useTheme();
  return (
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
      {/* Cover placeholder (no cover field in the API yet). */}
      <View
        style={{
          width: 48,
          height: 64,
          borderRadius: t.radius.md,
          backgroundColor: t.color.surfaceElevated,
        }}
      />
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
}
