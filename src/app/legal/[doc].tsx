/**
 * 이용약관 · 개인정보 처리방침 열람.
 *
 * `(app)`/`(auth)` **바깥**에 둔다 — 가입 화면(미인증)과 내 정보(인증) 양쪽에서
 * 열려야 하는데, 두 그룹은 각각 Stack.Protected로 막혀 있기 때문이다.
 *
 * 내용 정본은 docs/legal/*.md, 앱 표시본은 features/settings/legal.ts.
 */
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { View } from 'react-native';

import { LEGAL_DOCS, type LegalDoc } from '@/features/settings/legal';
import { GlassCard, Screen, Text, useTheme } from '@/ui';

export default function LegalScreen() {
  const t = useTheme();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const legal: LegalDoc | undefined = LEGAL_DOCS[doc as LegalDoc['slug']];

  // 알 수 없는 slug는 조용히 홈으로 — 법적 문서에 404 화면을 보여줄 이유가 없다.
  if (!legal) return <Redirect href={'/' as Href} />;

  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: legal.title }}>
      <View style={{ gap: t.space.xl, paddingVertical: t.space.md }}>
        <GlassCard radius="lg">
          <View style={{ padding: t.space.lg, gap: t.space.xs }}>
            <Text variant="caption" weight="semibold" color="onSurfaceMuted" caps>
              버전 {legal.version}
            </Text>
            <Text variant="caption" color="onSurfaceSecondary">
              {legal.notice}
            </Text>
          </View>
        </GlassCard>

        {legal.sections.map((s) => (
          <View key={s.heading} style={{ gap: t.space.sm }}>
            <Text variant="headline" weight="semibold">
              {s.heading}
            </Text>
            {s.body.split('\n').map((line, i) =>
              line.trim() === '' ? (
                <View key={i} style={{ height: t.space.xs }} />
              ) : (
                <Text key={i} variant="callout" color="onSurfaceSecondary">
                  {line}
                </Text>
              ),
            )}
          </View>
        ))}
      </View>
    </Screen>
  );
}
