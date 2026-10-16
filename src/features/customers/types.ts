import type { PricingType, Shift } from '@/lib/milk-domain';

export type CustomerOption = {
  id: string;
  name: string;
  pricing_type: PricingType;
  default_rate: number;
  is_active: boolean;
};



export type CustomerSummary = CustomerOption & {
  phone: string | null;
  address: string | null;
  notes: string | null;
  total_milk_quantity: number;
  total_sales_amount: number;
  entry_count: number;
};

export type CustomerPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';

export type CustomerPayment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: CustomerPaymentMethod;
  transaction_reference: string | null;
  notes: string | null;
};
export type CustomerPricing = {
  pricing_type: PricingType;
  rate: number;
  effective_from: string;
  effective_to: string | null;
};

export type CustomerFinancialSummary = {
  total_milk_quantity: number;
  total_sales_amount: number;
  entry_count: number;
  total_payments_amount: number;
  payment_count: number;
};

export type CustomerEntry = {
  id: string;
  business_date: string;
  shift: Shift;
  milk_quantity: number;
  fat: number | null;
  pricing_type: PricingType;
  applied_rate: number;
  calculated_amount: number;
};
