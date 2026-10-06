import type { SupabaseClient } from '@supabase/supabase-js';

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
  return (data ?? []) as unknown as MilkPoolReconciliationRow[];
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
  const [herdResult, poolResult] = await Promise.all([
    client
      .from('buffalo_milk_production')
      .select('id', { count: 'exact', head: true })
      .eq('business_date', businessDate)
      .eq('shift', shift),
    client.rpc('get_milk_pool_reconciliation', {
      p_start_date: businessDate,
      p_end_date: businessDate,
    }),
  ]);

  if (herdResult.error) {
    throw new Error(herdResult.error.message || 'Could not check herd production for the selected date and shift.');
  }
  if (poolResult.error) {
    throw new Error(poolResult.error.message || 'Could not load the milk pool for the selected date.');
  }

  const row = (poolResult.data ?? [])[0] as
    | {
        production_litres: number | string;
        customer_delivery_litres: number | string;
        closing_balance_litres: number | string;
      }
    | undefined;

  return {
    herdEntryExists: (herdResult.count ?? 0) > 0,
    productionLitres: row ? Number(row.production_litres) : 0,
    customerDeliveryLitres: row ? Number(row.customer_delivery_litres) : 0,
    availablePoolLitres: row ? Number(row.closing_balance_litres) : 0,
  };
}
