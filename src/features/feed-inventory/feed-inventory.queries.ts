import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { fetchFeedInventoryMovements, fetchFeedInventoryStock } from './feed-inventory.service';

export const feedInventoryQueryKeys = {
  all: ['feed-inventory'] as const,
  stock: () => [...feedInventoryQueryKeys.all, 'stock'] as const,
  movements: (input: {
    page: number;
    pageSize: number;
    from: string;
    to: string;
    feedItemId: string;
    movementType: string;
  }) =>
    [
      ...feedInventoryQueryKeys.all,
      'movements',
      input.page,
      input.pageSize,
      input.from,
      input.to,
      input.feedItemId,
      input.movementType,
    ] as const,
};

export function useFeedInventoryStockQuery() {
  return useQuery({
    queryKey: feedInventoryQueryKeys.stock(),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return fetchFeedInventoryStock(supabase);
    },
  });
}

export function useFeedInventoryMovementsQuery(input: {
  page: number;
  pageSize: number;
  from: string;
  to: string;
  feedItemId: string;
  movementType: string;
}) {
  return useQuery({
    queryKey: feedInventoryQueryKeys.movements(input),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return fetchFeedInventoryMovements(supabase, input.page, input.pageSize, input);
    },
  });
}
