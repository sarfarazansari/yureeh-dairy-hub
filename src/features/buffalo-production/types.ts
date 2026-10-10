import type { MilkEntryShift } from '@/lib/milk-entry-list';

export type BuffaloProductionAnimal = {
  id: string;
  buffalo_code: string;
  name: string | null;
  current_status: 'ACTIVE' | 'DRY';
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

export type BuffaloProductionSheetInput = {
  businessDate: string;
  shift: MilkEntryShift;
  buffaloIds: string[];
  records: BuffaloProductionInput[];
  fatPercentage: number | null;
};

export type MilkPoolShiftFatRecord = {
  business_date: string;
  shift: MilkEntryShift;
  fat_percentage: number | string;
};
