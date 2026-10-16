import type { SupabaseClient } from '@supabase/supabase-js';
import type { DietBuffaloOption, DietPlanDetails, DietPlanFormValues, DietPlanListRow } from '@/lib/diet-plan-types';

export async function fetchDietPlans(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: { search?: string; status?: string } = {},
): Promise<{ rows: DietPlanListRow[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = client.from('diet_plans')
    .select('id,name,notes,start_date,end_date,status,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (filters.search?.trim()) query = query.ilike('name', `%${filters.search.trim()}%`);
  if (filters.status) query = query.eq('status', filters.status);
  const { data: plans, error, count } = await query;
  if (error) throw error;
  const rows = plans ?? [];
  if (!rows.length) return { rows: [], count: count ?? 0 };

  const ids = rows.map((plan) => plan.id);
  const [{ data: buffaloes, error: buffaloError }, { data: items, error: itemError }] = await Promise.all([
    client.from('diet_plan_buffaloes').select('plan_id').in('plan_id', ids),
    client.from('diet_plan_items').select('plan_id').in('plan_id', ids),
  ]);
  if (buffaloError) throw buffaloError;
  if (itemError) throw itemError;

  return {
    rows: rows.map((plan) => ({
      ...plan,
      status: plan.status as DietPlanListRow['status'],
      buffalo_count: (buffaloes ?? []).filter((row) => row.plan_id === plan.id).length,
      feed_count: (items ?? []).filter((row) => row.plan_id === plan.id).length,
    })),
    count: count ?? 0,
  };
}

export async function fetchDietPlanForEdit(client: SupabaseClient, id: string): Promise<DietPlanDetails> {
  const { data: plan, error } = await client.from('diet_plans')
    .select('id,name,notes,start_date,end_date,status')
    .eq('id', id).maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error('Diet plan not found.');

  const [{ data: itemRows, error: itemsError }, { data: buffaloRows, error: buffaloError }] = await Promise.all([
    client.from('diet_plan_items')
      .select('id,feed_item_id,base_unit,morning_quantity,evening_quantity,feed_items!inner(name)')
      .eq('plan_id', id),
    client.from('diet_plan_buffaloes')
      .select('buffalo_id,buffaloes!inner(id,buffalo_code,name)')
      .eq('plan_id', id),
  ]);
  if (itemsError) throw itemsError;
  if (buffaloError) throw buffaloError;

  return {
    ...plan,
    status: plan.status as DietPlanDetails['status'],
    items: (itemRows ?? []).map((row) => ({
      id: row.id,
      feed_item_id: row.feed_item_id,
      feed_item_name: (row.feed_items as unknown as { name: string }).name,
      base_unit: row.base_unit,
      morning_quantity: Number(row.morning_quantity),
      evening_quantity: Number(row.evening_quantity),
    })),
    buffaloes: (buffaloRows ?? []).map((row) => {
      const buffalo = row.buffaloes as unknown as { id: string; buffalo_code: string; name: string | null };
      return { id: buffalo.id, buffalo_code: buffalo.buffalo_code, name: buffalo.name };
    }),
  };
}

export async function fetchActiveFeedItems(client: SupabaseClient) {
  const { data, error } = await client.from('feed_items')
    .select('id,name,base_unit,category').eq('is_active', true).order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchEligibleBuffaloes(client: SupabaseClient, date: string): Promise<DietBuffaloOption[]> {
  const { data, error } = await client.rpc('get_buffalo_production_sheet', { p_business_date: date });
  if (error) throw error;
  return (data ?? []) as DietBuffaloOption[];
}

export async function saveDietPlan(client: SupabaseClient, id: string | null, values: DietPlanFormValues) {
  const { data, error } = await client.rpc('save_diet_plan', {
    p_plan_id: id,
    p_name: values.name.trim(),
    p_notes: values.notes?.trim() || null,
    p_start_date: values.startDate,
    p_end_date: values.endDate || null,
    p_status: values.status,
    p_feed_items: values.items.map((item) => ({
      feed_item_id: item.feedItemId,
      morning_quantity: item.morningQuantity,
      evening_quantity: item.eveningQuantity,
    })),
    p_buffalo_ids: values.buffaloIds,
  });
  if (error) throw error;
  return data as string;
}
