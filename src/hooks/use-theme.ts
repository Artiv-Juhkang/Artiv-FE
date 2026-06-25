/**
 * LEGACY flat-color theme hook.
 * ------------------------------------------------------------------
 * This is the ORIGINAL Expo-template hook that returns the FLAT
 * `Colors[scheme]` map (`{ text, background, backgroundElement, ... }`)
 * from `@/constants/theme`. It is kept ONLY because the legacy template
 * components still import it:
 *   - src/components/themed-text.tsx
 *   - src/components/themed-view.tsx
 *   - src/components/ui/collapsible.tsx
 * Those read `theme.text` / `theme.background` etc., so this hook MUST
 * keep returning that flat shape — it can NOT just re-export the new
 * `@/ui/use-theme` (which returns the role-based `Theme` object).
 *
 * CANONICAL theme hook = `@/ui/use-theme`. New code must import from there
 * (or `@/ui`). This file is intentionally NOT exported from the `@/ui`
 * barrel to keep it off the happy path.
 *
 * What we DO reconcile here: the active scheme is resolved through the
 * SAME user-override path as the rest of the app, so toggling
 * 시스템/라이트/다크 also re-skins these legacy components. We read the
 * override via the non-throwing optional accessor (so this still works if
 * rendered outside the provider) and fall back to the OS scheme.
 */
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeModeContextOptional } from '@/ui/theme-mode';

export function useTheme() {
  const ctx = useThemeModeContextOptional();
  const osScheme = useColorScheme();
  const scheme =
    ctx != null ? ctx.resolvedScheme : osScheme === 'dark' ? 'dark' : 'light';

  return Colors[scheme];
}
