/**
 * DropZone (native) — the mobile file-acquisition seam for the studio upload
 * flow. There is no drag-and-drop on a phone, so this degrades to the existing
 * gallery / document picker via pickAssets. The WEB build uses DropZone.web.tsx
 * (a real drag-and-drop surface); both expose the same { assetKind, onAdd } API
 * so the upload screen stays platform-agnostic.
 */
import { pickAssets, type AssetKind } from './pickers';
import type { RNFilePart } from '@/api/multipart';
import { Button } from '@/ui';

const ADD_LABEL: Record<AssetKind, string> = {
  IMAGE: '이미지 추가',
  TEXT: '본문 파일 추가',
  AUDIO: '트랙 추가',
};

export function DropZone({
  assetKind,
  onAdd,
}: {
  assetKind: AssetKind;
  onAdd: (parts: RNFilePart[]) => void;
}) {
  const onPick = async () => {
    const parts = await pickAssets(assetKind);
    if (parts.length > 0) onAdd(parts);
  };
  return <Button label={ADD_LABEL[assetKind]} variant="secondary" fullWidth onPress={onPick} />;
}
