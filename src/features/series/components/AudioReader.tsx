/**
 * AudioReader — 오디오 회차(mediaKind=AUDIO) 플레이어.
 *
 * expo-audio(useAudioPlayer)로 /files 의 오디오 자산을 재생한다. 재생/일시정지,
 * 진행 바 탭 탐색, 현재/총 시간을 제공한다. 뷰어(OLED 블랙) 위에 올라가므로 색은
 * 흰색 고정(테마 무관). 자동재생은 하지 않는다(웹 자동재생 정책 회피).
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

  return (
    <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg }}>
      <Text variant="headline" weight="bold" style={{ textAlign: 'center', color: '#fff' }}>
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
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="title" weight="bold" style={{ color: '#000' }}>
          {playing ? '❚❚' : '▶'}
        </Text>
      </Pressable>

      <Pressable onPress={onSeek} onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)} hitSlop={12}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <View style={{ width: `${ratio * 100}%`, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {fmt(current)}
        </Text>
        <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {fmt(duration)}
        </Text>
      </View>
    </View>
  );
}
