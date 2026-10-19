import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedPurchase, FeedPurchasePreview, FeedPurchasePaymentStatus } from './types';
import type { FeedItem } from '@/features/feed-items/types';

export async function createFeedPurchase(client: SupabaseClient, values: {
  feedItemId: string;
  vendorId?: string;
  businessDate: string;
  purchaseQuantity: number;
  rate: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'CREDIT';
  paidAmount: number;
  paymentMethod: string;
  dueDate?: string;
  notes?: string;
}, idempotencyKey: string) {
  const { data, error } = await client.rpc('create_feed_purchase_idempotent', {
    p_idempotency_key: idempotencyKey,
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
    .eq('status', 'ACTIVE')
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

  const rows = (data ?? []).map((row) => ({
    ...row,
    feed_item_name: (row.feed_items as { name: string } | null)?.name ?? '—',
    vendor_name: (row.expense_vendors as { name: string } | null)?.name ?? null,
    payment_status: (row.expenses as { payment_status: FeedPurchasePaymentStatus } | null)?.payment_status ?? 'CREDIT',
    can_edit_delete: true,
  }));

  if (!rows.length) {
    return { rows, count: count ?? 0 };
  }

  const feedIds = [...new Set(rows.map((row) => row.feed_item_id))];

  const { data: activePurchases, error: activePurchaseError } = await client
    .from('feed_purchases')
    .select('id, feed_item_id')
    .eq('status', 'ACTIVE')
    .in('feed_item_id', feedIds);

  if (activePurchaseError) throw activePurchaseError;
  const activePurchaseIds = new Set((activePurchases ?? []).map((purchase) => purchase.id));

  const { data: movements, error: movementError } = await client
    .from('feed_inventory_movements')
    .select('id, feed_item_id, movement_type, quantity, source_type, source_id, occurred_at, created_at, reversal_of_movement_id')
    .in('feed_item_id', feedIds)
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (movementError) throw movementError;

  // A purchase is locked only when FIFO allocation says its lot has actually
  // been consumed/adjusted out. A later outbound movement for the same feed
  // item must not blanket-lock every older purchase.
  const allMovements = movements ?? [];
  const reversedMovementIds = new Set(
    allMovements
      .filter((movement) =>
        ['FEED_CONSUMPTION_REVERSAL', 'FEED_CONSUMPTION_EDIT_REVERSAL'].includes(movement.source_type),
      )
      .map((movement) => movement.reversal_of_movement_id)
      .filter((id): id is string => Boolean(id)),
  );

  const activeMovements = allMovements.filter((movement) => {
    // Deleted/corrected purchases remain in the append-only ledger, but their
    // original stock-in must not be counted as an available FIFO lot.
    if (
      movement.movement_type === 'PURCHASE' &&
      movement.source_type === 'FEED_PURCHASE' &&
      !activePurchaseIds.has(movement.source_id)
    ) return false;

    if (
      movement.movement_type === 'CONSUMPTION' &&
      movement.source_type === 'FEED_CONSUMPTION' &&
      reversedMovementIds.has(movement.id)
    ) return false;

    // The matching reversal is represented by the original movement being
    // excluded above; do not count the reversal as a new stock lot.
    if (
      ['FEED_CONSUMPTION_REVERSAL', 'FEED_CONSUMPTION_EDIT_REVERSAL'].includes(movement.source_type)
    ) return false;

    // Purchase corrections reverse a specific purchase and are not generic
    // consumption. The corrected/deleted purchase is already absent from rows.
    if (
      movement.movement_type === 'ADJUSTMENT_OUT' &&
      ['FEED_PURCHASE_EDIT', 'FEED_PURCHASE_DELETE', 'FEED_PURCHASE_CORRECTION'].includes(movement.source_type)
    ) return false;

    return true;
  });

  const consumedPurchaseIds = new Set<string>();
  const movementsByFeed = new Map<string, typeof activeMovements>();
  for (const movement of activeMovements) {
    const current = movementsByFeed.get(movement.feed_item_id) ?? [];
    current.push(movement);
    movementsByFeed.set(movement.feed_item_id, current);
  }

  for (const feedId of feedIds) {
    const feedMovements = [...(movementsByFeed.get(feedId) ?? [])].sort((a, b) => {
      const occurred = String(a.occurred_at ?? '').localeCompare(String(b.occurred_at ?? ''));
      if (occurred !== 0) return occurred;
      // For same-day entries, make stock-in available before that day's
      // consumption so the allocation is deterministic and matches business dates.
      const aIn = a.movement_type === 'PURCHASE' || a.movement_type === 'ADJUSTMENT_IN';
      const bIn = b.movement_type === 'PURCHASE' || b.movement_type === 'ADJUSTMENT_IN';
      if (aIn !== bIn) return aIn ? -1 : 1;
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    });

    const lots: Array<{ purchaseId: string | null; remaining: number }> = [];
    for (const movement of feedMovements) {
      const quantity = Number(movement.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      if (movement.movement_type === 'PURCHASE' && movement.source_type === 'FEED_PURCHASE') {
        lots.push({ purchaseId: movement.source_id, remaining: quantity });
        continue;
      }

      if (movement.movement_type === 'ADJUSTMENT_IN') {
        // Unlinked inventory additions form their own lot; they do not
        // make an earlier purchase appear consumed.
        lots.push({ purchaseId: null, remaining: quantity });
        continue;
      }

      const isOutbound =
        movement.movement_type === 'CONSUMPTION' ||
        movement.movement_type === 'ADJUSTMENT_OUT';
      if (!isOutbound) continue;

      let remainingOutflow = quantity;
      for (const lot of lots) {
        if (remainingOutflow <= 0) break;
        if (lot.remaining <= 0) continue;
        const used = Math.min(lot.remaining, remainingOutflow);
        lot.remaining -= used;
        remainingOutflow -= used;
        if (used > 0 && lot.purchaseId) consumedPurchaseIds.add(lot.purchaseId);
      }
    }
  }

  const enrichedRows = rows.map((row) => ({
    ...row,
    can_edit_delete: !consumedPurchaseIds.has(row.id),
  }));

  return {
    rows: enrichedRows,
    count: count ?? 0,
  };
}

export async function fetchFeedPurchaseForEdit(client: SupabaseClient, purchaseId: string) {
  const { data, error } = await client
    .from('feed_purchases')
    .select('*, expenses!inner(payment_status,paid_amount,payment_method,due_date), feed_items!inner(name,purchase_unit,base_unit,purchase_unit_quantity)')
    .eq('id', purchaseId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Feed purchase not found or it is locked.');

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

export async function editFeedPurchase(
  client: SupabaseClient,
  purchaseId: string,
  values: {
    feedItemId: string;
    vendorId?: string;
    businessDate: string;
    purchaseQuantity: number;
    rate: number;
    paymentStatus: 'PAID' | 'PARTIAL' | 'CREDIT';
    paidAmount: number;
    paymentMethod: string;
    dueDate?: string;
    notes?: string;
  },
) {
  const { data, error } = await client.rpc('edit_feed_purchase', {
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

export async function deleteFeedPurchase(client: SupabaseClient, purchaseId: string) {
  const { error } = await client.rpc('delete_feed_purchase', {
    p_purchase_id: purchaseId,
  });

  if (error) throw error;
}
