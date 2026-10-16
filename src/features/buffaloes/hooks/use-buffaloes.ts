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
  getBuffaloAcquisitionCosts,
  getBuffaloAcquisitionCostExpenses,
  recordBuffaloAcquisitionCost,
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
  BuffaloAcquisitionCost,
  BuffaloAcquisitionExpenseOption,
  BuffaloVendorEditInput,
} from '../types';
import { getBuffaloProductionHistory } from '@/features/buffalo-production/services/buffalo-production.service';
import type { BuffaloProductionHistoryRecord } from '@/features/buffalo-production/types';
import type { BuffaloPurchaseFormValues } from '../validation';
import { buffaloProductionQueryKeys } from '@/features/buffalo-production/buffalo-production.query-keys';
import { buffaloQueryKeys } from '../buffalo.query-keys';



function getClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

/** Fetch capitalized acquisition costs and eligible expense links for a buffalo. */
export function useBuffaloAcquisitionCostsQuery(buffaloId: string) {
  return useQuery<BuffaloAcquisitionCost[]>({
    queryKey: buffaloQueryKeys.acquisitionCosts(buffaloId),
    queryFn: () => getBuffaloAcquisitionCosts(getClient(), buffaloId),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloAcquisitionCostExpensesQuery(buffaloId: string) {
  return useQuery<BuffaloAcquisitionExpenseOption[]>({
    queryKey: buffaloQueryKeys.acquisitionCostExpenses(buffaloId),
    queryFn: () => getBuffaloAcquisitionCostExpenses(getClient(), buffaloId),
    enabled: Boolean(buffaloId),
  });
}

export function useRecordBuffaloAcquisitionCostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      buffaloId: string;
      expenseId: string;
      costDate: string;
      description: string;
      amount: number;
      notes: string | null;
    }) => recordBuffaloAcquisitionCost(getClient(), input),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: buffaloQueryKeys.acquisitionCosts(input.buffaloId) }),
        queryClient.invalidateQueries({ queryKey: buffaloQueryKeys.acquisitionCostExpenses(input.buffaloId) }),
        queryClient.invalidateQueries({ queryKey: buffaloQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

/** Fetch the herd directory. */
export function useBuffaloDirectory() {
  return useQuery<BuffaloListItem[]>({
    queryKey: buffaloQueryKeys.directory(),
    queryFn: () => getBuffaloDirectory(getClient()),
  });
}

/** Fetch one buffalo and its purchase information. */
export function useBuffaloDetail(id: string) {
  return useQuery<BuffaloDetail | null>({
    queryKey: buffaloQueryKeys.detail(id),
    queryFn: () => getBuffaloDetails(getClient(), id),
    enabled: Boolean(id),
  });
}

/** Fetch production history for a buffalo detail view. */
export function useBuffaloPurchasePayments(buffaloId: string | undefined) {
  return useQuery<BuffaloPurchasePayment[]>({
    queryKey: buffaloQueryKeys.payments(buffaloId ?? ''),
    queryFn: () => getBuffaloPurchasePayments(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloStatusHistory(buffaloId: string | undefined) {
  return useQuery<BuffaloStatusHistory[]>({
    queryKey: buffaloQueryKeys.statusHistory(buffaloId ?? ''),
    queryFn: () => getBuffaloStatusHistory(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloProductionHistory(buffaloId: string | undefined) {
  return useQuery<BuffaloProductionHistoryRecord[]>({
    queryKey: buffaloProductionQueryKeys.history(buffaloId ?? ''),
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: buffaloQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: buffaloProductionQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['diet-plans'] }),
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
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
    queryKey: buffaloQueryKeys.sale(buffaloId ?? ''),
    queryFn: () => getBuffaloSale(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloSalePayments(buffaloId: string | undefined) {
  return useQuery<BuffaloSalePayment[]>({
    queryKey: buffaloQueryKeys.salePayments(buffaloId ?? ''),
    queryFn: () => getBuffaloSalePayments(getClient(), buffaloId!),
    enabled: Boolean(buffaloId),
  });
}

export function useBuffaloDisposal(buffaloId: string | undefined) {
  return useQuery<BuffaloDisposal | null>({
    queryKey: buffaloQueryKeys.disposal(buffaloId ?? ''),
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
    queryKey: buffaloQueryKeys.salesArchive(page, pageSize, filters),
    queryFn: () => getBuffaloSales(getClient(), page, pageSize, filters),
  });
}
