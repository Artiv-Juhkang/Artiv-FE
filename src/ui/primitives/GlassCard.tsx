/**
 * GlassCard — the frosted, floating surface of the "Glass Stack" system.
 * ------------------------------------------------------------------
 * A translucent panel that sits OVER the (blurred) cover-art wall behind
 * a darkening scrim. On iOS 26+ where Liquid Glass is available (and the
 * user has NOT turned on Reduce Transparency), it renders the real native
 * `GlassView` from `expo-glass-effect`. Everywhere else — Android, web,
 * older iOS, or Reduce-Transparency-on — it degrades to a designed
 * fallback `View` painted with the theme's `glassBg` fill + `glassBorder`
 * hairline so the panel is always legible and on-brand.
 *
 * Why this matters (frontend-guide §9): the cover art / content is the
 * HERO; the form recedes behind glass. The fallback is NOT an afterthought
 * — most Android users and every pre-iOS-26 user see it, so it carries the
 * full glass *look* via the role tokens.
 *
 * ★ KNOWN expo-glass-effect BUG: setting `opacity: 0` on a GlassView (or
 *   any parent) makes the glass not render AT ALL. So this component never
 *   animates opacity to 0 and never accepts a 0-opacity style; entrance
 *   animation belongs to the `glassEffectStyle.animate` prop or a sibling.
 *
 * Layering note: imports `useTheme` from '../use-theme' (the source hook)
 * — going through the '@/ui' barrel would be a circular import since this
 * primitive is itself re-exported by the barrel.
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewProps } from 'react-native';

import type { Radius } from '../tokens';
import { useTheme } from '../use-theme';

export type GlassCardProps = ViewProps & {
  children: ReactNode;
  /** Corner radius token. Defaults to 'xl' (big floating surface). */
  radius?: Radius;
  /**
   * Glass appearance scheme. 'auto' follows the system/app appearance;
   * 'light'/'dark' force a glass tint. Maps to GlassView `colorScheme`.
   * The fallback paints theme glass roles so it tracks the active theme
   * regardless (forcing here only affects the native effect).
   */
  tint?: 'auto' | 'light' | 'dark';
  /**
   * Glass material density. 'regular' = standard frosted panel (default);
   * 'clear' = lighter, more see-through (for thin chrome over vivid art).
   * Maps to GlassView `glassEffectStyle` ('regular' | 'clear') — NOT a
   * numeric blur value.
   */
  intensity?: 'regular' | 'clear';
  /**
   * Wash the glass with the indigo accent (links/active surfaces). Maps to
   * GlassView `tintColor`. Off by default (neutral frosted glass).
   */
  accentTint?: boolean;
  /**
   * Enable the native interactive press deformation (GlassView
   * `isInteractive`). Use when the card itself is the tappable target.
   */
  isInteractive?: boolean;
};

/**
 * True only when the REAL Liquid Glass effect should be used: the runtime
 * API exists, the OS reports Liquid Glass available, AND the user has not
 * enabled Reduce Transparency (which would make glass illegible / is an
 * explicit a11y request for opaque surfaces). Subscribes to live changes
 * so toggling the setting re-renders the surface immediately.
 */
export function useGlassAvailable(): boolean {
  // Component availability is a static runtime fact (iOS 26+, API present).
  // Compute once — it cannot change without an app restart.
  const [supported] = useState(
    () => Platform.OS === 'ios' && isLiquidGlassAvailable(),
  );
  // Reduce Transparency CAN change at runtime → subscribe.
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (!supported) return; // never query/subscribe where glass isn't possible
    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled().then((v) => {
      if (!cancelled) setReduceTransparency(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (v) => setReduceTransparency(v),
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [supported]);

  return supported && !reduceTransparency;
}

export function GlassCard({
  children,
  radius = 'xl',
  tint = 'auto',
  intensity = 'regular',
  accentTint = false,
  isInteractive = false,
  style,
  ...rest
}: GlassCardProps) {
  const t = useTheme();
  const glass = useGlassAvailable();
  const borderRadius = t.radius[radius];

  // overflow:'hidden' + borderRadius clips children (and the native glass)
  // to the rounded card shape on every platform.
  const clip = { borderRadius, overflow: 'hidden' as const };

  if (glass) {
    return (
      <GlassView
        glassEffectStyle={intensity}
        colorScheme={tint}
        tintColor={accentTint ? t.color.accent : undefined}
        isInteractive={isInteractive}
        // Native glass provides the fill/blur; we only clip + round it.
        style={[clip, style]}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  // Fallback: paint the glass LOOK from role tokens so Android / web /
  // older iOS / reduce-transparency users still get a legible frosted
  // surface (glassBg fill + glassBorder hairline). accentTint nudges the
  // border toward the indigo accent to echo the native tintColor.
  return (
    <View
      style={[
        clip,
        {
          backgroundColor: t.color.glassBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: accentTint ? t.color.accentBorder : t.color.glassBorder,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
