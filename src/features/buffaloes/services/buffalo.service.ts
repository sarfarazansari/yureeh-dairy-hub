import type { SupabaseClient } from '@supabase/supabase-js';

import type { BuffaloPurchaseFormValues } from '../validation';
import type {
  BuffaloDetail,
  BuffaloListItem,
  BuffaloPaymentMethod,
  BuffaloPurchaseEditInput,
  BuffaloPurchasePayment,
  BuffaloPurchasePaymentInput,
  BuffaloSale,
  BuffaloSaleInput,
  BuffaloSalePayment,
  BuffaloSalePaymentInput,
  BuffaloDisposal,
  BuffaloDisposalInput,
  BuffaloProfileEditInput,
  BuffaloStatus,
  BuffaloStatusHistory,
  BuffaloVendorEditInput,
} from '../types';

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
  buffaloId: string,
) {
  const { data, error } = await client
    .from('buffaloes')
    .select(
      'id,buffalo_code,name,breed,current_status,identification_mark,color,age_at_purchase_months,notes,buffalo_purchases(*,vendors(name,mobile,address,village_city,state,notes))',
    )
    .eq('id', buffaloId)
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
  payment: BuffaloPurchasePaymentInput,
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
  profile: BuffaloProfileEditInput,
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

export async function updateBuffaloPurchase(
  client: SupabaseClient,
  buffaloId: string,
  input: BuffaloPurchaseEditInput,
) {
  const { error } = await client.rpc('update_buffalo_purchase', {
    p_buffalo_id: buffaloId,
    p_purchase_date: input.purchase_date,
    p_purchase_price: input.purchase_price,
    p_payment_due_date: input.payment_due_date || null,
    p_payment_terms: input.payment_terms?.trim() || null,
    p_payment_method: input.payment_method || null,
    p_transaction_reference: input.transaction_reference?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });

  if (!error) return;

  if (error.code === '23514' || error.code === 'P0002') {
    throw new Error(error.message);
  }

  throw new Error('Could not update purchase details. Please try again.');
}

export async function updateBuffaloVendor(
  client: SupabaseClient,
  buffaloId: string,
  input: BuffaloVendorEditInput,
) {
  const { error } = await client.rpc('update_buffalo_vendor', {
    p_buffalo_id: buffaloId,
    p_name: input.name.trim(),
    p_mobile: input.mobile?.trim() || null,
    p_address: input.address?.trim() || null,
    p_village_city: input.village_city?.trim() || null,
    p_state: input.state?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });

  if (!error) return;

  if (error.code === '23514' || error.code === 'P0002') {
    throw new Error(error.message);
  }

  throw new Error('Could not update vendor details. Please try again.');
}

export async function getBuffaloPurchasePayments(
  client: SupabaseClient,
  buffaloId: string,
) {
  const { data, error } = await client
    .from('buffalo_purchase_payments')
    .select('id,payment_date,amount,payment_method,transaction_reference,notes')
    .eq('buffalo_id', buffaloId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Could not load payment history. Please try again.');
  }

  return (data ?? []).map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  })) as BuffaloPurchasePayment[];
}

export async function getBuffaloStatusHistory(
  client: SupabaseClient,
  buffaloId: string,
) {
  const { data, error } = await client
    .from('buffalo_status_history')
    .select('id,status,effective_date,notes')
    .eq('buffalo_id', buffaloId)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Could not load status history. Please try again.');
  }

  return (data ?? []) as BuffaloStatusHistory[];
}


export async function createBuffaloSale(
  client: SupabaseClient,
  buffaloId: string,
  input: BuffaloSaleInput,
) {
  const { data, error } = await client.rpc('create_buffalo_sale', {
    p_buffalo_id: buffaloId,
    p_sale_date: input.sale_date,
    p_buyer_name: input.buyer_name.trim(),
    p_buyer_mobile: input.buyer_mobile?.trim() || null,
    p_buyer_location: input.buyer_location?.trim() || null,
    p_sale_price: input.sale_price,
    p_initial_payment: input.initial_payment,
    p_payment_method: input.initial_payment > 0 ? input.payment_method ?? null : null,
    p_payment_date: input.initial_payment > 0 ? input.payment_date || null : null,
    p_payment_due_date: input.initial_payment < input.sale_price ? input.payment_due_date || null : null,
    p_payment_terms: input.payment_terms?.trim() || null,
    p_transaction_reference: input.transaction_reference?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });
  if (!error) return data as string;
  if (['23514', 'P0002', '42501'].includes(error.code ?? '')) throw new Error(error.message);
  throw new Error('Could not record buffalo sale. Please try again.');
}

