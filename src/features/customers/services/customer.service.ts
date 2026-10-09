import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingType } from '@/lib/analytics';

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
export type CustomerMilkSummary = {
  customer_id: string;
  milk_quantity: number;
  calculated_amount: number;
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
};

export type CustomerEntry = {
  id: string;
  business_date: string;
  shift: 'MORNING' | 'EVENING';
  milk_quantity: number;
  fat: number | null;
  pricing_type: PricingType;
  applied_rate: number;
  calculated_amount: number;
};

export async function getMilkEntryCustomers(client: SupabaseClient) {
  const { data, error } = await client
    .from('customers')
    .select('id,name,pricing_type,default_rate,is_active')
    .order('name', { ascending: true });
  if (error) throw new Error('Could not load customers. Please try again.');
  return (data ?? []) as CustomerOption[];
}

export async function getCustomerDirectory(client: SupabaseClient) {
  const [customers, entries] = await Promise.all([
    client.from('customers').select('*').order('name'),
    client
      .from('milk_entries')
      .select('customer_id,milk_quantity,calculated_amount')
      .is('deleted_at', null),
  ]);
  if (customers.error || entries.error) {
    throw new Error('Could not load the customer directory. Please try again.');
  }
  return {
    customers: (customers.data ?? []) as CustomerSummary[],
    entries: (entries.data ?? []) as CustomerMilkSummary[],
  };
}

export async function createCustomer(
  client: SupabaseClient,
  input: { userId: string; name: string; pricingType: PricingType; defaultRate: number },
) {
  const { error } = await client.from('customers').insert({
    user_id: input.userId,
    name: input.name,
    pricing_type: input.pricingType,
    default_rate: input.defaultRate,
  });
  if (error)
    throw new Error('Could not add this customer. Please check the details and try again.');
}

export async function updateCustomer(
  client: SupabaseClient,
  customerId: string,
  input: { name: string; phone?: string | null; address?: string | null; notes?: string | null },
) {
  const { error } = await client
    .from('customers')
    .update({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', customerId);

  if (error) throw new Error('Could not update this customer. Please try again.');
}

export async function updateCustomerPricing(
  client: SupabaseClient,
  customerId: string,
  defaultRate: number,
  pricingType: PricingType,
) {
  const { error } = await client
    .from('customers')
    .update({ default_rate: defaultRate, pricing_type: pricingType })
    .eq('id', customerId);
  if (error) throw new Error('Could not update this customer’s pricing. Please try again.');
}

export async function setCustomerActive(
  client: SupabaseClient,
  customerId: string,
  active: boolean,
) {
  const { error } = await client
    .from('customers')
    .update({ is_active: active })
    .eq('id', customerId);
  if (error) throw new Error('Could not update this customer’s status. Please try again.');
}

export async function getCustomerDetails(client: SupabaseClient, customerId: string) {
  const [customer, entries, summary] = await Promise.all([
    client.from('customers').select('*').eq('id', customerId).maybeSingle(),
    client
      .from('milk_entries')
      .select(
        'id,business_date,shift,milk_quantity,fat,pricing_type,applied_rate,calculated_amount',
      )
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('business_date', { ascending: false })
      .limit(500),
    client.rpc('get_customer_financial_summary', { p_customer_id: customerId }),
  ]);
  if (customer.error || entries.error || summary.error) {
    throw new Error('Could not load customer details. Please try again.');
  }

  const totals = summary.data?.[0];
  return {
    customer: customer.data as CustomerSummary | null,
    entries: (entries.data ?? []) as CustomerEntry[],
    financialSummary: {
      total_milk_quantity: Number(totals?.total_milk_quantity ?? 0),
      total_sales_amount: Number(totals?.total_sales_amount ?? 0),
      entry_count: Number(totals?.entry_count ?? 0),
    } as CustomerFinancialSummary,
  };
}

export async function getCustomerPayments(
  client: SupabaseClient,
  customerId: string,
) {
  const { data, error } = await client
    .from('customer_payments')
    .select('id,payment_date,amount,payment_method,transaction_reference,notes')
    .eq('customer_id', customerId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Could not load customer payment history. Please try again.');
  }

  return (data ?? []).map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  })) as CustomerPayment[];
}

export async function recordCustomerPayment(
  client: SupabaseClient,
  customerId: string,
  payment: {
    payment_date: string;
    amount: number;
    payment_method: CustomerPaymentMethod;
    transaction_reference?: string | null;
    notes?: string | null;
  },
) {
  const { error } = await client.rpc('record_customer_payment', {
    p_customer_id: customerId,
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

  throw new Error('Could not record customer payment. Please try again.');
}

export async function getCustomerPricingForDate(
  client: SupabaseClient,
  customerId: string,
  businessDate: string,
): Promise<CustomerPricing | null> {
  const { data, error } = await client.rpc('get_customer_pricing_for_date', {
    p_customer_id: customerId,
    p_business_date: businessDate,
  });
  if (error) throw new Error('Could not load customer pricing for the selected date.');
  return data?.[0] ? (data[0] as CustomerPricing) : null;
}

export async function getActiveCustomersForMilkEntry(client: SupabaseClient) {
  const { data, error } = await client
    .from('customers')
    .select('id,name,pricing_type,default_rate,is_active')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error('Could not load active customers. Please try again.');
  return (data ?? []) as CustomerOption[];
}
