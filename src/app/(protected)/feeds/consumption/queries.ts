import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { fetchFeedConsumption, fetchFeedItems } from './services';

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
