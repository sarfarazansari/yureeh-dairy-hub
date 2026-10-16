import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { milkQueryKeys } from '@/features/milk/milk.queries';
import {
  getProductionSheet,
  getBuffaloProductionHistory,
  getBuffaloProductionRange,
  getProducingBuffaloes,
  saveProductionSheet,
} from './services/buffalo-production.service';
import type { BuffaloProductionSheetInput } from './types';
import { buffaloProductionQueryKeys } from './buffalo-production.query-keys';

export { buffaloProductionQueryKeys } from './buffalo-production.query-keys';

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export function useProductionSheetQuery(businessDate: string, shift: 'MORNING' | 'EVENING') {
  return useQuery({
    queryKey: buffaloProductionQueryKeys.sheet(businessDate, shift),
    queryFn: () => getProductionSheet(requireSupabase(), businessDate, shift),
  });
}

export function useSaveProductionSheetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BuffaloProductionSheetInput) =>
      saveProductionSheet(requireSupabase(), input),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: buffaloProductionQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: milkQueryKeys.all }),
      ]);
    },
  });
}

export function useBuffaloProductionRangeQuery(from: string, to: string) {
  return useQuery({
    queryKey: buffaloProductionQueryKeys.range(from, to),
    queryFn: () => getBuffaloProductionRange(requireSupabase(), from, to),
  });
}

export function useBuffaloProductionHistoryQuery(buffaloId: string) {
  return useQuery({
    queryKey: buffaloProductionQueryKeys.history(buffaloId),
    queryFn: () => getBuffaloProductionHistory(requireSupabase(), buffaloId),
    enabled: Boolean(buffaloId),
  });
}

export function useProducingBuffaloesQuery() {
  return useQuery({
    queryKey: buffaloProductionQueryKeys.producingBuffaloes(),
    queryFn: () => getProducingBuffaloes(requireSupabase()),
  });
}
