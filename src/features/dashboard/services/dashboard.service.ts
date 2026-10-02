import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilkEntry } from '@/lib/analytics';

export type DashboardCustomer = {
  id: string;
  name: string;
  pricing_type: 'FIXED_PER_LITRE' | 'FAT_BASED';
  default_rate: number;
  is_active: boolean;
};
export type DashboardBuffalo = { id: string; buffalo_code: string; name: string | null };
export type DashboardHerdItem = DashboardBuffalo & {
  performance: { milk_quantity: number; record_count: number } | null;
};
export type DashboardExpense = { total_amount: number };
export type DashboardSale = { milk_quantity: number; calculated_amount: number };

export async function getDashboardData(
  client: SupabaseClient,
  dates: { startDate: string; today: string; monthStart: string },
) {
  const [entries, customers, buffaloes, todayProduction, expenses, monthSales, monthProduction] =
    await Promise.all([
      client
        .from('milk_entries')
        .select(
          'business_date,shift,customer_id,milk_quantity,fat,pricing_type,calculated_amount,applied_rate',
        )
        .gte('business_date', dates.startDate)
        .lte('business_date', dates.today)
        .is('deleted_at', null),
      client.from('customers').select('id,name,pricing_type,default_rate,is_active'),
      client.from('buffaloes').select('id,buffalo_code,name').eq('current_status', 'ACTIVE'),
      client
        .from('buffalo_milk_production')
        .select('buffalo_id,business_date,shift,milk_quantity')
        .eq('business_date', dates.today),
      client
        .from('expenses')
        .select('total_amount')
        .gte('business_date', dates.monthStart)
        .lte('business_date', dates.today)
        .is('deleted_at', null),
      client
        .from('milk_entries')
        .select('milk_quantity,calculated_amount')
        .gte('business_date', dates.monthStart)
        .lte('business_date', dates.today)
        .is('deleted_at', null),
      client
        .from('buffalo_milk_production')
        .select('milk_quantity')
        .gte('business_date', dates.monthStart)
        .lte('business_date', dates.today),
    ]);

  if (
    entries.error ||
    customers.error ||
    buffaloes.error ||
    todayProduction.error ||
    expenses.error ||
    monthSales.error ||
    monthProduction.error
  ) {
    throw new Error('Could not load the farm dashboard. Please try again.');
  }

  const productionRows = todayProduction.data ?? [];
  const herd: DashboardHerdItem[] = ((buffaloes.data ?? []) as DashboardBuffalo[]).map(
    (buffalo) => {
      const records = productionRows.filter((record) => record.buffalo_id === buffalo.id);
      return {
        ...buffalo,
        performance: records.length
          ? {
              milk_quantity: records.reduce((sum, record) => sum + Number(record.milk_quantity), 0),
              record_count: records.length,
            }
          : null,
      };
    },
  );

  return {
    entries: (entries.data ?? []) as MilkEntry[],
    customers: (customers.data ?? []) as DashboardCustomer[],
    herd,
    expenses: (expenses.data ?? []) as DashboardExpense[],
    monthSales: (monthSales.data ?? []) as DashboardSale[],
    monthProduction: (monthProduction.data ?? []) as Array<{ milk_quantity: number }>,
  };
}
