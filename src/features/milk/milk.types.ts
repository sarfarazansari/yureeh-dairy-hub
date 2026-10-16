import type { Shift } from '@/lib/milk-domain';

/** Mixed farm milk-pool fat recorded once per business date and milking shift. */
export type MilkPoolShiftFatRecord = {
  business_date: string;
  shift: Shift;
  fat_percentage: number | string;
};
