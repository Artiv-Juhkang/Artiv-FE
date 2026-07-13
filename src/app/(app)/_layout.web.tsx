/**
 * (app) group shell — WEB override. Same authenticated Stack as the native
 * _layout.tsx (which MUST remain as the platform base for typed routes / deep
 * linking), but the Stack is wrapped in <WebShell> so browse screens render
 * inside a desktop left-rail frame and the viewer/studio take over the window.
 *
 * AmbientProvider stays the outermost layer (identical to native) so the
 * persistent aurora backdrop never re-mounts across navigation and shows through
 * the transparent content region.
 */
import { Stack } from 'expo-router';

import { AmbientProvider } from '@/ui';
import { WebShell } from '@/features/web-shell/WebShell';

export default function AppGroupLayoutWeb() {
  return (
    <AmbientProvider>
      <WebShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="series/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="series/[id]/[episodeNo]" options={{ headerShown: false }} />
          <Stack.Screen name="series/[id]/[episodeNo]/comments" options={{ headerShown: false }} />
          <Stack.Screen name="authors/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="users/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/new" options={{ headerShown: false }} />
          <Stack.Screen name="posts/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="posts/new" options={{ headerShown: false }} />
          <Stack.Screen name="posts/[id]/edit" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="studio/index" options={{ headerShown: false }} />
          <Stack.Screen name="studio/new" options={{ headerShown: false }} />
          <Stack.Screen name="studio/[id]/upload" options={{ headerShown: false }} />
          <Stack.Screen name="creator-request" options={{ headerShown: false }} />
          <Stack.Screen name="inquiries/index" options={{ headerShown: false }} />
          <Stack.Screen name="inquiries/new" options={{ headerShown: false }} />
          <Stack.Screen name="inquiries/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="faq" options={{ headerShown: false }} />
        </Stack>
      </WebShell>
    </AmbientProvider>
  );
}
