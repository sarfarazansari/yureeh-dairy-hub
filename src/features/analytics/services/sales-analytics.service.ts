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


export type MilkMarginAfterFeedRow = {
  milk_litres_sold: number | string;
  milk_sales_revenue: number | string;
  feed_consumption_cost: number | string;
  feed_consumption_entries: number | string;
  uncosted_feed_consumption_entries: number | string;
};

export async function getMilkMarginAfterFeed(
  client: SupabaseClient,
  filters: { from: string; to: string },
): Promise<MilkMarginAfterFeedRow[]> {
  if (!filters.from || !filters.to || filters.from > filters.to) {
    throw new Error('Choose a valid report date range.');
  }
  const { data, error } = await client.rpc('get_milk_margin_after_feed', {
    p_from: filters.from,
    p_to: filters.to,
  });
  if (error) throw new Error(error.message || 'Could not load milk margin after feed.');
  return (data ?? []) as unknown as MilkMarginAfterFeedRow[];
}


export type MilkPoolAdjustmentAuditRow = {
  id: string;
  business_date: string;
  movement_direction: 'IN' | 'OUT';
  quantity: number | string;
  source_type: string | null;
  source_id: string | null;
  notes: string | null;
  reversal_of_id: string | null;
  original_movement_type: string | null;
  original_business_date: string | null;
  reverses_customer_delivery: boolean;
};

export async function getMilkPoolAdjustmentAudit(
  client: SupabaseClient,
  filters: { from: string; to: string },
): Promise<MilkPoolAdjustmentAuditRow[]> {
  if (!filters.from || !filters.to || filters.from > filters.to) {
    throw new Error('Choose a valid report date range.');
  }
  const { data, error } = await client
    .from('milk_pool_movements')
    .select('id,business_date,movement_direction,quantity,source_type,source_id,notes,reversal_of_id')
    .eq('movement_type', 'ADJUSTMENT')
    .gte('business_date', filters.from)
    .lte('business_date', filters.to)
    .order('business_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'Could not load milk pool adjustment details.');

  const movements = (data ?? []) as Array<Omit<MilkPoolAdjustmentAuditRow,
    'original_movement_type' | 'original_business_date' | 'reverses_customer_delivery'>>;
  const originalIds = [...new Set(movements.map((row) => row.reversal_of_id).filter((id): id is string => Boolean(id)))];
  const originalsById = new Map<string, { movement_type: string; business_date: string }>();

  if (originalIds.length) {
    const originalsResult = await client
      .from('milk_pool_movements')
      .select('id,movement_type,business_date')
      .in('id', originalIds);
    if (originalsResult.error) {
      throw new Error(originalsResult.error.message || 'Could not resolve reversed milk pool movements.');
    }
    for (const original of originalsResult.data ?? []) {
      originalsById.set(original.id, {
        movement_type: String(original.movement_type),
        business_date: String(original.business_date),
      });
    }
  }

  return movements.map((movement) => {
    const original = movement.reversal_of_id ? originalsById.get(movement.reversal_of_id) : undefined;
    return {
      ...movement,
      original_movement_type: original?.movement_type ?? null,
      original_business_date: original?.business_date ?? null,
      reverses_customer_delivery: original?.movement_type === 'CUSTOMER_DELIVERY',
    };
  });
}
