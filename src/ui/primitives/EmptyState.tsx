/**
 * EmptyState — an empty screen is an invitation to act, not a shrug.
 * Korean copy: title states the situation, body gives the next step,
 * optional action button. Used for empty library/feed/search.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '../use-theme';

export type EmptyStateProps = {
  icon?: ReactNode; // optional illustration / glyph
  title: string; // e.g. "아직 구독한 작품이 없어요"
  description?: string; // e.g. "마음에 드는 작품을 구독하면 여기 모여요."
  actionLabel?: string; // e.g. "작품 둘러보기"
  onAction?: () => void;
};

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: t.space['3xl'],
        gap: t.space.md,
      }}
    >
      {icon ? <View style={{ marginBottom: t.space.sm }}>{icon}</View> : null}
      <Text variant="headline" weight="semibold" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="onSurfaceSecondary" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: t.space.md }}>
          <Button label={actionLabel} onPress={onAction} variant="primary" />
        </View>
      ) : null}
    </View>
  );
}
