import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedPurchase, FeedPurchasePreview } from '@/lib/feed-purchase-types';
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

export async function fetchFeedPurchases(client: SupabaseClient, page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await client
    .from('feed_purchases')
    .select('*, feed_items!inner(name), expense_vendors(name)', { count: 'exact' })
    .order('business_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    rows: (data ?? []).map((row) => ({
      ...row,
      feed_item_name: (row.feed_items as { name: string } | null)?.name ?? '—',
      vendor_name: (row.expense_vendors as { name: string } | null)?.name ?? null,
    })),
    count: count ?? 0,
  };
}