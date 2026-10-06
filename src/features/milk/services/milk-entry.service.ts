import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateEntryAmount } from '@/lib/analytics';
import type { MilkEntryFormValues } from '@/lib/milk-entry-validation';

export async function createMilkEntry(
  client: SupabaseClient,
  entry: MilkEntryFormValues,
) {
  const calculatedAmount = calculateEntryAmount(
    entry.milk_quantity,
    entry.pricing_type,
    entry.applied_rate,
    entry.fat,
  );
  const { error } = await client.rpc('create_milk_entry_with_pool', {
    p_business_date: entry.business_date,
    p_shift: entry.shift,
    p_customer_id: entry.customer_id,
    p_milk_quantity: entry.milk_quantity,
    p_fat: entry.fat,
    p_pricing_type: entry.pricing_type,
    p_applied_rate: entry.applied_rate,
    p_calculated_amount: calculatedAmount,
    p_notes: entry.notes?.trim() || null,
  });

  if (error)
    throw new Error(error.message || 'Could not save the milk entry. Please review the details and try again.');
}

export async function updateMilkEntry(
  client: SupabaseClient,
  entryId: string,
  entry: MilkEntryFormValues,
) {
  const calculatedAmount = calculateEntryAmount(
    entry.milk_quantity,
    entry.pricing_type,
    entry.applied_rate,
    entry.fat,
  );
  const { error } = await client.rpc('update_milk_entry_with_pool', {
    p_entry_id: entryId,
    p_business_date: entry.business_date,
    p_shift: entry.shift,
    p_customer_id: entry.customer_id,
    p_milk_quantity: entry.milk_quantity,
    p_fat: entry.fat,
    p_pricing_type: entry.pricing_type,
    p_applied_rate: entry.applied_rate,
    p_calculated_amount: calculatedAmount,
    p_notes: entry.notes?.trim() || null,
  });

  if (error) throw new Error(error.message || 'Could not update the milk entry. Please try again.');
}

export async function deleteMilkEntry(client: SupabaseClient, entryId: string) {
  const { error } = await client.rpc('delete_milk_entry_with_pool', {
    p_entry_id: entryId,
  });

  if (error) throw new Error(error.message || 'Could not delete the milk entry. Please try again.');
}

export async function hasDuplicateMilkEntry(
  client: SupabaseClient,
  input: { customerId: string; businessDate: string; shift: 'MORNING' | 'EVENING' },
) {
  const { count, error } = await client
    .from('milk_entries')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', input.customerId)
    .eq('business_date', input.businessDate)
    .eq('shift', input.shift)
    .is('deleted_at', null);
  if (error) throw new Error('Could not check for an existing milk entry.');
  return (count ?? 0) > 0;
}
