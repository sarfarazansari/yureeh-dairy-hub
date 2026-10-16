import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getSalesAnalyticsData } from './services/sales-analytics.service';

export const salesAnalyticsQueryKeys = {
  all: ['sales-analytics'] as const,
  summary: (filters: { from: string; to: string; customerId: string }) =>
    [...salesAnalyticsQueryKeys.all, 'summary', filters.from, filters.to, filters.customerId] as const,
};

export function useSalesAnalyticsQuery(filters: {
  from: string;
  to: string;
  customerId: string;
}) {
  const validRange = Boolean(filters.from && filters.to && filters.from <= filters.to);
  return useQuery({
    queryKey: salesAnalyticsQueryKeys.summary(filters),
    enabled: validRange,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getSalesAnalyticsData(supabase, filters);
    },
  });
}
