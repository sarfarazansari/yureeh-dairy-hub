import { z } from 'zod';

/**
 * Normalize date-picker values at the form boundary.
 * SQL DATE values and DatePicker use YYYY-MM-DD; ISO timestamps are reduced
 * to their calendar-date portion without a timezone conversion.
 */
export function normalizeDateKey(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }

  if (typeof value !== 'string') return null;
  const input = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(input);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

export function isValidDateKey(value: unknown): value is string {
  return typeof value === 'string' && normalizeDateKey(value) === value;
}

/** Zod string schema for date-only fields, retaining string input/output types. */
export function dateKeySchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value) => normalizeDateKey(value) ?? value)
    .refine(isValidDateKey, `Enter a valid ${label.toLowerCase()}.`);
}

export function todayDateKey() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Optional date-only field; blank values remain blank while supplied values are normalized. */
export function optionalDateKeySchema(label: string) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return value;
      return normalizeDateKey(value) ?? value;
    })
    .refine((value) => !value || isValidDateKey(value), `Enter a valid ${label.toLowerCase()}.`);
}
