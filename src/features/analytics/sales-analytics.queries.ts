import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  getMilkMarginAfterFeed,
  getMilkPoolAdjustmentAudit,
  getSalesAnalyticsData,
} from './services/sales-analytics.service';

export type SalesAnalyticsFilters = {
  from: string;
  to: string;
  customerId: string;
};

const normalizeFilters = (filters: SalesAnalyticsFilters): SalesAnalyticsFilters => ({
  from: filters.from,
  to: filters.to,
  customerId: filters.customerId.trim(),
});

export const salesAnalyticsQueryKeys = {
  all: ['sales-analytics'] as const,
  summary: (filters: SalesAnalyticsFilters) => {
    const normalized = normalizeFilters(filters);
    return [
      ...salesAnalyticsQueryKeys.all,
      'summary',
      normalized.from,
      normalized.to,
      normalized.customerId || 'all-customers',
    ] as const;
  },
};

export function useSalesAnalyticsQuery(filters: SalesAnalyticsFilters) {
  const normalized = normalizeFilters(filters);
  const validRange = Boolean(
    normalized.from &&
    normalized.to &&
    normalized.from <= normalized.to
  );

  return useQuery({
    queryKey: salesAnalyticsQueryKeys.summary(normalized),
    enabled: validRange,
    // Analytics filters must resolve to a fresh result rather than a previous
    // customer/date combination left in the shared 30-second cache.
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: undefined,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getSalesAnalyticsData(supabase, normalized);
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

export const milkPoolAdjustmentQueryKeys = {
  all: ['milk-pool-adjustment-audit'] as const,
  range: (from: string, to: string) => ['milk-pool-adjustment-audit', from, to] as const,
};

export function useMilkPoolAdjustmentsQuery(from: string, to: string) {
  const validRange = Boolean(from && to && from <= to);
  return useQuery({
    queryKey: milkPoolAdjustmentQueryKeys.range(from, to),
    enabled: validRange,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getMilkPoolAdjustmentAudit(supabase, { from, to });
    },
  });
}