export async function getBuffaloSale(client: SupabaseClient, buffaloId: string) {
  const { data, error } = await client
    .from('buffalo_sales')
    .select('*')
    .eq('buffalo_id', buffaloId)
    .maybeSingle();
  if (error) throw new Error('Could not load buffalo sale. Please try again.');
  return data as BuffaloSale | null;
}

export async function getBuffaloSalePayments(client: SupabaseClient, buffaloId: string) {
  const { data, error } = await client
    .from('buffalo_sale_payments')
    .select('id,payment_date,amount,payment_method,transaction_reference,notes')
    .eq('buffalo_id', buffaloId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load sale payment history. Please try again.');
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as BuffaloSalePayment[];
}

export async function recordBuffaloSalePayment(
  client: SupabaseClient,
  saleId: string,
  input: BuffaloSalePaymentInput,
) {
  const { error } = await client.rpc('record_buffalo_sale_payment', {
    p_buffalo_sale_id: saleId,
    p_payment_date: input.payment_date,
    p_amount: input.amount,
    p_payment_method: input.payment_method,
    p_transaction_reference: input.transaction_reference?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });
  if (!error) return;
  if (['23514', 'P0002', '42501'].includes(error.code ?? '')) throw new Error(error.message);
  throw new Error('Could not record sale payment. Please try again.');
}

export async function recordBuffaloDisposal(
  client: SupabaseClient,
  buffaloId: string,
  input: BuffaloDisposalInput,
) {
  const { data, error } = await client.rpc('record_buffalo_disposal', {
    p_buffalo_id: buffaloId,
    p_disposal_type: input.disposal_type,
    p_effective_date: input.effective_date,
    p_reason: input.reason.trim(),
    p_notes: input.notes?.trim() || null,
  });
  if (!error) return data as string;
  if (['23514', 'P0002', '42501'].includes(error.code ?? '')) throw new Error(error.message);
  throw new Error('Could not record buffalo disposal. Please try again.');
}

export async function getBuffaloDisposal(client: SupabaseClient, buffaloId: string) {
  const { data, error } = await client
    .from('buffalo_disposals')
    .select('id,buffalo_id,disposal_type,effective_date,reason,notes')
    .eq('buffalo_id', buffaloId)
    .maybeSingle();
  if (error) throw new Error('Could not load buffalo disposal. Please try again.');
  return data as BuffaloDisposal | null;
}

export async function getBuffaloSales(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: { from?: string; to?: string; search?: string } = {},
) {
  let query = client
    .from('buffalo_sales')
    .select('id,buffalo_id,sale_date,buyer_name,sale_price,amount_received,amount_pending,payment_status,buffaloes!inner(buffalo_code,name)', { count: 'exact' })
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (filters.from) query = query.gte('sale_date', filters.from);
  if (filters.to) query = query.lte('sale_date', filters.to);
  if (filters.search) {
    const term = filters.search.trim().replace(/[,%()]/g, '');
    if (term) query = query.or(`buyer_name.ilike.%${term}%,buyer_mobile.ilike.%${term}%`);
  }
  const { data, error, count } = await query;
  if (error) throw new Error('Could not load buffalo sales. Please try again.');
  return {
    rows: (data ?? []).map((row) => ({
      ...row,
      sale_price: Number(row.sale_price),
      amount_received: Number(row.amount_received),
      amount_pending: Number(row.amount_pending),
      buffaloes: Array.isArray(row.buffaloes) ? row.buffaloes[0] : row.buffaloes,
    })),
    count: count ?? 0,
  };
}
