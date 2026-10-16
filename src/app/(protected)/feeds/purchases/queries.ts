import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { fetchFeedPurchases } from './services';

const PAGE_SIZE = 20;

export const feedPurchaseQueryKeys = {
  all: ['feed-purchases'] as const,
  list: (input: { page: number; from: string; to: string; feedFilter: string; vendorFilter: string; paymentFilter: string }) =>
    [...feedPurchaseQueryKeys.all, 'list', input.page, PAGE_SIZE, input.from, input.to, input.feedFilter, input.vendorFilter, input.paymentFilter] as const,
  formOptions: () => [...feedPurchaseQueryKeys.all, 'form-options'] as const,
};

export function useFeedPurchaseArchiveQuery(input: {
  page: number; from: string; to: string; feedFilter: string; vendorFilter: string; paymentFilter: string;
}) {
  return useQuery({
    queryKey: feedPurchaseQueryKeys.list(input),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [feeds, vendorResult, purchases] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        fetchFeedPurchases(supabase, input.page, PAGE_SIZE, {
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
