/**
 * (app) group shell — the AUTHENTICATED area. Holds (tabs), the series detail
 * (`series/[id]`), and the viewer (`series/[id]/[episodeNo]`, future) later.
 * The root Stack.Protected guard={status === 'authenticated'} already gates
 * this whole group, so this is just a headerless Stack.
 *
 * `series/[id]` is registered as a SIBLING of `(tabs)` so it is push-navigated
 * as a full screen OVER the tab bar (immersive art-led hero + back). We keep
 * `headerShown: false`: the detail is an art-driven full-bleed hero and the
 * custom <Screen> already owns the top safe-area inset, so a native (large-
 * title) header would both fight the art and double-pad the top. The hero
 * carries its own back affordance. The viewer route is a follow-up; its
 * Stack.Screen is seeded as a comment so this file stays the single owner of
 * the (app) Stack wiring without claiming an unimplemented screen.
 */
import { Stack } from 'expo-router';

export default function AppGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="series/[id]" options={{ headerShown: false }} />
      {/* FUTURE SEAM (viewer): once src/app/(app)/series/[id]/[episodeNo].tsx
          exists, register it here with the viewer surface + immersive options:
          <Stack.Screen name="series/[id]/[episodeNo]" options={{ headerShown: false }} /> */}
    </Stack>
  );
}
