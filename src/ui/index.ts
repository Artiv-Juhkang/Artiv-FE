/**
 * AppToon UI — public surface.
 * Import design tokens, theme, and primitives from here:
 *   import { Screen, Text, Button, useTheme } from '@/ui';
 */

// tokens + theme
export * from './tokens';
export {
  themes,
  Colors,
  type Theme,
  type ColorScheme,
  type ColorRoleName,
} from './theme';
export { useTheme, useMotion, isReduceMotionEnabled } from './use-theme';
export {
  useResponsive,
  useBreakpoint,
  breakpointForWidth,
  selectForBreakpoint,
  resolveFontScaleCap,
  coverWallColumnsForWidth,
  scaleForWidth,
  clamp,
  type Responsive,
  type ResponsiveValue,
  // `Breakpoint` is already surfaced by `export * from './tokens'` above
  // (its source of truth); re-exporting it here too is a duplicate-name error.
} from './responsive';

// primitives
export { Text, type TextProps, type TextVariant } from './primitives/Text';
export {
  Screen,
  Box,
  type ScreenProps,
  type ScreenSurface,
  type BoxProps,
} from './primitives/Screen';

// ── header ──────────────────────────────────────────────────────────
// The single header public surface. The frame (ScreenHeader + config types)
// and the leaf controls (back/icon/title + ready-made actions). guardedBack /
// useGuardedNavigation are NOT re-exported here (ui-has-no-router layering).
export {
  ScreenHeader,
  type HeaderConfig,
  type HeaderVariant,
  type HeaderTitleAlign,
  HEADER_BAND_HEIGHT,
} from './primitives/ScreenHeader';
export {
  HeaderBackButton,
  HeaderIconButton,
  HeaderTitle,
  SearchAction,
  NotificationAction,
  MoreAction,
  BookmarkAction,
  type HeaderTone,
} from './primitives/header-actions';
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './primitives/Button';
export { Card, type CardProps } from './primitives/Card';
export { Badge, type BadgeProps, type BadgeVariant } from './primitives/Badge';
export { Placard, type PlacardProps } from './primitives/Placard';
export { Skeleton, type SkeletonProps } from './primitives/Skeleton';
export { EmptyState, type EmptyStateProps } from './primitives/EmptyState';
export { ErrorState, type ErrorStateProps, type ApiErrorCode } from './primitives/ErrorState';
export {
  ToastProvider,
  useToast,
  type ToastInput,
  type ToastTone,
} from './primitives/Toast';
export { Divider, type DividerProps } from './primitives/Divider';
export { Avatar, type AvatarProps, type AvatarSize } from './primitives/Avatar';
export {
  CountdownPill,
  type CountdownPillProps,
  type CountdownState,
  formatRemaining,
  remainingFromFreeAt,
} from './primitives/CountdownPill';

// ── Glass Stack additions (체계 틀 / system-framework phase) ──────────
// Theme-mode (system/light/dark) override + persistence. Read inside the
// app via useThemeMode(); the optional accessor used by use-theme.ts stays
// internal (not re-exported) so consumers go through one public door.
export {
  ThemeModeProvider,
  useThemeMode,
  type ThemeMode,
  THEME_MODE_STORAGE_KEY,
} from './theme-mode';

// Headless double-tap / rapid-press guard (requirement #2). Powers Button
// and any custom Pressable. (useGuardedNavigation lives in src/lib/navigation
// — a separate layer — and is intentionally NOT re-exported here.)
export {
  useAsyncPress,
  type AsyncPressHandler,
  type UseAsyncPressOptions,
  type UseAsyncPressResult,
} from './use-async-press';

// Frosted floating surface + its availability hook (iOS 26+ Liquid Glass
// with a designed theme-token fallback everywhere else).
export {
  GlassCard,
  type GlassCardProps,
  useGlassAvailable,
} from './primitives/GlassCard';

// Living wall of (blurred) cover art behind the glass — the login hero.
export { CoverWall, type CoverWallProps } from './primitives/CoverWall';
// Persistent, color-shifting backdrop for the authenticated area (§12.3).
export { AmbientProvider, useAmbient } from './ambient';
