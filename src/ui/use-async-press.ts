/**
 * useAsyncPress — headless double-tap / rapid-press guard for any pressable.
 * ------------------------------------------------------------------
 * REQUIREMENT #2 (체계 틀): action buttons must NEVER double-submit or
 * double-load. This hook is the reusable engine behind `Button` and any
 * custom `Pressable` (social buttons, list-row actions, footer CTAs).
 *
 * HOW IT GUARANTEES SINGLE-FIRE
 *   There are two layers:
 *     1. `lockedRef` (a synchronous ref) is the AUTHORITATIVE gate. The very
 *        first press flips it to `true` BEFORE React re-renders. Because a
 *        ref mutation is synchronous, a second tap arriving in the same frame
 *        (the classic double-tap, or two fingers) reads `true` and is dropped
 *        — there is no render-timing window to slip through, unlike a
 *        `useState`-only guard.
 *     2. `pending` (useState) is purely a MIRROR for the UI (spinner /
 *        disabled styling). It follows the lock but never makes the gating
 *        decision, so a slow re-render can't reopen the gate.
 *
 * SYNC + ASYNC NORMALISATION
 *   The handler may be a plain `void` function (fire-and-forget navigation)
 *   OR return a `Promise`. We wrap it in `Promise.resolve(handler(e))` so both
 *   shapes share one code path:
 *     - async handler  → the lock is held for the WHOLE awaited promise, then
 *       released, then a trailing COOLDOWN keeps it shut a little longer so the
 *       UI can settle (and a flick of the finger can't re-fire on completion).
 *     - sync handler   → the promise resolves immediately; the lock would open
 *       at once, so the trailing COOLDOWN window is what actually blocks the
 *       double-tap here. This is why the default cooldown is non-zero.
 *
 * REDUCED MOTION
 *   Under OS "Reduce Motion" the cooldown collapses to 0 (we read it from the
 *   same `useMotion()` collapse-to-0 signal the rest of the app uses) — a user
 *   who has disabled motion typically wants snappier, not laggier, controls,
 *   and for an async handler the awaited promise still guards the window.
 *
 * SAFETY
 *   - A handler rejection is caught as a BACKSTOP so the lock is always
 *     released (never a permanently-dead button) — but the owning handler is
 *     expected to do its own user-facing error handling first; `onError` here
 *     is only a hook for logging / dev surfacing.
 *   - On unmount we clear the cooldown timer and skip any `setState`
 *     (mountedRef) so a press that resolves after the screen is gone is silent.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

import { useMotion } from './use-theme';

/** A press handler that may run synchronously or return a Promise. */
export type AsyncPressHandler = (
  e: GestureResponderEvent,
) => void | Promise<void>;

export interface UseAsyncPressOptions {
  /**
   * Trailing lock window (ms) after the handler settles. Blocks the
   * double-tap for synchronous handlers and absorbs the settle-flick for
   * async ones. Default 350ms; collapses to 0 under reduced motion.
   * NOTE: `cooldownMs: 0` with a SYNC handler removes double-tap protection
   * for that button — keep the default unless you have a specific reason.
   */
  cooldownMs?: number;
  /** External disabled flag; short-circuits before the handler runs. */
  disabled?: boolean;
  /** Backstop for handler rejections (logging / dev). The handler should
   * surface user-facing errors itself; the lock is released regardless. */
  onError?: (e: unknown) => void;
}

export interface UseAsyncPressResult {
  /** Wire this to the pressable's `onPress`. Gated + cooldown-protected. */
  onPress: (e: GestureResponderEvent) => void;
  /** True while the handler's promise is in flight — drive a spinner from it. */
  pending: boolean;
  /** True when the caller passed `disabled` (mirror for styling/a11y). */
  disabled: boolean;
}

const DEFAULT_COOLDOWN_MS = 350;

/**
 * @param handler  the action to run; may be sync or async. `undefined` makes
 *                 the press a no-op (and reports `disabled: true`-ish behavior
 *                 only when `opts.disabled` is set — an absent handler simply
 *                 does nothing on press).
 * @param opts     cooldown / disabled / onError.
 */
export function useAsyncPress(
  handler: AsyncPressHandler | undefined,
  opts: UseAsyncPressOptions = {},
): UseAsyncPressResult {
  const { cooldownMs, disabled = false, onError } = opts;

  const motion = useMotion();
  // Reduce-motion collapses every duration to 0; detect it off `base` (220→0)
  // so the cooldown follows the SAME single mental model as the rest of the UI.
  const reduced = motion.duration.base === 0;
  const effectiveCooldown = reduced
    ? 0
    : cooldownMs ?? DEFAULT_COOLDOWN_MS;

  // Authoritative synchronous gate. Mutated before any render can occur.
  const lockedRef = useRef(false);
  // UI mirror (spinner / disabled). Never gates; only reflects in-flight state.
  const [pending, setPending] = useState(false);

  // Lifecycle guards so a late-resolving promise can't touch a dead component.
  const mountedRef = useRef(true);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest handler/opts without re-creating `onPress` each render
  // (stable identity matters for memoized Pressables and the React Compiler).
  // Refs are synced in an EFFECT, never during render — the React Compiler's
  // `react-hooks/refs` rule forbids mutating a ref in the render body. A press
  // can only happen after paint, so the effect has always run by then.
  const handlerRef = useRef(handler);
  const disabledRef = useRef(disabled);
  const cooldownRef = useRef(effectiveCooldown);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    handlerRef.current = handler;
    disabledRef.current = disabled;
    cooldownRef.current = effectiveCooldown;
    onErrorRef.current = onError;
  }, [handler, disabled, effectiveCooldown, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cooldownTimer.current != null) {
        clearTimeout(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
  }, []);

  const release = useCallback(() => {
    const ms = cooldownRef.current;
    const open = () => {
      lockedRef.current = false;
      if (mountedRef.current) setPending(false);
      cooldownTimer.current = null;
    };
    if (ms > 0) {
      // Trailing cooldown: keep the gate shut a beat longer than the work.
      cooldownTimer.current = setTimeout(open, ms);
    } else {
      open();
    }
  }, []);

  const onPress = useCallback(
    (e: GestureResponderEvent) => {
      // 1. Hard gates (synchronous, no render dependency).
      if (disabledRef.current) return;
      if (lockedRef.current) return; // double-tap / rapid-press → dropped
      const fn = handlerRef.current;
      if (!fn) return;

      // 2. Latch the gate BEFORE running the handler. A second tap in the
      //    same frame now sees `true` and bails at step 1.
      lockedRef.current = true;

      // 3. Run + normalise sync/async into a single promise path.
      let result: void | Promise<void>;
      try {
        result = fn(e);
      } catch (err) {
        // Synchronous throw from the handler: report + release immediately.
        onErrorRef.current?.(err);
        release();
        return;
      }

      const isPromise =
        result != null && typeof (result as Promise<void>).then === 'function';

      if (!isPromise) {
        // Sync handler: nothing to await. The trailing cooldown (step in
        // `release`) is what blocks the double-tap for this case.
        release();
        return;
      }

      // Async handler: reflect in-flight state for the spinner, hold the lock
      // for the whole awaited promise, then release (+cooldown).
      if (mountedRef.current) setPending(true);
      Promise.resolve(result)
        .catch((err) => {
          // Backstop ONLY: the handler is expected to surface its own error.
          // We still release so the button never dies permanently.
          onErrorRef.current?.(err);
        })
        .finally(() => {
          release();
        });
    },
    [release],
  );

  return { onPress, pending, disabled };
}
