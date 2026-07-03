/**
 * FormData 빌더 + 멀티파트 업로드 헬퍼.
 *
 * 전략: 스칼라 필드(title/publishAt 등)는 axios query 로, 바이너리(이미지 파트)만 FormData 로.
 * Content-Type 은 axios 가 FormData 를 감지해 multipart boundary 와 함께 자동 설정한다(수동 설정 금지).
 *
 * RN FormData 파일 파트는 { uri, name, type } 형태(웹 Blob 아님).
 */
import { api } from './client';

/**
 * 파일 파트. 네이티브(RN)는 { uri, name, type } 객체를 FormData 에 넣지만, 웹의
 * FormData 는 브라우저 표준이라 실제 File/Blob 을 요구한다. expo picker 가 웹에서
 * 넘겨주는 File 을 `file` 에 실어 두고, buildFormData 가 있으면 그걸 append 한다.
 */
export type RNFilePart = { uri: string; name: string; type: string; file?: File };

/** 업로드 진행률. pct 는 0~100 정수. */
export type UploadProgress = { loaded: number; total: number; pct: number };

/** uri 로부터 RNFilePart 생성. name/type 미지정 시 uri 확장자에서 추론. */
export function makeRNFilePart(
  uri: string,
  name?: string,
  type?: string,
  file?: File,
): RNFilePart {
  const ext = guessExtension(uri);
  return {
    uri,
    name: name ?? `upload.${ext}`,
    type: type ?? mimeForExtension(ext),
    file,
  };
}

function guessExtension(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot === -1) return 'jpg';
  return clean.slice(dot + 1).toLowerCase() || 'jpg';
}

function mimeForExtension(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

/**
 * 바이너리 파트만 담는 FormData 생성.
 * 같은 필드에 여러 파일이면 같은 키로 반복 append(서버가 List 로 수신).
 */
export function buildFormData(
  files: Record<string, RNFilePart | RNFilePart[]>,
): FormData {
  const form = new FormData();
  for (const [field, value] of Object.entries(files)) {
    const parts = Array.isArray(value) ? value : [value];
    for (const part of parts) {
      if (part.file) {
        // 웹: 브라우저 표준 FormData → 실제 File 을 append(파일명은 정규화한 name 사용).
        form.append(field, part.file, part.name);
      } else {
        // 네이티브: RN 의 FormData 는 { uri, name, type } 객체를 받는다.
        // 타입 시스템상 Blob 을 기대하므로 unknown 경유 캐스팅.
        form.append(field, part as unknown as Blob);
      }
    }
  }
  return form;
}

/**
 * 멀티파트 업로드. 스칼라는 query, 바이너리는 body.
 * INVALID_IMAGE 등 에러는 client 인터셉터의 normalizeError 가 AppError 로 변환 → 호출부에서 처리.
 */
export async function uploadMultipart<T>(
  path: string,
  opts: {
    query?: Record<string, unknown>;
    files: Record<string, RNFilePart | RNFilePart[]>;
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  },
): Promise<T> {
  const form = buildFormData(opts.files);
  const { data } = await api.post<T>(path, form, {
    params: opts.query,
    signal: opts.signal,
    // Content-Type 은 지정하지 않는다 — axios 가 FormData boundary 를 자동 부여.
    onUploadProgress: opts.onProgress
      ? (e) => {
          const total = e.total ?? 0;
          const loaded = e.loaded ?? 0;
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
          opts.onProgress?.({ loaded, total, pct });
        }
      : undefined,
  });
  return data;
}
