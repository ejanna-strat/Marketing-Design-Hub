import { TZDate } from "@date-fns/tz";
import { format, parseISO } from "date-fns";
import { theme } from "@/config/theme";

// All dates are shown in Asia/Manila, formatted like "Oct 7, 2026".
// Timestamps are stored in UTC; date-only values (e.g. Date Needed) are
// stored as YYYY-MM-DD and have no time zone.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Today's date in Manila as YYYY-MM-DD.
export function todayInManila(): string {
  return format(new TZDate(Date.now(), theme.timeZone), "yyyy-MM-dd");
}

function toManila(value: string): Date {
  return DATE_ONLY.test(value) ? parseISO(value) : new TZDate(new Date(value).getTime(), theme.timeZone);
}

// "Oct 7, 2026", or "—" when empty.
export function formatDate(value: string | null | undefined): string {
  return value ? format(toManila(value), "MMM d, yyyy") : "—";
}

// "Oct 7, 2026, 3:05 PM", or "—" when empty.
export function formatDateTime(value: string | null | undefined): string {
  return value ? format(toManila(value), "MMM d, yyyy, h:mm a") : "—";
}

// The start of a Manila calendar day, as a UTC ISO timestamp (for filters).
export function manilaDayStart(day: string): string {
  return new TZDate(`${day}T00:00:00`, theme.timeZone).toISOString();
}
