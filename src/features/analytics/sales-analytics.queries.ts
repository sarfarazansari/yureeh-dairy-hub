import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getMilkMarginAfterFeed, getSalesAnalyticsData } from './services/sales-analytics.service';

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


export const milkMarginAfterFeedQueryKeys = {
  all: ['milk-margin-after-feed'] as const,
  summary: (from: string, to: string) => ['milk-margin-after-feed', from, to] as const,
};

export function useMilkMarginAfterFeedQuery(from: string, to: string) {
  const validRange = Boolean(from && to && from <= to);
  return useQuery({
    queryKey: milkMarginAfterFeedQueryKeys.summary(from, to),
    enabled: validRange,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getMilkMarginAfterFeed(supabase, { from, to });
    },
  });
}
