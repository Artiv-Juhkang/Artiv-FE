/**
 * 스튜디오 폼 공용 컴포넌트 — 라벨 입력(Field)과 칩 선택(ChipSelect/ChipMulti).
 *
 * 작품 생성·회차 업로드 폼이 공유한다. 앱에 별도 입력 프리미티브가 없어(로그인 화면이 자체
 * TextInput 사용) 여기서 chrome 표면용 입력 스타일을 캡슐화한다.
 */
import { TextInput, View } from 'react-native';

import { Text, useTheme } from '@/ui';

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.xs }}>
      <Text variant="label" color="onSurfaceSecondary">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.color.onSurfaceMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          minHeight: multiline ? 96 : t.layout.minHitTarget,
          textAlignVertical: multiline ? 'top' : 'center',
          borderWidth: 1,
          borderColor: t.color.border,
          borderRadius: t.radius.md,
          paddingHorizontal: t.space.lg,
          paddingVertical: t.space.md,
          color: t.color.onSurface,
          backgroundColor: t.color.surfaceSunken,
          fontFamily: t.typography.fontFamily.body,
          fontSize: t.typography.fontSize.body,
        }}
      />
    </View>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      variant="caption"
      weight="semibold"
      style={{
        color: active ? t.color.accent : t.color.onSurfaceSecondary,
        backgroundColor: active ? t.color.accentSubtle : t.color.surfaceSunken,
        borderWidth: 1,
        borderColor: active ? t.color.accent : t.color.border,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
        overflow: 'hidden',
      }}
    >
      {label}
    </Text>
  );
}

/** 단일 선택 칩 그룹. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.xs }}>
      <Text variant="label" color="onSurfaceSecondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

/** 다중 선택 칩 그룹(예: 연재요일). */
export function ChipMulti<T extends string>({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: ChipOption<T>[];
  values: T[];
  onToggle: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.xs }}>
      <Text variant="label" color="onSurfaceSecondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={values.includes(o.value)}
            onPress={() => onToggle(o.value)}
          />
        ))}
      </View>
    </View>
  );
}
