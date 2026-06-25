/**
 * AppImage — the single expo-image wrapper for all remote content art
 * (series covers, episode thumbnails, post images).
 * ------------------------------------------------------------------
 * Responsibilities (frontend-guide §3.4):
 *   1. Resolve an app-root-relative `url` (e.g. "/files/1/3/0.png") into
 *      an absolute URI via `resolveImageUrl` (the SINGLE source of BASE_URL
 *      prefixing). http(s) absolute URLs pass through unchanged; empty /
 *      null urls resolve to `undefined` so we never request
 *      "`${BASE_URL}undefined`".
 *   2. Cache aggressively (`cachePolicy="memory-disk"`) — the same covers
 *      reappear across grids, detail, and the library tab.
 *   3. Set `recyclingKey` so expo-image blanks the previous image when a
 *      recycled FlatList/grid cell rebinds to a new url, preventing stale
 *      art flashing in the wrong card. Defaults to the resolved url.
 *
 * `/files/**` is PUBLIC static serving (no Authorization header), so this
 * component intentionally attaches no auth headers — the source is just a
 * plain `{ uri }`.
 *
 * When there is no usable url we render the image with ONLY a placeholder
 * (blurhash/thumbhash/local asset/color) so the layout box is preserved
 * and the slot reads as "art is missing", not as a broken/empty hole.
 */
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import { useMemo } from 'react';

import { resolveImageUrl } from '@/api/image';
// Import the hook from its source module (not the '@/ui' barrel): AppImage is
// itself re-exported by ui/index.ts, so going through the barrel would create a
// circular import. The barrel re-exports useTheme from this same './use-theme'.
import { useTheme } from './use-theme';

export type AppImageProps = {
  /** App-root-relative ("/files/...") OR absolute http(s) url, or null/empty. */
  url?: string | null;
  /**
   * Identity for the underlying view across list recycling. When a recycled
   * cell rebinds to a different image, changing this resets the view to the
   * placeholder before the new image loads (no stale-art flash).
   * Defaults to the resolved absolute url.
   */
  recyclingKey?: string;
  /** Layout/visual style for the image box (width/height/borderRadius/etc). */
  style?: ImageProps['style'];
  /** How the image fills its box. Defaults to 'cover' (poster/thumbnail feel). */
  contentFit?: Extract<ImageContentFit, 'cover' | 'contain'>;
  /**
   * Placeholder shown before load and whenever `url` is empty/null
   * (blurhash/thumbhash string, local asset, or color source).
   */
  placeholder?: ImageProps['placeholder'];
  /** Screen-reader label / web alt text. */
  accessibilityLabel?: string;
  /**
   * Native blur radius (expo-image `blurRadius`). Used by CoverWall to
   * frost the background cover-art grid so the foreground glass surface
   * reads as the hero. 0/undefined = sharp (the normal grid/poster case).
   * Reuses the same `cachePolicy`/`recyclingKey` contract — the blur is
   * applied to the already-cached source, not a separate request.
   */
  blurRadius?: number;
};

export function AppImage({
  url,
  recyclingKey,
  style,
  contentFit = 'cover',
  placeholder,
  accessibilityLabel,
  blurRadius,
}: AppImageProps) {
  const t = useTheme();

  // Resolve once: absolute → as-is, relative → BASE_URL-prefixed,
  // empty/null → undefined (avoids requesting a bogus URL).
  const resolved = useMemo(() => resolveImageUrl(url), [url]);

  // No usable url → render placeholder only (source omitted), preserving the
  // layout box instead of leaving a hole or firing a doomed request.
  const source = resolved ? { uri: resolved } : null;

  return (
    <Image
      source={source}
      placeholder={placeholder}
      // Recycling identity falls back to the resolved url; when neither the
      // resolved url nor an explicit key exists, leave it undefined.
      recyclingKey={recyclingKey ?? resolved ?? null}
      cachePolicy="memory-disk"
      contentFit={contentFit}
      // Native blur (CoverWall background frosting). Undefined ⇒ sharp.
      blurRadius={blurRadius}
      transition={t.motion.duration.base}
      accessibilityLabel={accessibilityLabel}
      accessible={accessibilityLabel != null}
      style={style}
    />
  );
}
