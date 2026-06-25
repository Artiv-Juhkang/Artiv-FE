/**
 * WeekdayTabs — the controlled horizontal weekday chip strip that is the HOME
 * screen's PRIMARY organizing device (요일별, 월~일 Mon-first).
 * ------------------------------------------------------------------
 * Pure presentation: it owns NO state. The parent (the home screen) holds the
 * single `day` source of truth (`useState<DayOfWeek>(() => todayDay())`) and
 * passes it down as `value`, receiving changes through `onChange`. There is no
 * `use-weekday-axis` hook — `todayDay()` below is the ONLY weekday helper and
 * this file is the ONLY weekday widget (per the content-screens framework).
 *
 * VISUAL (Glass Stack):
 *   - active chip   = `accent` fill / `onAccent` text (the indigo selected token).
 *   - inactive chip = `glassField` fill / `onSurfaceSecondary` text.
 *   - the chip whose day === today carries an '오늘' micro-label so the user can
 *     always find the current day even after scrolling/switching.
 *
 * A11Y: the strip is a tablist (each chip `accessibilityRole="tab"` with
 * `selected` state) and every chip clears the 44pt minimum hit target.
 *
 * OVERFLOW: 7 weekday chips (plus room for FUTURE 신작/완결 chips that the
 * framework reserves but does not back yet) can exceed a small phone width, so
 * the strip is a horizontal ScrollView rather than a wrapping/space-between row.
 */
import { ScrollView, Pressable, View } from 'react-native';

import type { DayOfWeek } from '@/api/types';
import { Text, useTheme } from '@/ui';

/* -------------------------------------------------------------------------- */
/*  Weekday model — Mon-first, fixed order.                                    */
/* -------------------------------------------------------------------------- */

/** Mon-first weekday order (the only canonical ordering for the strip). */
export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const satisfies readonly DayOfWeek[];

/** Korean single-char labels for each weekday. */
export const DAY_LABEL_KO: Record<DayOfWeek, string> = {
  MONDAY: '월',
  TUESDAY: '화',
  WEDNESDAY: '수',
  THURSDAY: '목',
  FRIDAY: '금',
  SATURDAY: '토',
  SUNDAY: '일',
};

/**
 * Today's weekday, Mon-first. `Date.getDay()` returns 0=Sun..6=Sat; shift so
 * Monday maps to index 0 of WEEKDAYS: (getDay()+6) % 7.
 */
export function todayDay(): DayOfWeek {
  const i = (new Date().getDay() + 6) % 7;
  return WEEKDAYS[i];
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export type WeekdayTabsProps = {
  /** Currently selected day (controlled). */
  value: DayOfWeek;
  /** Fired when the user taps a different day chip. */
  onChange: (day: DayOfWeek) => void;
};

export function WeekdayTabs({ value, onChange }: WeekdayTabsProps) {
  const t = useTheme();
  const today = todayDay();

  return (
    <View accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: t.space.sm,
          paddingHorizontal: t.space.xs,
          paddingVertical: t.space.sm,
          alignItems: 'center',
        }}
      >
        {WEEKDAYS.map((day) => {
          const active = day === value;
          const isToday = day === today;
          return (
            <Pressable
              key={day}
              onPress={() => onChange(day)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${DAY_LABEL_KO[day]}요일${isToday ? ', 오늘' : ''}`}
              hitSlop={8}
              style={{
                minWidth: t.layout.minHitTarget,
                minHeight: t.layout.minHitTarget,
                paddingHorizontal: t.space.md,
                borderRadius: t.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? t.color.accent : t.color.glassField,
                borderWidth: active ? 0 : 1,
                borderColor: t.color.glassFieldBorder,
              }}
            >
              <Text
                variant="callout"
                weight={active ? 'bold' : 'medium'}
                color={active ? 'onAccent' : 'onSurfaceSecondary'}
              >
                {DAY_LABEL_KO[day]}
              </Text>
              {isToday ? (
                <Text
                  variant="micro"
                  weight="semibold"
                  color={active ? 'onAccent' : 'accent'}
                >
                  오늘
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
