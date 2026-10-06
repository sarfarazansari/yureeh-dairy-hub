export const BUFFALO_PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;
export type BuffaloPaymentMethod = (typeof BUFFALO_PAYMENT_METHODS)[number];

export const BUFFALO_STATUSES = ['ACTIVE', 'SOLD', 'DECEASED', 'DRY', 'OTHER'] as const;
export type BuffaloStatus = (typeof BUFFALO_STATUSES)[number];

export const buffaloPaymentTypes = ['PAID_IN_FULL', 'PARTIAL_CREDIT', 'FULL_CREDIT'] as const;
export type BuffaloPaymentType = (typeof buffaloPaymentTypes)[number];

export type BuffaloVendor = {
  name: string;
  mobile: string | null;
  address: string | null;
  village_city: string | null;
  state: string | null;
  notes: string | null;
};

export type BuffaloPurchaseSummary = {
  purchase_price: number;
  amount_paid: number;
  amount_pending: number;
  purchase_date: string;
  payment_status: string;
  payment_due_date: string | null;
  payment_terms: string | null;
  vendors: Pick<BuffaloVendor, 'name' | 'village_city'> | null;
};

export type BuffaloPurchase = BuffaloPurchaseSummary & {
  id: string;
  vendor_id: string | null;
  payment_method: BuffaloPaymentMethod | null;
  transaction_reference: string | null;
  notes: string | null;
  vendors: BuffaloVendor | null;
};

export type BuffaloListItem = {
  id: string;
  buffalo_code: string;
  name: string | null;
  breed: string | null;
  purchase_date: string | null;
  current_status: BuffaloStatus;
  buffalo_purchases: BuffaloPurchaseSummary[];
};

export type BuffaloDetail = {
  id: string;
  buffalo_code: string;
  name: string | null;
  breed: string | null;
  current_status: BuffaloStatus;
  identification_mark: string | null;
  color: string | null;
  age_at_purchase_months: number | null;
  notes: string | null;
  buffalo_purchases: BuffaloPurchase[];
};

export type BuffaloPurchasePayment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: BuffaloPaymentMethod;
  transaction_reference: string | null;
  notes: string | null;
};

export type BuffaloStatusHistory = {
  id: string;
  status: BuffaloStatus;
  effective_date: string;
  notes: string | null;
};

export type BuffaloProfileEditInput = {
  buffalo_code: string;
  name?: string;
  breed: string;
  color?: string;
  identification_mark?: string;
  age_at_purchase_months?: number | null;
  notes?: string;
};

export type BuffaloPurchaseEditInput = {
  purchase_date: string;
  purchase_price: number;
  payment_due_date?: string | null;
  payment_terms?: string;
  payment_method?: BuffaloPaymentMethod | null;
  transaction_reference?: string;
  notes?: string;
};

export type BuffaloVendorEditInput = {
  name: string;
  mobile?: string;
  address?: string;
  village_city?: string;
  state?: string;
  notes?: string;
};

export type BuffaloPurchasePaymentInput = {
  payment_date: string;
  amount: number;
  payment_method: BuffaloPaymentMethod;
  transaction_reference?: string;
  notes?: string;
};

export type BuffaloStatusChangeInput = {
  buffaloId: string;
  status: BuffaloStatus;
  effectiveDate: string;
  notes?: string;
};
