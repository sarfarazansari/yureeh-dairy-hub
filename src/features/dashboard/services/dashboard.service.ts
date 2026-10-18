import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilkEntry } from '@/lib/analytics';
import type { CustomerOption } from '@/features/customers/types';

export type DashboardCustomer = CustomerOption;
export type DashboardBuffalo = { id: string; buffalo_code: string; name: string | null };
export type DashboardHerdItem = DashboardBuffalo & {
  performance: { milk_quantity: number; record_count: number } | null;
};
export type DashboardMonthlyTotals = {
  expenseTotal: number;
  revenue: number;
  milkProduced: number;
  milkSold: number;
};

export type DashboardMilkMargin = {
  milkLitresSold: number;
  milkSalesRevenue: number;
  feedConsumptionCost: number;
  feedConsumptionEntries: number;
  uncostedFeedConsumptionEntries: number;
};

type DashboardMilkMarginRow = {
  milk_litres_sold: number | string;
  milk_sales_revenue: number | string;
  feed_consumption_cost: number | string;
  feed_consumption_entries: number | string;
  uncosted_feed_consumption_entries: number | string;
};

type DashboardAnalyticsResponse = {
  totals?: {
    expenseTotal?: number | string;
    farmRevenue?: number | string;
    farmMilkProduced?: number | string;
    farmMilkSold?: number | string;
  };
};

export async function getDashboardData(
  client: SupabaseClient,
  dates: { startDate: string; today: string; monthStart: string },
) {
  const [entries, customers, buffaloes, todayProduction, monthlySummaryResult, milkMarginResult] =
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
      client.rpc('get_sales_analytics_summary', {
        p_from: dates.monthStart,
        p_to: dates.today,
        p_customer_id: null,
      }),
      client.rpc('get_milk_margin_after_feed', {
        p_from: dates.monthStart,
        p_to: dates.today,
      }),
    ]);

  if (
    entries.error ||
    customers.error ||
    buffaloes.error ||
    todayProduction.error ||
    monthlySummaryResult.error ||
    milkMarginResult.error
  ) {
    throw new Error('Could not load the farm dashboard. Please try again.');
  }

  const monthlyTotals = (
    monthlySummaryResult.data as DashboardAnalyticsResponse | null
  )?.totals;
  if (!monthlyTotals) {
    throw new Error('Could not load the farm dashboard summary. Please try again.');
  }

  const marginRow = (milkMarginResult.data?.[0] ?? null) as DashboardMilkMarginRow | null;
  if (!marginRow) {
    throw new Error('Could not load the milk margin summary. Please try again.');
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
    monthSummary: {
      expenseTotal: Number(monthlyTotals.expenseTotal ?? 0),
      revenue: Number(monthlyTotals.farmRevenue ?? 0),
      milkProduced: Number(monthlyTotals.farmMilkProduced ?? 0),
      milkSold: Number(monthlyTotals.farmMilkSold ?? 0),
    } satisfies DashboardMonthlyTotals,
    milkMargin: {
      milkLitresSold: Number(marginRow.milk_litres_sold ?? 0),
      milkSalesRevenue: Number(marginRow.milk_sales_revenue ?? 0),
      feedConsumptionCost: Number(marginRow.feed_consumption_cost ?? 0),
      feedConsumptionEntries: Number(marginRow.feed_consumption_entries ?? 0),
      uncostedFeedConsumptionEntries: Number(marginRow.uncosted_feed_consumption_entries ?? 0),
    } satisfies DashboardMilkMargin,
  };
}
