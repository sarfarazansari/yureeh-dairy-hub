import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getFeedItemsPage } from './feed-items.service';

export const feedItemsQueryKeys = {
  all: ['feed-items'] as const,
  page: (page: number, pageSize: number, search: string) =>
    [...feedItemsQueryKeys.all, 'page', page, pageSize, search] as const,
};

export function useFeedItemsPageQuery(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: feedItemsQueryKeys.page(page, pageSize, search),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getFeedItemsPage(supabase, page, pageSize, search);
    },
  });
}

async function invalidateFeedItemDependents(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: feedItemsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['feed-inventory'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-purchases'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-consumption'] }),
    queryClient.invalidateQueries({ queryKey: ['diet-plans'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-cost-analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}

export function useSaveFeedItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      id?: string;
      values: {
        name: string;
        category: string;
        baseUnit: string;
        purchaseUnit: string;
        conversion: number;
        lowStockThreshold: number;
        notes: string | null;
      };
    }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const payload = {
        name: input.values.name.trim(),
        category: input.values.category,
        base_unit: input.values.baseUnit.trim().toUpperCase(),
        purchase_unit: input.values.purchaseUnit.trim().toUpperCase(),
        purchase_unit_quantity: input.values.conversion,
        low_stock_threshold: input.values.lowStockThreshold,
        notes: input.values.notes,
        user_id: input.userId,
      };
      const result = input.id
        ? await supabase.from('feed_items').update(payload).eq('id', input.id).eq('user_id', input.userId).select().single()
        : await supabase.from('feed_items').insert(payload).select().single();
      if (result.error) {
        if (result.error.code === '23505') throw new Error('A feed item with this name already exists.');
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => invalidateFeedItemDependents(queryClient),
  });
}

export function useToggleFeedItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('feed_items').update({ is_active: input.isActive }).eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateFeedItemDependents(queryClient),
  });
}
