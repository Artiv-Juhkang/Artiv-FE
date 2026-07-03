/**
 * 스튜디오 자산 선택기 — 매체 종류별로 갤러리/문서 피커를 감싸 RNFilePart[] 로 정규화한다.
 *
 * 이미지 = expo-image-picker(다중), 텍스트/오디오 = expo-document-picker. 업로드 파트명은
 * 백엔드 계약대로 'images' 로 통일하므로(EpisodeController @RequestPart("images")), 여기선
 * uri/name/type 만 만든다. MIME 은 백엔드 허용 집합(ImageStorageService/MediaStorageService)에
 * 맞도록 확장자 기준으로 보정한다.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { makeRNFilePart, type RNFilePart } from '@/api/multipart';

/** 회차 자산 종류 — 작품 contentType 이 결정한다(레지스트리 assetKinds). */
export type AssetKind = 'IMAGE' | 'TEXT' | 'AUDIO';

/**
 * 백엔드 ImageStorageService 가 허용하는 이미지 MIME(그 외는 INVALID_IMAGE).
 * 웹 드롭존/제출 전 가드레일이 이 집합으로 사전 차단한다(서버 왕복 전 즉시 피드백).
 */
export const ACCEPTED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png'];

/**
 * 브라우저 File[] → RNFilePart[]. 웹 DropZone(드래그/파일선택)에서만 호출한다.
 * makeRNFilePart 에 실제 File 을 실어 두면 buildFormData 가 웹에서 그걸 append 한다.
 * uri 는 미리보기용 object URL(사용 후 revoke 필요).
 */
export function filesToParts(files: File[]): RNFilePart[] {
  return files.map((f) =>
    makeRNFilePart(URL.createObjectURL(f), f.name, f.type || undefined, f),
  );
}

function extOf(name: string): string {
  const dot = name.split('?')[0].lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/** 오디오 MIME 을 백엔드 허용값으로 보정(확장자 기준). */
function audioMime(name: string, fallback?: string | null): string {
  switch (extOf(name)) {
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    default:
      return fallback ?? 'audio/mpeg';
  }
}

/** 텍스트 MIME(백엔드 허용: text/plain, text/markdown). */
function textMime(name: string): string {
  return extOf(name) === 'md' ? 'text/markdown' : 'text/plain';
}

/** 회차 이미지 다중 선택(웹툰·일러 등). 취소 시 빈 배열. */
export async function pickImages(): Promise<RNFilePart[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    quality: 0.9,
  });
  if (result.canceled) return [];
  return result.assets.map((a) =>
    makeRNFilePart(a.uri, a.fileName ?? undefined, a.mimeType ?? undefined, a.file),
  );
}

/** 커버 단일 이미지 선택. 취소 시 null. */
export async function pickCover(): Promise<RNFilePart | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: false,
    quality: 0.9,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return makeRNFilePart(a.uri, a.fileName ?? 'cover.jpg', a.mimeType ?? undefined, a.file);
}

/** 소설 본문 텍스트 파일 선택(.txt/.md). */
export async function pickText(): Promise<RNFilePart[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'text/markdown', 'text/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => makeRNFilePart(a.uri, a.name, textMime(a.name), a.file));
}

/** 오디오 트랙 파일 선택. */
export async function pickAudio(): Promise<RNFilePart[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => makeRNFilePart(a.uri, a.name, audioMime(a.name, a.mimeType), a.file));
}

/** 자산 종류(assetKind)에 맞는 회차 자산 선택기. */
export async function pickAssets(assetKind: AssetKind): Promise<RNFilePart[]> {
  if (assetKind === 'TEXT') return pickText();
  if (assetKind === 'AUDIO') return pickAudio();
  return pickImages();
}
