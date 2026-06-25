/**
 * CoverWall — the soft, glowing backdrop behind the glass (Glass Stack hero).
 * Pass it to <Screen background={...}/> so it fills the WHOLE screen.
 *
 * Two modes:
 *   - PLACEHOLDER (no `covers` — e.g. the PRE-AUTH login, which can't fetch the
 *     auth-protected /api/series): a soft multi-color AURORA built from several
 *     overlapping radial gradients. This is the heavily-blurred-cover-art look
 *     WITHOUT any image or blur filter — the gradients are inherently soft, so
 *     no expo-blur / no bundled assets / no native rebuild needed.
 *   - REAL COVERS (`covers` provided): a blurred <AppImage> grid (native
 *     blurRadius), for authenticated screens where live cover URLs exist. Swap
 *     `covers` in later and nothing else changes.
 *
 * Gradients use New-Architecture CSS gradients (`experimental_backgroundImage`,
 * RN 0.85 / SDK 56 dev builds — NOT Expo Go). A solid base `backgroundColor`
 * sits under the aurora so the screen is never bare if the prop is unsupported.
 *
 * Layering note: imports `useTheme` from '../use-theme' (off the '@/ui' barrel)
 * because the barrel re-exports this primitive (would be circular).
 */
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppImage } from '../AppImage';
import { useResponsive } from '../responsive';
import { useTheme } from '../use-theme';

export type CoverWallProps = ViewProps & {
  /** Real cover URLs to tile. Empty ⇒ the soft aurora placeholder. */
  covers?: (string | null)[];
  /** Native blur radius applied to real-cover tiles. Default 24. */
  blurRadius?: number;
  /** How far each real-cover tile scales past its cell (seamless blur edges). */
  overscale?: number;
  /** Foreground content (rarely used — prefer Screen's body). Above the wall. */
  children?: ReactNode;
};

// Soft genre-color aurora: overlapping radial blobs that bleed into each other.
// Light mode keeps blobs gentle over a light base (dark text/glass read on top);
// dark mode is richer over near-black (white text/glass). `transparent <n>%`
// controls each blob's softness/spread. Keep these in sync with the approved
// Glass Stack mockup hues (coral / indigo / blue / pink / teal).
const AURORA = {
  light: {
    base: '#EAEBF0',
    image: [
      'radial-gradient(circle at 12% 10%, rgba(255,150,110,0.55) 0%, transparent 46%)',
      'radial-gradient(circle at 90% 14%, rgba(140,125,255,0.50) 0%, transparent 46%)',
      'radial-gradient(circle at 82% 78%, rgba(90,140,255,0.46) 0%, transparent 50%)',
      'radial-gradient(circle at 10% 86%, rgba(255,110,160,0.42) 0%, transparent 48%)',
      'radial-gradient(circle at 50% 48%, rgba(60,220,205,0.30) 0%, transparent 42%)',
    ].join(', '),
  },
  dark: {
    base: '#0E1014',
    image: [
      'radial-gradient(circle at 14% 10%, rgba(255,138,91,0.42) 0%, transparent 48%)',
      'radial-gradient(circle at 88% 13%, rgba(124,108,255,0.50) 0%, transparent 48%)',
      'radial-gradient(circle at 84% 78%, rgba(40,200,210,0.42) 0%, transparent 50%)',
      'radial-gradient(circle at 10% 86%, rgba(162,75,255,0.46) 0%, transparent 48%)',
      'radial-gradient(circle at 50% 50%, rgba(77,124,255,0.30) 0%, transparent 44%)',
    ].join(', '),
  },
} as const;

// Subtle legibility wash — heavier toward the bottom (links) and very light at
// the top so the aurora stays vivid. Kept gentle because the glass card does the
// heavy lifting for the fields' contrast.
const SCRIM = {
  light:
    'linear-gradient(to bottom, rgba(236,237,242,0.08) 0%, rgba(236,237,242,0.10) 55%, rgba(236,237,242,0.34) 100%)',
  dark: 'linear-gradient(to bottom, rgba(14,16,20,0.10) 0%, rgba(14,16,20,0.16) 55%, rgba(14,16,20,0.44) 100%)',
} as const;

const BLEED = 28;

export function CoverWall({
  covers = [],
  blurRadius = 24,
  overscale = 1.12,
  children,
  style,
  ...rest
}: CoverWallProps) {
  const t = useTheme();
  const r = useResponsive();

  const usable = useMemo(() => covers.filter((c): c is string => !!c), [covers]);
  const hasCovers = usable.length > 0;
  const aurora = t.isDark ? AURORA.dark : AURORA.light;
  const scrim = t.isDark ? SCRIM.dark : SCRIM.light;

  // Real-cover grid geometry (only when there are covers to show).
  const grid = useMemo(() => {
    const columns = Math.max(1, r.coverWallColumns);
    const expandedWidth = r.width + BLEED * 2;
    const expandedHeight = r.height + BLEED * 2;
    const cellWidth = expandedWidth / columns;
    const cellHeight = cellWidth * 1.4;
    const rows = Math.ceil(expandedHeight / cellHeight) + 1;
    return { cellWidth, cellHeight, count: columns * rows };
  }, [r.width, r.height, r.coverWallColumns]);

  return (
    <View style={[styles.root, style]} {...rest}>
      {hasCovers ? (
        // ── Real cover art (blurred) ──────────────────────────────────────
        <View
          pointerEvents="none"
          style={[styles.bleed, { top: -BLEED, left: -BLEED, right: -BLEED, bottom: -BLEED }]}
        >
          <View style={styles.grid}>
            {Array.from({ length: grid.count }, (_, i) => {
              const url = usable[i % usable.length];
              return (
                <View
                  key={`cw-${i}`}
                  style={{ width: grid.cellWidth, height: grid.cellHeight, backgroundColor: aurora.base }}
                >
                  <AppImage
                    url={url}
                    recyclingKey={`cw-${i}`}
                    blurRadius={blurRadius}
                    contentFit="cover"
                    style={{
                      width: grid.cellWidth * overscale,
                      height: grid.cellHeight * overscale,
                      transform: [
                        { translateX: (-grid.cellWidth * (overscale - 1)) / 2 },
                        { translateY: (-grid.cellHeight * (overscale - 1)) / 2 },
                      ],
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        // ── Soft aurora placeholder (no image, inherently blurred) ────────
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: aurora.base, experimental_backgroundImage: aurora.image },
          ]}
        />
      )}

      {/* Gentle legibility wash (kept light so the color stays vivid). */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { experimental_backgroundImage: scrim }]}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  bleed: { position: 'absolute' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
