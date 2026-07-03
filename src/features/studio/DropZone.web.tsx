/**
 * DropZone (web) — a real drag-and-drop surface for desktop creators, plus
 * click-to-select via a hidden file input (keyboard-accessible). Dropped/picked
 * File[] are filtered to the asset kind's accepted types, mapped to RNFilePart
 * (carrying the real browser File so buildFormData appends it), and handed up.
 *
 * Rendered as real DOM elements — react-native-web runs on React DOM, so <div>/
 * <input> are valid here and give us native DnD events RN primitives don't
 * expose. The NATIVE build uses DropZone.tsx (picker button); both share the
 * { assetKind, onAdd } API so the upload screen never branches on platform.
 */
import { useCallback, useRef, useState } from 'react';

import { ACCEPTED_IMAGE_TYPES, filesToParts, type AssetKind } from './pickers';
import type { RNFilePart } from '@/api/multipart';
import { useTheme } from '@/ui';

/** `accept` attribute per kind — narrows the OS file dialog. */
const ACCEPT: Record<AssetKind, string> = {
  IMAGE: 'image/jpeg,image/png',
  TEXT: '.txt,.md,text/plain,text/markdown',
  AUDIO: 'audio/*',
};

const COPY: Record<AssetKind, { title: string; hint: string }> = {
  IMAGE: { title: '이미지를 여기로 끌어다 놓거나 클릭해 선택', hint: 'JPG · PNG · 여러 장 한 번에' },
  TEXT: { title: '본문 파일을 끌어다 놓거나 클릭해 선택', hint: 'TXT · Markdown' },
  AUDIO: { title: '오디오 파일을 끌어다 놓거나 클릭해 선택', hint: 'MP3 · M4A · WAV · OGG' },
};

/** Drag-drop bypasses the input's `accept`, so re-check each File ourselves. */
function accepts(kind: AssetKind, f: File): boolean {
  if (kind === 'IMAGE') return ACCEPTED_IMAGE_TYPES.includes(f.type);
  if (kind === 'AUDIO') return f.type.startsWith('audio/');
  return f.type === 'text/plain' || f.type === 'text/markdown' || /\.(txt|md)$/i.test(f.name);
}

export function DropZone({
  assetKind,
  onAdd,
}: {
  assetKind: AssetKind;
  onAdd: (parts: RNFilePart[]) => void;
}) {
  const t = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const accepted = Array.from(list).filter((f) => accepts(assetKind, f));
      if (accepted.length > 0) onAdd(filesToParts(accepted));
    },
    [assetKind, onAdd],
  );

  const copy = COPY[assetKind];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={copy.title}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '28px 16px',
        cursor: 'pointer',
        textAlign: 'center',
        border: `2px dashed ${over ? t.color.accent : t.color.border}`,
        borderRadius: t.radius.lg,
        background: over ? t.color.accentSubtle : t.color.surfaceSunken,
        color: t.color.onSurfaceSecondary,
        fontFamily: t.typography.fontFamily.body,
        transition: 'border-color .15s ease, background .15s ease',
        outlineColor: t.color.accent,
      }}
    >
      <span style={{ color: t.color.onSurface, fontWeight: 600, fontSize: t.typography.fontSize.body }}>
        {copy.title}
      </span>
      <span style={{ fontSize: 13 }}>{copy.hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[assetKind]}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
