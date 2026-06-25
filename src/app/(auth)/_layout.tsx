/**
 * (auth) group shell — the UNAUTHENTICATED area (sign-in, later sign-up).
 *
 * The root layout's `Stack.Protected guard={status === 'unauthenticated'}`
 * already gates this whole group, so here we only need a plain headerless
 * Stack. Group folders never add a URL segment, so `sign-in.tsx` resolves to
 * `/sign-in`.
 */
import { Stack } from 'expo-router';

export default function AuthGroupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
