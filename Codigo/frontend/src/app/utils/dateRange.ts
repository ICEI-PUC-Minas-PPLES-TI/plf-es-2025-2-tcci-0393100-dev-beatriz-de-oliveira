import type { DateRange } from "react-day-picker";

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function endOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isInDateRange(date: Date, range?: DateRange): boolean {
  if (!range?.from) {
    return true;
  }

  const from = startOfDay(range.from);
  const to = range.to ? endOfDay(range.to) : endOfDay(range.from);
  return date >= from && date <= to;
}

export function parseDayMonth(dayMonth: string, year = new Date().getFullYear()): Date | null {
  const [dayRaw, monthRaw] = dayMonth.split("/");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(day) || !Number.isFinite(month)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function buildDateRangeQuery(range?: DateRange): string {
  if (!range?.from) {
    return "";
  }

  const from = toIsoDate(startOfDay(range.from));
  const to = toIsoDate(range.to ? endOfDay(range.to) : endOfDay(range.from));
  const query = new URLSearchParams({ startDate: from, endDate: to });
  return `?${query.toString()}`;
}
