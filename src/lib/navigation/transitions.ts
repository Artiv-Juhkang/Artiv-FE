/**
 * Navigation transitions — the single source of truth for how screens MOVE.
 * ------------------------------------------------------------------
 * AppToon is "two apps in one skin" (frontend-architecture §1, §9):
 *   - CHROME (auth / tabs / detail / community): the Glass Stack — a frosted
 *     form/surface floating over a living wall of (blurred) cover art. The art
 *     is the hero, so chrome transitions are calm horizontal slides that keep
 *     the wall continuous and let the gesture-back swipe feel like peeling the
 *     glass aside.
 *   - VIEWER / LIGHTBOX (immersive vertical reader, cover lightbox): enters
 *     MODALLY from the bottom over true-black so stepping into a story is felt,
 *     not just navigated.
 *
 * This module owns ONLY the shape of motion (which `screenOptions` each
 * Stack/Tabs gets). It is a LEAF in the dependency graph
 * (app → features → lib → … ): it imports React Navigation / screens TYPES and
 * the reduced-motion signal, nothing from `features`, `api`, or routes. The
 * `app` layouts (owned by the integration module) consume these factories.
 *
 * WHY factories that take `reduced` instead of plain constants:
 *   `screenOptions` is read by the navigator on every relevant render. A screen
 *   transition driven by the native stack (react-native-screens) cannot consult
 *   a JS shared value mid-flight, so reduced-motion must be baked into the
 *   options at build time. The layouts call `useReducedMotion()` (Reanimated)
 *   and pass the boolean in; when it's true we swap to `animation: 'none'`
 *   (or 'fade' for modals so a hard cut doesn't feel broken) and zero the
 *   duration. This mirrors `ui/use-theme.ts`'s `useMotion()` collapse-to-0
 *   philosophy so there is ONE mental model for reduced motion app-wide.
 *
 * REANIMATED 4 + REACT COMPILER NOTE (verifier rules):
 *   Nothing in this file is a worklet and nothing reads a shared value during
 *   render — these are plain option objects computed from a boolean + tokens.
 *   That is deliberate: keeping transition CONFIG out of the worklet/shared-
 *   value world is what keeps the navigator transitions error-free under the
 *   Reanimated 4 strict checks. Component-level entering/exiting animations
 *   (Reanimated layout animations) live with their components, not here, and
 *   MUST follow the rules restated in `REANIMATED_RULES` below.
 */
import type { NativeStackNavigationOptions } from 'expo-router';

import { motion as motionTokens } from '@/ui';

/**
 * Minimal structural type for the tab-bar ANIMATION subset we set.
 * We do NOT import `BottomTabNavigationOptions` because expo-router does not
 * re-export it from the package root (it lives under an internal
 * `react-navigation/bottom-tabs` path) and `@react-navigation/bottom-tabs` is
 * not a direct dependency — importing either would be a drift/version risk.
 * The (tabs) layout SPREADS this over its own fully-typed `screenOptions`, so
 * the navigator still type-checks the merged object; this local type only
 * constrains the keys WE own here.
 *
 * `animation` for the JS Tabs navigator is the `TabAnimationName` union
 * ('none' | 'fade' | 'shift'), NOT the native-stack `StackAnimationTypes`.
 */
type TabsAnimationOptions = {
  headerShown?: boolean;
  animation?: 'none' | 'fade' | 'shift';
  lazy?: boolean;
};

// ── Durations (sourced from the design tokens; never hardcode here) ──────────
// motion.duration: instant 0 · fast 120 · base 220 · slow 360 (ui/tokens.ts).
// Chrome push = base; modal present = slow (a story/lightbox deserves a beat).
const DURATION_CHROME = motionTokens.duration.base; // 220
const DURATION_MODAL = motionTokens.duration.slow; // 360

/**
 * react-native-screens animation tokens we actually use, named for intent.
 *  - 'ios_from_right'  : the platform-correct horizontal push for BOTH OSes
 *      (on Android it renders the iOS-style edge slide; on iOS it IS the
 *      default). We pin it explicitly so chrome push feels identical on both
 *      platforms instead of leaving Android to its OS/theme-dependent default.
 *  - 'slide_from_bottom': modal present (viewer / lightbox) — paired with
 *      `presentation: 'modal'` so the full-screen swipe-down-to-dismiss works.
 *  - 'fade' / 'none'   : reduced-motion fallbacks.
 */
const ANIM_PUSH = 'ios_from_right' as const;
const ANIM_MODAL = 'slide_from_bottom' as const;
const ANIM_FADE = 'fade' as const;
const ANIM_NONE = 'none' as const;

// ── Reduced-motion contract ──────────────────────────────────────────────────
// Reduce Motion ON: pushes become instant ('none', 0ms) — no horizontal travel
// that can trigger motion sensitivity. Modals keep a SHORT cross-fade ('fade')
// rather than a hard cut, because a modal popping in with zero transition reads
// as a glitch / "did it crash?"; a fast fade preserves the "a layer arrived"
// affordance while still removing translational motion. (WCAG 2.3.3 spirit:
// remove non-essential motion, not all state-change feedback.)

/**
 * Base chrome stack options — applied at EVERY chrome Stack
 * ((auth)/_layout, (app)/_layout, and any nested chrome stacks).
 *
 * @param reduced  result of `useReducedMotion()` from the layout.
 */
