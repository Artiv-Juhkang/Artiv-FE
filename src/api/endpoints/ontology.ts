/**
 * 창작자 온톨로지 — 진단·공유 독자·액션.
 *
 * schema.d.ts codegen을 쓰지 않고 수기 interface를 둔다(reading-events.ts와 같은 선례):
 * 응답 모양이 백엔드 record와 1:1이고, codegen 스냅샷 갱신 주기와 이 화면의 개발 주기가 다르다.
 */
import { api } from '@/api/client';

export interface WorkInsights {
  workId: number;
  title: string;
  contentType: string;
  medium: string;
  window: { days: number; from: string; to: string };
  summary: {
    sessions: number;
    uniqueReaders: number;
    /** 표본 10건 미만이면 null — 없는 정밀도를 지어내지 않는다. */
    completionRate: number | null;
    sampleSize: number;
  };
  retention: {
    episodeNo: number;
    uniqueReaders: number;
    retentionPct: number;
    completionRate: number | null;
    cliff: boolean;
  }[];
  cliff: { episodeNo: number; dropPct: number } | null;
  entryPoints: { entryPoint: string; label: string; sessions: number; share: number }[];
  segments: {
    segment: string;
    label: string;
    rule: string;
    /** k(5) 미만이면 null. */
    size: number | null;
    disclosed: boolean;
  }[];
  applicableActions: string[];
  lastAction: { actionType: string; label: string; occurredAt: string } | null;
}

export interface SharedAudience {
  /** null이면 분모가 너무 작아 계산하지 않았다는 뜻. */
  myAudienceSize: number | null;
  links: {
    workId: number;
    title: string;
    contentType: string;
    medium: string;
    shareOfMyAudience: number;
  }[];
}

export interface OntologySchema {
  objects: { key: string; label: string; backing: string | null; derived: boolean }[];
  links: { key: string; label: string; from: string; to: string; kind: string }[];
  actions: { key: string; label: string; target: string; method: string; endpoint: string }[];
}

export async function getWorkInsights(seriesId: number): Promise<WorkInsights> {
  const { data } = await api.get<WorkInsights>(`/api/ontology/works/${seriesId}/insights`);
  return data;
}

export async function getSharedAudience(seriesId: number): Promise<SharedAudience> {
  const { data } = await api.get<SharedAudience>(`/api/ontology/works/${seriesId}/shared-audience`);
  return data;
}

export async function getOntologySchema(): Promise<OntologySchema> {
  const { data } = await api.get<OntologySchema>('/api/ontology/schema');
  return data;
}

/** 성공 응답은 200 + 빈 바디 — 수신자 수를 돌려주지 않는다(설계 결정 D4). */
export async function nudgeLapsedAudience(seriesId: number): Promise<void> {
  await api.post('/api/ontology/actions/nudge-lapsed-audience', { seriesId });
}
