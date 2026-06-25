/**
 * Text — the single typographic primitive.
 * Hierarchy via size+weight, not family (display & body share Pretendard).
 * Every variant carries Hangul-safe lineHeight from tokens.
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { resolveFontScaleCap } from '../responsive';
import { useTheme } from '../use-theme';
import type { ColorRoleName } from '../theme';
import type { FontSizeToken } from '../tokens';

export type TextVariant =
  | 'display'
  | 'title'
  | 'headline'
  | 'body'
  | 'callout'
  | 'label'
  | 'caption'
  | 'micro';

export type TextProps = RNTextProps & {
  variant?: TextVariant; // default 'body'
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  color?: ColorRoleName; // semantic role; default 'onSurface'
  caps?: boolean; // ALL-CAPS Latin labels get tracking from tokens
  /**
   * OS Dynamic Type ceiling escape hatch. Omit to use the per-role cap
   * from `resolveFontScaleCap(variant)` (display/title clamp tight,
   * body/caption breathe). Pass `1` to freeze (e.g. a truncating chip),
   * or any explicit multiplier to override the role default.
   */
  maxFontSizeMultiplier?: number;
};

export function Text({
  variant = 'body',
  weight,
  color = 'onSurface',
  caps = false,
  maxFontSizeMultiplier,
  style,
  ...rest
}: TextProps) {
  const t = useTheme();
  const sizeKey = variant as FontSizeToken;
  return (
    <RNText
      // Respect OS Dynamic Type but clamp per-role so a11y text-size
      // boosts legibility without shattering layout. Explicit prop wins.
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? resolveFontScaleCap(variant)}
      style={[
        {
          fontFamily: t.typography.fontFamily.body,
          fontSize: t.typography.fontSize[sizeKey],
          lineHeight: t.typography.lineHeight[sizeKey],
          fontWeight: t.typography.fontWeight[weight ?? defaultWeight(variant)],
          color: t.color[color],
          letterSpacing: caps
            ? t.typography.letterSpacing.caps
            : t.typography.letterSpacing.normal,
          textTransform: caps ? 'uppercase' : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}

function defaultWeight(v: TextVariant): 'regular' | 'medium' | 'semibold' | 'bold' {
  if (v === 'display' || v === 'title') return 'bold';
  if (v === 'headline') return 'semibold';
  if (v === 'micro' || v === 'caption') return 'medium';
  return 'regular';
}