export function chromeStackScreenOptions(
  reduced: boolean,
): NativeStackNavigationOptions {
  return {
    headerShown: false, // chrome draws its own Glass header via ScreenLayout
    // Horizontal push, consistent across iOS + Android.
    animation: reduced ? ANIM_NONE : ANIM_PUSH,
    animationDuration: reduced ? 0 : DURATION_CHROME,
    // Gesture-back (the whole point of GestureHandlerRootView at root):
    // enabled, and on iOS allow the swipe to start from ANYWHERE on screen,
    // not just the 20pt edge, so the Glass surface peels away naturally.
    gestureEnabled: !reduced, // a back-swipe IS motion; honor the flag
    fullScreenGestureEnabled: !reduced,
    // Let the in-flight gesture drive the SAME push animation (no snap/jump
    // between gesture-tracking and the programmatic animation).
    animationMatchesGesture: true,
    gestureDirection: 'horizontal',
    // contentStyle is intentionally NOT set here: the per-screen ScreenLayout
    // owns the background (chrome bg vs viewer bg vs glass) so we never paint a
    // wrong-mode flash behind the transition. Setting it here would fight that.
  };
}

/**
 * Modal-presentation options for the VIEWER and the cover LIGHTBOX.
 * Spread onto the specific `<Stack.Screen options={...}>` (NOT the whole
 * stack) so only those routes present modally over the chrome beneath.
 *
 * `presentation: 'modal'` keeps the screen BELOW partly mounted (the gallery
 * wall stays visible at the edges as the viewer rises), and gives the native
 * swipe-down-to-dismiss for free. We do NOT use 'fullScreenModal' because that
 * fully detaches the underlay and kills the "rising over the wall" feel.
 *
 * Reduced motion: present with a fast fade and disable the dismiss gesture's
 * travel (gesture stays enabled but on a 'fade' there is no translation to
 * track, so it behaves as tap-region dismiss without sliding the screen).
 */
export function modalScreenOptions(
  reduced: boolean,
): NativeStackNavigationOptions {
  return {
    headerShown: false,
    presentation: 'modal',
    animation: reduced ? ANIM_FADE : ANIM_MODAL,
    animationDuration: reduced ? motionTokens.duration.fast : DURATION_MODAL,
    // Vertical swipe-down to dismiss. Kept enabled even under reduced motion:
    // dismiss-by-swipe is an ESSENTIAL control here (no header back button in
    // the immersive viewer), and on a 'fade' animation there is no translation
    // to induce motion sickness.
    gestureEnabled: true,
    gestureDirection: 'vertical',
    animationMatchesGesture: !reduced,
  };
}

/**
 * Tab bar screen options shared by the (tabs) navigator. Tabs themselves do NOT
 * slide horizontally (that would fight the stack's horizontal push and confuse
 * "where am I"); cross-fade between tabs is the calm, platform-agnostic choice
 * and is the only tab animation that respects reduced motion cleanly.
 *
 * NOTE: this returns the ANIMATION-related subset only. Color/label/icon
 * options stay in the (tabs) layout (they need `useTheme()` there). The layout
 * spreads this over its own themed options.
 */
export function tabsScreenOptions(reduced: boolean): TabsAnimationOptions {
  return {
    headerShown: false,
    // Cross-fade tabs; 'shifting'/'none' are the only motion-safe options.
    animation: reduced ? 'none' : 'fade',
    // Lazy-mount inactive tabs so we don't pay for off-screen Reanimated trees.
    lazy: true,
  };
}

/**
 * Reanimated 4 + React Compiler correctness rules for any COMPONENT-LEVEL
 * animation the integration module (or feature authors) add on top of these
 * navigator transitions — e.g. the Glass surface's entering fade/translate on
 * the sign-in screen, the unlock pulse, viewer chrome auto-hide.
 *
 * These are documented here (next to the transition policy) so there is ONE
 * place that states the motion-correctness contract. Enforced by the
 * Reanimated/Expo verifier + the React Compiler's rules-of-hooks.
 */
export const REANIMATED_RULES = Object.freeze({
  // 1. Never READ a shared value during render. In a component body,
  //    `sv.value` / `sv.get()` is FORBIDDEN — it produces a stale read and the
  //    Reanimated verifier flags it. Read shared values ONLY inside worklets
  //    (useAnimatedStyle, useDerivedValue, gesture callbacks, runOnUI).
  noSharedValueReadInRender: true,
  // 2. Use get()/set() (Reanimated 4) — `.value` getter/setter still works but
  //    get()/set() is the compiler-friendly form and avoids the "reading
  //    .value during render" false-negative the compiler can't see through.
  //    On the UI thread inside a worklet, prefer `sv.get()` / `sv.set(v)`.
  useGetSetAccessors: true,
  // 3. Every function that touches a shared value or runs on the UI thread is a
  //    WORKLET. Inline arrows passed to useAnimatedStyle/Gesture are auto-
  //    workletized by the Babel plugin; a helper they call must be declared
  //    with the `'worklet'` directive or it will throw "tried to call a
  //    non-worklet function on the UI thread".
  markHelpersAsWorklet: true,
  // 4. Cross-thread hops: UI→JS via runOnJS(fn)(args); JS→UI via runOnUI.
  //    Navigation (router.push/back) is a JS-thread action — call it through
  //    runOnJS from a gesture worklet, NEVER directly.
  navigateViaRunOnJS: true,
  // 5. Respect reduced motion in component animations too: pass
  //    `{ reduceMotion: ReduceMotion.System }` to withTiming/withSpring (it is
  //    the DEFAULT, but be explicit on celebratory motion) OR branch on
  //    `useReducedMotion()` / `useMotion()` to collapse the animation. This
  //    file's navigator options already do the navigator half.
  honorReduceMotionInWorklets: true,
  // 6. React Compiler: animation hooks (useSharedValue/useAnimatedStyle/…) obey
  //    rules-of-hooks — call unconditionally, top-level, stable order. Do not
  //    create shared values inside loops/conditions.
  hooksUnconditional: true,
} as const);

export type ReanimatedRules = typeof REANIMATED_RULES;
