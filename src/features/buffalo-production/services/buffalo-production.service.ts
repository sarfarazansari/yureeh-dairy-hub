import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilkEntryShift } from '@/lib/milk-entry-list';

export type BuffaloProductionAnimal = {
  id: string;
  buffalo_code: string;
  name: string | null;
  current_status?: 'ACTIVE' | 'DRY';
};

export type BuffaloProductionRecord = {
  buffalo_id: string;
  business_date: string;
  shift: MilkEntryShift;
  milk_quantity: number | string;
};

export type BuffaloProductionSheetRecord = Omit<BuffaloProductionRecord, 'business_date'>;

export type BuffaloProductionHistoryRecord = BuffaloProductionRecord & { id: string };

export type BuffaloProductionInput = {
  buffalo_id: string;
  milk_quantity: number | string;
};

export async function getProductionSheet(
  client: SupabaseClient,
  businessDate: string,
  shift: MilkEntryShift,
) {
  const [buffaloes, production] = await Promise.all([
    client
      .from('buffaloes')
      .select('id,buffalo_code,name,current_status')
      .in('current_status', ['ACTIVE', 'DRY'])
      .order('buffalo_code'),
    client
      .from('buffalo_milk_production')
      .select('buffalo_id,shift,milk_quantity')
      .eq('business_date', businessDate)
      .eq('shift', shift),
  ]);

  if (buffaloes.error || production.error) {
    throw new Error('Could not load buffaloes and production records. Please try again.');
  }

  return {
    buffaloes: (buffaloes.data ?? []) as BuffaloProductionAnimal[],
    production: (production.data ?? []) as BuffaloProductionSheetRecord[],
  };
}

export async function saveProductionSheet(
  client: SupabaseClient,
  input: {
    businessDate: string;
    shift: MilkEntryShift;
    buffaloIds: string[];
    records: BuffaloProductionInput[];
  },
) {
  const { error } = await client.rpc('save_buffalo_milk_production', {
    p_business_date: input.businessDate,
    p_shift: input.shift,
    p_buffalo_ids: input.buffaloIds,
    p_records: input.records,
  });

  if (error) {
    if (error.code === '22023') {
      throw new Error(error.message);
    }
    throw new Error('Could not save buffalo production. Please try again.');
  }
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
