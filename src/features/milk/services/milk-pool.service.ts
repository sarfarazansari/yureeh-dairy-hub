import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  MilkPoolManualMovementType,
  MilkPoolMovementDirection,
} from '../milk.constants';

export type MilkPoolReconciliationRow = {
  business_date: string;
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
