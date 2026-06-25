/**
 * useGuardedNavigation — leading-edge throttle over the expo-router imperative
 * router, so a double-tap (or two components racing) can never double-push.
 * ------------------------------------------------------------------
 * REQUIREMENT #2 (체계 틀), navigation half: `useAsyncPress` stops a single
 * button from firing twice, but it is SCOPED to that button. Navigation has a
 * second failure mode the per-button lock cannot see:
 *
 *   - Two DIFFERENT components (e.g. a list row and a floating CTA) both call
 *     `router.push('/series/42')` within the same frame → two screens pushed.
 *   - A press handler `await`s, then navigates, while the user taps a sibling.
 *
 * The fix is a MODULE-LEVEL timestamp gate shared by every guarded call across
 * the whole app. The first navigation in a `WINDOW_MS` window wins; anything
 * else (same target or not) is dropped. This is intentionally global: the goal
 * is "one navigation per intentional gesture", and a real human cannot
 * meaningfully push two distinct destinations 500ms apart — that pattern is
 * always an accidental double-fire or a race.
 *
 * WHY A SEPARATE LAYER (not in `ui`)
 *   `ui/` must not depend on `expo-router` (frontend-architecture §2 layering:
 *   ui is a pure presentation leaf). Navigation guarding therefore lives under
 *   `src/lib/navigation` next to `transitions.ts`, and is NOT re-exported from
 *   the `ui` barrel. Components import it directly from this path.
 *
 * REANIMATED NOTE: zero Reanimated / shared-value involvement. These are plain
 * JS-thread functions. From a gesture worklet you would still call them via
 * `runOnJS`, exactly like raw `router.*`.
 *
 * TRADE-OFFS (documented edge cases)
 *   - An INTENTIONAL fast hop to a different screen inside the window is also
 *     dropped. 500ms is tuned so this is effectively impossible by hand; bump
 *     `WINDOW_MS` only if a flow legitimately needs rapid programmatic nav.
 *   - `Stack.Protected` redirects (auth guard flipping) do NOT go through this
 *     wrapper, so guarded throttling never interferes with route protection.
 */
import { useMemo } from 'react';
import { router, type Href } from 'expo-router';

/**
 * `NavigationOptions` is the second argument of the router push/navigate/etc.
 * methods. expo-router does not re-export the type name from its package root,
 * so we derive it from the router signature itself — this stays correct across
 * patch versions and avoids importing an internal/deep path.
 */
export type NavigationOptions = NonNullable<Parameters<typeof router.push>[1]>;

export interface GuardedNavigation {
  push: (href: Href, options?: NavigationOptions) => void;
  navigate: (href: Href, options?: NavigationOptions) => void;
  replace: (href: Href, options?: NavigationOptions) => void;
  dismissTo: (href: Href, options?: NavigationOptions) => void;
  back: () => void;
}

/** Shared leading-edge throttle window across ALL guarded navigations. */
const WINDOW_MS = 500;

/** Module-level so every component shares the same gate (the whole point). */
let lastNavAt = 0;

/**
 * Returns true and stamps the clock if a navigation is allowed RIGHT NOW;
 * returns false (drop) if we're still inside the trailing window of the last.
 */
function takeNavSlot(): boolean {
  const now = Date.now();
  if (now - lastNavAt < WINDOW_MS) return false;
  lastNavAt = now;
  return true;
}

/** Push a new screen, dropped if another guarded nav fired <500ms ago. */
export function guardedPush(href: Href, options?: NavigationOptions): void {
  if (!takeNavSlot()) return;
  router.push(href, options);
}

/** Navigate (push-or-jump), dropped if another guarded nav fired <500ms ago. */
export function guardedNavigate(href: Href, options?: NavigationOptions): void {
  if (!takeNavSlot()) return;
  router.navigate(href, options);
}

/** Replace the current screen, dropped if another guarded nav fired <500ms ago. */
export function guardedReplace(href: Href, options?: NavigationOptions): void {
  if (!takeNavSlot()) return;
  router.replace(href, options);
}

/** Go back, dropped if another guarded nav fired <500ms ago (anti double-back). */
export function guardedBack(): void {
  if (!takeNavSlot()) return;
  // Guard against popping past the first screen of the stack.
  if (router.canGoBack()) router.back();
}

/** Dismiss down to `href`, dropped if another guarded nav fired <500ms ago. */
export function guardedDismissTo(
  href: Href,
  options?: NavigationOptions,
): void {
  if (!takeNavSlot()) return;
  router.dismissTo(href, options);
}

/**
 * Hook form: a STABLE object (memoized once) of the guarded navigation
 * functions, so it can sit in a dependency array without churning. The bound
 * functions are module-level standalones, so the object is effectively
 * constant for the component's lifetime.
 */
export function useGuardedNavigation(): GuardedNavigation {
  return useMemo<GuardedNavigation>(
    () => ({
      push: guardedPush,
      navigate: guardedNavigate,
      replace: guardedReplace,
      dismissTo: guardedDismissTo,
      back: guardedBack,
    }),
    [],
  );
}

/**
 * Test-only hook to reset the shared throttle clock between cases (the gate is
 * module-level state). Not part of the production API surface.
 */
export function __resetNavGuard(): void {
  lastNavAt = 0;
}
