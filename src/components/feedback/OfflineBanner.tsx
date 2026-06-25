/**
 * OfflineBanner — a thin top-of-screen strip shown only while offline.
 *
 * Reads connectivity from NetworkProvider (the single NetInfo subscription);
 * it does NOT subscribe to NetInfo itself. Renders null when online, so it's
 * cheap to mount permanently at the root (above the navigator). It tucks
 * under the status bar via the SafeArea top inset and uses the warn role so
 * it reads as a transient caution, not a hard error.
 *
 * Copy is explicit about WHAT happened and WHAT still works: viewing cached
 * content is fine; new requests will retry automatically on reconnect (React
 * Query resumes via onlineManager, wired in NetworkProvider).
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '@/providers/NetworkProvider';
import { Text, useTheme } from '@/ui';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const t = useTheme();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        pointerEvents: 'none',
        zIndex: t.zIndex.toast,
        paddingTop: insets.top + t.space.xs,
        paddingBottom: t.space.xs,
        paddingHorizontal: t.space.lg,
        backgroundColor: t.color.warn,
        alignItems: 'center',
      }}
    >
      <Text variant="caption" weight="semibold" style={{ color: t.color.onAccent, textAlign: 'center' }}>
        오프라인 상태예요. 연결되면 자동으로 다시 시도할게요.
      </Text>
    </View>
  );
}
