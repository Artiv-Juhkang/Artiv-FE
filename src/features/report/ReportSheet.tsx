/**
 * ReportSheet — 신고 사유 선택 시트 (C6).
 * RN Modal 기반(웹·네이티브 공용). 사유 탭 → 즉시 접수(별도 detail 입력은 후속).
 * 중복 신고(400 INVALID_INPUT)는 '이미 신고' 안내로 매핑 — PENDING 5건이면 서버가 자동 블라인드.
 */
import { Modal, Pressable, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { createReport, type ReportReason, type ReportTargetType } from '@/api/endpoints/reports';
import { isAppError } from '@/lib/errors';
import { Text, useTheme, useToast } from '@/ui';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: '스팸·광고' },
  { value: 'ABUSE', label: '욕설·혐오' },
  { value: 'SEXUAL', label: '음란·선정성' },
  { value: 'COPYRIGHT', label: '저작권 침해' },
  { value: 'ETC', label: '기타' },
];

export function ReportSheet({
  visible,
  targetType,
  targetId,
  onClose,
}: {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: number | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const toast = useToast();

  const reportMut = useMutation<void, Error, ReportReason>({
    mutationFn: (reason) => createReport({ targetType, targetId: targetId!, reason }),
    onSuccess: () => {
      toast.show({ message: '신고가 접수됐어요. 검토 후 조치할게요.' });
      onClose();
    },
    onError: (e) => {
      const dup = isAppError(e) && e.code === 'INVALID_INPUT';
      toast.show({
        tone: 'danger',
        message: dup ? '이미 신고한 대상이에요.' : '신고 접수에 실패했어요. 잠시 후 다시 시도해 주세요.',
      });
      onClose();
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 딤 배경 탭 → 닫기 */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="신고 닫기"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: t.color.scrim,
          padding: t.space.xl,
        }}
      >
        {/* 카드 내부 탭은 닫기로 전파 방지 */}
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: t.radius.xl,
            backgroundColor: t.color.surface,
            padding: t.space.lg,
            gap: t.space.sm,
          }}
        >
          <Text variant="headline" weight="semibold">
            신고 사유를 선택해 주세요
          </Text>
          {REASONS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => {
                if (targetId != null && !reportMut.isPending) reportMut.mutate(r.value);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}로 신고`}
              style={{
                paddingVertical: t.space.md,
                paddingHorizontal: t.space.md,
                borderRadius: t.radius.md,
                backgroundColor: t.color.surfaceSunken,
              }}
            >
              <Text variant="body">{r.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="취소"
            style={{ paddingVertical: t.space.sm, alignItems: 'center' }}
          >
            <Text variant="caption" color="onSurfaceMuted" weight="semibold">
              취소
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
