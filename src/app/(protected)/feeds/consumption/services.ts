import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedConsumption, FeedConsumptionListRow } from '@/lib/feed-consumption-types';
import type { FeedItem } from '@/lib/feed-types';
import type { FeedInventoryStock } from '@/lib/feed-inventory-types';

export async function createFeedConsumption(
  client: SupabaseClient,
  values: { feedItemId: string; businessDate: string; quantity: number; notes?: string },
) {
  const { data, error } = await client.rpc('create_feed_consumption', {
    p_feed_item_id: values.feedItemId,
    p_business_date: values.businessDate,
    p_quantity: values.quantity,
    p_notes: values.notes?.trim() || null,
  });
  if (error) throw error;
  return data as FeedConsumption;
}

export async function editFeedConsumption(
  client: SupabaseClient,
  movementId: string,
  values: { businessDate: string; quantity: number; notes?: string },
) {
  const { data, error } = await client.rpc('edit_feed_consumption', {
    p_movement_id: movementId,
    p_business_date: values.businessDate,
    p_quantity: values.quantity,
    p_notes: values.notes?.trim() || null,
  });
  if (error) throw error;
  return data as FeedConsumption;
}

export async function deleteFeedConsumption(client: SupabaseClient, movementId: string) {
  const { error } = await client.rpc('delete_feed_consumption', { p_movement_id: movementId });
  if (error) throw error;
}

export async function fetchFeedConsumption(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: { from?: string; to?: string; feedItemId?: string } = {},
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('feed_inventory_movements')
    .select('*, feed_items!inner(name,base_unit)', { count: 'exact' })
    .eq('movement_type', 'CONSUMPTION')
    .eq('source_type', 'FEED_CONSUMPTION')
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.from) query = query.gte('occurred_at', `${filters.from}T00:00:00`);
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    query = query.lt('occurred_at', end.toISOString());
  }
  if (filters.feedItemId) query = query.eq('feed_item_id', filters.feedItemId);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    ...row,
    feed_item_name: (row.feed_items as { name: string } | null)?.name ?? '—',
    base_unit: (row.feed_items as { base_unit: string } | null)?.base_unit ?? '—',
    can_edit_delete: true,
  })) as FeedConsumptionListRow[];

  if (!rows.length) return { rows, count: count ?? 0 };

  const ids = rows.map((row) => row.id);
  const feedIds = [...new Set(rows.map((row) => row.feed_item_id))];
  const { data: later, error: laterError } = await client
    .from('feed_inventory_movements')
    .select('feed_item_id, created_at')
    .in('feed_item_id', feedIds)
    .gt('created_at', new Date(0).toISOString());

  if (laterError) throw laterError;

  const enriched = rows.map((row) => ({
    ...row,
    can_edit_delete: !(later ?? []).some(
      (movement) =>
        movement.feed_item_id === row.feed_item_id &&
        movement.created_at > row.created_at,
    ),
  }));

  return { rows: enriched, count: count ?? 0 };
}

export async function fetchFeedItems(client: SupabaseClient, activeOnly = true) {
  let query = client.from('feed_items').select('*').order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FeedItem[];
}

export async function fetchFeedStock(client: SupabaseClient) {
  const { data, error } = await client
    .from('feed_inventory_stock')
    .select('*')
    .order('feed_item_name');
  if (error) throw error;
  return (data ?? []) as FeedInventoryStock[];
}

export async function fetchFeedConsumptionForEdit(client: SupabaseClient, movementId: string) {
  const { data, error } = await client
    .from('feed_inventory_movements')
    .select('*, feed_items!inner(name,base_unit)')
    .eq('id', movementId)
    .eq('movement_type', 'CONSUMPTION')
    .eq('source_type', 'FEED_CONSUMPTION')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Feed consumption not found or it is locked.');
  return {
    ...data,
    feed_item_name: (data.feed_items as { name: string }).name,
    base_unit: (data.feed_items as { base_unit: string }).base_unit,
  } as FeedConsumptionListRow;
}