import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getDashboardData } from './services/dashboard.service';

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  overview: (dates: { startDate: string; today: string; monthStart: string }) =>
    [...dashboardQueryKeys.all, 'overview', dates.startDate, dates.today, dates.monthStart] as const,
};

export function useDashboardDataQuery(dates: {
  startDate: string;
  today: string;
  monthStart: string;
}) {
  return useQuery({
    queryKey: dashboardQueryKeys.overview(dates),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getDashboardData(supabase, dates);
    },
  });
}
