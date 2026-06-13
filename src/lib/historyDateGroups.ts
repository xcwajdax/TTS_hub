import type { Generation } from "../types";

export type HistoryDateBucket =
  | "today"
  | "yesterday"
  | "lastThreeDays"
  | "lastWeek"
  | "lastMonth"
  | `month:${string}`;

const FIXED_BUCKETS: HistoryDateBucket[] = [
  "today",
  "yesterday",
  "lastThreeDays",
  "lastWeek",
  "lastMonth",
];

const BUCKET_LABELS: Record<string, string> = {
  today: "Dziś",
  yesterday: "Wczoraj",
  lastThreeDays: "Ostatnie trzy dni",
  lastWeek: "Ostatni tydzień",
  lastMonth: "Ostatni miesiąc",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Wyłączne segmenty czasu względem dziś (bez nakładania). */
export function getHistoryDateBucket(createdAtMs: number, now = new Date()): HistoryDateBucket {
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = addDays(startOfDay(now), -1).getTime();
  const last3Start = addDays(startOfDay(now), -4).getTime();
  const lastWeekStart = addDays(startOfDay(now), -11).getTime();
  const lastMonthStart = addDays(startOfDay(now), -41).getTime();

  if (createdAtMs >= todayStart) return "today";
  if (createdAtMs >= yesterdayStart) return "yesterday";
  if (createdAtMs >= last3Start) return "lastThreeDays";
  if (createdAtMs >= lastWeekStart) return "lastWeek";
  if (createdAtMs >= lastMonthStart) return "lastMonth";

  const d = new Date(createdAtMs);
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `month:${monthKey}`;
}

export function formatMonthBucketLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function historyBucketLabel(bucket: HistoryDateBucket): string {
  if (bucket.startsWith("month:")) {
    return formatMonthBucketLabel(bucket.slice(6));
  }
  return BUCKET_LABELS[bucket] ?? bucket;
}

export interface HistoryDateGroup {
  bucket: HistoryDateBucket;
  label: string;
  items: Generation[];
}

function calendarDayKey(createdAtMs: number, now = new Date()): string {
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = addDays(startOfDay(now), -1).getTime();
  const itemDayStart = startOfDay(new Date(createdAtMs)).getTime();

  if (itemDayStart >= todayStart) return "today";
  if (itemDayStart >= yesterdayStart) return "yesterday";

  const d = new Date(createdAtMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatCalendarDayLabel(dayKey: string, now = new Date()): string {
  if (dayKey === "today") return "Dziś";
  if (dayKey === "yesterday") return "Wczoraj";

  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    ...(year !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface CalendarDayGroup {
  dayKey: string;
  label: string;
  items: Generation[];
}

/** Grupowanie po dniach kalendarzowych: Dziś, Wczoraj, potem konkretne daty. */
export function groupGenerationsByCalendarDay(items: Generation[], now = new Date()): CalendarDayGroup[] {
  const sorted = [...items].sort((a, b) => b.created_at - a.created_at);
  const map = new Map<string, Generation[]>();

  for (const gen of sorted) {
    const key = calendarDayKey(gen.created_at, now);
    const list = map.get(key);
    if (list) list.push(gen);
    else map.set(key, [gen]);
  }

  const groups: CalendarDayGroup[] = [];

  for (const fixed of ["today", "yesterday"] as const) {
    const dayItems = map.get(fixed);
    if (dayItems?.length) {
      groups.push({
        dayKey: fixed,
        label: formatCalendarDayLabel(fixed, now),
        items: dayItems,
      });
      map.delete(fixed);
    }
  }

  const dateKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  for (const key of dateKeys) {
    groups.push({
      dayKey: key,
      label: formatCalendarDayLabel(key, now),
      items: map.get(key)!,
    });
  }

  return groups;
}

export function groupGenerationsByDate(items: Generation[], now = new Date()): HistoryDateGroup[] {
  const sorted = [...items].sort((a, b) => b.created_at - a.created_at);
  const map = new Map<string, Generation[]>();

  for (const gen of sorted) {
    const bucket = getHistoryDateBucket(gen.created_at, now);
    const list = map.get(bucket);
    if (list) list.push(gen);
    else map.set(bucket, [gen]);
  }

  const groups: HistoryDateGroup[] = [];

  for (const bucket of FIXED_BUCKETS) {
    const bucketItems = map.get(bucket);
    if (bucketItems?.length) {
      groups.push({ bucket, label: historyBucketLabel(bucket), items: bucketItems });
      map.delete(bucket);
    }
  }

  const monthBuckets = [...map.keys()]
    .filter((k) => k.startsWith("month:"))
    .sort((a, b) => b.localeCompare(a));

  for (const key of monthBuckets) {
    const bucket = key as HistoryDateBucket;
    groups.push({
      bucket,
      label: historyBucketLabel(bucket),
      items: map.get(key)!,
    });
  }

  return groups;
}
