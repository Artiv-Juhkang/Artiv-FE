/**
 * AudioReader — 오디오 회차(mediaKind=AUDIO) 플레이어.
 *
 * expo-audio(useAudioPlayer)로 /files 의 오디오 자산을 재생한다. 재생/일시정지,
 * 진행 바 탭 탐색, 현재/총 시간, 다중 트랙이면 트랙 목록과 자동 다음 재생을 제공한다.
 * 최초 진입 시 자동재생은 하지 않는다(웹 자동재생 정책 회피).
 *
 * 색은 뷰어 표면을 따라간다 — 예전엔 '뷰어=OLED 블랙'이라 흰색 고정이었으나 viewerBg는
 * 라이트 테마에서 흰색이라(theme.ts) 플레이어 전체가 흰 배경에 흰색으로 사라졌다.
 */
import { useEffect, useState } from 'react';
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

export function AudioReader({
  urls,
  title,
  onProgress,
}: {
  urls: string[];
  title: string;
  /** 재생 진도(0~100)를 상위로 흘린다 — 열람 계측용. 없으면 아무 일도 하지 않는다. */
  onProgress?: (pct: number) => void;
}) {
  const t = useTheme();
  // 한 회차에 트랙을 여러 개 올릴 수 있다(업로드가 다중 허용) — 예전엔 첫 트랙만 재생하고
  // 나머지는 존재조차 알 수 없었다. 현재 트랙을 상태로 두고 끝나면 다음 트랙으로 넘어간다.
  const [index, setIndex] = useState(0);
  const tracks = urls.map((u) => resolveImageUrl(u)).filter((u): u is string => !!u);
  const uri = tracks[Math.min(index, tracks.length - 1)];
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const [barWidth, setBarWidth] = useState(0);

  const duration = status?.duration ?? 0;
  const current = status?.currentTime ?? 0;
  const playing = status?.playing ?? false;
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;

  // 오디오는 스크롤이 없어 뷰어의 onScroll 경로를 타지 못한다. 배선이 없으면 완청한 회차도
  // progress 0·미완독으로 기록돼 완독률이 매체 전체에서 0%가 된다(2026-09-03 리뷰).
  useEffect(() => {
    if (duration > 0) onProgress?.(ratio * 100);
  }, [ratio, duration, onProgress]);
  const multi = tracks.length > 1;
  const hasNext = index < tracks.length - 1;

  // 트랙을 바꾸면 새 소스가 로드되고 그 직후는 항상 정지 상태다. 그래서 '이어서 재생할
  // 생각이었는지'를 기억해 두고, 새 소스가 준비되면 그때 재생한다 — 이게 없으면 자동 다음
  // 트랙이 조용히 멈춰 서서 '자동 재생'이 말뿐이 된다. 최초 진입은 false라 자동재생 안 함
  // (웹 자동재생 정책 회피).
  const [resumeOnLoad, setResumeOnLoad] = useState(false);

  useEffect(() => {
    if (status?.didJustFinish && hasNext) {
      setResumeOnLoad(true);
      setIndex((i) => i + 1);
    }
  }, [status?.didJustFinish, hasNext]);

  useEffect(() => {
    if (resumeOnLoad && status?.isLoaded && !playing) {
      player.play();
      setResumeOnLoad(false);
    }
  }, [resumeOnLoad, status?.isLoaded, playing, player]);

  // 목록에서 트랙을 고르는 건 "이걸 듣겠다"는 뜻이다 — 탭 자체가 사용자 제스처라 재생해도 된다.
  const selectTrack = (i: number) => {
    if (i === index) return;
    setResumeOnLoad(true);
    setIndex(i);
  };

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

      {/* 트랙이 하나뿐이면 목록은 소음이다 — 여러 개일 때만 보여준다. */}
      {multi ? (
        <View style={{ gap: t.space.xs }}>
          {tracks.map((_, i) => {
            const activeTrack = i === index;
            return (
              <Pressable
                key={i}
                onPress={() => selectTrack(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: activeTrack }}
                accessibilityLabel={`${i + 1}번 트랙${activeTrack ? ', 재생 중' : ''}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.space.sm,
                  paddingVertical: t.space.sm,
                  paddingHorizontal: t.space.md,
                  borderRadius: t.radius.md,
                  backgroundColor: activeTrack ? t.color.accentSubtle : 'transparent',
                  minHeight: t.layout.minHitTarget,
                }}
              >
                <Text variant="caption" style={{ color: activeTrack ? t.color.accent : inkMuted }}>
                  {activeTrack && playing ? '❚❚' : '▶'}
                </Text>
                <Text
                  variant="label"
                  weight={activeTrack ? 'semibold' : 'regular'}
                  style={{ color: activeTrack ? t.color.accent : ink }}
                >
                  {i + 1}번 트랙
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
