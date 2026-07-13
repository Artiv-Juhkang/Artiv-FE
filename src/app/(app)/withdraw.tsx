/**
 * 회원 탈퇴 (M5) — 고지 + 비밀번호 확인. 성공(204) 후에만 로그아웃하고, 실패 시
 * 세션을 그대로 유지한다(비번 오류로 인한 뜻하지 않은 로그아웃 방지).
 */
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { withdrawAccount } from '@/api/endpoints/users';
import { useAuth } from '@/features/auth';
import { Field } from '@/features/studio/components';
import { isAppError } from '@/lib/errors';
import { Button, GlassCard, Screen, Text, useTheme, useToast } from '@/ui';

export default function WithdrawScreen() {
  const t = useTheme();
  const toast = useToast();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');

  const withdrawMut = useMutation<void, Error, string>({
    mutationFn: (pw) => withdrawAccount(pw),
    onSuccess: () => void logout(),
    onError: (e) => {
      const wrongPassword = isAppError(e) && e.code === 'INVALID_INPUT';
      toast.show({
        tone: 'danger',
        message: wrongPassword ? '비밀번호가 올바르지 않아요.' : '탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.',
      });
    },
  });

  const onWithdraw = () => {
    if (!password || withdrawMut.isPending) return;
    const run = () => withdrawMut.mutate(password);
    if (Platform.OS === 'web') {
      if (window.confirm('정말 탈퇴할까요? 되돌릴 수 없어요.')) run();
      return;
    }
    Alert.alert('회원 탈퇴', '정말 탈퇴할까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen scroll surface="ambient" header={{ variant: 'ambient', back: true, title: '회원 탈퇴' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.md }}>
        <GlassCard radius="lg">
          <View style={{ padding: t.space.lg, gap: t.space.sm }}>
            <Text variant="headline" weight="semibold">
              탈퇴하기 전에 확인해 주세요
            </Text>
            <Text variant="body" color="onSurfaceSecondary">
              탈퇴하면 다시 로그인할 수 없고, 같은 이메일로 재가입해야 해요. 작가라면 올린 작품이
              전부 비공개로 전환돼요. 작성한 글·댓글은 탈퇴 회원 이름으로 그대로 남아요.
            </Text>
          </View>
        </GlassCard>

        <Field
          label="비밀번호 확인"
          value={password}
          onChangeText={setPassword}
          placeholder="현재 비밀번호를 입력하세요"
          secureTextEntry
        />

        <Button
          label="탈퇴하기"
          variant="danger"
          fullWidth
          loading={withdrawMut.isPending}
          disabled={!password || withdrawMut.isPending}
          onPress={onWithdraw}
        />
      </View>
    </Screen>
  );
}
