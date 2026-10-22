import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Expense categories are shared defaults plus optional farm-owned categories.
 * Do not copy shared defaults into a farm: the database intentionally rejects
 * duplicate category names. Kept as a compatibility guard for existing callers.
 */
export async function ensureExpenseCategories(client: SupabaseClient): Promise<void> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Session expired. Sign in again.');
}
