/**
 * 공용 댓글 입력 바 — 답글 대상 칩 + 멀티라인 입력 + 전송.
 * 회차 댓글 화면에서 추출. 상태(text/replyTo)는 화면이 소유한다.
 */
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text, useTheme } from '@/ui';

export type ReplyTarget = { id: number; nickname: string };

export function ComposeBar({
  text,
  onChangeText,
  onSend,
  sending,
  replyTo,
  onCancelReply,
  placeholder = '댓글을 입력하세요',
  sendLabel = '등록',
}: {
  text: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  /** 도메인별 문구(댓글/메시지) — 기본은 댓글. */
  placeholder?: string;
  sendLabel?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: t.color.border,
        paddingHorizontal: t.space.lg,
        paddingTop: t.space.sm,
        // 하단 홈 인디케이터/내비바 회피(없는 기기는 space.sm 바닥).
        paddingBottom: Math.max(insets.bottom, t.space.sm),
        gap: t.space.xs,
        backgroundColor: t.color.surface,
      }}
    >
      {replyTo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <Text variant="caption" color="onSurfaceSecondary" style={{ flex: 1 }} numberOfLines={1}>
            {replyTo.nickname}님에게 답글
          </Text>
          <Pressable onPress={onCancelReply} accessibilityRole="button" accessibilityLabel="답글 취소" hitSlop={8}>
            <Text variant="caption" color="accent" weight="semibold">
              취소
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.sm }}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder={replyTo ? '답글을 입력하세요' : placeholder}
          placeholderTextColor={t.color.onSurfaceMuted}
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            minHeight: 40,
            maxHeight: 120,
            borderRadius: t.radius.md,
            backgroundColor: t.color.surfaceSunken,
            paddingHorizontal: t.space.md,
            paddingVertical: t.space.sm,
            color: t.color.onSurface,
            fontSize: t.typography.fontSize.body,
          }}
        />
        <Button
          label={sendLabel}
          variant="primary"
          size="sm"
          loading={sending}
          disabled={text.trim().length === 0}
          onPress={onSend}
        />
      </View>
    </View>
  );
}
