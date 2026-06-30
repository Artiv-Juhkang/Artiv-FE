/**
 * 창작물 타입 레지스트리 엔드포인트.
 *
 * GET /api/creativity/types 가 매체 타입 메타를 통째로 내려준다(타입=데이터):
 * 백엔드에서 ContentType 값을 추가하면 프론트는 코드 변경 없이 새 탭/뷰어가 자동 등장.
 * 프론트는 이 목록으로 창작 탭의 타입 칩과 뷰어 분기를 동적 렌더한다.
 */
import { api } from '@/api/client';

/** 창작물 타입 레지스트리 항목. assetKinds 가 뷰어 분기 키(IMAGE/TEXT/AUDIO). */
export interface ContentTypeMeta {
  /** 'WEBTOON' | 'ILLUSTRATION' | 'DESIGN' | 'PHOTO' | 'DRAWING' | 'NOVEL' | 'AUDIO' (확장 가능). */
  key: string;
  /** 표시 라벨('웹툰' 등). */
  label: string;
  /** 회차 연재 여부(WEBTOON·NOVEL·AUDIO=true). 요일·회차번호는 이 타입만 사용. */
  serialized: boolean;
  /** 담는 미디어 종류 — 뷰어 분기 키. */
  assetKinds: string[];
}

/** 타입 레지스트리 조회(거의 정적). */
export async function getContentTypes(): Promise<ContentTypeMeta[]> {
  const { data } = await api.get<ContentTypeMeta[]>('/api/creativity/types');
  return data;
}
