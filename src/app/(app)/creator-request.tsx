/**
 * 작가 전환 신청 — 독자가 작가로 전환을 신청하고 심사 상태를 확인한다.
 *
 * 미신청 → 신청 폼. PENDING → 심사 중. REJECTED → 사유 + 재신청. APPROVED → 승인 안내
 * (역할은 관리자 승인 후 재로그인 시 반영). 이미 작가면 스튜디오로 보낸다.
 */
import { useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { Alert, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getMyCreatorRequest,
  submitCreatorRequest,
  type CreatorRequestResponse,
} from '@/api/endpoints/creatorRequest';
import { useAuth, isCreator } from '@/features/auth';
import { Field } from '@/features/studio/components';
import { Button, Card, Screen, Skeleton, Text, useTheme } from '@/ui';

const CR_KEY = ['me', 'creator-request'] as const;

export default function CreatorRequestScreen() {
  const t = useTheme();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery<CreatorRequestResponse | null>({
    queryKey: CR_KEY,
    queryFn: getMyCreatorRequest,
  });

  const submit = useMutation({
    mutationFn: (r: string) => submitCreatorRequest(r),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CR_KEY });
      setReason('');
      Alert.alert('신청 완료', '작가 전환 신청이 접수됐어요. 심사 결과를 기다려 주세요.');
    },
    onError: () => Alert.alert('신청 실패', '잠시 후 다시 시도해 주세요.'),
  });

  // 이미 작가면 스튜디오로.
  if (isCreator(role)) return <Redirect href={'/studio' as Href} />;

  const header = { variant: 'solid', back: true, title: '작가 되기' } as const;

  if (isLoading) {
    return (
      <Screen header={header}>
        <View style={{ paddingVertical: t.space.lg, gap: t.space.md }}>
          <Skeleton height={80} radius="lg" />
        </View>
      </Screen>
    );
  }

  const pending = data?.status === 'PENDING';
  const rejected = data?.status === 'REJECTED';
  const approved = data?.status === 'APPROVED';

  const onSubmit = () => {
    if (!reason.trim()) {
      Alert.alert('신청 사유', '어떤 작품을 만들고 싶은지 간단히 적어주세요.');
      return;
    }
    submit.mutate(reason.trim());
  };

  return (
    <Screen scroll header={header}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
        <View style={{ gap: t.space.xs }}>
          <Text variant="display" weight="bold">
            작가로 활동해 보세요
          </Text>
          <Text variant="body" color="onSurfaceSecondary">
            작가로 전환하면 웹툰·일러스트·소설·음악 등 작품을 올릴 수 있어요.
          </Text>
        </View>

        {approved ? (
          <Card padding="lg">
            <Text variant="headline" weight="semibold">
              승인됐어요 🎉
            </Text>
            <Text variant="body" color="onSurfaceSecondary" style={{ marginTop: t.space.xs }}>
              다시 로그인하면 작가 스튜디오를 이용할 수 있어요.
            </Text>
          </Card>
        ) : pending ? (
          <Card padding="lg">
            <Text variant="headline" weight="semibold">
              심사 중이에요
            </Text>
            <Text variant="body" color="onSurfaceSecondary" style={{ marginTop: t.space.xs }}>
              신청이 접수됐어요. 결과가 나오면 알려드릴게요.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: t.space.lg }}>
            {rejected && data?.adminNote ? (
              <Card padding="lg">
                <Text variant="caption" weight="semibold" color="danger">
                  이전 신청이 반려됐어요
                </Text>
                <Text variant="body" color="onSurfaceSecondary" style={{ marginTop: t.space.xs }}>
                  {data.adminNote}
                </Text>
              </Card>
            ) : null}
            <Field
              label="신청 사유"
              value={reason}
              onChangeText={setReason}
              placeholder="어떤 작품을 만들고 싶으신가요?"
              multiline
            />
            <Button
              label={rejected ? '다시 신청하기' : '작가 전환 신청'}
              fullWidth
              loading={submit.isPending}
              onPress={onSubmit}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}
