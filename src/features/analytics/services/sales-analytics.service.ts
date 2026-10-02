import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilkEntry } from '@/lib/analytics';

export type AnalyticsCustomer = { id: string; name: string };
export type AnalyticsExpense = { total_amount: number };
export type AnalyticsFarmSale = { calculated_amount: number; milk_quantity: number };
export type AnalyticsProduction = { milk_quantity: number };
export type SalesAnalyticsEntry = MilkEntry;

export async function getSalesAnalyticsData(
  client: SupabaseClient,
  filters: { from: string; to: string; customerId: string },
) {
  let salesQuery = client
    .from('milk_entries')
    .select(
      'business_date,shift,customer_id,milk_quantity,fat,pricing_type,applied_rate,calculated_amount',
    )
    .gte('business_date', filters.from)
    .lte('business_date', filters.to)
    .is('deleted_at', null);
  if (filters.customerId) salesQuery = salesQuery.eq('customer_id', filters.customerId);

  const [sales, customers, expenses, farmSales, production] = await Promise.all([
    salesQuery.order('business_date'),
    client.from('customers').select('id,name').order('name'),
    client
      .from('expenses')
      .select('total_amount')
      .gte('business_date', filters.from)
      .lte('business_date', filters.to)
      .is('deleted_at', null),
    client
      .from('milk_entries')
      .select('calculated_amount,milk_quantity')
      .gte('business_date', filters.from)
      .lte('business_date', filters.to)
      .is('deleted_at', null),
    client
      .from('buffalo_milk_production')
      .select('milk_quantity')
      .gte('business_date', filters.from)
      .lte('business_date', filters.to),
  ]);

  if (sales.error || customers.error || expenses.error || farmSales.error || production.error) {
    throw new Error('Could not load sales analytics. Please try again.');
  }

  return {
    sales: (sales.data ?? []) as SalesAnalyticsEntry[],
    customers: (customers.data ?? []) as AnalyticsCustomer[],
    expenses: (expenses.data ?? []) as AnalyticsExpense[],
    farmSales: (farmSales.data ?? []) as AnalyticsFarmSale[],
    production: (production.data ?? []) as AnalyticsProduction[],
  };
}
