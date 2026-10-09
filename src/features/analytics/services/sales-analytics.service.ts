import type { SupabaseClient } from '@supabase/supabase-js';

export type AnalyticsCustomer = { id: string; name: string };

export type SalesAnalyticsDailyRow = {
  businessDate: string;
  milk: number;
  revenue: number;
  fat: number | null;
};

export type SalesAnalyticsShiftRow = {
  shift: 'MORNING' | 'EVENING';
  milk: number;
  revenue: number;
  fat: number | null;
};

export type SalesAnalyticsCustomerRow = {
  id: string;
  name: string;
  milk: number;
  revenue: number;
};

export type SalesAnalyticsPricingRow = {
  type: 'FIXED_PER_LITRE' | 'FAT_BASED';
  milk: number;
  revenue: number;
  count: number;
};

export type SalesAnalyticsSummary = {
  totals: {
    milkSold: number;
    revenue: number;
    weightedFat: number | null;
    entryCount: number;
    expenseTotal: number;
    farmRevenue: number;
    farmMilkSold: number;
    farmMilkProduced: number;
  };
  daily: SalesAnalyticsDailyRow[];
  shifts: SalesAnalyticsShiftRow[];
  customers: SalesAnalyticsCustomerRow[];
  pricing: SalesAnalyticsPricingRow[];
};

export async function getSalesAnalyticsData(
  client: SupabaseClient,
  filters: { from: string; to: string; customerId: string },
): Promise<{ summary: SalesAnalyticsSummary; customers: AnalyticsCustomer[] }> {
  if (!filters.from || !filters.to || filters.from > filters.to) {
    throw new Error('Choose a valid report date range.');
  }

  const [summaryResult, customersResult] = await Promise.all([
    client.rpc('get_sales_analytics_summary', {
      p_from: filters.from,
      p_to: filters.to,
      p_customer_id: filters.customerId || null,
    }),
    client.from('customers').select('id,name').order('name'),
  ]);

  if (summaryResult.error || customersResult.error) {
    throw new Error('Could not load sales analytics. Please try again.');
  }

  if (!summaryResult.data) {
    throw new Error('Sales analytics returned no summary.');
  }

  return {
    summary: summaryResult.data as unknown as SalesAnalyticsSummary,
    customers: (customersResult.data ?? []) as AnalyticsCustomer[],
  };
}
