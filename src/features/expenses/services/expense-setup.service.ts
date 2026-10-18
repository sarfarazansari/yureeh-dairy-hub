import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Seeds a user's expense categories from the shared defaults when they have
 * no owned categories yet. The unique-conflict case is safe under concurrent setup.
 */
export async function ensureExpenseCategories(client: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return;

  const { data: owned, error } = await client
    .from('expense_categories')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1);

  if (error || owned?.length) return;

  const { data: defaults, error: defaultError } = await client
    .from('expense_categories')
    .select('name,category_group,default_unit,is_quantity_based,is_active,description')
    .is('owner_id', null);

  if (defaultError || !defaults?.length) return;

  const { error: insertError } = await client
    .from('expense_categories')
    .insert(defaults.map((category) => ({ ...category, owner_id: user.id })));

  if (insertError && insertError.code !== '23505') throw insertError;
}
