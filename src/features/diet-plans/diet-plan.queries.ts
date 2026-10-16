import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { fetchActiveFeedItems, fetchDietPlanForEdit, fetchDietPlans, fetchEligibleBuffaloes, saveDietPlan } from './diet-plan.service';
import type { DietPlanFormValues } from './diet-plan.schema';

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


export function useSaveDietPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string | null; values: DietPlanFormValues }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return saveDietPlan(supabase, input.id, input.values);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dietPlanQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['feed-items'] }),
      ]);
    },
  });
}


export function useActiveDietFeedItemsQuery() {
  return useQuery({
    queryKey: [...dietPlanQueryKeys.all, 'active-feed-items'] as const,
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return fetchActiveFeedItems(supabase);
    },
  });
}

export function useEligibleDietBuffaloesQuery(date: string) {
  return useQuery({
    queryKey: [...dietPlanQueryKeys.all, 'eligible-buffaloes', date] as const,
    enabled: Boolean(date),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return fetchEligibleBuffaloes(supabase, date);
    },
  });
}

export function useDietPlanDetailsQuery(id: string) {
  return useQuery({
    queryKey: [...dietPlanQueryKeys.all, 'detail', id] as const,
    enabled: Boolean(id),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return fetchDietPlanForEdit(supabase, id);
    },
  });
}
