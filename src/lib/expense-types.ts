import type { ExpenseGroup } from '@/lib/expenses';

export type ExpenseCategory = {
  id: string;
  owner_id?: string | null;
  name: string;
  category_group: ExpenseGroup;
  default_unit: string | null;
  is_quantity_based: boolean;
  is_active: boolean;
  description: string | null;
};

export type ExpenseVendor = {
  id: string;
  user_id?: string;
  name: string;
  mobile: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  is_active: boolean;
};

export type ExpenseBuffaloOption = { id: string; buffalo_code: string; name: string | null };

export type ExpenseRow = {
  id: string;
  business_date: string;
  category_id: string;
  category_name_snapshot: string;
  category_group_snapshot: ExpenseGroup;
  vendor_id: string | null;
  vendor_name_snapshot: string | null;
  description: string | null;
  quantity: number | string | null;
  unit: string | null;
  rate: number | string | null;
  total_amount: number | string;
  payment_status: 'PAID' | 'PARTIAL' | 'CREDIT';
  paid_amount: number | string;
  pending_amount: number | string;
  payment_method: string | null;
  due_date: string | null;
  buffalo_id: string | null;
  buffalo_code_snapshot: string | null;
  notes: string | null;
  receipt_reference: string | null;
  deleted_at: string | null;
  created_at: string;
};
