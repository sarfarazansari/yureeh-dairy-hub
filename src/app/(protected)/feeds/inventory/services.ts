import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedInventoryMovement, FeedInventoryStock } from '@/lib/feed-inventory-types';

export type FeedInventoryMovementRow = FeedInventoryMovement & {
  feed_item_name: string;
  base_unit: string;
};

export async function fetchFeedInventoryStock(client: SupabaseClient) {
  const { data, error } = await client
    .from('feed_inventory_stock')
    .select('*')
    .order('feed_item_name');
  if (error) throw new Error('Could not load current feed stock. Please try again.');
  return (data ?? []).map((row) => ({
    ...row,
    quantity_on_hand: Number(row.quantity_on_hand),
    stock_value: Number(row.stock_value),
    weighted_average_cost: row.weighted_average_cost === null ? null : Number(row.weighted_average_cost),
    low_stock_threshold: Number(row.low_stock_threshold),
  })) as FeedInventoryStock[];
}

export async function fetchFeedInventoryMovements(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: {
    from?: string;
    to?: string;
    feedItemId?: string;
    movementType?: string;
  } = {},
) {
  const start = page * pageSize;
  const end = start + pageSize - 1;
  let query = client
    .from('feed_inventory_movements')
    .select('*, feed_items!inner(name,base_unit)', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(start, end);

  if (filters.from) query = query.gte('occurred_at', `${filters.from}T00:00:00Z`);
  if (filters.to) {
    const nextDay = new Date(`${filters.to}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    query = query.lt('occurred_at', nextDay.toISOString());
  }
  if (filters.feedItemId) query = query.eq('feed_item_id', filters.feedItemId);
  if (filters.movementType) query = query.eq('movement_type', filters.movementType);

  const { data, error, count } = await query;
  if (error) throw new Error('Could not load inventory movement history. Please try again.');

  const rows = (data ?? []).map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    unit_cost: row.unit_cost === null ? null : Number(row.unit_cost),
    feed_item_name: (row.feed_items as { name: string; base_unit: string }).name,
    base_unit: (row.feed_items as { name: string; base_unit: string }).base_unit,
  })) as FeedInventoryMovementRow[];

  return { rows, count: count ?? 0 };
}
