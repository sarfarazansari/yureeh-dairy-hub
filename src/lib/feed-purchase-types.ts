export type FeedPurchasePaymentStatus = 'PAID' | 'PARTIAL' | 'CREDIT';
export type FeedPurchaseStatus = 'ACTIVE' | 'CORRECTED';

export type FeedPurchase = {
  id: string;
  user_id: string;
  feed_item_id: string;
  vendor_id: string | null;
  expense_id: string;
  business_date: string;
  purchase_quantity: number | string;
  purchase_unit: string;
  base_quantity: number | string;
  base_unit: string;
  rate_per_purchase_unit: number | string;
  total_amount: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  status: FeedPurchaseStatus;
  correction_of_purchase_id: string | null;
  corrected_by_purchase_id: string | null;
};

export type FeedPurchaseListRow = FeedPurchase & {
  feed_item_name: string;
  vendor_name: string | null;
  payment_status: FeedPurchasePaymentStatus;
};

export type FeedPurchasePreview = {
  purchaseUnit: string;
  baseUnit: string;
  purchaseUnitQuantity: number;
  baseQuantity: number;
  rate: number;
  total: number;
  inventoryUnitCost: number;
};