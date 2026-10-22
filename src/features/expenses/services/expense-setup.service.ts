import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Backfill missing farm-specific category overrides from shared defaults.
 * Existing categories (including intentionally inactive ones) are never overwritten.
 * Call only from a Super Admin workflow; Viewers must remain read-only.
 */
export async function ensureExpenseCategories(client: SupabaseClient): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('Session expired. Sign in again.');

  const [ownedResult, defaultsResult] = await Promise.all([
    client.from('expense_categories').select('name').eq('owner_id', user.id),
    client
      .from('expense_categories')
      .select('name,category_group,default_unit,is_quantity_based,is_active,description')
      .is('owner_id', null),
  ]);

  if (ownedResult.error) throw ownedResult.error;
  if (defaultsResult.error) throw defaultsResult.error;
  if (!defaultsResult.data?.length) return;

  const existingNames = new Set(
    (ownedResult.data ?? []).map((category) => category.name.trim().toLocaleLowerCase()),
  );
  const missingDefaults = defaultsResult.data.filter((category) => {
    const key = category.name.trim().toLocaleLowerCase();
    if (existingNames.has(key)) return false;
    existingNames.add(key);
    return true;
  });

  if (!missingDefaults.length) return;

  const { error: insertError } = await client
    .from('expense_categories')
    .insert(missingDefaults.map((category) => ({ ...category, owner_id: user.id })));

  // Concurrent setup can race on the unique constraint; all other errors must surface.
  if (insertError && insertError.code !== '23505') throw insertError;
}
