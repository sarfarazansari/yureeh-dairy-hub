import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { fetchDietPlans } from './services';

const PAGE_SIZE = 20;

export const dietPlanQueryKeys = {
  all: ['diet-plans'] as const,
  list: (input: { page: number; search: string; status: string }) =>
    [...dietPlanQueryKeys.all, 'list', input.page, PAGE_SIZE, input.search, input.status] as const,
};

export function useDietPlanArchiveQuery(input: { page: number; search: string; status: string }) {
  return useQuery({
    queryKey: dietPlanQueryKeys.list(input),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return fetchDietPlans(supabase, input.page, PAGE_SIZE, { search: input.search, status: input.status });
    },
  });
}
