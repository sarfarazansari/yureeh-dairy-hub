import dayjs from 'dayjs';
import { isValidDateKey, normalizeDateKey } from '@/lib/date-key';
import type { MilkEntryDatePreset } from '../milk-entry-list.types';

export function localDateKey(date: Date = new Date()): string {
  return normalizeDateKey(date) ?? '';
}

export function getMilkEntryPresetRange(
  preset: Exclude<MilkEntryDatePreset, 'custom'>,
  now: Date = new Date(),
) {
  const today = dayjs(now);
  const to = today.format('YYYY-MM-DD');
  const from =
    preset === 'current-month'
      ? today.startOf('month').format('YYYY-MM-DD')
      : today.subtract(preset === 'last-7-days' ? 6 : 14, 'day').format('YYYY-MM-DD');
  return { from, to };
}

export function isValidBusinessDate(value: string): boolean {
  return isValidDateKey(value);
}



export function getMilkEntryListUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function compactMilkEntryPages(current: number, last: number): (number | 'ellipsis')[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1);
  const pages = new Set<number>([1, last]);
  for (let page = current - 1; page <= current + 1; page++) {
    if (page > 1 && page < last) pages.add(page);
  }
  const sorted = [...pages].sort((left, right) => left - right);
  const result: (number | 'ellipsis')[] = [];
  for (let index = 0; index < sorted.length; index++) {
    if (index && sorted[index] - sorted[index - 1] > 1) result.push('ellipsis');
    result.push(sorted[index]);
  }
  return result;
}
