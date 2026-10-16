import type { PricingType, Shift } from '@/lib/milk-domain';

export type MilkEntryDatePreset = 'current-month' | 'last-7-days' | 'last-15-days' | 'custom';
export type MilkEntryShift = Shift;

export type MilkEntryFilters = {
  from: string;
  to: string;
  customerSearch: string;
  customerId: string;
  shift: MilkEntryShift | '';
  pricingType: PricingType | '';
};

export type MilkEntryPagination = { page: number; pageSize: number };

export type MilkEntryListRow = {
  id: string;
  business_date: string;
  shift: MilkEntryShift;
  customer_id: string;
  milk_quantity: number;
  fat: number | null;
  pricing_type: PricingType;
  applied_rate: number;
  calculated_amount: number;
  notes: string | null;
  created_at: string;
  customers: { name: string; pricing_type: PricingType } | null;
};

export type MilkEntryListResult = { rows: MilkEntryListRow[]; total: number };
