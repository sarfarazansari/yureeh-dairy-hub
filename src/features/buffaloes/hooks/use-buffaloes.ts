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
  createBuffaloSale,
  getBuffaloSale,
  getBuffaloSalePayments,
  getBuffaloDisposal,
  getBuffaloSales,
  recordBuffaloSalePayment,
  recordBuffaloDisposal,
  createBuffaloPurchase,
  getBuffaloDetails,
  getBuffaloDirectory,
  recordBuffaloPurchasePayment,
  getBuffaloPurchasePayments,
  getBuffaloStatusHistory,
  updateBuffaloProfile,
  updateBuffaloPurchase,
  updateBuffaloVendor,
} from '../services/buffalo.service';
import type {
  BuffaloDetail,
  BuffaloListItem,
  BuffaloPurchaseEditInput,
  BuffaloPurchasePayment,
  BuffaloStatusHistory,
  BuffaloStatusChangeInput,
  BuffaloSale,
  BuffaloSaleInput,
  BuffaloSalePayment,
  BuffaloSalePaymentInput,
  BuffaloDisposal,
  BuffaloDisposalInput,
  BuffaloVendorEditInput,
} from '../types';
import { getBuffaloProductionHistory } from '@/features/buffalo-production/services/buffalo-production.service';
import type { BuffaloProductionHistoryRecord } from '@/features/buffalo-production/types';
import type { BuffaloPurchaseFormValues } from '../validation';

const buffaloKeys = {
  all: ['buffaloes'] as const,
  directory: () => [...buffaloKeys.all, 'directory'] as const,
  detail: (id: string) => [...buffaloKeys.all, 'detail', id] as const,
  production: (buffaloId: string) => [...buffaloKeys.all, 'production', buffaloId] as const,
  payments: (buffaloId: string) => [...buffaloKeys.all, 'payments', buffaloId] as const,
  statusHistory: (buffaloId: string) => [...buffaloKeys.all, 'status-history', buffaloId] as const,
  sale: (buffaloId: string) => [...buffaloKeys.all, 'sale', buffaloId] as const,
  salePayments: (buffaloId: string) => [...buffaloKeys.all, 'sale-payments', buffaloId] as const,
  disposal: (buffaloId: string) => [...buffaloKeys.all, 'disposal', buffaloId] as const,
  salesArchive: (page: number, pageSize: number, filters: { from?: string; to?: string; search?: string }) => [...buffaloKeys.all, 'sales-archive', page, pageSize, filters] as const,
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
export function useBuffaloDetail(id: string) {
  return useQuery<BuffaloDetail | null>({
    queryKey: buffaloKeys.detail(id),
    queryFn: () => getBuffaloDetails(getClient(), id),
    enabled: Boolean(id),
  });
}

/** Fetch production history for a buffalo detail view. */
export function useBuffaloPurchasePayments(buffaloId: string | undefined) {
  return useQuery<BuffaloPurchasePayment[]>({
    queryKey: buffaloKeys.payments(buffaloId ?? ''),
    queryFn: () => getBuffaloPurchasePayments(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloStatusHistory(buffaloId: string | undefined) {
  return useQuery<BuffaloStatusHistory[]>({
    queryKey: buffaloKeys.statusHistory(buffaloId ?? ''),
    queryFn: () => getBuffaloStatusHistory(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

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

type UpdateBuffaloPurchaseInput = {
  buffaloId: string;
  purchase: BuffaloPurchaseEditInput;
};

type UpdateBuffaloVendorInput = {
  buffaloId: string;
  vendor: BuffaloVendorEditInput;
};

type RecordPurchasePaymentInput = {
  buffaloId: string;
  payment: Parameters<typeof recordBuffaloPurchasePayment>[2];
};

type ChangeBuffaloStatusInput = BuffaloStatusChangeInput;

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

export function useUpdateBuffaloPurchase() {
  return useBuffaloMutation(({ buffaloId, purchase }: UpdateBuffaloPurchaseInput) =>
    updateBuffaloPurchase(getClient(), buffaloId, purchase),
  );
}

export function useUpdateBuffaloVendor() {
  return useBuffaloMutation(({ buffaloId, vendor }: UpdateBuffaloVendorInput) =>
    updateBuffaloVendor(getClient(), buffaloId, vendor),
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


export function useBuffaloSale(buffaloId: string | undefined) {
  return useQuery<BuffaloSale | null>({
    queryKey: buffaloKeys.sale(buffaloId ?? ''),
    queryFn: () => getBuffaloSale(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloSalePayments(buffaloId: string | undefined) {
  return useQuery<BuffaloSalePayment[]>({
    queryKey: buffaloKeys.salePayments(buffaloId ?? ''),
    queryFn: () => getBuffaloSalePayments(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloDisposal(buffaloId: string | undefined) {
  return useQuery<BuffaloDisposal | null>({
    queryKey: buffaloKeys.disposal(buffaloId ?? ''),
    queryFn: () => getBuffaloDisposal(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useCreateBuffaloSale() {
  return useBuffaloMutation(({ buffaloId, input }: { buffaloId: string; input: BuffaloSaleInput }) =>
    createBuffaloSale(getClient(), buffaloId, input),
  );
}

export function useRecordBuffaloSalePayment() {
  return useBuffaloMutation(({ saleId, input }: { saleId: string; input: BuffaloSalePaymentInput }) =>
    recordBuffaloSalePayment(getClient(), saleId, input),
  );
}

export function useRecordBuffaloDisposal() {
  return useBuffaloMutation(({ buffaloId, input }: { buffaloId: string; input: BuffaloDisposalInput }) =>
    recordBuffaloDisposal(getClient(), buffaloId, input),
  );
}

export function useBuffaloSalesArchive(
  page: number,
  pageSize: number,
  filters: { from?: string; to?: string; search?: string },
) {
  return useQuery({
    queryKey: buffaloKeys.salesArchive(page, pageSize, filters),
    queryFn: () => getBuffaloSales(getClient(), page, pageSize, filters),
  });
}
