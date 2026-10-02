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
    vendors: { name: string; village_city: string | null } | null;
  }>;
};

export async function getBuffaloDirectory(client: SupabaseClient) {
  const { data, error } = await client
    .from('buffaloes')
    .select(
      'id,buffalo_code,name,breed,purchase_date,current_status,buffalo_purchases(purchase_price,amount_paid,amount_pending,purchase_date,payment_status,payment_due_date,payment_terms,vendors(name,village_city))',
    )
    .order('buffalo_code');
  if (error) throw new Error('Could not load buffalo records. Please try again.');
  return (data ?? []).map((buffalo) => ({
    ...buffalo,
    buffalo_purchases: (buffalo.buffalo_purchases ?? []).map((purchase) => ({
      ...purchase,
      purchase_price: Number(purchase.purchase_price),
      amount_paid: Number(purchase.amount_paid),
      amount_pending: Number(purchase.amount_pending),
      vendors: Array.isArray(purchase.vendors) ? (purchase.vendors[0] ?? null) : purchase.vendors,
    })),
  })) as BuffaloListItem[];
}

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
  if (error.code === '23505' || error.message.toLowerCase().includes('buffalo code')) {
    throw new Error('Buffalo code already exists. Please use a unique code.');
  }
  if (error.code === '23514' || error.code === '22023') throw new Error(error.message);
  throw new Error('Could not save buffalo purchase. Please try again.');
}

export type BuffaloDetail = {
  id: string;
  buffalo_code: string;
  name: string | null;
  breed: string | null;
  current_status: string;
  identification_mark: string | null;
  color: string | null;
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
      mobile: string | null;
      address: string | null;
      village_city: string | null;
    } | null;
  }>;
};

export async function getBuffaloDetails(client: SupabaseClient, buffaloCode: string) {
  const { data, error } = await client
    .from('buffaloes')
    .select(
      'id,buffalo_code,name,breed,current_status,identification_mark,color,buffalo_purchases(*,vendors(name,mobile,address,village_city))',
    )
    .eq('buffalo_code', buffaloCode)
    .maybeSingle();
  if (error) throw new Error('Could not load buffalo details. Please try again.');
  return data as BuffaloDetail | null;
}
