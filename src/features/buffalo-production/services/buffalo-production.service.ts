import type { SupabaseClient } from '@supabase/supabase-js';

import type { MilkEntryShift } from '@/lib/milk-entry-list';

import type {
  BuffaloProductionAnimal,
  BuffaloProductionHistoryRecord,
  BuffaloProductionInput,
  BuffaloProductionRecord,
  BuffaloProductionSheetInput,
  BuffaloProductionSheetRecord,
  MilkPoolShiftFatRecord,
} from '../types';

export async function getProductionSheet(
  client: SupabaseClient,
  businessDate: string,
  shift: MilkEntryShift,
) {
  const [buffaloes, production, fat] = await Promise.all([
    client.rpc('get_buffalo_production_sheet', { p_business_date: businessDate }),
    client
      .from('buffalo_milk_production')
      .select('buffalo_id,shift,milk_quantity')
      .eq('business_date', businessDate)
      .eq('shift', shift),
    client
      .from('milk_pool_shift_fat')
      .select('fat_percentage')
      .eq('business_date', businessDate)
      .eq('shift', shift)
      .maybeSingle(),
  ]);

  if (buffaloes.error || production.error || fat.error) {
    throw new Error('Could not load buffaloes, production, and pooled milk fat. Please try again.');
  }

  return {
    buffaloes: (buffaloes.data ?? []) as BuffaloProductionAnimal[],
    production: (production.data ?? []) as BuffaloProductionSheetRecord[],
    fatPercentage: fat.data?.fat_percentage == null ? '' : String(fat.data.fat_percentage),
  };
}

export async function saveProductionSheet(
  client: SupabaseClient,
  input: BuffaloProductionSheetInput,
) {
  const { error: productionError } = await client.rpc('save_buffalo_milk_production', {
    p_business_date: input.businessDate,
    p_shift: input.shift,
    p_buffalo_ids: input.buffaloIds,
    p_records: input.records,
  });

  if (productionError) {
    if (productionError.code === '22023') throw new Error(productionError.message);
    throw new Error('Could not save buffalo production. Please try again.');
  }

  const { error: fatError } = await client.rpc('save_milk_pool_shift_fat', {
    p_business_date: input.businessDate,
    p_shift: input.shift,
    p_fat_percentage: input.fatPercentage,
  });
  if (fatError) {
    if (fatError.code === '22023') throw new Error(fatError.message);
    throw new Error('Production was saved, but pooled milk fat was not saved. Please save again to retry the fat record.');
  }
}

export async function getMilkPoolShiftFatHistory(
  client: SupabaseClient,
  from: string,
  to: string,
) {
  const { data, error } = await client
    .from('milk_pool_shift_fat')
    .select('business_date,shift,fat_percentage')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: false })
    .order('shift');
  if (error) throw new Error('Could not load pooled milk fat history.');
  return (data ?? []) as MilkPoolShiftFatRecord[];
}

export async function getBuffaloProductionRange(client: SupabaseClient, from: string, to: string) {
  const { data, error } = await client
    .from('buffalo_milk_production')
    .select('buffalo_id,business_date,shift,milk_quantity')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date');
  if (error) throw new Error('Could not load production analytics. Please try again.');
  return (data ?? []) as BuffaloProductionRecord[];
}

export async function getBuffaloProductionHistory(client: SupabaseClient, buffaloId: string) {
  const { data, error } = await client
    .from('buffalo_milk_production')
    .select('id,business_date,shift,milk_quantity')
    .eq('buffalo_id', buffaloId)
    .order('business_date', { ascending: false })
    .order('shift');
  if (error) throw new Error('Could not load this buffalo’s production history. Please try again.');
  return (data ?? []) as BuffaloProductionHistoryRecord[];
}

export async function getProducingBuffaloes(client: SupabaseClient) {
  const { data, error } = await client
    .from('buffaloes')
    .select('id,buffalo_code,name,current_status')
    .eq('current_status', 'ACTIVE')
    .order('buffalo_code');
  if (error) throw new Error('Could not load active buffaloes. Please try again.');
  return (data ?? []) as BuffaloProductionAnimal[];
}
