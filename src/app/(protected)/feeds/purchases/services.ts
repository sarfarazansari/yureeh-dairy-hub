import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedPurchase, FeedPurchasePreview, FeedPurchasePaymentStatus } from '@/lib/feed-purchase-types';
import type { FeedItem } from '@/lib/feed-types';

export async function createFeedPurchase(client: SupabaseClient, values: {
  feedItemId: string;
  vendorId: string;
  businessDate: string;
  purchaseQuantity: number;
  rate: number;
  paymentStatus: string;
  paidAmount: number;
  paymentMethod: string;
  dueDate?: string;
  notes?: string;
}) {
  const { data, error } = await client.rpc('create_feed_purchase', {
    p_feed_item_id: values.feedItemId,
    p_vendor_id: values.vendorId || null,
    p_business_date: values.businessDate,
    p_purchase_quantity: values.purchaseQuantity,
    p_rate_per_purchase_unit: values.rate,
    p_payment_status: values.paymentStatus,
    p_paid_amount: values.paidAmount,
    p_payment_method: values.paymentMethod,
    p_due_date: values.dueDate || null,
    p_notes: values.notes?.trim() || null,
  });
  if (error) throw error;
  return data as FeedPurchase;
}

export function getPurchasePreview(feed: FeedItem | undefined, quantity: number, rate: number): FeedPurchasePreview | null {
  if (!feed || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  const baseQuantity = quantity * Number(feed.purchase_unit_quantity);
  const total = Math.round(quantity * rate * 100) / 100;
  return {
    purchaseUnit: feed.purchase_unit,
    baseUnit: feed.base_unit,
    purchaseUnitQuantity: Number(feed.purchase_unit_quantity),
    baseQuantity,
    rate,
    total,
    inventoryUnitCost: baseQuantity ? total / baseQuantity : 0,
  };
}

export async function fetchFeedPurchases(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: { from?: string; to?: string; feedItemId?: string; vendorId?: string; paymentStatus?: string } = {},
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = client
    .from('feed_purchases')
    .select('*, feed_items!inner(name), expense_vendors(name), expenses!inner(payment_status)', { count: 'exact' })
    .order('business_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.from) query = query.gte('business_date', filters.from);
  if (filters.to) query = query.lte('business_date', filters.to);
  if (filters.feedItemId) query = query.eq('feed_item_id', filters.feedItemId);
  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
  if (filters.paymentStatus) query = query.eq('expenses.payment_status', filters.paymentStatus);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []).map((row) => ({
      ...row,
      feed_item_name: (row.feed_items as { name: string } | null)?.name ?? '—',
      vendor_name: (row.expense_vendors as { name: string } | null)?.name ?? null,
      payment_status: (row.expenses as { payment_status: FeedPurchasePaymentStatus } | null)?.payment_status ?? 'CREDIT',
    })),
    count: count ?? 0,
  };
}


export async function fetchFeedPurchaseForEdit(client: SupabaseClient, purchaseId: string) {
  const { data, error } = await client
    .from('feed_purchases')
    .select('*, expenses!inner(payment_status,paid_amount,payment_method,due_date), feed_items!inner(name,purchase_unit,base_unit,purchase_unit_quantity)')
    .eq('id', purchaseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Feed purchase not found.');

  const expense = data.expenses as {
    payment_status: FeedPurchasePaymentStatus;
    paid_amount: number | string;
    payment_method: string | null;
    due_date: string | null;
  };

  return {
    purchase: data as FeedPurchase,
    paymentStatus: expense.payment_status,
    paidAmount: Number(expense.paid_amount),
    paymentMethod: expense.payment_method ?? 'CASH',
    dueDate: expense.due_date ?? '',
  };
}

export async function correctFeedPurchase(
  client: SupabaseClient,
  purchaseId: string,
  values: {
    feedItemId: string;
    vendorId: string;
    businessDate: string;
    purchaseQuantity: number;
    rate: number;
    paymentStatus: string;
    paidAmount: number;
    paymentMethod: string;
    dueDate?: string;
    notes?: string;
  },
) {
  const { data, error } = await client.rpc('correct_feed_purchase', {
    p_purchase_id: purchaseId,
    p_feed_item_id: values.feedItemId,
    p_vendor_id: values.vendorId || null,
    p_business_date: values.businessDate,
    p_purchase_quantity: values.purchaseQuantity,
    p_rate_per_purchase_unit: values.rate,
    p_payment_status: values.paymentStatus,
    p_paid_amount: values.paidAmount,
    p_payment_method: values.paymentMethod,
    p_due_date: values.dueDate || null,
    p_notes: values.notes?.trim() || null,
  });

  if (error) throw error;
  return data as FeedPurchase;
}
