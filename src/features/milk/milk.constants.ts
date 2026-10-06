import type { MilkEntryShift } from '@/lib/milk-entry-list';

export const MILK_ENTRY_PAGE_SIZE = 20;

export const MILK_POOL_MOVEMENT_TYPES = [
  'HOUSEHOLD_USE',
  'WASTAGE',
  'OTHER_USE',
  'ADJUSTMENT',
] as const;

export type MilkPoolManualMovementType = (typeof MILK_POOL_MOVEMENT_TYPES)[number];
export type MilkPoolMovementDirection = 'IN' | 'OUT';

export const MILK_POOL_MOVEMENT_LABELS: Record<MilkPoolManualMovementType, string> = {
  HOUSEHOLD_USE: 'Household use',
  WASTAGE: 'Wastage',
  OTHER_USE: 'Other use',
  ADJUSTMENT: 'Adjustment',
};

export const MILK_POOL_SHIFT_OPTIONS: Array<{ value: MilkEntryShift; label: string }> = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'EVENING', label: 'Evening' },
];

export const MILK_POOL_QUERY_STALE_TIME = 30_000;
