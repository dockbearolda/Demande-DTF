/**
 * Equivalent natif de date-fns formatDistanceToNow(d, { addSuffix: true, locale: fr }).
 * Utilisé partout où on veut afficher "il y a 3 minutes", "dans 2 jours", etc.
 */

const RTF = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatDistanceToNow(input: string | Date, now: Date = new Date()): string {
  const target = typeof input === "string" ? new Date(input) : input;
  const diffMs = target.getTime() - now.getTime();
  const abs = Math.abs(diffMs);

  if (abs < MINUTE) return RTF.format(Math.round(diffMs / SECOND), "second");
  if (abs < HOUR) return RTF.format(Math.round(diffMs / MINUTE), "minute");
  if (abs < DAY) return RTF.format(Math.round(diffMs / HOUR), "hour");
  if (abs < WEEK) return RTF.format(Math.round(diffMs / DAY), "day");
  if (abs < MONTH) return RTF.format(Math.round(diffMs / WEEK), "week");
  if (abs < YEAR) return RTF.format(Math.round(diffMs / MONTH), "month");
  return RTF.format(Math.round(diffMs / YEAR), "year");
}

const FR_DATETIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatAbsoluteDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return FR_DATETIME.format(d);
}
