import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilkEntryFilters, MilkEntryListResult, MilkEntryListRow, MilkEntryPagination } from '../milk-entry-list.types';

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
    // Shift values sort alphabetically as EVENING before MORNING; descending gives the farm's desired Morning → Evening order.
    .order('shift', { ascending: false })
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

export async function getMilkEntryListAll(
  client: SupabaseClient,
  filters: MilkEntryFilters,
): Promise<MilkEntryListRow[]> {
  const chunkSize = 500;
  const first = await getMilkEntryList(client, filters, { page: 1, pageSize: chunkSize });
  const rows = [...first.rows];
  const pageCount = Math.ceil(first.total / chunkSize);
  for (let page = 2; page <= pageCount; page++) {
    const result = await getMilkEntryList(client, filters, { page, pageSize: chunkSize });
    rows.push(...result.rows);
  }
  return rows;
}

