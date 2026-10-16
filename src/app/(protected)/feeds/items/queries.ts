import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getFeedItemsPage } from './services';

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
