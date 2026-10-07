import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingType } from '@/lib/analytics';

export type CustomerOption = {
  id: string;
  name: string;
  pricing_type: PricingType;
  default_rate: number;
  is_active: boolean;
};

export type CustomerSummary = CustomerOption & { phone: string | null };
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
  const [customer, entries] = await Promise.all([
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
  ]);
  if (customer.error || entries.error) {
    throw new Error('Could not load customer details. Please try again.');
  }
  return {
    customer: customer.data as CustomerSummary | null,
    entries: (entries.data ?? []) as CustomerEntry[],
  };
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
