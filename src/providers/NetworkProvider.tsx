/**
 * NetworkProvider — the app's SINGLE source of online/offline truth.
 *
 * Responsibilities:
 *   1. Subscribe to @react-native-community/netinfo exactly ONCE (one
 *      addEventListener + one fetch() seed) for the whole app.
 *   2. Push that state into React Query's onlineManager so paused/retried
 *      queries resume on reconnect (QueryProvider intentionally does NOT
 *      wire onlineManager — this provider owns it).
 *   3. Expose the same state to the UI via useNetworkStatus() so the
 *      OfflineBanner can render without its own NetInfo subscription.
 *
 * "Online" = connected AND internet is reachable. NetInfo reports
 * isInternetReachable as boolean | null (null = still probing); we only
 * treat it as offline when it's explicitly false, so a brief null during
 * startup doesn't flash the offline banner.
 *
 * Do NOT create any other NetInfo subscription anywhere (no separate
 * installOnlineManager helper) — this is the only one.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type NetworkStatus = {
  /** connected && internet reachable (reachable null treated as online). */
  isOnline: boolean;
  /** raw NetInfo reachability tri-state: true | false | null (probing). */
  isInternetReachable: boolean | null;
};

const DEFAULT_STATUS: NetworkStatus = {
  isOnline: true, // optimistic until the first NetInfo event lands
  isInternetReachable: null,
};

const NetworkContext = createContext<NetworkStatus>(DEFAULT_STATUS);

/** Compute "online" from a NetInfo snapshot. reachable===false => offline. */
function computeOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>(DEFAULT_STATUS);

  useEffect(() => {
    let mounted = true;

    const handle = (state: NetInfoState) => {
      if (!mounted) return;
      const isOnline = computeOnline(state);
      // Keep React Query's notion of connectivity in lockstep with the UI's.
      onlineManager.setOnline(isOnline);
      setStatus({ isOnline, isInternetReachable: state.isInternetReachable });
    };

    // Seed immediately so we don't wait for the first connectivity change,
    // then keep listening. One fetch + one subscription for the whole app.
    NetInfo.fetch().then(handle).catch(() => {
      // Best-effort: if the initial probe fails, stay optimistic (online).
    });
    const unsubscribe = NetInfo.addEventListener(handle);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<NetworkStatus>(
    () => ({ isOnline: status.isOnline, isInternetReachable: status.isInternetReachable }),
    [status.isOnline, status.isInternetReachable],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

/**
 * Read the current connectivity. Returns { isOnline, isInternetReachable }.
 * Used by OfflineBanner and any screen that wants to degrade gracefully
 * while offline. Falls back to the optimistic default outside a provider.
 */
export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkContext);
}
