/**
 * 채팅 탭 — 플레이스홀더("준비 중").
 *
 * 실시간 채팅은 로드맵 마지막 단계(폴링 MVP → WebSocket). 지금은 5탭 IA 를
 * 확정하기 위한 자리만 잡아 둔다. 라우트 형태(/(tabs)/chat)는 그대로 유지.
 */
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Screen, Text, useTheme } from '@/ui';

export default function ChatScreen() {
  const t = useTheme();

  return (
    <Screen center header={{ variant: 'solid', back: false, title: '채팅' }}>
      <View
        style={{
          gap: t.space.md,
          alignItems: 'center',
          paddingHorizontal: t.space.xl,
        }}
      >
        <SymbolView
          name="paperplane.fill"
          size={48}
          tintColor={t.color.accent}
          fallback={<Text variant="display">✈️</Text>}
        />
        <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
          준비 중
        </Text>
        <Text variant="display" weight="bold" style={{ textAlign: 'center' }}>
          채팅을 준비하고 있어요
        </Text>
        <Text
          variant="body"
          color="onSurfaceSecondary"
          style={{ textAlign: 'center' }}
        >
          여기서 만난 사람들과 1:1, 그룹으로 이야기 나눌 수 있게 될 거예요.
        </Text>
      </View>
    </Screen>
  );
}
