/**
 * SupportButton — 정기 후원 / 멤버십 UI slot (FUTURE SEAM).
 * ==================================================================
 * The button that opens the membership explainer. Tapping it shows a sheet
 * (benefits + a 시작하기 CTA). The CTA calls `startMembership` from the
 * sponsorship seam, which TODAY throws the typed NotReady error — we catch it
 * and show a calm neutral "준비 중" toast. No backend is faked; this is the UI
 * slot the real flow drops into (mirrors `SocialButtonRow` for social login).
 *
 * Why a hand-rolled RN <Modal> sheet: the Glass Stack UI surface ships no
 * BottomSheet primitive yet, so this file stubs one with react-native's
 * <Modal> + a tappable scrim + a GlassCard panel. When a shared BottomSheet
 * lands it replaces `<Modal>` here without touching the seam wiring.
 *
 * Glass / a11y: the panel is a `GlassCard`, which already degrades to a
 * painted fallback under Reduce-Transparency (no extra handling needed here).
 * The scrim and the Android hardware back both call `onClose`.
 *
 * Toast resolution: `ToastProvider` is mounted at the app root (above this
 * Modal), so `useToast()` resolves even though the Modal renders in a separate
 * native window.
 */
import { useCallback, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  startMembership,
  isMembershipNotReadyError,
  MEMBERSHIP_BENEFITS,
  MEMBERSHIP_NOT_READY_MESSAGE,
  type MembershipBenefit,
} from '@/features/series/sponsorship';
import { Button, GlassCard, Text, useToast, useTheme } from '@/ui';

export interface SupportButtonProps {
  seriesId: number;
  /**
   * 'inline' (default) = a compact ghost button that sits in the action bar.
   * 'cta' = a full-width primary-weight button for a standalone slot.
   */
  variant?: 'inline' | 'cta';
}

export function SupportButton({ seriesId, variant = 'inline' }: SupportButtonProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  const onClose = useCallback(() => setOpen(false), []);
  const onOpen = useCallback(() => setOpen(true), []);

  return (
    <>
      <Button
        label="정기 후원"
        variant={variant === 'cta' ? 'primary' : 'ghost'}
        fullWidth={variant === 'cta'}
        // Indigo heart hints the support/affinity semantics on the ghost chip.
        leadingIcon={
          <SymbolView
            name="heart.fill"
            size={16}
            tintColor={variant === 'cta' ? t.color.onPrimary : t.color.accent}
            fallback={null}
          />
        }
        accessibilityHint="정기 후원 혜택을 살펴봐요"
        onPress={onOpen}
      />

      <MembershipSheet seriesId={seriesId} visible={open} onClose={onClose} />
    </>
  );
}

// ── The explainer sheet (RN Modal stub) ────────────────────────────
function MembershipSheet({
  seriesId,
  visible,
  onClose,
}: {
  seriesId: number;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const toast = useToast();

  // CTA: kick off the membership flow. TODAY `startMembership` throws the typed
  // NotReady error → calm neutral toast. A real failure (once it ships) →
  // danger toast. Double-tap safety comes from Button's useAsyncPress.
  const onSupport = useCallback(async () => {
    try {
      await startMembership(seriesId);
      // FUTURE: success path — confirm membership + close the sheet.
      onClose();
    } catch (e) {
      if (isMembershipNotReadyError(e)) {
        toast.show({ tone: 'neutral', message: MEMBERSHIP_NOT_READY_MESSAGE });
        onClose();
        return;
      }
      toast.show({ tone: 'danger', message: '후원을 시작하지 못했어요.' });
    }
  }, [seriesId, toast, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android hardware back closes the sheet (mirrors a scrim tap).
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Scrim — tap outside the panel to dismiss. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: t.color.scrim,
          justifyContent: 'flex-end',
        }}
      >
        {/* Stop propagation: taps inside the panel must not dismiss. */}
        <Pressable onPress={() => {}} style={{ padding: t.space.lg }}>
          <GlassCard
            radius="xl"
            style={{
              padding: t.space.xl,
              gap: t.space.lg,
              paddingBottom: t.space['3xl'],
            }}
          >
            <View style={{ gap: t.space.xs }}>
              <Text variant="title" weight="bold">
                정기 후원 멤버십
              </Text>
              <Text variant="callout" color="onSurfaceSecondary">
                정기 후원으로 작가를 응원하고 멤버 혜택을 받아요.
              </Text>
            </View>

            <View style={{ gap: t.space.md }}>
              {MEMBERSHIP_BENEFITS.map((benefit) => (
                <BenefitRow key={benefit.key} benefit={benefit} />
              ))}
            </View>

            {/* Honest "준비 중" label so the CTA never implies a live purchase. */}
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: t.space.md,
                paddingVertical: t.space.xs,
                borderRadius: t.radius.pill,
                backgroundColor: t.color.glassField,
                borderWidth: 1,
                borderColor: t.color.glassFieldBorder,
              }}
            >
              <Text variant="caption" weight="medium" color="onSurfaceSecondary">
                준비 중
              </Text>
            </View>

            <View style={{ gap: t.space.sm }}>
              <Button label="후원 시작하기" variant="primary" fullWidth onPress={onSupport} />
              <Button label="닫기" variant="ghost" fullWidth onPress={onClose} />
            </View>
          </GlassCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── One benefit row in the sheet ───────────────────────────────────
function BenefitRow({ benefit }: { benefit: MembershipBenefit }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.md }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: t.radius.md,
          backgroundColor: t.color.glassField,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SymbolView
          name={benefit.sfSymbol as Parameters<typeof SymbolView>[0]['name']}
          size={18}
          tintColor={t.color.accent}
          fallback={
            <Text variant="callout" weight="bold" color="accent">
              ·
            </Text>
          }
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold">
          {benefit.title}
        </Text>
        <Text variant="caption" color="onSurfaceSecondary">
          {benefit.description}
        </Text>
      </View>
    </View>
  );
}
