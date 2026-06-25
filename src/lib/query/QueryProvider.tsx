/**
 * 정본 QueryClientProvider 마운트.
 *
 * 싱글톤 queryClient를 사용한다 — 여기서 new QueryClient를 만들지 말 것.
 * onlineManager 배선은 하지 않는다(NetworkProvider가 단일 NetInfo 구독으로 소유).
 *
 * 프로바이더 순서상 AuthProvider보다 위에 위치해야 한다
 * (AuthProvider가 useQueryClient로 logout 시 qc.clear()를 호출하므로).
 */
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
