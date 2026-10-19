import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { createFeedPurchase, deleteFeedPurchase, editFeedPurchase, fetchFeedPurchaseForEdit, fetchFeedPurchases } from './feed-purchases.service';

export const feedPurchaseQueryKeys = {
  all: ['feed-purchases'] as const,
  list: (input: { page: number; pageSize: number; from: string; to: string; feedFilter: string; vendorFilter: string; paymentFilter: string }) =>
    [...feedPurchaseQueryKeys.all, 'list', input.page, input.pageSize, input.from, input.to, input.feedFilter, input.vendorFilter, input.paymentFilter] as const,
  formOptions: () => [...feedPurchaseQueryKeys.all, 'form-options'] as const,
};

export function useFeedPurchaseArchiveQuery(input: {
  page: number; pageSize: number; from: string; to: string; feedFilter: string; vendorFilter: string; paymentFilter: string;
}) {
  return useQuery({
    queryKey: feedPurchaseQueryKeys.list(input),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [feeds, vendorResult, purchases] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        fetchFeedPurchases(supabase, input.page, input.pageSize, {
          from: input.from, to: input.to, feedItemId: input.feedFilter,
          vendorId: input.vendorFilter, paymentStatus: input.paymentFilter,
        }),
      ]);
      if (feeds.error) throw feeds.error;
      if (vendorResult.error) throw vendorResult.error;
      return { feedItems: feeds.data ?? [], vendors: vendorResult.data ?? [], ...purchases };
    },
  });
}


async function invalidateFeedPurchaseDependents(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: feedPurchaseQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['feed-inventory'] }),
    queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    queryClient.invalidateQueries({ queryKey: ['expense-vendors'] }),
    queryClient.invalidateQueries({ queryKey: ['expense-categories'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-cost-analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}

export function useCreateFeedPurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { values: Parameters<typeof createFeedPurchase>[1]; idempotencyKey: string }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return createFeedPurchase(supabase, input.values, input.idempotencyKey);
    },
    onSuccess: () => invalidateFeedPurchaseDependents(queryClient),
  });
}

export function useEditFeedPurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { purchaseId: string; values: Parameters<typeof editFeedPurchase>[2] }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return editFeedPurchase(supabase, input.purchaseId, input.values);
    },
    onSuccess: () => invalidateFeedPurchaseDependents(queryClient),
  });
}

export function useDeleteFeedPurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (purchaseId: string) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return deleteFeedPurchase(supabase, purchaseId);
    },
    onSuccess: () => invalidateFeedPurchaseDependents(queryClient),
  });
}


export function useFeedPurchaseFormOptionsQuery() {
  return useQuery({
    queryKey: feedPurchaseQueryKeys.formOptions(),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [feeds, vendors] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
      ]);
      if (feeds.error) throw feeds.error;
      if (vendors.error) throw vendors.error;
      return { feedItems: feeds.data ?? [], vendors: vendors.data ?? [] };
    },
  });
}

export function useFeedPurchaseForEditQuery(purchaseId: string) {
  return useQuery({
    queryKey: [...feedPurchaseQueryKeys.all, 'detail', purchaseId] as const,
    enabled: Boolean(purchaseId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [options, existing] = await Promise.all([
        (async () => {
          const [feeds, vendors] = await Promise.all([
            supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
            supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
          ]);
          if (feeds.error) throw feeds.error;
          if (vendors.error) throw vendors.error;
          return { feedItems: feeds.data ?? [], vendors: vendors.data ?? [] };
        })(),
        fetchFeedPurchaseForEdit(supabase, purchaseId),
      ]);
      return { ...options, existing };
    },
  });
}
