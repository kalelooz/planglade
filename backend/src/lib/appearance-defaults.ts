export const PRIORITY_DISPLAY_STYLES = ["text", "dot", "badge", "arrow"] as const;
export type PriorityDisplayStyle = (typeof PRIORITY_DISPLAY_STYLES)[number];

export const DEFAULT_PRIORITY_DISPLAY_STYLE: PriorityDisplayStyle = "badge";

export function resolvePriorityDisplayStyle(
  value: unknown
): PriorityDisplayStyle {
  return PRIORITY_DISPLAY_STYLES.includes(value as PriorityDisplayStyle)
    ? (value as PriorityDisplayStyle)
    : DEFAULT_PRIORITY_DISPLAY_STYLE;
}

export function normalizeAppearanceSettings<T extends object>(
  rawSettings: T | null | undefined
): Omit<T, "priorityDisplayStyle"> & { priorityDisplayStyle: PriorityDisplayStyle } {
  const settings = (rawSettings && typeof rawSettings === "object" ? rawSettings : {}) as T;
  const priorityDisplayStyle =
    "priorityDisplayStyle" in settings
      ? resolvePriorityDisplayStyle(settings.priorityDisplayStyle)
      : DEFAULT_PRIORITY_DISPLAY_STYLE;

  return { ...settings, priorityDisplayStyle };
}
