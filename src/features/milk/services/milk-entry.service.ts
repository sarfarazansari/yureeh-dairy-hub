import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateEntryAmount } from '@/lib/analytics';
import type { MilkEntryFormValues } from '@/lib/milk-entry-validation';

export async function createMilkEntry(
  client: SupabaseClient,
  userId: string,
  entry: MilkEntryFormValues,
) {
  const calculatedAmount = calculateEntryAmount(
    entry.milk_quantity,
    entry.pricing_type,
    entry.applied_rate,
    entry.fat,
  );
  const { error } = await client.from('milk_entries').insert({
    user_id: userId,
    business_date: entry.business_date,
    shift: entry.shift,
    customer_id: entry.customer_id,
    milk_quantity: entry.milk_quantity,
    fat: entry.fat,
    pricing_type: entry.pricing_type,
    applied_rate: entry.applied_rate,
    calculated_amount: calculatedAmount,
    notes: entry.notes?.trim() || null,
  });

  if (error)
    throw new Error('Could not save the milk entry. Please review the details and try again.');
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
  const { data, error } = await client
    .from('milk_entries')
    .update({
      business_date: entry.business_date,
      shift: entry.shift,
      customer_id: entry.customer_id,
      milk_quantity: entry.milk_quantity,
      fat: entry.fat,
      pricing_type: entry.pricing_type,
      applied_rate: entry.applied_rate,
      calculated_amount: calculatedAmount,
      notes: entry.notes?.trim() || null,
    })
    .eq('id', entryId)
    .select('id')
    .single();

  if (error || !data) throw new Error('Could not update the milk entry. Please try again.');
}

export async function deleteMilkEntry(client: SupabaseClient, entryId: string) {
  const { data, error } = await client
    .from('milk_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', entryId)
    .select('id')
    .single();

  if (error || !data) throw new Error('Could not delete the milk entry. Please try again.');
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
