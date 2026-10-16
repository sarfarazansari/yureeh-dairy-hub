import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { createFeedConsumption, deleteFeedConsumption, editFeedConsumption, fetchFeedConsumption, fetchFeedConsumptionForEdit, fetchFeedItems, fetchFeedStock } from './services';

const PAGE_SIZE = 20;

export const feedConsumptionQueryKeys = {
  all: ['feed-consumption'] as const,
  list: (input: { page: number; from: string; to: string; feedFilter: string }) =>
    [...feedConsumptionQueryKeys.all, 'list', input.page, PAGE_SIZE, input.from, input.to, input.feedFilter] as const,
};

export function useFeedConsumptionArchiveQuery(input: {
  page: number; from: string; to: string; feedFilter: string;
}) {
  return useQuery({
    queryKey: feedConsumptionQueryKeys.list(input),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [feedItems, consumption] = await Promise.all([
        fetchFeedItems(supabase, false),
        fetchFeedConsumption(supabase, input.page, PAGE_SIZE, {
          from: input.from, to: input.to, feedItemId: input.feedFilter,
        }),
      ]);
      return { feedItems, ...consumption };
    },
  });
}


async function invalidateConsumptionDependents(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: feedConsumptionQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['feed-inventory'] }),
    queryClient.invalidateQueries({ queryKey: ['diet-plans'] }),
    queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-cost-analytics'] }),
  ]);
}

export function useCreateFeedConsumptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createFeedConsumption>[1]) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return createFeedConsumption(supabase, input);
    },
    onSuccess: () => invalidateConsumptionDependents(queryClient),
  });
}

export function useEditFeedConsumptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { movementId: string; values: Parameters<typeof editFeedConsumption>[2] }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return editFeedConsumption(supabase, input.movementId, input.values);
    },
    onSuccess: () => invalidateConsumptionDependents(queryClient),
  });
}

export function useDeleteFeedConsumptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movementId: string) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return deleteFeedConsumption(supabase, movementId);
    },
    onSuccess: () => invalidateConsumptionDependents(queryClient),
  });
}


export function useFeedConsumptionFormOptionsQuery(activeOnly = true) {
  return useQuery({
    queryKey: [...feedConsumptionQueryKeys.all, 'form-options', activeOnly] as const,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [feedItems, stock] = await Promise.all([
        fetchFeedItems(supabase, activeOnly),
        fetchFeedStock(supabase),
      ]);
      return { feedItems, stock };
    },
  });
}

export function useFeedConsumptionForEditQuery(movementId: string) {
  return useQuery({
    queryKey: [...feedConsumptionQueryKeys.all, 'detail', movementId] as const,
    enabled: Boolean(movementId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [options, consumption] = await Promise.all([
        getFeedConsumptionFormOptions(supabase),
        fetchFeedConsumptionForEdit(supabase, movementId),
      ]);
      return { ...options, consumption };
    },
  });
}

async function getFeedConsumptionFormOptions(client: NonNullable<typeof supabase>) {
  const [feedItems, stock] = await Promise.all([fetchFeedItems(client, false), fetchFeedStock(client)]);
  return { feedItems, stock };
}
