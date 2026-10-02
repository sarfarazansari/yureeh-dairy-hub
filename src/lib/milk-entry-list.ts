import dayjs from 'dayjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingType } from './analytics';

export type MilkEntryDatePreset = 'current-month' | 'last-7-days' | 'last-15-days' | 'custom';
export type MilkEntryShift = 'MORNING' | 'EVENING';

export type MilkEntryFilters = {
  from: string;
  to: string;
  customerSearch: string;
  customerId: string;
  shift: MilkEntryShift | '';
  pricingType: PricingType | '';
};

export type MilkEntryPagination = { page: number; pageSize: number };

export type MilkEntryListRow = {
  id: string;
  business_date: string;
  shift: MilkEntryShift;
  customer_id: string;
  milk_quantity: number;
  fat: number | null;
  pricing_type: PricingType;
  applied_rate: number;
  calculated_amount: number;
  notes: string | null;
  created_at: string;
  customers: { name: string; pricing_type: PricingType } | null;
};

export type MilkEntryListResult = {
  rows: MilkEntryListRow[];
  total: number;
};

export function localDateKey(date: Date = new Date()): string {
  return dayjs(date).format('YYYY-MM-DD');
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
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dayjs(`${value}T12:00:00`).isValid() &&
    dayjs(`${value}T12:00:00`).format('YYYY-MM-DD') === value
  );
}

export function getMilkEntryListUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function getMilkEntryList(
  client: SupabaseClient,
  filters: MilkEntryFilters,
  pagination: MilkEntryPagination,
): Promise<MilkEntryListResult> {
  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;
  let query = client
    .from('milk_entries')
    .select(
      'id,business_date,shift,customer_id,milk_quantity,fat,pricing_type,applied_rate,calculated_amount,notes,created_at,customers!inner(name,pricing_type)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .gte('business_date', filters.from)
    .lte('business_date', filters.to)
    .order('business_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.shift) query = query.eq('shift', filters.shift);
  if (filters.pricingType) query = query.eq('pricing_type', filters.pricingType);
  if (filters.customerSearch) {
    const escaped = filters.customerSearch.trim().replace(/[\\%_]/g, '\\$&');
    query = query.ilike('customers.name', `%${escaped}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as MilkEntryListRow[],
    total: count ?? 0,
  };
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
