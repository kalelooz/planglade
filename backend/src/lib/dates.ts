export function getDatePart(value: string | null | undefined): string {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
}

export function getTimePart(value: string | null | undefined): string {
  if (!value || !value.includes("T")) return "";
  return value.split("T")[1] ?? "";
}

export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value: string | null | undefined): Date | null {
  const datePart = getDatePart(value);
  if (!datePart) return null;
  const date = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseLocalDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const datePart = getDatePart(value);
  if (!datePart) return null;
  const timePart = getTimePart(value);
  const date = new Date(timePart ? `${datePart}T${timePart}` : `${datePart}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function compareLocalDateStrings(a: string | null | undefined, b: string | null | undefined): number {
  return getDatePart(a).localeCompare(getDatePart(b));
}

export function isSameLocalDate(value: string | null | undefined, today: Date): boolean {
  const datePart = getDatePart(value);
  if (!datePart) return false;
  return datePart === localDateKey(today);
}

export function formatDueLabel(value: string | null | undefined): string {
  const date = parseLocalDate(value);
  if (!date) return value ? getDatePart(value) : "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDueDateTimeLabel(value: string | null | undefined): string {
  const date = parseLocalDate(value);
  if (!date) return value ? getDatePart(value) : "No date";
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
