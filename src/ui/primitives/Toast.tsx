/**
 * Toast — transient confirmation/feedback. Mirrors action vocabulary:
 * the button that says "구독" produces a toast that says "구독했어요".
 * Enter/exit animation collapses to instant under reduced motion.
 * Sits at zIndex.toast (topmost). Provide via ToastProvider; trigger
 * with useToast().show(...). Scaffolded signatures + a minimal context.
 */
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Text } from './Text';
import { useMotion, useTheme } from '../use-theme';

export type ToastTone = 'neutral' | 'success' | 'danger';
export type ToastInput = { message: string; tone?: ToastTone; durationMs?: number };

type ToastContextValue = { show: (t: ToastInput) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastInput | null>(null);

  const show = useCallback((input: ToastInput) => {
    setCurrent(input);
    const ms = input.durationMs ?? 2400;
    setTimeout(() => setCurrent(null), ms);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {current ? <ToastView {...current} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ message, tone = 'neutral' }: ToastInput) {
  const t = useTheme();
  const { duration } = useMotion();
  const accent =
    tone === 'success' ? t.color.success : tone === 'danger' ? t.color.danger : t.color.accent;

  return (
    <Animated.View
      entering={duration.base === 0 ? undefined : FadeInDown.duration(duration.base)}
      exiting={duration.base === 0 ? undefined : FadeOutDown.duration(duration.fast)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: t.space.lg,
        right: t.space.lg,
        bottom: t.space['4xl'],
        zIndex: t.zIndex.toast,
        backgroundColor: t.color.surfaceElevated,
        borderRadius: t.radius.lg,
        paddingVertical: t.space.md,
        paddingHorizontal: t.space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        ...t.shadow.toast,
      }}
    >
      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
      <Text variant="callout" weight="medium" accessibilityLiveRegion="polite">
        {message}
      </Text>
    </Animated.View>
  );
}
