import { z } from 'zod';
import { isValidDateKey, normalizeDateKey } from './date-key';
export { isValidDateKey, normalizeDateKey, todayDateKey } from './date-key';

/** Zod string schema for date-only fields, retaining string input/output types. */
export function dateKeySchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value) => normalizeDateKey(value) ?? value)
    .refine(isValidDateKey, `Enter a valid ${label.toLowerCase()}.`);
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
