import type { SupabaseClient } from '@supabase/supabase-js';

import type { BuffaloPurchaseFormValues } from '@/lib/buffalo-validation';

export type BuffaloListItem = {
  id: string;
  buffalo_code: string;
  name: string | null;
  breed: string | null;
  purchase_date: string | null;
  current_status: string;
  buffalo_purchases: Array<{
    purchase_price: number;
    amount_paid: number;
    amount_pending: number;
    purchase_date: string;
    payment_status: string;
    payment_due_date: string | null;
    payment_terms: string | null;
    vendors: {
      name: string;
      village_city: string | null;
    } | null;
  }>;
};

export type BuffaloDetail = {
  id: string;
  buffalo_code: string;
  name: string | null;
  breed: string | null;
  current_status: string;
  identification_mark: string | null;
  color: string | null;
  age_at_purchase_months: number | null;
  notes: string | null;
  buffalo_purchases: Array<{
    id: string;
    purchase_price: number;
    amount_paid: number;
    amount_pending: number;
    purchase_date: string;
    payment_status: string;
    payment_due_date: string | null;
    payment_terms: string | null;
    vendors: {
      name: string;
      mobile: string | null;
      address: string | null;
      village_city: string | null;
    } | null;
  }>;
};

type PurchasePaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
type BuffaloStatus = 'ACTIVE' | 'SOLD' | 'DECEASED' | 'DRY' | 'OTHER';

export async function getBuffaloDirectory(client: SupabaseClient) {
  const { data, error } = await client
    .from('buffaloes')
    .select(
      'id,buffalo_code,name,breed,purchase_date,current_status,buffalo_purchases(purchase_price,amount_paid,amount_pending,purchase_date,payment_status,payment_due_date,payment_terms,vendors(name,village_city))',
    )
    .order('buffalo_code');

  if (error) {
    throw new Error('Could not load buffalo records. Please try again.');
  }

  return (data ?? []).map((buffalo) => ({
    ...buffalo,
    buffalo_purchases: (buffalo.buffalo_purchases ?? []).map((purchase) => ({
      ...purchase,
      purchase_price: Number(purchase.purchase_price),
      amount_paid: Number(purchase.amount_paid),
      amount_pending: Number(purchase.amount_pending),
      vendors: Array.isArray(purchase.vendors)
        ? (purchase.vendors[0] ?? null)
        : purchase.vendors,
    })),
  })) as BuffaloListItem[];
}

/**
 * Creates the acquisition transaction and its initial payment state atomically.
 */
export async function createBuffaloPurchase(
  client: SupabaseClient,
  purchase: BuffaloPurchaseFormValues,
  balanceDue: boolean,
) {
  const { error } = await client.rpc('create_buffalo_purchase', {
    p_buffalo_code: purchase.buffalo_code,
    p_breed: purchase.breed,
    p_purchase_date: purchase.purchase_date,
    p_purchase_price: purchase.purchase_price,
    p_advance_paid: purchase.advance_paid,
    p_payment_due_date: balanceDue ? purchase.payment_due_date || null : null,
    p_payment_terms: balanceDue ? purchase.payment_terms?.trim() || null : null,
    p_buffalo_name: purchase.buffalo_name?.trim() || null,
    p_vendor_name: purchase.vendor_name?.trim() || null,
    p_vendor_location: purchase.vendor_location?.trim() || null,
  });

  if (!error) return;

  if (
    error.code === '23505' ||
    error.message.toLowerCase().includes('buffalo code')
  ) {
    throw new Error('Buffalo code already exists. Please use a unique code.');
  }

  if (error.code === '23514' || error.code === '22023') {
    throw new Error(error.message);
  }

  throw new Error('Could not save buffalo purchase. Please try again.');
}

export async function getBuffaloDetails(
  client: SupabaseClient,
  buffaloCode: string,
) {
  const { data, error } = await client
    .from('buffaloes')
    .select(
      'id,buffalo_code,name,breed,current_status,identification_mark,color,age_at_purchase_months,notes,buffalo_purchases(*,vendors(name,mobile,address,village_city))',
    )
    .eq('buffalo_code', buffaloCode)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load buffalo details. Please try again.');
  }

  if (!data) return null;

  return {
    ...data,
    buffalo_purchases: (data.buffalo_purchases ?? []).map((purchase) => ({
      ...purchase,
      purchase_price: Number(purchase.purchase_price),
      amount_paid: Number(purchase.amount_paid),
      amount_pending: Number(purchase.amount_pending),
    })),
  } as BuffaloDetail;
}

/** Records a later payment against the original buffalo purchase balance. */
export async function recordBuffaloPurchasePayment(
  client: SupabaseClient,
  buffaloId: string,
  payment: {
    payment_date: string;
    amount: number;
    payment_method: PurchasePaymentMethod;
    transaction_reference?: string;
    notes?: string;
  },
) {
  const { error } = await client.rpc('record_buffalo_purchase_payment', {
    p_buffalo_id: buffaloId,
    p_payment_date: payment.payment_date,
    p_amount: payment.amount,
    p_payment_method: payment.payment_method,
    p_transaction_reference: payment.transaction_reference?.trim() || null,
    p_notes: payment.notes?.trim() || null,
  });

  if (!error) return;

  if (error.code === '23514' || error.code === 'P0002') {
    throw new Error(error.message);
  }

  throw new Error('Could not record purchase payment. Please try again.');
}

/** Changes the current buffalo status and records the lifecycle event. */
export async function changeBuffaloStatus(
  client: SupabaseClient,
  buffaloId: string,
  status: BuffaloStatus,
  effectiveDate: string,
  notes?: string,
) {
  const { error } = await client.rpc('change_buffalo_status', {
    p_buffalo_id: buffaloId,
    p_status: status,
    p_effective_date: effectiveDate,
    p_notes: notes?.trim() || null,
  });

  if (!error) return;

  if (error.code === '23514' || error.code === 'P0002') {
    throw new Error(error.message);
  }

  throw new Error('Could not change buffalo status. Please try again.');
}

/**
 * Updates buffalo master/profile fields only.
 * Purchase and lifecycle transactions are intentionally kept separate.
 */
export async function updateBuffaloProfile(
  client: SupabaseClient,
  buffaloId: string,
  profile: {
    buffalo_code: string;
    name?: string;
    breed: string;
    color?: string;
    identification_mark?: string;
    age_at_purchase_months?: number | null;
    notes?: string;
  },
) {
  const { error } = await client.rpc('update_buffalo_profile', {
    p_buffalo_id: buffaloId,
    p_buffalo_code: profile.buffalo_code,
    p_name: profile.name?.trim() || null,
    p_breed: profile.breed.trim(),
    p_color: profile.color?.trim() || null,
    p_identification_mark: profile.identification_mark?.trim() || null,
    p_age_at_purchase_months: profile.age_at_purchase_months ?? null,
    p_notes: profile.notes?.trim() || null,
  });

  if (!error) return;

  if (
    error.code === '23505' ||
    error.code === '23514' ||
    error.code === 'P0002'
  ) {
    throw new Error(error.message);
  }

  throw new Error('Could not update buffalo profile. Please try again.');
}
