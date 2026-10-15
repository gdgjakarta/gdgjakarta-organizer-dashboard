import { format, parseISO } from "date-fns";

export const DEFAULT_TIMEZONE = "Asia/Jakarta";

/**
 * Converts a Date to match the wall-clock time in the given timezone (default Asia/Jakarta).
 * This allows date-fns `format(...)` and local getters to be timezone-accurate even on UTC servers.
 */
export function toTimezoneDate(date: Date, timeZone = DEFAULT_TIMEZONE): Date {
  if (Number.isNaN(date.getTime())) return date;
  return new Date(date.toLocaleString("en-US", { timeZone }));
}

export interface FirestoreTimestampLike {
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
  toDate?: () => Date;
  toMillis?: () => number;
}

/**
 * Parses any date value representation (Date instance, Firestore Timestamp,
 * serialized Timestamp { seconds, nanoseconds }, ISO string, epoch number)
 * into a valid JavaScript Date object, or returns null if unparseable.
 */
export function parseFirestoreDate(value: unknown): Date | null {
  if (!value) return null;

  // 1. Already a Date instance
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // 2. Object with toDate() or toMillis() method (Firestore Timestamp instance)
  if (typeof value === "object" && value !== null) {
    const obj = value as FirestoreTimestampLike;
    if (typeof obj.toDate === "function") {
      try {
        const d = obj.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      } catch {
        // Fall through
      }
    }
    if (typeof obj.toMillis === "function") {
      try {
        const ms = obj.toMillis();
        if (typeof ms === "number" && !Number.isNaN(ms)) {
          const d = new Date(ms);
          if (!Number.isNaN(d.getTime())) return d;
        }
      } catch {
        // Fall through
      }
    }

    // 3. Serialized Timestamp plain object: { seconds, nanoseconds } or { _seconds, _nanoseconds }
    let secs: number | null = null;
    if (typeof obj.seconds === "number") {
      secs = obj.seconds;
    } else if (typeof obj._seconds === "number") {
      secs = obj._seconds;
    }

    let nanos = 0;
    if (typeof obj.nanoseconds === "number") {
      nanos = obj.nanoseconds;
    } else if (typeof obj._nanoseconds === "number") {
      nanos = obj._nanoseconds;
    }

    if (secs !== null) {
      const ms = secs * 1000 + Math.floor(nanos / 1000000);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  // 4. String representation
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const d = parseISO(trimmed);
      if (!Number.isNaN(d.getTime())) return d;
    } catch {
      // Fall through
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // 5. Numeric timestamp (seconds or milliseconds)
  if (typeof value === "number" && !Number.isNaN(value)) {
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Formats any date representation into a human-readable string safely.
 * Returns the fallback string if the value cannot be parsed, ensuring that
 * raw objects (such as { seconds, nanoseconds }) are NEVER returned and cannot crash React.
 */
export function formatFirestoreDate(
  value: unknown,
  formatPattern = "dd MMM yyyy, h:mm a",
  fallback = "—",
  timeZone = DEFAULT_TIMEZONE,
): string {
  const date = parseFirestoreDate(value);
  if (!date) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return fallback;
  }
  try {
    const tzDate = toTimezoneDate(date, timeZone);
    return format(tzDate, formatPattern);
  } catch {
    return fallback;
  }
}

/**
 * Safely converts any date representation into an ISO 8601 string.
 * Returns null if the value cannot be parsed into a valid Date.
 */
export function toISOStringSafe(value: unknown): string | null {
  const date = parseFirestoreDate(value);
  if (date) return date.toISOString();
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/**
 * Safely formats any date representation into the `YYYY-MM-DDTHH:mm` format
 * required by `<input type="datetime-local">`, converted to the specified timezone (default Asia/Jakarta).
 */
export function toDateTimeLocalValue(value: unknown, timeZone = DEFAULT_TIMEZONE): string {
  const date = parseFirestoreDate(value);
  if (!date) return "";
  const tzDate = toTimezoneDate(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = tzDate.getFullYear();
  const month = pad(tzDate.getMonth() + 1);
  const day = pad(tzDate.getDate());
  const hours = pad(tzDate.getHours());
  const minutes = pad(tzDate.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
