'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  changeBuffaloStatus,
  createBuffaloPurchase,
  getBuffaloDetails,
  getBuffaloDirectory,
  recordBuffaloPurchasePayment,
  updateBuffaloProfile,
  type BuffaloDetail,
  type BuffaloListItem,
} from '../services/buffalo.service';
import {
  getBuffaloProductionHistory,
  type BuffaloProductionHistoryRecord,
} from '@/features/buffalo-production/services/buffalo-production.service';
import type { BuffaloPurchaseFormValues } from '@/lib/buffalo-validation';

const buffaloKeys = {
  all: ['buffaloes'] as const,
  directory: () => [...buffaloKeys.all, 'directory'] as const,
  detail: (code: string) => [...buffaloKeys.all, 'detail', code] as const,
  production: (buffaloId: string) => [...buffaloKeys.all, 'production', buffaloId] as const,
};

function getClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

/** Fetch the herd directory. */
export function useBuffaloDirectory() {
  return useQuery<BuffaloListItem[]>({
    queryKey: buffaloKeys.directory(),
    queryFn: () => getBuffaloDirectory(getClient()),
  });
}

/** Fetch one buffalo and its purchase information. */
export function useBuffaloDetail(code: string) {
  return useQuery<BuffaloDetail | null>({
    queryKey: buffaloKeys.detail(code),
    queryFn: () => getBuffaloDetails(getClient(), code),
    enabled: Boolean(code),
  });
}

/** Fetch production history for a buffalo detail view. */
export function useBuffaloProductionHistory(buffaloId: string | undefined) {
  return useQuery<BuffaloProductionHistoryRecord[]>({
    queryKey: buffaloKeys.production(buffaloId ?? ''),
    queryFn: () => getBuffaloProductionHistory(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

type CreateBuffaloPurchaseInput = {
  purchase: BuffaloPurchaseFormValues;
  balanceDue: boolean;
};

type UpdateBuffaloProfileInput = {
  buffaloId: string;
  profile: Parameters<typeof updateBuffaloProfile>[2];
};

type RecordPurchasePaymentInput = {
  buffaloId: string;
  payment: Parameters<typeof recordBuffaloPurchasePayment>[2];
};

type ChangeBuffaloStatusInput = {
  buffaloId: string;
  status: Parameters<typeof changeBuffaloStatus>[2];
  effectiveDate: string;
  notes?: string;
}

/** Mutations invalidate the affected buffalo queries instead of manually syncing local state. */
function useBuffaloMutation<TVariables, TData = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): UseMutationResult<TData, Error, TVariables> {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: buffaloKeys.all }),
  });
}

export function useCreateBuffaloPurchase() {
  return useBuffaloMutation(({ purchase, balanceDue }: CreateBuffaloPurchaseInput) =>
    createBuffaloPurchase(getClient(), purchase, balanceDue),
  );
}

export function useUpdateBuffaloProfile() {
  return useBuffaloMutation(({ buffaloId, profile }: UpdateBuffaloProfileInput) =>
    updateBuffaloProfile(getClient(), buffaloId, profile),
  );
}

export function useRecordBuffaloPurchasePayment() {
  return useBuffaloMutation(({ buffaloId, payment }: RecordPurchasePaymentInput) =>
    recordBuffaloPurchasePayment(getClient(), buffaloId, payment),
  );
}

export function useChangeBuffaloStatus() {
  return useBuffaloMutation(
    ({ buffaloId, status, effectiveDate, notes }: ChangeBuffaloStatusInput) =>
      changeBuffaloStatus(getClient(), buffaloId, status, effectiveDate, notes),
  );
}
