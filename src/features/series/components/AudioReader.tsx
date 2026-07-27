/**
 * AudioReader — 오디오 회차(mediaKind=AUDIO) 플레이어.
 *
 * expo-audio(useAudioPlayer)로 /files 의 오디오 자산을 재생한다. 재생/일시정지,
 * 진행 바 탭 탐색, 현재/총 시간을 제공한다. 자동재생은 하지 않는다(웹 자동재생 정책 회피).
 *
 * 색은 뷰어 표면을 따라간다 — 예전엔 '뷰어=OLED 블랙'이라 흰색 고정이었으나 viewerBg는
 * 라이트 테마에서 흰색이라(theme.ts) 플레이어 전체가 흰 배경에 흰색으로 사라졌다.
 */
import { useState } from 'react';
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { resolveImageUrl } from '@/api/image';
import { Text, useTheme } from '@/ui';

function fmt(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function AudioReader({ url, title }: { url: string; title: string }) {
  const t = useTheme();
  const uri = resolveImageUrl(url);
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const [barWidth, setBarWidth] = useState(0);

  const duration = status?.duration ?? 0;
  const current = status?.currentTime ?? 0;
  const playing = status?.playing ?? false;
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;

  const toggle = () => {
    if (playing) player.pause();
    else player.play();
  };

  const onSeek = (e: GestureResponderEvent) => {
    if (barWidth > 0 && duration > 0) {
      const x = Math.max(0, Math.min(barWidth, e.nativeEvent.locationX));
      player.seekTo((x / barWidth) * duration);
    }
  };

  // 뷰어 표면 위 잉크(다크=흰색, 라이트=본문 잉크). 재생 버튼은 잉크/표면을 뒤집어 대비를 만든다.
  const ink = t.isDark ? '#FFFFFF' : t.color.onSurface;
  const inkMuted = t.isDark ? 'rgba(255,255,255,0.7)' : t.color.onSurfaceSecondary;
  const trackBg = t.isDark ? 'rgba(255,255,255,0.2)' : t.color.borderStrong;

  return (
    <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg }}>
      <Text variant="headline" weight="bold" style={{ textAlign: 'center', color: ink }}>
        {title}
      </Text>

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? '일시정지' : '재생'}
        style={{
          alignSelf: 'center',
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="title" weight="bold" style={{ color: t.color.viewerBg }}>
          {playing ? '❚❚' : '▶'}
        </Text>
      </Pressable>

      <Pressable onPress={onSeek} onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)} hitSlop={12}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: trackBg }}>
          <View style={{ width: `${ratio * 100}%`, height: 6, borderRadius: 3, backgroundColor: ink }} />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" style={{ color: inkMuted }}>
          {fmt(current)}
        </Text>
        <Text variant="caption" style={{ color: inkMuted }}>
          {fmt(duration)}
        </Text>
      </View>
    </View>
  );
}
