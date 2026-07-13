/**
 * 신고 — 폴리모픽 대상(POST/COMMENT/USER/SERIES/EPISODE) + 사유 5종.
 * 같은 대상 중복 신고는 400(INVALID_INPUT) — 호출부가 '이미 신고' 안내로 매핑한다.
 */
import { api } from '@/api/client';

export type ReportTargetType = 'POST' | 'COMMENT' | 'USER' | 'SERIES' | 'EPISODE' | 'MESSAGE';
export type ReportReason = 'SPAM' | 'ABUSE' | 'SEXUAL' | 'COPYRIGHT' | 'ETC';

export async function createReport(params: {
  targetType: ReportTargetType;
  targetId: number;
  reason: ReportReason;
  detail?: string;
}): Promise<void> {
  await api.post('/api/reports', params);
}
