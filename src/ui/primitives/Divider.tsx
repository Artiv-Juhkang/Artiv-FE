/**
 * Divider — soft separator. Deliberately NOT a broadsheet hairline:
 * uses the themed `border` role (low-contrast warm line) so lists feel
 * grouped, not ruled. `inset` indents to align with text content.
 */
import { View } from 'react-native';

import { useTheme } from '../use-theme';
import type { Space } from '../tokens';

export type DividerProps = {
  inset?: Space; // left inset to align under text, default 'none'
  vertical?: boolean;
};

export function Divider({ inset = 'none', vertical = false }: DividerProps) {
  const t = useTheme();
  if (vertical) {
    return <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: t.color.border }} />;
  }
  return (
    <View
      style={{
        height: 1,
        backgroundColor: t.color.border,
        marginLeft: t.space[inset],
      }}
    />
  );
}
