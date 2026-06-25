/**
 * 커뮤니티 탭 — 플레이스홀더.
 *
 * 다음 슬라이스에서 실제 피드/글 작성/댓글로 교체된다(백엔드 posts API + 프론트
 * endpoints/posts.ts 는 이미 준비돼 있고 화면만 비어 있음). 라우트 형태
 * (/(tabs)/community)는 그대로 유지하므로 교체 시 탭 구조 변경 없음.
 */
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Screen, Text, useTheme } from '@/ui';

export default function CommunityScreen() {
  const t = useTheme();

  return (
    <Screen center header={{ variant: 'solid', back: false, title: '커뮤니티' }}>
      <View
        style={{
          gap: t.space.md,
          alignItems: 'center',
          paddingHorizontal: t.space.xl,
        }}
      >
        <SymbolView
          name="bubble.left.and.bubble.right.fill"
          size={48}
          tintColor={t.color.accent}
          fallback={<Text variant="display">💬</Text>}
        />
        <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
          커뮤니티
        </Text>
        <Text variant="display" weight="bold" style={{ textAlign: 'center' }}>
          곧, 창작 이야기가 모여요
        </Text>
        <Text
          variant="body"
          color="onSurfaceSecondary"
          style={{ textAlign: 'center' }}
        >
          감상과 잡담, 팬아트까지 — 창작자와 독자가 함께 나누는 공간을 준비하고
          있어요.
        </Text>
      </View>
    </Screen>
  );
}
