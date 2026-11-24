import { z } from "zod";

export const ANALYTICS_DOMAINS = ["website", "events", "tickets", "members", "instagram"] as const;
export type AnalyticsDomain = (typeof ANALYTICS_DOMAINS)[number];

export const analyticsQuerySchema = z.object({
  domain: z.enum(ANALYTICS_DOMAINS),
  mode: z.enum(["all_time", "month", "year", "date_range"]).default("all_time"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/, "Year must be YYYY")
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be YYYY-MM-DD")
    .optional(),
  provider: z.enum(["ga4", "cloudflare"]).optional(),
  includeTest: z.enum(["0", "1"]).optional(),
  refresh: z.enum(["0", "1"]).optional(),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

export interface ResolvedDateWindow {
  mode: "all_time" | "month" | "year" | "date_range";
  month?: string;
  year?: string;
  sinceDate: string; // YYYY-MM-DD
  untilDate: string; // YYYY-MM-DD
  /** Clamped to <= today in WIB for external APIs that reject future dates */
  apiUntilDate: string;
  prevSinceDate: string; // YYYY-MM-DD
  prevUntilDate: string; // YYYY-MM-DD
  dayCount: number;
  isSettled: boolean;
  label: string;
  prevLabel: string;
}

const WIB_TZ = "Asia/Jakarta";
const MAX_RANGE_DAYS = 366;

export function getTodayWibDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function formatDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(dateStr: string, deltaDays: number): string {
  const { year, month, day } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return formatDateParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function diffDaysInclusive(sinceDate: string, untilDate: string): number {
  const s = parseDateParts(sinceDate);
  const u = parseDateParts(untilDate);
  const sMs = Date.UTC(s.year, s.month - 1, s.day);
  const uMs = Date.UTC(u.year, u.month - 1, u.day);
  return Math.max(1, Math.round((uMs - sMs) / 86_400_000) + 1);
}

export function enumerateDateKeys(sinceDate: string, untilDate: string): string[] {
  const count = diffDaysInclusive(sinceDate, untilDate);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(addDays(sinceDate, i));
  }
  return keys;
}

export function formatShortDateLabel(dateStr: string): string {
  const { year, month, day } = parseDateParts(dateStr);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(dt);
}

export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(dt);
}

export function resolveDateWindow(input: {
  mode: "all_time" | "month" | "year" | "date_range";
  month?: string;
  year?: string;
  from?: string;
  to?: string;
}): ResolvedDateWindow {
  const todayWib = getTodayWibDateStr();

  if (input.mode === "all_time") {
    const sinceDate = "2018-01-01";
    return {
      mode: "all_time",
      sinceDate,
      untilDate: todayWib,
      apiUntilDate: todayWib,
      prevSinceDate: sinceDate,
      prevUntilDate: sinceDate,
      dayCount: diffDaysInclusive(sinceDate, todayWib),
      isSettled: false,
      label: "All Time",
      prevLabel: "",
    };
  }

  if (input.mode === "year") {
    const targetYear = input.year ?? todayWib.slice(0, 4);
    const yearNum = Number(targetYear);
    const sinceDate = `${targetYear}-01-01`;
    const untilDate = `${targetYear}-12-31`;
    const apiUntilDate = untilDate > todayWib ? todayWib : untilDate;
    const prevYear = String(yearNum - 1).padStart(4, "0");

    return {
      mode: "year",
      year: targetYear,
      sinceDate,
      untilDate,
      apiUntilDate: apiUntilDate < sinceDate ? sinceDate : apiUntilDate,
      prevSinceDate: `${prevYear}-01-01`,
      prevUntilDate: `${prevYear}-12-31`,
      dayCount: diffDaysInclusive(sinceDate, untilDate),
      isSettled: untilDate < addDays(todayWib, -2),
      label: targetYear,
      prevLabel: prevYear,
    };
  }

  if (input.mode === "month") {
    const targetMonth = input.month ?? todayWib.slice(0, 7);
    const [year, month] = targetMonth.split("-").map(Number);
    const lastDay = daysInMonth(year, month);
    const sinceDate = formatDateParts(year, month, 1);
    const untilDate = formatDateParts(year, month, lastDay);
    const apiUntilDate = untilDate > todayWib ? todayWib : untilDate;

    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevLastDay = daysInMonth(prevYear, prevMonth);
    const prevSinceDate = formatDateParts(prevYear, prevMonth, 1);
    const prevUntilDate = formatDateParts(prevYear, prevMonth, prevLastDay);
    const prevMonthStr = `${String(prevYear).padStart(4, "0")}-${String(prevMonth).padStart(2, "0")}`;

    return {
      mode: "month",
      month: targetMonth,
      sinceDate,
      untilDate,
      apiUntilDate: apiUntilDate < sinceDate ? sinceDate : apiUntilDate,
      prevSinceDate,
      prevUntilDate,
      dayCount: diffDaysInclusive(sinceDate, untilDate),
      isSettled: untilDate < addDays(todayWib, -2),
      label: formatMonthLabel(targetMonth),
      prevLabel: formatMonthLabel(prevMonthStr),
    };
  }

  // Date Range mode (defaults to last 30 days inclusive)
  const to = input.to && input.to <= todayWib ? input.to : todayWib;
  let from = input.from ?? addDays(to, -29);
  if (from > to) {
    from = to;
  }
  const rawSpan = diffDaysInclusive(from, to);
  if (rawSpan > MAX_RANGE_DAYS) {
    from = addDays(to, -(MAX_RANGE_DAYS - 1));
  }

  const dayCount = diffDaysInclusive(from, to);
  const prevUntilDate = addDays(from, -1);
  const prevSinceDate = addDays(prevUntilDate, -(dayCount - 1));

  return {
    mode: "date_range",
    sinceDate: from,
    untilDate: to,
    apiUntilDate: to,
    prevSinceDate,
    prevUntilDate,
    dayCount,
    isSettled: to < addDays(todayWib, -2),
    label: `${formatShortDateLabel(from)} – ${formatShortDateLabel(to)}`,
    prevLabel: `${formatShortDateLabel(prevSinceDate)} – ${formatShortDateLabel(prevUntilDate)}`,
  };
}

export function wibStartIso(dateStr: string): string {
  return `${dateStr}T00:00:00+07:00`;
}

export function wibEndIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999+07:00`;
}

export function utcEpochStart(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0) / 1000);
}

export function utcEpochEnd(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return Math.floor(Date.UTC(year, month - 1, day, 23, 59, 59) / 1000);
}

/**
 * Extracts YYYY-MM-DD in Asia/Jakarta from an ISO timestamp or date string.
 */
export function toWibDateKey(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  const dt = new Date(isoOrDate);
  if (Number.isNaN(dt.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

/**
 * Splits an inclusive [sinceDate, untilDate] window into chunks of at most `maxDays` days (Meta Graph API <= 30d).
 */
export function chunkDateRange(
  sinceDate: string,
  untilDate: string,
  maxDays = 30,
): Array<{ since: string; until: string }> {
  const chunks: Array<{ since: string; until: string }> = [];
  let cursor = sinceDate;
  while (cursor <= untilDate) {
    const candidateEnd = addDays(cursor, maxDays - 1);
    const chunkEnd = candidateEnd > untilDate ? untilDate : candidateEnd;
    chunks.push({ since: cursor, until: chunkEnd });
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}

export function calcDeltaPct(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function calcSharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
