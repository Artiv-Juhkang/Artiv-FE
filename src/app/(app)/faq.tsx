/**
 * 자주 묻는 질문 (M3) — 정적 콘텐츠 아코디언. my 탭 '고객센터' 섹션에서 진입.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { FAQ_SECTIONS } from '@/features/settings/faq';
import { Screen, Text, useTheme } from '@/ui';

export default function FaqScreen() {
  const t = useTheme();
  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: '자주 묻는 질문' }}>
      <View style={{ gap: t.space.xl, paddingVertical: t.space.md }}>
        {FAQ_SECTIONS.map((section) => (
          <View key={section.title} style={{ gap: t.space.sm }}>
            <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
              {section.title}
            </Text>
            <View style={{ gap: t.space.xs }}>
              {section.items.map((item) => (
                <FaqRow key={item.question} item={item} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function FaqRow({ item }: { item: { question: string; answer: string } }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Animated.View
      layout={LinearTransition}
      style={{
        borderRadius: t.radius.lg,
        backgroundColor: t.color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          minHeight: t.layout.minHitTarget,
          paddingHorizontal: t.space.md,
          paddingVertical: t.space.sm,
        }}
      >
        <Text variant="body" weight="semibold" style={{ flex: 1 }}>
          {item.question}
        </Text>
        <SymbolView
          name={open ? 'chevron.up' : 'chevron.down'}
          size={16}
          weight="semibold"
          tintColor={t.color.onSurfaceMuted}
          fallback={
            <Text variant="caption" color="onSurfaceMuted">
              {open ? '▲' : '▼'}
            </Text>
          }
        />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text
            variant="body"
            color="onSurfaceSecondary"
            style={{ paddingHorizontal: t.space.md, paddingBottom: t.space.md }}
          >
            {item.answer}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
