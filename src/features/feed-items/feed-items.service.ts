import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedItem } from './types';

export async function getFeedItemsPage(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  search: string,
): Promise<{ rows: FeedItem[]; totalRows: number; activeCount: number }> {
  let query = client
    .from('feed_items')
    .select('*', { count: 'exact' })
    .order('is_active', { ascending: false })
    .order('name');

  const safeSearch = search.trim().replace(/[,%()]/g, ' ');
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%`);

  const [{ data, error, count }, activeResult] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    client.from('feed_items').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  if (error || activeResult.error) {
    throw new Error((error ?? activeResult.error)?.message ?? 'Could not load feed items.');
  }

  return { rows: (data ?? []) as FeedItem[], totalRows: count ?? 0, activeCount: activeResult.count ?? 0 };
}
