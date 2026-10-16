import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getFinancialReport } from './services/financial-reports.service';

export const financialReportQueryKeys = {
  all: ['financial-reports'] as const,
  range: (from: string, to: string) =>
    [...financialReportQueryKeys.all, 'range', from, to] as const,
};

export function useFinancialReportQuery(from: string, to: string) {
  return useQuery({
    queryKey: financialReportQueryKeys.range(from, to),
    enabled: Boolean(from && to && from <= to),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getFinancialReport(supabase, from, to);
    },
  });
}
