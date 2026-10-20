import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilkPoolShiftFatRecord } from '../milk.types';

import type {
  MilkPoolManualMovementType,
  MilkPoolMovementDirection,
} from '../milk.constants';

export type MilkPoolReconciliationRow = {
  business_date: string;
  opening_balance_litres: number;
  production_litres: number;
  customer_delivery_litres: number;
  household_use_litres: number;
  wastage_litres: number;
  other_use_litres: number;
  adjustment_in_litres: number;
  adjustment_out_litres: number;
  net_movement_litres: number;
  closing_balance_litres: number;
};

export type RecordMilkPoolMovementInput = {
  businessDate: string;
  shift: 'MORNING' | 'EVENING' | null;
  movementType: MilkPoolManualMovementType;
  quantity: number;
  direction: MilkPoolMovementDirection;
  notes: string;
};

export async function getMilkPoolReconciliation(
  client: SupabaseClient,
  from: string,
  to: string,
): Promise<MilkPoolReconciliationRow[]> {
  const { data, error } = await client.rpc('get_milk_pool_reconciliation', {
    p_start_date: from,
    p_end_date: to,
  });
  if (error) throw new Error(error.message || 'Could not load milk pool reconciliation.');

  const rows = ((data ?? []) as unknown as MilkPoolReconciliationRow[]).map((row) => ({ ...row }));
  if (!rows.length) return rows;

  // Customer-entry edits/deletes append an ADJUSTMENT IN linked to the old
  // CUSTOMER_DELIVERY. The SQL reconciliation's gross delivery total still
  // includes that reversed movement, so normalize the report by removing the
  // old delivery and its matching reversal from the same business date.
  const { data: reversals, error: reversalsError } = await client
    .from('milk_pool_movements')
    .select('business_date,quantity,reversal_of_id,movement_direction')
    .eq('movement_type', 'ADJUSTMENT')
    .eq('movement_direction', 'IN')
    .not('reversal_of_id', 'is', null)
    .gte('business_date', from)
    .lte('business_date', to);

  if (reversalsError) {
    throw new Error(reversalsError.message || 'Could not reconcile reversed customer deliveries.');
  }

  const reversalRows = (reversals ?? []) as Array<{
    business_date: string;
    quantity: number | string;
    reversal_of_id: string;
    movement_direction: 'IN';
  }>;
  const originalIds = [...new Set(reversalRows.map((movement) => movement.reversal_of_id))];
  if (!originalIds.length) return rows;

  const { data: originals, error: originalsError } = await client
    .from('milk_pool_movements')
    .select('id,business_date,movement_type')
    .in('id', originalIds);

  if (originalsError) {
    throw new Error(originalsError.message || 'Could not resolve reversed customer deliveries.');
  }

  const originalById = new Map((originals ?? []).map((movement) => [
    movement.id,
    { business_date: String(movement.business_date), movement_type: String(movement.movement_type) },
  ]));

  const reversalsByDate = new Map<string, number>();
  for (const reversal of reversalRows) {
    const original = originalById.get(reversal.reversal_of_id);
    if (!original || original.movement_type !== 'CUSTOMER_DELIVERY') continue;
    if (original.business_date !== reversal.business_date) continue;
    reversalsByDate.set(
      reversal.business_date,
      (reversalsByDate.get(reversal.business_date) ?? 0) + Number(reversal.quantity),
    );
  }

  return rows.map((row) => {
    const reversedDelivery = reversalsByDate.get(row.business_date) ?? 0;
    if (!reversedDelivery) return row;
    return {
      ...row,
      customer_delivery_litres: Math.max(0, Number(row.customer_delivery_litres) - reversedDelivery),
      adjustment_in_litres: Math.max(0, Number(row.adjustment_in_litres) - reversedDelivery),
    };
  });
}

export async function recordMilkPoolMovement(
  client: SupabaseClient,
  input: RecordMilkPoolMovementInput,
): Promise<string> {
  const { data, error } = await client.rpc('record_milk_pool_movement', {
    p_business_date: input.businessDate,
    p_shift: input.shift,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_movement_direction: input.direction,
    p_notes: input.notes.trim() || null,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Could not record the milk pool movement.');
  }
  return String(data);
}


export type MilkDeliveryContext = {
  herdEntryExists: boolean;
  productionLitres: number;
  customerDeliveryLitres: number;
  availablePoolLitres: number;
};

export async function getMilkDeliveryContext(
  client: SupabaseClient,
  businessDate: string,
  shift: 'MORNING' | 'EVENING',
): Promise<MilkDeliveryContext> {
  const [herdResult, contextResult] = await Promise.all([
    client
      .from('buffalo_milk_production')
      .select('id', { count: 'exact', head: true })
      .eq('business_date', businessDate)
      .eq('shift', shift),
    client.rpc('get_milk_pool_shift_context', {
      p_business_date: businessDate,
      p_shift: shift,
    }),
  ]);

  if (herdResult.error) {
    throw new Error(herdResult.error.message || 'Could not check herd production for the selected date and shift.');
  }
  if (contextResult.error) {
    throw new Error(contextResult.error.message || 'Could not load milk availability for the selected date and shift.');
  }

  const row = (contextResult.data ?? [])[0] as
    | {
        production_litres: number | string;
        customer_delivery_litres: number | string;
        available_pool_litres: number | string;
      }
    | undefined;

  return {
    herdEntryExists: (herdResult.count ?? 0) > 0,
    productionLitres: row ? Number(row.production_litres) : 0,
    customerDeliveryLitres: row ? Number(row.customer_delivery_litres) : 0,
    availablePoolLitres: row ? Number(row.available_pool_litres) : 0,
  };
}


export async function getMilkPoolShiftFatHistory(
  client: SupabaseClient,
  from: string,
  to: string,
): Promise<MilkPoolShiftFatRecord[]> {
  const { data, error } = await client
    .from('milk_pool_shift_fat')
    .select('business_date,shift,fat_percentage')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: false })
    .order('shift');

  if (error) throw new Error(error.message || 'Could not load mixed milk fat history.');
  return (data ?? []) as MilkPoolShiftFatRecord[];
}
